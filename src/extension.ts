import * as vscode from "vscode";
import { ChatWebviewProvider } from "./providers/ChatWebviewProvider";

/**
 * Extension entry point — called when VS Code activates the extension.
 *
 * Registers:
 * 1. The ChatWebviewProvider for the sidebar panel.
 * 2. Commands (e.g., opening the chat view).
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log("[Opico Agent] Extension activating...");

  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";

  if (!workspaceRoot) {
    vscode.window.showWarningMessage(
      "Opico Agent: No workspace folder detected. Some features may not work correctly."
    );
  }

  // Register the Webview Provider for the sidebar
  const chatProvider = new ChatWebviewProvider(
    context.extensionUri,
    workspaceRoot,
    context
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatWebviewProvider.viewType,
      chatProvider
    )
  );

  // Register the "Open Chat" command
  context.subscriptions.push(
    vscode.commands.registerCommand("opico-agent.openChat", () => {
      // Focus the sidebar view
      vscode.commands.executeCommand("opico-agent.chatView.focus");
    })
  );

  console.log("[Opico Agent] Extension activated successfully.");
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  console.log("[Opico Agent] Extension deactivated.");
}
