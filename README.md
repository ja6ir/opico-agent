# Opico Agent

An autonomous AI coding agent for VS Code. Powered by the [Vercel AI SDK](https://sdk.vercel.ai/) with multi-provider support (Anthropic, OpenAI, Google Gemini, Vertex, and any OpenAI-compatible endpoint), it runs multi-step tool-use loops directly inside your IDE.

## Features

- **Multi-step agentic loop** — up to 25 tool-call iterations per session, driven by `streamText`'s `stopWhen` / `fullStream` API
- **Sequential event stream** — text deltas, reasoning traces, tool calls, and tool results render in the order they occur, with no message-bubble wrapping
- **Markdown rendering** — all assistant text is parsed through `react-markdown` for clean formatting
- **Collapsible reasoning** — thinking/reasoning chunks render in a collapsible `<details>` block
- **Merged tool badges** — a tool call and its result merge into a single badge that updates in-place (spinner → result/error)
- **5 built-in tools**: `read_file`, `replace_in_file`, `execute_command`, `search_workspace`, `list_directory`
- **50+ pre-configured models** via `models.json` (OpenRouter, Together, NVIDIA, DeepSeek, Qwen, Moonshot, and more)
- **OpenAI-compatible provider** — add any endpoint with custom base URL and model name

## Architecture

```
opico-agent/
├── src/                          # VS Code extension (Node/TypeScript)
│   ├── extension.ts               # Entry point, registers ChatWebviewProvider
│   ├── llm/
│   │   └── AgentService.ts       # Orchestrates streamText, fullStream iteration,
│   │                               # event-to-callback bridge, conversation history
│   ├── providers/
│   │   └── ChatWebviewProvider.ts # Webview lifecycle + postMessage relay
│   └── tools/
│       ├── BaseTool.ts            # Abstract base class for all tools (Zod schema)
│       ├── ToolRegistry.ts        # Converts BaseTool[] → AI SDK Tool map
│       ├── ReadFileTool.ts
│       ├── ReplaceInFileTool.ts
│       ├── ExecuteCommandTool.ts
│       ├── SearchWorkspaceTool.ts
│       └── ListDirectoryTool.ts
├── webview/                       # React frontend (Vite + Tailwind)
│   └── src/
│       ├── App.tsx                # Main layout, initial screen, message list
│       ├── hooks/
│       │   └── useExtensionBridge.ts  # postMessage sync, ChatEntry state management
│       └── components/
│           ├── ChatMessage.tsx    # Sequential rendering: text, reasoning, tool badges
│           ├── ToolBadge.tsx      # Merged call+result badge with spinner/checkmark
│           ├── SettingsModal.tsx  # Provider/model/API key configuration
│           └── ui/ai-prompt-box.tsx
├── models.json                    # Pre-configured OpenAI-compatible model list
├── package.json
└── tsconfig.json
```

## How It Works

1. User types a prompt in the webview input
2. `useExtensionBridge` sends `SEND_PROMPT` to the extension host via `postMessage`
3. `AgentService.sendMessage` calls `streamText` with the full `ModelMessage[]` history
4. `result.fullStream` yields typed events: `text-delta`, `reasoning-delta`, `tool-call`, `tool-result`, `start-step`, `finish-step`
5. Each event is relayed to the webview as `AGENT_EVENT` via `postMessage`
6. The hook accumulates events into `ChatEntry[]` — either a `UserMessage` or an `AssistantTurn` with a sequential `AgentStreamEvent[]`
7. `ChatMessage` collates events into `CollatedSegment[]` (merged text, reasoning, tool segments) and renders them with `react-markdown`

## Tool Schema Auto-generation

Each `BaseTool` subclass declares a `schema: T` (a Zod object). `ToolRegistry.getTools()` wraps it with:

```ts
tool({
  description: toolInstance.description,
  inputSchema: zodSchema(toolInstance.schema),
  execute: async (params) => { ... }
})
```

The AI SDK's `asSchema` function handles both Zod v3 and v4, extracting the JSON schema to send to the LLM provider.

## Development

```bash
# Install dependencies
npm install
cd webview && npm install && cd ..

# Build both extension + webview
npm run build

# Watch mode (extension + webview in parallel)
npm run dev

# Compile extension only
npm run compile

# Lint
npm run lint
```

## Configuration

Set provider, model, and API key via the Settings modal (gear icon) or VS Code settings:

- `opico-agent.modelProvider` — `anthropic`, `openai`, `google`, `vertex`, `openai-compatible`
- `opico-agent.modelName` — e.g. `claude-3-5-sonnet-20241022`, `gpt-4o`
- `opico-agent.apiKey` — provider API key (falls back to env vars)
- `opico-agent.apiBaseUrl` — for OpenAI-compatible providers

## Adding Tools

Extend `BaseTool<T>` and register in `AgentService.constructor`:

```ts
export class MyTool extends BaseTool<typeof MySchema> {
  name = "my_tool";
  description = "Does something useful";
  schema = MySchema;

  async execute(params: z.infer<typeof MySchema>): Promise<ToolResult> {
    // implementation
  }
}
```

Then add to `new ToolRegistry([..., new MyTool()])` in `AgentService`.

---

**License:** MIT