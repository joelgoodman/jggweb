// Deletes expired newsletter signup tokens from Bunny Object Storage.
//
// scripts/edge/newsletter-signup.js writes a token file per signup attempt
// under newsletter-tokens/ and only deletes it once the recipient confirms.
// Abandoned/expired signups (the token's `expiresAt` has passed) are never
// cleaned up by the edge script itself, so this runs on a schedule instead
// (see .github/workflows/cleanup-newsletter-tokens.yml).

import dotenv from 'dotenv';

dotenv.config();

const STORAGE_HOST = 'storage.bunnycdn.com';
const TOKEN_PREFIX = 'newsletter-tokens/';

function storageUrl(storageZone, path) {
  return `https://${STORAGE_HOST}/${storageZone}/${path}`;
}

async function listTokenFiles(storageZone, apiKey) {
  const res = await fetch(storageUrl(storageZone, TOKEN_PREFIX), {
    headers: { AccessKey: apiKey },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`List failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function readTokenFile(storageZone, apiKey, objectName) {
  const res = await fetch(storageUrl(storageZone, `${TOKEN_PREFIX}${objectName}`), {
    headers: { AccessKey: apiKey },
  });
  if (!res.ok) return null;
  return res.json();
}

async function deleteTokenFile(storageZone, apiKey, objectName) {
  const res = await fetch(storageUrl(storageZone, `${TOKEN_PREFIX}${objectName}`), {
    method: 'DELETE',
    headers: { AccessKey: apiKey },
  });
  if (!res.ok) throw new Error(`Delete failed for ${objectName}: ${res.status} ${res.statusText}`);
}

async function cleanup() {
  const requiredEnv = ['BUNNY_API_KEY', 'BUNNY_STORAGE_ZONE'];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);
  if (missingEnv.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  }

  const apiKey = process.env.BUNNY_API_KEY;
  const storageZone = process.env.BUNNY_STORAGE_ZONE;

  console.log(`Scanning ${TOKEN_PREFIX} in storage zone ${storageZone}...`);
  const files = await listTokenFiles(storageZone, apiKey);
  const tokenFiles = files.filter((f) => !f.IsDirectory && f.ObjectName.endsWith('.json'));
  console.log(`Found ${tokenFiles.length} token file(s).`);

  const now = Date.now();
  let deleted = 0;
  let unreadable = 0;

  for (const file of tokenFiles) {
    const data = await readTokenFile(storageZone, apiKey, file.ObjectName);
    if (!data || typeof data.expiresAt !== 'number') {
      unreadable++;
      continue;
    }
    if (now > data.expiresAt) {
      await deleteTokenFile(storageZone, apiKey, file.ObjectName);
      deleted++;
    }
  }

  console.log(`Deleted ${deleted} expired token(s).`);
  if (unreadable > 0) {
    console.log(`Skipped ${unreadable} unreadable/malformed file(s).`);
  }
}

cleanup().catch((err) => {
  console.error(err);
  process.exit(1);
});
