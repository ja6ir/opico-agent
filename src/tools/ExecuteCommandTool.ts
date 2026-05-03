import * as fs from "fs/promises";
import * as path from "path";
import * as cp from "child_process";
import { z } from "zod";
import { BaseTool, ToolResult } from "./BaseTool";
import type { CommandApprovalManager } from "./CommandApprovalManager";

const MAX_OUTPUT_CHARS = 3000;

const ExecuteCommandSchema = z.object({
  command: z
    .string()
    .describe("The shell command to execute (e.g., 'npm install', 'git status')."),
  cwd: z
    .string()
    .optional()
    .describe(
      "Working directory for the command. Defaults to the workspace root."
    ),
});

export class ExecuteCommandTool extends BaseTool<typeof ExecuteCommandSchema> {
  readonly name = "execute_command";
  readonly description =
    "Execute a shell command in the workspace. " +
    "If the output exceeds 3000 characters, it will be truncated and the full output saved to a file. " +
    "Use this to run build commands, install packages, run tests, git operations, etc.";
  readonly schema = ExecuteCommandSchema;

  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    super();
    this.workspaceRoot = workspaceRoot;
  }

  async execute(
    params: z.infer<typeof ExecuteCommandSchema>
  ): Promise<ToolResult> {
    if (!params || typeof params.command !== "string") {
      return { content: "Error: 'command' parameter is required and must be a string.", isError: true };
    }

    const cwd = params.cwd
      ? path.resolve(params.cwd)
      : this.workspaceRoot;

    return this.runCommand(params.command, cwd);
  }

  async executeWithAbort(
    params: z.infer<typeof ExecuteCommandSchema>,
    toolCallId: string,
    approvalManager: CommandApprovalManager
  ): Promise<string> {
    if (!params || typeof params.command !== "string") {
      return "Error: 'command' parameter is required and must be a string.";
    }

    const cwd = params.cwd
      ? path.resolve(params.cwd)
      : this.workspaceRoot;

    return new Promise((resolve) => {
      const proc = cp.exec(
        params.command,
        {
          cwd,
          timeout: 60_000,
          maxBuffer: 1024 * 1024 * 5,
          shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
        },
        async (error, stdout, stderr) => {
          approvalManager.unregisterProcess(toolCallId);

          let output = "";

          if (stdout) {
            output += `STDOUT:\n${stdout}\n`;
          }
          if (stderr) {
            output += `STDERR:\n${stderr}\n`;
          }
          if (error && error.killed) {
            output += `\nCommand was aborted or timed out.`;
          } else if (error) {
            output += `\nExit code: ${error.code ?? "unknown"}`;
          }

          if (output.length > MAX_OUTPUT_CHARS) {
            try {
              const dumpDir = path.join(this.workspaceRoot, ".opico-agent");
              await fs.mkdir(dumpDir, { recursive: true });
              const dumpFile = path.join(dumpDir, `cmd_output_${Date.now()}.txt`);
              await fs.writeFile(dumpFile, output, "utf-8");

              resolve(
                `${output.slice(0, MAX_OUTPUT_CHARS)}\n\n` +
                `--- OUTPUT TRUNCATED (${output.length} chars total) ---\n` +
                `Full output saved to: ${dumpFile}`
              );
            } catch {
              resolve(
                output.slice(0, MAX_OUTPUT_CHARS) +
                `\n\n--- OUTPUT TRUNCATED (${output.length} chars total) ---`
              );
            }
          } else {
            resolve(output || "(No output)");
          }
        }
      );

      approvalManager.registerProcess(toolCallId, proc);
    });
  }

  private async runCommand(command: string, cwd: string): Promise<ToolResult> {
    return new Promise((resolve) => {
      cp.exec(
        command,
        {
          cwd,
          timeout: 60_000,
          maxBuffer: 1024 * 1024 * 5,
          shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
        },
        async (error, stdout, stderr) => {
          let output = "";

          if (stdout) {
            output += `STDOUT:\n${stdout}\n`;
          }
          if (stderr) {
            output += `STDERR:\n${stderr}\n`;
          }
          if (error && error.killed) {
            output += `\nCommand timed out after 60 seconds.`;
          } else if (error) {
            output += `\nExit code: ${error.code ?? "unknown"}`;
          }

          if (output.length > MAX_OUTPUT_CHARS) {
            try {
              const dumpDir = path.join(this.workspaceRoot, ".opico-agent");
              await fs.mkdir(dumpDir, { recursive: true });
              const dumpFile = path.join(dumpDir, `cmd_output_${Date.now()}.txt`);
              await fs.writeFile(dumpFile, output, "utf-8");

              resolve({
                content:
                  `${output.slice(0, MAX_OUTPUT_CHARS)}\n\n` +
                  `--- OUTPUT TRUNCATED (${output.length} chars total) ---\n` +
                  `Full output saved to: ${dumpFile}`,
                isError: !!error,
              });
            } catch {
              resolve({
                content:
                  output.slice(0, MAX_OUTPUT_CHARS) +
                  `\n\n--- OUTPUT TRUNCATED (${output.length} chars total) ---`,
                isError: !!error,
              });
            }
          } else {
            resolve({
              content: output || "(No output)",
              isError: !!error,
            });
          }
        }
      );
    });
  }
}
