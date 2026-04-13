'use client';

import { useState } from 'react';
import { Activity, Database, BrainCircuit, MonitorPlay, RefreshCw, Play, AlertCircle, CheckCircle2, Link as LinkIcon, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerApi } from '@/app/actions';

type Tab = 'collection' | 'storage' | 'analysis' | 'presentation';

export default function DataDashboardClient({
  systemLogs,
  storageStats,
  analysisQueue,
  presentationData,
}: {
  systemLogs: any[];
  storageStats: any;
  analysisQueue: any;
  presentationData: any[];
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
    <div className="min-h-screen bg-claude-bg text-claude-near-black font-sans p-6 selection:bg-emerald-500/30">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 pb-6 border-b border-claude-border">
        <div>
          <h1 className="text-2xl font-bold text-claude-near-black flex items-center gap-3">
            <Activity className="w-6 h-6 text-claude-brand" />
            DATA PIPELINE DASHBOARD
          </h1>
          <p className="text-claude-text-tertiary text-sm mt-1 font-mono">
            System Health & LLM Verification Console
          </p>
        </div>
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-claude-sand border border-claude-border rounded text-xs font-mono hover:bg-claude-border transition-colors"
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
      <main className="bg-claude-surface border border-claude-border rounded-lg p-6 min-h-[600px]">
        {activeTab === 'collection' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* DATA SOURCES CONFIGURATION */}
            <div className="bg-claude-surface border border-claude-border rounded p-4">
              <h2 className="text-sm font-mono text-claude-text-secondary mb-4 flex items-center gap-2 border-b border-claude-border pb-2">
                <Server className="w-4 h-4" /> CONFIGURED DATA SOURCES
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-serif font-medium text-claude-brand mb-2 font-mono flex justify-between items-center">
                    <span>TIER 1 (RSS FEEDS)</span>
                    <span className="bg-claude-brand/10 px-1.5 py-0.5 rounded text-[10px]">5 Sources</span>
                  </h3>
                  <ul className="space-y-2 text-xs font-mono text-claude-text-secondary">
                    <li className="flex items-center gap-2"><LinkIcon className="w-3 h-3 text-claude-text-silver" /> Ethereum Foundation</li>
                    <li className="flex items-center gap-2"><LinkIcon className="w-3 h-3 text-claude-text-silver" /> Sui Foundation</li>
                    <li className="flex items-center gap-2"><LinkIcon className="w-3 h-3 text-claude-text-silver" /> Avalanche</li>
                    <li className="flex items-center gap-2"><LinkIcon className="w-3 h-3 text-claude-text-silver" /> Arbitrum</li>
                    <li className="flex items-center gap-2"><LinkIcon className="w-3 h-3 text-claude-text-silver" /> BNB Chain</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-serif font-medium text-claude-brand mb-2 font-mono flex justify-between items-center">
                    <span>ALPHA (SCRAPERS & APIS)</span>
                    <span className="bg-claude-brand/10 px-1.5 py-0.5 rounded text-[10px]">5 Sources</span>
                  </h3>
                  <ul className="space-y-2 text-xs font-mono text-claude-text-secondary">
                    <li className="flex items-center gap-2"><LinkIcon className="w-3 h-3 text-claude-text-silver" /> CryptoFundraising (Web Scraper)</li>
                    <li className="flex items-center gap-2"><LinkIcon className="w-3 h-3 text-claude-text-silver" /> GitHub API (Search: Web3+Grant/Bounty)</li>
                    <li className="flex items-center gap-2"><LinkIcon className="w-3 h-3 text-claude-text-silver" /> ETHGlobal (Web Scraper)</li>
                    <li className="flex items-center gap-2"><LinkIcon className="w-3 h-3 text-claude-text-silver" /> Questbook (The Graph Subgraph)</li>
                    <li className="flex items-center gap-2"><LinkIcon className="w-3 h-3 text-claude-text-silver" /> Taikai (Public JSON API)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* LOGS SECTION */}
            <div className="flex items-center justify-between mt-8">
              <h2 className="text-lg font-serif font-medium text-claude-near-black">API INGESTION LOGS</h2>
              <div className="flex gap-3">
                <button onClick={() => handleTrigger('discover-tier1')} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950 text-claude-brand border border-emerald-900 rounded text-xs font-mono hover:bg-emerald-900 transition-colors">
                  <Play className="w-3 h-3" /> TIER 1
                </button>
                <button onClick={() => handleTrigger('discover-alpha')} className="flex items-center gap-2 px-3 py-1.5 bg-yellow-950 text-claude-brand border border-yellow-900 rounded text-xs font-mono hover:bg-yellow-900 transition-colors">
                  <Play className="w-3 h-3" /> ALPHA
                </button>
              </div>
            </div>
            
            {triggerStatus && (
              <div className={cn("px-4 py-2 rounded text-xs font-mono border", triggerStatus.msg === 'Success' ? "bg-emerald-950/30 border-emerald-900/50 text-claude-brand" : triggerStatus.msg === 'Running...' ? "bg-claude-sand border-claude-border text-claude-text-secondary animate-pulse" : "bg-red-950/30 border-red-900/50 text-claude-error")}>
                [{triggerStatus.api}] {triggerStatus.msg}
              </div>
            )}

            <div className="bg-claude-surface-dark border border-claude-border rounded p-4 font-mono text-xs overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-claude-text-silver border-b border-claude-border">
                      <th className="pb-2 font-normal">TIMESTAMP</th>
                      <th className="pb-2 font-normal">API_NAME</th>
                      <th className="pb-2 font-normal">STATUS</th>
                      <th className="pb-2 font-normal">FOUND / INSERTED / UPDATED / SKIPPED</th>
                      <th className="pb-2 font-normal">DURATION</th>
                      <th className="pb-2 font-normal">ERROR</th>
                    </tr>
                </thead>
                <tbody>
                  {systemLogs.map((log: any) => (
                    <tr key={log.id} className="border-b border-claude-border/30 hover:bg-claude-surface">
                      <td className="py-3 text-claude-text-tertiary">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="py-3 text-claude-near-black">
                        {log.apiName}
                      </td>
                      <td className="py-3">
                        {log.status === 'success' 
                          ? <span className="flex items-center gap-1 text-claude-brand"><CheckCircle2 className="w-3 h-3" /> OK</span>
                          : <span className="flex items-center gap-1 text-claude-error animate-pulse"><AlertCircle className="w-3 h-3" /> ERR</span>
                        }
                      </td>
                      <td className="py-3 text-claude-text-secondary">
                        {log.found} / {log.inserted} / {log.updated || 0} / {log.skipped || 0}
                        {log.errorMessage?.startsWith('Filtered:') && (
                          <span className="ml-2 text-yellow-500/80 text-[10px]">({log.errorMessage})</span>
                        )}
                      </td>
                      <td className="py-3 text-claude-text-tertiary">{log.durationMs}ms</td>
                      <td className="py-3 text-claude-error max-w-[200px] truncate" title={log.errorMessage}>
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
            <h2 className="text-lg font-serif font-medium text-claude-near-black">DATA WAREHOUSE</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-claude-sand/50 border border-claude-border p-4 rounded">
                <div className="text-claude-text-tertiary text-xs font-mono mb-2">TOTAL RECORDS</div>
                <div className="text-4xl font-light text-claude-near-black">{storageStats.total}</div>
              </div>
              <div className="bg-claude-sand/50 border border-claude-border p-4 rounded">
                <div className="text-claude-text-tertiary text-xs font-mono mb-2">TODAY NEW</div>
                <div className="text-4xl font-light text-claude-brand">{storageStats.today}</div>
              </div>
              <div className="bg-claude-sand/50 border border-claude-border p-4 rounded">
                <div className="text-claude-text-tertiary text-xs font-mono mb-2">DIRTY RECORDS</div>
                <div className="text-4xl font-light text-claude-brand">{storageStats.anomalies.length}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="text-sm font-mono text-claude-text-secondary mb-3 border-b border-claude-border pb-2">SOURCE DISTRIBUTION</h3>
                <ul className="space-y-2">
                  {storageStats.sources.map((s: any) => (
                    <li key={s.source} className="flex justify-between items-center bg-claude-surface p-2 rounded text-sm">
                      <span className="text-claude-near-black">{s.source || 'Unknown'}</span>
                      <span className="text-claude-text-tertiary font-mono">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="text-sm font-mono text-claude-text-secondary mb-3 border-b border-claude-border pb-2 flex items-center gap-2">
                  RECENT INGESTIONS
                </h3>
                {storageStats.recentIngestions?.length === 0 ? (
                  <div className="text-sm text-claude-text-tertiary italic">No recent data.</div>
                ) : (
                  <div className="space-y-2">
                    {storageStats.recentIngestions?.map((p: any) => (
                      <div key={p.id} className="flex justify-between items-center bg-claude-surface border border-claude-border p-2 rounded text-xs font-mono hover:border-claude-text-tertiary transition-colors">
                        <div className="flex-1 truncate pr-4">
                          <span className="text-claude-brand mr-2">[{p.source}]</span>
                          <span className="text-claude-near-black">{p.title}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px]",
                            p.status === 'scored' ? "bg-emerald-950 text-claude-brand" :
                            p.status === 'pending_deep_dive' ? "bg-yellow-950 text-claude-brand" :
                            "bg-claude-border text-claude-text-secondary"
                          )}>{p.status}</span>
                          <span className="text-claude-text-silver whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-lg font-serif font-medium text-claude-near-black flex items-center gap-2">
              AI PROCESSING ENGINE
            </h2>
            
            <div className="mb-8">
               <h3 className="text-sm font-mono text-claude-text-secondary mb-3">PIPELINE STATUS</h3>
               <div className="flex gap-2">
                 {analysisQueue.statusDistribution.map((s: any) => (
                   <div key={s.status} className="flex-1 bg-claude-sand/50 border border-claude-border p-3 rounded">
                     <div className="text-[10px] uppercase text-claude-text-tertiary font-mono mb-1">{s.status}</div>
                     <div className="text-2xl text-claude-near-black font-light">{s.count}</div>
                   </div>
                 ))}
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-mono text-claude-text-secondary mb-3 border-b border-orange-900/30 pb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> BLOCKED (RETRY &gt; 0)
                </h3>
                {analysisQueue.deadLetters.length === 0 ? (
                  <div className="text-sm text-claude-text-tertiary italic p-4 text-center border border-claude-border/30 rounded border-dashed">
                    No blocked tasks in queue.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {analysisQueue.deadLetters.map((dl: any) => (
                      <div key={dl.id} className="flex items-center justify-between bg-claude-surface border border-orange-900/30 p-3 rounded hover:bg-claude-border/50 transition-colors">
                        <div className="flex-1 truncate pr-4">
                          <div className="text-sm text-claude-near-black mb-1 truncate">{dl.title}</div>
                          <div className="text-[10px] text-claude-text-tertiary font-mono">ID: {dl.id} | {dl.source}</div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-[10px] font-mono text-claude-text-secondary bg-claude-surface px-1.5 py-0.5 rounded">
                            ERR x{dl.retryCount}
                          </span>
                          <button onClick={() => handleTrigger(`deep-dive?id=${dl.id}`)} className="text-[10px] font-mono px-2 py-1 bg-claude-border hover:bg-emerald-900 hover:text-claude-brand border border-claude-border-strong hover:border-emerald-700 text-claude-near-black rounded transition-all">
                            RE-RUN
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-mono text-claude-brand mb-3 border-b border-emerald-900/30 pb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> PENDING QUEUE
                </h3>
                {analysisQueue.pendingQueue?.length === 0 ? (
                  <div className="text-sm text-claude-text-tertiary italic p-4 text-center border border-claude-border/30 rounded border-dashed">
                    Queue is empty.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {analysisQueue.pendingQueue?.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-claude-surface border border-emerald-900/30 p-3 rounded">
                        <div className="flex-1 truncate pr-4">
                          <div className="text-sm text-claude-near-black mb-1 truncate">{p.title}</div>
                          <div className="text-[10px] text-claude-text-tertiary font-mono">Added: {new Date(p.createdAt).toLocaleString()}</div>
                        </div>
                        <span className="text-[10px] font-mono text-claude-brand bg-claude-brand/10 px-1.5 py-0.5 rounded shrink-0">
                          WAITING
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'presentation' && (() => {
          const readyProjects = presentationData.filter(p => p.score);
          return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-serif font-medium text-claude-near-black">INTELLIGENCE OUTPUT</h2>
              <div className="text-xs font-mono text-claude-text-tertiary bg-claude-sand px-2 py-1 rounded">
                TOTAL READY: {readyProjects.length}
              </div>
            </div>
            
            {readyProjects.length === 0 ? (
              <div className="p-12 text-center border border-claude-border/30 rounded border-dashed bg-claude-sand/10">
                 <MonitorPlay className="w-8 h-8 text-claude-text-silver mx-auto mb-3" />
                 <p className="text-claude-text-secondary text-sm">
                   No scored projects ready for presentation yet.<br/>
                   Waiting for data to flow through the pipeline.
                 </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {readyProjects.map((project: any) => (
                  <div key={project.id} className="bg-claude-sand/50 border border-claude-border rounded p-4 flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-xs font-mono text-claude-brand bg-claude-brand/10 px-2 py-1 rounded">
                        SCORE: {typeof project.score === 'object' ? project.score?.total_score || 'N/A' : project.score}
                      </div>
                      <div className="text-[10px] text-claude-text-tertiary font-mono">
                        {project.source}
                      </div>
                    </div>
                    <h3 className="text-sm font-serif font-medium text-claude-near-black mb-2 line-clamp-2">
                      {project.title}
                    </h3>
                    <p className="text-xs text-claude-text-secondary mb-4 line-clamp-3 flex-1">
                      {project.summary}
                    </p>
                    <div className="flex gap-2 mt-auto">
                      <a 
                        href={project.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-1 text-center bg-claude-border hover:bg-zinc-700 text-claude-near-black text-[10px] font-mono py-1.5 rounded transition-colors"
                      >
                        VIEW SOURCE
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );})()}
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
          ? "border-emerald-400 text-claude-brand bg-claude-brand/10" 
          : "border-transparent text-claude-text-tertiary hover:text-claude-near-black hover:bg-claude-border/50"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}