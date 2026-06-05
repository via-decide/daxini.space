# MASTER_VAULT Format

`MASTER_VAULT.json` is the active chemistry question database for the shipped `index.html` app.

## Accepted raw fields

Each item should be an object with:

- `id` — stable unique question ID.
- `set` — source set or collection label.
- `dom` or `domain` — chemistry domain. If absent, exports use `Uncategorized`.
- `q` or `question` — question text.
- `correct`, `answer`, or `u` — correct answer text.
- `logic` or `explanation` — explanation. If absent, exports use `Logic unavailable.`.
- `l` / `r` — alternative answers used by the swipe UI.
- `hint` — short learning hint.
- `trap` — misconception text. Numeric-only traps are invalid.
- `topic` — optional concept/topic override.

## Normalized output shape

`kernel/alchemist/session-normalizer.js` maps raw items into:

```js
{
  id,
  set,
  domain,
  topic,
  question,
  answer,
  logic,
  hint,
  trap
}
```

Rules:

- `domain = dom || domain || "Uncategorized"`.
- `question = q || question || ""`.
- `answer = correct || answer || u || ""`.
- `logic` defaults to `Logic unavailable.`.
- `topic = topic || meaningful trap || hint || domain`.
- Numeric-only `trap` values are ignored as topics and fail vault validation.

## Validation

Run:

```bash
npm run validate:vault
```

The validator checks JSON parsing, IDs, question text, answer text, duplicate IDs, and numeric-only traps.
