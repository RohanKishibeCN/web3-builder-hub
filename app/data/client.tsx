'use client';

import { useState } from 'react';
import { Activity, Database, BrainCircuit, MonitorPlay, RefreshCw, Play, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerApi } from '@/app/actions';

type Tab = 'collection' | 'storage' | 'analysis' | 'presentation';

export default function DataDashboardClient({
  systemLogs,
  storageStats,
  analysisQueue,
}: {
  systemLogs: any[];
  storageStats: any;
  analysisQueue: any;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('collection');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<{api: string, msg: string} | null>(null);

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  const handleTrigger = async (apiName: string) => {
    setTriggerStatus({ api: apiName, msg: 'Running...' });
    const res = await triggerApi(apiName);
    if (res.success) {
      setTriggerStatus({ api: apiName, msg: 'Success' });
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setTriggerStatus({ api: apiName, msg: `Failed: ${res.error}` });
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans p-6 selection:bg-emerald-500/30">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800/60">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="w-6 h-6 text-emerald-400" />
            DATA PIPELINE DASHBOARD
          </h1>
          <p className="text-zinc-500 text-sm mt-1 font-mono">
            System Health & LLM Verification Console
          </p>
        </div>
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded text-xs font-mono hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          AUTO-REFRESH
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 font-mono text-xs overflow-x-auto pb-2">
        <TabButton active={activeTab === 'collection'} onClick={() => setActiveTab('collection')} icon={Activity} label="1. COLLECTION" />
        <TabButton active={activeTab === 'storage'} onClick={() => setActiveTab('storage')} icon={Database} label="2. STORAGE" />
        <TabButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={BrainCircuit} label="3. ANALYSIS" />
        <TabButton active={activeTab === 'presentation'} onClick={() => setActiveTab('presentation')} icon={MonitorPlay} label="4. PRESENTATION" />
      </div>

      {/* Content Area */}
      <main className="bg-[#0c0c0e] border border-zinc-800/60 rounded-lg p-6 min-h-[600px]">
        {activeTab === 'collection' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">API INGESTION LOGS</h2>
              <div className="flex gap-3">
                <button onClick={() => handleTrigger('discover-tier1')} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded text-xs font-mono hover:bg-emerald-900 transition-colors">
                  <Play className="w-3 h-3" /> TIER 1
                </button>
                <button onClick={() => handleTrigger('discover-alpha')} className="flex items-center gap-2 px-3 py-1.5 bg-yellow-950 text-yellow-400 border border-yellow-900 rounded text-xs font-mono hover:bg-yellow-900 transition-colors">
                  <Play className="w-3 h-3" /> ALPHA
                </button>
              </div>
            </div>
            
            {triggerStatus && (
              <div className={cn("px-4 py-2 rounded text-xs font-mono border", triggerStatus.msg === 'Success' ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400" : triggerStatus.msg === 'Running...' ? "bg-zinc-900 border-zinc-800 text-zinc-400 animate-pulse" : "bg-red-950/30 border-red-900/50 text-red-400")}>
                [{triggerStatus.api}] {triggerStatus.msg}
              </div>
            )}

            <div className="bg-black border border-zinc-800 rounded p-4 font-mono text-xs overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-zinc-600 border-b border-zinc-800">
                      <th className="pb-2 font-normal">TIMESTAMP</th>
                      <th className="pb-2 font-normal">API_NAME</th>
                      <th className="pb-2 font-normal">STATUS</th>
                      <th className="pb-2 font-normal">FOUND / INSERTED / UPDATED</th>
                      <th className="pb-2 font-normal">DURATION</th>
                      <th className="pb-2 font-normal">ERROR</th>
                    </tr>
                </thead>
                <tbody>
                  {systemLogs.map((log: any) => (
                    <tr key={log.id} className="border-b border-zinc-800/30 hover:bg-zinc-900/30">
                      <td className="py-3 text-zinc-500">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="py-3 text-zinc-300">{log.apiName}</td>
                      <td className="py-3">
                        {log.status === 'success' 
                          ? <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3 h-3" /> OK</span>
                          : <span className="flex items-center gap-1 text-red-400 animate-pulse"><AlertCircle className="w-3 h-3" /> ERR</span>
                        }
                      </td>
                      <td className="py-3 text-zinc-400">
                        {log.found} / {log.inserted} / {log.updated || 0}
                        {log.errorMessage?.startsWith('Filtered:') && (
                          <span className="ml-2 text-yellow-500/80 text-[10px]">({log.errorMessage})</span>
                        )}
                      </td>
                      <td className="py-3 text-zinc-500">{log.durationMs}ms</td>
                      <td className="py-3 text-red-400 max-w-[200px] truncate" title={log.errorMessage}>
                        {!log.errorMessage?.startsWith('Filtered:') ? (log.errorMessage || '-') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-lg font-semibold text-white">DATA WAREHOUSE</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900/50 border border-zinc-800/60 p-4 rounded">
                <div className="text-zinc-500 text-xs font-mono mb-2">TOTAL RECORDS</div>
                <div className="text-4xl font-light text-white">{storageStats.total}</div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/60 p-4 rounded">
                <div className="text-zinc-500 text-xs font-mono mb-2">TODAY NEW</div>
                <div className="text-4xl font-light text-emerald-400">{storageStats.today}</div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/60 p-4 rounded">
                <div className="text-zinc-500 text-xs font-mono mb-2">DIRTY RECORDS</div>
                <div className="text-4xl font-light text-yellow-400">{storageStats.anomalies.length}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="text-sm font-mono text-zinc-400 mb-3 border-b border-zinc-800 pb-2">SOURCE DISTRIBUTION</h3>
                <ul className="space-y-2">
                  {storageStats.sources.map((s: any) => (
                    <li key={s.source} className="flex justify-between items-center bg-zinc-900/30 p-2 rounded text-sm">
                      <span className="text-zinc-300">{s.source || 'Unknown'}</span>
                      <span className="text-zinc-500 font-mono">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="text-sm font-mono text-zinc-400 mb-3 border-b border-zinc-800 pb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-400" /> ANOMALIES (NULL URL/SUMMARY)
                </h3>
                {storageStats.anomalies.length === 0 ? (
                  <div className="text-sm text-emerald-400 flex items-center gap-2 p-2 bg-emerald-950/20 rounded border border-emerald-900/30">
                    <CheckCircle2 className="w-4 h-4" /> Database is clean.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {storageStats.anomalies.map((a: any) => (
                      <li key={a.id} className="flex justify-between items-center bg-red-950/10 border border-red-900/30 p-2 rounded text-xs font-mono">
                        <span className="text-zinc-300">ID: {a.id}</span>
                        <span className="text-red-400">Missing fields</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              AI PROCESSING ENGINE
            </h2>
            
            <div className="mb-8">
               <h3 className="text-sm font-mono text-zinc-400 mb-3">PIPELINE STATUS</h3>
               <div className="flex gap-2">
                 {analysisQueue.statusDistribution.map((s: any) => (
                   <div key={s.status} className="flex-1 bg-zinc-900/50 border border-zinc-800 p-3 rounded">
                     <div className="text-[10px] uppercase text-zinc-500 font-mono mb-1">{s.status}</div>
                     <div className="text-2xl text-white font-light">{s.count}</div>
                   </div>
                 ))}
               </div>
            </div>

            <div>
              <h3 className="text-sm font-mono text-orange-400 mb-3 border-b border-orange-900/30 pb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> DEAD LETTER QUEUE (RETRY COUNT &gt; 0)
              </h3>
              {analysisQueue.deadLetters.length === 0 ? (
                <div className="text-sm text-zinc-500 italic p-4 text-center border border-zinc-800/30 rounded border-dashed">
                  No blocked tasks in queue.
                </div>
              ) : (
                <div className="grid gap-3">
                  {analysisQueue.deadLetters.map((dl: any) => (
                    <div key={dl.id} className="flex items-center justify-between bg-zinc-900/30 border border-orange-900/30 p-3 rounded">
                      <div>
                        <div className="text-sm text-zinc-200 mb-1">{dl.title}</div>
                        <div className="text-xs text-zinc-500 font-mono">ID: {dl.id} | Source: {dl.source}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-orange-400 bg-orange-400/10 px-2 py-1 rounded">
                          RETRY: {dl.retryCount}/3
                        </span>
                        <button onClick={() => handleTrigger(`deep-dive?id=${dl.id}`)} className="text-xs font-mono px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors">
                          FORCE RE-RUN
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'presentation' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-lg font-semibold text-white">INTELLIGENCE OUTPUT</h2>
            <div className="p-12 text-center border border-zinc-800/30 rounded border-dashed bg-zinc-900/10">
               <MonitorPlay className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
               <p className="text-zinc-400 text-sm">
                 Output presentation layer is currently integrated in the main Dashboard (/).<br/>
                 This tab is reserved for Phase 4 Markdown Report Previews and Generate API Playground.
               </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-t-md border-b-2 transition-colors",
        active 
          ? "border-emerald-400 text-emerald-400 bg-emerald-400/10" 
          : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}