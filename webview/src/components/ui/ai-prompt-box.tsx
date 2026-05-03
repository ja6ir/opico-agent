import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUp, Square, X, File, Folder } from "lucide-react";
import { motion } from "framer-motion";
import type { WorkspaceFileEntry } from "../../hooks/useExtensionBridge";

// interface WebkitSpeechRecognitionEvent {
//   resultIndex: number;
//   results: {
//     length: number;
//     [index: number]: { isFinal: boolean; [index: number]: { transcript: string } };
//   };
// }

// interface WebkitSpeechRecognitionInstance {
//   continuous: boolean;
//   interimResults: boolean;
//   lang: string;
//   onresult: ((event: WebkitSpeechRecognitionEvent) => void) | null;
//   onerror: ((event: { error: string; message?: string }) => void) | null;
//   onend: (() => void) | null;
//   start(): void;
//   stop(): void;
//   abort(): void;
// }

// Utility function for className merging
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

// Embedded CSS for minimal custom styles
const styles = `
  *:focus-visible {
    outline-offset: 0 !important;
    --ring-offset: 0 !important;
  }
  textarea::-webkit-scrollbar {
    width: 6px;
  }
  textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  textarea::-webkit-scrollbar-thumb {
    background-color: #444444;
    border-radius: 3px;
  }
  textarea::-webkit-scrollbar-thumb:hover {
    background-color: #555555;
  }
`;

// Inject styles into document
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-base text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] resize-none scrollbar-thin scrollbar-thumb-[#444444] scrollbar-track-transparent hover:scrollbar-thumb-[#555555]",
      className
    )}
    ref={ref}
    rows={1}
    {...props}
  />
));
Textarea.displayName = "Textarea";

// Tooltip Components
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-[#333333] bg-[#1F2023] px-3 py-1.5 text-sm text-white shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Dialog Components
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border border-[#333333] bg-[#1F2023] p-0 shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-[#2E3033]/80 p-2 hover:bg-[#2E3033] transition-all">
        <X className="h-5 w-5 text-gray-200 hover:text-white" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight text-gray-100", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-white hover:bg-white/80 text-black",
      outline: "border border-[#444444] bg-transparent hover:bg-[#3A3A40]",
      ghost: "bg-transparent hover:bg-[#3A3A40]",
    };
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6",
      icon: "h-8 w-8 rounded-full aspect-[1/1]",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// VoiceRecorder Component
interface VoiceRecorderProps {
  isRecording: boolean;
  visualizerBars?: number;
}
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isRecording,
  visualizerBars = 32,
}) => {
  const [time, setTime] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-full transition-all duration-300 py-3",
        isRecording ? "opacity-100" : "opacity-0 h-0"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-sm text-white/80">{formatTime(time)}</span>
      </div>
      <div className="w-full h-10 flex items-center justify-center gap-0.5 px-4">
        {[...Array(visualizerBars)].map((_, i) => (
          <div
            key={i}
            className="w-0.5 rounded-full bg-white/50 animate-pulse"
            style={{
              height: `${Math.max(15, Math.random() * 100)}%`,
              animationDelay: `${i * 0.05}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ImageViewDialog Component
interface ImageViewDialogProps {
  imageUrl: string | null;
  onClose: () => void;
}
const ImageViewDialog: React.FC<ImageViewDialogProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-[90vw] md:max-w-[800px]">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative bg-[#1F2023] rounded-2xl overflow-hidden shadow-2xl"
        >
          <img
            src={imageUrl}
            alt="Full preview"
            className="w-full max-h-[80vh] object-contain rounded-2xl"
          />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

// PromptInput Context and Components
interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
});
function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 240,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              "rounded-3xl border border-[#444444] bg-[#1F2023] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300",
              isLoading && "border-red-500/70",
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {}
const PromptInputActions: React.FC<PromptInputActionsProps> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}
const PromptInputAction: React.FC<PromptInputActionProps> = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

// Custom Divider Component
// const CustomDivider: React.FC = () => (
//   <div className="relative h-6 w-[1.5px] mx-1">
//     <div
//       className="absolute inset-0 bg-gradient-to-t from-transparent via-[#9b87f5]/70 to-transparent rounded-full"
//       style={{
//         clipPath: "polygon(0% 0%, 100% 0%, 100% 40%, 140% 50%, 100% 60%, 100% 100%, 0% 100%, 0% 60%, -40% 50%, 0% 40%)",
//       }}
//     />
//   </div>
// );

interface FileMentionDropdownProps {
  files: WorkspaceFileEntry[];
  query: string;
  highlightedIndex: number;
  onSelect: (file: WorkspaceFileEntry) => void;
  onHighlight: (index: number) => void;
  visible: boolean;
}

const FileMentionDropdown: React.FC<FileMentionDropdownProps> = ({
  files,
  query,
  highlightedIndex,
  onSelect,
  onHighlight,
  visible,
}) => {
  if (!visible || files.length === 0) return null;

  const highlightMatch = (text: string) => {
    if (!query) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-[#D1D5DB] font-semibold">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div
      className="absolute left-0 right-0 bottom-full mb-1 z-50 max-h-[240px] overflow-y-auto rounded-xl border border-[#333333] bg-[#1F2023] shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
      style={{ scrollbarWidth: "thin" }}
    >
      <div className="py-1">
        {files.map((file, index) => (
          <div
            key={file.path}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors",
              index === highlightedIndex
                ? "bg-[#2E3033] text-white"
                : "text-gray-400 hover:bg-[#2E3033]/50 hover:text-gray-200"
            )}
            onMouseEnter={() => onHighlight(index)}
            onClick={() => onSelect(file)}
          >
            {file.type === "folder" ? (
              <Folder className="h-4 w-4 text-[#DCB67A] flex-shrink-0" />
            ) : (
              <File className="h-4 w-4 text-[#6A9955] flex-shrink-0" />
            )}
            <span className="truncate font-mono text-xs">
              {highlightMatch(file.path)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main PromptInputBox Component
interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  initialValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  workspaceFiles?: WorkspaceFileEntry[];
  requestWorkspaceFiles?: (query: string) => void;
}
export const PromptInputBox = React.forwardRef((props: PromptInputBoxProps, ref: React.Ref<HTMLDivElement>) => {
  const {
    onSend = () => {},
    isLoading = false,
    placeholder = "Type your message here... Use @ to mention files or folders",
    className,
    initialValue = "",
    value,
    workspaceFiles = [],
    requestWorkspaceFiles = () => {},
  } = props;
  const [internalValue, setInternalValue] = React.useState(value ?? initialValue);
  const [files, setFiles] = React.useState<File[]>([]);
  const [filePreviews, setFilePreviews] = React.useState<{ [key: string]: string }>({});
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [isRecording] = React.useState(false);
  // const [showSearch, setShowSearch] = React.useState(false);
  // const [showThink, setShowThink] = React.useState(false);
  // const [showCanvas, setShowCanvas] = React.useState(false);
  // const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const promptBoxRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const mirrorRef = React.useRef<HTMLDivElement>(null);

  const [mentionState, setMentionState] = React.useState<{
    active: boolean;
    query: string;
    startIndex: number;
  } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);

  const debouncedFileRequestRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const detectMention = React.useCallback((text: string, cursorPos: number) => {
    const textBeforeCursor = text.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^@\s]*)$/);
    if (atMatch) {
      const query = atMatch[1];
      const startIndex = cursorPos - query.length - 1;
      const charBefore = startIndex > 0 ? text[startIndex - 1] : " ";
      if (charBefore !== " " && charBefore !== "\n" && startIndex > 0) {
        setMentionState(null);
        return;
      }
      setMentionState({ active: true, query, startIndex });
      setHighlightedIndex(0);
      if (debouncedFileRequestRef.current) clearTimeout(debouncedFileRequestRef.current);
      debouncedFileRequestRef.current = setTimeout(() => {
        requestWorkspaceFiles(query);
      }, 100);
    } else {
      if (mentionState?.active) {
        setMentionState(null);
        setHighlightedIndex(0);
      }
    }
  }, [mentionState, requestWorkspaceFiles]);

  const handleChange = React.useCallback((newValue: string) => {
    setInternalValue(newValue);
    props.onValueChange?.(newValue);
    const cursorPos = textareaRef.current?.selectionStart ?? newValue.length;
    detectMention(newValue, cursorPos);
  }, [props.onValueChange, detectMention]);

  const insertMention = React.useCallback((file: WorkspaceFileEntry) => {
    if (!mentionState) return;
    const text = internalValue;
    const before = text.slice(0, mentionState.startIndex);
    const after = text.slice(mentionState.startIndex + 1 + mentionState.query.length);
    const insertPath = file.type === "folder" ? `${file.path}/` : file.path;
    const newValue = `${before}@${insertPath} ${after}`;
    setInternalValue(newValue);
    props.onValueChange?.(newValue);
    setMentionState(null);
    setHighlightedIndex(0);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionState.startIndex + 1 + insertPath.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  }, [internalValue, mentionState, props.onValueChange]);

  const handleTextareaKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionState?.active || workspaceFiles.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.min(workspaceFiles.length, 100));
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + Math.min(workspaceFiles.length, 100)) % Math.min(workspaceFiles.length, 100));
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const visibleFiles = workspaceFiles.slice(0, 100);
      if (visibleFiles[highlightedIndex]) {
        insertMention(visibleFiles[highlightedIndex]);
      }
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setMentionState(null);
      setHighlightedIndex(0);
      return true;
    }
    return false;
  }, [mentionState, workspaceFiles, highlightedIndex, insertMention]);

  const syncMirrorScroll = React.useCallback(() => {
    if (mirrorRef.current && textareaRef.current) {
      mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    const parts: React.ReactNode[] = [];
    const regex = /@([a-zA-Z0-9._\-/\\]+)/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
      }
      parts.push(
        <span key={key++} style={{ color: "#CE9178" }}>
          {match[0]}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
    }

    if (parts.length === 0 && text) {
      parts.push(<span key={0}>{text}</span>);
    }

    return parts;
  };

  // const handleToggleChange = (value: string) => {
  //   if (value === "search") {
  //     setShowSearch((prev) => !prev);
  //     setShowThink(false);
  //   } else if (value === "think") {
  //     setShowThink((prev) => !prev);
  //     setShowSearch(false);
  //   }
  // };

  // const handleCanvasToggle = () => setShowCanvas((prev) => !prev);

  const isImageFile = (file: File) => file.type.startsWith("image/");

  const processFile = (file: File) => {
    if (!isImageFile(file)) {
      console.log("Only image files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      console.log("File too large (max 10MB)");
      return;
    }
    setFiles([file]);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreviews({ [file.name]: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => isImageFile(file));
    if (imageFiles.length > 0) processFile(imageFiles[0]);
  }, []);

  const handleRemoveFile = (index: number) => {
    const fileToRemove = files[index];
    if (fileToRemove && filePreviews[fileToRemove.name]) setFilePreviews({});
    setFiles([]);
  };

  const openImageModal = (imageUrl: string) => setSelectedImage(imageUrl);

  const handlePaste = React.useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
          break;
        }
      }
    }
  }, []);

  React.useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleSubmit = () => {
    if (internalValue.trim() || files.length > 0) {
      onSend(internalValue, files);
      setInternalValue("");
      setFiles([]);
      setFilePreviews({});
      setMentionState(null);
    }
  };

  // const recognitionRef = React.useRef<WebkitSpeechRecognitionInstance | null>(null);
  // const mediaStreamRef = React.useRef<MediaStream | null>(null);
  // const stoppedManuallyRef = React.useRef(false);

  // const handleStartRecording = React.useCallback(async () => {
  //   ...
  // }, [props.onValueChange]);

  // const handleStopRecording = React.useCallback(() => {
  //   ...
  // }, []);

  const hasContent = internalValue.trim() !== "" || files.length > 0;

  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionState?.active && promptBoxRef.current && !promptBoxRef.current.contains(e.target as Node)) {
        setMentionState(null);
        setHighlightedIndex(0);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mentionState]);

  const currentPlaceholder = placeholder;

  const maxTextareaHeight = 240;

  const autoResizeTextarea = React.useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, maxTextareaHeight)}px`;
  }, []);

  React.useEffect(() => {
    autoResizeTextarea();
  }, [internalValue, autoResizeTextarea]);

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const handled = handleTextareaKeyDown(e);
    if (handled) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!mentionState?.active) {
        handleSubmit();
      }
    }
  };

  return (
    <>
      <div className="relative" ref={promptBoxRef}>
        {mentionState?.active && workspaceFiles.length > 0 && (
          <FileMentionDropdown
            files={workspaceFiles.slice(0, 100)}
            query={mentionState.query}
            highlightedIndex={highlightedIndex}
            onSelect={insertMention}
            onHighlight={setHighlightedIndex}
            visible={true}
          />
        )}
        <PromptInput
          value={internalValue}
          onValueChange={handleChange}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          className={cn(
            "w-full bg-[#1F2023] border-[#444444] shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300 ease-in-out",
            isRecording && "border-red-500/70",
            className
          )}
          disabled={isLoading || isRecording}
          ref={ref}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {files.length > 0 && !isRecording && (
            <div className="flex flex-wrap gap-2 p-0 pb-1 transition-all duration-300">
              {files.map((file, index) => (
                <div key={index} className="relative group">
                  {file.type.startsWith("image/") && filePreviews[file.name] && (
                    <div
                      className="w-16 h-16 rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
                      onClick={() => openImageModal(filePreviews[file.name])}
                    >
                      <img
                        src={filePreviews[file.name]}
                        alt={file.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(index);
                        }}
                        className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            className={cn(
              "transition-all duration-300",
              isRecording ? "h-0 overflow-hidden opacity-0" : "opacity-100"
            )}
          >
            <div className="relative">
              <div
                ref={mirrorRef}
                className="absolute inset-0 pointer-events-none overflow-hidden px-3 py-2.5 text-base font-sans whitespace-pre-wrap break-words"
                style={{
                  color: "#F3F4F6",
                  maxHeight: `${maxTextareaHeight}px`,
                }}
              >
                {renderHighlightedText(internalValue) || (
                  <span className="text-gray-400">{currentPlaceholder}</span>
                )}
              </div>
              <textarea
                ref={textareaRef}
                value={internalValue}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={onTextareaKeyDown}
                onScroll={syncMirrorScroll}
                className={cn(
                  "flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-base font-sans focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] resize-none",
                  "scrollbar-thin scrollbar-thumb-[#444444] scrollbar-track-transparent hover:scrollbar-thumb-[#555555]"
                )}
                style={{
                  color: "transparent",
                  caretColor: "#F3F4F6",
                  maxHeight: `${maxTextareaHeight}px`,
                }}
                disabled={isLoading || isRecording}
                placeholder={currentPlaceholder}
                rows={1}
              />
            </div>
          </div>

          {isRecording && (
            <VoiceRecorder
              isRecording={isRecording}
            />
          )}

          <PromptInputActions className="flex items-center justify-between gap-2 p-0 pt-2">
            <div
              className={cn(
                "flex items-center gap-1 transition-opacity duration-300",
                isRecording ? "opacity-0 invisible h-0" : "opacity-100 visible"
              )}
            >
              {/* <PromptInputAction tooltip="Upload image">
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex h-8 w-8 text-[#9CA3AF] cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-gray-600/30 hover:text-[#D1D5DB]"
                  disabled={isRecording}
                >
                  <Paperclip className="h-5 w-5 transition-colors" />
                  <input
                    ref={uploadInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) processFile(e.target.files[0]);
                      if (e.target) e.target.value = "";
                    }}
                    accept="image/*"
                  />
                </button>
              </PromptInputAction> */}

              {/* <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleToggleChange("search")}
                  className={cn(
                    "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                    showSearch
                      ? "bg-[#1EAEDB]/15 border-[#1EAEDB] text-[#1EAEDB]"
                      : "bg-transparent border-transparent text-[#9CA3AF] hover:text-[#D1D5DB]"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <motion.div
                      animate={{ rotate: showSearch ? 360 : 0, scale: showSearch ? 1.1 : 1 }}
                      whileHover={{ rotate: showSearch ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                    >
                      <Globe className={cn("w-4 h-4", showSearch ? "text-[#1EAEDB]" : "text-inherit")} />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {showSearch && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs overflow-hidden whitespace-nowrap text-[#1EAEDB] flex-shrink-0"
                      >
                        Search
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <CustomDivider />

                <button
                  type="button"
                  onClick={() => handleToggleChange("think")}
                  className={cn(
                    "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                    showThink
                      ? "bg-[#8B5CF6]/15 border-[#8B5CF6] text-[#8B5CF6]"
                      : "bg-transparent border-transparent text-[#9CA3AF] hover:text-[#D1D5DB]"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <motion.div
                      animate={{ rotate: showThink ? 360 : 0, scale: showThink ? 1.1 : 1 }}
                      whileHover={{ rotate: showThink ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                    >
                      <BrainCog className={cn("w-4 h-4", showThink ? "text-[#8B5CF6]" : "text-inherit")} />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {showThink && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs overflow-hidden whitespace-nowrap text-[#8B5CF6] flex-shrink-0"
                      >
                        Think
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <CustomDivider />

                <button
                  type="button"
                  onClick={handleCanvasToggle}
                  className={cn(
                    "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                    showCanvas
                      ? "bg-[#F97316]/15 border-[#F97316] text-[#F97316]"
                      : "bg-transparent border-transparent text-[#9CA3AF] hover:text-[#D1D5DB]"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <motion.div
                      animate={{ rotate: showCanvas ? 360 : 0, scale: showCanvas ? 1.1 : 1 }}
                      whileHover={{ rotate: showCanvas ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                    >
                      <FolderCode className={cn("w-4 h-4", showCanvas ? "text-[#F97316]" : "text-inherit")} />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {showCanvas && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs overflow-hidden whitespace-nowrap text-[#F97316] flex-shrink-0"
                      >
                        Canvas
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div> */}
            </div>

            <PromptInputAction
              tooltip={
                isLoading
                  ? "Stop generation"
                  : "Send message"
              }
            >
              <Button
                variant="default"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full transition-all duration-200",
                  hasContent
                    ? "bg-white hover:bg-white/80 text-[#1F2023]"
                    : "bg-transparent hover:bg-gray-600/30 text-[#9CA3AF] hover:text-[#D1D5DB]"
                )}
                onClick={() => {
                  if (hasContent) handleSubmit();
                }}
                disabled={isLoading || !hasContent}
              >
                {isLoading ? (
                  <Square className="h-4 w-4 fill-[#1F2023] animate-pulse" />
                ) : (
                  <ArrowUp className="h-4 w-4 text-[#1F2023]" />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>

      <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </>
  );
});
PromptInputBox.displayName = "PromptInputBox";
