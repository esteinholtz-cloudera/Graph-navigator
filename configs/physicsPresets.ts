import { PhysicsConfig } from '../types';

export interface PhysicsPreset {
  name: string;
  description: string;
  config: PhysicsConfig;
}

export const PHYSICS_PRESETS: Record<string, PhysicsPreset> = {
  balanced: {
    name: 'Balanced',
    description: 'Good for most graphs',
    config: {
      charge: -300,
      linkDistance: 120,
      collisionRadius: 40,
      centering: true,
      disentangleFactor: 0.5,
      enableDisentangle: true,
      friction: 0.4,
      gravity: 0.1,
      dimmingOpacity: 0.7,
      autoFreeze: true,
      isPhysicsEnabled: true,
      stabilizationThreshold: 0.01
    }
  },
  
  sparse: {
    name: 'Sparse',
    description: 'For graphs with few connections',
    config: {
      charge: -200,
      linkDistance: 150,
      collisionRadius: 50,
      centering: true,
      disentangleFactor: 0.3,
      enableDisentangle: true,
      friction: 0.3,
      gravity: 0.15,
      dimmingOpacity: 0.7,
      autoFreeze: true,
      isPhysicsEnabled: true,
      stabilizationThreshold: 0.01
    }
  },
  
  dense: {
    name: 'Dense',
    description: 'For highly connected graphs',
    config: {
      charge: -500,
      linkDistance: 80,
      collisionRadius: 30,
      centering: true,
      disentangleFactor: 0.7,
      enableDisentangle: true,
      friction: 0.5,
      gravity: 0.05,
      dimmingOpacity: 0.7,
      autoFreeze: true,
      isPhysicsEnabled: true,
      stabilizationThreshold: 0.015
    }
  },
  
  tight: {
    name: 'Tight',
    description: 'Compact layout for large graphs',
    config: {
      charge: -400,
      linkDistance: 60,
      collisionRadius: 25,
      centering: true,
      disentangleFactor: 0.8,
      enableDisentangle: true,
      friction: 0.6,
      gravity: 0.2,
      dimmingOpacity: 0.7,
      autoFreeze: true,
      isPhysicsEnabled: true,
      stabilizationThreshold: 0.02
    }
  },
  
  relaxed: {
    name: 'Relaxed',
    description: 'Spread out layout',
    config: {
      charge: -150,
      linkDistance: 180,
      collisionRadius: 60,
      centering: true,
      disentangleFactor: 0.2,
      enableDisentangle: true,
      friction: 0.25,
      gravity: 0.08,
      dimmingOpacity: 0.7,
      autoFreeze: true,
      isPhysicsEnabled: true,
      stabilizationThreshold: 0.008
    }
  }
};

/**
 * Auto-detect appropriate physics preset based on graph characteristics
 */
export const detectOptimalPreset = (nodeCount: number, edgeCount: number): string => {
  if (nodeCount === 0) return 'balanced';
  
  const avgDegree = (edgeCount * 2) / nodeCount;
  
  // Dense graph: average degree > 5
  if (avgDegree > 5) return 'dense';
  
  // Sparse graph: average degree < 2
  if (avgDegree < 2) return 'sparse';
  
  // Large graph: tighten layout
  if (nodeCount > 500) return 'tight';
  
  // Small sparse graph: relax
  if (nodeCount < 50 && avgDegree < 3) return 'relaxed';
  
  // Default
  return 'balanced';
};
