import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "@tinycodingagent/agent";
import { parseObject } from "./parse-object.js";
import { limitToolOutput } from "./limit-output.js";

export const readTool: Tool<{ path: string }> = {
	name: "read",
	description: "阅读文件中全部文本内容",
	parameters: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "目标文件的的路径",
			},
		},
		required: ["path"],
	},
	parse(input) {
		const value = parseObject(input);
		if (typeof value.path !== "string") throw new Error("path must be a string");
		return { path: value.path };
	},
	async execute({ path }) {
		return limitToolOutput(await readFile(resolve(path), "utf-8"));
	},
};
