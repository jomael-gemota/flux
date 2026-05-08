/**
 * Flux Skills — discrete, self-describing capabilities Fluxelle can use to
 * build and edit workflows. A skill answers three questions for the agent:
 *
 *   1. WHAT does this capability do?           (`title`, `summary`)
 *   2. WHEN should I use it?                    (`whenToUse`, `keywords`)
 *   3. HOW do I configure it?                   (`body` markdown)
 *
 * Skills are loaded into a registry at startup, then surfaced to the OpenAI
 * agent via two tools:
 *   - `search_skills(query)` — returns matching skills' metadata only
 *   - `load_skill(name)`     — returns the full markdown body
 *
 * This retrieval-augmented pattern keeps the system prompt small and lets
 * Fluxelle pull deep node-config knowledge on demand.
 */

import type { NodeType } from '../types/workflow.types';

export type SkillCategory =
    | 'integration'   // single node-action skill (e.g. Slack send_message)
    | 'ai'            // LLM-powered transformations
    | 'logic'         // condition / switch / loop
    | 'data'          // transform / extract / formatter
    | 'trigger'       // workflow entry-points
    | 'pattern';      // multi-node templates

export interface Skill {
    /** Stable kebab-case identifier — used by `load_skill`. */
    name: string;
    /** Human-readable title shown in the UI catalog. */
    title: string;
    /** One-line description shown in the skill index. */
    summary: string;
    /** Plain-language guidance for the agent on *when* to pick this skill. */
    whenToUse: string;
    /** Search keywords used by `search_skills`. */
    keywords: string[];
    /** Logical grouping for the catalog UI. */
    category: SkillCategory;
    /** Node type this skill produces (for non-pattern skills). */
    nodeType?: NodeType;
    /** OAuth/API credential provider required, if any. */
    requiresCredential?: 'google' | 'slack' | 'teams' | 'basecamp' | 'openai';
    /** Full markdown body — config schema, examples, common patterns. */
    body: string;
}
