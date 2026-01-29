---
name: Gate Gemini with USE_GEMINI
overview: Separate Gemini API calls and UI controls behind a USE_GEMINI environment variable, allowing the app to run without Gemini when disabled.
todos:
  - id: "1"
    content: Update vite.config.ts to expose USE_GEMINI environment variable
    status: completed
  - id: "2"
    content: Modify geminiService.ts to check USE_GEMINI before making API calls
    status: completed
  - id: "3"
    content: Update App.tsx to check USE_GEMINI and conditionally enable Gemini features
    status: completed
  - id: "4"
    content: Update SelectionPanel.tsx to conditionally render the Analyze button based on USE_GEMINI
    status: completed
isProject: false
---

# Gate Gemini Functionality Behind USE_GEMINI Environment Variable

## Overview

Wrap all Gemini API calls and related UI elements with a `USE_GEMINI` environment variable check, allowing the application to run without Gemini functionality when disabled.

## Files to Modify

### 1. `vite.config.ts`

- Add `USE_GEMINI` to the environment variable definitions
- Expose it as `process.env.USE_GEMINI` for use in the application

### 2. `services/geminiService.ts`

- Add a check at the top of both functions (`analyzeRelationship` and `analyzeGroupSemantics`) to return early with a fallback message if `USE_GEMINI` is not enabled
- This prevents any API calls when Gemini is disabled

### 3. `App.tsx`

- Import and check `USE_GEMINI` environment variable
- Conditionally pass a flag to `SelectionPanel` indicating whether Gemini is enabled
- Optionally modify `handleAiAnalysis` to return early if Gemini is disabled

### 4. `components/SelectionPanel.tsx`

- Add a prop to indicate if Gemini is enabled
- Conditionally render the "Analyze with Gemini" button only when Gemini is enabled

## Implementation Details

- The `USE_GEMINI` environment variable should be read from `.env.local` (similar to `GEMINI_API_KEY`)
- When disabled, the Gemini analysis button will be hidden from the UI
- The service functions will return early with a message indicating Gemini is disabled (defensive programming)
- No breaking changes to existing functionality when `USE_GEMINI` is enabled (default behavior preserved)

## Environment Variable

Users will need to set `USE_GEMINI=true` in their `.env.local` file to enable Gemini functionality. When not set or set to `false`, all Gemini features will be disabled.

## Implementation Summary

### 1. `vite.config.ts` - Environment Variable Exposure

**Changes made:**

- Added `'process.env.USE_GEMINI': JSON.stringify(env.USE_GEMINI)` to the `define` object
- This exposes the `USE_GEMINI` environment variable from `.env.local` to the application code

**Code added:**

```typescript
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.USE_GEMINI': JSON.stringify(env.USE_GEMINI)  // Added
}
```

### 2. `services/geminiService.ts` - Service-Level Gating

**Changes made:**

- Added early return checks at the start of both `analyzeRelationship` and `analyzeGroupSemantics` functions
- Both functions now check `if (process.env.USE_GEMINI !== 'true')` and return a disabled message before any API calls

**Code added to both functions:**

```typescript
if (process.env.USE_GEMINI !== 'true') {
  return "Gemini analysis is disabled. Set USE_GEMINI=true to enable.";
}
```

This provides defensive programming - even if the UI allows the call, the service will not make API requests when disabled.

### 3. `App.tsx` - Application-Level Control

**Changes made:**

- Added constant: `const USE_GEMINI = process.env.USE_GEMINI === 'true';` at the top of the file
- Modified `handleAiAnalysis` function to return early if `USE_GEMINI` is false
- Passed `useGemini={USE_GEMINI}` prop to `SelectionPanel` component

**Code added:**

```typescript
const USE_GEMINI = process.env.USE_GEMINI === 'true';

const handleAiAnalysis = async () => {
  if (!USE_GEMINI) {
    setAiAnalysis("Gemini analysis is disabled. Set USE_GEMINI=true to enable.");
    return;
  }
  // ... rest of function
};

// In JSX:
<SelectionPanel 
  // ... other props
  useGemini={USE_GEMINI}
/>
```

### 4. `components/SelectionPanel.tsx` - UI-Level Gating

**Changes made:**

- Added `useGemini: boolean` to the `SelectionPanelProps` interface
- Added `useGemini` to the component's destructured props
- Wrapped the "Analyze with Gemini" button in a conditional: `{useGemini && (...)}`

**Code added:**

```typescript
interface SelectionPanelProps {
  // ... existing props
  useGemini: boolean;  // Added
}

const SelectionPanel: React.FC<SelectionPanelProps> = ({
  // ... existing props
  useGemini,  // Added
}) => {
  // ...
  {useGemini && (  // Conditional rendering
    <button onClick={onAnalyze}>
      Analyze with Gemini
    </button>
  )}
}
```

## Behavior

### When `USE_GEMINI` is NOT set or is `false`:

- ✅ "Analyze with Gemini" button is **hidden** from the UI
- ✅ Service functions return early without making API calls
- ✅ Application runs normally without Gemini functionality
- ✅ No errors or warnings

### When `USE_GEMINI=true` in `.env.local`:

- ✅ "Analyze with Gemini" button is **visible** in the UI
- ✅ Service functions make API calls normally
- ✅ All Gemini functionality works as before
- ✅ Backward compatible with existing behavior

## Testing

1. **Test with Gemini disabled (default):**
  - Ensure `USE_GEMINI` is not set in `.env.local`
  - Start dev server: `npm run dev`
  - Verify "Analyze with Gemini" button does not appear in SelectionPanel
  - Application should function normally for all non-Gemini features
2. **Test with Gemini enabled:**
  - Add `USE_GEMINI=true` to `.env.local`
  - Restart dev server
  - Verify "Analyze with Gemini" button appears in SelectionPanel
  - Click button and verify API calls work correctly

## Files Modified

1. `vite.config.ts` - Added USE_GEMINI to environment variable definitions
2. `services/geminiService.ts` - Added early return checks in both functions
3. `App.tsx` - Added USE_GEMINI constant and conditional logic
4. `components/SelectionPanel.tsx` - Added conditional rendering of Gemini button

## Notes

- The implementation uses a three-layer defense:
  1. **UI Layer**: Button hidden when disabled
  2. **Application Layer**: Handler returns early when disabled
  3. **Service Layer**: Functions return early when disabled (defensive)
- This ensures Gemini functionality is completely disabled when `USE_GEMINI` is not set
- No breaking changes - existing functionality preserved when enabled
- Environment variable must be set to the string `'true'` (case-sensitive)

