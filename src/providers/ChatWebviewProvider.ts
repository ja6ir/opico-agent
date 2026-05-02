import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { AgentService } from "../llm/AgentService";

/**
 * ChatWebviewProvider manages the lifecycle of the sidebar Webview panel.
 *
 * Responsibilities:
 * 1. Serve the React UI (built by Vite) as the Webview HTML content.
 * 2. Bridge the isolated Webview <-> Extension Host communication via postMessage.
 * 3. Route incoming messages from the Webview to the AgentService.
 * 4. Forward streaming chunks and tool results from the AgentService back to the Webview.
 */
export class ChatWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "opico-agent.chatView";

  private webviewView?: vscode.WebviewView;
  private agentService: AgentService;

  constructor(
    private readonly extensionUri: vscode.Uri,
    workspaceRoot: string
  ) {
    this.agentService = new AgentService(workspaceRoot);
  }

  /**
   * Called by VS Code when the webview view is first made visible.
   */
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

    // Load the React app HTML
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from the React Webview
    webviewView.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      undefined,
      []
    );

    // Load initial data and send it to the webview
    this.sendInitData();
  }

  /**
   * Load models.json and current config, and send to the Webview.
   */
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

  /**
   * Route messages received from the Webview to the appropriate handler.
   */
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
        this.agentService.resetConversation();
        this.postMessage({ type: "CONVERSATION_RESET" });
        break;
      }
      default:
        console.warn(`[ChatWebviewProvider] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle a user prompt: forward to AgentService and stream results back.
   */
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

  /**
   * Send a message from the Extension Host to the Webview.
   */
  private postMessage(message: { type: string; payload?: any }): void {
    this.webviewView?.webview.postMessage(message);
  }

  /**
   * Generate the HTML content that loads the Vite-built React application.
   *
   * In production, we point to the built assets in webview/dist.
   * The Content Security Policy is configured to allow only local resources.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this.extensionUri, "webview", "dist");

    // Convert local file URIs to webview-safe URIs
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, "assets", "index.css")
    );

    // Use a nonce for Content Security Policy
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

/**
 * Generate a random nonce string for CSP.
 */
function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
