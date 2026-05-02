import { z } from "zod";

/**
 * ToolResult represents the standard output returned by any tool execution.
 * Every tool must return content (the primary output) and can optionally
 * signal whether the execution was an error.
 */
export interface ToolResult {
  /** The primary textual output of the tool execution. */
  content: string;
  /** If true, the LLM will treat the output as an error and may attempt to self-correct. */
  isError?: boolean;
  /** Optional structured metadata (e.g., diff stats, file lists) sent to the frontend. */
  metadata?: Record<string, unknown>;
}

/**
 * Abstract base class for all agent tools.
 *
 * This class enforces a strict contract that every tool must implement:
 * - `name`:        A unique, snake_case identifier for the tool.
 * - `description`: A natural language description telling the LLM when and how to use this tool.
 * - `schema`:      A Zod schema defining the tool's parameters (acts as our Pydantic equivalent).
 * - `execute`:     The async method that performs the tool's action.
 *
 * The generic parameter `T` is a Zod schema type. This gives us full type-safety:
 * the `execute` method's `params` argument is automatically inferred from the schema.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { BaseTool, ToolResult } from "./BaseTool";
 *
 * const ReadFileSchema = z.object({
 *   path: z.string().describe("Absolute path to the file to read"),
 *   startLine: z.number().optional().describe("1-indexed start line"),
 *   endLine: z.number().optional().describe("1-indexed end line"),
 * });
 *
 * export class ReadFileTool extends BaseTool<typeof ReadFileSchema> {
 *   name = "read_file" as const;
 *   description = "Read the contents of a file with optional line range.";
 *   schema = ReadFileSchema;
 *
 *   async execute(params: z.infer<typeof ReadFileSchema>): Promise<ToolResult> {
 *     // ... implementation
 *   }
 * }
 * ```
 */
export abstract class BaseTool<T extends z.ZodTypeAny = z.ZodTypeAny> {
  /**
   * Unique identifier for the tool, used by the LLM to invoke it.
   * Must be snake_case (e.g., "read_file", "replace_in_file", "execute_command").
   */
  abstract readonly name: string;

  /**
   * Human-readable description explaining the tool's purpose and usage.
   * This is sent directly to the LLM as part of the tool definition,
   * so it should be clear, concise, and instructive.
   */
  abstract readonly description: string;

  /**
   * Zod schema defining the parameters this tool accepts.
   * Each field should include a `.describe()` call to help the LLM
   * understand what to provide.
   */
  abstract readonly schema: T;

  /**
   * Execute the tool with validated parameters.
   *
   * The `params` type is automatically inferred from the Zod schema `T`,
   * so implementations get full type-safety without manual type annotations.
   *
   * @param params - Validated parameters matching the tool's Zod schema.
   * @returns A promise resolving to a `ToolResult` with content and optional metadata.
   */
  abstract execute(params: z.infer<T>): Promise<ToolResult>;
}
