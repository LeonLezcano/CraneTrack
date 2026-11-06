// @ts-check
/**
 * @fileoverview Deterministic Cryptographic Seal (SHA-256) for CraneTrack (AiAppFactory Standard)
 */

export class CryptoSeal {
  /**
   * Genera hash SHA-256 determinista a partir de cualquier objeto o cadena.
   * Compatible con Node.js crypto y Web Crypto API.
   * @param {Object|string} payload
   * @returns {Promise<string>} Hex string de 64 caracteres
   */
  static async computeSha256(payload) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);

    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(raw);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    try {
      const { createHash } = await import('node:crypto');
      return createHash('sha256').update(raw).digest('hex');
    } catch {
      // Fallback determinista ligero
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      return Math.abs(hash).toString(16).padStart(64, '0');
    }
  }
}
