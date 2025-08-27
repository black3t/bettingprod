/**
 * Money utilities per gestione minor units e banker's rounding
 * Bibbia: tutti i calcoli interni in minor units (integer)
 */

/**
 * Banker's rounding (tie-to-even)
 * Per 0.5 arrotonda al numero pari più vicino
 */
export function bankersRound(n: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  const x = n * factor;
  const f = Math.floor(x);
  const diff = x - f;
  
  if (diff > 0.5) return Math.ceil(x) / factor;
  if (diff < 0.5) return Math.floor(x) / factor;
  
  // Exactly 0.5 → tie to even
  return (f % 2 === 0 ? f : f + 1) / factor;
}

/**
 * Converte stringa amount "10.50" in minor units 1050
 * Usa banker's rounding per gestire edge cases
 */
export function toMinor(amountStr: string): number {
  const n = Number(amountStr);
  if (isNaN(n) || n < 0) {
    throw new Error('Invalid amount');
  }
  return Math.round(bankersRound(n, 2) * 100);
}

/**
 * Converte minor units 1050 in stringa "10.50"
 */
export function toMajor(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * Valida formato money string "10.00"
 */
export function isValidMoneyString(str: string): boolean {
  return /^\d+\.\d{2}$/.test(str);
}

/**
 * Somma amounts in minor units
 */
export function addMinor(a: number, b: number): number {
  return a + b;
}

/**
 * Sottrae amounts in minor units
 */
export function subtractMinor(a: number, b: number): number {
  return a - b;
}