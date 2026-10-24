export type JsonSchema = Record<string, unknown>;

export type Message = UserMessage | AssistantMessage | ToolResultMessage;

export interface UserMessage {
	role: "user";
	content: string;
}

export interface AssistantMessage {
	role: "assistant";
	content: string;
	toolCalls: ToolCall[];
	usage?: { inputTokens: number };
}

export interface ToolResultMessage {
	role: "tool";
	toolCallId: string;
	name: string;
	content: string;
	isError: boolean;
}

export interface ToolCall {
	id: string;
	name: string;
	arguments: unknown;
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: JsonSchema;
}

export interface ModelInput {
	systemPrompt: string;
	messages: Message[];
	tools: ToolDefinition[];

	maxTokens?: number;
	signal?: AbortSignal;
}

export interface Model {

	contextWindow?: number;
	generate(input: ModelInput): Promise<AssistantMessage>;
}
