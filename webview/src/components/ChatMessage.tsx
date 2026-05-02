import React from "react";
import ReactMarkdown from "react-markdown";
import type { ChatEntry, AssistantTurn, AgentStreamEvent } from "../hooks/useExtensionBridge";
import { ToolBadge } from "./ToolBadge";
import { Sparkles } from "lucide-react";

interface ChatMessageProps {
  entry: ChatEntry;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ entry }) => {
  if (entry.role === "user") {
    return (
      <div className="flex flex-col items-end pb-4 w-full">
        <div className="max-w-[85%] px-5 py-3.5 bg-[#2E3033] text-gray-100 border border-[#444444] rounded-3xl rounded-tr-md shadow-sm">
          <div className="prose prose-invert prose-sm max-w-none text-gray-100 leading-relaxed">
            <ReactMarkdown>{entry.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  return <AssistantTurnView turn={entry} />;
};

const AssistantTurnView: React.FC<{ turn: AssistantTurn }> = ({ turn }) => {
  const segments = collateEvents(turn.events);

  return (
    <div className="flex flex-col items-start pb-4 w-full">
      <div className="flex items-center gap-2 mb-2 px-1 opacity-70">
        <Sparkles size={14} className="text-[#9b87f5]" />
        <span className="text-[11px] font-medium text-gray-400">Opico</span>
      </div>

      <div className="w-full flex flex-col gap-1">
        {segments.map((seg, i) => (
          <SegmentRenderer key={i} segment={seg} isStreaming={i === segments.length - 1 && turn.isStreaming} />
        ))}
        {turn.isStreaming && segments.length === 0 && (
          <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-[#9b87f5] rounded-full animate-pulse" />
        )}
      </div>
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

const SegmentRenderer: React.FC<{
  segment: CollatedSegment;
  isStreaming: boolean;
}> = ({ segment, isStreaming }) => {
  switch (segment.kind) {
    case "text":
      return (
        <div className="prose prose-invert prose-sm max-w-none text-gray-200 leading-relaxed">
          <ReactMarkdown>{segment.content}</ReactMarkdown>
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
              result: segment.result != null
                ? typeof segment.result === "string"
                  ? segment.result
                  : JSON.stringify(segment.result, null, 2)
                : typeof segment.args === "string"
                  ? segment.args
                  : JSON.stringify(segment.args, null, 2),
              _phase: segment.phase,
            }}
          />
        </div>
      );
  }
};
