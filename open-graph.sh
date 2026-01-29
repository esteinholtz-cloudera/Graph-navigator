#!/bin/bash

# open-graph.sh - CLI tool to open RDF/graph files in the navigator
# Usage: ./open-graph.sh /path/to/your/file.rdf

set -e

# Configuration
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PUBLIC_DATA_DIR="$PROJECT_DIR/public/data"
SERVER_URL="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if file path was provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No file path provided${NC}"
    echo "Usage: $0 /path/to/file.rdf"
    exit 1
fi

FILE_PATH="$1"

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    echo -e "${RED}Error: File not found: $FILE_PATH${NC}"
    exit 1
fi

# Get absolute path
ABS_FILE_PATH="$(cd "$(dirname "$FILE_PATH")" && pwd)/$(basename "$FILE_PATH")"
FILE_NAME="$(basename "$FILE_PATH")"

echo -e "${GREEN}Opening graph file: $FILE_NAME${NC}"

# Create public/data directory if it doesn't exist
mkdir -p "$PUBLIC_DATA_DIR"

# Create or update symlink
SYMLINK_PATH="$PUBLIC_DATA_DIR/$FILE_NAME"

if [ -L "$SYMLINK_PATH" ]; then
    # Symlink exists, check if it points to the same target
    EXISTING_TARGET="$(readlink "$SYMLINK_PATH")"
    
    if [ "$EXISTING_TARGET" = "$ABS_FILE_PATH" ]; then
        # Same target, no action needed
        echo -e "${GREEN}Symlink already exists and points to correct file${NC}"
        echo -e "${GREEN}$SYMLINK_PATH -> $ABS_FILE_PATH${NC}"
    else
        # Different target, show error
        echo -e "${RED}Error: Symlink already exists but points to a different file${NC}"
        echo -e "${YELLOW}Existing: $SYMLINK_PATH -> $EXISTING_TARGET${NC}"
        echo -e "${YELLOW}Requested: $ABS_FILE_PATH${NC}"
        echo ""
        echo -e "${YELLOW}To replace it, remove the existing symlink first:${NC}"
        echo -e "  rm \"$SYMLINK_PATH\""
        exit 1
    fi
elif [ -e "$SYMLINK_PATH" ]; then
    # File exists but is not a symlink
    echo -e "${RED}Error: A regular file already exists at $SYMLINK_PATH${NC}"
    echo -e "${YELLOW}Please remove or rename it first${NC}"
    exit 1
else
    # No symlink exists, create it
    ln -s "$ABS_FILE_PATH" "$SYMLINK_PATH"
    echo -e "${GREEN}Created symlink: $SYMLINK_PATH -> $ABS_FILE_PATH${NC}"
fi

# Construct URL
URL="$SERVER_URL?file=/data/$FILE_NAME"

# Check if server is running
if ! curl -s "$SERVER_URL" > /dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Server doesn't appear to be running on $SERVER_URL${NC}"
    echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
    echo ""
    echo -e "Then open: ${GREEN}$URL${NC}"
    exit 0
fi

# Open in browser
echo -e "${GREEN}Opening in browser: $URL${NC}"

# Detect OS and open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open "$URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open "$URL" 2>/dev/null || firefox "$URL" || chrome "$URL"
else
    echo -e "${YELLOW}Please open this URL manually: $URL${NC}"
fi

echo -e "${GREEN}Done!${NC}"
