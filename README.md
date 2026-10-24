# TinyCodingAgent

这一个简陋的编码Agent，也是我的第一个终端Agent项目（模仿[Pi](https://pi.dev/)做的）<br>
它基于TS和Node内置API，没有使用任何第三方运行时依赖（目的是暴露一切细节）<br>
目前它只是一个学习项目，或许能帮你从真实Agent的代码角度理解LoopEngineering（核心代码约100行）

![TinyCodingAgent 终端演示](assets/show.png)


## 快速开始

你可以从npm快速安装它，需要 Node.js 24.10.0 或更高版本。

```json
// 安装
npm install -g @tinycodingagent/coding-agent
// 更新
npm update -g @tinycodingagent/coding-agent
// 启动
tca
// 配置
tca config
```

配置文件位于 `<用户名>/.tinycodingagent/auth.json`，也可以手动设置：

```json
MODEL= //模型名称，比如:deepseek-flash
API_KEY= //厂商的KEY,需要申请前往:https://platform.deepseek.com/api_keys
BASE_URL=//模型的路径,比如:https://api.deepseek.com
CONTEXT_WINDOW=//模型最大上下文,留空时不启动自动上下文压缩，比如 DeepSeek-V4 系列模型最大上下文为:1048576
```

## 技术简介

架构和大量细节参考 [Pi](https://pi.dev/)来做的（也进行了大量简化处理），我认为PI的设计非常之优雅
- `@tinycodingagent/coding-agent` 提供 CLI 和各类工具
- `@tinycodingagent/agent` 实现 Agent 循环与上下文压缩
- `@tinycodingagent/ai` 定义模型接口并提供接口OpenaiAPI兼容器

```json
TinyCodingAgent/
├── packages/
│   ├── coding-agent/
│   │   ├── src/
│   │   │   ├── tools/
│   │   │   ├── cli.ts
│   │   │   └── config.ts
│   │   ├── package.json
│   ├── agent/
│   │   ├── src/
│   │   │   ├── compaction/
│   │   │   ├── index.ts
│   │   │   ├── run-agent.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   └── ai/
│       ├── src/
│       │   ├── providers/
│       │   ├── index.ts
│       │   └── types.ts
│       ├── package.json
```

