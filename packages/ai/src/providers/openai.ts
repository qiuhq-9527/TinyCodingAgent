import type {
	AssistantMessage,
	Message,
	Model,
	ModelInput,
	ToolDefinition,
} from "../types.js";

export interface OpenAIProviderOptions {
	apiKey?: string;
	baseUrl?: string;
	model: string;

	contextWindow?: number;
}

type ApiMessage = Record<string, unknown>;

type ApiToolCall = {
	id: string;
	function: {
		name: string;
		arguments: string;
	};
};

function toApiMessage(message: Message): ApiMessage {
	if (message.role === "user") return { role: "user", content: message.content };
	if (message.role === "tool") {
		return { role: "tool", content: message.content, tool_call_id: message.toolCallId };
	}

	const toolCalls = message.toolCalls.map((call) => ({
		id: call.id,
		type: "function",
		function: {
			name: call.name,
			arguments: JSON.stringify(call.arguments),
		},
	}));

	return {
		role: "assistant",
		content: message.content || null,
		...(message.toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
	};
}

function toApiTool(tool: ToolDefinition): Record<string, unknown> {
	return {
		type: "function",
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
		},
	};
}

function parseArguments(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

export class OpenAIProvider implements Model {
	readonly #apiKey: string | undefined;
	readonly #baseUrl: string;
	readonly #model: string;
	readonly contextWindow: number | undefined;

	constructor(options: OpenAIProviderOptions) {
		this.#apiKey = options.apiKey;
		this.#baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
		this.#model = options.model;

		this.contextWindow = options.contextWindow;
	}

	async generate(input: ModelInput): Promise<AssistantMessage> {
		const response = await fetch(`${this.#baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(this.#apiKey ? { authorization: `Bearer ${this.#apiKey}` } : {}),
			},
			body: JSON.stringify({
				model: this.#model,
				messages: [
					{ role: "system", content: input.systemPrompt },
					...input.messages.map(toApiMessage),
				],
				tools: input.tools.map(toApiTool),
				tool_choice: "auto",

				...(input.maxTokens ? { max_tokens: input.maxTokens } : {}),
				temperature: 0,
			}),
			signal: input.signal,
		});

		if (!response.ok) {
			throw new Error(`Model request failed (${response.status}): ${await response.text()}`);
		}

		const result = await response.json();
		const message = result.choices?.[0]?.message;
		if (!message) throw new Error("Model response has no assistant message");

		return {
			role: "assistant",
			content: message.content ?? "",
			toolCalls: (message.tool_calls ?? []).map((call: ApiToolCall) => ({
				id: call.id,
				name: call.function.name,
				arguments: parseArguments(call.function.arguments),
			})),
			...(Number.isFinite(result.usage?.prompt_tokens)
				? { usage: { inputTokens: result.usage.prompt_tokens } }
				: {}),
		};
	}
}
