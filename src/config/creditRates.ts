/**
 * Token-to-credit conversion table.
 *
 * 1 credit ≈ $0.001 (one-tenth of a cent), so the numbers below are
 * (price per 1 M tokens in USD) × 1 000.
 *
 * To update pricing or add a new model, edit this file only — nothing
 * else in the system needs to change.
 */
export const CREDIT_RATES: Record<string, { input: number; output: number }> = {
    // credits per 1 M tokens
    'gpt-5.5':                              { input:  2_500, output: 10_000 },
    'claude-sonnet-4-6':                    { input:  3_000, output: 15_000 },
    'gemini-2.0-flash':                     { input:     75, output:    300 },
    'gemini-2.0-flash-thinking-exp-01-21':  { input:     75, output:    300 },
    'gemini-1.5-pro':                       { input:  1_250, output:  5_000 },
    'gemini-1.5-flash':                     { input:     75, output:    300 },
    'meta-llama/Llama-3.3-70B-Instruct':    { input:    600, output:    600 },
    'meta-llama/Llama-3.1-8B-Instruct':     { input:    200, output:    200 },
};

/** Fallback rate for any model not explicitly listed above. */
export const DEFAULT_CREDIT_RATE = { input: 5_000, output: 15_000 };

/**
 * Compute the credits consumed for one model call.
 * Returns 0 when both token counts are 0.
 */
export function tokensToCredits(
    model: string,
    promptTokens: number,
    completionTokens: number,
): number {
    const rate = CREDIT_RATES[model] ?? DEFAULT_CREDIT_RATE;
    const raw =
        (promptTokens     * rate.input  / 1_000_000) +
        (completionTokens * rate.output / 1_000_000);
    return Math.ceil(raw);
}
