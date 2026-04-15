import OpenAI from 'openai';
import { LLMProvider } from '../LLMProvider';
import { ChatMessage, LLMResponse } from '../../types/llm.types';

// Meta's Llama API is OpenAI-compatible; we reuse the OpenAI SDK with a custom base URL.
const LLAMA_API_BASE = 'https://api.llama.com/v1';

export class MetaProvider implements LLMProvider {
    private client: OpenAI;

    constructor() {
        const apiKey = process.env.LLAMA_API_KEY;
        if (!apiKey) throw new Error('LLAMA_API_KEY is not set in environment variables');

        this.client = new OpenAI({ apiKey, baseURL: LLAMA_API_BASE });
    }

    async complete(
        messages: ChatMessage[],
        model: string,
        temperature = 0.7,
        maxTokens = 2048,
    ): Promise<LLMResponse> {
        const response = await this.client.chat.completions.create({
            model,
            messages,
            temperature,
            max_completion_tokens: maxTokens,
        });

        const choice = response.choices[0];
        if (!choice.message.content) throw new Error('Meta Llama returned an empty response');

        return {
            content: choice.message.content,
            model: response.model,
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
        };
    }
}
