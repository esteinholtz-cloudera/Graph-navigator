import React, { useState, useEffect, useRef, useMemo } from 'react';
import GraphView from './components/GraphView';
import { GraphData, PhysicsConfig, GroupingConfig, GraphLink, AttributeMapping, MappingTarget, GraphNode, EdgeConfig } from './types';
import { parseInputToGraph, sampleRDF, sampleJSON } from './services/rdfParser';
import { analyzeRelationship } from './services/geminiService';

const MAPPINGS_STORAGE_KEY = 'rdf-graph-navigator-mappings';

// Logarithmic helper for slider: 5KB to 5000KB
const MIN_KB = 5;
const MAX_KB = 5000;
const logToValue = (val: number) => Math.round(MIN_KB * Math.pow(MAX_KB / MIN_KB, val / 100));
const valueToLog = (val: number) => (Math.log(val / MIN_KB) / Math.log(MAX_KB / MIN_KB)) * 100;

type ViewMode = 'all' | 'explore';

const App: React.FC = () => {
  const [input, setInput] = useState(sampleRDF);
  const [format, setFormat] = useState<'rdf' | 'json'>('rdf');
  const [rawGraphData, setRawGraphData] = useState<GraphData>({ nodes: [], links: [], extraAttributes: [] });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphLink | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showInferred, setShowInferred] = useState(true);
  const [maxFileKb, setMaxFileKb] = useState(1000); // Default 1MB

  // Exploration state
  const [viewMode, setViewMode] = useState<ViewMode>('explore');
  const [exploredNodeIds, setExploredNodeIds] = useState<Set<string>>(new Set());
  
  const [mappings, setMappings] = useState<AttributeMapping>(() => {
    try {
      const saved = localStorage.getItem(MAPPINGS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Failed to load mappings from storage', e);
      return {};
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [physics, setPhysics] = useState<PhysicsConfig>({
    charge: -300,
    linkDistance: 120,
    collisionRadius: 40,
    centering: true,
    disentangleFactor: 0.5,
    enableDisentangle: true,
    friction: 0.4,
    gravity: 0.1,
    dimmingOpacity: 0.15
  });

  const [edgeConfig, setEdgeConfig] = useState<EdgeConfig>({
    explicit: { color: '#475569', width: 2, opacity: 0.6, arrowSize: 6 },
    inferred: { color: '#60a5fa', width: 2, opacity: 0.6, arrowSize: 6 }
  });

  const [grouping, setGrouping] = useState<GroupingConfig>({
    byType: true,
    palette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],
    connectivityEnlargement: 20,
    showNamespaces: false
  });

  useEffect(() => {
    localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(mappings));
  }, [mappings]);

  // Load and parse initial data
  useEffect(() => {
    const data = parseInputToGraph(input, format);
    setRawGraphData(data);
    
    // Auto-seed for Explore mode: pick the single most connected node
    if (data.nodes.length > 0) {
      const degrees = new Map<string, number>();
      data.links.forEach(l => {
        const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
        degrees.set(s, (degrees.get(s) || 0) + 1);
        degrees.set(t, (degrees.get(t) || 0) + 1);
      });

      let maxDeg = -1;
      let seed: string | null = null;
      data.nodes.forEach(n => {
        const d = degrees.get(n.id) || 0;
        if (d > maxDeg) {
          maxDeg = d;
          seed = n.id;
        }
      });
      if (seed) setExploredNodeIds(new Set([seed]));
    }

    if (data.extraAttributes.length > 0) {
      const unknownAttributes = data.extraAttributes.filter(attr => !(attr in mappings));
      if (unknownAttributes.length > 0) {
        setMappings(prev => {
          const next = { ...prev };
          unknownAttributes.forEach(attr => {
            next[attr] = 'None';
          });
          return next;
        });
        setShowMappingModal(true);
      }
    }
  }, [input, format]);

  // Calculate global degrees for consistent node sizing across all modes
  const globalDegrees = useMemo(() => {
    const degrees = new Map<string, number>();
    rawGraphData.nodes.forEach(n => degrees.set(n.id, 0));
    rawGraphData.links.forEach(l => {
      const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
      
      // Determine if inferred based on current mappings
      let isInferred = l.isInferred ?? false;
      Object.entries(mappings).forEach(([attr, target]) => {
        const val = l.metadata?.[attr];
        if (val !== undefined && target === 'Inferred') {
          isInferred = !!val;
        }
      });

      if (showInferred || !isInferred) {
        degrees.set(s, (degrees.get(s) || 0) + 1);
        degrees.set(t, (degrees.get(t) || 0) + 1);
      }
    });
    return degrees;
  }, [rawGraphData, mappings, showInferred]);

  const processedGraphData = useMemo(() => {
    // 1. Prepare base links and identify inferred status
    const allLinks = rawGraphData.links.map(link => {
      const sourceId = (typeof link.source === 'object' ? (link.source as GraphNode).id : link.source) as string;
      const targetId = (typeof link.target === 'object' ? (link.target as GraphNode).id : link.target) as string;
      
      let isInferred = link.isInferred ?? false;
      Object.entries(mappings).forEach(([attr, target]) => {
        const val = link.metadata?.[attr];
        if (val !== undefined && target === 'Inferred') {
          isInferred = !!val;
        }
      });

      return { ...link, sourceId, targetId, isInferred };
    }).filter(link => showInferred || !link.isInferred);

    // 2. Filter logic for View Modes
    let visibleNodeIds = new Set<string>();
    let visibleLinks: any[] = [];

    if (viewMode === 'all') {
      visibleNodeIds = new Set<string>(rawGraphData.nodes.map(n => n.id));
      visibleLinks = allLinks;
    } else {
      // Explore mode incremental expansion logic
      const explored = exploredNodeIds;
      const neighbors = new Set<string>();
      
      allLinks.forEach(link => {
        if (explored.has(link.sourceId)) neighbors.add(link.targetId);
        if (explored.has(link.targetId)) neighbors.add(link.sourceId);
      });

      // Nodes are visible if they are explored OR neighbor of an explored node
      visibleNodeIds = new Set<string>([...Array.from(explored), ...Array.from(neighbors)] as string[]);
      
      // Links are visible if they connect to at least one explored node
      visibleLinks = allLinks.filter(link => 
        explored.has(link.sourceId) || explored.has(link.targetId)
      );
    }

    // 3. Final graph construction
    const nodes = rawGraphData.nodes
      .filter(n => visibleNodeIds.has(n.id))
      .map(node => {
        const newNode = { ...node };
        Object.entries(mappings).forEach(([attr, target]) => {
          const val = node.metadata?.[attr];
          if (val !== undefined && target !== 'None') {
            if (target === 'chunk') newNode.chunk = String(val);
            if (target === 'Community') newNode.community = String(val);
          }
        });
        return newNode;
      });

    const links = visibleLinks.map(l => ({
      ...l,
      source: l.sourceId,
      target: l.targetId
    }));

    return { nodes, links, extraAttributes: rawGraphData.extraAttributes };
  }, [rawGraphData, mappings, showInferred, viewMode, exploredNodeIds]);

  const handleAiAnalysis = async () => {
    if (!selectedEdge) return;
    setIsLoadingAi(true);
    setAiAnalysis(null);
    try {
      const s = typeof selectedEdge.source === 'string' ? selectedEdge.source : (selectedEdge.source as any).label;
      const t = typeof selectedEdge.target === 'string' ? selectedEdge.target : (selectedEdge.target as any).label;
      const result = await analyzeRelationship(s, t, selectedEdge.label);
      setAiAnalysis(result);
    } catch (err) {
      setAiAnalysis("Analysis failed.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  const sanitizeTruncatedContent = (content: string): string => {
    const trimmed = content.trim();
    if (trimmed.startsWith('<')) {
      const lastDescEnd = content.lastIndexOf('</rdf:Description>');
      if (lastDescEnd !== -1) return content.substring(0, lastDescEnd + 18) + '\n</rdf:RDF>';
      const lastClosingTag = content.lastIndexOf('</');
      if (lastClosingTag !== -1) {
        const nextClosing = content.indexOf('>', lastClosingTag);
        if (nextClosing !== -1) return content.substring(0, nextClosing + 1) + '\n</rdf:RDF>';
      }
      return content + '\n</rdf:RDF>';
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const lastBrace = Math.max(content.lastIndexOf('}'), content.lastIndexOf(']'));
      if (lastBrace !== -1) return content.substring(0, lastBrace + 1);
    }
    const lastDot = content.lastIndexOf('.');
    if (lastDot !== -1) return content.substring(0, lastDot + 1);
    return content;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const limitBytes = maxFileKb * 1024;
    const reader = new FileReader();
    const isOverLimit = file.size > limitBytes;
    const blobToRead = isOverLimit ? file.slice(0, limitBytes + 8192) : file;
    reader.onload = (e) => {
      let content = e.target?.result as string;
      if (content) {
        if (isOverLimit) content = sanitizeTruncatedContent(content);
        const extension = file.name.split('.').pop()?.toLowerCase();
        setFormat(extension === 'json' || extension === 'jsonld' ? 'json' : 'rdf');
        setInput(content);
      }
    };
    reader.readAsText(blobToRead);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNodeClick = (id: string | null) => {
    if (!id) {
      setSelectedNodeId(null);
      return;
    }
    setSelectedNodeId(id);
    setSelectedEdge(null);
    setAiAnalysis(null);

    // Expand discovery core in Explore mode
    if (viewMode === 'explore') {
      setExploredNodeIds(prev => new Set([...Array.from(prev), id]));
    }
  };

  const resetExploration = () => {
    if (rawGraphData.nodes.length > 0) {
      // Find top connectivity node again for reset
      const degrees = globalDegrees;
      let maxDeg = -1;
      let seed: string | null = null;
      rawGraphData.nodes.forEach(n => {
        const d = degrees.get(n.id) || 0;
        if (d > maxDeg) {
          maxDeg = d;
          seed = n.id;
        }
      });
      if (seed) setExploredNodeIds(new Set([seed]));
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-200">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".rdf,.ttl,.nt,.n3,.owl,.json,.jsonld" />

      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[480px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Attribute Mapping
            </h2>
            <p className="text-sm text-slate-400 mb-6">Map attributes to visualization behaviors:</p>
            <div className="max-h-[300px] overflow-y-auto space-y-4 pr-2">
              {rawGraphData.extraAttributes.map(attr => (
                <div key={attr} className="flex items-center justify-between gap-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <span className="text-sm font-mono text-blue-300 truncate flex-1">{attr}</span>
                  <select 
                    value={mappings[attr] || 'None'}
                    onChange={(e) => setMappings({ ...mappings, [attr]: e.target.value as MappingTarget })}
                    className="bg-slate-900 text-xs rounded border border-slate-600 px-2 py-1 outline-none"
                  >
                    <option value="None">None</option>
                    <option value="Inferred">Inferred (Edge Style)</option>
                    <option value="chunk">Chunk (Node Size)</option>
                    <option value="Community">Community (Color)</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => setShowMappingModal(false)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-all">Done</button>
            </div>
          </div>
        </div>
      )}

      <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-lg text-white">G</div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">RDF Graph Navigator</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-1">
            <select 
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="bg-transparent text-sm font-medium px-2 py-1 outline-none text-slate-200 cursor-pointer"
            >
              <option value="all">View: Show All</option>
              <option value="explore">View: Explore</option>
            </select>
            {viewMode === 'explore' && (
              <button 
                onClick={resetExploration}
                className="ml-1 p-1 hover:bg-slate-700 rounded transition-colors text-slate-400"
                title="Reset Exploration"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-medium transition-colors">Load File</button>
            <button onClick={() => setInput(sampleRDF)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-sm border border-slate-700">Sample RDF</button>
            <button onClick={() => setInput(sampleJSON)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-sm border border-slate-700">Sample JSON</button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        <aside className="w-80 border-r border-slate-800 bg-slate-900/80 p-4 flex flex-col gap-6 overflow-y-auto z-10">
          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Input Data</h2>
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-[10px] text-slate-400 uppercase font-bold">
                <span>Max Load Size</span>
                <span className="text-blue-400">{maxFileKb >= 1000 ? `${(maxFileKb / 1000).toFixed(1)} MB` : `${maxFileKb} KB`}</span>
              </div>
              <input type="range" min="0" max="100" value={valueToLog(maxFileKb)} onChange={(e) => setMaxFileKb(logToValue(Number(e.target.value)))} className="w-full h-1 bg-slate-800 accent-blue-600 rounded-lg cursor-pointer" />
            </div>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} className="w-full h-32 bg-slate-800 border border-slate-700 rounded p-2 text-xs font-mono text-blue-300 focus:outline-none resize-none" />
          </section>

          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Physics</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Charge</span><span className="text-blue-400">{physics.charge}</span></div>
                <input type="range" min="-1000" max="0" value={physics.charge} onChange={(e) => setPhysics({ ...physics, charge: Number(e.target.value) })} className="w-full accent-blue-500" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Link Distance</span><span className="text-blue-400">{physics.linkDistance}px</span></div>
                <input type="range" min="20" max="300" value={physics.linkDistance} onChange={(e) => setPhysics({ ...physics, linkDistance: Number(e.target.value) })} className="w-full accent-blue-500" />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Visualization</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={grouping.byType} onChange={(e) => setGrouping({ ...grouping, byType: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                <span className="text-sm text-slate-300">Group by Community</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showInferred} onChange={(e) => setShowInferred(e.target.checked)} className="w-4 h-4 accent-blue-500" />
                <span className="text-sm text-slate-300">Show Inferred Edges</span>
              </label>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Hub Scaling</span><span className="text-blue-400">{grouping.connectivityEnlargement}%</span></div>
                <input type="range" min="0" max="100" value={grouping.connectivityEnlargement} onChange={(e) => setGrouping({ ...grouping, connectivityEnlargement: Number(e.target.value) })} className="w-full accent-blue-500" />
              </div>
            </div>
          </section>
        </aside>

        <section className="flex-1 relative bg-slate-900">
          <GraphView 
            data={processedGraphData}
            physics={physics}
            edgeConfig={edgeConfig}
            grouping={grouping}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeClick}
            onEdgeSelect={(link) => { setSelectedEdge(link); setSelectedNodeId(null); }}
            globalDegrees={globalDegrees}
          />

          <div className="absolute bottom-6 left-6 bg-slate-900/60 backdrop-blur-md p-2 rounded text-[10px] text-slate-400 flex items-center gap-2 pointer-events-none uppercase tracking-tighter">
            <span className="font-bold text-slate-500">Mode:</span>
            <span>{viewMode === 'all' ? 'All Data Visible' : 'Explore (Click nodes to reveal neighbors)'}</span>
          </div>

          {(selectedNodeId || selectedEdge) && (
            <div className="absolute right-6 top-6 w-80 bg-slate-900/95 border border-slate-700 rounded-xl p-5 shadow-2xl backdrop-blur-md z-30 animate-in fade-in slide-in-from-right-4">
              {selectedNodeId ? (
                <div>
                  <h3 className="text-blue-400 text-xs font-bold uppercase mb-1">Node Info</h3>
                  <p className="text-lg font-bold text-white break-all">{processedGraphData.nodes.find(n => n.id === selectedNodeId)?.label}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-1 break-all">{selectedNodeId}</p>
                </div>
              ) : selectedEdge ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-blue-400 text-xs font-bold uppercase mb-1">Relationship</h3>
                    <p className="text-sm font-bold">{selectedEdge.label}</p>
                  </div>
                  <button onClick={handleAiAnalysis} disabled={isLoadingAi} className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-bold text-white transition-colors">
                    {isLoadingAi ? 'Analyzing...' : 'Semantic Analysis'}
                  </button>
                  {aiAnalysis && <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300 border-l-4 border-l-blue-500 leading-relaxed">{aiAnalysis}</div>}
                </div>
              ) : null}
              <button onClick={() => { setSelectedNodeId(null); setSelectedEdge(null); }} className="absolute top-3 right-3 text-slate-500 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="h-8 border-t border-slate-800 bg-slate-900 flex items-center justify-between px-6 text-[10px] text-slate-500">
        <div className="flex gap-4">
          <span>Nodes: {processedGraphData.nodes.length} / {rawGraphData.nodes.length}</span>
          <span>Edges: {processedGraphData.links.length} / {rawGraphData.links.length}</span>
        </div>
        <div>Dynamic Discovery Mode • RDF Navigator</div>
      </footer>
    </div>
  );
};

export default App;
