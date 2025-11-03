# FastAPI backend for Borgmatic Web UI


from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import os
import threading
import time
import uuid
from datetime import datetime
from typing import Dict, Any


app = FastAPI()

# Job tracking
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

@app.post("/api/backup-create")
async def create_backup(request: Request):
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

@app.get("/api/jobs")
def list_jobs():
    """List all jobs."""
    # Return jobs sorted by created_at, newest first
    sorted_jobs = sorted(jobs.values(), key=lambda x: x.get("created_at", ""), reverse=True)
    return JSONResponse(sorted_jobs)

@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    """Get a specific job status."""
    if job_id not in jobs:
        return JSONResponse({"error": "Job not found"}, status_code=404)
    return JSONResponse(jobs[job_id])

@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str):
    """Delete a job from history."""
    if job_id not in jobs:
        return JSONResponse({"error": "Job not found"}, status_code=404)
    del jobs[job_id]
    return JSONResponse({"message": "Job deleted"})

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

# SPA fallback: serve index.html for all non-API, non-static, non-assets routes
@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("static/") or full_path.startswith("assets/"):
        return JSONResponse({"error": "Not found"}, status_code=404)
    index_path = os.path.join(os.path.dirname(__file__), "../webui/dist/index.html")
    return FileResponse(index_path)
