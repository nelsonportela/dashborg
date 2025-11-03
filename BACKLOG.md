# DashBorg Feature Backlog

## 📊 Stats/Dashboard Page ✅ **IMPLEMENTED**

### Overview
~~Create~~ **Created** a comprehensive stats page that displays backup statistics, repository information, and archive details using Borgmatic's JSON output capabilities.

### Implemented Features ✅

#### 1. Repository Overview ✅
- ✅ Total repositories configured
- ✅ Repository locations (local/remote)
- ✅ Total storage used across all repos
- ✅ Compression ratio statistics
- ✅ Encryption status for each repo

#### 2. Archive Statistics ✅
- ✅ Total number of archives (across all repos)
- ⏳ Archive size trends over time (line/area chart) - **TODO: Add charts**
- ✅ Most recent backup date/time
- ✅ Archive frequency analysis
- ✅ **List ALL archives regardless of naming format** (using `borgmatic list --json`)

#### 3. Backup Health Dashboard ✅
- ✅ Last successful backup per repository
- ✅ Job history with status tracking
- ✅ **Repository integrity checks with 4 verification levels** - **IMPLEMENTED**
- ⏳ Next scheduled backup time - **TODO: Add scheduling**
- ✅ **Interactive charts for storage trends and backup analysis** - **IMPLEMENTED**

#### 4. Storage Analytics ✅
- ✅ Deduplicated data size
- ✅ Original data size
- ✅ Space saved by deduplication (%)
- ✅ **Storage over time line chart with trend visualization** - **IMPLEMENTED**
- ✅ Per-archive storage breakdown
- ✅ **Interactive charts: storage trends, size distribution, pie charts** - **IMPLEMENTED**

#### 5. Archive Browser ✅
- ✅ Searchable/filterable list of all archives
- ✅ Archive details: date, size, duration, stats
- ✅ Group by repository (filter dropdown)
- ✅ Sort by date
- ✅ **Quick actions: mount (FUSE) and extract** - **IMPLEMENTED**

#### 6. Database & Data Persistence ✅
- ✅ SQLite database with SQLAlchemy ORM
- ✅ Persistent storage of repositories, archives, jobs, statistics
- ✅ Data sync endpoints for borgmatic/borg integration
- ✅ Historical tracking of backups and operations

### Useful Borgmatic Commands for Data Collection

```bash
# List all archives with JSON output (gets ALL archives, any naming format)
borgmatic list --json

# Detailed repository info
borgmatic info --json

# Archive-specific info
borgmatic info --archive <archive-name> --json

# Repository statistics (direct borg command)
borg info --json /path/to/repo

# List archives directly with borg (bypasses archive_name_format filter)
borg list --json /path/to/repo
```

### Implementation Notes

**Key Advantage**: Using `borg list --json` directly will capture **all archives regardless of naming format**, not just those matching the `archive_name_format` configuration in borgmatic config files.

### Proposed UI Layout

1. **Summary Cards** (top section):
   - Total archives count
   - Total storage used
   - Last backup timestamp
   - Deduplication savings %

2. **Archive Table** (main section):
   - Sortable/filterable columns (name, date, size, repository)
   - Search functionality
   - Pagination for large lists
   - Click row to see detailed archive info modal

3. **Charts/Visualizations**:
   - Storage over time (line chart)
   - Archive size distribution (bar/pie chart)
   - Backup frequency heatmap (calendar view)

---

## Other Future Features

### Backup Operations
- ✅ Repository creation (`borgmatic repo-create`) - **IMPLEMENTED**
- ✅ Create backup (`borgmatic create`) with background job tracking - **IMPLEMENTED**
- ✅ Job tracking and monitoring system - **IMPLEMENTED**
- ✅ Real-time file progress tracking during backups - **IMPLEMENTED**
- ✅ List archives (`borgmatic list --json`) - **IMPLEMENTED**
- ✅ Stats/Dashboard page with repository and archive overview - **IMPLEMENTED**
- ✅ SQLite database for persistent storage - **IMPLEMENTED**
- ✅ Prune old archives (`borgmatic prune`) - **IMPLEMENTED** (with dry-run support)
- ✅ Check repository consistency (`borgmatic check`) - **IMPLEMENTED** (4 verification levels)
- ✅ Extract archives (`borgmatic extract`) - **IMPLEMENTED** (with custom destination)
- ✅ Mount archives for browsing (`borgmatic mount`) - **IMPLEMENTED** (FUSE-based read-only)
- ✅ Interactive charts on Stats page - **IMPLEMENTED** (storage trends, size distribution, deduplication)

### Advanced Features
- [ ] Schedule backups (cron management)
- [ ] Notification configuration (email, webhooks)
- [ ] Multi-repository management
- [ ] Archive comparison tool
- [ ] Restore wizard
- [ ] Log viewer with filtering

### Settings Page
- [ ] View/edit borgmatic global settings
- [ ] SSH key management
- [ ] Passphrase/keyfile management
- [ ] Test repository connections
- [ ] View borgmatic version and installed tools
