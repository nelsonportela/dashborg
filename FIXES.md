# Job Persistence and Archives Display Fixes

## Issues Identified

### 1. Job Data Not Persisted Properly
**Problem**: The `/api/jobs` endpoint was only returning in-memory jobs, meaning job history was lost after container restart.

**Impact**: Users couldn't see when backups ran, check completion status, or review historical job information.

### 2. Archives Section Always Shows "No archives found"
**Problem**: The Stats page displays "No archives found" because:
- The database is empty on first run
- Users need to click "Sync Data" button to populate archives from borgmatic
- This wasn't clearly communicated

**Impact**: Users see empty archives section and may think the feature is broken.

## Fixes Applied

### 1. Enhanced Job Persistence

#### Modified `/api/jobs` Endpoint
- **Before**: Only returned in-memory `jobs` dict
- **After**: 
  - Queries `BackupJob` table from database
  - Merges database jobs with in-memory active jobs
  - Returns combined list with proper status tracking
  - Supports pagination with `limit` and `offset` parameters

**Code Changes** (`webapi/main.py`):
```python
@app.get("/api/jobs")
def list_jobs(db: Session = Depends(get_db), limit: int = 50, offset: int = 0):
    """List all jobs from database and merge with in-memory active jobs."""
    # Fetches from database and merges with active jobs
    # Returns comprehensive job history
```

#### Enhanced Job Persistence During Execution
- **Added**: `current_file` field to track which file is being processed
- **Added**: `last_progress_update` timestamp
- **Improved**: Job data now includes complete progress information

**Code Changes** (`webapi/main.py`):
```python
db_job = BackupJob(
    # ... existing fields ...
    files_processed=jobs[job_id]["progress_info"].get("files_processed", 0),
    current_file=jobs[job_id]["progress_info"].get("current_file"),
    last_progress_update=datetime.fromisoformat(jobs[job_id]["progress_info"]["last_update"]) 
        if jobs[job_id]["progress_info"].get("last_update") else None,
    # ... more fields ...
)
```

#### Updated `/api/jobs/{job_id}` Endpoint
- **Before**: Only checked in-memory jobs
- **After**: 
  - First checks in-memory jobs for active jobs
  - Falls back to database for historical jobs
  - Returns complete job information including progress data

#### Updated `/api/jobs/{job_id}` DELETE Endpoint
- **Before**: Only deleted from in-memory jobs
- **After**: 
  - Deletes from both in-memory and database
  - Handles cases where job exists in only one location
  - Returns appropriate error messages

### 2. Archives Display

#### No Code Changes Needed
The archives functionality was already correctly implemented. The issue is workflow-related:

**Expected Workflow**:
1. Navigate to Stats page
2. Click "Sync Data" button (syncs both repositories and archives from borgmatic)
3. Archives populate from borgmatic's existing backup data
4. Archives display in the table with search/filter functionality

**Why It Shows "No archives found"**:
- Database is empty on first container start
- Must manually trigger sync to populate data
- This is by design to avoid automatic sync on every page load

## Database Schema

### BackupJob Table
```python
class BackupJob(Base):
    __tablename__ = "backup_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, unique=True, index=True)  # UUID
    
    # Job info
    job_type = Column(String, index=True)
    config_file = Column(String)
    command = Column(Text)
    
    # Status tracking
    status = Column(String, index=True)  # "pending", "running", "completed", "failed"
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Progress tracking
    files_processed = Column(Integer, default=0)
    current_file = Column(Text)  # ← NEW: Track current file being processed
    last_progress_update = Column(DateTime)  # ← NEW: Last progress timestamp
    
    # Results
    return_code = Column(Integer)
    output = Column(Text)
    error = Column(Text)
    stats = Column(JSON)  # Borgmatic stats JSON
```

## Testing Instructions

### Test Job Persistence

1. **Rebuild and restart container**:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

2. **Run a backup job**:
   - Navigate to Backups page
   - Click "Create Backup"
   - Watch progress in Jobs page

3. **Verify persistence**:
   - Wait for job to complete
   - Restart container: `docker-compose restart`
   - Navigate to Jobs page
   - Verify completed job still appears with all details

4. **Check database directly** (optional):
   ```bash
   docker exec -it dashborg sqlite3 /data/dashborg.db
   SELECT job_id, job_type, status, files_processed FROM backup_jobs;
   .quit
   ```

### Test Archives Display

1. **Navigate to Stats page**:
   - Should see empty state or "No archives found"

2. **Click "Sync Data" button**:
   - Button should show loading spinner
   - Wait for sync to complete (may take 10-30 seconds)

3. **Verify archives appear**:
   - Summary cards should show archive count
   - Archive table should populate with data
   - Search and filter should work

4. **Test search functionality**:
   - Type archive name in search box
   - Results should filter in real-time

5. **Test repository filter**:
   - Select repository from dropdown
   - Archives should filter by selected repository

## API Endpoints Summary

### Jobs
- `GET /api/jobs?limit=50&offset=0` - List all jobs (database + in-memory)
- `GET /api/jobs/{job_id}` - Get specific job (checks both in-memory and database)
- `DELETE /api/jobs/{job_id}` - Delete job (removes from both in-memory and database)

### Stats & Archives
- `POST /api/sync-repositories` - Sync repository data from borgmatic
- `POST /api/sync-archives` - Sync all archives from borgmatic
- `GET /api/stats/dashboard` - Get aggregated statistics
- `GET /api/archives?limit=100&offset=0&repository=X&search=Y` - Get paginated archives
- `GET /api/repositories` - Get all repositories

## Benefits

### Job Persistence
✅ **Complete History**: All job executions are preserved across restarts  
✅ **Status Tracking**: Can review success/failure of past backups  
✅ **Progress Information**: Track how many files were processed  
✅ **Error Analysis**: Review error messages from failed jobs  
✅ **Statistics**: Access borgmatic stats for each backup  

### Archives Management
✅ **Searchable**: Find archives by name quickly  
✅ **Filterable**: Filter by repository  
✅ **Statistics**: See storage metrics (original, compressed, deduplicated)  
✅ **History**: View all archives across all repositories  
✅ **Sorted**: Most recent archives first  

## Known Limitations

1. **Manual Sync Required**: Archives don't auto-populate on page load (by design to avoid performance impact)
2. **In-Memory Active Jobs**: Currently running jobs are still stored in-memory until completion
3. **No Auto-Refresh**: Stats page doesn't auto-refresh (refresh browser or click Sync Data)
4. **Pagination**: Jobs limited to 50 per page (can be adjusted with `limit` parameter)

## Future Enhancements

- [ ] Add "Last Synced" timestamp to Stats page
- [ ] Auto-sync archives on container startup (optional)
- [ ] Add job filtering by status (completed, failed, running)
- [ ] Add date range filtering for jobs
- [ ] Export job history to CSV
- [ ] Real-time job updates using WebSocket/SSE
- [ ] Add retention policy for old jobs (auto-delete after X days)

## Commit Message

```
fix: enhance job persistence and clarify archives sync workflow

- Modified /api/jobs endpoint to query BackupJob table from database
- Merge database jobs with in-memory active jobs for complete history
- Update /api/jobs/{job_id} to check both in-memory and database
- Update DELETE /api/jobs/{job_id} to remove from both sources
- Add current_file and last_progress_update to job persistence
- Add pagination support to jobs endpoint (limit/offset)
- Document archives display workflow (manual sync required)
- Ensure job history persists across container restarts

Fixes: Job history lost after restart, unclear archives workflow
```
