const MAX_TOOL_OUTPUT_CHARS = 20_000;

export function limitToolOutput(value: string): string {
	if (value.length <= MAX_TOOL_OUTPUT_CHARS) return value;
	return `${value.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n\n[输出过长，已截断]`;
}
