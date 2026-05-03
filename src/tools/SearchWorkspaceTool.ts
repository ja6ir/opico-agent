import * as vscode from "vscode";
import * as path from "path";
import { execFile } from "child_process";
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
    .describe("Maximum number of results to return. Defaults to 100."),
});

const MAX_LINE_LENGTH = 2000;
const DEFAULT_IGNORE_GLOBS = [
  "!**/node_modules/**",
  "!**/.git/**",
  "!**/dist/**",
  "!**/.next/**",
  "!**/__pycache__/**",
  "!**/.vscode/**",
  "!**/.opico-agent/**",
];

function getRgPath(): string {
  try {
    return require("@vscode/ripgrep").rgPath as string;
  } catch {
    return "rg";
  }
}

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
      return {
        content: "Error: 'query' parameter is required and must be a string.",
        isError: true,
      };
    }

    try {
      const workspaceFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceFolder) {
        return {
          content: "Error: No workspace folder is open.",
          isError: true,
        };
      }

      const maxResults = params.maxResults ?? 100;

      const args: string[] = [
        "--no-config",
        "--no-ignore-global",
        "--max-count", String(maxResults),
        "--line-number",
        "--with-filename",
        "--color", "never",
        "-e", params.query,
      ];

      if (params.include) {
        for (const g of params.include.split(",").map((s) => s.trim()).filter(Boolean)) {
          args.push("--glob", g);
        }
      }

      if (params.exclude) {
        for (const g of params.exclude.split(",").map((s) => s.trim()).filter(Boolean)) {
          args.push("--glob", `!${g.startsWith("!") ? g.slice(1) : g}`);
        }
      } else {
        for (const g of DEFAULT_IGNORE_GLOBS) {
          args.push("--glob", g);
        }
      }

      const cwd = workspaceFolder;
      const rgPath = getRgPath();

      const stdout = await new Promise<string>((resolve, reject) => {
        execFile(
          rgPath,
          args,
          {
            cwd,
            timeout: 30_000,
            maxBuffer: 10 * 1024 * 1024,
            shell: false,
          },
          (err, stdout, stderr) => {
            if (err) {
              if ("code" in err && (err as any).code === 1) {
                resolve("");
              } else {
                reject(new Error(stderr || err.message));
              }
              return;
            }
            resolve(stdout);
          }
        );
      });

      if (!stdout.trim()) {
        return {
          content: `No results found for query: "${params.query}"`,
        };
      }

      const lines = stdout.trim().split("\n");
      const matches: { filePath: string; line: number; text: string }[] = [];

      for (const line of lines) {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (match) {
          const filePath = match[1];
          const lineNum = parseInt(match[2], 10);
          const text = match[3].length > MAX_LINE_LENGTH
            ? match[3].substring(0, MAX_LINE_LENGTH) + "..."
            : match[3];
          matches.push({ filePath, line: lineNum, text });
        }
      }

      if (matches.length === 0) {
        return {
          content: `No results found for query: "${params.query}"`,
        };
      }

      const output: string[] = [`Found ${matches.length} result(s) for "${params.query}":\n`];

      let currentFile = "";
      for (const m of matches) {
        if (currentFile !== m.filePath) {
          if (currentFile !== "") output.push("");
          currentFile = m.filePath;
          output.push(`${m.filePath}:`);
        }
        output.push(`  Line ${m.line}: ${m.text.trimEnd()}`);
      }

      return { content: output.join("\n") };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: `Error searching workspace: ${message}`,
        isError: true,
      };
    }
  }
}
