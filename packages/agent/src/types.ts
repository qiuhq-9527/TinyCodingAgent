import type {
	AssistantMessage,
	Message,
	Model,
	ToolCall,
	ToolDefinition,
	ToolResultMessage,
} from "@tinycodingagent/ai";

export type {
	AssistantMessage,
	Message,
	ToolCall,
	ToolDefinition,
	ToolResultMessage,
} from "@tinycodingagent/ai";

export interface Tool<TArgs = unknown> extends ToolDefinition {
	parse(input: unknown): TArgs;
	execute(args: TArgs, signal?: AbortSignal): unknown | Promise<unknown>;
}

export type AgentEvent =
	| { type: "agent_start"; input: string }
	| { type: "turn_start"; turn: number }
	| { type: "assistant"; turn: number; message: AssistantMessage }
	| { type: "tool_start"; call: ToolCall }
	| { type: "tool_end"; call: ToolCall; result: ToolResultMessage }
	| { type: "turn_end"; turn: number; messages: Message[] }
	| { type: "agent_end"; result: AgentResult };

export interface RunAgentOptions {
	model: Model;

	session?: AgentSession;
	systemPrompt?: string;
	tools: Tool[];
	maxTurns?: number;

	compaction?: {
		enabled?: boolean;
		reserveTokens?: number;
		keepRecentTokens?: number;
		customInstructions?: string;
	};
	signal?: AbortSignal;
	onEvent?: (event: AgentEvent) => void | Promise<void>;
}

export interface AgentSession {
	messages: Message[];
	contextMessages: Message[];
	contextUsage?: { inputTokens: number; messageCount: number };
}

export interface AgentResult {
	output: string;
	messages: Message[];
	session: AgentSession;
	turns: number;
}
