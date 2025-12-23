
import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
  group?: string;
  color?: string;
  metadata?: Record<string, any>;
  chunk?: string;
  community?: string;
  // Simulation properties for D3
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  uri?: string; // Original full predicate URI
  metadata?: Record<string, any>;
  isInferred?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  extraAttributes: string[];
}

export type MappingTarget = 'Inferred' | 'chunk' | 'Community' | 'None';

export interface AttributeMapping {
  [key: string]: MappingTarget;
}

export interface PhysicsConfig {
  charge: number;
  linkDistance: number;
  collisionRadius: number;
  centering: boolean;
  disentangleFactor: number;
  friction: number; // velocityDecay
  gravity: number;  // centering force strength
  dimmingOpacity: number; // For non-highlighted parts
}

export interface GroupingConfig {
  byType: boolean;
  palette: string[];
  connectivityEnlargement: number;
  showNamespaces: boolean;
}
