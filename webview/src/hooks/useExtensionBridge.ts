import { useState, useEffect, useCallback } from "react";

export type AgentStreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
  | { type: "step-start" }
  | { type: "step-end" }
  | { type: "done" };

export type IncomingMessage =
  | { type: "STREAM_START" }
  | { type: "AGENT_EVENT"; payload: AgentStreamEvent }
  | { type: "STREAM_ERROR"; payload: string }
  | { type: "CONFIG_UPDATED"; payload: { provider: string; model: string; apiKey?: string; baseURL?: string } }
  | { type: "CONVERSATION_RESET" }
  | { type: "INIT_DATA"; payload: { models: any[]; currentConfig: { provider: string; model: string; apiKey?: string; baseURL?: string } } };

export type OutgoingMessage =
  | { type: "SEND_PROMPT"; payload: string }
  | { type: "UPDATE_CONFIG"; payload: { provider: string; model: string; apiKey?: string; baseURL?: string } }
  | { type: "RESET_CONVERSATION" };

export interface UserMessage {
  id: string;
  role: "user";
  content: string;
  timestamp: number;
}

export interface AssistantTurn {
  id: string;
  role: "assistant";
  events: AgentStreamEvent[];
  isStreaming: boolean;
  timestamp: number;
}

export type ChatEntry = UserMessage | AssistantTurn;

function isAssistantTurn(entry: ChatEntry): entry is AssistantTurn {
  return entry.role === "assistant";
}

interface VsCodeApi {
  postMessage(message: OutgoingMessage): void;
  getState(): any;
  setState(state: any): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let vscodeApi: VsCodeApi | undefined;
function getVsCodeApi(): VsCodeApi {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export function useExtensionBridge() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState("anthropic");
  const [currentModel, setCurrentModel] = useState("claude-3-5-sonnet-20241022");
  const [currentApiKey, setCurrentApiKey] = useState("");
  const [currentBaseUrl, setCurrentBaseUrl] = useState("");
  const [customModels, setCustomModels] = useState<any[]>([]);

  useEffect(() => {
    const handler = (event: MessageEvent<IncomingMessage>) => {
      const message = event.data;

      switch (message.type) {
        case "STREAM_START": {
          setIsLoading(true);
          setError(null);
          const turn: AssistantTurn = {
            id: `turn-${Date.now()}`,
            role: "assistant",
            events: [],
            isStreaming: true,
            timestamp: Date.now(),
          };
          setEntries((prev) => [...prev, turn]);
          break;
        }

        case "AGENT_EVENT": {
          const evt = message.payload;
          if (evt.type === "done") {
            setIsLoading(false);
            setEntries((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (isAssistantTurn(last) && last.isStreaming) {
                updated[updated.length - 1] = { ...last, isStreaming: false };
              }
              return updated;
            });
          } else {
            setEntries((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (isAssistantTurn(last) && last.isStreaming) {
                updated[updated.length - 1] = {
                  ...last,
                  events: [...last.events, evt],
                };
              }
              return updated;
            });
          }
          break;
        }

        case "STREAM_ERROR": {
          setIsLoading(false);
          setError(message.payload);
          setEntries((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (isAssistantTurn(last) && last.isStreaming) {
              updated[updated.length - 1] = {
                ...last,
                isStreaming: false,
                events: [
                  ...last.events,
                  { type: "text-delta", text: `Error: ${message.payload}` },
                ],
              };
            }
            return updated;
          });
          break;
        }

        case "CONVERSATION_RESET": {
          setEntries([]);
          setError(null);
          break;
        }

        case "CONFIG_UPDATED": {
          setCurrentProvider(message.payload.provider);
          setCurrentModel(message.payload.model);
          setCurrentApiKey(message.payload.apiKey || "");
          setCurrentBaseUrl(message.payload.baseURL || "");
          break;
        }

        case "INIT_DATA": {
          setCustomModels(message.payload.models || []);
          if (message.payload.currentConfig) {
            setCurrentProvider(message.payload.currentConfig.provider);
            setCurrentModel(message.payload.currentConfig.model);
            setCurrentApiKey(message.payload.currentConfig.apiKey || "");
            setCurrentBaseUrl(message.payload.currentConfig.baseURL || "");
          }
          break;
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const sendPrompt = useCallback(
    (prompt: string) => {
      if (!prompt.trim() || isLoading) return;

      const userMsg: UserMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      };
      setEntries((prev) => [...prev, userMsg]);
      getVsCodeApi().postMessage({ type: "SEND_PROMPT", payload: prompt });
    },
    [isLoading]
  );

  const updateConfig = useCallback((config: { provider: string; model: string; apiKey?: string; baseURL?: string }) => {
    getVsCodeApi().postMessage({ type: "UPDATE_CONFIG", payload: config });
  }, []);

  const resetConversation = useCallback(() => {
    getVsCodeApi().postMessage({ type: "RESET_CONVERSATION" });
  }, []);

  return {
    entries,
    isLoading,
    error,
    currentProvider,
    currentModel,
    currentApiKey,
    currentBaseUrl,
    customModels,
    sendPrompt,
    updateConfig,
    resetConversation,
  };
}
