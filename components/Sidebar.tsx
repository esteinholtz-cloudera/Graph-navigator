
import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { PhysicsConfig, GroupingConfig } from '../types';
import { GraphStore } from '../hooks/useGraphStore';
import { MemoryStatus, formatBytes } from '../services/memoryMonitor';
import { PHYSICS_PRESETS, detectOptimalPreset } from '../configs/physicsPresets';

interface SidebarProps {
  physics: PhysicsConfig;
  setPhysics: React.Dispatch<React.SetStateAction<PhysicsConfig>>;
  grouping: GroupingConfig;
  setGrouping: React.Dispatch<React.SetStateAction<GroupingConfig>>;
  simState: { isRunning: boolean; alpha: number };
  store: GraphStore;
  memStatus: MemoryStatus | null;
  onConfigureMappings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  physics, setPhysics, grouping, setGrouping, simState, store, memStatus, onConfigureMappings
}) => {
  
  // Detect optimal preset
  const recommendedPreset = useMemo(() => {
    return detectOptimalPreset(
      store.displayData.nodes.length,
      store.displayData.links.length
    );
  }, [store.displayData.nodes.length, store.displayData.links.length]);
  
  // Legend Calculations
  const legendTitle = useMemo(() => {
    if (grouping.groupBy === 'none') return 'No Grouping';
    if (grouping.groupBy === 'type') return 'RDF Types';
    const communityMappedAttr = Object.entries(store.mappings).find(([_, target]) => target === 'Community')?.[0];
    return communityMappedAttr || 'Community Groups';
  }, [grouping.groupBy, store.mappings]);

  const uniqueGroups = useMemo(() => {
    if (grouping.groupBy === 'none') return [];
    const vals = new Set<string>();
    store.displayData.nodes.forEach(n => {
      const val = grouping.groupBy === 'community' ? (n.community || 'None') : (n.type || 'Resource');
      vals.add(val);
    });
    return Array.from(vals).sort();
  }, [store.displayData.nodes, grouping.groupBy]);

  const colorScale = useMemo(() => d3.scaleOrdinal(grouping.palette), [grouping.palette]);

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-900/80 p-4 flex flex-col gap-6 overflow-y-auto z-10">
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Physics Status</h2>
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${simState.isRunning ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${simState.isRunning ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></div>
            {simState.isRunning ? `Cooling (${(simState.alpha * 100).toFixed(1)}%)` : 'Stable'}
          </div>
        </div>
        
        <div className="bg-slate-800/50 rounded p-3 space-y-3">
          <div className="space-y-2">
            <span className="text-[10px] text-slate-500 uppercase">Preset</span>
            <select 
              onChange={(e) => setPhysics(PHYSICS_PRESETS[e.target.value].config)}
              className="w-full bg-slate-800 text-xs px-3 py-2 rounded border border-slate-700"
            >
              {Object.entries(PHYSICS_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.name} {key === recommendedPreset && '⭐'}
                </option>
              ))}
            </select>
            {recommendedPreset && (
              <p className="text-[9px] text-slate-500 italic">
                ⭐ = Recommended for current graph
              </p>
            )}
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs">Enabled</span>
            <button 
              onClick={() => setPhysics(p => ({ ...p, isPhysicsEnabled: !p.isPhysicsEnabled }))}
              className={`relative w-8 h-4 rounded-full transition-colors ${physics.isPhysicsEnabled ? 'bg-blue-600' : 'bg-slate-600'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${physics.isPhysicsEnabled ? 'left-4.5' : 'left-0.5'}`}></div>
            </button>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Auto-Freeze</span>
            <button 
              onClick={() => setPhysics(p => ({ ...p, autoFreeze: !p.autoFreeze }))}
              className={`relative w-8 h-4 rounded-full transition-colors ${physics.autoFreeze ? 'bg-blue-600' : 'bg-slate-600'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${physics.autoFreeze ? 'left-4.5' : 'left-0.5'}`}></div>
            </button>
          </div>
          
          {physics.autoFreeze && (
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Stabilization Limit</span>
                <span>{(physics.stabilizationThreshold * 100).toFixed(1)}%</span>
              </div>
              <input 
                type="range" min="0.001" max="0.1" step="0.001" 
                value={physics.stabilizationThreshold} 
                onChange={(e) => setPhysics({ ...physics, stabilizationThreshold: Number(e.target.value) })}
                className="w-full h-1 accent-blue-500" 
              />
              <p className="text-[9px] text-slate-600 leading-tight italic">Higher = faster cutoff for performance.</p>
            </div>
          )}

          <button 
            onClick={() => setPhysics(p => ({ ...p, isPhysicsEnabled: true }))}
            className="w-full py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-600/30 rounded text-[10px] font-bold uppercase transition-all"
          >
            Re-heat Simulation
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Visualization</h2>
        <div className="space-y-4">
          <button onClick={onConfigureMappings} className="w-full py-2 bg-slate-700 rounded text-xs font-bold hover:bg-slate-600 transition-colors">Configure Mappings</button>
          
          <div className="space-y-2">
            <span className="text-[10px] text-slate-500 uppercase">Group Nodes By</span>
            <select 
              value={grouping.groupBy}
              onChange={(e) => setGrouping({...grouping, groupBy: e.target.value as any})}
              className="w-full bg-slate-800 text-xs px-3 py-2 rounded border border-slate-700"
            >
              <option value="none">None (Uniform)</option>
              <option value="type">RDF Type</option>
              <option value="community">Mapped Community</option>
            </select>
          </div>

          <div className="space-y-2">
             <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={store.showInferred} onChange={(e) => store.setShowInferred(e.target.checked)} />
              Show Inferred Edges
             </label>
             <div className="space-y-1">
              <span className="text-[10px] text-slate-500">Dimming Opacity ({(physics.dimmingOpacity * 100).toFixed(0)}%)</span>
              <input type="range" min="0" max="1" step="0.01" value={physics.dimmingOpacity} onChange={(e) => setPhysics({...physics, dimmingOpacity: Number(e.target.value)})} className="w-full accent-blue-500" />
             </div>
          </div>
        </div>
      </section>

      {grouping.groupBy !== 'none' && uniqueGroups.length > 0 && (
        <section className="bg-slate-800/30 rounded-lg p-3 border border-slate-800/50">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            {legendTitle}
          </h2>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {uniqueGroups.map(group => (
              <div key={group} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colorScale(group) }}></div>
                <span className="text-[11px] truncate text-slate-300 font-medium">{group}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Memory Pressure</h2>
        <div className="bg-slate-800 rounded p-3 text-[10px] space-y-1">
          <div className="flex justify-between"><span>Used:</span><span>{memStatus ? formatBytes(memStatus.usedJSHeapSize) : 'N/A'}</span></div>
          <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${memStatus && memStatus.pressure > 0.8 ? 'bg-red-500' : 'bg-blue-500'}`} 
              style={{ width: `${(memStatus?.pressure || 0) * 100}%` }}
            ></div>
          </div>
        </div>
      </section>
    </aside>
  );
};

export default Sidebar;
