# DashBorg Feature Backlog

## 📊 Stats/Dashboard Page (Future Implementation)

### Overview
Create a comprehensive stats page that displays backup statistics, repository information, and archive details using Borgmatic's JSON output capabilities.

### Key Features to Implement

#### 1. Repository Overview
- Total repositories configured
- Repository locations (local/remote)
- Total storage used across all repos
- Compression ratio statistics
- Encryption status for each repo

#### 2. Archive Statistics
- Total number of archives (across all repos)
- Archive size trends over time (line/area chart)
- Most recent backup date/time
- Oldest backup date
- Archive frequency analysis
- **List ALL archives regardless of naming format** (using `borg list --json`)

#### 3. Backup Health Dashboard
- Last successful backup per repository
- Failed backups (if any)
- Next scheduled backup time
- Backup duration trends
- Consistency check status (last check date)

#### 4. Storage Analytics
- Deduplicated data size
- Original data size
- Space saved by deduplication (%)
- Growth rate (daily/weekly/monthly)
- Per-archive storage breakdown

#### 5. Archive Browser
- Searchable/filterable list of all archives
- Archive details: date, size, duration, stats
- Group by repository
- Sort by size, date, name (supports custom and standard formats)
- Quick actions: info, mount, extract

#### 6. Recent Activity Timeline
- Last 10-20 backup operations
- Visual timeline of backup activity
- Color-coded by success/failure
- Click for detailed logs

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
- [ ] List archives (`borgmatic list --json`)
- [ ] Prune old archives (`borgmatic prune`)
- [ ] Check repository consistency (`borgmatic check`)
- [ ] Extract archives (`borgmatic extract`)
- [ ] Mount archives for browsing (`borgmatic mount`)

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
