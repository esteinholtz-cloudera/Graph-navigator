<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

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
