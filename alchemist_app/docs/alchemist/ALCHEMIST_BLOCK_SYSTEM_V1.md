# ALCHEMIST_BLOCK_SYSTEM_V1

## Purpose
`block-system.js` converts all user input into deterministic, typed content blocks and rejects untyped or invalid data.

## Block Types
- `text`
- `link`
- `note`
- `3d` (STL)

## Public API

### `createBlock(type, content)`
Factory method that always returns a structured block:
```js
{ type: 'text' | 'link' | 'note' | '3d', content: { ...typed content... } }
```

Validation is enforced during creation:
- Unsupported block types are rejected.
- Raw/untyped content is rejected.
- Per-type shape is required:
  - `text`/`note`: `{ value: string }`
  - `link`: `{ href: string, label?: string }`
  - `3d`: `{ format: 'stl', source: string, units?: string }`

### `validateBlock(block)`
Returns `true` only when the block is already valid and normalized for its declared type.
Returns `false` for:
- missing/invalid `type`
- unsupported `type`
- invalid `content` structure
- untyped content objects

## Rules Enforced
- Every input must be converted via `createBlock(type, content)`.
- No untyped content is accepted.
- Invalid blocks are rejected deterministically.
- All accepted inputs become reusable structured blocks.

## Success Criteria Mapping
- All inputs become structured blocks ✅
- Invalid blocks rejected ✅
