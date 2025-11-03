# Testing Guide for New Features

## 🧪 How to Test the Stats/Dashboard Implementation

### Prerequisites
- DashBorg container running
- At least one borgmatic config file in `/config`
- Existing borg repositories with archives

### Testing Steps

#### 1. Rebuild Container with New Features
```bash
cd /home/nelson/repositories/dashborg
docker-compose down
docker-compose up -d --build
```

Wait for build to complete (~2-3 minutes for full rebuild)

#### 2. Verify Container is Running
```bash
docker ps | grep dashborg
docker logs dashborg | tail -20
```

Look for:
- `✓ Database initialized` message
- No errors in logs
- Server running on port 8000

#### 3. Check Database File Created
```bash
ls -lh /home/nelson/repositories/dashborg/data/
```

Should see: `dashborg.db` (SQLite database file)

#### 4. Access the Stats Page
1. Open browser: `http://localhost:3157` (or your configured port)
2. Click **"Stats"** in sidebar navigation
3. Should see:
   - Dashboard with summary cards (all showing 0 initially)
   - "Sync Data" button at top
   - Empty state message: "No archives found. Click Sync Data..."

#### 5. Test Data Sync
1. Click **"Sync Data"** button
2. Button should show spinner: "Syncing..."
3. Wait 5-30 seconds (depending on number of archives)
4. Page should reload automatically with data

**Expected Results:**
- Summary cards show non-zero values:
  - Total Archives: count
  - Repositories: count
  - Storage Used: GB amount
  - Space Saved: percentage
- Repository section appears with configured repos
- Archive table populates with backup history

#### 6. Test Archive Browser Features

**Search:**
- Type in search box: `server` or part of archive name
- Table filters in real-time

**Repository Filter:**
- Select repository from dropdown
- Table shows only archives from selected repo
- Select "All repositories" to clear filter

**Data Display:**
- Archive names in monospace font
- Dates formatted correctly
- Sizes in GB with 2 decimal places
- File counts formatted with commas
- Deduplicated sizes in green

#### 7. Test Repository Display
- Should show cards for each repository
- Each card shows:
  - Repository label (e.g., "hetzner")
  - Location (SSH path or local path)
  - Archive count badge
  - Encryption mode

#### 8. Verify Database Persistence
```bash
# Stop container
docker-compose down

# Check database still exists
ls -lh /home/nelson/repositories/dashborg/data/dashborg.db

# Restart container
docker-compose up -d

# Go to Stats page - data should still be there!
```

#### 9. Test API Endpoints Directly

**Dashboard Stats:**
```bash
curl http://localhost:3157/api/stats/dashboard | python3 -m json.tool
```

**Repositories:**
```bash
curl http://localhost:3157/api/repositories | python3 -m json.tool
```

**Archives (first 50):**
```bash
curl http://localhost:3157/api/archives?limit=50 | python3 -m json.tool
```

**Archives filtered by repository:**
```bash
curl "http://localhost:3157/api/archives?repository=hetzner" | python3 -m json.tool
```

**Archives with search:**
```bash
curl "http://localhost:3157/api/archives?search=server" | python3 -m json.tool
```

#### 10. Test Job Persistence
1. Go to **Backups** page
2. Create a new backup
3. Go to **Jobs** page - see job running
4. Wait for completion
5. Check database:
```bash
docker exec -it dashborg sqlite3 /data/dashborg.db "SELECT job_id, status, job_type FROM backup_jobs ORDER BY created_at DESC LIMIT 5;"
```

Should see the job persisted with status "completed" or "failed"

## 🐛 Troubleshooting

### Issue: "Database initialized" not showing in logs
**Solution:** Check webapi/database.py imported correctly in main.py

### Issue: Sync Data returns error
**Solutions:**
- Verify borgmatic config exists: `docker exec -it dashborg ls /etc/borgmatic/`
- Check borgmatic works: `docker exec -it dashborg borgmatic list`
- View backend logs: `docker logs dashborg`

### Issue: No archives showing after sync
**Possible causes:**
- No archives exist in repositories
- Archives filtered by name pattern in borgmatic config
- Check with: `docker exec -it dashborg borgmatic list --json`

### Issue: Database file not created
**Check:**
```bash
# Volume mount exists
docker inspect dashborg | grep /data

# Directory permissions
ls -ld /home/nelson/repositories/dashborg/data/

# Create if missing
mkdir -p /home/nelson/repositories/dashborg/data
```

### Issue: Stats page blank/empty
**Debug:**
1. Open browser console (F12)
2. Check for JavaScript errors
3. Check Network tab for failed API calls
4. Verify frontend built: `ls webui/dist/assets/`

## ✅ Success Criteria

The implementation is working correctly if:
- [x] Container builds and starts without errors
- [x] Database file created in `/data/dashborg.db`
- [x] Stats page loads and displays UI
- [x] Sync Data populates repositories and archives
- [x] Summary cards show correct counts and metrics
- [x] Archive table displays all backups
- [x] Search and filter work correctly
- [x] Data persists after container restart
- [x] Jobs are saved to database
- [x] API endpoints return valid JSON

## 📊 Expected Data Structure

**Summary Cards:**
```
Total Archives: 10
Repositories: 1
Storage Used: 2.5 GB (deduplicated)
Space Saved: 65.2%
```

**Archive Table Columns:**
1. Archive Name (monospace)
2. Repository (label)
3. Date (localized format)
4. Size (Original) (GB)
5. Size (Dedup) (GB, green)
6. Files (formatted with commas)

## 🔄 Data Sync Flow

```
User clicks "Sync Data"
    ↓
POST /api/sync-repositories (config file)
    ↓
Runs: borgmatic info --json
    ↓
Parses repository metadata
    ↓
Creates/Updates Repository records
    ↓
Stores RepositoryStatistics
    ↓
POST /api/sync-archives (config file)
    ↓
Runs: borgmatic list --json
    ↓
Parses all archives (any naming format)
    ↓
Creates Archive records
    ↓
Page reloads → GET /api/stats/dashboard
    ↓
Displays updated data
```

## 🎯 Next Steps After Testing

If all tests pass:
1. Create first backup via UI
2. Verify job tracking works end-to-end
3. Sync again to see new archive
4. Test with multiple repositories
5. Explore adding charts (future enhancement)

---

**Note:** Some features from BACKLOG.md are marked as future enhancements:
- Charts/visualizations (storage trends, heatmaps)
- Archive operations (mount, extract, prune)
- Automated scheduling
- Advanced filtering and sorting
