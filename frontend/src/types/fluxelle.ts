import type { NodeType } from './workflow';

export interface FluxelleMessage {
  /** Stable id for keying the React list. */
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Optional proposal attached to an assistant turn. */
  proposal?: WorkflowProposal;
  /** ISO timestamp; rendered as the message timestamp. */
  createdAt: string;
}

/** Compact snapshot of the current canvas sent to the backend each turn. */
export interface WorkflowSnapshot {
  id: string;
  name: string;
  entryNodeId: string;
  nodes: Array<{
    id: string;
    type: NodeType;
    name: string;
    configPreview: string;
    next: string[];
  }>;
}

export interface ProposedNode {
  id: string;
  type: NodeType;
  name: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface ProposedEdge {
  from: string;
  to: string;
  sourceHandle?: string;
  label?: string;
}

export interface WorkflowProposal {
  adds?: ProposedNode[];
  updates?: Array<{
    id: string;
    name?: string;
    config?: Record<string, unknown>;
  }>;
  deletes?: string[];
  edges?: ProposedEdge[];
  explanation?: string;
}

export interface FluxelleStatus {
  configured: boolean;
  model: string;
}

export interface FluxelleChatResponse {
  content: string;
  proposal?: WorkflowProposal;
  skillsUsed: string[];
}

export interface SkillSummary {
  name: string;
  title: string;
  summary: string;
  whenToUse: string;
  category: 'integration' | 'ai' | 'logic' | 'data' | 'trigger' | 'pattern';
  nodeType?: NodeType;
  requiresCredential?: 'google' | 'slack' | 'teams' | 'basecamp' | 'openai';
}

export interface SkillDetail extends SkillSummary {
  body: string;
}
