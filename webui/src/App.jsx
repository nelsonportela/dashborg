
import { useState, useEffect } from "react";
import SimpleYamlEditor from "./SimpleYamlEditor";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
  );
}

export default function App() {
  const [page, setPage] = useState("landing");
  const [configFiles, setConfigFiles] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generateMsg, setGenerateMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editValid, setEditValid] = useState(null);
  const [editValidError, setEditValidError] = useState("");
  
  // Backups page state
  const [repoCreateLoading, setRepoCreateLoading] = useState(false);
  const [repoCreateResult, setRepoCreateResult] = useState(null);
  const [repoCreateError, setRepoCreateError] = useState("");
  const [repoConfig, setRepoConfig] = useState("config.yaml");
  const [encryptionMode, setEncryptionMode] = useState("");
  const [appendOnly, setAppendOnly] = useState(false);
  const [storageQuota, setStorageQuota] = useState("");
  const [makeParentDirs, setMakeParentDirs] = useState(false);
  
  // Prune state
  const [pruneLoading, setPruneLoading] = useState(false);
  const [pruneDryRun, setPruneDryRun] = useState(true);
  
  // Check state
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkType, setCheckType] = useState("repository");

  // Jobs page state
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  // Stats page state
  const [dashboardStats, setDashboardStats] = useState(null);
  const [archives, setArchives] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [selectedRepository, setSelectedRepository] = useState("");

  // Clear messages when page changes
  useEffect(() => {
    setRepoCreateResult(null);
    setRepoCreateError("");
    setEditError("");
    setEditValid(null);
    setGenerateMsg("");
  }, [page]);

  // Fetch config files from backend
  useEffect(() => {
    if (page !== "config" && page !== "backups" && page !== "repositories") return;
    setLoading(true);
    setError("");
    fetch("/api/configs")
      .then(r => r.json())
      .then(files => {
        setConfigFiles(files);
        setSelectedConfig(files[0] || "");
        setRepoConfig(files[0] || "config.yaml");
        setLoading(false);
      })
      .catch(e => {
        setError("Failed to load config files");
        setLoading(false);
      });
  }, [page]);

  // Fetch jobs when on jobs page
  useEffect(() => {
    if (page !== "jobs") return;
    
    const fetchJobs = () => {
      setJobsLoading(true);
      fetch("/api/jobs")
        .then(r => r.json())
        .then(data => {
          setJobs(data);
          setJobsLoading(false);
        })
        .catch(e => {
          console.error("Failed to load jobs", e);
          setJobsLoading(false);
        });
    };
    
    fetchJobs();
    // Poll every 2 seconds for updates
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, [page]);

  // Fetch stats when on stats page
  useEffect(() => {
    if (page !== "stats") return;
    
    const fetchStats = () => {
      setStatsLoading(true);
      
      Promise.all([
        fetch("/api/stats/dashboard").then(r => r.json()),
        fetch("/api/archives?limit=100").then(r => r.json()),
        fetch("/api/repositories").then(r => r.json())
      ])
        .then(([stats, archivesData, reposData]) => {
          setDashboardStats(stats);
          setArchives(archivesData.archives || []);
          setRepositories(reposData.repositories || []);
          setStatsLoading(false);
        })
        .catch(e => {
          console.error("Failed to load stats", e);
          setStatsLoading(false);
        });
    };
    
    fetchStats();
  }, [page]);

  return (
    <div className="w-full h-screen flex bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 flex flex-col py-6 px-4 border-r border-gray-700">
        <h1 className="text-2xl font-bold text-white mb-8 px-3">
          DashBorg
        </h1>
        <nav className="w-full">
          <ul className="space-y-2">
            <li>
              <button
                className={`block w-full text-left py-2 px-4 rounded-lg text-sm font-medium transition-colors ${page === "config" ? "bg-indigo-600 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
                onClick={() => {
                  setEditing(false);
                  setPage("config");
                }}
              >
                Manage Configs
              </button>
            </li>
            <li>
              <button
                className={`block w-full text-left py-2 px-4 rounded-lg text-sm font-medium transition-colors ${page === "backups" ? "bg-indigo-600 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
                onClick={() => {
                  setEditing(false);
                  setPage("backups");
                }}
              >
                Backups
              </button>
            </li>
            <li>
              <button
                className={`block w-full text-left py-2 px-4 rounded-lg text-sm font-medium transition-colors ${page === "repositories" ? "bg-indigo-600 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
                onClick={() => {
                  setEditing(false);
                  setPage("repositories");
                }}
              >
                Repositories
              </button>
            </li>
            <li>
              <button
                className={`block w-full text-left py-2 px-4 rounded-lg text-sm font-medium transition-colors ${page === "jobs" ? "bg-indigo-600 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
                onClick={() => {
                  setEditing(false);
                  setPage("jobs");
                }}
              >
                Jobs
              </button>
            </li>
            <li>
              <button
                className={`block w-full text-left py-2 px-4 rounded-lg text-sm font-medium transition-colors ${page === "stats" ? "bg-indigo-600 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
                onClick={() => {
                  setEditing(false);
                  setPage("stats");
                }}
              >
                Stats
              </button>
            </li>
            <li>
              <button
                className="block w-full text-left py-2 px-4 rounded-lg text-sm font-medium text-gray-500 cursor-not-allowed"
                disabled
              >
                Settings
              </button>
            </li>
          </ul>
        </nav>
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col px-8 bg-gray-950 overflow-hidden">
        {editing ? (
          <div className="w-full h-full flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-200">Editing: <span className="text-white">{selectedConfig}</span></h3>
              <button
                className="py-2 px-4 rounded-lg text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 transition-colors"
                onClick={() => setEditing(false)}
              >
                ← Back
              </button>
            </div>
            <div className="flex-1 mb-4 min-h-0 overflow-hidden">
              <SimpleYamlEditor value={editContent} onChange={setEditContent} readOnly={editSaving} selectedConfig={selectedConfig} />
            </div>
            {editError && <div className="text-red-400 mb-2 text-sm flex-shrink-0">{editError}</div>}
            {editValid === true && <div className="text-green-400 mb-2 text-sm flex-shrink-0">Config is valid ✔️</div>}
            {editValid === false && <div className="text-yellow-400 mb-2 text-sm flex-shrink-0">Config is invalid: {editValidError}</div>}
            <div className="flex gap-3 flex-shrink-0">
              <button
                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={editSaving}
                onClick={async () => {
                  setEditError("");
                  setEditValid(null);
                  setEditSaving(true);
                  try {
                    const res = await fetch(`/api/configs/${encodeURIComponent(selectedConfig)}`, {
                      method: "PUT",
                      headers: { "Content-Type": "text/yaml" },
                      body: editContent,
                    });
                    if (!res.ok) throw new Error("Failed to save config");
                    setEditing(false);
                  } catch (e) {
                    setEditError("Failed to save config file");
                  }
                  setEditSaving(false);
                }}
              >Save</button>
              <button
                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={editSaving}
                onClick={async () => {
                  setEditValid(null);
                  setEditError("");
                  setEditValidError("");
                  try {
                    const res = await fetch("/api/validate-config", {
                      method: "POST",
                      headers: { "Content-Type": "text/yaml" },
                      body: editContent,
                    });
                    const data = await res.json();
                    if (res.ok && data.valid) {
                      setEditValid(true);
                    } else {
                      setEditValid(false);
                      setEditValidError(data.error || "Validation failed");
                    }
                  } catch (e) {
                    setEditValid(false);
                    setEditValidError("Failed to validate config");
                  }
                }}
              >Validate</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-center">
            {page === "landing" && (
              <>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Welcome to DashBorg
                </h2>
                <p className="text-base text-gray-400 max-w-2xl mb-8">
                  Manage your Borgmatic backups with ease. Select an option from the menu to get started.
                </p>
              </>
            )}
            {page === "config" && (
              <div className="w-full max-w-xl bg-gray-800 rounded-lg p-8 flex flex-col items-center">
                <h2 className="text-2xl font-semibold text-white mb-6">Manage Config Files</h2>
                {loading ? (
                  <div className="text-gray-300 mb-8">Loading config files...</div>
                ) : error ? (
                  <div className="text-red-400 mb-8">{error}</div>
                ) : (
                  <div className="w-full mb-8">
                    <label htmlFor="config-select" className="block text-sm text-gray-300 mb-2">Edit an existing config file:</label>
                    <select
                      id="config-select"
                      className="w-full p-2 rounded-lg bg-gray-700 text-white text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={selectedConfig}
                      onChange={e => setSelectedConfig(e.target.value)}
                    >
                      {configFiles.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <button
                      className="mt-4 w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      disabled={loading}
                      onClick={async () => {
                        setEditError("");
                        setEditValid(null);
                        setEditSaving(false);
                        setEditing(true);
                        setEditContent("");
                        try {
                          setLoading(true);
                          const res = await fetch(`/api/configs/${encodeURIComponent(selectedConfig)}`);
                          if (!res.ok) throw new Error("Failed to load config");
                          const data = await res.text();
                          setEditContent(data);
                        } catch (e) {
                          setEditError("Failed to load config file");
                        }
                        setLoading(false);
                      }}
                    >
                      {loading && <LoadingSpinner />}
                      {loading ? "Loading..." : "Edit Selected Config"}
                    </button>
                  </div>
                )}
                <div className="w-full border-t border-gray-700 pt-6">
                  <label className="block text-sm text-gray-300 mb-2">Or generate a new config file:</label>
                  <button
                    className="w-full py-2 px-4 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    onClick={async () => {
                      setGenerateMsg("");
                      setLoading(true);
                      setError("");
                      try {
                        const res = await fetch("/api/borgmatic/init%20--generate");
                        const data = await res.json();
                        if (res.ok) {
                          setGenerateMsg("Config generated!\n" + (data.output || ""));
                        } else {
                          setError(data.error || "Failed to generate config");
                        }
                      } catch (e) {
                        setError("Failed to generate config");
                      }
                      setLoading(false);
                    }}
                    disabled={loading}
                  >
                    {loading && <LoadingSpinner />}
                    {loading ? "Generating..." : "Generate New Config"}
                  </button>
                  {generateMsg && <pre className="mt-4 text-green-400 text-xs whitespace-pre-wrap text-left w-full">{generateMsg}</pre>}
                </div>
              </div>
            )}
            {page === "backups" && (
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
                
                <div className="mt-8 pt-8 border-t border-gray-700 text-gray-400 text-sm">
                  <p className="mb-2">💡 Tips:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Backups run in the background - check the Jobs page for progress</li>
                    <li>Large backups may take considerable time</li>
                    <li>Configure backup sources in your borgmatic config file</li>
                  </ul>
                </div>
              </div>
            )}
            {page === "repositories" && (
              <div className="w-full max-w-2xl bg-gray-800 rounded-lg p-8">
                <h2 className="text-2xl font-semibold text-white mb-6">Repository Management</h2>
                
                <h3 className="text-xl font-medium text-white mb-4">Create Repository</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Initialize Borg repositories based on your borgmatic configuration. 
                  If options are not specified, values from the config file will be used.
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
                    {repoCreateLoading ? "Creating Repository..." : "Create Repository"}
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
                            // Navigate to jobs page to see progress
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
                <div className="mb-8">
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
                            // Navigate to jobs page to see progress
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
              </div>
            )}
            {page === "jobs" && (
              <div className="w-full max-w-4xl bg-gray-800 rounded-lg p-8">
                <h2 className="text-2xl font-semibold text-white mb-6">Job History</h2>
                
                {jobsLoading && jobs.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">Loading jobs...</div>
                ) : jobs.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">No jobs yet. Create a backup to see it here!</div>
                ) : (
                  <div className="space-y-3">
                    {jobs.map(job => {
                      // Get latest progress data
                      const latestProgress = job.progress && job.progress.length > 0 
                        ? job.progress[job.progress.length - 1] 
                        : null;
                      
                      return (
                        <div key={job.id} className={`p-4 rounded-lg border ${
                          job.status === "running" ? "bg-blue-900/20 border-blue-700" :
                          job.status === "completed" ? "bg-green-900/20 border-green-700" :
                          job.status === "failed" ? "bg-red-900/20 border-red-700" :
                          "bg-gray-700/20 border-gray-600"
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                                job.status === "running" ? "bg-blue-600 text-white" :
                                job.status === "completed" ? "bg-green-600 text-white" :
                                job.status === "failed" ? "bg-red-600 text-white" :
                                "bg-gray-600 text-white"
                              }`}>
                                {job.status === "running" && <LoadingSpinner />}
                                {job.status}
                              </span>
                              <span className="text-sm font-medium text-white">{job.type}</span>
                              <span className="text-xs text-gray-400">{job.config}</span>
                            </div>
                            <button
                              className="text-xs text-gray-400 hover:text-white"
                              onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
                            >
                              {selectedJob === job.id ? "Hide" : "Details"}
                            </button>
                          </div>
                          
                          <div className="text-xs text-gray-400">
                            Started: {new Date(job.created_at).toLocaleString()}
                            {job.completed_at && ` • Completed: ${new Date(job.completed_at).toLocaleString()}`}
                          </div>
                          
                          {/* Show progress for running jobs */}
                          {job.status === "running" && job.progress_info && (
                            <div className="mt-2 text-xs text-blue-300 space-y-1">
                              {job.progress_info.files_processed > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-blue-400 font-semibold">
                                    {job.progress_info.files_processed.toLocaleString()} files processed
                                  </span>
                                </div>
                              )}
                              {job.progress_info.current_file && (
                                <div className="flex items-start gap-2">
                                  <span className="text-gray-400 flex-shrink-0">📄</span>
                                  <span className="text-blue-200 font-mono text-xs break-all line-clamp-2">
                                    {job.progress_info.current_file}
                                  </span>
                                </div>
                              )}
                              {job.progress_info.last_update && (
                                <div className="text-gray-500 text-xs">
                                  Last update: {new Date(job.progress_info.last_update).toLocaleTimeString()}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {selectedJob === job.id && (
                            <div className="mt-3 pt-3 border-t border-gray-600 space-y-3">
                              {/* Format backup statistics if completed */}
                              {job.status === "completed" && job.stats && (
                                <div className="bg-gray-900/50 p-4 rounded space-y-2">
                                  <h4 className="text-sm font-semibold text-green-400 mb-3">📊 Backup Statistics</h4>
                                  
                                  {/* Repository info */}
                                  {job.stats.repository && (
                                    <div className="space-y-2 mb-3">
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="text-gray-400">Repository:</div>
                                        <div className="text-white font-mono break-all">
                                          {job.stats.repository.label || job.stats.repository.location}
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="text-gray-400">Location:</div>
                                        <div className="text-white font-mono text-xs break-all">{job.stats.repository.location}</div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="text-gray-400">Encryption:</div>
                                        <div className="text-white">{job.stats.encryption?.mode || "N/A"}</div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Archive info */}
                                  {job.stats.archive && (
                                    <>
                                      <div className="border-t border-gray-700 pt-2 mt-2"></div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="text-gray-400">Archive name:</div>
                                        <div className="text-white font-mono break-all">{job.stats.archive.name}</div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="text-gray-400">Created:</div>
                                        <div className="text-white">{new Date(job.stats.archive.start).toLocaleString()}</div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="text-gray-400">Duration:</div>
                                        <div className="text-white">{job.stats.archive.duration?.toFixed(2)} seconds</div>
                                      </div>
                                      
                                      {/* Statistics */}
                                      {job.stats.archive.stats && (
                                        <>
                                          <div className="border-t border-gray-700 pt-2 mt-2"></div>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="text-gray-400">Original size:</div>
                                            <div className="text-white font-semibold">{(job.stats.archive.stats.original_size / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="text-gray-400">Compressed size:</div>
                                            <div className="text-white">{(job.stats.archive.stats.compressed_size / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="text-gray-400">Deduplicated size:</div>
                                            <div className="text-green-400 font-semibold">{(job.stats.archive.stats.deduplicated_size / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="text-gray-400">Space saved:</div>
                                            <div className="text-green-400 font-semibold">
                                              {((1 - job.stats.archive.stats.deduplicated_size / job.stats.archive.stats.original_size) * 100).toFixed(1)}%
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="text-gray-400">Number of files:</div>
                                            <div className="text-white">{job.stats.archive.stats.nfiles.toLocaleString()}</div>
                                          </div>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                              
                              {/* Show raw output */}
                              <details className="text-xs">
                                <summary className="text-gray-400 hover:text-white cursor-pointer">Raw Output</summary>
                                <pre className="mt-2 text-gray-300 whitespace-pre-wrap bg-gray-900/50 p-3 rounded">
                                  {job.output || job.error || "No output yet..."}
                                </pre>
                              </details>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {page === "stats" && (
              <div className="w-full max-w-6xl bg-gray-800 rounded-lg p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-white">Dashboard & Statistics</h2>
                  <div className="flex gap-2">
                    <button
                      className="py-2 px-4 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      disabled={syncLoading}
                      onClick={async () => {
                        setSyncLoading(true);
                        try {
                          await fetch("/api/sync-repositories", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ config: selectedConfig || configFiles[0] })
                          });
                          await fetch("/api/sync-archives", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ config: selectedConfig || configFiles[0] })
                          });
                          // Reload stats
                          setPage("landing");
                          setTimeout(() => setPage("stats"), 100);
                        } catch (e) {
                          console.error("Sync failed", e);
                        }
                        setSyncLoading(false);
                      }}
                    >
                      {syncLoading && <LoadingSpinner />}
                      {syncLoading ? "Syncing..." : "Sync Data"}
                    </button>
                  </div>
                </div>

                {statsLoading ? (
                  <div className="text-gray-400 text-center py-8">Loading statistics...</div>
                ) : (
                  <>
                    {/* Summary Cards */}
                    {dashboardStats && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-gray-700 p-6 rounded-lg">
                          <div className="text-gray-400 text-sm mb-1">Total Archives</div>
                          <div className="text-3xl font-bold text-white">
                            {dashboardStats.summary.total_archives || 0}
                          </div>
                        </div>
                        <div className="bg-gray-700 p-6 rounded-lg">
                          <div className="text-gray-400 text-sm mb-1">Repositories</div>
                          <div className="text-3xl font-bold text-white">
                            {dashboardStats.summary.total_repositories || 0}
                          </div>
                        </div>
                        <div className="bg-gray-700 p-6 rounded-lg">
                          <div className="text-gray-400 text-sm mb-1">Storage Used</div>
                          <div className="text-3xl font-bold text-white">
                            {((dashboardStats.summary.total_unique_size || 0) / 1024 / 1024 / 1024).toFixed(1)} GB
                          </div>
                        </div>
                        <div className="bg-gray-700 p-6 rounded-lg">
                          <div className="text-gray-400 text-sm mb-1">Space Saved</div>
                          <div className="text-3xl font-bold text-green-400">
                            {(dashboardStats.summary.deduplication_percentage || 0).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Charts Section */}
                    {dashboardStats && dashboardStats.recent_archives && dashboardStats.recent_archives.length > 0 && (
                      <div className="mb-8 space-y-6">
                        {/* Storage Over Time Chart */}
                        <div className="bg-gray-700 p-6 rounded-lg">
                          <h3 className="text-lg font-semibold text-white mb-4">Storage Over Time</h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={dashboardStats.recent_archives.slice().reverse()}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                              <XAxis 
                                dataKey="date" 
                                stroke="#9CA3AF"
                                tickFormatter={(value) => new Date(value).toLocaleDateString()}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                              />
                              <YAxis 
                                stroke="#9CA3AF"
                                tickFormatter={(value) => `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`}
                              />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                                labelStyle={{ color: '#E5E7EB' }}
                                formatter={(value) => [`${(value / 1024 / 1024 / 1024).toFixed(2)} GB`, '']}
                                labelFormatter={(label) => new Date(label).toLocaleString()}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="original_size" 
                                stroke="#8B5CF6" 
                                name="Original Size"
                                strokeWidth={2}
                                dot={{ fill: '#8B5CF6' }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="deduplicated_size" 
                                stroke="#10B981" 
                                name="After Deduplication"
                                strokeWidth={2}
                                dot={{ fill: '#10B981' }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Archive Size Distribution */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="bg-gray-700 p-6 rounded-lg">
                            <h3 className="text-lg font-semibold text-white mb-4">Recent Archive Sizes</h3>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={dashboardStats.recent_archives.slice(0, 10)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis 
                                  dataKey="name" 
                                  stroke="#9CA3AF"
                                  angle={-45}
                                  textAnchor="end"
                                  height={100}
                                  interval={0}
                                  tick={{ fontSize: 10 }}
                                />
                                <YAxis 
                                  stroke="#9CA3AF"
                                  tickFormatter={(value) => `${(value / 1024 / 1024).toFixed(0)} MB`}
                                />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                                  labelStyle={{ color: '#E5E7EB' }}
                                  formatter={(value) => [`${(value / 1024 / 1024).toFixed(2)} MB`, '']}
                                />
                                <Legend />
                                <Bar dataKey="original_size" fill="#8B5CF6" name="Original" />
                                <Bar dataKey="deduplicated_size" fill="#10B981" name="Deduplicated" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Storage Breakdown Pie Chart */}
                          <div className="bg-gray-700 p-6 rounded-lg">
                            <h3 className="text-lg font-semibold text-white mb-4">Storage Breakdown</h3>
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie
                                  data={[
                                    { 
                                      name: 'Unique Data', 
                                      value: dashboardStats.summary.total_unique_size || 0 
                                    },
                                    { 
                                      name: 'Saved by Dedup', 
                                      value: (dashboardStats.summary.total_original_size || 0) - (dashboardStats.summary.total_unique_size || 0) 
                                    }
                                  ]}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  <Cell fill="#10B981" />
                                  <Cell fill="#8B5CF6" />
                                </Pie>
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                                  formatter={(value) => `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Repositories Section */}
                    {repositories.length > 0 && (
                      <div className="mb-8">
                        <h3 className="text-xl font-semibold text-white mb-4">Repositories</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {repositories.map(repo => (
                            <div key={repo.id} className="bg-gray-700 p-4 rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="text-white font-semibold">{repo.label}</div>
                                  <div className="text-xs text-gray-400 font-mono break-all">{repo.location}</div>
                                </div>
                                <span className="text-xs bg-gray-600 px-2 py-1 rounded text-gray-300">
                                  {repo.archive_count} archives
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 mt-2">
                                Encryption: {repo.encryption_mode || "N/A"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Archives Table */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-white">Archives</h3>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Search archives..."
                            className="px-3 py-2 bg-gray-700 text-white text-sm rounded-lg border border-gray-600 focus:ring-2 focus:ring-indigo-500"
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
                      </div>
                      
                      {archives.length === 0 ? (
                        <div className="text-gray-400 text-center py-8">
                          No archives found. Click "Sync Data" to load archives from your repositories.
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
                              </tr>
                            </thead>
                            <tbody className="text-gray-300">
                              {archives
                                .filter(a => 
                                  (!archiveSearch || a.name.toLowerCase().includes(archiveSearch.toLowerCase())) &&
                                  (!selectedRepository || a.repository === selectedRepository)
                                )
                                .slice(0, 50)
                                .map(archive => (
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
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
