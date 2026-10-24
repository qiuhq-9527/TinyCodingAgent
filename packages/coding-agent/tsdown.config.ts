import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "src/cli.ts",
	format: ["esm"],
	clean: true,
	deps: {
		alwaysBundle: [/^@tinycodingagent\//],
		onlyBundle: false,
	},
});
