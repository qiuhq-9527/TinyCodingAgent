#!/usr/bin/env node

import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { compactAgentSession, createAgentSession, runAgent } from "@tinycodingagent/agent";
import type { AgentEvent } from "@tinycodingagent/agent";
import { OpenAIProvider } from "@tinycodingagent/ai";
import type { Model } from "@tinycodingagent/ai";
import { authPath, configure, loadConfig } from "./config.js";
import { tools } from "./tools/index.js";

async function main(): Promise<void> {
  if (process.argv[2] === "config") {
    await configure();
    return;
  }
  loadConfig();

  const argvPrompt = process.argv.slice(2).join(" ");
  const inputLine = "─".repeat(Math.max(1, (output.columns ?? 100) - 1));

  function createModel(): Model {
    const model = process.env.MODEL;
    if (!model) throw new Error(`MODEL is required; configure ${authPath}`);
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error(`API_KEY is required; configure ${authPath}`);

    const contextWindow = Number(process.env.CONTEXT_WINDOW);
    return new OpenAIProvider({
      model,
      apiKey,
      baseUrl: process.env.BASE_URL || undefined,
      contextWindow: Number.isFinite(contextWindow) && contextWindow > 0 ? contextWindow : undefined,
    })
  }

  function printEvent(event: AgentEvent): void {
    switch (event.type) {
      case "turn_start":
        console.log(`\n[turn ${event.turn}]`);
        break;
      case "assistant":
        if (event.message.content) console.log(`assistant: ${event.message.content}`);
        break;
      case "tool_start":
        console.log(`tool → ${event.call.name}`, event.call.arguments);
        break;
      case "tool_end":
        console.log(`tool ← ${event.call.name}: ${event.result.content}`);
        break;
    }
  }

  const session = createAgentSession();
  const model = createModel();
  const rl = createInterface({ input, output });
  const useAlternateScreen = input.isTTY && output.isTTY;
  rl.on("SIGINT", () => rl.close());
  let nextPrompt = argvPrompt;
  const systemPrompt = "你是一个编码助手，擅长用工具读写文件和执行命令。文件路径全部使用绝对路径。请结合本次会话中的历史消息理解用户的新要求。";

  function readInput(): Promise<string | null> {
    output.write(`${inputLine}\n`);
    return new Promise((resolve) => {
      const onClose = () => resolve(null);
      rl.once("close", onClose);
      rl.question("", (answer) => {
        rl.off("close", onClose);
        output.write("\x1b[1B\r");
        resolve(answer);
      });
      output.write(`\r\n${inputLine}\x1b[1A\r`);
    });
  }

  if (useAlternateScreen) output.write("\x1b[?1049h\x1b[2J\x1b[H");
  try {
    console.log("TinyCodingAgent V0.0.1");
    console.log("/exit 退出会话，/compact 压缩上下文");
    while (true) {
      const prompt = nextPrompt || await readInput();
      if (prompt === null) break;
      nextPrompt = "";
      if (prompt.trim() === "/exit") break;
      if (prompt.trim() === "/compact") {
        try {
          const compacted = await compactAgentSession(session, model, tools, systemPrompt);
          console.log(compacted ? "上下文已压缩。" : "没有可压缩的较早对话。");
        } catch (error) {
          console.error(`压缩失败：${error instanceof Error ? error.message : String(error)}`);
        }
        continue;
      }
      if (!prompt.trim()) continue;

      try {
        await runAgent(prompt, {
          model,
          tools,
          session,
          systemPrompt,
          onEvent: printEvent,
        });
      } catch (error) {
        console.error(`Agent 执行失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    rl.close();
    if (useAlternateScreen) output.write("\x1b[0m\x1b[?1049l");
  }
}

await main();
