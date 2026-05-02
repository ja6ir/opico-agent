import { tool, zodSchema, type Tool } from "ai";
import { BaseTool } from "./BaseTool";

/**
 * ToolRegistry converts an array of BaseTool instances into the
 * `Record<string, CoreTool>` format expected by Vercel AI SDK's `streamText`.
 */
export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  constructor(toolInstances: BaseTool[] = []) {
    for (const toolInstance of toolInstances) {
      this.register(toolInstance);
    }
  }

  register(toolInstance: BaseTool): void {
    if (this.tools.has(toolInstance.name)) {
      throw new Error(
        `ToolRegistry: Duplicate tool name "${toolInstance.name}". ` +
          `Each tool must have a unique name.`
      );
    }
    this.tools.set(toolInstance.name, toolInstance);
  }

  getTools(): Record<string, Tool> {
    const aiTools: Record<string, Tool> = {};

    for (const [name, toolInstance] of this.tools.entries()) {
      aiTools[name] = tool({
        description: toolInstance.description,
        inputSchema: zodSchema(toolInstance.schema),
        execute: async (params) => {
          const result = await toolInstance.execute(params);
          // The Vercel AI SDK expects the tool result as a string or
          // a structured object. We return the content string, and
          // separately handle metadata via the postMessage bridge.
          return result.content;
        },
      });
    }

    return aiTools;
  }

  /**
   * Get a specific tool instance by name. Useful for direct invocation
   * outside of the LLM loop (e.g., for testing or manual execution).
   */
  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get the names of all registered tools.
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get the count of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }
}
