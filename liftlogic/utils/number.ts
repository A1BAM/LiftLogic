/**
 * Number entry without `<input type="number">`.
 *
 * Safari's number field decides for itself what counts as valid and puts up
 * its own "Enter a valid value" bubble — over 27.5, for one — and it does so
 * differently by iOS version and by the phone's region setting, where the
 * decimal key may type a comma. A plain text field with a numeric keypad has
 * none of that: these two functions are the whole rulebook.
 */

/** Digits and one decimal point. A comma is accepted and read as the point. */
export function cleanDecimal(text: string): string {
  const cleaned = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const point = cleaned.indexOf('.');
  if (point === -1) return cleaned;
  return cleaned.slice(0, point + 1) + cleaned.slice(point + 1).replace(/\./g, '');
}

/** Digits only. */
export function cleanInteger(text: string): string {
  return text.replace(/[^0-9]/g, '');
}
