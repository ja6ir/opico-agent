import { tool, zodSchema, type Tool } from "ai";
import { BaseTool } from "./BaseTool";
import type { CommandApprovalManager } from "./CommandApprovalManager";
import { ExecuteCommandTool } from "./ExecuteCommandTool";

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

  getTools(commandApproval?: CommandApprovalManager): Record<string, Tool> {
    const aiTools: Record<string, Tool> = {};

    for (const [name, toolInstance] of this.tools.entries()) {
      if (name === "execute_command" && commandApproval) {
        const execTool = toolInstance as ExecuteCommandTool;
        aiTools[name] = tool({
          description: toolInstance.description,
          inputSchema: zodSchema(toolInstance.schema),
          execute: async (params: any, options: any) => {
            const toolCallId: string = options?.toolCallId ?? `tc-${Date.now()}`;
            const command = params.command ?? "";

            const approved = await commandApproval.requestApproval(toolCallId, command);
            if (!approved) {
              return "Command execution was denied by the user.";
            }

            return execTool.executeWithAbort(params, toolCallId, commandApproval);
          },
        });
      } else {
        aiTools[name] = tool({
          description: toolInstance.description,
          inputSchema: zodSchema(toolInstance.schema),
          execute: async (params) => {
            const result = await toolInstance.execute(params);
            return result.content;
          },
        });
      }
    }

    return aiTools;
  }

  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  get size(): number {
    return this.tools.size;
  }
}
