
import React, { useState, useEffect, useRef, useMemo } from 'react';
import GraphView from './components/GraphView';
import { GraphData, PhysicsConfig, GroupingConfig, GraphLink, AttributeMapping, MappingTarget, GraphNode } from './types';
import { parseInputToGraph, sampleRDF, sampleJSON } from './services/rdfParser';
import { analyzeRelationship } from './services/geminiService';

const MAPPINGS_STORAGE_KEY = 'rdf-graph-navigator-mappings';

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
    friction: 0.4,
    gravity: 0.1,
    dimmingOpacity: 0.15
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

  useEffect(() => {
    const data = parseInputToGraph(input, format);
    setRawGraphData(data);
    
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

  const processedGraphData = useMemo(() => {
    const nodes = rawGraphData.nodes.map(node => {
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

    const links = rawGraphData.links
      .map(link => {
        const newLink = { 
          ...link,
          source: typeof link.source === 'object' ? (link.source as any).id : link.source,
          target: typeof link.target === 'object' ? (link.target as any).id : link.target
        };
        Object.entries(mappings).forEach(([attr, target]) => {
          const val = link.metadata?.[attr];
          if (val !== undefined && target === 'Inferred') {
            newLink.isInferred = !!val;
          }
        });
        return newLink;
      })
      .filter(link => showInferred || !link.isInferred);

    return { nodes, links, extraAttributes: rawGraphData.extraAttributes };
  }, [rawGraphData, mappings, showInferred]);

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        setFormat((extension === 'json' || extension === 'jsonld') ? 'json' : 'rdf');
        setInput(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-200">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".rdf,.ttl,.nt,.json,.jsonld" />

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
        <div className="flex gap-2">
           <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-medium transition-colors">Load File</button>
           <button onClick={() => { setFormat('rdf'); setInput(sampleRDF); }} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-sm border border-slate-700">Sample RDF</button>
           <button onClick={() => { setFormat('json'); setInput(sampleJSON); }} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-sm border border-slate-700">Sample JSON</button>
           {rawGraphData.extraAttributes.length > 0 && (
             <button onClick={() => setShowMappingModal(true)} className="px-3 py-1.5 bg-indigo-900/50 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-900 hover:text-white rounded-md text-sm">Configure Mappings</button>
           )}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        <aside className="w-80 border-r border-slate-800 bg-slate-900/80 p-4 flex flex-col gap-6 overflow-y-auto z-10">
          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Input Data</h2>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setFormat('rdf')} className={`flex-1 py-1 text-xs rounded border ${format === 'rdf' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>RDF</button>
              <button onClick={() => setFormat('json')} className={`flex-1 py-1 text-xs rounded border ${format === 'json' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>JSON-LD</button>
            </div>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} className="w-full h-32 bg-slate-800 border border-slate-700 rounded p-2 text-xs font-mono text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" placeholder="Paste data here..." />
          </section>

          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Physics</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Charge (Repulsion)</span><span className="text-blue-400">{physics.charge}</span></div>
                <input type="range" min="-1000" max="0" value={physics.charge} onChange={(e) => setPhysics({ ...physics, charge: Number(e.target.value) })} className="w-full accent-blue-500" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Link Distance</span><span className="text-blue-400">{physics.linkDistance}px</span></div>
                <input type="range" min="20" max="300" value={physics.linkDistance} onChange={(e) => setPhysics({ ...physics, linkDistance: Number(e.target.value) })} className="w-full accent-blue-500" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Disentangle (Lens)</span><span className="text-blue-400">{Math.round(physics.disentangleFactor * 100)}%</span></div>
                <input type="range" min="0" max="1" step="0.1" value={physics.disentangleFactor} onChange={(e) => setPhysics({ ...physics, disentangleFactor: Number(e.target.value) })} className="w-full accent-blue-500" />
              </div>
              
              <div className="pt-2 border-t border-slate-800">
                <h3 className="text-[10px] font-bold text-slate-600 uppercase mb-2">Advanced Forces</h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]"><span>Friction (Sticky)</span><span className="text-blue-400">{Math.round(physics.friction * 100)}%</span></div>
                    <input type="range" min="0" max="0.9" step="0.05" value={physics.friction} onChange={(e) => setPhysics({ ...physics, friction: Number(e.target.value) })} className="w-full accent-blue-400 h-1" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]"><span>Global Gravity</span><span className="text-blue-400">{Math.round(physics.gravity * 100)}%</span></div>
                    <input type="range" min="0" max="1" step="0.05" value={physics.gravity} onChange={(e) => setPhysics({ ...physics, gravity: Number(e.target.value) })} className="w-full accent-blue-400 h-1" />
                  </div>
                </div>
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
                <input type="checkbox" checked={grouping.showNamespaces} onChange={(e) => setGrouping({ ...grouping, showNamespaces: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                <span className="text-sm text-slate-300">Show Namespaces (URIs)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showInferred} onChange={(e) => setShowInferred(e.target.checked)} className="w-4 h-4 accent-blue-500" />
                <span className="text-sm text-slate-300">Show Inferred Edges</span>
              </label>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Hub Scaling</span><span className="text-blue-400">{grouping.connectivityEnlargement}%</span></div>
                <input type="range" min="0" max="100" value={grouping.connectivityEnlargement} onChange={(e) => setGrouping({ ...grouping, connectivityEnlargement: Number(e.target.value) })} className="w-full accent-blue-500" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Focus Intensity</span><span className="text-blue-400">{Math.round((1 - physics.dimmingOpacity) * 100)}%</span></div>
                <input type="range" min="0" max="0.95" step="0.05" value={1 - physics.dimmingOpacity} onChange={(e) => setPhysics({ ...physics, dimmingOpacity: Math.max(0.01, 1 - Number(e.target.value)) })} className="w-full accent-blue-500" />
              </div>
            </div>
          </section>
        </aside>

        <section className="flex-1 relative bg-slate-900">
          <GraphView 
            data={processedGraphData}
            physics={physics}
            grouping={grouping}
            selectedNodeId={selectedNodeId}
            onNodeSelect={(id) => { setSelectedNodeId(id); setSelectedEdge(null); setAiAnalysis(null); }}
            onEdgeSelect={(link) => { setSelectedEdge(link); setSelectedNodeId(null); setAiAnalysis(null); }}
          />

          <div className="absolute bottom-6 right-6 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-4 shadow-2xl z-20 pointer-events-none min-w-[180px]">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Legend</h3>
            <div className="space-y-3 text-[10px] text-slate-300">
              <div className="flex items-center gap-3"><div className="w-4 h-0.5 bg-slate-500"></div><span>Explicit</span></div>
              <div className="flex items-center gap-3"><div className="w-4 h-0.5 border-t-2 border-dashed border-blue-400"></div><span>Inferred</span></div>
              <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-slate-600 border border-slate-400"></div><span>Entity</span></div>
              <div className="flex items-center gap-3"><div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white"></div><span>Hub / Chunk</span></div>
            </div>
          </div>

          {(selectedNodeId || selectedEdge) && (
            <div className="absolute right-6 top-6 w-80 bg-slate-900/95 border border-slate-700 rounded-xl p-5 shadow-2xl backdrop-blur-md z-30">
              {selectedNodeId ? (
                (() => {
                  const node = processedGraphData.nodes.find(n => n.id === selectedNodeId);
                  return (
                    <div>
                      <h3 className="text-blue-400 text-xs font-bold uppercase mb-1">Entity Details</h3>
                      <p className="text-lg font-bold break-all text-white">{node?.label}</p>
                      <p className="text-[10px] text-slate-500 break-all mt-1 font-mono">{selectedNodeId}</p>
                      <div className="mt-4 border-t border-slate-800 pt-4 text-xs">
                        {node?.community && <div className="flex justify-between"><span>Community:</span> <span className="text-blue-300 font-bold">{node.community}</span></div>}
                        {node?.chunk && <div className="mt-2 p-2 bg-slate-800 rounded"><span>Context:</span> <p className="text-slate-400 italic mt-1">{node.chunk}</p></div>}
                      </div>
                    </div>
                  );
                })()
              ) : selectedEdge ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-blue-400 text-xs font-bold uppercase mb-1">Relationship</h3>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm text-slate-300">{typeof selectedEdge.source === 'string' ? selectedEdge.source : (selectedEdge.source as any).label}</p>
                      <div className={`px-2 py-1 border rounded w-fit text-xs my-1 font-bold ${selectedEdge.isInferred ? 'border-dashed border-blue-400 bg-blue-400/10 text-blue-300' : 'border-slate-600 bg-slate-800 text-slate-200'}`}>{selectedEdge.label}</div>
                      <p className="text-sm text-slate-300">{typeof selectedEdge.target === 'string' ? selectedEdge.target : (selectedEdge.target as any).label}</p>
                    </div>
                  </div>
                  <button onClick={handleAiAnalysis} disabled={isLoadingAi} className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-bold text-white">Semantic Analysis</button>
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
          <span>Nodes: {processedGraphData.nodes.length}</span>
          <span>Edges: {processedGraphData.links.length}</span>
        </div>
        <div>Visibility Optimized • Gemini 3 Flash • D3.js</div>
      </footer>
    </div>
  );
};

export default App;
