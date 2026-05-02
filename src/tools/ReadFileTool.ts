import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { BaseTool, ToolResult } from "./BaseTool";

const ReadFileSchema = z.object({
  path: z
    .string()
    .describe("Absolute path to the file to read."),
  startLine: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("1-indexed start line (inclusive). Omit to start from line 1."),
  endLine: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("1-indexed end line (inclusive). Omit to read to end of file."),
});

/**
 * ReadFileTool reads the contents of a file with optional line range pagination.
 * Each output line is prepended with its 1-indexed line number for precise referencing.
 */
export class ReadFileTool extends BaseTool<typeof ReadFileSchema> {
  readonly name = "read_file";
  readonly description =
    "Read the contents of a file at the given path. " +
    "You can optionally specify startLine and endLine to paginate large files. " +
    "Output includes line numbers for precise referencing.";
  readonly schema = ReadFileSchema;

  async execute(
    params: z.infer<typeof ReadFileSchema>
  ): Promise<ToolResult> {
    if (!params || typeof params.path !== "string") {
      return { content: "Error: 'path' parameter is required and must be a string.", isError: true };
    }

    try {
      const filePath = path.resolve(params.path);

      // Verify file exists
      await fs.access(filePath);

      const raw = await fs.readFile(filePath, "utf-8");
      const allLines = raw.split("\n");
      const totalLines = allLines.length;

      // Apply line range (1-indexed, inclusive on both ends)
      const start = Math.max(1, params.startLine ?? 1);
      const end = Math.min(totalLines, params.endLine ?? totalLines);

      if (start > totalLines) {
        return {
          content: `File has ${totalLines} lines. Requested startLine ${start} is out of range.`,
          isError: true,
        };
      }

      // Slice to the requested range (convert to 0-indexed)
      const sliced = allLines.slice(start - 1, end);

      // Calculate padding width for line numbers
      const padWidth = String(end).length;

      // Prepend line numbers
      const numbered = sliced
        .map(
          (line, i) =>
            `${String(start + i).padStart(padWidth, " ")} | ${line}`
        )
        .join("\n");

      const header =
        `File: ${filePath}\n` +
        `Lines: ${start}-${end} of ${totalLines}\n` +
        `${"─".repeat(60)}\n`;

      return { content: header + numbered };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: `Error reading file: ${message}`, isError: true };
    }
  }
}
