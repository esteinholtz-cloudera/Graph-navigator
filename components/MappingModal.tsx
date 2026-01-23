
import React from 'react';
import { AttributeMapping, MappingTarget, GraphData } from '../types';

interface MappingModalProps {
  visible: boolean;
  rawGraphData: GraphData;
  mappings: AttributeMapping;
  setMappings: React.Dispatch<React.SetStateAction<AttributeMapping>>;
  onClose: () => void;
}

const MappingModal: React.FC<MappingModalProps> = ({ visible, rawGraphData, mappings, setMappings, onClose }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[480px] p-6 shadow-2xl">
        <h2 className="text-xl font-bold mb-2">Attribute Mapping</h2>
        <div className="max-h-[300px] overflow-y-auto space-y-3">
          {rawGraphData.extraAttributes.length === 0 ? (
            <div className="text-center py-10 text-slate-500 italic">No extra attributes found in this data source.</div>
          ) : (
            rawGraphData.extraAttributes.map(attr => (
              <div key={attr} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                <span className="text-sm font-mono truncate max-w-[200px]">{attr}</span>
                <select 
                  value={mappings[attr] || 'None'}
                  onChange={(e) => setMappings({ ...mappings, [attr]: e.target.value as MappingTarget })}
                  className="bg-slate-900 text-xs rounded border border-slate-600 px-2 py-1"
                >
                  <option value="None">None</option>
                  <option value="Inferred">Inferred</option>
                  <option value="chunk">Chunk Size</option>
                  <option value="Community">Community</option>
                </select>
              </div>
            ))
          )}
        </div>
        <button onClick={onClose} className="mt-6 w-full py-2 bg-blue-600 rounded-lg font-bold">Apply & Save</button>
      </div>
    </div>
  );
};

export default MappingModal;
