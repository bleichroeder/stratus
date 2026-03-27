// Client-side E2E encryption using Web Crypto API
// AES-256-GCM for encryption, PBKDF2 for key derivation

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 32;
const IV_BYTES = 12;
const KEY_ALGO = "AES-GCM" as const;
const KEY_LENGTH = 256;

// --- Types ---

export interface VaultMetadata {
  vault_salt: string;
  vault_wrapped_key: string; // "iv:encryptedKeyBytes" both base64
  vault_version: number;
}

export interface EncryptedPayload {
  v: 1;
  iv: string;
  ct: string;
}

// --- Base64 helpers ---

export function bufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// --- Key derivation ---

function generateSalt(): ArrayBuffer {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES)).buffer;
}

async function deriveEncryptionKey(
  password: string,
  salt: ArrayBuffer
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: KEY_ALGO, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

// --- Vault key generation ---

async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: KEY_ALGO, length: KEY_LENGTH },
    true, // extractable for export/recovery
    ["encrypt", "decrypt"]
  );
}

// --- Wrap / unwrap (manual: export key bytes, encrypt with derived key) ---

async function wrapVaultKey(
  vaultKey: CryptoKey,
  wrappingKey: CryptoKey
): Promise<{ wrappedKey: string; iv: string }> {
  const rawKey = await crypto.subtle.exportKey("raw", vaultKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: KEY_ALGO, iv },
    wrappingKey,
    rawKey
  );
  return {
    wrappedKey: bufferToBase64(encrypted),
    iv: bufferToBase64(iv.buffer),
  };
}

async function unwrapVaultKey(
  wrappedKeyB64: string,
  wrappingKey: CryptoKey,
  ivB64: string
): Promise<CryptoKey> {
  const decrypted = await crypto.subtle.decrypt(
    { name: KEY_ALGO, iv: base64ToBuffer(ivB64) },
    wrappingKey,
    base64ToBuffer(wrappedKeyB64)
  );
  return crypto.subtle.importKey(
    "raw",
    decrypted,
    { name: KEY_ALGO, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

// --- Recovery key ---

export async function exportRecoveryKey(vaultKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", vaultKey);
  return bufferToBase64(raw);
}

export async function importRecoveryKey(recoveryKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    base64ToBuffer(recoveryKeyB64),
    { name: KEY_ALGO, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

// --- Per-note encryption / decryption ---

export async function encryptContent(
  plaintext: string,
  vaultKey: CryptoKey
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: KEY_ALGO, iv },
    vaultKey,
    new TextEncoder().encode(plaintext)
  );
  return {
    v: 1,
    iv: bufferToBase64(iv.buffer),
    ct: bufferToBase64(ciphertext),
  };
}

export async function decryptContent(
  payload: EncryptedPayload,
  vaultKey: CryptoKey
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: KEY_ALGO, iv: base64ToBuffer(payload.iv) },
    vaultKey,
    base64ToBuffer(payload.ct)
  );
  return new TextDecoder().decode(decrypted);
}

// --- Type guard ---

export function isEncryptedPayload(content: unknown): content is EncryptedPayload {
  if (!content || typeof content !== "object") return false;
  const obj = content as Record<string, unknown>;
  return obj.v === 1 && typeof obj.iv === "string" && typeof obj.ct === "string";
}

// --- Validation ---

export function validateRecoveryKey(b64: string): boolean {
  try {
    const buf = base64ToBuffer(b64);
    return buf.byteLength === 32; // AES-256 = 32 bytes
  } catch {
    return false;
  }
}

function validateWrappedKeyFormat(wrappedKey: string): [string, string] {
  const parts = wrappedKey.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Invalid vault metadata format");
  }
  return [parts[0], parts[1]];
}

// --- High-level flows ---

export async function setupVault(password: string): Promise<{
  vaultKey: CryptoKey;
  recoveryKey: string;
  metadata: VaultMetadata;
}> {
  const salt = generateSalt();
  const wrappingKey = await deriveEncryptionKey(password, salt);
  const vaultKey = await generateVaultKey();
  const { wrappedKey, iv } = await wrapVaultKey(vaultKey, wrappingKey);
  const recoveryKey = await exportRecoveryKey(vaultKey);

  return {
    vaultKey,
    recoveryKey,
    metadata: {
      vault_salt: bufferToBase64(salt),
      vault_wrapped_key: `${iv}:${wrappedKey}`,
      vault_version: 1,
    },
  };
}

export async function unlockVault(
  password: string,
  metadata: VaultMetadata
): Promise<CryptoKey> {
  if (metadata.vault_version !== 1) {
    throw new Error(`Unsupported vault version: ${metadata.vault_version}`);
  }
  const salt = base64ToBuffer(metadata.vault_salt);
  const [ivB64, wrappedKeyB64] = validateWrappedKeyFormat(metadata.vault_wrapped_key);
  const wrappingKey = await deriveEncryptionKey(password, salt);
  return unwrapVaultKey(wrappedKeyB64, wrappingKey, ivB64);
}

export async function rewrapVaultKey(
  vaultKey: CryptoKey,
  newPassword: string
): Promise<VaultMetadata> {
  const salt = generateSalt();
  const wrappingKey = await deriveEncryptionKey(newPassword, salt);
  const { wrappedKey, iv } = await wrapVaultKey(vaultKey, wrappingKey);
  return {
    vault_salt: bufferToBase64(salt),
    vault_wrapped_key: `${iv}:${wrappedKey}`,
    vault_version: 1,
  };
}

// --- Format recovery key for display ---

export function formatRecoveryKey(key: string): string {
  return key.match(/.{1,4}/g)?.join("-") ?? key;
}

export function parseRecoveryKey(formatted: string): string {
  return formatted.replace(/-/g, "");
}
