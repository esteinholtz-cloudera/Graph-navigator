import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink, PhysicsConfig, GroupingConfig, EdgeConfig } from '../types';

interface Props {
  data: GraphData;
  physics: PhysicsConfig;
  edgeConfig: EdgeConfig;
  grouping: GroupingConfig;
  selectedNodeIds: Set<string>;
  highlightedNodeIds: Set<string>;
  highlightedLinkIds: Set<string>;
  onNodeSelect: (id: string | null, event?: React.MouseEvent) => void;
  onEdgeSelect: (link: GraphLink | null) => void;
  onSimulationStateChange?: (isRunning: boolean, alpha: number) => void;
  globalDegrees?: Map<string, number>;
}

const GraphView: React.FC<Props> = ({ 
  data, physics, edgeConfig, grouping, selectedNodeIds, 
  highlightedNodeIds, highlightedLinkIds, onNodeSelect, onEdgeSelect, 
  onSimulationStateChange, globalDegrees 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const getRadius = (d: GraphNode) => {
    const base = d.chunk ? 18 : 12;
    const deg = globalDegrees?.get(d.id) || 0;
    const boost = deg * (grouping.connectivityEnlargement / 20);
    return base + boost;
  };

  const getLinkId = (l: any) => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    return `${s}-${t}-${l.label}`;
  };

  const handleZoomToFit = (duration = 750) => {
    if (!svgRef.current || !containerRef.current || !data.nodes.length) return;
    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const nodes = data.nodes;
    let minX = d3.min(nodes, d => d.x!)!;
    let maxX = d3.max(nodes, d => d.x!)!;
    let minY = d3.min(nodes, d => d.y!)!;
    let maxY = d3.max(nodes, d => d.y!)!;
    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const padding = 100;
    const scale = Math.min((width - padding) / (graphWidth || 1), (height - padding) / (graphHeight || 1), 2);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const transform = d3.zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-midX, -midY);
    svg.transition().duration(duration).call(zoomRef.current!.transform, transform);
  };

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const defs = svg.append('defs');
    const createArrow = (id: string, color: string, size: number) => {
      defs.append('marker')
        .attr('id', id)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 8).attr('refY', 0)
        .attr('markerWidth', size).attr('markerHeight', size)
        .attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', color);
    };
    createArrow('arrowhead-default', edgeConfig.explicit.color, edgeConfig.explicit.arrowSize);
    createArrow('arrowhead-inferred', edgeConfig.inferred.color, edgeConfig.inferred.arrowSize);
    createArrow('arrowhead-highlight', '#f59e0b', 8);

    const g = svg.append('g').attr('class', 'main-container');
    (gRef as any).current = g.node();
    g.append('g').attr('class', 'links-layer');
    g.append('g').attr('class', 'labels-layer');
    g.append('g').attr('class', 'nodes-layer');
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.05, 10]).on('zoom', (event) => g.attr('transform', event.transform));
    zoomRef.current = zoom;
    svg.call(zoom);
  }, [edgeConfig]);

  useEffect(() => {
    if (!gRef.current || !data.nodes.length) return;
    const g = d3.select(gRef.current);
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    data.nodes.forEach(newNode => {
      const oldNode = nodesRef.current.find(n => n.id === newNode.id);
      if (oldNode) {
        newNode.x = oldNode.x; newNode.y = oldNode.y;
        newNode.vx = oldNode.vx; newNode.vy = oldNode.vy;
      } else {
        newNode.x = width / 2 + (Math.random() - 0.5) * 100;
        newNode.y = height / 2 + (Math.random() - 0.5) * 100;
      }
    });
    nodesRef.current = data.nodes;

    if (!simulationRef.current) {
      simulationRef.current = d3.forceSimulation<GraphNode, GraphLink>();
    }
    
    const simulation = simulationRef.current;
    
    if (!physics.isPhysicsEnabled) {
      simulation.stop();
    } else {
      simulation.nodes(data.nodes)
        .velocityDecay(physics.friction)
        .force('link', d3.forceLink<GraphNode, GraphLink>(data.links).id(d => d.id).distance(physics.linkDistance))
        .force('charge', d3.forceManyBody().strength(physics.charge))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(physics.gravity))
        .force('collision', d3.forceCollide<GraphNode>().radius(d => getRadius(d) + 20));

      simulation.alpha(0.3).restart();
    }

    const colorScale = d3.scaleOrdinal(grouping.palette);

    const link = g.select('.links-layer').selectAll<SVGLineElement, GraphLink>('line').data(data.links, getLinkId);
    const linkEnter = link.enter().append('line').attr('class', 'graph-link').on('click', (event, d) => { event.stopPropagation(); onEdgeSelect(d); });
    const linkMerged = linkEnter.merge(link);
    link.exit().remove();

    linkMerged
      .attr('stroke', d => {
        const lid = `${d.sourceId}-${d.targetId}-${d.label}`;
        if (highlightedLinkIds.has(lid)) return '#f59e0b';
        return d.isInferred ? edgeConfig.inferred.color : edgeConfig.explicit.color;
      })
      .attr('stroke-width', d => {
        const lid = `${d.sourceId}-${d.targetId}-${d.label}`;
        const base = d.isInferred ? edgeConfig.inferred.width : edgeConfig.explicit.width;
        return highlightedLinkIds.has(lid) ? base * 2 : base;
      })
      .attr('stroke-opacity', d => {
        const lid = `${d.sourceId}-${d.targetId}-${d.label}`;
        if (highlightedLinkIds.has(lid)) return 1;
        if (selectedNodeIds.size > 0 && !(selectedNodeIds.has(d.sourceId) || selectedNodeIds.has(d.targetId))) return physics.dimmingOpacity;
        return d.isInferred ? edgeConfig.inferred.opacity : edgeConfig.explicit.opacity;
      })
      .attr('marker-end', d => {
        const lid = `${d.sourceId}-${d.targetId}-${d.label}`;
        if (highlightedLinkIds.has(lid)) return 'url(#arrowhead-highlight)';
        return d.isInferred ? 'url(#arrowhead-inferred)' : 'url(#arrowhead-default)';
      });

    const linkLabel = g.select('.labels-layer').selectAll<SVGTextElement, GraphLink>('text').data(data.links, getLinkId);
    const linkLabelEnter = linkLabel.enter().append('text').attr('class', 'link-label').attr('font-size', '10px').attr('fill', '#64748b').attr('text-anchor', 'middle').attr('pointer-events', 'none');
    const linkLabelMerged = linkLabelEnter.merge(linkLabel);
    linkLabelMerged.text(d => d.label)
      .attr('opacity', d => {
        const lid = `${d.sourceId}-${d.targetId}-${d.label}`;
        if (highlightedLinkIds.has(lid)) return 1;
        if (selectedNodeIds.size > 0 && !(selectedNodeIds.has(d.sourceId) || selectedNodeIds.has(d.targetId))) return physics.dimmingOpacity;
        return 1;
      });
    linkLabel.exit().remove();

    const node = g.select('.nodes-layer').selectAll<SVGGElement, GraphNode>('g').data(data.nodes, d => d.id);
    const nodeEnter = node.enter().append('g').attr('class', 'graph-node')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event) => { 
          if (!event.active && physics.isPhysicsEnabled) simulation.alphaTarget(0.3).restart(); 
          event.subject.fx = event.subject.x; 
          event.subject.fy = event.subject.y; 
        })
        .on('drag', (event) => { event.subject.fx = event.x; event.subject.fy = event.y; })
        .on('end', (event) => { 
          if (!event.active) simulation.alphaTarget(0); 
          if (!physics.isPhysicsEnabled) {
          } else {
            event.subject.fx = null; 
            event.subject.fy = null; 
          }
        }))
      .on('click', (event, d) => { event.stopPropagation(); onNodeSelect(d.id, (event as unknown as React.MouseEvent)); });

    nodeEnter.append('circle').attr('class', 'node-circle');
    nodeEnter.append('text');
    const nodeMerged = nodeEnter.merge(node);
    node.exit().remove();

    nodeMerged.select('.node-circle')
      .attr('r', d => getRadius(d))
      .attr('fill', d => {
        if (highlightedNodeIds.has(d.id) && !selectedNodeIds.has(d.id)) return '#8b5cf6';
        if (highlightedNodeIds.has(d.id) && selectedNodeIds.has(d.id)) return '#f59e0b';
        if (grouping.groupBy === 'none') return '#3b82f6';
        const groupVal = grouping.groupBy === 'community' ? (d.community || 'None') : (d.type || 'Resource');
        return colorScale(groupVal);
      })
      .attr('stroke', d => selectedNodeIds.has(d.id) ? '#22d3ee' : (highlightedNodeIds.has(d.id) ? '#fff' : '#fff'))
      .attr('stroke-width', d => selectedNodeIds.has(d.id) ? 4 : (highlightedNodeIds.has(d.id) ? 3 : 1.5))
      .attr('opacity', d => {
        if (selectedNodeIds.size === 0 && highlightedNodeIds.size === 0) return 1;
        if (selectedNodeIds.has(d.id) || highlightedNodeIds.has(d.id)) return 1;
        return physics.dimmingOpacity;
      });

    nodeMerged.select('text')
      .attr('dy', d => getRadius(d) + 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', d => {
        if (selectedNodeIds.has(d.id)) return '#22d3ee';
        if (highlightedNodeIds.has(d.id)) return '#d8b4fe';
        return '#f8fafc';
      })
      .attr('font-weight', d => (selectedNodeIds.has(d.id) || highlightedNodeIds.has(d.id)) ? 'bold' : 'normal')
      .attr('opacity', d => (selectedNodeIds.size === 0 || selectedNodeIds.has(d.id) || highlightedNodeIds.has(d.id)) ? 1 : physics.dimmingOpacity)
      .text(d => d.label);

    simulation.on('tick', () => {
      const alpha = simulation.alpha();
      if (onSimulationStateChange) onSimulationStateChange(true, alpha);

      // User-configurable stabilization logic
      if (physics.autoFreeze && alpha < (physics.stabilizationThreshold || 0.01)) {
        simulation.stop();
        if (onSimulationStateChange) onSimulationStateChange(false, 0);
      }

      linkMerged.each(function(d: any) {
        const s = d.source, t = d.target;
        if (!s.x || !t.x) return;
        const dx = t.x - s.x, dy = t.y - s.y, dist = Math.sqrt(dx*dx + dy*dy);
        if (dist === 0) return;
        const tr = getRadius(t) + 6, sr = getRadius(s);
        d3.select(this).attr('x1', s.x + (dx*sr/dist)).attr('y1', s.y + (dy*sr/dist)).attr('x2', t.x - (dx*tr/dist)).attr('y2', t.y - (dy*tr/dist));
      });
      linkLabelMerged.attr('x', d => ((d.source as any).x + (d.target as any).x) / 2).attr('y', d => ((d.source as any).y + (d.target as any).y) / 2);
      nodeMerged.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    simulation.on('end', () => {
       if (onSimulationStateChange) onSimulationStateChange(false, 0);
    });

  }, [data, physics, edgeConfig, grouping, globalDegrees, selectedNodeIds, highlightedNodeIds, highlightedLinkIds]);

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-900 overflow-hidden relative" onClick={(e) => onNodeSelect(null)}>
      <svg ref={svgRef} className="w-full h-full block" />
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button onClick={(e) => { e.stopPropagation(); handleZoomToFit(); }} className="p-2 bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg border border-slate-700 shadow-xl backdrop-blur-md transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        </button>
      </div>
    </div>
  );
};

export default GraphView;