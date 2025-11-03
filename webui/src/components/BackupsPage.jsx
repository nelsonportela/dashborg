import { useState } from "react";

function LoadingSpinner() {
  return (
    <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
  );
}

export default function BackupsPage({ 
  configFiles,
  archives,
  repositories,
  syncLoading,
  setSyncLoading,
  setArchives,
  setPage
}) {
  const [repoConfig, setRepoConfig] = useState("config.yaml");
  const [repoCreateLoading, setRepoCreateLoading] = useState(false);
  const [repoCreateResult, setRepoCreateResult] = useState(null);
  const [repoCreateError, setRepoCreateError] = useState("");
  const [encryptionMode, setEncryptionMode] = useState("");
  const [appendOnly, setAppendOnly] = useState(false);
  const [storageQuota, setStorageQuota] = useState("");
  const [makeParentDirs, setMakeParentDirs] = useState(false);
  const [pruneLoading, setPruneLoading] = useState(false);
  const [pruneDryRun, setPruneDryRun] = useState(true);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkType, setCheckType] = useState("repository");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [selectedRepository, setSelectedRepository] = useState("");

  const handleSyncArchives = async () => {
    if (!confirm('Sync archives from all repositories? This may take a while for large repositories.')) {
      return;
    }
    
    setSyncLoading(true);
    try {
      await fetch("/api/sync-archives", {
        method: "POST"
      });
      
      const res = await fetch("/api/archives?limit=100");
      const data = await res.json();
      setArchives(data.archives || []);
      
      alert('Archives synced successfully!');
    } catch (e) {
      alert('Failed to sync archives: ' + e.message);
    }
    setSyncLoading(false);
  };

  const handleExtract = async (archiveName) => {
    if (!confirm(`Extract archive "${archiveName}"?\n\nFiles will be extracted to: /mounts/extracts\n(accessible at ./mounts/extracts on host)`)) {
      return;
    }
    
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: repoConfig,
          archive: archiveName
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert(`Extraction started! Job ID: ${data.job_id}\nDestination: ${data.destination}\n\nCheck Jobs page for progress.`);
        setPage("jobs");
      } else {
        alert(`Failed to start extraction: ${data.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleMount = async (archiveName) => {
    if (!confirm(`Mount archive "${archiveName}" as read-only filesystem?\n\nMount point: /mounts/archives/${archiveName}\n(accessible at ./mounts/archives/${archiveName} on host)`)) {
      return;
    }
    
    try {
      const res = await fetch("/api/mount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: repoConfig,
          archive: archiveName
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert(`Archive mounted!\nMount point: ${data.mount_point}\n\nYou can browse files using the "📁 Browse Files" button in the sidebar.`);
      } else {
        alert(`Failed to mount: ${data.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  const filteredArchives = archives.filter(a => 
    (!archiveSearch || a.name.toLowerCase().includes(archiveSearch.toLowerCase())) &&
    (!selectedRepository || a.repository === selectedRepository)
  ).slice(0, 50);

  return (
    <div className="w-full max-w-2xl bg-gray-800 rounded-lg p-8">
      <h2 className="text-2xl font-semibold text-white mb-6">Backup Management</h2>
      
      {/* Create Backup Section */}
      <div className="mb-8 pb-8 border-b border-gray-700">
        <h3 className="text-xl font-medium text-white mb-4">Create Backup</h3>
        <p className="text-sm text-gray-400 mb-4">
          Create a new backup archive using borgmatic. This may take a while depending on the amount of data.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Config File:</label>
            <select
              className="w-full p-2 rounded-lg bg-gray-700 text-white text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500"
              value={repoConfig}
              onChange={e => setRepoConfig(e.target.value)}
            >
              {configFiles.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          
          <button
            className="w-full py-3 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={repoCreateLoading}
            onClick={async () => {
              setRepoCreateLoading(true);
              setRepoCreateResult(null);
              setRepoCreateError("");
              
              try {
                const res = await fetch("/api/backup-create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    config: repoConfig,
                    progress: true,
                    stats: true,
                  }),
                });
                
                const data = await res.json();
                
                if (data.job_id) {
                  setRepoCreateResult(`Backup job started! Job ID: ${data.job_id}\n\nGo to the Jobs page to monitor progress.`);
                  setTimeout(() => setPage("jobs"), 2000);
                } else {
                  setRepoCreateError(data.error || "Failed to start backup");
                }
              } catch (e) {
                setRepoCreateError("Failed to start backup: " + e.message);
              }
              
              setRepoCreateLoading(false);
            }}
          >
            {repoCreateLoading && <LoadingSpinner />}
            {repoCreateLoading ? "Starting Backup..." : "Create Backup Now"}
          </button>
          
          {repoCreateResult && (
            <div className="mt-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
              <p className="text-green-400 font-medium mb-2">✓ Backup started!</p>
              <pre className="text-xs text-green-300 whitespace-pre-wrap">{repoCreateResult}</pre>
            </div>
          )}
          
          {repoCreateError && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-red-400 font-medium mb-2">✗ Error</p>
              <pre className="text-xs text-red-300 whitespace-pre-wrap">{repoCreateError}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Browse Archives Section */}
      <div className="mb-8 pb-8 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-medium text-white">Browse Archives</h3>
          <button
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            disabled={syncLoading}
            onClick={handleSyncArchives}
          >
            {syncLoading && <LoadingSpinner />}
            {syncLoading ? "Syncing..." : "🔄 Sync Archives"}
          </button>
        </div>
        
        <p className="text-sm text-gray-400 mb-4">
          View all backup archives from your repositories. Mount or extract archives to access their contents.
        </p>
        
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Search archives..."
            className="flex-1 px-3 py-2 bg-gray-700 text-white text-sm rounded-lg border border-gray-600 focus:ring-2 focus:ring-indigo-500"
            value={archiveSearch}
            onChange={e => setArchiveSearch(e.target.value)}
          />
          <select
            className="px-3 py-2 bg-gray-700 text-white text-sm rounded-lg border border-gray-600 focus:ring-2 focus:ring-indigo-500"
            value={selectedRepository}
            onChange={e => setSelectedRepository(e.target.value)}
          >
            <option value="">All repositories</option>
            {repositories.map(r => (
              <option key={r.id} value={r.label}>{r.label}</option>
            ))}
          </select>
        </div>
        
        {archives.length === 0 ? (
          <div className="text-gray-400 text-center py-8 bg-gray-700/30 rounded-lg">
            No archives found. Click "Sync Archives" to load archives from your repositories.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700 text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left">Archive Name</th>
                  <th className="px-4 py-3 text-left">Repository</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Size (Original)</th>
                  <th className="px-4 py-3 text-right">Size (Dedup)</th>
                  <th className="px-4 py-3 text-right">Files</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {filteredArchives.map(archive => (
                  <tr key={archive.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-mono text-xs">{archive.name}</td>
                    <td className="px-4 py-3">{archive.repository}</td>
                    <td className="px-4 py-3">{archive.start ? new Date(archive.start).toLocaleString() : "N/A"}</td>
                    <td className="px-4 py-3 text-right">
                      {archive.original_size ? ((archive.original_size / 1024 / 1024 / 1024).toFixed(2) + " GB") : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-right text-green-400">
                      {archive.deduplicated_size ? ((archive.deduplicated_size / 1024 / 1024 / 1024).toFixed(2) + " GB") : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-right">{archive.nfiles?.toLocaleString() || "N/A"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-center">
                        <button
                          className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white"
                          title="Extract archive"
                          onClick={() => handleExtract(archive.name)}
                        >
                          📦 Extract
                        </button>
                        <button
                          className="px-2 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 text-white"
                          title="Mount archive (read-only)"
                          onClick={() => handleMount(archive.name)}
                        >
                          📁 Mount
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Prune Archives Section */}
      <div className="mb-8 pb-8 border-b border-gray-700">
        <h3 className="text-xl font-medium text-white mb-4">Prune Archives</h3>
        <p className="text-sm text-gray-400 mb-4">
          Remove old archives according to your retention policy. Use dry-run to preview what would be deleted.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Config File:</label>
            <select
              className="w-full p-2 rounded-lg bg-gray-700 text-white text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500"
              value={repoConfig}
              onChange={e => setRepoConfig(e.target.value)}
            >
              {configFiles.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="flex items-center text-sm text-gray-300">
              <input
                type="checkbox"
                className="mr-2 rounded bg-gray-700 border-gray-600"
                checked={pruneDryRun}
                onChange={e => setPruneDryRun(e.target.checked)}
              />
              Dry-run (preview only, don't delete)
            </label>
          </div>
          
          <button
            className={`w-full py-3 px-4 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              pruneDryRun ? 'bg-blue-600 hover:bg-blue-500' : 'bg-orange-600 hover:bg-orange-500'
            }`}
            disabled={pruneLoading}
            onClick={async () => {
              if (!pruneDryRun && !confirm('Are you sure you want to prune archives? This will permanently delete old backups according to your retention policy.')) {
                return;
              }
              
              setPruneLoading(true);
              
              try {
                const res = await fetch("/api/prune", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    config: repoConfig,
                    dry_run: pruneDryRun
                  }),
                });
                
                const data = await res.json();
                
                if (res.ok) {
                  setPage("jobs");
                } else {
                  alert("Failed to start prune: " + (data.error || "Unknown error"));
                }
              } catch (e) {
                alert("Failed to start prune: " + e.message);
              }
              
              setPruneLoading(false);
            }}
          >
            {pruneLoading && <LoadingSpinner />}
            {pruneLoading ? "Starting..." : pruneDryRun ? "Preview Prune (Dry-Run)" : "⚠️ Prune Archives (Live)"}
          </button>
          
          {!pruneDryRun && (
            <div className="p-3 bg-orange-900/20 border border-orange-700 rounded-lg">
              <p className="text-orange-400 text-xs">
                ⚠️ Warning: Live prune will permanently delete archives according to your retention policy.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Check Repository Section */}
      <div className="mb-8 pb-8 border-b border-gray-700">
        <h3 className="text-xl font-medium text-white mb-4">Check Repository</h3>
        <p className="text-sm text-gray-400 mb-4">
          Verify repository consistency and integrity. Different check types provide varying levels of verification.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Config File:</label>
            <select
              className="w-full p-2 rounded-lg bg-gray-700 text-white text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500"
              value={repoConfig}
              onChange={e => setRepoConfig(e.target.value)}
            >
              {configFiles.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-300 mb-2">Check Type:</label>
            <select
              className="w-full p-2 rounded-lg bg-gray-700 text-white text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500"
              value={checkType}
              onChange={e => setCheckType(e.target.value)}
            >
              <option value="repository">Repository Only (fastest)</option>
              <option value="archives">Archives Only</option>
              <option value="extract">Full Check (extract sample)</option>
              <option value="data">Verify Data (slowest, most thorough)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {checkType === "repository" && "Checks repository structure and metadata"}
              {checkType === "archives" && "Checks archive metadata"}
              {checkType === "extract" && "Performs full consistency check with extraction test"}
              {checkType === "data" && "Verifies actual data integrity (slowest)"}
            </p>
          </div>
          
          <button
            className="w-full py-3 px-4 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={checkLoading}
            onClick={async () => {
              setCheckLoading(true);
              
              try {
                const res = await fetch("/api/check", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    config: repoConfig,
                    check_type: checkType
                  }),
                });
                
                const data = await res.json();
                
                if (res.ok) {
                  setPage("jobs");
                } else {
                  alert("Failed to start check: " + (data.error || "Unknown error"));
                }
              } catch (e) {
                alert("Failed to start check: " + e.message);
              }
              
              setCheckLoading(false);
            }}
          >
            {checkLoading && <LoadingSpinner />}
            {checkLoading ? "Starting..." : "Run Check"}
          </button>
        </div>
      </div>

      {/* Create Repository Section */}
      <div className="mb-8">
        <h3 className="text-xl font-medium text-white mb-4">Create New Repository</h3>
        <p className="text-sm text-gray-400 mb-4">
          Initialize a new Borg repository. If options are not specified, values from the config file will be used.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Config File:</label>
            <select
              className="w-full p-2 rounded-lg bg-gray-700 text-white text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500"
              value={repoConfig}
              onChange={e => setRepoConfig(e.target.value)}
            >
              {configFiles.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Encryption Mode <span className="text-gray-500">(optional - uses config value if not set)</span>:
            </label>
            <select
              className="w-full p-2 rounded-lg bg-gray-700 text-white text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500"
              value={encryptionMode}
              onChange={e => setEncryptionMode(e.target.value)}
            >
              <option value="">-- Use config file value --</option>
              <option value="repokey">repokey</option>
              <option value="repokey-blake2">repokey-blake2</option>
              <option value="keyfile">keyfile</option>
              <option value="keyfile-blake2">keyfile-blake2</option>
              <option value="authenticated">authenticated</option>
              <option value="authenticated-blake2">authenticated-blake2</option>
              <option value="none">none</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Storage Quota <span className="text-gray-500">(optional, e.g., "5G", "100M")</span>:
            </label>
            <input
              type="text"
              className="w-full p-2 rounded-lg bg-gray-700 text-white text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., 5G"
              value={storageQuota}
              onChange={e => setStorageQuota(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="flex items-center text-sm text-gray-300">
              <input
                type="checkbox"
                className="mr-2 rounded bg-gray-700 border-gray-600"
                checked={appendOnly}
                onChange={e => setAppendOnly(e.target.checked)}
              />
              Append-only mode
            </label>
            
            <label className="flex items-center text-sm text-gray-300">
              <input
                type="checkbox"
                className="mr-2 rounded bg-gray-700 border-gray-600"
                checked={makeParentDirs}
                onChange={e => setMakeParentDirs(e.target.checked)}
              />
              Create parent directories
            </label>
          </div>
          
          <button
            className="w-full py-3 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={repoCreateLoading}
            onClick={async () => {
              setRepoCreateLoading(true);
              setRepoCreateResult(null);
              setRepoCreateError("");
              
              try {
                const res = await fetch("/api/repo-create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    config: repoConfig,
                    encryption_mode: encryptionMode || undefined,
                    append_only: appendOnly,
                    storage_quota: storageQuota || undefined,
                    make_parent_dirs: makeParentDirs,
                  }),
                });
                
                const data = await res.json();
                
                if (data.success) {
                  setRepoCreateResult(data.output);
                } else {
                  setRepoCreateError(data.error || data.output || "Failed");
                }
              } catch (e) {
                setRepoCreateError("Failed to create repository: " + e.message);
              }
              
              setRepoCreateLoading(false);
            }}
          >
            {repoCreateLoading && <LoadingSpinner />}
            {repoCreateLoading ? "Creating..." : "Create Repository"}
          </button>
          
          {repoCreateResult && (
            <div className="mt-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
              <p className="text-green-400 font-medium mb-2">✓ Success!</p>
              <pre className="text-xs text-green-300 whitespace-pre-wrap">{repoCreateResult}</pre>
            </div>
          )}
          
          {repoCreateError && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-red-400 font-medium mb-2">✗ Error</p>
              <pre className="text-xs text-red-300 whitespace-pre-wrap">{repoCreateError}</pre>
            </div>
          )}
        </div>
      </div>

      <div className="text-gray-400 text-sm">
        <p className="mb-2">💡 Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Browse and manage archives in the sections above</li>
          <li>Use mount for read-only access, extract to copy files out</li>
          <li>Backups run in the background - check Jobs page for progress</li>
          <li>Configure backup sources in your borgmatic config file</li>
        </ul>
      </div>
    </div>
  );
}
