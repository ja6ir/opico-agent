import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { BaseTool, ToolResult } from "./BaseTool";

/** Directories to always ignore when listing. */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  "__pycache__",
  ".vscode",
  ".opico-agent",
]);

const ListDirectorySchema = z.object({
  path: z
    .string()
    .optional()
    .describe("Absolute path to the directory to list. Defaults to workspace root if omitted."),
  recursive: z
    .boolean()
    .optional()
    .describe("If true, list contents recursively. Defaults to false."),
  maxDepth: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum depth for recursive listing. Defaults to 3."),
});

interface FileEntry {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: FileEntry[];
}

/**
 * ListDirectoryTool returns a structured JSON tree of files and directories,
 * automatically filtering out common noise directories like node_modules and .git.
 */
export class ListDirectoryTool extends BaseTool<typeof ListDirectorySchema> {
  readonly name = "list_directory";
  readonly description =
    "List the contents of a directory as structured JSON. " +
    "Automatically ignores node_modules, .git, dist, and similar directories. " +
    "Use 'recursive: true' with 'maxDepth' to explore nested structures.";
  readonly schema = ListDirectorySchema;

  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    super();
    this.workspaceRoot = workspaceRoot;
  }

  async execute(
    params: z.infer<typeof ListDirectorySchema>
  ): Promise<ToolResult> {
    try {
      const targetPath = params?.path || this.workspaceRoot;
      const dirPath = path.resolve(targetPath);
      const recursive = params.recursive ?? false;
      const maxDepth = params.maxDepth ?? 3;

      // Verify directory exists
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) {
        return {
          content: `Error: ${dirPath} is not a directory.`,
          isError: true,
        };
      }

      const tree = await this.buildTree(dirPath, recursive, maxDepth, 0);

      return {
        content: JSON.stringify(tree, null, 2),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: `Error listing directory: ${message}`,
        isError: true,
      };
    }
  }

  private async buildTree(
    dirPath: string,
    recursive: boolean,
    maxDepth: number,
    currentDepth: number
  ): Promise<FileEntry[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const result: FileEntry[] = [];

    // Sort: directories first, then files, both alphabetically
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const fileEntry: FileEntry = {
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        path: fullPath,
      };

      if (
        entry.isDirectory() &&
        recursive &&
        currentDepth < maxDepth
      ) {
        fileEntry.children = await this.buildTree(
          fullPath,
          recursive,
          maxDepth,
          currentDepth + 1
        );
      }

      result.push(fileEntry);
    }

    return result;
  }
}
