import type { Message, Model, ToolDefinition } from "@tinycodingagent/ai";

const SUMMARY_PREFIX = "[Conversation summary]\n";

const TOOL_RESULT_SUMMARY_MAX_CHARS = 2_000;

export interface CompactionSettings {
	enabled?: boolean;
	reserveTokens?: number;
	keepRecentTokens?: number;
	customInstructions?: string;
}

export interface ContextUsage {
	inputTokens: number;
	messageCount: number;
}

const estimateTokens = (value: string): number => Math.ceil(value.length / 4);

function messageText(message: Message): string {
	if (message.role === "user") return message.content;
	if (message.role === "tool") return message.content;
	return `${message.content}${JSON.stringify(message.toolCalls)}`;
}

function summaryMessageText(message: Message): string {
	if (message.role !== "tool" || message.content.length <= TOOL_RESULT_SUMMARY_MAX_CHARS) {
		return messageText(message);
	}

	return `${message.content.slice(0, TOOL_RESULT_SUMMARY_MAX_CHARS)}\n[工具结果已截断]`;
}

function isSafeCut(messages: Message[], index: number): boolean {
	return messages[index]?.role !== "tool";
}

export async function compactContext(
	messages: Message[],
	model: Model,
	systemPrompt: string,
	tools: ToolDefinition[],
	settings: CompactionSettings = {},
	signal?: AbortSignal,
	force = false,
	usage?: ContextUsage,
): Promise<Message[]> {

	const contextWindow = model.contextWindow ?? 0;
	if (!force && (settings.enabled === false || contextWindow <= 0)) {
		return messages;
	}

	const reserveTokens = settings.reserveTokens ?? 16_384;

	const keepRecentTokens = settings.keepRecentTokens ?? 20_000;

	const estimatedTokens =
		estimateTokens(systemPrompt + JSON.stringify(tools)) +
		messages.reduce(
			(total, message) => total + estimateTokens(messageText(message)),
			0,
		);

	const contextTokens =
		usage && usage.messageCount <= messages.length
			? usage.inputTokens +
				messages
					.slice(usage.messageCount)
					.reduce(
						(total, message) => total + estimateTokens(messageText(message)),
						0,
					)
			: estimatedTokens;

	if (!force && contextTokens <= contextWindow - reserveTokens) {
		return messages;
	}

	const previousSummary =
		messages[0]?.role === "user" &&
		messages[0].content.startsWith(SUMMARY_PREFIX)
			? messages[0].content.slice(SUMMARY_PREFIX.length)
			: undefined;

	const prefixStart = previousSummary ? 1 : 0;

	let cut = messages.length;
	let tailTokens = 0;

	while (cut > prefixStart && tailTokens < keepRecentTokens) {
		cut--;
		tailTokens += estimateTokens(messageText(messages[cut]!));
	}

	while (cut > prefixStart && !isSafeCut(messages, cut)) {
		cut--;
	}

	const toSummarize = messages.slice(prefixStart, cut);

	if (toSummarize.length === 0) {
		return messages;
	}

	const conversation = toSummarize
		.map((message) => `${message.role}: ${summaryMessageText(message)}`)
		.join("\n\n");

	const prompt = [
		previousSummary &&
			`<previous-summary>\n${previousSummary}\n</previous-summary>`,
		`<conversation>\n${conversation}\n</conversation>`,
		previousSummary
			? "请根据新增对话更新已有摘要，保留目标、约束、决定、进度、后续步骤和准确文件路径。"
			: "请为接手任务的 Agent 总结本次编程对话。按以下标题组织：目标、约束与偏好、进度（已完成/进行中/受阻）、关键决定、下一步、关键上下文。内容精简，并保留准确文件路径、函数名和错误信息。",
		settings.customInstructions,
	]
		.filter(Boolean)
		.join("\n\n");

	const summary = await model.generate({
		systemPrompt: "你只负责压缩对话上下文，不要回答对话中的问题，也不要调用工具。",
		messages: [{ role: "user", content: prompt }],
		tools: [],

		maxTokens: Math.floor(reserveTokens * 0.8),
		signal,
	});

	if (summary.toolCalls.length > 0) {
		throw new Error("Context summary attempted to call a tool");
	}

	if (!summary.content.trim()) {
		throw new Error("Context summary returned no content");
	}

	return [
		{ role: "user", content: `${SUMMARY_PREFIX}${summary.content}` },
		...messages.slice(cut),
	];
}
