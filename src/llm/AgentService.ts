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

/**
 * Configuration for which model to use.
 */
export interface ModelConfig {
  provider: string; // e.g. "openai", "anthropic", "google", "vertex", "openai-compatible"
  model: string;
  apiKey?: string;
  baseURL?: string;
}

/**
 * Callback types for streaming events back to the Webview.
 */
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

/**
 * AgentService orchestrates the LLM interaction loop.
 *
 * Responsibilities:
 * 1. Initialize the Vercel AI SDK provider (OpenAI or Anthropic).
 * 2. Register all tools via the ToolRegistry.
 * 3. Handle `streamText` calls with tool use, streaming chunks back to the Webview.
 * 4. Maintain conversation history as CoreMessage[].
 */
export class AgentService {
  private registry: ToolRegistry;
  private conversationHistory: ModelMessage[] = [];
  private modelConfig: ModelConfig;

  constructor(workspaceRoot: string) {
    const config = vscode.workspace.getConfiguration("opico-agent");
    
    // Default model — can be changed via settings
    this.modelConfig = {
      provider: config.get<string>("modelProvider") || "anthropic",
      model: config.get<string>("modelName") || "claude-3-5-sonnet-20241022",
      apiKey: config.get<string>("apiKey") || undefined,
      baseURL: config.get<string>("apiBaseUrl") || undefined,
    };

    // Register all tools
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

  /**
   * Custom fetch interceptor to log all requests going to the LLM.
   */
  private customFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    console.log(`\n========== [LLM API Request] ==========`);
    console.log(`${init?.method || 'GET'} ${url}`);
    if (init?.body) {
      try {
        const bodyStr = typeof init.body === 'string' ? init.body : init.body.toString();
        const bodyObj = JSON.parse(bodyStr);
        // Log the exact JSON payload being sent to the provider
        console.log(JSON.stringify(bodyObj, null, 2));
      } catch (e) {
        console.log(init.body);
      }
    }
    console.log(`=======================================\n`);
    return fetch(url, init);
  };

  /**
   * Create the appropriate Vercel AI SDK model instance based on config.
   */
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
        // Vertex typically uses default credentials if not passed explicitly, but we allow configuration
        const project = process.env.GOOGLE_VERTEX_PROJECT;
        const location = process.env.GOOGLE_VERTEX_LOCATION;
        // Vertex doesn't natively expose the fetch override as easily in older versions, but let's try
        const provider = createVertex({ project, location });
        return provider(this.modelConfig.model);
      }
      case "openai-compatible": {
        // Fallback or generic provider that acts like OpenAI
        const apiKey = this.modelConfig.apiKey || "sk-dummy";
        const baseURL = this.modelConfig.baseURL;
        const provider = createOpenAI({ apiKey, baseURL, fetch: this.customFetch });
        return provider.chat(this.modelConfig.model);
      }
      default:
        throw new Error(`Unsupported provider: ${this.modelConfig.provider}`);
    }
  }

  /**
   * Update the active model configuration.
   */
  updateConfig(config: Partial<ModelConfig>): void {
    this.modelConfig = { ...this.modelConfig, ...config };
    console.log(`[AgentService] Config updated: ${JSON.stringify(this.modelConfig)}`);
  }

  /**
   * Clear conversation history.
   */
  resetConversation(): void {
    this.conversationHistory = [];
    console.log("[AgentService] Conversation history cleared.");
  }

  /**
   * Send a prompt to the LLM and stream the response.
   * Handles the full agentic loop: streaming text, tool calls, and results.
   */
  async sendMessage(
    userMessage: string,
    callbacks: AgentCallbacks
  ): Promise<void> {
    const systemPrompt = this.buildSystemPrompt();

    this.conversationHistory.push({
      role: "user",
      content: userMessage,
    });

    try {
      const model = this.getModel();

      const result = streamText({
        model,
        system: systemPrompt,
        messages: this.conversationHistory,
        tools: this.registry.getTools(),
        stopWhen: stepCountIs(25),
      });

      callbacks.onEvent({ type: "step-start" });

      for await (const part of result.fullStream) {
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

      const response = await result.response;
      if (response?.messages) {
        this.conversationHistory.push(...response.messages);
      }

      callbacks.onEvent({ type: "done" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      callbacks.onError(message);
    }
  }

  /**
   * Build the system prompt that defines the agent's behavior.
   */
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
