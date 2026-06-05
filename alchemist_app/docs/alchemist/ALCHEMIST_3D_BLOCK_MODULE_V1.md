# ALCHEMIST_3D_BLOCK_MODULE_V1

## Purpose
`3d-block.js` defines a lightweight, deterministic 3D block metadata handler for Alchemist sessions.

This module does **not** render models. Runtime/view layers handle rendering.

## Block Structure
```js
{
  type: '3d',
  model: 'path/to.stl',
  interaction: {
    rotate: true,
    zoom: true
  }
}
```

## Rules
- no rendering inside Alchemist
- only data definition
- STL models only (`.stl` extension)

## Public API

### `create3DBlock(id, model, interaction?)`
Returns normalized 3D block metadata:
```js
{
  id: 'block_id',
  type: '3d',
  model: 'models/example.stl',
  interaction: { rotate: true, zoom: true }
}
```

Validation:
- `id` must be a non-empty string
- `model` must be a non-empty `.stl` path
- `interaction` must be an object when provided

### `add3DBlockToSession(sessionEngine, block)`
Stores the validated 3D block in an active Alchemist session via `sessionEngine.addBlock(block)`.

## STL Loader Reference
This module intentionally stops at metadata. Rendering runtimes can map block metadata to a concrete STL loader (for example, `THREE.STLLoader`) in the viewer layer.

## Success Criteria
- 3D block created successfully ✅
- stored in session ✅
