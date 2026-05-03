import { useRef, useEffect, useState } from "react";
import { useExtensionBridge } from "./hooks/useExtensionBridge";
import { ChatMessage } from "./components/ChatMessage";
import { SettingsModal } from "./components/SettingsModal";
import { HistoryPanel } from "./components/HistoryPanel";
import { Settings, Trash2, History } from "lucide-react";
import { PromptInputBox } from "./components/ui/ai-prompt-box";

export default function App() {
  const {
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
    clearBranchPrompt,
    sendPrompt,
    updateConfig,
    resetConversation,
    listConversations,
    loadConversation,
    branchConversation,
    deleteConversation,
    workspaceFiles,
    requestWorkspaceFiles,
    openFile,
  } = useExtensionBridge();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  useEffect(() => {
    if (branchPrompt) {
      setInputValue(branchPrompt);
      clearBranchPrompt();
    }
  }, [branchPrompt]);

  const handleSend = (message: string, _files?: File[]) => {
    if (!message.trim() || isLoading) return;
    sendPrompt(message);
    setInputValue("");
  };

  const handleOpenHistory = () => {
    listConversations();
    setIsHistoryOpen(true);
  };

  const handleBranch = (entryIndex: number) => {
    branchConversation(entryIndex);
  };

  const isInitialScreen = entries.length === 0;

  return (
    <div
      className={`flex flex-col h-screen font-sans transition-colors duration-500 ${
        isInitialScreen
          ? "bg-[radial-gradient(125%_125%_at_50%_101%,rgba(245,87,2,1)_10.5%,rgba(245,120,2,1)_16%,rgba(245,140,2,1)_17.5%,rgba(245,170,100,1)_25%,rgba(238,174,202,1)_40%,rgba(202,179,214,1)_65%,rgba(148,201,233,1)_100%)]"
          : "bg-[#111111] text-gray-200"
      }`}
    >
      <header
        className={`flex items-center justify-between px-4 py-3 transition-colors duration-500 ${
          isInitialScreen ? "bg-transparent" : "border-b border-white/5 bg-[#181818]"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className={`text-sm font-semibold tracking-wide ${isInitialScreen ? "text-white" : ""}`}>
            Opico Agent
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenHistory}
            className={`p-1.5 rounded transition-colors ${
              isInitialScreen
                ? "text-white/80 hover:text-white hover:bg-white/20"
                : "text-gray-500 hover:text-white hover:bg-white/5"
            }`}
            title="Chat History"
          >
            <History size={16} />
          </button>
          <button
            onClick={resetConversation}
            className={`p-1.5 rounded transition-colors ${
              isInitialScreen
                ? "text-white/80 hover:text-white hover:bg-white/20"
                : "text-gray-500 hover:text-red-400 hover:bg-white/5"
            }`}
            title="Reset Conversation"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`p-1.5 rounded transition-colors ${
              isInitialScreen
                ? "text-white/80 hover:text-white hover:bg-white/20"
                : "text-gray-500 hover:text-white hover:bg-white/5"
            }`}
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {isInitialScreen ? (
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-[800px] flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-500">
            <h2 className="text-4xl md:text-5xl font-bold text-white text-center tracking-tight">
              What can I help you ship?
            </h2>
            <div className="w-full max-w-[600px]">
              <PromptInputBox
                onSend={handleSend}
                isLoading={isLoading}
                placeholder="Ask me to build, refactor, or explain... Use @ to mention files or folders"
                value={inputValue}
                onValueChange={setInputValue}
                workspaceFiles={workspaceFiles}
                requestWorkspaceFiles={requestWorkspaceFiles}
              />
            </div>
          </div>
        </main>
      ) : (
        <>
          <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="flex flex-col max-w-3xl mx-auto pt-4">
              {entries.map((entry, index) => (
                <ChatMessage
                  key={entry.id}
                  entry={entry}
                  entryIndex={index}
                  onBranch={entry.role === "user" ? handleBranch : undefined}
                  openFile={openFile}
                />
              ))}
              {error && (
                <div className="mb-4 p-3 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl animate-in fade-in slide-in-from-bottom-2">
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </main>

          <div className="p-4 bg-gradient-to-t from-[#111111] via-[#111111] to-transparent">
            <div className="max-w-3xl mx-auto">
              <PromptInputBox
                onSend={handleSend}
                isLoading={isLoading}
                placeholder="Reply to Opico Agent... Use @ to mention files or folders"
                value={inputValue}
                onValueChange={setInputValue}
                workspaceFiles={workspaceFiles}
                requestWorkspaceFiles={requestWorkspaceFiles}
              />
            </div>
          </div>
        </>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentProvider={currentProvider}
        currentModel={currentModel}
        currentApiKey={currentApiKey}
        currentBaseUrl={currentBaseUrl}
        customModels={customModels}
        onChangeModel={updateConfig}
      />

      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onLoad={loadConversation}
        onDelete={deleteConversation}
      />
    </div>
  );
}
