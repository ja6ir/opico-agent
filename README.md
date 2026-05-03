[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-blue?logo=visual-studio-code)](https://marketplace.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript)](https://www.typescriptlang.org/)

# Opico Agent

**Opico Agent** is an autonomous AI coding assistant that lives directly inside your VS Code workspace. 

Powered by the [Vercel AI SDK](https://sdk.vercel.ai/), Opico goes beyond standard autocomplete or chat. It utilizes a powerful multi-step tool-use loop to autonomously explore your codebase, execute commands, and refactor files. Whether you are using Anthropic, OpenAI, Google Gemini, Vertex, or a local open-source model, Opico Agent adapts to your workflow.

## ✨ Key Features

*   **Autonomous Multi-Step Execution:** Give the agent a complex objective, and it will iterate up to 25 times per session—chaining tools, reading context, and verifying results without needing constant prompting.
*   **Provider Agnostic:** Out-of-the-box support for the leading AI providers, plus 50+ pre-configured models (via OpenRouter, Together, DeepSeek, etc.). You can easily plug in any OpenAI-compatible endpoint for local models (like Ollama).
*   **Live Action & Reasoning:** Watch the agent think and act in real-time. Reasoning traces are neatly tucked into collapsible blocks, and tool executions (like running terminal commands) merge seamlessly into the chat stream with live status indicators.
*   **Built-in Workspace Tools:** The agent comes equipped with a core set of file-system tools allowing it to act as an independent developer:
    *   `read_file`
    *   `replace_in_file`
    *   `execute_command`
    *   `search_workspace`
    *   `list_directory`

## ⚙️ Configuration

You can easily configure your preferred provider, model, and API keys directly via the extension's Settings modal (the gear icon in the webview) or through your VS Code `settings.json`:

*   `opico-agent.modelProvider` — Choose from `anthropic`, `openai`, `google`, `vertex`, or `openai-compatible`.
*   `opico-agent.modelName` — Specify the model (e.g., `claude-3-5-sonnet-20241022`, `gpt-4o`).
*   `opico-agent.apiKey` — Your provider API key (securely falls back to environment variables).
*   `opico-agent.apiBaseUrl` — Custom base URL for OpenAI-compatible providers.

## 🛠️ Development

Opico Agent is built with TypeScript, utilizing a Node.js extension host and a Vite + Tailwind React frontend.

```bash
# 1. Install dependencies for both the extension and the webview
npm install
cd webview && npm install && cd ..

# 2. Build the project
npm run build

# 3. Run watch mode (compiles extension + webview in parallel for active development)
npm run dev
```

### Adding Custom Tools

The agent is highly extensible. To give the agent new capabilities, simply extend the `BaseTool` class, define your Zod schema, and register it. The agent will automatically understand how and when to use it.

```typescript
import { z } from "zod";
import { BaseTool } from "./tools/BaseTool";

const MySchema = z.object({
  // Define the inputs your tool requires from the LLM
});

export class MyTool extends BaseTool<typeof MySchema> {
  name = "my_tool";
  description = "A clear description so the LLM knows when to trigger this tool.";
  schema = MySchema;

  async execute(params: z.infer<typeof MySchema>): Promise<ToolResult> {
    // Your tool's logic here
    return { success: true, data: "Tool executed successfully!" };
  }
}
```

Once created, add your new tool to the `ToolRegistry` inside your `AgentService` initialization.

## 📄 License

This project is licensed under the MIT License.

```text
MIT License

Copyright (c) 2024 [Your Name/Organization]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
