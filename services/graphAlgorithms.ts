
import { GraphLink, GraphNode } from '../types';

/**
 * Returns a Set of node IDs that are directly connected to the given node ID.
 */
export const getNeighbors = (nodeId: string, links: GraphLink[]): Set<string> => {
  const neighbors = new Set<string>();
  links.forEach(link => {
    const s = typeof link.source === 'object' ? (link.source as GraphNode).id : String(link.source);
    const t = typeof link.target === 'object' ? (link.target as GraphNode).id : String(link.target);
    
    if (s === nodeId) neighbors.add(t);
    if (t === nodeId) neighbors.add(s);
  });
  return neighbors;
};

/**
 * Finds nodes that are common neighbors to all selected nodes.
 */
export const findCommonNeighbors = (
  selectedNodeIds: Set<string>,
  links: GraphLink[]
): Set<string> => {
  if (selectedNodeIds.size < 2) return new Set();
  
  const neighborConnections = new Map<string, Set<string>>();
  
  links.forEach(link => {
    // D3 mutates links to objects, handle both strings and objects
    const s = typeof link.source === 'object' ? (link.source as GraphNode).id : String(link.source);
    const t = typeof link.target === 'object' ? (link.target as GraphNode).id : String(link.target);
    
    // If source is selected, target is a neighbor
    if (selectedNodeIds.has(s) && !selectedNodeIds.has(t)) {
       if(!neighborConnections.has(t)) neighborConnections.set(t, new Set());
       neighborConnections.get(t)!.add(s);
    }
    // If target is selected, source is a neighbor
    if (selectedNodeIds.has(t) && !selectedNodeIds.has(s)) {
       if(!neighborConnections.has(s)) neighborConnections.set(s, new Set());
       neighborConnections.get(s)!.add(t);
    }
  });

  const common = new Set<string>();
  neighborConnections.forEach((connectedTo, nodeId) => {
    // Only include if connected to ALL selected nodes
    if (connectedTo.size === selectedNodeIds.size) common.add(nodeId);
  });
  
  return common;
};

/**
 * Finds a path between two nodes using BFS.
 * Returns the set of nodes and links involved in the path.
 */
export const findPaths = (
  start: string,
  end: string,
  links: GraphLink[]
): { nodes: Set<string>; links: Set<string> } | null => {
  const queue: string[] = [start];
  const visited = new Map<string, string | null>();
  visited.set(start, null);
  
  // Build Adjacency List
  const adj = new Map<string, string[]>();
  links.forEach(l => {
    const s = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source);
    const t = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target);
    
    if (!adj.has(s)) adj.set(s, []);
    if (!adj.has(t)) adj.set(t, []);
    adj.get(s)!.push(t);
    adj.get(t)!.push(s);
  });

  let found = false;
  while(queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === end) { found = true; break; }
    (adj.get(curr) || []).forEach(neighbor => {
      if (!visited.has(neighbor)) {
        visited.set(neighbor, curr);
        queue.push(neighbor);
      }
    });
  }

  if (found) {
    const pathNodes = new Set<string>();
    const pathLinks = new Set<string>();
    let curr: string | null = end;
    
    while(curr !== null) {
      pathNodes.add(curr);
      const prev: string | null = visited.get(curr)!;
      if (prev) {
        // Find the link connecting curr and prev
        const l = links.find(link => {
            const s = typeof link.source === 'object' ? (link.source as GraphNode).id : String(link.source);
            const t = typeof link.target === 'object' ? (link.target as GraphNode).id : String(link.target);
            return (s === prev && t === curr) || (s === curr && t === prev);
        });
        
        if (l) {
            const s = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source);
            const t = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target);
            pathLinks.add(`${s}-${t}-${l.label}`);
        }
      }
      curr = prev;
    }
    return { nodes: pathNodes, links: pathLinks };
  }
  return null;
};
