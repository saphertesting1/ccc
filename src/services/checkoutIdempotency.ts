const STORAGE_KEY = 'ccc_pending_checkout_idempotency';

function createKey(): string {
  try {
    return `idem-${crypto.randomUUID()}`;
  } catch {
    return `idem-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }
}

/**
 * Reuse the same key when the exact same checkout payload is retried.
 * This allows the database's unique idempotency_key constraint to prevent
 * duplicate orders after a timeout or lost response.
 */
export async function getCheckoutIdempotencyKey(fingerprint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
  const fingerprintHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved: unknown = JSON.parse(raw);
      if (
        typeof saved === 'object' &&
        saved !== null &&
        'fingerprint' in saved &&
        saved.fingerprint === fingerprintHash &&
        'key' in saved &&
        typeof saved.key === 'string' &&
        saved.key.length > 0
      ) {
        return saved.key;
      }
    }

    const key = createKey();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fingerprint: fingerprintHash, key }));
    return key;
  } catch {
    // Storage may be unavailable in private browsing or embedded webviews.
    return createKey();
  }
}

export function clearCheckoutIdempotencyKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage is optional; the completed order is already saved remotely.
  }
}
