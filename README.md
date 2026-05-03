<div align="center">

<img src="resources/logo.svg" alt="Opico Agent Logo" width="64" height="64" />

# Opico Agent

**A full-stack, autonomous AI coding agent built as a VS Code extension**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-blue?logo=visual-studio-code)](https://marketplace.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-React-646CFF?logo=vite)](https://vitejs.dev/)
[![Vercel AI SDK](https://img.shields.io/badge/Vercel_AI_SDK-Streamlined-black?logo=vercel)](https://sdk.vercel.ai/)

</div>

---

## Overview

**Opico Agent** is a fully autonomous AI coding assistant that lives inside the VS Code sidebar as a native webview panel. It features a custom-built streaming agent loop, a type-safe tool system with runtime validation, a command approval gate for safe execution, persistent conversation history with branching, file mention autocomplete, and a polished React UI with real-time diff previews.

The project spans two distinct build targets — a **Node.js extension host** (esbuild-bundled TypeScript) and a **React webview frontend** (Vite + Tailwind v4) — communicating over a typed bidirectional message bridge.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Extension Host                   │
│                                                              │
│  extension.ts ──► ChatWebviewProvider ◄──► AgentService      │
│                       │                          │           │
│                       │                   ┌──────┴──────┐    │
│                       │                   │ ToolRegistry │    │
│                       │                   │  ┌─────────┐ │    │
│                       │                   │  │BaseTool  │ │    │
│                       │                   │  │(generic) │ │    │
│                       │                   │  └────┬────┘ │    │
│                       │                   │  ┌────┴────┐ │    │
│                       │                   │  │5 Tools  │ │    │
│                       │                   │  └─────────┘ │    │
│                       │                   └─────────────┘    │
│                       │                          │           │
│              CommandApprovalManager               │           │
│              (pending/allow/deny/abort)            │           │
│                       │                                      │
│              VS Code GlobalState                             │
│              (conversation persistence)                      │
└───────────────────────┬─────────────────────────────────────┘
                        │ postMessage bridge (typed)
┌───────────────────────┴─────────────────────────────────────┐
│                    React Webview (Vite)                       │
│                                                              │
│  App.tsx ──► useExtensionBridge (state machine hook)         │
│                │                                             │
│     ┌──────────┼──────────┬──────────────┐                   │
│     ▼          ▼          ▼              ▼                   │
│  ChatMessage  ToolBadge  HistoryPanel  PromptInputBox        │
│  (markdown +  (collapsible (slide-over     (@ file          │
│   reasoning)   diff view)  panel w/         mention +        │
│                            animations)      autocomplete)    │
└─────────────────────────────────────────────────────────────┘
```

## Key Features & Engineering Highlights

### Autonomous Multi-Step Agent Loop

The agent iterates up to **25 tool-use steps** per user message using the Vercel AI SDK's `streamText` with `stopWhen: stepCountIs(25)`. Each step can chain tools, read context, and self-correct. The streaming response is consumed via `fullStream` async iteration, with events dispatched individually for real-time UI updates.

- **Graceful abort handling**: On `AbortError`, partial responses are salvaged and appended to conversation history so context isn't lost
- **System prompt generation**: Dynamically injects workspace path, platform info, and registered tool names at runtime

### Type-Safe Tool System with Runtime Validation

Every tool extends a generic `BaseTool<T>` abstract class where `T` is a **Zod schema**. This provides:
- **Compile-time type safety**: `execute(params: z.infer<T>)` — the parameter type is auto-inferred from the schema
- **Runtime validation**: Schemas are passed to the LLM via `zodSchema()` for structured tool calling
- **Self-documenting**: Each schema field includes `.describe()` annotations visible to the LLM

```typescript
export abstract class BaseTool<T extends z.ZodTypeAny = z.ZodTypeAny> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly schema: T;
  abstract execute(params: z.infer<T>): Promise<ToolResult>;
}
```

The `ToolRegistry` maps tool instances to Vercel AI SDK `Tool` objects, with special-case wiring for the command approval flow on `execute_command`.

### 5 Built-in Workspace Tools

| Tool | Description | Engineering Detail |
|------|-------------|-------------------|
| `read_file` | Read files with optional line-range pagination | Line-numbered output with header showing range context |
| `replace_in_file` | Search/Replace file editing (no line numbers) | Validates uniqueness of search block, computes diff stats via `diff` package |
| `execute_command` | Shell command execution with approval gate | Cross-platform shell detection, output truncation with disk dump for large outputs |
| `search_workspace` | Full-text regex search via ripgrep | Bundles `@vscode/ripgrep`, configurable include/exclude globs, structured output |
| `list_directory` | Directory tree listing as JSON | Recursive with configurable max depth, smart ignore filtering |

### Command Approval & Abort System

A dedicated `CommandApprovalManager` implements a **pending → approved/executing → done** lifecycle:

```
LLM calls execute_command → CommandApprovalManager.requestApproval()
  → Webview shows Allow/Deny buttons
    → User approves → process spawns → Abort button appears
      → User aborts → process.kill()
    → User denies → Promise resolves false → tool returns denial message
```

This runs over the webview message bridge with state tracked in a React Context (`CommandApprovalContext`), enabling per-command granularity.

### Persistent Conversation History with Branching

Conversations are serialized as `StoredConversation` objects in VS Code's `globalState` storage, preserving both UI entries and raw `ModelMessage[]` arrays for perfect LLM context restoration.

- **Branch from any point**: Users can branch a conversation from any user message, creating a new conversation that inherits prior context up to that point
- **Incomplete turn trimming**: Partial tool-call cycles (tool called but no result) are automatically trimmed from restored history to prevent LLM errors
- **Title auto-derivation**: Conversation titles are derived from the first user message

### File Mention Autocomplete (`@` mentions)

The prompt input supports `@`-triggered file/folder mention with:
- **Recursive workspace scanning** with configurable depth limits and smart ignore patterns (skips `node_modules`, `.git`, `dist`, etc.)
- **Fuzzy scoring engine**: Results are ranked by match position, filename exactness, and type preference
- **5-second cache**: File list is cached with TTL-based invalidation for responsive repeated queries

### Real-Time Streaming UI

The webview renders the agent's streamed response in real-time with three segment types:

1. **Text** — Markdown rendered via `react-markdown` with GFM support, file path links that open in the editor
2. **Reasoning** — Collapsible `<details>` block with purple accent styling
3. **Tool calls** — `ToolBadge` components with per-tool icons, inline diff previews for file edits, and command approval buttons

A custom `collateEvents()` function merges consecutive deltas of the same type and matches tool-call events with their corresponding tool-result events for correct phase rendering.

### React Webview Architecture

The frontend uses a **typed bidirectional message bridge** (`useExtensionBridge` hook) with:
- `IncomingMessage` and `OutgoingMessage` discriminated union types for full type safety
- `acquireVsCodeApi()` singleton pattern to prevent re-initialization on React re-renders
- Ref-based state access for async callbacks (`entriesRef`)

### Provider-Agnostic LLM Integration

Supports **5 provider backends** out of the box through the Vercel AI SDK:

| Provider | Package | Notes |
|----------|---------|-------|
| Anthropic | `@ai-sdk/anthropic` | Default, `claude-3-5-sonnet` |
| OpenAI | `@ai-sdk/openai` | `gpt-4o`, etc. |
| Google Gemini | `@ai-sdk/google` | API key based |
| Google Vertex | `@ai-sdk/google-vertex` | Service account based |
| OpenAI-Compatible | `@ai-sdk/openai-compatible` | Ollama, Together, DeepSeek, etc. |

API keys fall back through: VS Code settings → provider-specific settings → environment variables.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension Host | TypeScript, Node.js, VS Code Extension API |
| Bundler (Extension) | esbuild with custom watch plugin |
| Bundler (Webview) | Vite |
| UI Framework | React 19, Tailwind CSS v4 |
| Animation | Framer Motion |
| Icons | Lucide React |
| Markdown | react-markdown + remark-gfm |
| LLM SDK | Vercel AI SDK v6 |
| Schema Validation | Zod v4 |
| Diff Computation | `diff` npm package |
| Search Engine | `@vscode/ripgrep` |

## Project Structure

```
opico-agent/
├── src/                          # Extension (Node.js) source
│   ├── extension.ts              # Activation entry point
│   ├── llm/
│   │   └── AgentService.ts       # Agent loop, provider factory, streaming
│   ├── providers/
│   │   └── ChatWebviewProvider.ts # Webview bridge, conversation persistence, file scanning
│   ├── tools/
│   │   ├── BaseTool.ts           # Generic abstract base class
│   │   ├── ToolRegistry.ts       # Tool registration & AI SDK adapter
│   │   ├── CommandApprovalManager.ts # Approval/abort lifecycle
│   │   ├── ExecuteCommandTool.ts  # Shell execution with approval
│   │   ├── ReadFileTool.ts       # File reading with line ranges
│   │   ├── ReplaceInFileTool.ts  # Search/replace with diff stats
│   │   ├── SearchWorkspaceTool.ts # Ripgrep-powered search
│   │   └── ListDirectoryTool.ts  # Recursive directory tree
│   └── utils/
│       └── diffHelper.ts         # Diff stats & unified diff generation
├── webview/                      # React webview frontend
│   ├── src/
│   │   ├── App.tsx               # Root component with hero/chat states
│   │   ├── components/
│   │   │   ├── ChatMessage.tsx   # Message rendering with reasoning & tool badges
│   │   │   ├── ToolBadge.tsx     # Collapsible tool call UI with diff preview
│   │   │   ├── HistoryPanel.tsx  # Slide-over conversation history
│   │   │   ├── SettingsModal.tsx # Provider/model/API key configuration
│   │   │   └── ui/
│   │   │       └── ai-prompt-box.tsx # Prompt input with @ mention autocomplete
│   │   ├── contexts/
│   │   │   └── CommandApprovalContext.tsx # Command state context
│   │   └── hooks/
│   │       └── useExtensionBridge.ts # Typed VS Code message bridge
│   ├── vite.config.ts
│   └── tailwind.config.ts
├── esbuild.js                    # Extension build config
├── models.json                   # 50+ pre-configured model definitions
└── package.json                  # Extension manifest & dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+
- VS Code 1.85+

### Build

```bash
# Install all dependencies
npm install
cd webview && npm install && cd ..

# Production build
npm run build

# Development (watch both extension and webview)
npm run dev
```

### Debug

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. The Opico Agent sidebar icon appears in the Activity Bar

### Configuration

Configure via the extension's Settings modal (gear icon) or `settings.json`:

| Setting | Description | Default |
|---------|-------------|---------|
| `opico-agent.modelProvider` | AI provider (`anthropic`, `openai`, `google`, `vertex`, `openai-compatible`) | `anthropic` |
| `opico-agent.modelName` | Model identifier | `claude-3-5-sonnet-20241022` |
| `opico-agent.apiKey` | Provider API key (falls back to env vars) | — |
| `opico-agent.apiBaseUrl` | Custom endpoint URL for OpenAI-compatible providers | — |

## Extending with Custom Tools

The tool system is designed for extensibility. Create a new tool by extending `BaseTool`:

```typescript
import { z } from "zod";
import { BaseTool, ToolResult } from "./tools/BaseTool";

const MySchema = z.object({
  target: z.string().describe("What the tool acts on"),
});

export class MyTool extends BaseTool<typeof MySchema> {
  name = "my_tool";
  description = "Description the LLM uses to decide when to invoke this tool.";
  schema = MySchema;

  async execute(params: z.infer<typeof MySchema>): Promise<ToolResult> {
    return { content: `Acted on: ${params.target}` };
  }
}
```

Register it in `AgentService`:

```typescript
this.registry = new ToolRegistry([
  // ...existing tools
  new MyTool(),
]);
```

The agent automatically understands how and when to use it — the schema and description are sent to the LLM as tool definitions.

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Search/Replace over line numbers** for `replace_in_file` | Avoids off-by-one errors and stale references. The LLM provides exact code blocks, and uniqueness is validated before applying. |
| **Zod schemas as single source of truth** | One schema definition drives both TypeScript types (compile-time) and LLM parameter definitions (runtime). |
| **Command approval gate** | Shell commands are inherently destructive. The approval system gives users full control with allow/deny/abort granularity. |
| **Ripgrep via `@vscode/ripgrep`** | Guarantees availability without requiring system installation, and matches VS Code's own search backend. |
| **Dual build pipeline** (esbuild + Vite) | esbuild is ideal for the Node.js extension host (CJS output, external `vscode`), while Vite provides HMR and optimized bundling for the React webview. |
| **Typed message bridge** | Discriminated unions on both `IncomingMessage` and `OutgoingMessage` ensure compile-time safety across the webview boundary. |

## License

This project is licensed under the MIT License.
