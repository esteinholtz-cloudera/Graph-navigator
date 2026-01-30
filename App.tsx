
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
import { useFileLoader } from './hooks/useFileLoader';
import { useGraphActions } from './hooks/useGraphActions';
import { getMemoryStatus, MemoryStatus } from './services/memoryMonitor';
import { findCommonNeighbors, findPaths } from './services/graphAlgorithms';
import { PHYSICS_PRESETS } from './configs/physicsPresets';

const STORAGE_PREFIX = 'rdf_nav_mappings_';
const USE_GEMINI = process.env.USE_GEMINI === 'true';

const App: React.FC = () => {
  const store = useGraphStore();
  const fileLoader = useFileLoader();
  const graphActions = useGraphActions(store);
  
  const [input, setInput] = useState(sampleRDF);
  const [format, setFormat] = useState<'rdf' | 'json'>('rdf');
  const [currentFileName, setCurrentFileName] = useState<string>('sample.rdf');
  const [selectedEdge, setSelectedEdge] = useState<GraphLink | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [memStatus, setMemStatus] = useState<MemoryStatus | null>(null);
  const [simState, setSimState] = useState({ isRunning: false, alpha: 0 });

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
      fileLoader.loadFromServer(filePath).then(result => {
        if (result) {
          setFormat(result.format);
          setCurrentFileName(result.fileName);
          setInput(result.content);
        }
      });
    }
  }, []);

  const [physics, setPhysics] = useState<PhysicsConfig>(PHYSICS_PRESETS.balanced.config);

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

    // Expansion Logic - use extracted action
    if (store.viewMode === 'explore' && !isCtrlPressed) {
      graphActions.expand(id);
    }
  }, [store, graphActions]);

  const handleEdgeSelect = useCallback((link: GraphLink | null) => {
    setSelectedEdge(link);
    store.setSelectedNodeIds(new Set());
    store.setHighlightedNodeIds(new Set());
    store.setHighlightedLinkIds(new Set());
    setAiAnalysis(null);
  }, [store]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.mapping')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            store.setMappings(JSON.parse(e.target?.result as string));
          } catch (err) { console.error(err); }
        };
        reader.readAsText(file);
        continue;
      }

      try {
        const result = await fileLoader.loadFromFile(file);
        setFormat(result.format);
        setCurrentFileName(result.fileName);
        setInput(result.content);
      } catch (err) {
        console.error('Error loading file:', err);
      }
    }
  }, [store, fileLoader]);

  // --- Graph Structure Manipulation Actions (extracted to custom hook) ---

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      
      if (store.selectedNodeIds.size > 0) {
        switch (e.key.toLowerCase()) {
          case 'p':
            graphActions.prune();
            break;
          case 'h':
            graphActions.hide();
            break;
          case 'r':
            graphActions.reset();
            break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store.selectedNodeIds, graphActions]);


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


  const handleSimStateChange = useCallback((isRunning: boolean, alpha: number) => {
    setSimState({ isRunning, alpha });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-200">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".rdf,.ttl,.nt,.n3,.owl,.json,.jsonld,.mapping" multiple />

      {/* Loading overlay */}
      {fileLoader.isLoading && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-lg font-medium text-slate-200">Loading file...</div>
            <div className="text-sm text-slate-400">Please wait</div>
          </div>
        </div>
      )}

      {/* Error notification */}
      {fileLoader.error && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
          <div className="bg-red-900/20 border border-red-600/40 rounded-lg p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-red-400 font-bold text-sm mb-1">Failed to Load File</h3>
                <p className="text-red-200 text-sm">{fileLoader.error}</p>
              </div>
              <button 
                onClick={fileLoader.clearError}
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
            onForgetNodes={graphActions.forgetNodes}
            onDismiss={() => { store.resetSelection(); setAiAnalysis(null); }}
            onPrune={graphActions.prune}
            onHide={graphActions.hide}
            onReset={graphActions.reset}
          />
        </section>
      </main>
    </div>
  );
};

export default App;
