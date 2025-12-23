
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink, PhysicsConfig, GroupingConfig } from '../types';

interface Props {
  data: GraphData;
  physics: PhysicsConfig;
  grouping: GroupingConfig;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  onEdgeSelect: (link: GraphLink | null) => void;
}

const GraphView: React.FC<Props> = ({ data, physics, grouping, selectedNodeId, onNodeSelect, onEdgeSelect }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const getRadius = (d: GraphNode, degrees: Map<string, number>) => {
    const base = d.chunk ? 18 : 12;
    const deg = degrees.get(d.id) || 0;
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

  const handleZoomReadable = () => {
    if (!svgRef.current || !containerRef.current || !data.nodes.length) return;
    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const midX = d3.mean(data.nodes, d => d.x!)!;
    const midY = d3.mean(data.nodes, d => d.y!)!;

    const transform = d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85).translate(-midX, -midY);
    svg.transition().duration(750).call(zoomRef.current!.transform, transform);
  };

  const handleRecompact = () => {
    if (!simulationRef.current || !containerRef.current) return;
    const simulation = simulationRef.current;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    simulation.force('recompact', d3.forceRadial(0, width / 2, height / 2).strength(0.8));
    simulation.alpha(1).restart();

    setTimeout(() => {
      simulation.force('recompact', null);
      handleZoomToFit(1000);
    }, 1200);
  };

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const defs = svg.append('defs');
    
    const createArrow = (id: string, color: string) => {
      defs.append('marker')
        .attr('id', id)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 8).attr('refY', 0)
        .attr('markerWidth', 6).attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', color);
    };

    createArrow('arrowhead-default', '#475569');
    createArrow('arrowhead-inferred', '#60a5fa');

    const g = svg.append('g').attr('class', 'main-container');
    (gRef as any).current = g.node();
    g.append('g').attr('class', 'links-layer');
    g.append('g').attr('class', 'labels-layer');
    g.append('g').attr('class', 'nodes-layer');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 10])
      .on('zoom', (event) => g.attr('transform', event.transform));
    
    zoomRef.current = zoom;
    svg.call(zoom);
  }, []);

  useEffect(() => {
    if (!gRef.current || !data.nodes.length) return;
    const g = d3.select(gRef.current);
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    const degrees = new Map<string, number>();
    data.nodes.forEach(n => degrees.set(n.id, 0));
    data.links.forEach(l => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      degrees.set(sId, (degrees.get(sId) || 0) + 1);
      degrees.set(tId, (degrees.get(tId) || 0) + 1);
    });

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

    if (!simulationRef.current) simulationRef.current = d3.forceSimulation<GraphNode, GraphLink>();
    const simulation = simulationRef.current;
    
    simulation.nodes(data.nodes)
      .velocityDecay(physics.friction)
      .force('link', d3.forceLink<GraphNode, GraphLink>(data.links)
        .id(d => d.id)
        .distance(physics.linkDistance)
        .strength(link => {
          const s = typeof link.source === 'object' ? (link.source as any).id : link.source;
          const t = typeof link.target === 'object' ? (link.target as any).id : link.target;
          return (s === selectedNodeId || t === selectedNodeId) ? 1 : 0.4;
        }))
      .force('charge', d3.forceManyBody().strength(physics.charge))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(physics.gravity))
      .force('collision', d3.forceCollide().radius(d => {
        const r = getRadius(d, degrees);
        const displayedText = grouping.showNamespaces ? d.id : d.label;
        return r + (displayedText.length * 2.5) + 12;
      }))
      .alpha(0.3).restart();

    const colorScale = d3.scaleOrdinal(grouping.palette);

    const link = g.select('.links-layer').selectAll<SVGLineElement, GraphLink>('line').data(data.links, getLinkId);
    const linkEnter = link.enter().append('line').attr('class', 'graph-link').attr('stroke-width', 2).attr('stroke-opacity', 0.6).on('click', (event, d) => { event.stopPropagation(); onEdgeSelect(d); });
    const linkMerged = linkEnter.merge(link);
    link.exit().remove();
    linkMerged.attr('stroke', d => d.isInferred ? '#60a5fa' : '#475569').attr('stroke-dasharray', d => d.isInferred ? '4,2' : 'none').attr('marker-end', d => d.isInferred ? 'url(#arrowhead-inferred)' : 'url(#arrowhead-default)');

    const linkLabel = g.select('.labels-layer').selectAll<SVGTextElement, GraphLink>('text').data(data.links, getLinkId);
    const linkLabelEnter = linkLabel.enter().append('text').attr('class', 'link-label').attr('font-size', '10px').attr('fill', '#94a3b8').attr('text-anchor', 'middle').attr('pointer-events', 'none');
    const linkLabelMerged = linkLabelEnter.merge(linkLabel);
    linkLabelMerged.text(d => grouping.showNamespaces && d.uri ? d.uri : d.label);
    linkLabel.exit().remove();

    const node = g.select('.nodes-layer').selectAll<SVGGElement, GraphNode>('g').data(data.nodes, d => d.id);
    const nodeEnter = node.enter().append('g').attr('class', 'graph-node')
      .call(d3.drag<SVGGElement, GraphNode>().on('start', (event) => { if (!event.active) simulation.alphaTarget(0.3).restart(); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y; })
      .on('drag', (event) => { event.subject.fx = event.x; event.subject.fy = event.y; })
      .on('end', (event) => { if (!event.active) simulation.alphaTarget(0); event.subject.fx = null; event.subject.fy = null; }))
      .on('click', (event, d) => { event.stopPropagation(); onNodeSelect(d.id); });

    nodeEnter.append('circle').attr('class', 'node-circle');
    nodeEnter.append('circle').attr('class', 'node-halo').attr('fill', 'none').attr('stroke', '#fff').attr('stroke-width', 0).attr('opacity', 0);
    nodeEnter.append('text');
    const nodeMerged = nodeEnter.merge(node);
    node.exit().remove();

    nodeMerged.select('.node-circle').attr('r', d => getRadius(d, degrees)).attr('fill', d => grouping.byType ? colorScale(d.community || d.type) : '#3b82f6').attr('stroke', '#fff').attr('stroke-width', 2);
    nodeMerged.select('.node-halo').attr('r', d => getRadius(d, degrees) + 6);
    nodeMerged.select('text')
      .attr('dy', d => getRadius(d, degrees) + 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', '#f8fafc')
      .attr('pointer-events', 'none')
      .text(d => grouping.showNamespaces ? d.id : d.label);

    simulation.on('tick', () => {
      linkMerged.each(function(d: any) {
        const s = d.source, t = d.target;
        if (!s.x || !t.x) return;
        const dx = t.x - s.x, dy = t.y - s.y, dist = Math.sqrt(dx*dx + dy*dy);
        if (dist === 0) return;
        const tr = getRadius(t, degrees) + 5, sr = getRadius(s, degrees);
        d3.select(this).attr('x1', s.x + (dx*sr/dist)).attr('y1', s.y + (dy*sr/dist)).attr('x2', t.x - (dx*tr/dist)).attr('y2', t.y - (dy*tr/dist));
      });
      linkLabelMerged.attr('x', d => ((d.source as any).x + (d.target as any).x) / 2).attr('y', d => ((d.source as any).y + (d.target as any).y) / 2);
      nodeMerged.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }, [data, physics, grouping]);

  useEffect(() => {
    if (!simulationRef.current || !gRef.current) return;
    const simulation = simulationRef.current;
    
    const neighbors = new Set<string>();
    if (selectedNodeId) {
      neighbors.add(selectedNodeId);
      data.links.forEach(l => {
        const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (s === selectedNodeId) neighbors.add(t);
        if (t === selectedNodeId) neighbors.add(s);
      });

      if (physics.disentangleFactor > 0) {
        const selNode = data.nodes.find(n => n.id === selectedNodeId);
        if (selNode) {
          simulation.force('radial', d3.forceRadial(
            (d: any) => neighbors.has(d.id) ? 0 : physics.disentangleFactor * 600,
            selNode.x || 0,
            selNode.y || 0
          ).strength(0.6));
          simulation.alpha(0.3).restart();
        }
      }
    } else {
      simulation.force('radial', null);
    }

    const g = d3.select(gRef.current);
    const nodes = g.selectAll<SVGGElement, GraphNode>('.graph-node');
    const links = g.selectAll<SVGLineElement, GraphLink>('.graph-link');
    const labels = g.selectAll<SVGTextElement, GraphLink>('.link-label');

    if (!selectedNodeId) {
      nodes.transition().duration(300).style('opacity', 1);
      nodes.select('.node-halo').transition().duration(300).attr('stroke-width', 0).attr('opacity', 0);
      links.transition().duration(300).style('opacity', 0.6).attr('stroke-width', 2);
      labels.transition().duration(300).style('opacity', 1);
    } else {
      nodes.transition().duration(300).style('opacity', d => neighbors.has(d.id) ? 1 : physics.dimmingOpacity);
      nodes.select('.node-halo').transition().duration(300)
        .attr('stroke-width', d => d.id === selectedNodeId ? 4 : 0)
        .attr('opacity', d => d.id === selectedNodeId ? 0.6 : 0);
        
      links.transition().duration(300).style('opacity', l => {
        const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return (s === selectedNodeId || t === selectedNodeId) ? 1 : Math.max(0.01, physics.dimmingOpacity / 2);
      }).attr('stroke-width', l => {
        const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return (s === selectedNodeId || t === selectedNodeId) ? 4 : 2;
      });
      
      labels.transition().duration(300).style('opacity', l => {
        const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return (s === selectedNodeId || t === selectedNodeId) ? 1 : Math.max(0.01, physics.dimmingOpacity / 2);
      });
    }
  }, [selectedNodeId, physics.disentangleFactor, physics.dimmingOpacity, data]);

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-900 overflow-hidden relative" onClick={() => onNodeSelect(null)}>
      <svg ref={svgRef} className="w-full h-full block" />
      <div className="absolute bottom-6 right-[220px] flex flex-col gap-2 z-40">
        <button 
          onClick={(e) => { e.stopPropagation(); handleRecompact(); }} 
          className="p-2 bg-slate-800/80 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-lg border border-slate-700 shadow-xl backdrop-blur-md transition-all group" 
          title="Recompact Graph (Pull to Center)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 15 6 6m-6-6v4.8m0-4.8h4.8M9 15l-6 6m6-6v4.8m0-4.8H4.2M15 9l6-6m-6 6V4.2m0 4.8h4.8M9 9 3 3m6 6V4.2m0 4.8H4.2"/></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleZoomToFit(); }} className="p-2 bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg border border-slate-700 shadow-xl backdrop-blur-md transition-all group" title="Zoom to Fit">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleZoomReadable(); }} className="p-2 bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg border border-slate-700 shadow-xl backdrop-blur-md transition-all font-bold text-xs" title="Readable Scale (1:1)">1:1</button>
      </div>
    </div>
  );
};

export default GraphView;
