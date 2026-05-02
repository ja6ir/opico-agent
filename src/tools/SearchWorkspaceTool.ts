import * as vscode from "vscode";
import { z } from "zod";
import { BaseTool, ToolResult } from "./BaseTool";

const SearchWorkspaceSchema = z.object({
  query: z
    .string()
    .describe("The text or regex pattern to search for across workspace files."),
  include: z
    .string()
    .optional()
    .describe(
      "Glob pattern to include files (e.g., '**/*.ts'). Defaults to all files."
    ),
  exclude: z
    .string()
    .optional()
    .describe(
      "Glob pattern to exclude files (e.g., '**/node_modules/**'). " +
        "Defaults to excluding node_modules, .git, dist."
    ),
  maxResults: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum number of results to return. Defaults to 50."),
});

/**
 * SearchWorkspaceTool wraps VS Code's native `workspace.findTextInFiles` API
 * to search across the entire workspace for text or regex patterns.
 */
export class SearchWorkspaceTool extends BaseTool<typeof SearchWorkspaceSchema> {
  readonly name = "search_workspace";
  readonly description =
    "Search for text or patterns across all files in the workspace. " +
    "Returns file paths, line numbers, and matching line content. " +
    "Use include/exclude globs to narrow the search scope.";
  readonly schema = SearchWorkspaceSchema;

  async execute(
    params: z.infer<typeof SearchWorkspaceSchema>
  ): Promise<ToolResult> {
    if (!params || typeof params.query !== "string") {
      return { content: "Error: 'query' parameter is required and must be a string.", isError: true };
    }

    try {
      const query = new vscode.TextSearchQuery(params.query);
      const include = params.include ?? "";
      const exclude = params.exclude ?? "**/node_modules/**,**/.git/**,**/dist/**";
      const maxResults = params.maxResults ?? 50;

      const results: string[] = [];

      await vscode.workspace.findTextInFiles(
        query,
        {
          include: new vscode.RelativePattern(
            vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file("."),
            include || "**/*"
          ),
          exclude: new vscode.RelativePattern(
            vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file("."),
            exclude
          ),
          maxResults,
        },
        (result) => {
          const relativePath = vscode.workspace.asRelativePath(result.uri);
          for (const range of result.ranges) {
            const lineNum =
              range instanceof vscode.Range ? range.start.line + 1 : "?";
            const preview =
              "preview" in result
                ? (result as any).preview?.text?.trim() ?? ""
                : "";
            results.push(`${relativePath}:${lineNum}: ${preview}`);
          }
        }
      );

      if (results.length === 0) {
        return {
          content: `No results found for query: "${params.query}"`,
        };
      }

      return {
        content:
          `Found ${results.length} result(s) for "${params.query}":\n\n` +
          results.join("\n"),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: `Error searching workspace: ${message}`, isError: true };
    }
  }
}
