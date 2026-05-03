import { useState, useEffect, useCallback, useRef } from "react";

export type AgentStreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
  | { type: "step-start" }
  | { type: "step-end" }
  | { type: "done" };

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface WorkspaceFileEntry {
  path: string;
  type: "file" | "folder";
}

export type IncomingMessage =
  | { type: "STREAM_START" }
  | { type: "AGENT_EVENT"; payload: AgentStreamEvent }
  | { type: "STREAM_ERROR"; payload: string }
  | { type: "CONFIG_UPDATED"; payload: { provider: string; model: string; apiKey?: string; baseURL?: string } }
  | { type: "CONVERSATION_RESET" }
  | { type: "INIT_DATA"; payload: { models: any[]; currentConfig: { provider: string; model: string; apiKey?: string; baseURL?: string } } }
  | { type: "CONVERSATIONS_LIST"; payload: ConversationSummary[] }
  | { type: "CONVERSATION_LOADED"; payload: { id: string; entries: ChatEntry[] } }
  | { type: "CONVERSATION_BRANCHED"; payload: { id: string; entries: ChatEntry[]; branchPrompt: string } }
  | { type: "WORKSPACE_FILES"; payload: WorkspaceFileEntry[] }
  | { type: "COMMAND_PENDING"; payload: { toolCallId: string; command: string } }
  | { type: "COMMAND_EXECUTING"; payload: { toolCallId: string } };

export type OutgoingMessage =
  | { type: "SEND_PROMPT"; payload: string }
  | { type: "UPDATE_CONFIG"; payload: { provider: string; model: string; apiKey?: string; baseURL?: string } }
  | { type: "RESET_CONVERSATION" }
  | { type: "LIST_CONVERSATIONS" }
  | { type: "LOAD_CONVERSATION"; payload: { id: string } }
  | { type: "BRANCH_CONVERSATION"; payload: { entryIndex: number } }
  | { type: "DELETE_CONVERSATION"; payload: { id: string } }
  | { type: "SAVE_CONVERSATION"; payload: { entries: ChatEntry[] } }
  | { type: "LIST_WORKSPACE_FILES"; payload: { query: string } }
  | { type: "OPEN_FILE"; payload: { path: string } }
  | { type: "STOP_GENERATION" }
  | { type: "ALLOW_COMMAND"; payload: { toolCallId: string } }
  | { type: "DENY_COMMAND"; payload: { toolCallId: string } }
  | { type: "ABORT_COMMAND"; payload: { toolCallId: string } };

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

export type CommandState = "pending" | "executing";

export function useExtensionBridge() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState("anthropic");
  const [currentModel, setCurrentModel] = useState("claude-3-5-sonnet-20241022");
  const [currentApiKey, setCurrentApiKey] = useState("");
  const [currentBaseUrl, setCurrentBaseUrl] = useState("");
  const [customModels, setCustomModels] = useState<any[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [branchPrompt, setBranchPrompt] = useState<string | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileEntry[]>([]);
  const [commandStates, setCommandStates] = useState<Record<string, CommandState>>({});

  const entriesRef = useRef<ChatEntry[]>(entries);
  entriesRef.current = entries;

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
            setCommandStates({});
            setEntries((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (isAssistantTurn(last) && last.isStreaming) {
                updated[updated.length - 1] = { ...last, isStreaming: false };
              }
              return updated;
            });
            setTimeout(() => {
              getVsCodeApi().postMessage({
                type: "SAVE_CONVERSATION",
                payload: { entries: entriesRef.current },
              });
            }, 100);
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
            if (evt.type === "tool-result") {
              setCommandStates((prev) => {
                const next = { ...prev };
                delete next[evt.toolCallId];
                return next;
              });
            }
          }
          break;
        }

        case "STREAM_ERROR": {
          setIsLoading(false);
          setCommandStates({});
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
          setCurrentConversationId(null);
          setCommandStates({});
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

        case "CONVERSATIONS_LIST": {
          setConversations(message.payload);
          break;
        }

        case "CONVERSATION_LOADED": {
          setEntries(message.payload.entries);
          setCurrentConversationId(message.payload.id);
          setError(null);
          setIsLoading(false);
          setCommandStates({});
          break;
        }

        case "CONVERSATION_BRANCHED": {
          setEntries(message.payload.entries);
          setCurrentConversationId(message.payload.id);
          setBranchPrompt(message.payload.branchPrompt || null);
          setError(null);
          setIsLoading(false);
          setCommandStates({});
          break;
        }

        case "WORKSPACE_FILES": {
          setWorkspaceFiles(message.payload);
          break;
        }

        case "COMMAND_PENDING": {
          setCommandStates((prev) => ({
            ...prev,
            [message.payload.toolCallId]: "pending",
          }));
          break;
        }

        case "COMMAND_EXECUTING": {
          setCommandStates((prev) => ({
            ...prev,
            [message.payload.toolCallId]: "executing",
          }));
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

  const listConversations = useCallback(() => {
    getVsCodeApi().postMessage({ type: "LIST_CONVERSATIONS" });
  }, []);

  const loadConversation = useCallback((id: string) => {
    getVsCodeApi().postMessage({ type: "LOAD_CONVERSATION", payload: { id } });
  }, []);

  const branchConversation = useCallback((entryIndex: number) => {
    getVsCodeApi().postMessage({ type: "BRANCH_CONVERSATION", payload: { entryIndex } });
  }, []);

  const deleteConversation = useCallback((id: string) => {
    getVsCodeApi().postMessage({ type: "DELETE_CONVERSATION", payload: { id } });
  }, []);

  const requestWorkspaceFiles = useCallback((query: string) => {
    getVsCodeApi().postMessage({ type: "LIST_WORKSPACE_FILES", payload: { query } });
  }, []);

  const openFile = useCallback((filePath: string) => {
    getVsCodeApi().postMessage({ type: "OPEN_FILE", payload: { path: filePath } });
  }, []);

  const stopGeneration = useCallback(() => {
    getVsCodeApi().postMessage({ type: "STOP_GENERATION" });
  }, []);

  const allowCommand = useCallback((toolCallId: string) => {
    getVsCodeApi().postMessage({ type: "ALLOW_COMMAND", payload: { toolCallId } });
  }, []);

  const denyCommand = useCallback((toolCallId: string) => {
    getVsCodeApi().postMessage({ type: "DENY_COMMAND", payload: { toolCallId } });
    setCommandStates((prev) => {
      const next = { ...prev };
      delete next[toolCallId];
      return next;
    });
  }, []);

  const abortCommand = useCallback((toolCallId: string) => {
    getVsCodeApi().postMessage({ type: "ABORT_COMMAND", payload: { toolCallId } });
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
    conversations,
    currentConversationId,
    branchPrompt,
    workspaceFiles,
    commandStates,
    clearBranchPrompt: () => setBranchPrompt(null),
    sendPrompt,
    updateConfig,
    resetConversation,
    listConversations,
    loadConversation,
    branchConversation,
    deleteConversation,
    requestWorkspaceFiles,
    openFile,
    stopGeneration,
    allowCommand,
    denyCommand,
    abortCommand,
  };
}
