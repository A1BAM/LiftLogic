/**
 * Constant-time string comparison to prevent timing attacks.
 */
export const timingSafeEqual = (a: string, b: string): boolean => {
  const lenMatch = a.length === b.length;
  let result = lenMatch ? 0 : 1;
  const target = lenMatch ? b : a;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ target.charCodeAt(i);
  }
  return result === 0;
};
