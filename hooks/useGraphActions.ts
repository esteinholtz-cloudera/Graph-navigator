import { useCallback } from 'react';
import { GraphStore } from './useGraphStore';
import { GraphNode, GraphLink } from '../types';
import { getNeighbors } from '../services/graphAlgorithms';

export const useGraphActions = (store: GraphStore) => {
  
  const prune = useCallback(() => {
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

  const hide = useCallback(() => {
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

  const reset = useCallback(() => {
    if (store.selectedNodeIds.size === 0) return;

    if (store.viewMode === 'explore') {
      // RESET: Isolate view to Selection + Neighbors.
      store.setExploredNodeIds(new Set(store.selectedNodeIds));
      store.setHiddenNodeIds(new Set());
    } else {
      // ALL Mode: Manual isolation.
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

  const expand = useCallback((nodeId: string) => {
    if (store.viewMode === 'explore') {
      // Add to explored set
      store.setExploredNodeIds(prev => {
        const next = new Set(prev);
        next.add(nodeId);
        return next;
      });

      // Unhide neighbors
      const neighbors = getNeighbors(nodeId, store.rawGraphData.links);
      neighbors.add(nodeId);

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

  const forgetNodes = useCallback(() => {
    store.setExploredNodeIds(prev => {
      const next = new Set(prev);
      store.selectedNodeIds.forEach(id => next.delete(id));
      return next;
    });
    store.resetSelection();
  }, [store]);

  return {
    prune,
    hide,
    reset,
    expand,
    forgetNodes
  };
};
