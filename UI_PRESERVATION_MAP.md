# UI Preservation Map

## KEEP: `index.html` shell

The `index.html` shell is classified as KEEP. Preserve these stable UI responsibilities during integration work:

- onboarding redirect in the initial inline script
- `.eco-bar` navigation
- `.spatial-os`
- `.matrix-viewport`
- `.matrix-grid`
- `.app-overlay`
- `.console-terminal`
- `#os-minimap`
- `#launch-bar`
- keyboard/touch handlers near the bottom inline script

Zayvora backend/runtime integration must not redesign or rebuild these UI elements.
