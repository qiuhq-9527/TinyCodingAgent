import type {
    AgentEvent,
    AgentSession,
    AgentResult,
    Message,
    RunAgentOptions,
    Tool,
    ToolCall,
    ToolResultMessage,
} from "./types.js";
import { compactContext, type CompactionSettings } from "./compaction/compaction.js";

const stringify = (value: unknown): string => {
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value, null, 2) ?? String(value);
    } catch {
        return String(value);
    }
};

const errorText = (error: unknown): string =>
    error instanceof Error ? error.message : String(error)

async function executeTool(call: ToolCall, tools: Map<string, Tool<any>>, signal: AbortSignal | undefined, emit: (event: AgentEvent) => Promise<void>): Promise<ToolResultMessage> {
    await emit({ type: "tool_start", call })
    const tool = tools.get(call.name)
    let result: ToolResultMessage;

    if (!tool) result = { role: "tool", toolCallId: call.id, name: call.name, content: `Unknown tool: ${call.name}`, isError: true }
    else {
        try {
            signal?.throwIfAborted()
            const args = tool.parse(call.arguments)
            const value = await tool.execute(args, signal);
            result = { role: "tool", toolCallId: call.id, name: call.name, content: stringify(value), isError: false }
        } catch (error) {
            result = { role: "tool", toolCallId: call.id, name: call.name, content: errorText(error), isError: true }
        }
    }

    await emit({ type: "tool_end", call, result })
    return result
}

export async function runAgent(input: string, options: RunAgentOptions): Promise<AgentResult> {
    const { model, tools, signal, systemPrompt = "你是Coding助手，擅长调用工具实现需求", maxTurns = 8, onEvent } = options
    const toolMap = new Map(tools.map(tool => [tool.name, tool]))
    const definitions = tools.map(({ name, description, parameters }) => ({ name, description, parameters }))
    const session = options.session ?? createAgentSession()
    const { messages } = session
    const userMessage: Message = { role: "user", content: input }
    messages.push(userMessage)
    session.contextMessages.push(userMessage)

    const emit = async (event: AgentEvent): Promise<void> => { await onEvent?.(event) }
    await emit({ type: "agent_start", input })

    for (let turn = 1; turn <= maxTurns; turn += 1) {
        signal?.throwIfAborted();
        await emit({ type: "turn_start", turn });

        const previousContext = session.contextMessages;
        session.contextMessages = await compactContext(previousContext, model, systemPrompt, definitions, options.compaction, signal, false, session.contextUsage);
        if (session.contextMessages !== previousContext) session.contextUsage = undefined;
        const assistant = await model.generate({ systemPrompt, messages: session.contextMessages, tools: definitions, signal })
        session.contextUsage = assistant.usage
            ? { inputTokens: assistant.usage.inputTokens, messageCount: session.contextMessages.length }
            : undefined;
        messages.push(assistant)

        session.contextMessages.push(assistant)
        await emit({ type: "assistant", turn, message: assistant })

        if (assistant.toolCalls.length === 0) {
            await emit({ type: "turn_end", turn, messages })
            const result = { output: assistant.content, messages, session, turns: turn }
            await emit({ type: "agent_end", result })
            return result
        }

        const results = await Promise.all(
            assistant.toolCalls.map(call => executeTool(call, toolMap, signal, emit))
        )
        messages.push(...results)

        session.contextMessages.push(...results)
        await emit({type:"turn_end",turn,messages})
    }

    throw new Error(`Agent exceeded maxTurns=${maxTurns}`);
}

export function createAgentSession(): AgentSession {
    return { messages: [], contextMessages: [] }
}

export async function compactAgentSession(
    session: AgentSession,
    model: RunAgentOptions["model"],
    tools: Tool[],
    systemPrompt = "你是Coding助手，擅长调用工具实现需求",
    settings: CompactionSettings = {},
    signal?: AbortSignal,
): Promise<boolean> {
    const definitions = tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
    const compacted = await compactContext(session.contextMessages, model, systemPrompt, definitions, settings, signal, true, session.contextUsage);
    if (compacted === session.contextMessages) return false;
    session.contextMessages = compacted;
    session.contextUsage = undefined;
    return true;
}
