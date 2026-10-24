import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Tool } from "@tinycodingagent/agent";
import { parseObject } from "./parse-object.js";


export const writeTool: Tool<{ path: string; content: string }> = {

	name: "write",
	description: "把内容写入文件：文件不存在则创建，存在则覆盖，自动创建父目录",
	parameters: {
		type: "object",
		properties: {
			path: { type: "string", description: "要写入的目标文件路径（相对或绝对）" },
			content: { type: "string", description: "要写入文件的完整内容" },
		},
		required: ["path", "content"],
	},

	parse(input) {
		const value = parseObject(input);
		if (typeof value.path !== "string") throw new Error("path must be a string");
		if (typeof value.content !== "string") throw new Error("content must be a string");
		return { path: value.path, content: value.content };
	},

	async execute({ path, content }) {
		const absolutePath = resolve(path);
		await mkdir(dirname(absolutePath), { recursive: true });
		await writeFile(absolutePath, content, "utf-8");
		return `Wrote ${content.length} bytes to ${path}`;
	},
};
