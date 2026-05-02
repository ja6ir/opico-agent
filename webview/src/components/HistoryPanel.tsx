import React from "react";
import { X, Trash2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ConversationSummary } from "../hooks/useExtensionBridge";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  currentConversationId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  conversations,
  currentConversationId,
  onLoad,
  onDelete,
}) => {
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-[280px] bg-[#1A1A1A] border-r border-white/10 z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 className="text-sm font-semibold text-gray-200 tracking-wide">History</h2>
              <button
                onClick={onClose}
                className="p-1 text-gray-500 hover:text-white hover:bg-white/5 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                  <MessageSquare size={32} className="text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500">No conversations yet</p>
                  <p className="text-xs text-gray-600 mt-1">Your chat history will appear here</p>
                </div>
              ) : (
                <div className="py-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`group relative mx-2 mb-1 rounded-lg transition-colors ${
                        conv.id === currentConversationId
                          ? "bg-white/10"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <button
                        onClick={() => {
                          onLoad(conv.id);
                          onClose();
                        }}
                        className="w-full text-left px-3 py-2.5 pr-8"
                      >
                        <p className="text-sm text-gray-200 truncate leading-snug">
                          {conv.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-gray-500">
                            {formatRelativeTime(conv.updatedAt)}
                          </span>
                          <span className="text-[11px] text-gray-600">·</span>
                          <span className="text-[11px] text-gray-500">
                            {conv.messageCount} messages
                          </span>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (deleteConfirmId === conv.id) {
                            onDelete(conv.id);
                            setDeleteConfirmId(null);
                          } else {
                            setDeleteConfirmId(conv.id);
                            setTimeout(() => setDeleteConfirmId(null), 3000);
                          }
                        }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all ${
                          deleteConfirmId === conv.id
                            ? "text-red-400 bg-red-500/10 opacity-100"
                            : "text-gray-600 hover:text-red-400 hover:bg-white/5 opacity-0 group-hover:opacity-100"
                        }`}
                        title={deleteConfirmId === conv.id ? "Click again to confirm" : "Delete"}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
