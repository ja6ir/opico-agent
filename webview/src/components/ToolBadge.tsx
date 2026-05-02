import React, { useState } from "react";
import {
  FileEdit,
  Terminal,
  Search,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface ToolCallPayload {
  tool: string;
  result: string;
  file?: string;
  fileName?: string;
  added?: number;
  removed?: number;
  _phase?: "calling" | "done" | "error";
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

export const ToolBadge: React.FC<ToolBadgeProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = TOOL_CONFIG[toolCall.tool] ?? {
    icon: Terminal,
    label: toolCall.tool,
    color: "text-gray-400",
  };
  const Icon = config.icon;
  const phase = toolCall._phase ?? "done";

  const statusIcon =
    phase === "calling" ? (
      <Loader2 size={12} className="text-gray-400 animate-spin shrink-0" />
    ) : phase === "error" ? (
      <AlertCircle size={12} className="text-red-400 shrink-0" />
    ) : (
      <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
    );

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
        <span className={`font-medium ${config.color}`}>{config.label}</span>
        {toolCall.fileName && (
          <span className="text-gray-400 truncate">{toolCall.fileName}</span>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {(toolCall.added !== undefined || toolCall.removed !== undefined) && (
            <>
              {toolCall.added !== undefined && toolCall.added > 0 && (
                <span className="flex items-center gap-0.5 text-green-400 text-xs font-mono">
                  <Plus size={12} />{toolCall.added}
                </span>
              )}
              {toolCall.removed !== undefined && toolCall.removed > 0 && (
                <span className="flex items-center gap-0.5 text-red-400 text-xs font-mono">
                  <Minus size={12} />{toolCall.removed}
                </span>
              )}
            </>
          )}
          {statusIcon}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10 px-3 py-2">
          <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words max-h-64 overflow-y-auto font-mono">
            {toolCall.result}
          </pre>
        </div>
      )}
    </div>
  );
};
