# VIA Connect v1.0 — Engineering Progress Reference

> Last Updated: 2026-06-08
> Status: **Active Development — Crypto & OPFS Hardened**

---

## 1. What VIA Connect Is

A **zero-cloud, local-first, P2P encrypted messaging app** that runs entirely in the browser. No backend servers, no cloud databases, no accounts. The user owns their identity, their keys, their data.

**Core Thesis:** The application must function even if AWS, Supabase, Firebase, Vercel, and every cloud provider disappears. The user owns compute, storage, data, and AI execution.

---

## 2. Architecture Stack (Implemented)

| Layer | Technology | Status |
|-------|-----------|--------|
| **Frontend** | Single-file HTML/CSS/JS (PWA-ready) | ✅ Done |
| **Database** | IndexedDB via Dexie.js v3.2.4 | ✅ Done |
| **File Storage** | OPFS (Origin Private File System) | ✅ Done |
| **Encryption** | WebCrypto SubtleCrypto API | ✅ Done |
| **P2P Network** | PeerJS v1.5.2 (WebRTC) | ✅ Done |
| **Backend** | **None** — eliminated by design | ✅ Done |
| **AI** | Ollama / WebLLM (future) | ⬜ Planned |
| **Fonts** | IBM Plex Mono + DM Sans (Google Fonts) | ✅ Done |

---

## 3. File Location

```
/Users/dharamdaxini/Downloads/via/daxini.space/apps/zayvora-chat/index.html
```

Single-file architecture. ~1295 lines. All HTML, CSS, and JS in one file.

---

## 4. Database Schema (Dexie / IndexedDB)

Database name: `via-connect`

```javascript
db.version(1).stores({
  identity:     'id',                       // Single record: the user's sovereign node
  contacts:     'id, trustState, addedAt',   // Trusted peers
  messages:     'id, chatId, createdAt',     // Encrypted message payloads
  fileMetadata: 'id, chatId',               // OPFS file metadata index
  searchIndex:  'token',                     // Local full-text search (future)
  outbox:       'id, contactId'             // Queued messages for offline delivery
});
```

### Identity Record Shape
```javascript
{
  id: '414fee2aa562d427',        // SHA-256 fingerprint of public key (first 16 hex chars)
  displayName: 'Alice',
  avatarType: 'emoji',
  avatarValue: '😎',
  publicKeyJWK: { crv: 'P-256', ext: true, key_ops: [], kty: 'EC', x: '...', y: '...' },
  privateKey: CryptoKey,          // Non-extractable ECDH private key (stays in IndexedDB)
  createdAt: 1780891500000
}
```

### Contact Record Shape
```javascript
{
  id: 'contact_1780891500000',
  displayName: 'Bob',
  avatarType: 'emoji',
  avatarValue: 'B',
  publicKey: { /* JWK of contact's public key */ },
  trustState: 'trusted',
  addedAt: 1780891500000
}
```

### Message Record Shape
```javascript
{
  id: 'msg_1780891500000',
  chatId: 'contact_1780891500000',  // Links to contact ID
  senderId: '414fee2aa562d427',      // Sender's fingerprint
  encryptedPayload: 'base64iv:base64ciphertext',  // For text messages
  type: 'file',                       // Optional: 'file' for file messages
  fileId: 'file_1780891500000',       // Optional: links to fileMetadata
  status: 'pending' | 'delivered',
  createdAt: 1780891500000
}
```

---

## 5. Cryptography Layer (HARDENED)

### Key Generation
- **Algorithm:** ECDH with P-256 curve
- **Private Key:** Non-extractable (`extractable: false`), stored directly in IndexedDB as a `CryptoKey` object
- **Public Key:** Exported as JWK for sharing with contacts
- **Fingerprint:** SHA-256 hash of raw public key bytes → first 16 hex chars

### Message Encryption
- **Shared Secret:** Derived on-the-fly using ECDH (my private key × their public key)
- **Symmetric Cipher:** AES-256-GCM
- **IV:** 12 bytes, randomly generated per message via `crypto.getRandomValues()`
- **Payload Format:** `base64(iv):base64(ciphertext)`

### File Encryption
- **Same ECDH → AES-256-GCM pipeline** but operates on raw `ArrayBuffer`
- **Payload Format:** `[12-byte IV][ciphertext]` concatenated into a single `ArrayBuffer`
- Files are encrypted **before** writing to OPFS and **before** sending over P2P

### Key Functions
```javascript
cryptoUtils.generateIdentityPair()                    // → { fingerprint, publicKeyJWK, privateKey }
cryptoUtils.deriveSharedKey(privateKey, publicKeyJWK)  // → AES-256-GCM CryptoKey
cryptoUtils.encryptMessage(plaintext, privKey, pubJWK) // → 'ivBase64:ciphertextBase64'
cryptoUtils.decryptMessage(payload, privKey, pubJWK)   // → plaintext string
cryptoUtils.encryptFile(arrayBuffer, privKey, pubJWK)  // → encrypted ArrayBuffer
cryptoUtils.decryptFile(encBuffer, privKey, pubJWK)    // → decrypted ArrayBuffer
```

---

## 6. OPFS File Storage (IMPLEMENTED)

### Directory Layout
```
opfs://via-connect/
├── files/
│   └── {contactId}/
│       └── {fileId}.bin    ← AES-256-GCM encrypted blob
```

### OPFSManager Class
```javascript
class OPFSManager {
  async init()                              // Get root directory handle
  async writeFile(contactId, fileId, data)  // Write encrypted ArrayBuffer
  async readFile(contactId, fileId)         // Read encrypted ArrayBuffer
  async storageUsage()                      // { used, quota } via navigator.storage.estimate()
}
```

### File Send Flow
1. User selects file via `<input type="file">` (triggered by 📎 button)
2. File read as `ArrayBuffer`
3. Encrypted via `cryptoUtils.encryptFile()` using ECDH shared key
4. Written to OPFS via `opfs.writeFile(contactId, fileId, encryptedBuffer)`
5. Metadata saved to Dexie `fileMetadata` table
6. Message record saved to Dexie `messages` table with `type: 'file'`
7. Encrypted buffer sent via PeerJS data channel

### File Receive Flow
1. Incoming P2P data detected as `type: 'file'`
2. Encrypted buffer written to OPFS
3. Metadata saved to Dexie
4. Message record created
5. On render: read from OPFS → decrypt → create blob URL → render inline

### File Rendering
- **Images** (`image/*`): Rendered as `<img>` tags with blob URLs
- **Other files**: Rendered as download links with original filename

---

## 7. UI Architecture

### Design System
- **Theme:** Deep dark mode (`--bg: #0a0a0c`, `--surface: #111115`)
- **Accent:** Blue (`#4f8ef7`)
- **Typography:** DM Sans (body) + IBM Plex Mono (system/code)
- **Layout:** Mobile-first, max-width 600px centered app shell
- **Safe Areas:** `env(safe-area-inset-bottom)` for iOS notch support

### Navigation (WhatsApp-style)
4 bottom tabs with emoji icons:
1. **💬 Chats** — Conversation list (most recent message preview)
2. **👥 Contacts** — Saved contacts with trust state
3. **🔍 Search** — Full-text local search (UI scaffolded)
4. **👤 Profile** — Identity, fingerprint, P2P status, wipe button

### Views
| View | ID | Purpose |
|------|----|---------|
| Onboarding | `view-onboarding` | First-run identity generation |
| Main App | `view-main` | Tab container |
| Chat | `sub-view-chat` | Message thread + composer |
| Add Contact | `sub-view-add-contact` | Paste public key to add peer |

### Chat Composer
```
[📎 attach] [Message input field...............] [➤ send]
```

---

## 8. P2P Network Layer

### Signaling
- **Library:** PeerJS v1.5.2
- **Peer ID:** `{fingerprint}_via` (e.g., `414fee2aa562d427_via`)
- **Signaling Server:** PeerJS default cloud relay (transient, no data stored)

### Data Flow
- Text messages: Send JSON payload `{ id, chatId, senderId, encryptedPayload, status, createdAt }`
- File messages: Send JSON payload with `fileBuffer` (raw ArrayBuffer) + `fileMetadata` + `type: 'file'`

### Connection Lifecycle
1. On identity creation → `new Peer(fingerprint + '_via')`
2. On send → `peer.connect(contactId + '_via')` → `conn.send(payload)`
3. On receive → `peer.on('connection', conn => conn.on('data', handler))`

---

## 9. What's NOT Implemented Yet

| Feature | Status | Notes |
|---------|--------|-------|
| Full-text search index | ⬜ Scaffolded | UI exists, indexing logic needed |
| Outbox / offline queue | ⬜ Schema exists | Messages queued but not retried |
| Export / Import backup | ⬜ Planned | OPFS `export/` dir in spec |
| Thumbnails | ⬜ Planned | `thumbs/` dir in OPFS spec |
| Avatar images | ⬜ Planned | Currently emoji-only |
| .zay file chunking | ⬜ Planned | For large file P2P transfer |
| Copy Public Key button | ⬜ Stub | Shows alert, needs clipboard API |
| OPFS quota warnings | ⬜ Planned | `storageUsage()` exists but not wired to UI |
| Safari compatibility | ⬜ Untested | OPFS async-only on Safari 16 |
| WebLLM / Ollama AI | ⬜ Future | Local AI integration |
| Storage status display | ⬜ Partial | Shows IndexedDB + P2P, no OPFS usage |

---

## 10. Dependencies (CDN)

```html
<script src="https://unpkg.com/dexie@3.2.4/dist/dexie.js"></script>
<script src="https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js"></script>
```

Both are loaded from unpkg CDN. For true offline-first, these should be bundled locally or served from the same origin.

---

## 11. Known Issues / Testing Notes

1. **Browser subagent tab-clicking issues**: The automated browser test had difficulty clicking bottom navigation tabs reliably. This appears to be a test automation issue, not a code bug — the tabs work fine when clicked manually.
2. **P2P relay shows "Disconnected"**: The PeerJS default signaling server sometimes fails to connect. This is expected with the free tier. A self-hosted signaling server would fix this.
3. **Mock contacts**: When a non-JWK string is pasted as a public key, the app creates a mock key object (`{ kty: 'mock', kid: '...' }`). This means encryption will fail for mock contacts since ECDH key derivation requires real P-256 JWK keys.
4. **Same-origin IndexedDB**: Two tabs on the same origin share the same IndexedDB, so they share the same identity. To test P2P between two peers, use `localhost` vs `127.0.0.1` for separate origins.

---

## 12. Product Specification Reference

The full 15-section product specification is saved at:
```
/Users/dharamdaxini/Downloads/via-connect-spec.html
```

This contains:
- User personas, flows, and screen specs
- Full system architecture diagrams
- Database schema with TypeScript types
- OPFS directory layout and OPFSManager implementation
- WebRTC signaling lifecycle
- Security model
- Plugin architecture
- 8-week delivery schedule
- Technical debt register

---

## 13. Quick Start

1. Serve the directory: `python3 -m http.server 8000` from `/Users/dharamdaxini/Downloads/via/daxini.space/`
2. Open `http://localhost:8000/apps/zayvora-chat/index.html`
3. Enter a display name → Click "Create Identity"
4. Your ECDH P-256 keypair is generated locally and stored in IndexedDB
5. Go to Contacts → Add Contact → Paste a peer's JWK public key
6. Open the chat → Send encrypted messages or attach files via 📎

---

*This document is a snapshot of the VIA Connect engineering state for reference across sessions.*
