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

// Plaid access tokens get a dedicated root secret rather than reusing
// RESEND_KEY_ENCRYPTION_SECRET — a bank access token is higher-stakes than
// a Resend API key, so a compromise of one secret shouldn't reach the other.
function getPlaidRootSecret(): Buffer {
  const secret = process.env.PLAID_TOKEN_ENCRYPTION_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error("PLAID_TOKEN_ENCRYPTION_SECRET must be set to a 64-char hex string (32 bytes).");
  }
  return Buffer.from(secret, "hex");
}

function getPlaidKey(): Buffer {
  return createHmac("sha256", getPlaidRootSecret()).update("plaid-token-v1").digest();
}

export function encryptPlaidToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getPlaidKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptPlaidToken(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted Plaid token.");
  }
  const decipher = createDecipheriv(ALGORITHM, getPlaidKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}

// QuickBooks access/refresh tokens get their own dedicated root secret, same
// rationale as Plaid — a compromise of one integration's secret shouldn't
// expose another's tokens.
function getQboRootSecret(): Buffer {
  const secret = process.env.QBO_TOKEN_ENCRYPTION_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error("QBO_TOKEN_ENCRYPTION_SECRET must be set to a 64-char hex string (32 bytes).");
  }
  return Buffer.from(secret, "hex");
}

function getQboKey(): Buffer {
  return createHmac("sha256", getQboRootSecret()).update("qbo-token-v1").digest();
}

export function encryptQboToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getQboKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptQboToken(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted QuickBooks token.");
  }
  const decipher = createDecipheriv(ALGORITHM, getQboKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Signs the OAuth `state` param sent to Intuit so the callback route can
 * trust the userId/intendedEntityName/entityType it carries — otherwise a
 * forged callback request could claim another user's OAuth grant. */
export function signQboState(payload: string): string {
  return createHmac("sha256", deriveKey("qbo-state-v1")).update(payload).digest("base64url");
}

export function verifyQboState(payload: string, signature: string): boolean {
  const expected = signQboState(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
