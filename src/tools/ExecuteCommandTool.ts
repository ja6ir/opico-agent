import * as fs from "fs/promises";
import * as path from "path";
import * as cp from "child_process";
import { z } from "zod";
import { BaseTool, ToolResult } from "./BaseTool";

/** Maximum characters of stdout/stderr before we truncate and dump to file. */
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

/**
 * ExecuteCommandTool runs shell commands in the user's workspace.
 *
 * Key behaviors:
 * - Executes the command as a child process with a timeout.
 * - If output exceeds MAX_OUTPUT_CHARS, it truncates the inline output and
 *   writes the full output to a temporary file, returning the path.
 * - Returns both stdout and stderr in the result.
 */
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

    return new Promise((resolve) => {
      cp.exec(
        params.command,
        {
          cwd,
          timeout: 60_000, // 60 second timeout
          maxBuffer: 1024 * 1024 * 5, // 5 MB buffer
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

          // Truncation logic: if output is too large, dump to file
          if (output.length > MAX_OUTPUT_CHARS) {
            try {
              const dumpDir = path.join(this.workspaceRoot, ".opico-agent");
              await fs.mkdir(dumpDir, { recursive: true });

              const dumpFile = path.join(
                dumpDir,
                `cmd_output_${Date.now()}.txt`
              );
              await fs.writeFile(dumpFile, output, "utf-8");

              const truncated = output.slice(0, MAX_OUTPUT_CHARS);
              resolve({
                content:
                  `${truncated}\n\n` +
                  `--- OUTPUT TRUNCATED (${output.length} chars total) ---\n` +
                  `Full output saved to: ${dumpFile}`,
                isError: !!error,
              });
            } catch {
              // If we can't write the dump file, just return truncated
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
