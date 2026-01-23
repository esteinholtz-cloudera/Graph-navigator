
import React from 'react';
import { ViewMode } from '../hooks/useGraphStore';

interface HeaderProps {
  currentFileName: string;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onLoadClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentFileName, viewMode, setViewMode, onLoadClick }) => {
  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 z-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold">G</div>
        <h1 className="text-xl font-bold">RDF Graph Navigator</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end mr-2">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Current File</span>
          <span className="text-xs text-blue-400 font-mono truncate max-w-[150px]">{currentFileName}</span>
        </div>
        <select 
          value={viewMode} 
          onChange={(e) => setViewMode(e.target.value as ViewMode)} 
          className="bg-slate-800 text-sm px-3 py-1.5 rounded-lg border border-slate-700"
        >
          <option value="all">View: All</option>
          <option value="explore">View: Explore</option>
        </select>
        <button onClick={onLoadClick} className="px-4 py-1.5 bg-blue-600 rounded-md text-sm font-medium">Load Files</button>
      </div>
    </header>
  );
};

export default Header;
