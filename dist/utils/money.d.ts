/**
 * Money utilities per gestione minor units e banker's rounding
 * Bibbia: tutti i calcoli interni in minor units (integer)
 */
/**
 * Banker's rounding (tie-to-even)
 * Per 0.5 arrotonda al numero pari più vicino
 */
export declare function bankersRound(n: number, decimals?: number): number;
/**
 * Converte stringa amount "10.50" in minor units 1050
 * Usa banker's rounding per gestire edge cases
 */
export declare function toMinor(amountStr: string): number;
/**
 * Converte minor units 1050 in stringa "10.50"
 */
export declare function toMajor(minor: number): string;
/**
 * Valida formato money string "10.00"
 */
export declare function isValidMoneyString(str: string): boolean;
/**
 * Somma amounts in minor units
 */
export declare function addMinor(a: number, b: number): number;
/**
 * Sottrae amounts in minor units
 */
export declare function subtractMinor(a: number, b: number): number;
//# sourceMappingURL=money.d.ts.map