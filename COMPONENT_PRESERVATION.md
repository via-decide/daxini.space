# Component Preservation

## KEEP: current `index.html` shell

The current `index.html` shell is a preserved component boundary. Stable responsibilities include:

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
