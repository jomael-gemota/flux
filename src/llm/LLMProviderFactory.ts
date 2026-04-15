import { LLMProviderName } from "../types/llm.types";
import { LLMProvider } from "./LLMProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { AnthropicProvider } from "./providers/AnthropicProvider";
import { GeminiProvider } from "./providers/GeminiProvider";
import { MetaProvider } from "./providers/MetaProvider";

export class LLMProviderFactory {
    static create(providerName: LLMProviderName): LLMProvider {
        switch (providerName) {
            case 'openai':
                return new OpenAIProvider();
            case 'anthropic':
                return new AnthropicProvider();
            case 'gemini':
                return new GeminiProvider();
            case 'meta':
                return new MetaProvider();
            default:
                throw new Error(`Unsupported LLM provider: ${providerName}`);
        }
    }
}