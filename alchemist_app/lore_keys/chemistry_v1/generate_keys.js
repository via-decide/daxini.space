const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BATCH_SIZE = 50;
const BUNDLE_ID = 'chem-os-v1';
const BATCH_NUMBER = 1;
const OUTPUT_SQL = path.join(__dirname, 'aporaksha_insert.sql');
const OUTPUT_JSON = path.join(__dirname, 'qr_code_payloads.json');

console.log(`🔑 Generating ${BATCH_SIZE} physical keys for ${BUNDLE_ID}...`);

let sqlStatements = `-- Aporaksha DB Initialization for Lore Key Batch ${BATCH_NUMBER}\n`;
sqlStatements += `-- Bundle: ${BUNDLE_ID}\n\n`;
sqlStatements += `INSERT INTO physical_keys (key_id, bundle_id, batch_number, status, crypto_hash) VALUES\n`;

const qrPayloads = [];

for (let i = 0; i < BATCH_SIZE; i++) {
  // Generate a random 12-byte hex string (24 chars) + prefix
  const rawId = crypto.randomBytes(12).toString('hex');
  const keyId = `LK_${rawId}`;
  
  // Generate a SHA-256 hash to store in DB (prevents ID guessing)
  const cryptoHash = crypto.createHash('sha256').update(keyId).digest('hex');
  
  // The URL that will be encoded into the physical QR code sticker
  const qrUrl = `https://via.decide/activate?k=${keyId}`;
  
  qrPayloads.push({
    item_number: i + 1,
    key_id: keyId,
    qr_url: qrUrl
  });

  const isLast = i === BATCH_SIZE - 1;
  sqlStatements += `  ('${keyId}', '${BUNDLE_ID}', ${BATCH_NUMBER}, 'unactivated', '${cryptoHash}')${isLast ? ';' : ','}\n`;
}

// Write the SQL file for Aporaksha Postgres
fs.writeFileSync(OUTPUT_SQL, sqlStatements, 'utf8');

// Write the JSON payload for the Dymo/Brother QR Code label printer
fs.writeFileSync(OUTPUT_JSON, JSON.stringify(qrPayloads, null, 2), 'utf8');

console.log('✅ Generation Complete!');
console.log(`💾 SQL seed file created at: ${OUTPUT_SQL}`);
console.log(`🖨️ QR Label printer JSON created at: ${OUTPUT_JSON}`);
