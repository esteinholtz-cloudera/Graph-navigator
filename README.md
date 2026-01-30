<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# RDF Graph Navigator

An interactive web-based tool for exploring and visualizing RDF knowledge graphs with advanced navigation and analysis capabilities.

## Features

### Interactive Graph Exploration
- **Force-directed layout**: Physics-based graph visualization with customizable parameters
- **Dynamic filtering**: Show/hide nodes and isolate specific subgraphs
- **Neighborhood exploration**: Expand node connections progressively
- **Path finding**: Discover paths between nodes and common neighbors
- **Multi-select**: Work with multiple nodes simultaneously (Ctrl/Cmd + Click)

### Visualization & Navigation
- **Community detection**: Automatic grouping of related nodes
- **Color coding**: Visual distinction by node type or community
- **Node sizing**: Size nodes by connectivity or attributes
- **Zoom & pan**: Smooth navigation of large graphs
- **Search & filter**: Find specific nodes or relationships

### Graph Manipulation
- **Prune**: Remove leaf nodes to simplify view
- **Hide**: Conceal selected nodes and orphans
- **Reset/Isolate**: Focus on specific nodes and their neighborhoods
- **Expand**: Progressively reveal connected nodes

### Advanced Features
- **AI-powered analysis**: Semantic relationship analysis with Gemini (optional)
- **Attribute mapping**: Map graph attributes to visual properties (inferred edges, chunking, communities)
- **Multiple view modes**: "All" mode (full graph) vs "Explore" mode (progressive discovery)
- **Persistent state**: Save/load visualization configurations per file

### Supported File Formats

- **RDF/XML** (`.rdf`)
- **Turtle** (`.ttl`)
- **N-Triples** (`.nt`)
- **Notation3** (`.n3`)
- **OWL** (`.owl`)
- **JSON-LD** (`.json`, `.jsonld`)
- **Custom JSON** (triple arrays with optional metadata)

View your app in AI Studio: https://ai.studio/apps/drive/1c0hUOK01U1l3qfqaUiEE4-Ju2BroWGIl

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key (optional, set `USE_GEMINI=true` to enable)
3. Run the app:
   `npm run dev`

## Load Files via URL

You can open graph files directly via URL parameters:

### Quick Start with CLI Script
```bash
./open-graph.sh /path/to/your/file.rdf
```

### Manual Usage
1. Create a symlink: `ln -s /path/to/file.rdf public/data/file.rdf`
2. Open: `http://localhost:3000/?file=/data/file.rdf`

See [URL_FILE_LOADING.md](URL_FILE_LOADING.md) for detailed documentation and integration examples.

## Documentation

- **[URL_FILE_LOADING.md](URL_FILE_LOADING.md)** - Load files via URL parameters and CLI integration
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical architecture and implementation details (coming soon)

## Keyboard Shortcuts

- **P** - Prune leaf nodes from selection
- **H** - Hide selected nodes (and resulting orphans)
- **R** - Reset focus (isolate selection and neighbors)
- **Ctrl/Cmd + Click** - Multi-select nodes
