import { commandTool } from "./command.js";
import { readTool } from "./read.js";
import { writeTool } from "./write.js";

export { commandTool, readTool, writeTool };
export const tools = [readTool, writeTool, commandTool];
