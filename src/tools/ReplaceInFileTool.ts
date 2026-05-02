import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { BaseTool, ToolResult } from "./BaseTool";
import { calculateDiffStats } from "../utils/diffHelper";

const ReplaceInFileSchema = z.object({
  path: z
    .string()
    .describe("Absolute path to the file to modify."),
  searchBlock: z
    .string()
    .describe(
      "The exact block of code to search for in the file. " +
        "This must match the existing code EXACTLY, including whitespace and indentation."
    ),
  replaceBlock: z
    .string()
    .describe(
      "The new block of code to replace the searchBlock with. " +
        "Provide the complete replacement — do not use placeholders or ellipsis."
    ),
});

/**
 * ReplaceInFileTool uses a Search/Replace strategy for precise file modifications.
 *
 * CRITICAL DESIGN DECISION: We do NOT use line numbers for edits.
 * Instead, the LLM provides an exact `searchBlock` (the code to find) and a
 * `replaceBlock` (the replacement). This avoids off-by-one errors and
 * stale line-number references.
 *
 * After applying the edit, we compute diff stats (lines added/removed)
 * using the `diff` package and include them in the result metadata,
 * which the frontend renders as a ToolBadge.
 */
export class ReplaceInFileTool extends BaseTool<typeof ReplaceInFileSchema> {
  readonly name = "replace_in_file";
  readonly description =
    "Replace a specific block of code in a file using exact search and replace. " +
    "Provide the exact existing code as 'searchBlock' and the new code as 'replaceBlock'. " +
    "Do NOT use line numbers — match the code exactly including whitespace.";
  readonly schema = ReplaceInFileSchema;

  async execute(
    params: z.infer<typeof ReplaceInFileSchema>
  ): Promise<ToolResult> {
    if (!params || typeof params.path !== "string" || typeof params.searchBlock !== "string" || typeof params.replaceBlock !== "string") {
      return { content: "Error: 'path', 'searchBlock', and 'replaceBlock' parameters are required and must be strings.", isError: true };
    }

    try {
      const filePath = path.resolve(params.path);
      const { searchBlock, replaceBlock } = params;

      // Read the current file content
      const oldContent = await fs.readFile(filePath, "utf-8");

      // Validate that the search block exists in the file
      if (!oldContent.includes(searchBlock)) {
        return {
          content:
            `Error: The searchBlock was not found in ${filePath}.\n\n` +
            `Make sure you are providing the EXACT text from the file, ` +
            `including all whitespace and indentation.\n\n` +
            `SearchBlock (first 200 chars):\n${searchBlock.slice(0, 200)}`,
          isError: true,
        };
      }

      // Check for multiple occurrences to avoid ambiguous edits
      const occurrences = oldContent.split(searchBlock).length - 1;
      if (occurrences > 1) {
        return {
          content:
            `Error: The searchBlock was found ${occurrences} times in ${filePath}. ` +
            `Please provide a more specific searchBlock that matches exactly once.`,
          isError: true,
        };
      }

      // Apply the replacement
      const newContent = oldContent.replace(searchBlock, replaceBlock);

      // Calculate diff stats
      const stats = calculateDiffStats(oldContent, newContent);

      // Write the modified content back
      await fs.writeFile(filePath, newContent, "utf-8");

      const fileName = path.basename(filePath);

      return {
        content:
          `Successfully edited ${fileName}: +${stats.added} -${stats.removed} lines.`,
        metadata: {
          type: "file_edit",
          file: filePath,
          fileName,
          added: stats.added,
          removed: stats.removed,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: `Error editing file: ${message}`, isError: true };
    }
  }
}
