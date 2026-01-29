# URL File Loading Feature

## Overview

The RDF Graph Navigator now supports loading files via URL parameters, enabling CLI integration and automated workflows.

## How It Works

### 1. URL Parameter
Add a `?file=` parameter to the URL:
```
http://localhost:3000/?file=/data/yourfile.rdf
```

### 2. File Location
Files must be accessible from the web server. The recommended approach is to use symlinks in the `public/data/` directory.

### 3. Symlinks
The `public/data/` directory is gitignored and used for symlinked files:
```bash
ln -s /absolute/path/to/your/file.rdf public/data/file.rdf
```

## Usage

### Manual Usage
1. Create a symlink:
   ```bash
   ln -s /path/to/your/file.rdf public/data/myfile.rdf
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```

3. Open with URL parameter:
   ```
   http://localhost:3000/?file=/data/myfile.rdf
   ```

### CLI Script Usage
Use the provided `open-graph.sh` script:

```bash
# Make it executable (first time only)
chmod +x open-graph.sh

# Open any file
./open-graph.sh /path/to/your/file.rdf
```

The script will:
- Create a symlink in `public/data/`
- Handle existing symlinks intelligently:
  - ✅ If symlink already points to the same file → passes silently
  - ❌ If symlink points to different file → shows error with instructions
  - ❌ If regular file exists with same name → shows error
- Check if the server is running
- Open the browser with the correct URL

### Example
```bash
./open-graph.sh ~/Documents/ontology.ttl
# Opens: http://localhost:3000/?file=/data/ontology.ttl
```

## Supported File Types

All RDF and graph formats:
- `.rdf` - RDF/XML
- `.ttl` - Turtle
- `.nt` - N-Triples
- `.n3` - Notation3
- `.owl` - OWL
- `.json` - JSON-LD
- `.jsonld` - JSON-LD

## Features

### Loading State
When loading a file via URL parameter:
- Full-screen loading spinner appears
- "Loading file..." message shown
- UI is blocked until file loads

### Error Handling
If the file fails to load:
- Error notification appears at the top of the screen
- Shows the specific error message
- Can be dismissed by clicking the X button
- Errors are logged to the console

### File Format Detection
The file format is automatically detected based on the file extension:
- `.json` and `.jsonld` → JSON format
- All others → RDF format

## Integration Examples

### Shell Script Integration
```bash
#!/bin/bash
GRAPH_FILE="/path/to/data.rdf"
ln -s "$GRAPH_FILE" public/data/data.rdf
open "http://localhost:3000/?file=/data/data.rdf"
```

### Python Integration
```python
import subprocess
import urllib.parse

def open_graph(file_path):
    file_name = os.path.basename(file_path)
    symlink_path = f"public/data/{file_name}"
    
    # Create symlink
    os.symlink(file_path, symlink_path)
    
    # Open browser
    url = f"http://localhost:3000/?file=/data/{urllib.parse.quote(file_name)}"
    subprocess.run(["open", url])  # macOS
```

### Node.js Integration
```javascript
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function openGraph(filePath) {
  const fileName = path.basename(filePath);
  const symlinkPath = `public/data/${fileName}`;
  
  // Create symlink
  fs.symlinkSync(filePath, symlinkPath);
  
  // Open browser
  const url = `http://localhost:3000/?file=/data/${encodeURIComponent(fileName)}`;
  exec(`open "${url}"`); // macOS
}
```

## Implementation Details

### Files Modified
1. **App.tsx**
   - Added `isLoadingFile` and `fileLoadError` state
   - Added `useEffect` to parse URL parameters on mount
   - Added `loadFileFromServer()` function to fetch files
   - Added loading overlay and error notification UI

2. **.gitignore**
   - Added `public/data` to prevent committing symlinks

3. **public/data/**
   - Created directory for symlinked files

### Code Flow
1. On app mount, check for `?file=` URL parameter
2. If found, call `loadFileFromServer(path)`
3. Show loading spinner
4. Fetch file content from server
5. Parse file extension to determine format
6. Update app state with file content
7. Hide loading spinner
8. If error, show error notification

## Troubleshooting

### "Failed to load file: 404"
- File doesn't exist in `public/data/`
- Check symlink: `ls -la public/data/`
- Verify symlink target exists

### "Connection refused"
- Dev server not running
- Start with: `npm run dev`

### "CORS error"
- Not applicable for same-origin files
- All files in `public/data/` are same-origin

### Symlink conflicts
- **"Symlink already exists but points to a different file"**
  - Remove the old symlink: `rm public/data/filename.rdf`
  - Run the script again
- **"A regular file already exists"**
  - A non-symlink file exists with that name
  - Remove or rename: `rm public/data/filename.rdf`

### Symlink not working
- Check permissions: `ls -l public/data/`
- Verify target exists: `ls -l $(readlink public/data/file.rdf)`

## Security Considerations

- Files must be explicitly symlinked into `public/data/`
- No arbitrary filesystem access from browser
- Server only serves files from `public/` directory
- Symlinks are gitignored to prevent accidental commits

## Future Enhancements

Potential improvements:
- Support for multiple files: `?file=/data/file1.rdf,/data/file2.rdf`
- Auto-cleanup of old symlinks
- File watching and auto-reload
- Direct filesystem integration (desktop app)
