import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

export const authPath = join(homedir(), ".tinycodingagent", "auth.json");

const keys = ["MODEL", "API_KEY", "BASE_URL", "CONTEXT_WINDOW"] as const;
type Config = Partial<Record<(typeof keys)[number], string>>;

function readConfig(): Config {
  return existsSync(authPath) ? JSON.parse(readFileSync(authPath, "utf8")) : {};
}

export function loadConfig(): void {
  const config = readConfig();
  for (const key of keys) {
    if (process.env[key] === undefined && config[key] !== undefined) process.env[key] = String(config[key]);
  }
}

export async function configure(): Promise<void> {
  const config = readConfig();
  const rl = createInterface({ input, output });
  const abort = new AbortController();
  rl.on("SIGINT", () => abort.abort());
  const ask = async (key: (typeof keys)[number]): Promise<string> => {
    const answer = rl.question(`${key}:`, { signal: abort.signal });
    rl.write(String(process.env[key] ?? config[key] ?? ""));
    return answer;
  };

  try {
    const values: Record<(typeof keys)[number], string> = {
      MODEL: await ask("MODEL"),
      API_KEY: await ask("API_KEY"),
      BASE_URL: await ask("BASE_URL"),
      CONTEXT_WINDOW: await ask("CONTEXT_WINDOW"),
    };
    mkdirSync(dirname(authPath), { recursive: true });
    writeFileSync(authPath, `${JSON.stringify(values, null, 2)}\n`);
    output.write(`配置已保存：${authPath}\n`);
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "AbortError") throw error;
    output.write("\n配置已取消\n");
  } finally {
    rl.close();
  }
}
