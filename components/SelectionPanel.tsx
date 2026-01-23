
import React, { useState } from 'react';
import { GraphLink, GraphNode } from '../types';
import { ViewMode } from '../hooks/useGraphStore';

interface SelectionPanelProps {
  selectedNodeIds: Set<string>;
  selectedEdge: GraphLink | null;
  aiAnalysis: string | null;
  isLoadingAi: boolean;
  viewMode: ViewMode;
  useGemini: boolean;
  onAnalyze: () => void;
  onCommonNeighbors: () => void;
  onFindPaths: () => void;
  onForgetNodes: () => void;
  onDismiss: () => void;
  onPrune: () => void;
  onHide: () => void;
  onReset: () => void;
}

const SelectionPanel: React.FC<SelectionPanelProps> = ({
  selectedNodeIds, selectedEdge, aiAnalysis, isLoadingAi, viewMode, useGemini,
  onAnalyze, onCommonNeighbors, onFindPaths, onForgetNodes, onDismiss,
  onPrune, onHide, onReset
}) => {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  if (selectedNodeIds.size === 0 && !selectedEdge) return null;

  return (
    <div className="absolute right-6 top-6 w-80 bg-slate-900/95 border border-slate-700 rounded-xl p-5 shadow-2xl backdrop-blur-md z-30 flex flex-col gap-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
      <div>
        <h3 className="text-blue-400 text-xs font-bold uppercase mb-2">Selection Actions</h3>
        <div className="text-sm mb-4">
          {selectedEdge ? (
            <>Relationship: <strong className="text-slate-100">{selectedEdge.label}</strong></>
          ) : (
            <>Nodes Selected: <strong className="text-slate-100">{selectedNodeIds.size}</strong></>
          )}
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          {useGemini && (
            <button 
              onClick={onAnalyze} 
              disabled={isLoadingAi}
              className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-600/30 rounded text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoadingAi ? (
                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              )}
              Analyze with Gemini
            </button>
          )}

          {!selectedEdge && selectedNodeIds.size > 0 && (
            <div className="grid grid-cols-2 gap-2">
               <button 
                onClick={onPrune}
                className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-bold transition-all"
                title="Hide leaf nodes connected to selection (Shortcut: P)"
              >
                Prune Leaves
              </button>
               <button 
                onClick={onHide}
                className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-bold transition-all"
                title="Hide selection and resulting orphans (Shortcut: H)"
              >
                Hide Node(s)
              </button>
            </div>
          )}

          {!selectedEdge && selectedNodeIds.size > 0 && (
             <button 
              onClick={onReset}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-bold transition-all"
              title="Reset view to only show selection and its immediate neighbors (Shortcut: R)"
            >
              Reset Focus (Isolate)
            </button>
          )}

          {!selectedEdge && selectedNodeIds.size > 1 && (
            <button 
              onClick={onCommonNeighbors}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-bold transition-all"
            >
              Find Common Neighbors
            </button>
          )}

          {!selectedEdge && selectedNodeIds.size === 2 && (
            <button 
              onClick={onFindPaths}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-bold transition-all"
            >
              Highlight Paths
            </button>
          )}

          {viewMode === 'explore' && selectedNodeIds.size > 0 && (
            <button 
              onClick={onForgetNodes}
              className="w-full py-2 bg-red-900/10 hover:bg-red-900/20 text-red-400 border border-red-900/30 rounded text-xs font-bold transition-all"
            >
              Forget Selected
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800 pt-2">
        <button 
            onClick={() => setIsShortcutsOpen(!isShortcutsOpen)}
            className="flex items-center justify-between w-full text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
        >
            <span>Keyboard Shortcuts</span>
            <span className={`transform transition-transform ${isShortcutsOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>
        
        {isShortcutsOpen && (
            <div className="mt-2 space-y-2 text-xs text-slate-400 bg-slate-800/30 p-2 rounded">
                <div className="flex justify-between items-center">
                    <span>Prune Leaves</span>
                    <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">P</kbd>
                </div>
                <p className="text-[10px] text-slate-500 mb-1 leading-tight">Hides leaf nodes connected to selection.</p>
                
                <div className="flex justify-between items-center border-t border-slate-700/50 pt-1">
                    <span>Hide Node</span>
                    <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">H</kbd>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Hides selected nodes + resulting orphans.</p>
                
                <div className="flex justify-between items-center border-t border-slate-700/50 pt-1">
                    <span>Reset Focus</span>
                    <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">R</kbd>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Isolate selection and immediate neighbors.</p>

                <div className="flex justify-between items-center border-t border-slate-700/50 pt-1">
                    <span>Multi Select</span>
                    <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">Ctrl + Click</kbd>
                </div>
            </div>
        )}
      </div>

      {aiAnalysis && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <h4 className="text-[10px] font-bold text-blue-400 uppercase mb-1">AI Analysis</h4>
          <p className="text-xs leading-relaxed text-slate-300 italic">"{aiAnalysis}"</p>
        </div>
      )}

      <button 
        onClick={onDismiss} 
        className="w-full py-1.5 text-[10px] bg-slate-800/50 hover:bg-slate-800 text-slate-500 uppercase tracking-widest rounded"
      >
        Dismiss Selection
      </button>
    </div>
  );
};

export default SelectionPanel;
