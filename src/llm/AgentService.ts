import * as vscode from "vscode";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
import { ToolRegistry } from "../tools/ToolRegistry";
import { ReadFileTool } from "../tools/ReadFileTool";
import { ReplaceInFileTool } from "../tools/ReplaceInFileTool";
import { ExecuteCommandTool } from "../tools/ExecuteCommandTool";
import { SearchWorkspaceTool } from "../tools/SearchWorkspaceTool";
import { ListDirectoryTool } from "../tools/ListDirectoryTool";
import type { CommandApprovalManager } from "../tools/CommandApprovalManager";

export interface ModelConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseURL?: string;
}

export interface AgentCallbacks {
  onEvent: (event: AgentStreamEvent) => void;
  onError: (error: string) => void;
}

export type AgentStreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
  | { type: "step-start" }
  | { type: "step-end" }
  | { type: "done" };

export class AgentService {
  private registry: ToolRegistry;
  private conversationHistory: ModelMessage[] = [];
  private modelConfig: ModelConfig;
  private abortController: AbortController | null = null;
  private commandApproval?: CommandApprovalManager;

  constructor(workspaceRoot: string) {
    const config = vscode.workspace.getConfiguration("opico-agent");

    this.modelConfig = {
      provider: config.get<string>("modelProvider") || "anthropic",
      model: config.get<string>("modelName") || "claude-3-5-sonnet-20241022",
      apiKey: config.get<string>("apiKey") || undefined,
      baseURL: config.get<string>("apiBaseUrl") || undefined,
    };

    this.registry = new ToolRegistry([
      new ReadFileTool(),
      new ReplaceInFileTool(),
      new ExecuteCommandTool(workspaceRoot),
      new SearchWorkspaceTool(),
      new ListDirectoryTool(workspaceRoot),
    ]);

    console.log(
      `[AgentService] Initialized with ${this.registry.size} tools: ` +
        this.registry.getToolNames().join(", ")
    );
  }

  setCommandApproval(manager: CommandApprovalManager): void {
    this.commandApproval = manager;
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.commandApproval) {
      this.commandApproval.abortAll();
    }
  }

  private customFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    console.log(`\n========== [LLM API Request] ==========`);
    const urlStr = url instanceof Request ? url.url : String(url);
    console.log(`${init?.method || 'GET'} ${urlStr}`);

    // Log request headers
    if (init?.headers) {
      const headers: Record<string, string> = {};
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          // Mask API keys for security but show last 4 chars
          if (key.toLowerCase().includes('key') || key.toLowerCase().includes('auth') || key.toLowerCase().includes('authorization')) {
            headers[key] = `****${value.slice(-4)}`;
          } else {
            headers[key] = value;
          }
        });
      } else if (Array.isArray(init.headers)) {
        for (const [key, value] of init.headers) {
          if (key.toLowerCase().includes('key') || key.toLowerCase().includes('auth') || key.toLowerCase().includes('authorization')) {
            headers[key] = `****${String(value).slice(-4)}`;
          } else {
            headers[key] = String(value);
          }
        }
      } else if (typeof init.headers === 'object') {
        for (const [key, value] of Object.entries(init.headers as Record<string, string>)) {
          if (key.toLowerCase().includes('key') || key.toLowerCase().includes('auth') || key.toLowerCase().includes('authorization')) {
            headers[key] = `****${String(value).slice(-4)}`;
          } else {
            headers[key] = String(value);
          }
        }
      }
      console.log(`[Request Headers] ${JSON.stringify(headers, null, 2)}`);
    }

    if (init?.body) {
      try {
        const bodyStr = typeof init.body === 'string' ? init.body : init.body.toString();
        const bodyObj = JSON.parse(bodyStr);
        console.log(`[Request Body] ${JSON.stringify(bodyObj, null, 2)}`);
      } catch (e) {
        console.log(`[Request Body] ${init.body}`);
      }
    }
    console.log(`=======================================\n`);

    // Execute the request and log the raw response
    const response = await fetch(url, init);

    console.log(`\n========== [LLM API Response] ==========`);
    console.log(`[Response URL] ${urlStr}`);
    console.log(`[Response Status] ${response.status} ${response.statusText}`);
    console.log(`[Response Headers]`);
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    // Clone the response so we can read the body without consuming it
    const cloned = response.clone();

    // For non-streaming responses or error responses, log the body
    if (!response.ok || response.status >= 400) {
      try {
        const errorBody = await cloned.text();
        console.log(`[Response Body] ${errorBody}`);
      } catch (e) {
        console.log(`[Response Body] <could not read: ${(e as Error).message}>`);
      }
    } else {
      // For streaming responses, intercept the stream to log chunks
      const originalBody = response.body;
      if (originalBody) {
        const self = this;
        const loggedStream = new ReadableStream({
          start(controller) {
            const reader = originalBody.getReader();
            let totalChunks = 0;

            function pump(): Promise<void> {
              return reader.read().then(({ done, value }) => {
                if (done) {
                  console.log(`\n[Stream Complete] Total chunks: ${totalChunks}`);
                  console.log(`=======================================\n`);
                  controller.close();
                  return;
                }
                totalChunks++;
                // Log each chunk (limit to first 5 and last 5 to avoid spam)
                const chunkStr = new TextDecoder().decode(value);
                if (totalChunks <= 5) {
                  console.log(`[Stream Chunk #${totalChunks}] ${chunkStr.substring(0, 500)}${chunkStr.length > 500 ? '... (truncated)' : ''}`);
                } else if (totalChunks === 6) {
                  console.log(`[Stream] ... suppressing middle chunks ...`);
                }
                controller.enqueue(value);
                return pump();
              });
            }
            return pump();
          }
        });

        // Return a new Response with the logged stream, preserving original status/headers
        const loggedResponse = new Response(loggedStream, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });

        return loggedResponse;
      }
    }

    console.log(`=======================================\n`);
    return response;
  };

  private getModel() {
    switch (this.modelConfig.provider) {
      case "openai": {
        const apiKey =
          this.modelConfig.apiKey ||
          vscode.workspace
            .getConfiguration("opico-agent")
            .get<string>("openaiApiKey") || process.env.OPENAI_API_KEY;
        const provider = createOpenAI({ apiKey, fetch: this.customFetch });
        return provider.chat(this.modelConfig.model);
      }
      case "anthropic": {
        const apiKey =
          this.modelConfig.apiKey ||
          vscode.workspace
            .getConfiguration("opico-agent")
            .get<string>("anthropicApiKey") || process.env.ANTHROPIC_API_KEY;
        const provider = createAnthropic({ apiKey, fetch: this.customFetch });
        return provider(this.modelConfig.model);
      }
      case "google": {
        const apiKey =
          this.modelConfig.apiKey ||
          vscode.workspace
            .getConfiguration("opico-agent")
            .get<string>("googleApiKey") || process.env.GOOGLE_API_KEY;
        const provider = createGoogleGenerativeAI({ apiKey, fetch: this.customFetch });
        return provider(this.modelConfig.model);
      }
      case "vertex": {
        const project = process.env.GOOGLE_VERTEX_PROJECT;
        const location = process.env.GOOGLE_VERTEX_LOCATION;
        const provider = createVertex({ project, location });
        return provider(this.modelConfig.model);
      }
      case "openai-compatible": {
        const apiKey = this.modelConfig.apiKey || "sk-dummy";
        const baseURL = this.modelConfig.baseURL;
        const provider = createOpenAI({ apiKey, baseURL, fetch: this.customFetch });
        return provider.chat(this.modelConfig.model);
      }
      default:
        throw new Error(`Unsupported provider: ${this.modelConfig.provider}`);
    }
  }

  updateConfig(config: Partial<ModelConfig>): void {
    this.modelConfig = { ...this.modelConfig, ...config };
    console.log(`[AgentService] Config updated: ${JSON.stringify(this.modelConfig)}`);
  }

  getConversationHistory(): ModelMessage[] {
    return [...this.conversationHistory];
  }

  setConversationHistory(messages: ModelMessage[]): void {
    this.conversationHistory = [...messages];
    console.log(`[AgentService] Conversation history set (${messages.length} messages).`);
  }

  resetConversation(): void {
    this.conversationHistory = [];
    console.log("[AgentService] Conversation history cleared.");
  }

  async sendMessage(
    userMessage: string,
    callbacks: AgentCallbacks
  ): Promise<void> {
    const systemPrompt = this.buildSystemPrompt();

    this.conversationHistory.push({
      role: "user",
      content: userMessage,
    });

    let streamResult: Awaited<ReturnType<typeof streamText>> | null = null;

    try {
      console.log(`\n========== [AgentService Config] ==========`);
      console.log(`[Provider] ${this.modelConfig.provider}`);
      console.log(`[Model] ${this.modelConfig.model}`);
      console.log(`[API Key] ${this.modelConfig.apiKey ? `****${this.modelConfig.apiKey.slice(-4)} (len=${this.modelConfig.apiKey.length})` : '<NOT SET>'}`);
      console.log(`[Base URL] ${this.modelConfig.baseURL || '<NOT SET>'}`);
      console.log(`=============================================\n`);
      const model = this.getModel();

      this.abortController = new AbortController();

      streamResult = streamText({
        model,
        system: systemPrompt,
        messages: this.conversationHistory,
        tools: this.registry.getTools(this.commandApproval),
        stopWhen: stepCountIs(25),
        abortSignal: this.abortController.signal,
      });

      callbacks.onEvent({ type: "step-start" });

      for await (const part of streamResult.fullStream) {
        switch (part.type) {
          case "text-delta":
            callbacks.onEvent({ type: "text-delta", text: part.text });
            break;

          case "reasoning-delta":
            callbacks.onEvent({ type: "reasoning-delta", text: part.text });
            break;

          case "tool-call":
            callbacks.onEvent({
              type: "tool-call",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args: part.input,
            });
            break;

          case "tool-result":
            callbacks.onEvent({
              type: "tool-result",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              result: part.output,
              isError: (part as any).error != null,
            });
            break;

          case "start-step":
            callbacks.onEvent({ type: "step-start" });
            break;

          case "finish-step":
            callbacks.onEvent({ type: "step-end" });
            break;
        }
      }

      const response = await streamResult!.response;
      if (response?.messages) {
        this.conversationHistory.push(...response.messages);
      }

      this.abortController = null;
      callbacks.onEvent({ type: "done" });
    } catch (err: unknown) {
      this.abortController = null;

      if ((err as any)?.name === "AbortError") {
        try {
          const response = await streamResult?.response;
          if (response?.messages) {
            this.conversationHistory.push(...response.messages);
          }
        } catch {
          // partial response unavailable
        }
        callbacks.onEvent({ type: "done" });
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      callbacks.onError(message);
    }
  }

  private buildSystemPrompt(): string {
    return `You are Opico Agent, an expert autonomous AI coding assistant embedded in VS Code.

You have access to the following tools to help the user with their coding tasks:
${this.registry
  .getToolNames()
  .map((name) => `- ${name}`)
  .join("\n")}

## Core Principles
1. **Read before editing**: Always read a file before making changes to understand context.
2. **Search/Replace precision**: When using replace_in_file, provide EXACT code blocks — never guess at whitespace or indentation.
3. **Explain your reasoning**: Before using tools, briefly explain what you're about to do and why.
4. **Verify your work**: After making changes, read the file to confirm the edit was applied correctly.
5. **Be thorough**: Implement complete solutions, not partial ones with TODOs.
6. **Always reply after tools**: After you use a tool and receive the results, ALWAYS generate a response explaining the outcome or your next steps. Never stop without providing a final summary to the user.

## Workspace Context
- Working directory: ${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "unknown"}
- Platform: ${process.platform}
`;
  }
}
