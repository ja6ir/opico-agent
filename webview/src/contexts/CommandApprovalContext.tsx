import React from "react";
import type { CommandState } from "../hooks/useExtensionBridge";

interface CommandApprovalContextType {
  commandStates: Record<string, CommandState>;
  allowCommand: (toolCallId: string) => void;
  denyCommand: (toolCallId: string) => void;
  abortCommand: (toolCallId: string) => void;
}

export const CommandApprovalContext = React.createContext<CommandApprovalContextType>({
  commandStates: {},
  allowCommand: () => {},
  denyCommand: () => {},
  abortCommand: () => {},
});
