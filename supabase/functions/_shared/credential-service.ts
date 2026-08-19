/**
 * AES-256-GCM envelope encryption for BYO provider credentials.
 *
 * Key material comes from the USER_API_KEY_ENCRYPTION_SECRET environment
 * variable — a 64-character hex string representing 32 raw bytes.  The
 * variable must be set as a Supabase Function secret before any key is
 * saved or read.  If it is absent the functions fail fast rather than
 * silently falling back to plaintext.
 *
 * IV: 12 random bytes per encryption, base64url-encoded alongside the
 * ciphertext.  The authenticated tag (16 bytes) is appended by SubtleCrypto
 * and travels with the ciphertext in the same base64url blob.
 */

const KEY_ENV = "USER_API_KEY_ENCRYPTION_SECRET";

let _cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;

  const hexSecret = Deno.env.get(KEY_ENV);
  if (!hexSecret || hexSecret.length !== 64) {
    throw new Error(
      `${KEY_ENV} must be a 64-character hex string (32 bytes). ` +
      `Set it with: supabase secrets set ${KEY_ENV}=<hex>`
    );
  }

  const raw = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    raw[i] = parseInt(hexSecret.slice(i * 2, i * 2 + 2), 16);
  }

  _cachedKey = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  raw.fill(0);
  return _cachedKey;
}

function b64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const paddedLen = padded.length + (4 - (padded.length % 4)) % 4;
  const binary = atob(padded.padEnd(paddedLen, "="));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export interface EncryptedCredential {
  ciphertext: string;
  iv: string;
}

export async function encrypt(plaintext: string): Promise<EncryptedCredential> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  return {
    ciphertext: b64urlEncode(ciphertextBuf),
    iv: b64urlEncode(iv),
  };
}

export async function decrypt(ciphertext: string, iv: string): Promise<string> {
  const key = await getKey();
  const ivBytes = b64urlDecode(iv);
  const ciphertextBytes = b64urlDecode(ciphertext);

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    ciphertextBytes,
  );

  return new TextDecoder().decode(plaintextBuf);
}

export function maskKey(plaintext: string): string {
  if (plaintext.length <= 4) return "****";
  return "****" + plaintext.slice(-4);
}
