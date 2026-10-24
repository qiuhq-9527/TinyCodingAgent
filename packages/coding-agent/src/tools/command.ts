import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "@tinycodingagent/agent";
import { parseObject } from "./parse-object.js";
import { limitToolOutput } from "./limit-output.js";


const run = promisify(exec);


export const commandTool: Tool<{ command: string }> = {

	name: "command",
	description: "执行一条 shell 命令并返回其输出，用于 ls、mkdir、git 等命令行操作",
	parameters: {
		type: "object",
		properties: {
			command: { type: "string", description: "要执行的 shell 命令" },
		},
		required: ["command"],
	},

	parse(input) {
		const value = parseObject(input);
		if (typeof value.command !== "string") throw new Error("command must be a string");
		return { command: value.command };
	},

	async execute({ command }) {
		const { stdout } = await run(command);
		return limitToolOutput(stdout);
	},
};
