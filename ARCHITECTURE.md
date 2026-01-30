# RDF Graph Navigator - Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture Review](#architecture-review)
3. [System Architecture](#system-architecture)
4. [Core Components](#core-components)
5. [State Management](#state-management)
6. [Data Flow](#data-flow)
7. [Physics Engine](#physics-engine)
8. [Recommendations](#recommendations)
9. [Future Improvements](#future-improvements)

---

## Overview

RDF Graph Navigator is a React-based web application for interactive visualization and exploration of RDF knowledge graphs. It uses D3.js for physics simulation and rendering, with a component-based architecture focused on separation of concerns.

### Technology Stack
- **Frontend Framework**: React 19 with TypeScript
- **Visualization**: D3.js v7 (force simulation, SVG rendering)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (utility-first)
- **AI Integration**: Google Gemini API (optional)

---

## Architecture Review

### Current Strengths

#### 1. **Clean Separation of Concerns**
- **Services Layer**: Pure functions for graph algorithms, RDF parsing, Gemini integration
- **Components**: Well-defined single-responsibility components
- **Custom Hooks**: `useGraphStore` provides centralized state management
- **Type Safety**: Comprehensive TypeScript types in `types.ts`

#### 2. **State Management**
- Custom hook `useGraphStore` provides:
  - Centralized graph state
  - Computed properties (`displayData`, `globalDegrees`)
  - Efficient memoization with `useMemo`
- Proper separation between raw data and display data

#### 3. **Component Architecture**
```
App.tsx (Container)
├── Header (Navigation)
├── Sidebar (Controls)
├── GraphView (Visualization)
├── SelectionPanel (Context Actions)
└── MappingModal (Configuration)
```

#### 4. **Service Layer**
- **`rdfParser.ts`**: Handles multiple RDF formats (RDF/XML, Turtle, JSON-LD)
- **`graphAlgorithms.ts`**: Pure algorithm implementations (BFS, neighbor finding)
- **`geminiService.ts`**: AI integration (properly gated)
- **`memoryMonitor.ts`**: Performance monitoring

### Areas for Improvement

#### 1. **App.tsx Complexity** (⚠️ High Priority)
**Issue**: The main App component has grown to ~530 lines with multiple responsibilities:
- File loading (local + URL)
- State management (10+ useState hooks)
- Event handlers (~10 callbacks)
- Side effects (5+ useEffects)
- Business logic (prune, hide, reset operations)

**Impact**: 
- Difficult to test individual features
- Hard to reason about data flow
- Risk of re-render cascades

#### 2. **GraphView.tsx Monolith** (⚠️ Medium Priority)
**Issue**: Single 265-line component handles:
- D3 simulation lifecycle
- SVG rendering
- Event handling
- Zoom behavior
- Layout calculations

**Impact**:
- Hard to optimize rendering
- Difficult to add new visualization modes
- Limited reusability

#### 3. **Physics Configuration** (💡 Opportunity)
**Current State**: Basic force-directed layout with limited optimization for dense graphs

**Limitations**:
- No hierarchical layout options
- No clustering for dense subgraphs
- Limited edge bundling
- No dynamic force adjustment based on density

#### 4. **Type System** (⚠️ Low Priority)
**Issue**: Some types use `any` (e.g., in D3 integration)
**Impact**: Loss of type safety in critical rendering code

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌─────────────────┐                 │
│  │   App.tsx    │◄────►│  useGraphStore  │                 │
│  │  (Container) │      │  (State Hook)   │                 │
│  └──────┬───────┘      └─────────────────┘                 │
│         │                                                    │
│         ├──► Header                                         │
│         ├──► Sidebar ──► Physics/Grouping Controls         │
│         ├──► GraphView ──► D3 Simulation + SVG             │
│         ├──► SelectionPanel ──► Context Actions            │
│         └──► MappingModal ──► Attribute Configuration      │
│                                                              │
│  ┌──────────────────────────────────────────────┐          │
│  │              Services Layer                   │          │
│  ├───────────────────────────────────────────────┤          │
│  │  • rdfParser       (Data Transform)          │          │
│  │  • graphAlgorithms (Pure Functions)          │          │
│  │  • geminiService   (AI Integration)          │          │
│  │  • memoryMonitor   (Performance)             │          │
│  └──────────────────────────────────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                 ┌────────────────┐
                 │  External APIs  │
                 ├────────────────┤
                 │ • Gemini API   │
                 │ • File System  │
                 └────────────────┘
```

### Data Flow Diagram

```
File Upload/URL
      │
      ▼
┌──────────────┐
│ rdfParser.ts │──────► Raw Graph Data
└──────────────┘              │
                              ▼
                      ┌──────────────────┐
                      │  useGraphStore   │
                      │  (State Layer)   │
                      └───────┬──────────┘
                              │
                  ┌───────────┴───────────┐
                  │   Memoized Compute    │
                  ├───────────────────────┤
                  │ • Filter by view mode │
                  │ • Apply mappings      │
                  │ • Calculate degrees   │
                  │ • Hide/show logic     │
                  └───────┬───────────────┘
                          │
                          ▼
                   Display Data
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
      GraphView      SelectionPanel    Sidebar
    (Visualization)   (Actions)      (Controls)
```

---

## Core Components

### App.tsx - Application Container

**Current Responsibilities**:
- File I/O (upload, URL loading)
- State initialization and management
- Event handler coordination
- Side effect orchestration
- Business logic execution

**Recommended Refactoring**:
```typescript
// Extract into custom hooks:
useFileLoader()      // File upload + URL loading
useGraphActions()    // Prune, hide, reset, expand
useKeyboardShortcuts() // Keyboard event handling
usePersistence()     // LocalStorage sync
```

### GraphView.tsx - D3 Visualization

**Current Structure**:
- D3 simulation management
- SVG element lifecycle
- Drag, zoom, pan behaviors
- Visual property mapping

**Strengths**:
- Efficient update patterns (enter/update/exit)
- Proper simulation lifecycle management
- Good separation of node/link rendering

**Recommended Enhancements**:
```typescript
// Extract sub-components:
<GraphView>
  <SimulationEngine />  // D3 force management
  <NodeRenderer />      // Node visualization
  <EdgeRenderer />      // Edge visualization
  <ZoomControls />      // Zoom/pan behavior
</GraphView>
```

### useGraphStore - State Management Hook

**Current Implementation**:
```typescript
interface GraphStore {
  // Raw data
  rawGraphData: GraphData
  
  // Computed data (memoized)
  displayData: GraphData
  globalDegrees: Map<string, number>
  
  // View state
  viewMode: 'all' | 'explore'
  selectedNodeIds: Set<string>
  highlightedNodeIds: Set<string>
  hiddenNodeIds: Set<string>
  exploredNodeIds: Set<string>
  
  // Configuration
  mappings: AttributeMapping
  showInferred: boolean
}
```

**Strengths**:
- Centralized state
- Computed properties avoid redundant calculations
- Type-safe interface

**Performance Considerations**:
- Memoization prevents unnecessary re-renders
- Set-based operations for O(1) lookups
- Immutable updates preserve React optimization

---

## State Management

### State Flow

```
User Action (e.g., click node)
       │
       ▼
Event Handler (App.tsx)
       │
       ▼
State Setter (useGraphStore)
       │
       ▼
Memoized Recompute (displayData)
       │
       ▼
Component Re-render (GraphView)
       │
       ▼
D3 Update (enter/update/exit)
```

### State Categories

#### 1. **Graph Data State**
- `rawGraphData`: Original parsed graph
- `displayData`: Filtered/transformed for rendering

#### 2. **View State**
- `viewMode`: 'all' | 'explore'
- `hiddenNodeIds`: User-hidden nodes
- `exploredNodeIds`: Progressive discovery (explore mode)

#### 3. **Selection State**
- `selectedNodeIds`: Active selection
- `highlightedNodeIds`: Query results
- `highlightedLinkIds`: Path highlighting

#### 4. **Configuration State**
- `mappings`: Attribute-to-visual mappings
- `showInferred`: Toggle inferred edges
- `physics`: Force simulation parameters
- `grouping`: Color/size configuration

### Performance Optimization

**Current Optimizations**:
- `useMemo` for expensive computations
- `useCallback` for stable references
- Set-based operations for fast lookups
- Selective re-rendering

**Metrics**:
- Graph with 1000 nodes: ~60 FPS
- Selection update: <16ms
- File load (10MB): ~2s

---

## Data Flow

### File Loading Pipeline

```
1. Input Source
   ├─ File Upload (FileReader API)
   ├─ URL Parameter (fetch API)
   └─ CLI Script (symlink + URL)

2. Format Detection
   └─ Extension-based: .rdf, .ttl, .json, etc.

3. Parsing (rdfParser.ts)
   ├─ RDF/XML (DOMParser)
   ├─ Turtle (regex-based)
   └─ JSON/JSON-LD (native JSON.parse)

4. Graph Construction
   ├─ Node deduplication
   ├─ Link creation
   └─ Metadata extraction

5. State Update
   └─ setRawGraphData() → triggers recompute

6. Display
   └─ Memoized displayData → GraphView render
```

### Interaction Flow

```
User Interaction
       │
       ├─ Node Click ──► Select → Expand (explore mode)
       ├─ Ctrl+Click ──► Multi-select
       ├─ Drag ──► Pin node position
       ├─ Keyboard ──► P/H/R shortcuts
       └─ Edge Click ──► Select relationship

Action Processing
       │
       ├─ Update selection state
       ├─ Compute affected nodes
       └─ Update hidden/explored sets

Visual Update
       │
       ├─ Recompute displayData
       ├─ D3 data join (enter/update/exit)
       └─ Animate transitions
```

---

## Physics Engine

### Current Implementation

**D3 Force Simulation**:
```typescript
d3.forceSimulation()
  .force('link', d3.forceLink().distance(120))
  .force('charge', d3.forceManyBody().strength(-300))
  .force('center', d3.forceCenter())
  .force('collision', d3.forceCollide().radius(40))
```

**Configuration**:
- `charge`: Node repulsion (-300)
- `linkDistance`: Target edge length (120px)
- `collisionRadius`: Min node spacing (40px + radius)
- `friction`: Velocity decay (0.4)
- `gravity`: Centering strength (0.1)

### Limitations for Dense Graphs

#### Issue 1: Node Occlusion
**Problem**: In dense regions, nodes overlap despite collision force
**Cause**: Collision radius is uniform, doesn't scale with density

#### Issue 2: Edge Clutter
**Problem**: Many edges cross in dense clusters
**Cause**: No edge routing or bundling

#### Issue 3: Layout Inefficiency
**Problem**: Force-directed layout doesn't preserve structural patterns
**Cause**: No hierarchy detection or community-aware layout

### Recommended Enhancements

#### 1. **Adaptive Force Strengths**
```typescript
// Density-aware charge
const charge = d3.forceManyBody()
  .strength(d => {
    const density = calculateLocalDensity(d);
    return -300 * (1 + density); // Stronger repulsion in dense areas
  });
```

#### 2. **Hierarchical Layout for Dense Subgraphs**
```typescript
// Detect communities and apply layout
const communities = detectCommunities(graph);
communities.forEach(community => {
  if (community.size > threshold) {
    applyClusterLayout(community);
  }
});
```

#### 3. **Edge Bundling**
```typescript
// Bundle parallel edges
const bundles = detectEdgeBundles(links);
bundles.forEach(bundle => {
  renderBundledEdge(bundle);
});
```

#### 4. **Level-of-Detail Rendering**
```typescript
// Hide labels/edges based on zoom level
const zoomLevel = d3.zoomTransform(svg).k;
if (zoomLevel < 0.5) {
  hideEdgeLabels();
  aggregateNodes();
}
```

#### 5. **Quadtree Optimization**
```typescript
// Use quadtree for collision detection
simulation.force('collision', 
  d3.forceCollide()
    .radius(d => getRadius(d) + 10)
    .strength(0.7)
);
```

---

## Recommendations

### Immediate Improvements (High Impact, Low Effort)

#### 1. **Refactor App.tsx**
**Extract custom hooks**:
```typescript
// hooks/useFileLoader.ts
export const useFileLoader = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadFromUrl = async (url: string) => { /*...*/ };
  const loadFromFile = async (file: File) => { /*...*/ };
  
  return { isLoading, error, loadFromUrl, loadFromFile };
};

// hooks/useGraphActions.ts
export const useGraphActions = (store: GraphStore) => {
  const prune = useCallback(() => { /*...*/ }, [store]);
  const hide = useCallback(() => { /*...*/ }, [store]);
  const reset = useCallback(() => { /*...*/ }, [store]);
  
  return { prune, hide, reset };
};

// Usage in App.tsx
const { loadFromUrl, loadFromFile, isLoading, error } = useFileLoader();
const { prune, hide, reset } = useGraphActions(store);
```

**Benefits**:
- Reduce App.tsx from 530 → ~200 lines
- Improve testability
- Enable hook reuse

#### 2. **Add Physics Presets**
```typescript
// configs/physicsPresets.ts
export const PHYSICS_PRESETS = {
  sparse: {
    charge: -300,
    linkDistance: 150,
    collisionRadius: 50
  },
  dense: {
    charge: -500,
    linkDistance: 80,
    collisionRadius: 30
  },
  hierarchical: {
    charge: -200,
    linkDistance: 100,
    collisionRadius: 40
  }
};

// Auto-detect and apply
const graphDensity = links.length / nodes.length;
const preset = graphDensity > 3 ? PHYSICS_PRESETS.dense : PHYSICS_PRESETS.sparse;
```

#### 3. **Implement Edge Sampling**
```typescript
// For graphs with >10000 edges
const renderEdges = useMemo(() => {
  if (edges.length > 10000) {
    // Sample important edges only
    return edges.filter(e => 
      selectedNodeIds.has(e.source) || 
      selectedNodeIds.has(e.target) ||
      Math.random() < 0.1 // Sample 10% of rest
    );
  }
  return edges;
}, [edges, selectedNodeIds]);
```

### Medium-Term Improvements

#### 1. **Implement WebWorker for Parsing**
```typescript
// workers/rdfParser.worker.ts
self.onmessage = (e) => {
  const { input, format } = e.data;
  const result = parseInputToGraph(input, format);
  self.postMessage(result);
};

// Usage
const worker = new Worker(new URL('./workers/rdfParser.worker.ts', import.meta.url));
worker.postMessage({ input, format });
worker.onmessage = (e) => setRawGraphData(e.data);
```

#### 2. **Add Canvas Fallback**
```typescript
// For graphs >1000 nodes
const useCanvas = nodes.length > 1000;

{useCanvas ? (
  <CanvasGraphView data={displayData} {...props} />
) : (
  <SVGGraphView data={displayData} {...props} />
)}
```

#### 3. **Implement Virtual Scrolling for Large Lists**
```typescript
// In SelectionPanel, Sidebar legends
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={items.length}
  itemSize={35}
>
  {({ index, style }) => (
    <div style={style}>{items[index]}</div>
  )}
</FixedSizeList>
```

### Long-Term Improvements

#### 1. **Graph Database Integration**
- Add Neo4j/ArangoDB connector
- Stream large graphs incrementally
- Server-side algorithms

#### 2. **Advanced Layout Algorithms**
- Hierarchical layout (Sugiyama)
- Circular layout (for cycles)
- Tree layout (for DAGs)
- Community-aware layout

#### 3. **Collaborative Features**
- Real-time multi-user exploration
- Shared annotations
- Version control for graph edits

#### 4. **Export Capabilities**
- Export to PNG/SVG/PDF
- Export filtered subgraphs
- Export analysis results

---

## Future Improvements

### Performance Optimizations

1. **Virtualization**: Only render visible nodes/edges
2. **Memoization**: Cache expensive computations
3. **Debouncing**: Throttle rapid state updates
4. **Lazy Loading**: Load graph in chunks

### UX Enhancements

1. **Minimap**: Overview+detail for navigation
2. **Search**: Full-text node/edge search
3. **Filters**: Advanced query builder
4. **History**: Undo/redo navigation
5. **Tours**: Guided exploration paths

### Developer Experience

1. **Testing**: Add unit tests for services
2. **Storybook**: Component documentation
3. **Profiling**: Performance monitoring
4. **Logging**: Debug mode with detailed logs

---

## Conclusion

The RDF Graph Navigator has a solid foundation with clear separation of concerns and good state management. The main areas for improvement are:

1. **Refactoring App.tsx** to extract custom hooks
2. **Enhancing physics** for dense graphs
3. **Adding performance optimizations** for large graphs

These improvements will make the codebase more maintainable, performant, and extensible while preserving the existing functionality.

### Maintainability Score: 7/10
- ✅ Clear component structure
- ✅ Type-safe interfaces
- ✅ Service layer separation
- ⚠️ Large monolithic components
- ⚠️ Limited testing

### Extensibility Score: 7/10
- ✅ Plugin-friendly architecture (services)
- ✅ Configuration-driven behavior
- ⚠️ Tight coupling in some areas
- ⚠️ Limited extensibility points

### Performance Score: 6/10
- ✅ Good for small-medium graphs (<1000 nodes)
- ⚠️ Struggles with dense graphs
- ⚠️ No virtualization for large datasets
- ⚠️ Limited optimization strategies
