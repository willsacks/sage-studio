import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM for third-party secrets (e.g. a site owner's Resend API key)
// that need to be stored at rest in this shared Postgres instance. Not for
// passwords — those go through Supabase Auth, never this table.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.RESEND_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error("RESEND_KEY_ENCRYPTION_SECRET must be set to a 64-char hex string (32 bytes).");
  }
  return Buffer.from(secret, "hex");
}

/** Encrypts a plaintext secret to a single "iv:authTag:ciphertext" base64 string. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/** Reverses encryptSecret. Throws if the value is malformed or the key doesn't match. */
export function decryptSecret(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted secret.");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
