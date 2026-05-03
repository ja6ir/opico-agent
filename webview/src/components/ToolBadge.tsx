import React, { useState, useMemo, useContext } from "react";
import {
  FileEdit,
  Terminal,
  Search,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldX,
  OctagonX,
} from "lucide-react";
import { CommandApprovalContext } from "../contexts/CommandApprovalContext";
import type { CommandState } from "../hooks/useExtensionBridge";

interface ToolCallPayload {
  tool: string;
  args?: unknown;
  result?: string;
  file?: string;
  fileName?: string;
  added?: number;
  removed?: number;
  _phase?: "calling" | "done" | "error";
  toolCallId?: string;
  [key: string]: unknown;
}

interface ToolBadgeProps {
  toolCall: ToolCallPayload;
}

const TOOL_CONFIG: Record<
  string,
  { icon: React.ComponentType<any>; label: string; color: string }
> = {
  read_file: { icon: FileText, label: "Read File", color: "text-blue-400" },
  replace_in_file: { icon: FileEdit, label: "Edit File", color: "text-amber-400" },
  execute_command: { icon: Terminal, label: "Terminal", color: "text-green-400" },
  search_workspace: { icon: Search, label: "Search", color: "text-purple-400" },
  list_directory: { icon: FolderOpen, label: "List Directory", color: "text-cyan-400" },
};

function getArgs(toolCall: ToolCallPayload): Record<string, unknown> {
  if (!toolCall.args) return {};
  if (typeof toolCall.args === "string") {
    try { return JSON.parse(toolCall.args); } catch { return {}; }
  }
  if (typeof toolCall.args === "object" && toolCall.args !== null) {
    return toolCall.args as Record<string, unknown>;
  }
  return {};
}

function truncatePath(filePath: string, maxLen = 40): string {
  if (!filePath) return "";
  if (filePath.length <= maxLen) return filePath;
  const parts = filePath.replace(/\\/g, "/").split("/");
  let result = parts[parts.length - 1];
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = "…" + parts.slice(i).join("/");
    if (candidate.length > maxLen + 1) {
      return "…" + result;
    }
    result = candidate;
  }
  return result;
}

function truncateCommand(cmd: string, maxLen = 50): string {
  if (!cmd) return "";
  const singleLine = cmd.replace(/\n/g, " ").trim();
  if (singleLine.length <= maxLen) return singleLine;
  return singleLine.slice(0, maxLen) + "…";
}

const CollapsedSummary: React.FC<{ toolCall: ToolCallPayload }> = ({ toolCall }) => {
  const args = getArgs(toolCall);
  const filePath = (args.path as string) || (args.filePath as string) || "";
  const truncated = truncatePath(filePath);

  switch (toolCall.tool) {
    case "read_file": {
      const startLine = args.startLine as number | undefined;
      const endLine = args.endLine as number | undefined;
      return (
        <>
          {truncated && (
            <span className="text-[#CE9178] font-mono text-xs truncate" style={{ color: "#CE9178" }}>
              {truncated}
            </span>
          )}
          {(startLine != null || endLine != null) && (
            <span className="text-gray-500 text-xs font-mono shrink-0">
              L{startLine ?? "?"}{endLine != null ? `-${endLine}` : ""}
            </span>
          )}
        </>
      );
    }

    case "execute_command": {
      const command = (args.command as string) || "";
      return (
        <span className="text-gray-400 font-mono text-xs truncate">
          {truncateCommand(command)}
        </span>
      );
    }

    case "replace_in_file": {
      return (
        <>
          {truncated && (
            <span className="font-mono text-xs truncate" style={{ color: "#CE9178" }}>
              {truncated}
            </span>
          )}
        </>
      );
    }

    case "search_workspace": {
      const query = (args.query as string) || "";
      return (
        <span className="text-gray-400 text-xs italic truncate">
          "{query.length > 40 ? query.slice(0, 40) + "…" : query}"
        </span>
      );
    }

    case "list_directory": {
      return (
        <span className="font-mono text-xs truncate" style={{ color: "#CE9178" }}>
          {truncated || "workspace root"}
        </span>
      );
    }

    default:
      return null;
  }
};

interface DiffLine {
  type: "removed" | "added" | "context";
  content: string;
  oldLine?: number;
  newLine?: number;
}

function computeDiffLines(searchBlock: string, replaceBlock: string): DiffLine[] {
  const oldLines = searchBlock.split("\n");
  const newLines = replaceBlock.split("\n");
  if (oldLines[oldLines.length - 1] === "") oldLines.pop();
  if (newLines[newLines.length - 1] === "") newLines.pop();

  const maxLen = Math.max(oldLines.length, newLines.length);
  const lines: DiffLine[] = [];

  for (let i = 0; i < maxLen; i++) {
    if (i < oldLines.length && i < newLines.length) {
      if (oldLines[i] === newLines[i]) {
        lines.push({ type: "context", content: oldLines[i], oldLine: i + 1, newLine: i + 1 });
      } else {
        lines.push({ type: "removed", content: oldLines[i], oldLine: i + 1 });
        lines.push({ type: "added", content: newLines[i], newLine: i + 1 });
      }
    } else if (i < oldLines.length) {
      lines.push({ type: "removed", content: oldLines[i], oldLine: i + 1 });
    } else {
      lines.push({ type: "added", content: newLines[i], newLine: i + 1 });
    }
  }

  return lines;
}

const DiffPreview: React.FC<{ searchBlock: string; replaceBlock: string }> = ({
  searchBlock,
  replaceBlock,
}) => {
  const diffLines = useMemo(() => computeDiffLines(searchBlock, replaceBlock), [searchBlock, replaceBlock]);
  const maxLineNum = Math.max(
    ...diffLines.map((l) => l.oldLine ?? l.newLine ?? 0),
    1
  );
  const padWidth = String(maxLineNum).length;

  return (
    <div className="font-mono text-xs leading-5 overflow-x-auto">
      {diffLines.map((line, i) => {
        const numStr = line.type === "added"
          ? `${" ".repeat(padWidth)} ${line.newLine!.toString().padStart(padWidth, " ")}`
          : line.type === "removed"
          ? `${line.oldLine!.toString().padStart(padWidth, " ")} ${" ".repeat(padWidth)}`
          : `${line.oldLine!.toString().padStart(padWidth, " ")} ${line.newLine!.toString().padStart(padWidth, " ")}`;

        return (
          <div
            key={i}
            className={`flex ${
              line.type === "removed"
                ? "bg-red-500/10 text-red-400"
                : line.type === "added"
                ? "bg-green-500/10 text-green-400"
                : "text-gray-500"
            }`}
          >
            <span className="shrink-0 w-4 text-center select-none opacity-50">
              {line.type === "removed" ? "-" : line.type === "added" ? "+" : " "}
            </span>
            <span className="shrink-0 text-gray-600 select-none w-[calc(2*var(--ln-w)+4px)] text-right pr-1" style={{ "--ln-w": `${padWidth}ch` } as React.CSSProperties}>
              {numStr.trim()}
            </span>
            <span className="pl-1 whitespace-pre">{line.content}</span>
          </div>
        );
      })}
    </div>
  );
};

export const ToolBadge: React.FC<ToolBadgeProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { commandStates, allowCommand, denyCommand, abortCommand } = useContext(CommandApprovalContext);
  const config = TOOL_CONFIG[toolCall.tool] ?? {
    icon: Terminal,
    label: toolCall.tool,
    color: "text-gray-400",
  };
  const Icon = config.icon;
  const phase = toolCall._phase ?? "done";
  const args = getArgs(toolCall);
  const toolCallId = toolCall.toolCallId ?? "";
  const commandState: CommandState | undefined = toolCall.tool === "execute_command" ? commandStates[toolCallId] : undefined;

  const statusIcon =
    phase === "calling" ? (
      <Loader2 size={12} className="text-gray-400 animate-spin shrink-0" />
    ) : phase === "error" ? (
      <AlertCircle size={12} className="text-red-400 shrink-0" />
    ) : (
      <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
    );

  const searchBlock = (args.searchBlock as string) || "";
  const replaceBlock = (args.replaceBlock as string) || "";
  const hasDiff = toolCall.tool === "replace_in_file" && searchBlock && replaceBlock;

  const addedCount = useMemo(() => {
    if (hasDiff) {
      const diff = computeDiffLines(searchBlock, replaceBlock);
      return diff.filter((l) => l.type === "added").length;
    }
    return 0;
  }, [hasDiff, searchBlock, replaceBlock]);

  const removedCount = useMemo(() => {
    if (hasDiff) {
      const diff = computeDiffLines(searchBlock, replaceBlock);
      return diff.filter((l) => l.type === "removed").length;
    }
    return 0;
  }, [hasDiff, searchBlock, replaceBlock]);

  return (
    <div className={`my-1 rounded-lg border overflow-hidden ${
      phase === "calling"
        ? "border-blue-500/30 bg-blue-500/5"
        : phase === "error"
        ? "border-red-500/30 bg-red-500/5"
        : "border-white/10 bg-white/5"
    }`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/5 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-gray-500 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-gray-500 shrink-0" />
        )}
        <Icon size={14} className={`${config.color} shrink-0`} />
        <CollapsedSummary toolCall={toolCall} />
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {toolCall.tool === "replace_in_file" && (addedCount > 0 || removedCount > 0) && (
            <>
              {removedCount > 0 && (
                <span className="text-red-400 text-xs font-mono">-{removedCount}</span>
              )}
              {addedCount > 0 && (
                <span className="text-green-400 text-xs font-mono">+{addedCount}</span>
              )}
            </>
          )}
          {statusIcon}
          {commandState === "pending" && (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); allowCommand(toolCallId); }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
                title="Allow command"
              >
                <ShieldCheck size={11} />
                Allow
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); denyCommand(toolCallId); }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors border border-red-500/30"
                title="Deny command"
              >
                <ShieldX size={11} />
                Deny
              </button>
            </div>
          )}
          {commandState === "executing" && (
            <button
              onClick={(e) => { e.stopPropagation(); abortCommand(toolCallId); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors border border-red-500/30"
              title="Abort command"
            >
              <OctagonX size={11} />
              Abort
            </button>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10 px-3 py-2">
          {hasDiff ? (
            <DiffPreview searchBlock={searchBlock} replaceBlock={replaceBlock} />
          ) : (
            <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words max-h-64 overflow-y-auto font-mono">
              {toolCall.result ?? "Waiting for result…"}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
