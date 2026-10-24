export function parseObject(input: unknown): Record<string, unknown> {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new Error("arguments must be an object");
	}
	return input as Record<string, unknown>;
}
