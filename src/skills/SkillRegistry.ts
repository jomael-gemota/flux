import type { Skill } from './types';

import { skill as triggerManual }            from './catalog/trigger-manual';
import { skill as triggerWebhook }           from './catalog/trigger-webhook';
import { skill as triggerCron }              from './catalog/trigger-cron';
import { skill as llmPrompt }                from './catalog/llm-prompt';
import { skill as httpRequest }              from './catalog/http-request';
import { skill as conditionBranch }          from './catalog/condition-branch';
import { skill as slackSendMessage }         from './catalog/slack-send-message';
import { skill as gmailSend }                from './catalog/gmail-send';
import { skill as gsheetsAppendRow }         from './catalog/gsheets-append-row';
import { skill as teamsSendMessage }         from './catalog/teams-send-message';
import { skill as transformReshape }         from './catalog/transform-reshape';
import { skill as outputResult }             from './catalog/output-result';
import { skill as patternSummarizeAndNotify } from './catalog/pattern-summarize-and-notify';
import { skill as patternFormToSpreadsheet }  from './catalog/pattern-form-to-spreadsheet';

const ALL_SKILLS: Skill[] = [
    triggerManual,
    triggerWebhook,
    triggerCron,
    llmPrompt,
    httpRequest,
    conditionBranch,
    slackSendMessage,
    gmailSend,
    gsheetsAppendRow,
    teamsSendMessage,
    transformReshape,
    outputResult,
    patternSummarizeAndNotify,
    patternFormToSpreadsheet,
];

/** Compact shape returned by listing/searching — body intentionally omitted. */
export interface SkillSummary {
    name: string;
    title: string;
    summary: string;
    whenToUse: string;
    category: Skill['category'];
    nodeType?: Skill['nodeType'];
    requiresCredential?: Skill['requiresCredential'];
}

export class SkillRegistry {
    private byName: Map<string, Skill>;

    constructor(skills: Skill[] = ALL_SKILLS) {
        this.byName = new Map(skills.map((s) => [s.name, s]));
    }

    /** All skills, summary-only — safe to dump into the agent's system prompt. */
    listSummaries(): SkillSummary[] {
        return Array.from(this.byName.values()).map(toSummary);
    }

    /** All skills, full body — used by the catalog UI. */
    listFull(): Skill[] {
        return Array.from(this.byName.values());
    }

    get(name: string): Skill | undefined {
        return this.byName.get(name);
    }

    /**
     * Lightweight keyword search across name, title, summary, keywords.
     * Returns ranked summaries; case-insensitive multi-token AND match.
     */
    search(query: string, limit = 8): SkillSummary[] {
        const q = query.trim().toLowerCase();
        if (!q) return this.listSummaries().slice(0, limit);

        const tokens = q.split(/\s+/).filter(Boolean);

        const scored = Array.from(this.byName.values()).map((s) => {
            const haystack = [
                s.name,
                s.title,
                s.summary,
                s.whenToUse,
                ...s.keywords,
                s.category,
                s.nodeType ?? '',
            ]
                .join(' ')
                .toLowerCase();

            let score = 0;
            for (const t of tokens) {
                if (!haystack.includes(t)) return { skill: s, score: 0 };
                if (s.name.toLowerCase().includes(t)) score += 5;
                if (s.title.toLowerCase().includes(t)) score += 3;
                if (s.keywords.some((k) => k.toLowerCase() === t)) score += 4;
                score += 1;
            }
            return { skill: s, score };
        });

        return scored
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((r) => toSummary(r.skill));
    }
}

function toSummary(s: Skill): SkillSummary {
    return {
        name: s.name,
        title: s.title,
        summary: s.summary,
        whenToUse: s.whenToUse,
        category: s.category,
        nodeType: s.nodeType,
        requiresCredential: s.requiresCredential,
    };
}
