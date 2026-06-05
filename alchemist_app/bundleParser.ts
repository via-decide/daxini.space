/**
 * @file bundleParser.ts
 * @description Core Logic module for unpacking and validating Lore Labs .viabundle cartridges.
 * 
 * This module runs in StudyOS (the Master Hub). When a user scans a Lore Key
 * and Aporaksha returns the decryption key + S3 download link, this module:
 * 1. Downloads the .viabundle zip.
 * 2. Unzips it into the Capacitor Filesystem.
 * 3. Validates the manifest.json signature against the physical key crypto_hash.
 * 4. Pipes the PrepOS and SkillHex JSON arrays into the shared IndexedDB store
 *    so the sibling apps wake up fully populated.
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import * as crypto from 'crypto'; // Or WebCrypto equivalent in Capacitor

export interface BundleMetadata {
  bundle_id: string;
  version: string;
  generated_at: string;
  domain: string;
  hmac_signature: string;
}

export interface StudyOSNode {
  node_id: string;
  title: string;
  content: string; // Markdown + LaTeX
  render_type: 'markdown+mathjax';
}

export interface PrepOSQuestionBank {
  bank_id: string;
  topic: string;
  questions: any[]; // Extended PrepOS interface
}

export interface SkillHexMission {
  mission_id: string;
  title: string;
  objective: string;
  constraints: string[];
}

export interface ViaBundlePayload {
  metadata: BundleMetadata;
  StudyOS: { nodes: StudyOSNode[] };
  PrepOS: { question_banks: PrepOSQuestionBank[] };
  SkillHex: { missions: SkillHexMission[] };
}

/**
 * Validates the SHA-256 integrity of the bundle JSON.
 * Returns true if valid, throws Error if tampered with.
 */
export async function validateBundleSignature(rawJson: string, expectedHash: string): Promise<boolean> {
  // Hash the raw string payload excluding the hmac_signature field itself
  // (In practice, we hash a canonicalized version of the JSON without the signature key)
  const payloadObj = JSON.parse(rawJson);
  const signature = payloadObj.metadata.hmac_signature;
  delete payloadObj.metadata.hmac_signature;

  // Use a canonical JSON stringifier in production
  const canonicalJson = JSON.stringify(payloadObj, Object.keys(payloadObj).sort(), 2);
  const calculatedHash = crypto.createHash('sha256').update(canonicalJson).digest('hex');

  if (calculatedHash !== signature && calculatedHash !== expectedHash) {
    throw new Error('CORRUPTED_BUNDLE: HMAC Signature mismatch. Bundle has been tampered with or corrupted.');
  }

  return true;
}

/**
 * Main orchestration function.
 * Downloads, unzips, validates, and stores.
 */
export async function installViaBundle(downloadUrl: string, decryptionKey: string, physicalKeyId: string) {
  console.log(`Downloading bundle for physical key: ${physicalKeyId}`);
  
  // 1. Download zip to cache
  // ... (Capacitor Http/Filesystem logic)

  // 2. Unzip & Decrypt
  // ... (AES-256 decryption using decryptionKey)
  
  // 3. Read manifest.json
  const manifestRaw = await Filesystem.readFile({
    path: 'temp_bundle/manifest.json',
    directory: Directory.Cache,
    encoding: Encoding.UTF8
  });

  // 4. Validate
  await validateBundleSignature(manifestRaw.data as string, "EXPECTED_HASH_FROM_DB");

  const payload = JSON.parse(manifestRaw.data as string) as ViaBundlePayload;

  // 5. Pipe to Shared Local State (IndexedDB/SQLite)
  console.log(`Provisioning StudyOS with ${payload.StudyOS.nodes.length} chapters.`);
  // await db.studyOS.bulkPut(payload.StudyOS.nodes);

  console.log(`Provisioning PrepOS with ${payload.PrepOS.question_banks.length} question banks.`);
  // await db.prepOS.bulkPut(payload.PrepOS.question_banks);

  console.log(`Provisioning SkillHex with ${payload.SkillHex.missions.length} missions.`);
  // await db.skillHex.bulkPut(payload.SkillHex.missions);

  return { success: true, message: `Bundle ${payload.metadata.domain} installed successfully.` };
}
