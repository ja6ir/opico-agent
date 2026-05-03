import { useRef, useEffect, useState } from "react";
import { useExtensionBridge } from "./hooks/useExtensionBridge";
import { ChatMessage } from "./components/ChatMessage";
import { SettingsModal } from "./components/SettingsModal";
import { HistoryPanel } from "./components/HistoryPanel";
import { CommandApprovalContext } from "./contexts/CommandApprovalContext";
import { Settings, History, Plus } from "lucide-react";
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
    commandStates,
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
    stopGeneration,
    allowCommand,
    denyCommand,
    abortCommand,
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
    <CommandApprovalContext.Provider value={{ commandStates, allowCommand, denyCommand, abortCommand }}>
    <div
      className={`flex flex-col h-screen font-sans transition-colors duration-500 ${
        isInitialScreen
          ? "bg-[radial-gradient(300%_70%_at_50%_101%,rgba(245,87,2,1)_0%,rgba(245,120,2,1)_8%,rgba(245,140,2,1)_12%,rgba(245,170,100,1)_20%,rgba(238,174,202,1)_38%,rgba(202,179,214,1)_60%,rgba(148,201,233,1)_100%)]"
          : "bg-[#111111] text-gray-200"
      }`}
    >
      <header
        className={`flex items-center justify-between px-4 py-3 transition-colors duration-500 ${
          isInitialScreen ? "bg-transparent" : "border-b border-white/5 bg-[#181818]"
        }`}
      >
        <h1 className={`flex items-center text-xs font-semibold tracking-wide ${isInitialScreen ? "text-white" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mr-px text-white">
            <defs>
              <mask id="ring-mask">
                <rect width="24" height="24" fill="white"/>
                <rect x="20.2" y="10.2" width="4" height="3.6" fill="black"/>
              </mask>
            </defs>
            <circle cx="12" cy="12" r="10.2" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" mask="url(#ring-mask)"/>
            <circle cx="22.2" cy="12" r="1" fill="white" opacity="0.5"/>
            <rect x="8" y="8" width="8" height="8" rx="1.2" fill="none" stroke="white" strokeWidth="1.4"/>
            <rect x="9.5" y="9.5" width="5" height="5" rx="0.6" fill="none" stroke="white" strokeWidth="0.9" opacity="0.55"/>
            <line x1="5.5" y1="12" x2="8" y2="12" stroke="white" strokeWidth="1.2" opacity="0.65"/>
            <line x1="16" y1="12" x2="17.8" y2="12" stroke="white" strokeWidth="1.2" opacity="0.65"/>
            <line x1="12" y1="5.5" x2="12" y2="8" stroke="white" strokeWidth="1.2" opacity="0.65"/>
            <line x1="12" y1="16" x2="12" y2="18.5" stroke="white" strokeWidth="1.2" opacity="0.65"/>
            <rect x="7" y="9.6" width="1.2" height="0.7" rx="0.15" fill="white" opacity="0.65"/>
            <rect x="7" y="11.65" width="1.2" height="0.7" rx="0.15" fill="white" opacity="0.65"/>
            <rect x="7" y="13.7" width="1.2" height="0.7" rx="0.15" fill="white" opacity="0.65"/>
            <rect x="15.8" y="9.6" width="1.2" height="0.7" rx="0.15" fill="white" opacity="0.65"/>
            <rect x="15.8" y="11.65" width="1.2" height="0.7" rx="0.15" fill="white" opacity="0.65"/>
            <rect x="15.8" y="13.7" width="1.2" height="0.7" rx="0.15" fill="white" opacity="0.65"/>
            <rect x="9.6" y="7" width="0.7" height="1.2" rx="0.15" fill="white" opacity="0.65"/>
            <rect x="11.65" y="7" width="0.7" height="1.2" rx="0.15" fill="white" opacity="0.65"/>
            <rect x="13.7" y="7" width="0.7" height="1.2" rx="0.15" fill="white" opacity="0.65"/>
            <rect x="9.6" y="15.8" width="0.7" height="1.2" rx="0.15" fill="white" opacity="0.65"/>
            <rect x="11.65" y="15.8" width="0.7" height="1.2" rx="0.15" fill="white" opacity="0.65"/>
            <rect x="13.7" y="15.8" width="0.7" height="1.2" rx="0.15" fill="white" opacity="0.65"/>
          </svg>
          pico Agent
        </h1>
        <div className="flex items-center gap-2">
          {!isInitialScreen && (
            <button
              onClick={resetConversation}
              className="p-1.5 rounded transition-colors text-gray-500 hover:text-white hover:bg-white/5"
              title="New Chat"
            >
              <Plus size={16} />
            </button>
          )}
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
                onStop={stopGeneration}
                isLoading={isLoading}
                placeholder={"Ask me to build, refactor, or explain....\nUse @ to mention files or folders"}
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
                onStop={stopGeneration}
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
    </CommandApprovalContext.Provider>
  );
}
