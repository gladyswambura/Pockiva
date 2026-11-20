/**
 * Client-side encryption : AES-256-GCM.
 *
 * Architecture:
 *  - A random 256-bit data key (DEK) is generated once per user.
 *  - The DEK is wrapped (encrypted) with a key derived from the user's PIN
 *    using PBKDF2-SHA256 (600,000 iterations).
 *  - The wrapped DEK is stored in IndexedDB.
 *  - A recovery code (base64 of the raw DEK) is shown once at setup.
 *  - Envelope names, notes, lender names, goals are encrypted with the DEK
 *    before leaving the device.
 *  - The server only ever sees ciphertext for user-written fields.
 */

const PBKDF2_ITERATIONS = 600_000
const enc = new TextEncoder()
const dec = new TextDecoder()

// ── Key derivation ────────────────────────────────────────────

async function deriveKeyFromPin(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  )
}

// ── DEK generation ────────────────────────────────────────────

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportDekAsRecoveryCode(dek: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', dek)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

export async function importDekFromRecoveryCode(code: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(code), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

// ── Wrap / unwrap DEK with PIN ────────────────────────────────

export interface WrappedDek {
  wrappedKeyB64: string
  saltB64: string
  ivB64: string
}

export async function wrapDek(dek: CryptoKey, pin: string): Promise<WrappedDek> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv   = crypto.getRandomValues(new Uint8Array(12))
  const wrapKey = await deriveKeyFromPin(pin, salt)
  const wrapped = await crypto.subtle.wrapKey('raw', dek, wrapKey, { name: 'AES-GCM', iv })
  return {
    wrappedKeyB64: btoa(String.fromCharCode(...new Uint8Array(wrapped))),
    saltB64: btoa(String.fromCharCode(...salt)),
    ivB64:   btoa(String.fromCharCode(...iv)),
  }
}

export async function unwrapDek(wrapped: WrappedDek, pin: string): Promise<CryptoKey> {
  const salt      = Uint8Array.from(atob(wrapped.saltB64), c => c.charCodeAt(0))
  const iv        = Uint8Array.from(atob(wrapped.ivB64),   c => c.charCodeAt(0))
  const wrappedBuf = Uint8Array.from(atob(wrapped.wrappedKeyB64), c => c.charCodeAt(0))
  const wrapKey   = await deriveKeyFromPin(pin, salt)
  return crypto.subtle.unwrapKey(
    'raw', wrappedBuf, wrapKey,
    { name: 'AES-GCM', iv },
    { name: 'AES-GCM', length: 256 },
    true, ['encrypt', 'decrypt']
  )
}

// ── Encrypt / decrypt strings ─────────────────────────────────

export async function encryptText(plaintext: string, dek: CryptoKey): Promise<string> {
  const iv         = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, enc.encode(plaintext))
  // Prepend IV to ciphertext, return as hex
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return Array.from(combined).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function decryptText(hex: string, dek: CryptoKey): Promise<string> {
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const iv         = bytes.slice(0, 12)
  const ciphertext = bytes.slice(12)
  const plaintext  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, ciphertext)
  return dec.decode(plaintext)
}

/** Returns hex or empty string if dek is null (offline / not unlocked) */
export async function safeEncrypt(text: string, dek: CryptoKey | null): Promise<string> {
  if (!dek || !text) return ''
  return encryptText(text, dek)
}

export async function safeDecrypt(hex: string, dek: CryptoKey | null): Promise<string> {
  if (!dek || !hex) return hex
  try { return await decryptText(hex, dek) } catch { return '[encrypted]' }
}

// ── Device key (non-extractable, stored in IDB) ─────────────
// Wraps the DEK so a known device never needs the PIN again.

export async function wrapDekWithDeviceKey(dek: CryptoKey): Promise<{ wrappedB64: string; deviceKey: CryptoKey }> {
  const deviceKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const wrapped = await crypto.subtle.wrapKey('raw', dek, deviceKey, { name: 'AES-GCM', iv })
  const combined = new Uint8Array(12 + wrapped.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(wrapped), 12)
  return { wrappedB64: btoa(String.fromCharCode(...combined)), deviceKey }
}

export async function unwrapDekWithDeviceKey(wrappedB64: string, deviceKey: CryptoKey): Promise<CryptoKey> {
  const combined = Uint8Array.from(atob(wrappedB64), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const wrappedBuf = combined.slice(12)
  return crypto.subtle.unwrapKey(
    'raw', wrappedBuf, deviceKey,
    { name: 'AES-GCM', iv },
    { name: 'AES-GCM', length: 256 },
    true, ['encrypt', 'decrypt']
  )
}



export interface WebAuthnCredential {
  credentialIdB64: string
}

async function getWebAuthnCredential(): Promise<PublicKeyCredential> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Pockiva', id: window.location.hostname },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: 'pockiva-user',
        displayName: 'Pockiva User',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: 'none',
    },
  }) as unknown as PublicKeyCredential
  if (!credential) throw new Error('WebAuthn credential creation failed')
  return credential
}

async function getWebAuthnAssertion(credentialId: Uint8Array): Promise<void> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: credentialId.buffer as BufferSource }],
      userVerification: 'required',
      timeout: 60000,
    },
  }) as unknown as PublicKeyCredential | null
  if (!assertion) throw new Error('WebAuthn verification failed')
}

export async function registerWebAuthnCredential(): Promise<WebAuthnCredential> {
  const credential = await getWebAuthnCredential()
  return {
    credentialIdB64: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
  }
}

export async function verifyWebAuthnCredential(credential: WebAuthnCredential): Promise<void> {
  const credentialId = Uint8Array.from(atob(credential.credentialIdB64), c => c.charCodeAt(0))
  await getWebAuthnAssertion(credentialId)
}
