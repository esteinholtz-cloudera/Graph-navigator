
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
  error?: string; // New field for reporting parsing issues
}

export type MappingTarget = 'Inferred' | 'chunk' | 'Community' | 'None';

export interface AttributeMapping {
  [key: string]: MappingTarget;
}

export interface EdgeStyle {
  color: string;
  width: number;
  opacity: number;
  arrowSize: number;
}

export interface EdgeConfig {
  explicit: EdgeStyle;
  inferred: EdgeStyle;
}

export interface PhysicsConfig {
  charge: number;
  linkDistance: number;
  collisionRadius: number;
  centering: boolean;
  disentangleFactor: number;
  enableDisentangle: boolean;
  friction: number; // velocityDecay
  gravity: number;  // centering force strength
  dimmingOpacity: number; // For non-highlighted parts
  autoFreeze: boolean; // Stop simulation when alpha is low
  isPhysicsEnabled: boolean; // Manual kill switch
  stabilizationThreshold: number; // Alpha value at which to stop
}

export interface GroupingConfig {
  groupBy: 'type' | 'community' | 'none';
  palette: string[];
  connectivityEnlargement: number;
  showNamespaces: boolean;
}
