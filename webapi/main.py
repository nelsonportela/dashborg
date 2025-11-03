# FastAPI backend for Borgmatic Web UI


from fastapi import FastAPI, Request, Depends
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
import subprocess
import os
import threading
import time
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
import json

from database import init_db, get_db, Repository, Archive, BackupJob, RepositoryStatistics, SessionLocal

app = FastAPI()

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    print("✓ Database initialized")

# Job tracking (in-memory for real-time updates, persisted to DB)
jobs: Dict[str, Dict[str, Any]] = {}

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (built frontend) at /static
app.mount("/static", StaticFiles(directory="../webui/dist", html=True), name="static")

# Serve static assets (JS/CSS) from /assets
app.mount("/assets", StaticFiles(directory="../webui/dist/assets", html=False), name="assets")

# List config files in /etc/borgmatic

@app.get("/api/configs")
def list_borgmatic_configs():
    config_dir = "/etc/borgmatic"
    if not os.path.exists(config_dir):
        return JSONResponse([])
    try:
        files = [
            f for f in os.listdir(config_dir) 
            if os.path.isfile(os.path.join(config_dir, f)) 
            and not f.startswith('.') 
            and not f.endswith('.swp')
            and not f.endswith('~')
        ]
        return JSONResponse(files)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/configs/{filename}")
def get_config(filename: str):
    config_dir = "/etc/borgmatic"
    file_path = os.path.join(config_dir, filename)
    if not os.path.exists(file_path):
        return JSONResponse({"error": "File not found"}, status_code=404)
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        return Response(content, media_type="text/yaml")
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.put("/api/configs/{filename}")
async def save_config(filename: str, request: Request):
    config_dir = "/etc/borgmatic"
    file_path = os.path.join(config_dir, filename)
    try:
        content = await request.body()
        content = content.decode('utf-8')
        with open(file_path, 'w') as f:
            f.write(content)
        return JSONResponse({"message": "Saved"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/validate-config")
async def validate_config(request: Request):
    try:
        content = await request.body()
        content = content.decode('utf-8')
        # Save to temp file
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write(content)
            temp_path = f.name
        try:
            # Run borgmatic config validate
            result = subprocess.run([
                "borgmatic", "config", "validate", "--config", temp_path
            ], capture_output=True, text=True, check=True)
            return JSONResponse({"valid": True, "output": result.stdout})
        except subprocess.CalledProcessError as e:
            return JSONResponse({"valid": False, "error": e.stderr})
        finally:
            os.unlink(temp_path)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/repo-create")
async def create_repository(request: Request):
    """Create Borg repositories based on borgmatic config."""
    try:
        data = await request.json()
        config_file = data.get("config", "config.yaml")
        encryption_mode = data.get("encryption_mode")
        append_only = data.get("append_only", False)
        storage_quota = data.get("storage_quota")
        make_parent_dirs = data.get("make_parent_dirs", False)
        
        # Build command
        cmd = ["borgmatic", "repo-create", "--config", f"/etc/borgmatic/{config_file}", "--verbosity", "1"]
        
        if encryption_mode:
            cmd.extend(["--encryption", encryption_mode])
        if append_only:
            cmd.append("--append-only")
        if storage_quota:
            cmd.extend(["--storage-quota", storage_quota])
        if make_parent_dirs:
            cmd.append("--make-parent-dirs")
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return JSONResponse({"success": True, "output": result.stdout})
    except subprocess.CalledProcessError as e:
        return JSONResponse({"success": False, "error": e.stderr, "output": e.stdout}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

def run_job_in_background(job_id: str, cmd: list, job_type: str, config_file: str = None):
    """Run a command in background and track its status with real-time progress."""
    import json
    
    jobs[job_id]["status"] = "running"
    jobs[job_id]["started_at"] = datetime.now().isoformat()
    jobs[job_id]["stats"] = None
    jobs[job_id]["output_lines"] = []
    jobs[job_id]["progress_info"] = {
        "current_file": None,
        "files_processed": 0,
        "last_update": None
    }
    
    try:
        # Run process with combined output (stderr redirected to stdout)
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # Combine stderr into stdout
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        all_lines = []
        files_processed = 0
        
        # Read output line by line
        while True:
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            
            if line:
                line = line.strip()
                if line:
                    all_lines.append(line)
                    jobs[job_id]["output_lines"].append(line)
                    
                    # Track file progress (lines starting with single character like 'A', 'M', 'U' followed by space and path)
                    # Example: "A /path/to/file" (A = Added, M = Modified, U = Unchanged)
                    if len(line) > 2 and line[0] in ['A', 'M', 'U', '-'] and line[1] == ' ':
                        files_processed += 1
                        current_file = line[2:] if len(line) > 2 else ""
                        jobs[job_id]["progress_info"] = {
                            "current_file": current_file,
                            "files_processed": files_processed,
                            "last_update": datetime.now().isoformat()
                        }
        
        # Wait for process to complete
        return_code = process.wait()
        
        jobs[job_id]["status"] = "completed" if return_code == 0 else "failed"
        jobs[job_id]["output"] = "\n".join(all_lines) if all_lines else "No output"
        jobs[job_id]["return_code"] = return_code
        
        # If backup completed successfully, fetch statistics separately
        if return_code == 0 and job_type == "backup-create" and config_file:
            try:
                # Run borgmatic info to get the last archive stats with JSON
                info_cmd = [
                    "borgmatic", "info",
                    "--config", f"/etc/borgmatic/{config_file}",
                    "--archive", "latest",
                    "--json"
                ]
                result = subprocess.run(info_cmd, capture_output=True, text=True, timeout=30)
                if result.returncode == 0 and result.stdout:
                    try:
                        data = json.loads(result.stdout)
                        if isinstance(data, list) and len(data) > 0:
                            info_data = data[0]
                            # Transform borgmatic info structure to match create --json structure
                            # info returns: {"archives": [...], "repository": {...}, "encryption": {...}, "cache": {...}}
                            # We need: {"archive": {...}, "repository": {...}, "encryption": {...}}
                            if "archives" in info_data and len(info_data["archives"]) > 0:
                                transformed = {
                                    "archive": info_data["archives"][0],  # Get the latest archive
                                    "repository": info_data.get("repository", {}),
                                    "encryption": info_data.get("encryption", {}),
                                    "cache": info_data.get("cache", {})
                                }
                                jobs[job_id]["stats"] = transformed
                            else:
                                jobs[job_id]["stats"] = info_data
                    except json.JSONDecodeError:
                        pass
            except Exception as e:
                # Don't fail the job if stats fetch fails
                jobs[job_id]["stats_error"] = str(e)
        
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["output"] = str(e)
    
    jobs[job_id]["completed_at"] = datetime.now().isoformat()
    
    # Persist job to database
    try:
        db = SessionLocal()
        db_job = BackupJob(
            job_id=job_id,
            job_type=job_type,
            config_file=config_file,
            command=" ".join(cmd),
            status=jobs[job_id]["status"],
            created_at=datetime.fromisoformat(jobs[job_id]["created_at"]),
            started_at=datetime.fromisoformat(jobs[job_id]["started_at"]) if jobs[job_id].get("started_at") else None,
            completed_at=datetime.fromisoformat(jobs[job_id]["completed_at"]) if jobs[job_id].get("completed_at") else None,
            files_processed=jobs[job_id]["progress_info"].get("files_processed", 0),
            current_file=jobs[job_id]["progress_info"].get("current_file"),
            last_progress_update=datetime.fromisoformat(jobs[job_id]["progress_info"]["last_update"]) if jobs[job_id]["progress_info"].get("last_update") else None,
            return_code=jobs[job_id].get("return_code"),
            output=jobs[job_id].get("output", ""),
            error=jobs[job_id].get("error"),
            stats=jobs[job_id].get("stats")
        )
        db.add(db_job)
        db.commit()
        db.close()
    except Exception as e:
        print(f"Error persisting job to database: {e}")

@app.post("/api/backup-create")
async def create_backup(request: Request, db: Session = Depends(get_db)):
    """Create a backup using borgmatic create command with JSON output."""
    try:
        data = await request.json()
        config_file = data.get("config", "config.yaml")
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Build command - Using --list to show files being processed
        # Note: --list and --json cannot be used together, so we fetch stats separately after completion
        cmd = [
            "borgmatic", "create", 
            "--config", f"/etc/borgmatic/{config_file}",
            "--verbosity", "1",
            "--list",  # Show files being backed up for progress tracking
            "--stats"  # Show text statistics (JSON stats fetched separately after completion)
        ]
        
        # Initialize job
        jobs[job_id] = {
            "id": job_id,
            "type": "backup-create",
            "command": " ".join(cmd),
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "config": config_file,
            "stats": None,
            "output_lines": [],
            "progress_info": {
                "current_file": None,
                "files_processed": 0,
                "last_update": None
            }
        }
        
        # Run in background thread, passing config_file for stats fetching
        thread = threading.Thread(target=run_job_in_background, args=(job_id, cmd, "backup-create", config_file))
        thread.daemon = True
        thread.start()
        
        return JSONResponse({"job_id": job_id, "message": "Backup job started"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/prune")
async def prune_archives(request: Request):
    """Prune old archives according to retention policy."""
    try:
        data = await request.json()
        config_file = data.get("config", "config.yaml")
        dry_run = data.get("dry_run", False)
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Build command
        cmd = [
            "borgmatic", "prune",
            "--config", f"/etc/borgmatic/{config_file}",
            "--verbosity", "1",
            "--stats"
        ]
        
        if dry_run:
            cmd.append("--dry-run")
        
        # Initialize job
        jobs[job_id] = {
            "id": job_id,
            "type": "prune" if not dry_run else "prune-dry-run",
            "command": " ".join(cmd),
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "config": config_file,
            "stats": None,
            "output_lines": [],
            "progress_info": {
                "current_file": None,
                "files_processed": 0,
                "last_update": None
            }
        }
        
        # Run in background
        thread = threading.Thread(target=run_job_in_background, args=(job_id, cmd, "prune"))
        thread.daemon = True
        thread.start()
        
        return JSONResponse({"job_id": job_id, "message": f"Prune job started ({'dry-run' if dry_run else 'live'})"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/check")
async def check_repository(request: Request):
    """Check repository consistency and integrity."""
    try:
        data = await request.json()
        config_file = data.get("config", "config.yaml")
        check_type = data.get("check_type", "repository")  # repository, archives, data, extract
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Build command
        cmd = [
            "borgmatic", "check",
            "--config", f"/etc/borgmatic/{config_file}",
            "--verbosity", "1"
        ]
        
        # Add check options based on type
        if check_type == "repository":
            cmd.append("--repository-only")
        elif check_type == "archives":
            cmd.append("--archives-only")
        elif check_type == "data":
            cmd.extend(["--verify-data"])
        # "extract" uses default check behavior
        
        # Initialize job
        jobs[job_id] = {
            "id": job_id,
            "type": f"check-{check_type}",
            "command": " ".join(cmd),
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "config": config_file,
            "stats": None,
            "output_lines": [],
            "progress_info": {
                "current_file": None,
                "files_processed": 0,
                "last_update": None
            }
        }
        
        # Run in background
        thread = threading.Thread(target=run_job_in_background, args=(job_id, cmd, f"check-{check_type}"))
        thread.daemon = True
        thread.start()
        
        return JSONResponse({"job_id": job_id, "message": f"Check job started ({check_type})"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/jobs")
def list_jobs(db: Session = Depends(get_db), limit: int = 50, offset: int = 0):
    """List all jobs from database and merge with in-memory active jobs."""
    try:
        # Get jobs from database
        db_jobs = db.query(BackupJob)\
            .order_by(desc(BackupJob.created_at))\
            .offset(offset)\
            .limit(limit)\
            .all()
        
        # Convert database jobs to dict format
        job_list = []
        for db_job in db_jobs:
            job_dict = {
                "id": db_job.job_id,
                "type": db_job.job_type,
                "command": db_job.command,
                "config": db_job.config_file,
                "status": db_job.status,
                "created_at": db_job.created_at.isoformat() if db_job.created_at else None,
                "started_at": db_job.started_at.isoformat() if db_job.started_at else None,
                "completed_at": db_job.completed_at.isoformat() if db_job.completed_at else None,
                "return_code": db_job.return_code,
                "output": db_job.output,
                "error": db_job.error,
                "stats": db_job.stats,
                "progress_info": {
                    "files_processed": db_job.files_processed or 0,
                    "current_file": db_job.current_file,
                    "last_update": None
                }
            }
            job_list.append(job_dict)
        
        # Merge with in-memory jobs (for active/pending jobs not yet persisted)
        in_memory_ids = set()
        for job_id, job_data in jobs.items():
            in_memory_ids.add(job_id)
            # Check if this job is already in database list
            if not any(j["id"] == job_id for j in job_list):
                job_list.append(job_data)
        
        # Update database jobs with in-memory data if they're still active
        for i, job in enumerate(job_list):
            if job["id"] in jobs:
                # Override with latest in-memory data for active jobs
                job_list[i] = jobs[job["id"]]
        
        # Sort by created_at, newest first
        job_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return JSONResponse(job_list)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/jobs/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db)):
    """Get a specific job status."""
    # First check in-memory jobs for active jobs
    if job_id in jobs:
        return JSONResponse(jobs[job_id])
    
    # Otherwise check database for historical jobs
    db_job = db.query(BackupJob).filter(BackupJob.job_id == job_id).first()
    if not db_job:
        return JSONResponse({"error": "Job not found"}, status_code=404)
    
    return JSONResponse({
        "id": db_job.job_id,
        "type": db_job.job_type,
        "command": db_job.command,
        "config": db_job.config_file,
        "status": db_job.status,
        "created_at": db_job.created_at.isoformat() if db_job.created_at else None,
        "started_at": db_job.started_at.isoformat() if db_job.started_at else None,
        "completed_at": db_job.completed_at.isoformat() if db_job.completed_at else None,
        "return_code": db_job.return_code,
        "output": db_job.output,
        "error": db_job.error,
        "stats": db_job.stats,
        "progress_info": {
            "files_processed": db_job.files_processed or 0,
            "current_file": db_job.current_file,
            "last_update": db_job.last_progress_update.isoformat() if db_job.last_progress_update else None
        }
    })

@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str, db: Session = Depends(get_db)):
    """Delete a job from history (both in-memory and database)."""
    try:
        # Delete from in-memory jobs
        if job_id in jobs:
            del jobs[job_id]
        
        # Delete from database
        db_job = db.query(BackupJob).filter(BackupJob.job_id == job_id).first()
        if db_job:
            db.delete(db_job)
            db.commit()
            return JSONResponse({"message": "Job deleted from database"})
        
        if job_id not in jobs and not db_job:
            return JSONResponse({"error": "Job not found"}, status_code=404)
        
        return JSONResponse({"message": "Job deleted"})
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/borgmatic/{command}")
def run_borgmatic_command(command: str):
    """Run a borgmatic command (e.g., info, list, prune, etc.) and return output."""
    try:
        result = subprocess.run([
            "borgmatic", command, "--verbosity", "1"
        ], capture_output=True, text=True, check=True)
        return JSONResponse({"output": result.stdout})
    except subprocess.CalledProcessError as e:
        return JSONResponse({"error": e.stderr}, status_code=500)


# ============================================================================
# STATS & DATA COLLECTION ENDPOINTS
# ============================================================================

@app.post("/api/sync-repositories")
async def sync_repositories(request: Request, db: Session = Depends(get_db)):
    """Sync repository information from borgmatic/borg to database."""
    try:
        data = await request.json()
        config_file = data.get("config", "config.yaml")
        
        # Get repository info using borgmatic info --json
        cmd = ["borgmatic", "info", "--config", f"/etc/borgmatic/{config_file}", "--json"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            return JSONResponse({"error": result.stderr}, status_code=500)
        
        info_data = json.loads(result.stdout)
        synced_repos = []
        
        for repo_info in info_data:
            if "repository" in repo_info:
                repo_data = repo_info["repository"]
                encryption_data = repo_info.get("encryption", {})
                
                # Check if repository exists
                repo = db.query(Repository).filter(
                    Repository.repo_id == repo_data.get("id")
                ).first()
                
                if repo:
                    # Update existing
                    repo.location = repo_data.get("location")
                    repo.encryption_mode = encryption_data.get("mode")
                    repo.last_modified = datetime.fromisoformat(repo_data.get("last_modified").replace("Z", "+00:00")) if repo_data.get("last_modified") else None
                    repo.updated_at = datetime.utcnow()
                else:
                    # Create new
                    repo = Repository(
                        label=repo_data.get("label", "unknown"),
                        location=repo_data.get("location"),
                        repo_id=repo_data.get("id"),
                        encryption_mode=encryption_data.get("mode"),
                        last_modified=datetime.fromisoformat(repo_data.get("last_modified").replace("Z", "+00:00")) if repo_data.get("last_modified") else None
                    )
                    db.add(repo)
                
                # Store cache statistics
                if "cache" in repo_info and "stats" in repo_info["cache"]:
                    cache_stats = repo_info["cache"]["stats"]
                    dedup_ratio = 0
                    if cache_stats.get("total_size", 0) > 0:
                        dedup_ratio = 1 - (cache_stats.get("unique_size", 0) / cache_stats.get("total_size", 1))
                    
                    repo_stats = RepositoryStatistics(
                        repository=repo,
                        total_chunks=cache_stats.get("total_chunks"),
                        total_csize=cache_stats.get("total_csize"),
                        total_size=cache_stats.get("total_size"),
                        unique_chunks=cache_stats.get("total_unique_chunks"),
                        unique_csize=cache_stats.get("unique_csize"),
                        unique_size=cache_stats.get("unique_size"),
                        deduplication_ratio=dedup_ratio
                    )
                    db.add(repo_stats)
                
                synced_repos.append({
                    "label": repo.label,
                    "location": repo.location,
                    "repo_id": repo.repo_id
                })
        
        db.commit()
        return JSONResponse({"synced_repositories": synced_repos, "count": len(synced_repos)})
        
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/sync-archives")
async def sync_archives(request: Request, db: Session = Depends(get_db)):
    """Sync all archives from all repositories to database using two-step approach."""
    try:
        data = await request.json()
        config_file = data.get("config", "config.yaml")
        
        # Step 1: Use borgmatic list with --match-archives "*" to get ALL archive names
        # This bypasses archive_name_format filter
        list_cmd = ["borgmatic", "list", "--config", f"/etc/borgmatic/{config_file}", "--json", "--match-archives", "*"]
        list_result = subprocess.run(list_cmd, capture_output=True, text=True, timeout=60)
        
        if list_result.returncode != 0:
            return JSONResponse({"error": list_result.stderr}, status_code=500)
        
        list_data = json.loads(list_result.stdout)
        synced_archives = []
        
        for repo_data in list_data:
            repo_location = repo_data.get("repository", {}).get("location")
            repo = db.query(Repository).filter(Repository.location == repo_location).first()
            
            if not repo:
                # Create repository if it doesn't exist
                repo = Repository(
                    label=repo_data.get("repository", {}).get("label", "unknown"),
                    location=repo_location,
                    repo_id=repo_data.get("repository", {}).get("id")
                )
                db.add(repo)
                db.flush()
            
            # Step 2: For each archive, fetch detailed info
            for archive_basic in repo_data.get("archives", []):
                archive_name = archive_basic.get("name")
                
                # Check if archive already exists in database
                existing_archive = db.query(Archive).filter(
                    Archive.archive_id == archive_basic.get("id")
                ).first()
                
                if existing_archive:
                    continue  # Skip if already synced
                
                # Fetch detailed info for this specific archive
                info_cmd = ["borgmatic", "info", "--config", f"/etc/borgmatic/{config_file}", "--json", "--archive", archive_name]
                info_result = subprocess.run(info_cmd, capture_output=True, text=True, timeout=30)
                
                if info_result.returncode != 0:
                    # If info fails, create archive with basic data only
                    start_time = None
                    if archive_basic.get("start"):
                        try:
                            start_time = datetime.fromisoformat(archive_basic["start"].replace("Z", "+00:00"))
                        except:
                            pass
                    
                    archive = Archive(
                        repository_id=repo.id,
                        name=archive_name,
                        archive_id=archive_basic.get("id"),
                        start=start_time
                    )
                    db.add(archive)
                    synced_archives.append(archive_name)
                    continue
                
                # Parse detailed info
                try:
                    info_data = json.loads(info_result.stdout)
                    if isinstance(info_data, list) and len(info_data) > 0:
                        info_repo = info_data[0]
                        if "archives" in info_repo and len(info_repo["archives"]) > 0:
                            archive_data = info_repo["archives"][0]  # Get the first (and only) archive
                        else:
                            continue
                    else:
                        continue
                except json.JSONDecodeError:
                    continue
                
                # Process archive with full details
                archive_data = info_repo["archives"][0]
                
                # Create archive with detailed stats
                if archive_data:
                    # Parse timestamps
                    start_time = None
                    if archive_data.get("start"):
                        try:
                            start_time = datetime.fromisoformat(archive_data["start"].replace("Z", "+00:00"))
                        except:
                            pass
                    
                    end_time = None
                    if archive_data.get("end"):
                        try:
                            end_time = datetime.fromisoformat(archive_data["end"].replace("Z", "+00:00"))
                        except:
                            pass
                    
                    # Create new archive
                    archive = Archive(
                        repository_id=repo.id,
                        name=archive_data.get("name"),
                        archive_id=archive_data.get("id"),
                        start=start_time,
                        end=end_time,
                        duration=archive_data.get("duration"),
                        original_size=archive_data.get("stats", {}).get("original_size"),
                        compressed_size=archive_data.get("stats", {}).get("compressed_size"),
                        deduplicated_size=archive_data.get("stats", {}).get("deduplicated_size"),
                        nfiles=archive_data.get("stats", {}).get("nfiles"),
                        hostname=archive_data.get("hostname"),
                        username=archive_data.get("username"),
                        comment=archive_data.get("comment"),
                        command_line=archive_data.get("command_line")
                    )
                    db.add(archive)
                    synced_archives.append(archive_data.get("name"))
        
        db.commit()
        return JSONResponse({"synced_archives": len(synced_archives), "archives": synced_archives[:10]})
        
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/stats/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get aggregated statistics for dashboard."""
    try:
        # Total repositories
        total_repos = db.query(func.count(Repository.id)).scalar()
        
        # Total archives
        total_archives = db.query(func.count(Archive.id)).scalar()
        
        # Last backup (most recent archive)
        last_archive = db.query(Archive).order_by(desc(Archive.start)).first()
        last_backup = last_archive.start.isoformat() if last_archive and last_archive.start else None
        
        # Total storage stats (from most recent repository statistics)
        latest_stats = db.query(RepositoryStatistics)\
            .order_by(desc(RepositoryStatistics.collected_at))\
            .limit(10)\
            .all()
        
        total_original = sum(s.total_size or 0 for s in latest_stats)
        total_unique = sum(s.unique_size or 0 for s in latest_stats)
        avg_dedup_ratio = sum(s.deduplication_ratio or 0 for s in latest_stats) / len(latest_stats) if latest_stats else 0
        
        # Archive size distribution
        archive_sizes = db.query(
            Archive.name,
            Archive.original_size,
            Archive.deduplicated_size,
            Archive.start
        ).order_by(desc(Archive.start)).limit(50).all()
        
        return JSONResponse({
            "summary": {
                "total_repositories": total_repos,
                "total_archives": total_archives,
                "last_backup": last_backup,
                "total_original_size": total_original,
                "total_unique_size": total_unique,
                "deduplication_percentage": avg_dedup_ratio * 100
            },
            "recent_archives": [
                {
                    "name": a.name,
                    "original_size": a.original_size,
                    "deduplicated_size": a.deduplicated_size,
                    "date": a.start.isoformat() if a.start else None
                }
                for a in archive_sizes
            ]
        })
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/archives")
def get_archives(
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
    repository: Optional[str] = None,
    search: Optional[str] = None
):
    """Get paginated list of archives with filtering."""
    try:
        query = db.query(Archive).join(Repository)
        
        # Filter by repository
        if repository:
            query = query.filter(Repository.label == repository)
        
        # Search by name
        if search:
            query = query.filter(Archive.name.contains(search))
        
        # Get total count
        total = query.count()
        
        # Get paginated results
        archives = query.order_by(desc(Archive.start)).offset(offset).limit(limit).all()
        
        return JSONResponse({
            "total": total,
            "limit": limit,
            "offset": offset,
            "archives": [
                {
                    "id": a.id,
                    "name": a.name,
                    "repository": a.repository.label,
                    "start": a.start.isoformat() if a.start else None,
                    "duration": a.duration,
                    "original_size": a.original_size,
                    "compressed_size": a.compressed_size,
                    "deduplicated_size": a.deduplicated_size,
                    "nfiles": a.nfiles,
                    "hostname": a.hostname
                }
                for a in archives
            ]
        })
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/repositories")
def get_repositories(db: Session = Depends(get_db)):
    """Get all repositories."""
    try:
        repos = db.query(Repository).all()
        return JSONResponse({
            "repositories": [
                {
                    "id": r.id,
                    "label": r.label,
                    "location": r.location,
                    "encryption_mode": r.encryption_mode,
                    "last_modified": r.last_modified.isoformat() if r.last_modified else None,
                    "archive_count": len(r.archives)
                }
                for r in repos
            ]
        })
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# SPA fallback: serve index.html for all non-API, non-static, non-assets routes
@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("static/") or full_path.startswith("assets/"):
        return JSONResponse({"error": "Not found"}, status_code=404)
    index_path = os.path.join(os.path.dirname(__file__), "../webui/dist/index.html")
    return FileResponse(index_path)
