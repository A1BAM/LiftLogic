/**
 * Constant-time string comparison to prevent timing attacks.
 * Hashing both strings before comparison eliminates length and V8 optimization leaks.
 */
export const timingSafeEqual = async (a: string, b: string): Promise<boolean> => {
  const encoder = new TextEncoder();

  // Hash both strings to ensure constant time comparison of equal-length hashes
  const [aHashBuffer, bHashBuffer] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b))
  ]);

  const aHash = new Uint8Array(aHashBuffer);
  const bHash = new Uint8Array(bHashBuffer);

  let result = 0;
  for (let i = 0; i < aHash.length; i++) {
    result |= aHash[i] ^ bHash[i];
  }

  // MUST NOT return early based on length to prevent timing attacks.
  // Evaluate the length match into an integer, and bitwise OR it with the result.
  const lengthMismatch = a.length === b.length ? 0 : 1;
  return (result | lengthMismatch) === 0;
};
