import { randomUUID } from 'crypto';
import {
    FluxelleConversationModel,
    type ConversationMessage,
    type FluxelleConversationDocument,
} from '../db/models/FluxelleConversationModel';

export interface ConversationSummary {
    conversationId: string;
    title:          string;
    workflowId?:    string;
    workflowName?:  string;
    messageCount:   number;
    createdAt:      string;
    updatedAt:      string;
}

export interface ConversationDetail extends ConversationSummary {
    messages: ConversationMessage[];
}

function toSummary(doc: FluxelleConversationDocument): ConversationSummary {
    return {
        conversationId: doc.conversationId,
        title:          doc.title,
        workflowId:     doc.workflowId,
        workflowName:   doc.workflowName,
        messageCount:   doc.messages.length,
        createdAt:      doc.createdAt.toISOString(),
        updatedAt:      doc.updatedAt.toISOString(),
    };
}

function toDetail(doc: FluxelleConversationDocument): ConversationDetail {
    return {
        ...toSummary(doc),
        messages: doc.messages,
    };
}

export class FluxelleConversationRepository {

    async list(userId: string, limit = 30): Promise<ConversationSummary[]> {
        const docs = await FluxelleConversationModel
            .find({ userId })
            .sort({ updatedAt: -1 })
            .limit(limit)
            .lean<FluxelleConversationDocument[]>();
        return docs.map(toSummary);
    }

    async get(conversationId: string, userId: string): Promise<ConversationDetail | null> {
        const doc = await FluxelleConversationModel.findOne({ conversationId, userId });
        return doc ? toDetail(doc) : null;
    }

    async create(params: {
        userId:       string;
        title:        string;
        workflowId?:  string;
        workflowName?: string;
        messages?:    ConversationMessage[];
    }): Promise<ConversationDetail> {
        const doc = await FluxelleConversationModel.create({
            conversationId: `conv-${randomUUID()}`,
            userId:         params.userId,
            title:          params.title,
            workflowId:     params.workflowId,
            workflowName:   params.workflowName,
            messages:       params.messages ?? [],
        });
        return toDetail(doc);
    }

    /** Replace the full messages array and optionally update the title. */
    async updateMessages(
        conversationId: string,
        userId: string,
        messages: ConversationMessage[],
        title?: string,
    ): Promise<ConversationDetail | null> {
        const update: Record<string, unknown> = { messages };
        if (title) update.title = title;

        const doc = await FluxelleConversationModel.findOneAndUpdate(
            { conversationId, userId },
            { $set: update },
            { new: true },
        );
        return doc ? toDetail(doc) : null;
    }

    async delete(conversationId: string, userId: string): Promise<boolean> {
        const result = await FluxelleConversationModel.deleteOne({ conversationId, userId });
        return result.deletedCount > 0;
    }
}
