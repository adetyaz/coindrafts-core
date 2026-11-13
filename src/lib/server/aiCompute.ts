// Shared AI-inference client for /api/breakdown, the AI draft agent and the
// vocab pool. Groq only — the 0G Compute backend was removed 2026-10-30.
import { GROQ_API_KEY } from '$env/static/private';
import Groq from 'groq-sdk';
import type { ChatCompletion, ChatCompletionChunk } from 'groq-sdk/resources/chat/completions';
import type { Stream } from 'groq-sdk/lib/streaming';

export const AI_MODEL = 'openai/gpt-oss-120b';

export class AiConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AiConfigError';
	}
}

function getAiClient(): Groq {
	if (!GROQ_API_KEY) {
		throw new AiConfigError('GROQ_API_KEY is not set — no AI backend is configured.');
	}
	return new Groq({ apiKey: GROQ_API_KEY });
}

type ChatParams = {
	messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
	max_tokens?: number;
	temperature?: number;
	stream?: boolean;
};

/** Chat completion with the app's model injected, so call sites never hardcode it. */
export function createChatCompletion(
	params: ChatParams & { stream: true }
): Promise<Stream<ChatCompletionChunk>>;
export function createChatCompletion(
	params: ChatParams & { stream?: false }
): Promise<ChatCompletion>;
export function createChatCompletion(
	params: ChatParams
): Promise<ChatCompletion | Stream<ChatCompletionChunk>> {
	const client = getAiClient();
	return client.chat.completions.create({
		...params,
		model: AI_MODEL
	} as Parameters<typeof client.chat.completions.create>[0]) as Promise<
		ChatCompletion | Stream<ChatCompletionChunk>
	>;
}
