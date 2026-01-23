
import { useState, useMemo, useCallback } from 'react';
import { GraphData, GraphNode, GraphLink, AttributeMapping, MappingTarget } from '../types';

export type ViewMode = 'all' | 'explore';

export interface GraphStore {
  rawGraphData: GraphData;
  setRawGraphData: React.Dispatch<React.SetStateAction<GraphData>>;
  displayData: GraphData;
  globalDegrees: Map<string, number>;
  exploredNodeIds: Set<string>;
  setExploredNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedNodeIds: Set<string>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  highlightedNodeIds: Set<string>;
  setHighlightedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  highlightedLinkIds: Set<string>;
  setHighlightedLinkIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  hiddenNodeIds: Set<string>;
  setHiddenNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  showInferred: boolean;
  setShowInferred: React.Dispatch<React.SetStateAction<boolean>>;
  mappings: AttributeMapping;
  setMappings: React.Dispatch<React.SetStateAction<AttributeMapping>>;
  resetSelection: () => void;
}

export const useGraphStore = (): GraphStore => {
  const [rawGraphData, setRawGraphData] = useState<GraphData>({ nodes: [], links: [], extraAttributes: [] });
  const [exploredNodeIds, setExploredNodeIds] = useState<Set<string>>(new Set());
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [highlightedLinkIds, setHighlightedLinkIds] = useState<Set<string>>(new Set());
  const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('explore');
  const [showInferred, setShowInferred] = useState(true);
  const [mappings, setMappings] = useState<AttributeMapping>({});

  // Global degrees (calculated once per data change)
  const globalDegrees = useMemo(() => {
    const degrees = new Map<string, number>();
    rawGraphData.nodes.forEach(n => degrees.set(n.id, 0));
    rawGraphData.links.forEach(l => {
      const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
      
      let isInferred = l.isInferred ?? false;
      Object.entries(mappings).forEach(([attr, target]) => {
        if (l.metadata?.[attr] && target === 'Inferred') isInferred = true;
      });

      if (showInferred || !isInferred) {
        degrees.set(s, (degrees.get(s) || 0) + 1);
        degrees.set(t, (degrees.get(t) || 0) + 1);
      }
    });
    return degrees;
  }, [rawGraphData, mappings, showInferred]);

  // Processed display data
  const displayData = useMemo(() => {
    // 1. Filter links based on Inference settings
    const allLinks = rawGraphData.links.map(link => {
      const sourceId = (typeof link.source === 'object' ? (link.source as any).id : String(link.source));
      const targetId = (typeof link.target === 'object' ? (link.target as any).id : String(link.target));
      let isInferred = link.isInferred ?? false;
      Object.entries(mappings).forEach(([attr, target]) => {
        if (link.metadata?.[attr] && target === 'Inferred') isInferred = true;
      });
      return { ...link, sourceId, targetId, isInferred };
    }).filter(link => showInferred || !link.isInferred);

    // 2. Determine visible nodes based on View Mode
    let visibleNodeIds: Set<string>;
    if (viewMode === 'all') {
      visibleNodeIds = new Set(rawGraphData.nodes.map(n => n.id));
    } else {
      visibleNodeIds = new Set(exploredNodeIds);
      // Add neighbors of explored nodes
      allLinks.forEach(link => {
        if (exploredNodeIds.has(link.sourceId)) visibleNodeIds.add(link.targetId);
        if (exploredNodeIds.has(link.targetId)) visibleNodeIds.add(link.sourceId);
      });
    }

    // 3. Remove Hidden Nodes
    hiddenNodeIds.forEach(id => visibleNodeIds.delete(id));

    // 4. Final Link Filter (both ends must be visible)
    const visibleLinks = allLinks.filter(l => visibleNodeIds.has(l.sourceId) && visibleNodeIds.has(l.targetId));

    // 5. Map Nodes to include mapped attributes
    const nodes = rawGraphData.nodes
      .filter(n => visibleNodeIds.has(n.id))
      .map(node => {
        const newNode = { ...node };
        Object.entries(mappings).forEach(([attr, target]) => {
          const val = node.metadata?.[attr];
          if (val !== undefined) {
            if (target === 'chunk') newNode.chunk = String(val);
            if (target === 'Community') newNode.community = String(val);
          }
        });
        return newNode;
      });

    return { 
      nodes, 
      links: visibleLinks,
      extraAttributes: rawGraphData.extraAttributes,
      error: rawGraphData.error
    };
  }, [rawGraphData, exploredNodeIds, viewMode, showInferred, mappings, hiddenNodeIds]);

  const resetSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setHighlightedNodeIds(new Set());
    setHighlightedLinkIds(new Set());
  }, []);

  return {
    rawGraphData, setRawGraphData,
    displayData,
    globalDegrees,
    exploredNodeIds, setExploredNodeIds,
    selectedNodeIds, setSelectedNodeIds,
    highlightedNodeIds, setHighlightedNodeIds,
    highlightedLinkIds, setHighlightedLinkIds,
    hiddenNodeIds, setHiddenNodeIds,
    viewMode, setViewMode,
    showInferred, setShowInferred,
    mappings, setMappings,
    resetSelection
  };
};
