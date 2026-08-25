import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";

// Shared app-level secret, used two ways below: AES-256-GCM for third-party
// secrets at rest (e.g. a site owner's Resend API key — not for passwords,
// those go through Supabase Auth, never this table), and HMAC-signed
// tokens (e.g. the page-gate unlock cookie, which must prove the *server*
// issued it rather than a visitor guessing/forging the value). Each use
// derives its own subkey via HMAC rather than reusing the raw secret
// directly for two different algorithms.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getRootSecret(): Buffer {
  const secret = process.env.RESEND_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error("RESEND_KEY_ENCRYPTION_SECRET must be set to a 64-char hex string (32 bytes).");
  }
  return Buffer.from(secret, "hex");
}

function deriveKey(context: string): Buffer {
  return createHmac("sha256", getRootSecret()).update(context).digest();
}

function getKey(): Buffer {
  return deriveKey("encrypt-secret-v1");
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

/** Signs a page-gate unlock token for the given pageId — used as the
 * cookie value instead of a bare "1", so a visitor can't just set
 * `sage_pgate_<pageId>=1` themselves via devtools to bypass the gate
 * without ever submitting an email. The pageId itself isn't secret (it's
 * already visible to the visitor); the signature only proves the *server*
 * issued this specific unlock. */
export function signGateToken(pageId: string): string {
  return createHmac("sha256", deriveKey("gate-token-v1")).update(pageId).digest("base64url");
}

/** Constant-time check that `token` is a valid signature for `pageId`. */
export function verifyGateToken(pageId: string, token: string): boolean {
  const expected = signGateToken(pageId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
