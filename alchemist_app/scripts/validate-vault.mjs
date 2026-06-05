import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const vaultPath = path.join(root, 'MASTER_VAULT.json');
const raw = fs.readFileSync(vaultPath, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (error) {
  console.error(`MASTER_VAULT.json does not parse: ${error.message}`);
  process.exit(1);
}

const errors = [];
if (!Array.isArray(data)) errors.push('MASTER_VAULT.json must contain an array.');
const seen = new Map();
(data || []).forEach((item, index) => {
  if (!item || typeof item !== 'object') {
    errors.push(`Item ${index} is not an object.`);
    return;
  }
  const id = String(item.id || '').trim();
  const question = String(item.q || item.question || '').trim();
  const answer = String(item.correct || item.answer || item.u || '').trim();
  const trap = item.trap;
  if (!id) errors.push(`Item ${index} is missing id.`);
  if (id) {
    if (seen.has(id)) errors.push(`Duplicate id ${id} at indexes ${seen.get(id)} and ${index}.`);
    seen.set(id, index);
  }
  if (!question) errors.push(`Item ${id || index} is missing question text.`);
  if (!answer) errors.push(`Item ${id || index} is missing answer.`);
  if (typeof trap === 'number' || (typeof trap === 'string' && /^\d+$/.test(trap.trim()))) {
    errors.push(`Item ${id || index} has numeric-only trap.`);
  }
});

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`MASTER_VAULT validation passed (${data.length} items).`);
