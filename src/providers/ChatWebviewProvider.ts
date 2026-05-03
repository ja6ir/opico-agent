import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { AgentService } from "../llm/AgentService";
import { CommandApprovalManager } from "../tools/CommandApprovalManager";

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  entries: any[];
  modelMessages: any[];
  parentConversationId?: string;
  branchPointIndex?: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

const STORAGE_KEY = "opico.conversations";

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".svn", ".hg", "dist", "build", ".next", ".nuxt",
  "__pycache__", ".cache", ".parcel-cache", ".turbo", ".vercel",
  "coverage", ".idea", ".vscode", "target", "bin", "obj", "out",
  ".tox", ".mypy_cache", ".pytest_cache", "vendor", "Pods",
]);

interface WorkspaceFileEntry {
  path: string;
  type: "file" | "folder";
}

export class ChatWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "opico-agent.chatView";

  private webviewView?: vscode.WebviewView;
  private agentService: AgentService;
  private commandApproval: CommandApprovalManager;
  private context: vscode.ExtensionContext;
  private currentConversationId: string | null = null;
  private currentEntries: any[] = [];
  private workspaceRoot: string;
  private cachedFileList: WorkspaceFileEntry[] | null = null;
  private fileListCacheTime = 0;
  private static readonly FILE_LIST_CACHE_MS = 5000;

  constructor(
    private readonly extensionUri: vscode.Uri,
    workspaceRoot: string,
    context: vscode.ExtensionContext
  ) {
    this.context = context;
    this.workspaceRoot = workspaceRoot;
    this.agentService = new AgentService(workspaceRoot);
    this.commandApproval = new CommandApprovalManager();
    this.agentService.setCommandApproval(this.commandApproval);
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "webview", "dist"),
        vscode.Uri.joinPath(this.extensionUri, "resources"),
      ],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    this.commandApproval.setNotifyWebview((msg) => this.postMessage(msg));

    webviewView.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      undefined,
      []
    );

    this.sendInitData();
  }

  private async sendInitData(): Promise<void> {
    try {
      const modelsPath = path.join(this.extensionUri.fsPath, "models.json");
      const modelsContent = await fs.readFile(modelsPath, "utf-8");
      const models = JSON.parse(modelsContent);

      const config = vscode.workspace.getConfiguration("opico-agent");
      const currentConfig = {
        provider: config.get<string>("modelProvider") || "anthropic",
        model: config.get<string>("modelName") || "claude-3-5-sonnet-20241022",
        apiKey: config.get<string>("apiKey") || "",
        baseURL: config.get<string>("apiBaseUrl") || "",
      };

      this.postMessage({
        type: "INIT_DATA",
        payload: { models, currentConfig },
      });
    } catch (err) {
      console.error("[ChatWebviewProvider] Failed to load models.json", err);
    }
  }

  private async handleWebviewMessage(
    message: { type: string; payload?: any }
  ): Promise<void> {
    switch (message.type) {
      case "SEND_PROMPT": {
        await this.handleSendPrompt(message.payload as string);
        break;
      }
      case "UPDATE_CONFIG": {
        const config = vscode.workspace.getConfiguration("opico-agent");
        config.update("modelProvider", message.payload.provider, vscode.ConfigurationTarget.Global);
        config.update("modelName", message.payload.model, vscode.ConfigurationTarget.Global);
        config.update("apiKey", message.payload.apiKey || "", vscode.ConfigurationTarget.Global);
        config.update("apiBaseUrl", message.payload.baseURL || "", vscode.ConfigurationTarget.Global);

        this.agentService.updateConfig(message.payload);
        this.postMessage({ type: "CONFIG_UPDATED", payload: message.payload });
        break;
      }
      case "RESET_CONVERSATION": {
        this.currentConversationId = null;
        this.currentEntries = [];
        this.agentService.resetConversation();
        this.postMessage({ type: "CONVERSATION_RESET" });
        break;
      }
      case "LIST_CONVERSATIONS": {
        const summaries = this.listConversations();
        this.postMessage({ type: "CONVERSATIONS_LIST", payload: summaries });
        break;
      }
      case "LOAD_CONVERSATION": {
        this.loadConversation(message.payload.id);
        break;
      }
      case "BRANCH_CONVERSATION": {
        this.branchConversation(message.payload.entryIndex);
        break;
      }
      case "DELETE_CONVERSATION": {
        this.deleteConversation(message.payload.id);
        break;
      }
      case "SAVE_CONVERSATION": {
        this.handleSaveConversation(message.payload.entries);
        break;
      }
      case "LIST_WORKSPACE_FILES": {
        const query = (message.payload?.query as string) || "";
        const files = await this.getWorkspaceFiles(query);
        this.postMessage({ type: "WORKSPACE_FILES", payload: files });
        break;
      }
      case "OPEN_FILE": {
        await this.handleOpenFile(message.payload.path as string);
        break;
      }
      case "STOP_GENERATION": {
        this.agentService.abort();
        break;
      }
      case "ALLOW_COMMAND": {
        this.commandApproval.allow(message.payload.toolCallId as string);
        break;
      }
      case "DENY_COMMAND": {
        this.commandApproval.deny(message.payload.toolCallId as string);
        break;
      }
      case "ABORT_COMMAND": {
        this.commandApproval.abort(message.payload.toolCallId as string);
        break;
      }
      default:
        console.warn(`[ChatWebviewProvider] Unknown message type: ${message.type}`);
    }
  }

  private async handleOpenFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(this.workspaceRoot, filePath);

    try {
      const doc = await vscode.workspace.openTextDocument(absolutePath);
      await vscode.window.showTextDocument(doc);
      return;
    } catch {
      // File not found at exact path, try workspace search
    }

    if (!this.cachedFileList) {
      this.cachedFileList = await this.scanDirectory(this.workspaceRoot, "");
      this.fileListCacheTime = Date.now();
    }

    const fileName = path.basename(filePath);
    const lowerName = fileName.toLowerCase();
    const matches = this.cachedFileList
      .filter((entry) => entry.type === "file" && entry.path.toLowerCase().endsWith(lowerName))
      .sort((a, b) => a.path.length - b.path.length);

    if (matches.length > 0) {
      const bestMatch = path.resolve(this.workspaceRoot, matches[0].path);
      try {
        const doc = await vscode.workspace.openTextDocument(bestMatch);
        await vscode.window.showTextDocument(doc);
        return;
      } catch {
        // Fall through to warning
      }
    }

    vscode.window.showWarningMessage(`Opico: File not found: ${filePath}`);
  }

  private async handleSendPrompt(prompt: string): Promise<void> {
    this.postMessage({ type: "STREAM_START" });

    await this.agentService.sendMessage(prompt, {
      onEvent: (event) => {
        this.postMessage({ type: "AGENT_EVENT", payload: event });
      },
      onError: (error) => {
        this.postMessage({ type: "STREAM_ERROR", payload: error });
      },
    });
  }

  private postMessage(message: { type: string; payload?: any }): void {
    this.webviewView?.webview.postMessage(message);
  }

  private getStoredConversations(): StoredConversation[] {
    return this.context.globalState.get<StoredConversation[]>(STORAGE_KEY, []);
  }

  private async setStoredConversations(conversations: StoredConversation[]): Promise<void> {
    await this.context.globalState.update(STORAGE_KEY, conversations);
  }

  private trimIncompleteTurns(messages: any[]): any[] {
    if (messages.length === 0) return messages;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && Array.isArray(last.content)) {
      const hasToolCall = last.content.some((c: any) => c.type === "tool-call");
      const hasResult = last.content.some((c: any) => c.type === "tool-result");
      if (hasToolCall && !hasResult) {
        return messages.slice(0, -1);
      }
    }
    return messages;
  }

  private listConversations(): ConversationSummary[] {
    const conversations = this.getStoredConversations();
    return conversations
      .map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messageCount: c.entries.length,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private loadConversation(id: string): void {
    const conversations = this.getStoredConversations();
    const conversation = conversations.find((c) => c.id === id);
    if (!conversation) {
      console.warn(`[ChatWebviewProvider] Conversation ${id} not found`);
      return;
    }

    const trimmedMessages = this.trimIncompleteTurns(conversation.modelMessages);

    this.currentConversationId = conversation.id;
    this.currentEntries = conversation.entries;
    this.agentService.setConversationHistory(trimmedMessages);

    this.postMessage({
      type: "CONVERSATION_LOADED",
      payload: {
        id: conversation.id,
        entries: conversation.entries,
      },
    });
  }

  private async branchConversation(entryIndex: number): Promise<void> {
    const sourceEntries = this.currentEntries;
    const sourceModelMessages = this.agentService.getConversationHistory();

    const userMessage = sourceEntries[entryIndex];
    const branchPrompt = (userMessage as any)?.content ?? "";

    const branchedEntries = sourceEntries.slice(0, entryIndex);

    const newId = `conv-${Date.now()}`;
    const title = this.deriveTitle(branchedEntries);

    const newConversation: StoredConversation = {
      id: newId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      entries: branchedEntries,
      modelMessages: [],
      parentConversationId: this.currentConversationId || undefined,
      branchPointIndex: entryIndex,
    };

    const conversations = this.getStoredConversations();
    conversations.push(newConversation);
    await this.setStoredConversations(conversations);

    this.currentConversationId = newId;
    this.currentEntries = branchedEntries;
    this.agentService.resetConversation();

    this.postMessage({
      type: "CONVERSATION_BRANCHED",
      payload: {
        id: newId,
        entries: branchedEntries,
        branchPrompt,
      },
    });
  }

  private async deleteConversation(id: string): Promise<void> {
    let conversations = this.getStoredConversations();
    conversations = conversations.filter((c) => c.id !== id);
    await this.setStoredConversations(conversations);

    if (this.currentConversationId === id) {
      this.currentConversationId = null;
      this.currentEntries = [];
      this.agentService.resetConversation();
      this.postMessage({ type: "CONVERSATION_RESET" });
    }

    const summaries = this.listConversations();
    this.postMessage({ type: "CONVERSATIONS_LIST", payload: summaries });
  }

  private async handleSaveConversation(entries: any[]): Promise<void> {
    if (!this.currentConversationId) {
      this.currentConversationId = `conv-${Date.now()}`;
    }

    this.currentEntries = entries;
    let modelMessages = this.agentService.getConversationHistory();
    modelMessages = this.trimIncompleteTurns(modelMessages);
    const conversations = this.getStoredConversations();
    const existing = conversations.find((c) => c.id === this.currentConversationId);

    const title = this.deriveTitle(entries);

    if (existing) {
      existing.entries = entries;
      existing.modelMessages = modelMessages;
      existing.updatedAt = Date.now();
      existing.title = title;
    } else {
      conversations.push({
        id: this.currentConversationId,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        entries,
        modelMessages,
      });
    }

    await this.setStoredConversations(conversations);
  }

  private async getWorkspaceFiles(query: string): Promise<WorkspaceFileEntry[]> {
    const now = Date.now();
    if (!this.cachedFileList || now - this.fileListCacheTime > ChatWebviewProvider.FILE_LIST_CACHE_MS) {
      this.cachedFileList = await this.scanDirectory(this.workspaceRoot, "");
      this.fileListCacheTime = now;
    }

    if (!query) return this.cachedFileList.slice(0, 100);

    const lowerQuery = query.toLowerCase();
    const scored = this.cachedFileList
      .map((entry) => {
        const lowerPath = entry.path.toLowerCase();
        const idx = lowerPath.indexOf(lowerQuery);
        let score = 0;
        if (idx === -1) return { entry, score: -1 };
        score = 1000 - idx;
        const lastSlash = lowerPath.lastIndexOf("/");
        const fileName = lastSlash >= 0 ? lowerPath.slice(lastSlash + 1) : lowerPath;
        if (fileName.startsWith(lowerQuery)) score += 500;
        if (fileName === lowerQuery) score += 500;
        if (entry.type === "folder") score += 50;
        return { entry, score };
      })
      .filter((s) => s.score >= 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 100).map((s) => s.entry);
  }

  private async scanDirectory(dirPath: string, relativeTo: string): Promise<WorkspaceFileEntry[]> {
    const results: WorkspaceFileEntry[] = [];
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith(".") && name !== ".github") continue;

      const fullPath = path.join(dirPath, name);
      const relPath = relativeTo ? `${relativeTo}/${name}` : name;

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        results.push({ path: relPath, type: "folder" });
        if (relativeTo.split("/").length < 5) {
          const subFiles = await this.scanDirectory(fullPath, relPath);
          results.push(...subFiles);
        }
      } else if (entry.isFile()) {
        results.push({ path: relPath, type: "file" });
      }
    }

    return results;
  }

  private deriveTitle(entries: any[]): string {
    const firstUserMsg = entries.find((e) => e.role === "user");
    if (firstUserMsg) {
      const content = typeof firstUserMsg.content === "string"
        ? firstUserMsg.content
        : String(firstUserMsg.content);
      return content.slice(0, 60) + (content.length > 60 ? "..." : "");
    }
    return "New Conversation";
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this.extensionUri, "webview", "dist");

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, "assets", "index.css")
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="
        default-src 'none';
        style-src ${webview.cspSource} 'unsafe-inline';
        script-src 'nonce-${nonce}';
        font-src ${webview.cspSource};
        img-src ${webview.cspSource} https:;
        media-src *;
      "
    />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Opico Agent</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
