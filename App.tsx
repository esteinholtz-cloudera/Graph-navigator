
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import GraphView from './components/GraphView';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SelectionPanel from './components/SelectionPanel';
import MappingModal from './components/MappingModal';
import { PhysicsConfig, GroupingConfig, GraphLink, MappingTarget, GraphNode, EdgeConfig, AttributeMapping } from './types';
import { parseInputToGraph, sampleRDF } from './services/rdfParser';
import { analyzeRelationship, analyzeGroupSemantics } from './services/geminiService';
import { useGraphStore } from './hooks/useGraphStore';
import { getMemoryStatus, MemoryStatus } from './services/memoryMonitor';
import { findCommonNeighbors, findPaths, getNeighbors } from './services/graphAlgorithms';

const STORAGE_PREFIX = 'rdf_nav_mappings_';
const USE_GEMINI = process.env.USE_GEMINI === 'true';

const App: React.FC = () => {
  const store = useGraphStore();
  const [input, setInput] = useState(sampleRDF);
  const [format, setFormat] = useState<'rdf' | 'json'>('rdf');
  const [currentFileName, setCurrentFileName] = useState<string>('sample.rdf');
  const [selectedEdge, setSelectedEdge] = useState<GraphLink | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [memStatus, setMemStatus] = useState<MemoryStatus | null>(null);
  const [simState, setSimState] = useState({ isRunning: false, alpha: 0 });
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Monitor Memory
  useEffect(() => {
    const interval = setInterval(() => setMemStatus(getMemoryStatus()), 2000);
    return () => clearInterval(interval);
  }, []);

  // Load file from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get('file');
    
    if (filePath) {
      loadFileFromServer(filePath);
    }
  }, []);

  const loadFileFromServer = async (path: string) => {
    setIsLoadingFile(true);
    setFileLoadError(null);
    
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      const fileName = path.split('/').pop() || 'file';
      const extension = fileName.split('.').pop()?.toLowerCase();
      
      setFormat((extension === 'json' || extension === 'jsonld') ? 'json' : 'rdf');
      setCurrentFileName(fileName);
      setInput(content);
      setFileLoadError(null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error loading file';
      setFileLoadError(errorMsg);
      console.error('Error loading file from URL:', error);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const [physics, setPhysics] = useState<PhysicsConfig>({
    charge: -300,
    linkDistance: 120,
    collisionRadius: 40,
    centering: true,
    disentangleFactor: 0.5,
    enableDisentangle: true,
    friction: 0.4,
    gravity: 0.1,
    dimmingOpacity: 0.7,
    autoFreeze: true,
    isPhysicsEnabled: true,
    stabilizationThreshold: 0.01
  });

  const edgeConfig = useMemo<EdgeConfig>(() => ({
    explicit: { color: '#475569', width: 2, opacity: 0.6, arrowSize: 6 },
    inferred: { color: '#60a5fa', width: 2, opacity: 0.6, arrowSize: 6 }
  }), []);

  const [grouping, setGrouping] = useState<GroupingConfig>({
    groupBy: 'community',
    palette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'],
    connectivityEnlargement: 20,
    showNamespaces: false
  });

  // Persistence: Load mappings when filename changes
  useEffect(() => {
    const key = STORAGE_PREFIX + currentFileName;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AttributeMapping;
        store.setMappings(parsed);
      } catch (e) {
        console.error("Failed to load saved mappings", e);
      }
    }
  }, [currentFileName]);

  // Persistence: Save mappings when they change
  useEffect(() => {
    if (!currentFileName || Object.keys(store.mappings).length === 0) return;
    const key = STORAGE_PREFIX + currentFileName;
    localStorage.setItem(key, JSON.stringify(store.mappings));
  }, [store.mappings, currentFileName]);

  // Handle Input Changes
  useEffect(() => {
    const data = parseInputToGraph(input, format);
    store.setRawGraphData(data);
    store.setHiddenNodeIds(new Set()); // Reset hidden on new file
    
    if (data.nodes.length > 0 && store.viewMode === 'explore') {
      const seed = data.nodes[0].id;
      store.setExploredNodeIds(new Set([seed]));
    }

    if (data.extraAttributes.length > 0) {
      store.setMappings(prev => {
        const next = { ...prev };
        let changed = false;
        data.extraAttributes.forEach(attr => {
          if (!(attr in next)) {
            next[attr] = 'None';
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [input, format]);

  const handleNodeClick = useCallback((id: string | null, event?: React.MouseEvent) => {
    if (!id) {
      store.resetSelection();
      setAiAnalysis(null);
      return;
    }

    const isCtrlPressed = event?.ctrlKey || event?.metaKey;
    store.setSelectedNodeIds(prev => {
      const next = new Set(prev);
      if (isCtrlPressed) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });

    store.setHighlightedNodeIds(new Set());
    store.setHighlightedLinkIds(new Set());
    setSelectedEdge(null);
    setAiAnalysis(null);

    // Expansion Logic
    // Standard behavior: clicking a node "expands" it (adds to explored set).
    // This accumulates nodes in the view. Use 'Reset' (R) to isolate.
    if (store.viewMode === 'explore' && !isCtrlPressed) {
      // 1. Add to explored set to ensure it's treated as a seed
      store.setExploredNodeIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      // 2. Identify neighbors and remove them from the 'hidden' set to ensure they appear
      // This is crucial for the "Expand" behavior if nodes were previously pruned.
      const neighbors = getNeighbors(id, store.rawGraphData.links);
      // Also unhide the node itself if it was somehow hidden
      neighbors.add(id);

      store.setHiddenNodeIds(prev => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        let changed = false;
        neighbors.forEach(nid => {
          if (next.has(nid)) {
            next.delete(nid);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [store]);

  const handleEdgeSelect = useCallback((link: GraphLink | null) => {
    setSelectedEdge(link);
    store.setSelectedNodeIds(new Set());
    store.setHighlightedNodeIds(new Set());
    store.setHighlightedLinkIds(new Set());
    setAiAnalysis(null);
  }, [store]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach((file: File) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (file.name.endsWith('.mapping')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            store.setMappings(JSON.parse(e.target?.result as string));
          } catch (err) { console.error(err); }
        };
        reader.readAsText(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          setFormat((extension === 'json' || extension === 'jsonld') ? 'json' : 'rdf');
          setCurrentFileName(file.name);
          setInput(content);
        }
      };
      reader.readAsText(file);
    });
  }, [store]);

  // --- Graph Structure Manipulation Actions ---

  const handlePrune = useCallback(() => {
    const links = store.displayData.links;
    const nodesToHide = new Set<string>();
    
    // Calculate degrees in current visible graph
    const degrees = new Map<string, number>();
    links.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source);
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target);
      degrees.set(s, (degrees.get(s) || 0) + 1);
      degrees.set(t, (degrees.get(t) || 0) + 1);
    });

    // Find neighbors of selected nodes that are leaves (degree 1)
    store.selectedNodeIds.forEach(sourceId => {
      const neighbors = getNeighbors(sourceId, links);
      neighbors.forEach(neighbor => {
        if (!store.selectedNodeIds.has(neighbor)) {
          // If neighbor is a leaf in the current view, hide it
          if ((degrees.get(neighbor) || 0) === 1) {
            nodesToHide.add(neighbor);
          }
        }
      });
    });

    if (nodesToHide.size > 0) {
      store.setHiddenNodeIds(prev => new Set([...prev, ...nodesToHide]));
    }
  }, [store]);

  const handleHide = useCallback(() => {
    const toHide = new Set(store.selectedNodeIds);
    const links = store.displayData.links;
    const currentNodes = store.displayData.nodes;

    // Simulate graph state after hiding selected nodes to find orphans
    const degrees = new Map<string, number>();
    currentNodes.forEach(n => {
      if (!toHide.has(n.id)) degrees.set(n.id, 0);
    });

    links.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source);
      const t = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target);
      
      if (!toHide.has(s) && !toHide.has(t)) {
        degrees.set(s, (degrees.get(s) || 0) + 1);
        degrees.set(t, (degrees.get(t) || 0) + 1);
      }
    });

    // Any remaining node with degree 0 is an orphan and should be hidden
    degrees.forEach((deg, id) => {
      if (deg === 0) toHide.add(id);
    });

    store.setHiddenNodeIds(prev => new Set([...prev, ...toHide]));
    store.resetSelection();
  }, [store]);

  const handleReset = useCallback(() => {
    if (store.selectedNodeIds.size === 0) return;

    if (store.viewMode === 'explore') {
      // RESET: Isolate view to Selection + Neighbors.
      // 1. Set explored path strictly to the selection.
      store.setExploredNodeIds(new Set(store.selectedNodeIds));
      
      // 2. Clear hidden nodes. This ensures that any neighbor previously pruned or hidden reappears.
      // Since 'visibleNodeIds' in explore mode is calculated as (Explored + Neighbors) - Hidden,
      // clearing hidden ensures we see the full neighborhood.
      store.setHiddenNodeIds(new Set());
    } else {
      // ALL Mode: Manual isolation.
      // Keep selected nodes
      const toKeep = new Set(store.selectedNodeIds);
      // Keep their neighbors
      store.selectedNodeIds.forEach(id => {
        const neighbors = getNeighbors(id, store.rawGraphData.links);
        neighbors.forEach(n => toKeep.add(n));
      });

      // Hide everything else
      const allNodeIds = store.rawGraphData.nodes.map(n => n.id);
      const newHidden = new Set<string>();
      allNodeIds.forEach(id => {
        if (!toKeep.has(id)) newHidden.add(id);
      });
      store.setHiddenNodeIds(newHidden);
    }
  }, [store]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      
      if (store.selectedNodeIds.size > 0) {
        switch (e.key.toLowerCase()) {
          case 'p':
            handlePrune();
            break;
          case 'h':
            handleHide();
            break;
          case 'r':
            handleReset();
            break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store.selectedNodeIds, handlePrune, handleHide, handleReset]);


  // --- Graph Algorithms via Service ---

  const handleFindCommonNeighbors = useCallback(() => {
    const common = findCommonNeighbors(store.selectedNodeIds, store.displayData.links);
    store.setHighlightedNodeIds(common);
  }, [store]);

  const handleFindPaths = useCallback(() => {
    if (store.selectedNodeIds.size !== 2) return;
    const selectedNodes = Array.from(store.selectedNodeIds);
    const result = findPaths(selectedNodes[0], selectedNodes[1], store.displayData.links);
    
    if (result) {
      store.setHighlightedNodeIds(result.nodes);
      store.setHighlightedLinkIds(result.links);
    }
  }, [store]);

  const handleAiAnalysis = async () => {
    if (!USE_GEMINI) {
      setAiAnalysis("Gemini analysis is disabled. Set USE_GEMINI=true to enable.");
      return;
    }
    setIsLoadingAi(true);
    setAiAnalysis(null);
    try {
      if (selectedEdge) {
        const sourceLabel = (typeof selectedEdge.source === 'object' ? (selectedEdge.source as GraphNode).label : String(selectedEdge.source));
        const targetLabel = (typeof selectedEdge.target === 'object' ? (selectedEdge.target as GraphNode).label : String(selectedEdge.target));
        const result = await analyzeRelationship(sourceLabel, targetLabel, selectedEdge.label);
        setAiAnalysis(result || "No analysis available.");
      } else if (store.selectedNodeIds.size > 0) {
        const labels = store.displayData.nodes
          .filter(n => store.selectedNodeIds.has(n.id))
          .map(n => n.label);
        const result = await analyzeGroupSemantics(labels);
        setAiAnalysis(result || "No analysis available.");
      }
    } catch (err) {
      setAiAnalysis("AI analysis failed. Please check your API key or connection.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleForgetNodes = () => {
    store.setExploredNodeIds(prev => {
      const next = new Set(prev);
      store.selectedNodeIds.forEach(id => next.delete(id));
      return next;
    });
    store.resetSelection();
  };

  const handleSimStateChange = useCallback((isRunning: boolean, alpha: number) => {
    setSimState({ isRunning, alpha });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-200">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".rdf,.ttl,.nt,.n3,.owl,.json,.jsonld,.mapping" multiple />

      {/* Loading overlay */}
      {isLoadingFile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-lg font-medium text-slate-200">Loading file...</div>
            <div className="text-sm text-slate-400">Please wait</div>
          </div>
        </div>
      )}

      {/* Error notification */}
      {fileLoadError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
          <div className="bg-red-900/20 border border-red-600/40 rounded-lg p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-red-400 font-bold text-sm mb-1">Failed to Load File</h3>
                <p className="text-red-200 text-sm">{fileLoadError}</p>
              </div>
              <button 
                onClick={() => setFileLoadError(null)}
                className="text-red-400 hover:text-red-300 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <MappingModal 
        visible={showMappingModal} 
        rawGraphData={store.rawGraphData} 
        mappings={store.mappings} 
        setMappings={store.setMappings} 
        onClose={() => setShowMappingModal(false)} 
      />

      <Header 
        currentFileName={currentFileName}
        viewMode={store.viewMode}
        setViewMode={store.setViewMode}
        onLoadClick={() => fileInputRef.current?.click()}
      />

      <main className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          physics={physics} 
          setPhysics={setPhysics} 
          grouping={grouping} 
          setGrouping={setGrouping} 
          simState={simState} 
          store={store} 
          memStatus={memStatus}
          onConfigureMappings={() => setShowMappingModal(true)}
        />

        <section className="flex-1 relative bg-slate-900">
          <GraphView 
            data={store.displayData}
            physics={physics}
            edgeConfig={edgeConfig}
            grouping={grouping}
            selectedNodeIds={store.selectedNodeIds}
            highlightedNodeIds={store.highlightedNodeIds}
            highlightedLinkIds={store.highlightedLinkIds}
            onNodeSelect={handleNodeClick}
            onEdgeSelect={handleEdgeSelect}
            onSimulationStateChange={handleSimStateChange}
            globalDegrees={store.globalDegrees}
          />

          <SelectionPanel 
            selectedNodeIds={store.selectedNodeIds}
            selectedEdge={selectedEdge}
            aiAnalysis={aiAnalysis}
            isLoadingAi={isLoadingAi}
            viewMode={store.viewMode}
            useGemini={USE_GEMINI}
            onAnalyze={handleAiAnalysis}
            onCommonNeighbors={handleFindCommonNeighbors}
            onFindPaths={handleFindPaths}
            onForgetNodes={handleForgetNodes}
            onDismiss={() => { store.resetSelection(); setAiAnalysis(null); }}
            onPrune={handlePrune}
            onHide={handleHide}
            onReset={handleReset}
          />
        </section>
      </main>
    </div>
  );
};

export default App;
