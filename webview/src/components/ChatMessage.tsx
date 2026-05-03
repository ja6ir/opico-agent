import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatEntry, AssistantTurn, AgentStreamEvent } from "../hooks/useExtensionBridge";
import { ToolBadge } from "./ToolBadge";
import { Sparkles, GitBranch, Copy, Check } from "lucide-react";

interface ChatMessageProps {
  entry: ChatEntry;
  entryIndex: number;
  onBranch?: (entryIndex: number) => void;
  openFile?: (path: string) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all duration-200"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ entry, entryIndex, onBranch, openFile }) => {
  if (entry.role === "user") {
    const content = typeof entry.content === "string" ? entry.content : String(entry.content);
    return (
      <div className="group flex flex-col items-end pb-4 w-full">
        <div className="max-w-[85%] px-5 py-3.5 bg-[#2E3033] text-gray-100 border border-[#444444] rounded-3xl rounded-tr-md shadow-sm">
          <div className="prose prose-invert prose-sm max-w-none text-gray-100 leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={createMarkdownComponents(openFile)}>{entry.content}</ReactMarkdown>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-1 mr-1">
          <CopyButton text={content} />
          {onBranch && (
            <button
              onClick={() => onBranch(entryIndex)}
              className="p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all duration-200"
              title="Branch from here"
            >
              <GitBranch size={13} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return <AssistantTurnView turn={entry} openFile={openFile} />;
};

const AssistantTurnView: React.FC<{ turn: AssistantTurn; openFile?: (path: string) => void }> = ({ turn, openFile }) => {
  const segments = collateEvents(turn.events);

  const assistantText = segments
    .filter((seg) => seg.kind === "text")
    .map((seg) => (seg as { kind: "text"; content: string }).content)
    .join("");

  return (
    <div className="group relative flex flex-col items-start pb-4 w-full">
      <div className="flex items-center gap-2 mb-2 px-1 opacity-70">
        <Sparkles size={14} className="text-[#9b87f5]" />
        <span className="text-[11px] font-medium text-gray-400">Opico</span>
      </div>

      <div className="w-full flex flex-col gap-1">
        {segments.map((seg, i) => (
          <SegmentRenderer key={i} segment={seg} isStreaming={i === segments.length - 1 && turn.isStreaming} openFile={openFile} />
        ))}
        {turn.isStreaming && segments.length === 0 && (
          <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-[#9b87f5] rounded-full animate-pulse" />
        )}
      </div>

      {assistantText && (
        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <CopyButton text={assistantText} />
        </div>
      )}
    </div>
  );
};

type CollatedSegment =
  | { kind: "text"; content: string }
  | { kind: "reasoning"; content: string }
  | { kind: "tool"; toolCallId: string; toolName: string; args: unknown; result: unknown; isError?: boolean; phase: "calling" | "done" | "error" };

function collateEvents(events: AgentStreamEvent[]): CollatedSegment[] {
  const segments: CollatedSegment[] = [];
  let currentText = "";
  let currentReasoning = "";

  const pendingTools = new Map<string, number>();

  const flushText = () => {
    if (currentText) {
      segments.push({ kind: "text", content: currentText });
      currentText = "";
    }
  };

  const flushReasoning = () => {
    if (currentReasoning) {
      segments.push({ kind: "reasoning", content: currentReasoning });
      currentReasoning = "";
    }
  };

  for (const evt of events) {
    switch (evt.type) {
      case "text-delta":
        flushReasoning();
        currentText += evt.text;
        break;

      case "reasoning-delta":
        flushText();
        currentReasoning += evt.text;
        break;

      case "tool-call":
        flushText();
        flushReasoning();
        const idx = segments.length;
        pendingTools.set(evt.toolCallId, idx);
        segments.push({
          kind: "tool",
          toolCallId: evt.toolCallId,
          toolName: evt.toolName,
          args: evt.args,
          result: undefined,
          phase: "calling",
        });
        break;

      case "tool-result": {
        flushText();
        flushReasoning();
        const pendingIdx = pendingTools.get(evt.toolCallId);
        if (pendingIdx !== undefined) {
          const existing = segments[pendingIdx] as Extract<CollatedSegment, { kind: "tool" }>;
          segments[pendingIdx] = {
            ...existing,
            result: evt.result,
            isError: evt.isError,
            phase: evt.isError ? "error" : "done",
          };
        } else {
          segments.push({
            kind: "tool",
            toolCallId: evt.toolCallId,
            toolName: evt.toolName,
            args: undefined,
            result: evt.result,
            isError: evt.isError,
            phase: evt.isError ? "error" : "done",
          });
        }
        break;
      }

      case "step-start":
      case "step-end":
      case "done":
        flushText();
        flushReasoning();
        break;
    }
  }

  flushText();
  flushReasoning();

  return segments;
}

const FILE_PATH_RE = /^(?:[\w.\-]+\/)*[\w.\-]+\.\w{1,10}$/;

function createMarkdownComponents(openFile?: (path: string) => void): Record<string, React.ComponentType<any>> {
  return {
    code({ className, children, ...props }) {
      const text = String(children).replace(/\n$/, "");
      const isBlock = className || text.includes("\n");

      if (!isBlock && FILE_PATH_RE.test(text) && openFile) {
        return (
          <span
            className="file-link"
            role="button"
            tabIndex={0}
            title={`Open ${text}`}
            onClick={() => openFile(text)}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") openFile(text); }}
          >
            {text}
          </span>
        );
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };
}

const SegmentRenderer: React.FC<{
  segment: CollatedSegment;
  isStreaming: boolean;
  openFile?: (path: string) => void;
}> = ({ segment, isStreaming, openFile }) => {
  switch (segment.kind) {
    case "text":
      return (
        <div className="prose prose-invert prose-sm max-w-none text-gray-200 leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={createMarkdownComponents(openFile)}>{segment.content}</ReactMarkdown>
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-[#9b87f5] rounded-full animate-pulse" />
          )}
        </div>
      );

    case "reasoning":
      return (
        <details className="w-full group" open>
          <summary className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 hover:text-gray-400 transition-colors py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500/60" />
            <span className="uppercase font-semibold tracking-wider">Thinking</span>
            <span className="text-gray-600 group-open:hidden">...</span>
          </summary>
          <div className="mt-1 pl-4 border-l-2 border-purple-500/20 text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">
            {segment.content}
          </div>
        </details>
      );

    case "tool":
      return (
        <div className="w-full">
          <ToolBadge
            toolCall={{
              tool: segment.toolName,
              args: segment.args,
              result: segment.result != null
                ? typeof segment.result === "string"
                  ? segment.result
                  : JSON.stringify(segment.result, null, 2)
                : undefined,
              _phase: segment.phase,
              toolCallId: segment.toolCallId,
            }}
          />
        </div>
      );
  }
};
