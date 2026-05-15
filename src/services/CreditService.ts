import { CreditUsageModel } from '../db/models/CreditUsageModel';
import { CreditSettingsModel } from '../db/models/CreditSettingsModel';
import { tokensToCredits } from '../config/creditRates';
import type { CreditModelBreakdown } from '../db/models/CreditUsageModel';

/** Credits assigned to a user that has no individual or global setting. */
const FALLBACK_DAILY_LIMIT = 1_000;

function todayUtc(): string {
    return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

export interface ConsumeResult {
    creditsConsumed: number;
    creditsUsed:     number;
    dailyLimit:      number;
    remaining:       number;
}

export interface CreditSnapshot {
    creditsUsed: number;
    dailyLimit:  number;
    remaining:   number;
    /** ISO timestamp of the start of tomorrow UTC — when the counter resets. */
    resetAt:     string;
    breakdown:   Record<string, CreditModelBreakdown>;
}

export class CreditService {

    // ── Limits ──────────────────────────────────────────────────────────────

    async getDailyLimit(userId: string): Promise<number> {
        const userSetting = await CreditSettingsModel.findOne({ userId }).lean();
        if (userSetting) return userSetting.dailyLimit;

        const globalDefault = await CreditSettingsModel.findOne({ userId: 'default' }).lean();
        return globalDefault?.dailyLimit ?? FALLBACK_DAILY_LIMIT;
    }

    async setDailyLimit(
        targetUserId: string,
        limit: number,
        ownerUserId: string,
    ): Promise<void> {
        await CreditSettingsModel.findOneAndUpdate(
            { userId: targetUserId },
            { dailyLimit: limit, updatedBy: ownerUserId },
            { upsert: true, new: true },
        );
    }

    /** Remove a per-user override so the user falls back to the global default. */
    async deleteDailyLimitOverride(targetUserId: string): Promise<void> {
        await CreditSettingsModel.deleteOne({ userId: targetUserId });
    }

    async listSettings(): Promise<Array<{
        userId:     string;
        dailyLimit: number;
        updatedBy:  string;
        updatedAt:  Date;
    }>> {
        const docs = await CreditSettingsModel.find().sort({ userId: 1 }).lean();
        return docs.map((d) => ({
            userId:     d.userId,
            dailyLimit: d.dailyLimit,
            updatedBy:  d.updatedBy,
            updatedAt:  d.updatedAt,
        }));
    }

    // ── Usage ────────────────────────────────────────────────────────────────

    async getUsageToday(userId: string): Promise<{
        creditsUsed: number;
        breakdown:   Record<string, CreditModelBreakdown>;
    }> {
        const doc = await CreditUsageModel.findOne({ userId, date: todayUtc() }).lean();
        return {
            creditsUsed: doc?.creditsUsed ?? 0,
            breakdown:   (doc?.breakdown ?? {}) as Record<string, CreditModelBreakdown>,
        };
    }

    /**
     * Atomically record token consumption for one model call.
     * Uses MongoDB `$inc` + upsert so concurrent calls are safe.
     */
    async consume(
        userId: string,
        model: string,
        promptTokens: number,
        completionTokens: number,
    ): Promise<ConsumeResult> {
        const credits = tokensToCredits(model, promptTokens, completionTokens);
        const date    = todayUtc();

        const updated = await CreditUsageModel.findOneAndUpdate(
            { userId, date },
            {
                $inc: {
                    creditsUsed:                             credits,
                    [`breakdown.${model}.promptTokens`]:     promptTokens,
                    [`breakdown.${model}.completionTokens`]: completionTokens,
                    [`breakdown.${model}.credits`]:          credits,
                },
            },
            { upsert: true, new: true },
        );

        const dailyLimit  = await this.getDailyLimit(userId);
        const creditsUsed = updated?.creditsUsed ?? credits;

        return {
            creditsConsumed: credits,
            creditsUsed,
            dailyLimit,
            remaining: Math.max(0, dailyLimit - creditsUsed),
        };
    }

    /** Full snapshot used by `GET /api/me/credits`. */
    async getSnapshot(userId: string): Promise<CreditSnapshot> {
        const [usage, dailyLimit] = await Promise.all([
            this.getUsageToday(userId),
            this.getDailyLimit(userId),
        ]);

        // Start of tomorrow UTC
        const tomorrow = new Date();
        tomorrow.setUTCHours(24, 0, 0, 0);

        return {
            creditsUsed: usage.creditsUsed,
            dailyLimit,
            remaining:   Math.max(0, dailyLimit - usage.creditsUsed),
            resetAt:     tomorrow.toISOString(),
            breakdown:   usage.breakdown,
        };
    }

    /** All users' usage for a given date (defaults to today) — for admin dashboard. */
    async listUsage(date?: string): Promise<Array<{
        userId:      string;
        creditsUsed: number;
        breakdown:   Record<string, CreditModelBreakdown>;
        date:        string;
    }>> {
        const targetDate = date ?? todayUtc();
        const docs = await CreditUsageModel
            .find({ date: targetDate })
            .sort({ creditsUsed: -1 })
            .lean();
        return docs.map((d) => ({
            userId:      d.userId,
            creditsUsed: d.creditsUsed,
            breakdown:   (d.breakdown ?? {}) as Record<string, CreditModelBreakdown>,
            date:        d.date,
        }));
    }
}
