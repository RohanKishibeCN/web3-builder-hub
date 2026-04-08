'use client';

import { useState, useEffect } from 'react';
import { fetchProjects } from './actions';
import { 
  Terminal, 
  ExternalLink, 
  Calendar, 
  DollarSign, 
  Trophy,
  Activity,
  Code,
  FileText,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';

interface Project {
  id: number;
  title: string;
  url: string;
  summary: string;
  source: string;
  discovered_at: string;
  deadline: string | null;
  prize_pool: string | null;
  score: {
    total_score: number;
    prize_score: number;
    time_roi_score: number;
    competition_score: number;
    trend_score: number;
    clarity_score: number;
    reason: string;
  } | null;
  deep_dive_result: {
    suggestedTrack: string;
    winProbability: number;
    participationPlan: string;
    suggestedTechStack: string[];
    differentiation: string;
    mvpTimeline: {
      day1: string;
      day2: string;
      day3: string;
    };
  } | null;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceText, setWorkspaceText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchProjects().then(data => {
      setProjects(data);
      if (data.length > 0) {
        setSelectedProject(data[0]);
      }
      setLoading(false);
    });
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 9) return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10 shadow-[0_0_10px_rgba(52,211,153,0.2)]';
    if (score >= 8) return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10 shadow-[0_0_10px_rgba(250,204,21,0.2)]';
    if (score >= 6) return 'text-zinc-300 border-zinc-700 bg-zinc-800';
    return 'text-zinc-500 border-zinc-800 bg-zinc-900';
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 9) return 'text-emerald-400';
    if (score >= 8) return 'text-yellow-400';
    return 'text-zinc-400';
  };

  const handleGenerate = (type: 'proposal' | 'code') => {
    setIsGenerating(true);
    setWorkspaceText('');
    
    // Simulate streaming response
    const mockResponse = type === 'proposal' 
      ? `## Application Proposal for ${selectedProject?.title}\n\n**Team Profile**: Full-stack Web3 Builders (Next.js + Solidity)\n\n**Project Pitch**: We are building a high-efficiency protocol leveraging ${selectedProject?.deep_dive_result?.suggestedTechStack?.join(', ') || 'modern tech'}.\n\n**Why we fit the ${selectedProject?.deep_dive_result?.suggestedTrack || 'track'}**:\n${selectedProject?.deep_dive_result?.differentiation || 'We offer a unique approach.'}`
      : `// MVP Code Skeleton for ${selectedProject?.title}\n\n// 1. Setup Next.js App Router\nnpx create-next-app@latest .\n\n// 2. Install Web3 dependencies\nnpm install viem wagmi @tanstack/react-query\n\n// 3. Smart Contract Scaffold\n// TODO: Implement core logic based on:\n// ${selectedProject?.deep_dive_result?.participationPlan || 'Hackathon requirements'}`;

    let i = 0;
    const interval = setInterval(() => {
      setWorkspaceText(prev => prev + mockResponse.charAt(i));
      i++;
      if (i >= mockResponse.length) {
        clearInterval(interval);
        setIsGenerating(false);
      }
    }, 10); // Fast typing effect
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-500 font-mono">
        <Terminal className="animate-pulse mr-2" /> INITIALIZING SYSTEM...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans flex overflow-hidden selection:bg-yellow-400/30">
      
      {/* LEFT PANEL: FEED */}
      <div className="w-[40%] md:w-[35%] lg:w-[30%] border-r border-zinc-800/60 bg-[#09090b] flex flex-col h-screen">
        <div className="p-4 border-b border-zinc-800/60 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono font-bold text-zinc-100">
            <Activity size={18} className="text-yellow-400" />
            <span>INTELLIGENCE_FEED</span>
          </div>
          <div className="text-xs font-mono text-zinc-600 bg-zinc-900 px-2 py-1 rounded">
            {projects.length} RECORDS
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-3 custom-scrollbar">
          {projects.map((p) => (
            <div 
              key={p.id}
              onClick={() => setSelectedProject(p)}
              className={`p-4 rounded-lg cursor-pointer transition-all duration-200 border ${
                selectedProject?.id === p.id 
                  ? 'bg-zinc-900 border-zinc-700 ring-1 ring-zinc-700/50' 
                  : 'bg-[#0c0c0e] border-zinc-800/40 hover:border-zinc-700 hover:bg-zinc-900/50'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className={`font-medium leading-tight line-clamp-2 pr-2 ${selectedProject?.id === p.id ? 'text-white' : 'text-zinc-200'}`}>
                  {p.title}
                </h3>
                {p.score ? (
                  <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded text-sm font-bold border ${getScoreColor(p.score.total_score)}`}>
                    {p.score.total_score}
                  </div>
                ) : (
                  <div className="shrink-0 text-[10px] uppercase font-mono text-zinc-600 bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">
                    N/A
                  </div>
                )}
              </div>
              
              <p className="text-xs text-zinc-500 mb-3 line-clamp-2 leading-relaxed">
                {p.summary}
              </p>
              
              <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                {p.prize_pool && p.prize_pool !== 'null' && (
                  <span className="flex items-center text-emerald-400/90 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                    <DollarSign size={10} className="mr-0.5" />
                    {p.prize_pool.length > 15 ? p.prize_pool.substring(0,15)+'...' : p.prize_pool}
                  </span>
                )}
                {p.deadline && (
                  <span className="flex items-center text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded">
                    <Calendar size={10} className="mr-0.5" />
                    {new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: DEEP DIVE & WORKSPACE */}
      <div className="flex-1 flex flex-col h-screen bg-[#09090b] relative">
        {selectedProject ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-zinc-800/60 bg-[#0c0c0e]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">
                    {selectedProject.title}
                  </h1>
                  <a 
                    href={selectedProject.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs font-mono text-zinc-500 hover:text-yellow-400 transition-colors"
                  >
                    <ExternalLink size={12} className="mr-1" />
                    {selectedProject.url.replace(/^https?:\/\//, '').split('/')[0]}
                  </a>
                </div>
                {selectedProject.score && (
                  <div className="text-right">
                    <div className={`text-4xl font-light tracking-tighter ${getScoreTextColor(selectedProject.score.total_score)}`}>
                      {selectedProject.score.total_score.toFixed(1)}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Total Score</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-8 max-w-4xl">
                
                {/* Score Radar / Bars */}
                {selectedProject.score && (
                  <section>
                    <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4 flex items-center">
                      <Search size={14} className="mr-2" /> Evaluation Metrics
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[
                        { label: 'Prize ROI', val: selectedProject.score.prize_score },
                        { label: 'Time ROI', val: selectedProject.score.time_roi_score },
                        { label: 'Competition', val: selectedProject.score.competition_score },
                        { label: 'Trend Match', val: selectedProject.score.trend_score },
                        { label: 'Rule Clarity', val: selectedProject.score.clarity_score }
                      ].map((metric) => (
                        <div key={metric.label} className="bg-[#0c0c0e] border border-zinc-800/60 p-3 rounded-md">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-xs text-zinc-400">{metric.label}</span>
                            <span className={`text-sm font-mono font-medium ${getScoreTextColor(metric.val)}`}>{metric.val}/10</span>
                          </div>
                          <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${metric.val >= 8 ? 'bg-yellow-400' : metric.val >= 6 ? 'bg-zinc-400' : 'bg-zinc-600'}`}
                              style={{ width: `${(metric.val / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-zinc-900/50 border-l-2 border-yellow-400 text-sm text-zinc-300">
                      <span className="font-mono text-yellow-400 mr-2">AGENT_COMMENT:</span>
                      {selectedProject.score.reason}
                    </div>
                  </section>
                )}

                {/* Deep Dive Insights */}
                {selectedProject.deep_dive_result && (
                  <section>
                    <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4 flex items-center">
                      <Trophy size={14} className="mr-2" /> Strategy & Planning
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="space-y-4">
                        <div>
                          <div className="text-[10px] font-mono text-zinc-500 mb-1">RECOMMENDED TRACK</div>
                          <div className="text-sm text-zinc-200">{selectedProject.deep_dive_result.suggestedTrack}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono text-zinc-500 mb-1">DIFFERENTIATION</div>
                          <div className="text-sm text-zinc-200">{selectedProject.deep_dive_result.differentiation}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono text-zinc-500 mb-1">TECH STACK</div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {selectedProject.deep_dive_result.suggestedTechStack.map(t => (
                              <span key={t} className="text-xs font-mono px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700/50">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* MVP Timeline */}
                      <div className="bg-[#0c0c0e] border border-zinc-800/60 p-4 rounded-md">
                        <div className="text-[10px] font-mono text-zinc-500 mb-3">MVP TIMELINE (3 DAYS)</div>
                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[9px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-zinc-800">
                          {['day1', 'day2', 'day3'].map((day, idx) => {
                            const val = selectedProject.deep_dive_result!.mvpTimeline[day as keyof typeof selectedProject.deep_dive_result.mvpTimeline];
                            return (
                              <div key={day} className="relative flex items-start gap-3 group">
                                <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-zinc-900 bg-zinc-800 group-hover:border-yellow-400 transition-colors z-10 shrink-0">
                                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full group-hover:bg-yellow-400" />
                                </div>
                                <div className="pt-0.5">
                                  <div className="text-[10px] font-mono text-yellow-400/80 mb-0.5 uppercase">{day.replace('day', 'Day ')}</div>
                                  <div className="text-xs text-zinc-400">{val}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Workspace / Terminal */}
                <section className="pb-10">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center">
                      <Terminal size={14} className="mr-2" /> Agentic Workspace
                    </h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleGenerate('proposal')}
                        disabled={isGenerating}
                        className="flex items-center text-[10px] font-mono px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors disabled:opacity-50"
                      >
                        <FileText size={12} className="mr-1.5" /> PROPOSAL
                      </button>
                      <button 
                        onClick={() => handleGenerate('code')}
                        disabled={isGenerating}
                        className="flex items-center text-[10px] font-mono px-3 py-1.5 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 rounded border border-yellow-400/30 transition-colors disabled:opacity-50"
                      >
                        <Code size={12} className="mr-1.5" /> CODE SKELETON
                      </button>
                      <button 
                        className="flex items-center text-[10px] font-mono px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 rounded border border-zinc-800 transition-colors"
                        title="Re-run Deep Dive"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/5 to-emerald-400/5 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity" />
                    <textarea 
                      value={workspaceText}
                      onChange={(e) => setWorkspaceText(e.target.value)}
                      placeholder={isGenerating ? "Agent is typing..." : "// Click a button above to generate artifacts..."}
                      className="relative w-full h-64 bg-[#050505] border border-zinc-800 rounded-lg p-4 font-mono text-xs text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/50 resize-y custom-scrollbar"
                      spellCheck="false"
                    />
                    {isGenerating && (
                      <div className="absolute bottom-4 right-4 flex items-center text-[10px] font-mono text-yellow-400 animate-pulse">
                        <Sparkles size={12} className="mr-1" /> GENERATING...
                      </div>
                    )}
                  </div>
                </section>

              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 font-mono">
            <Terminal size={32} className="mb-4 opacity-50" />
            <p>SELECT A RECORD TO INITIATE DEEP DIVE</p>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
}
