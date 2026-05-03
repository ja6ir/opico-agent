import * as cp from "child_process";

interface ApprovalEntry {
  resolve: (approved: boolean) => void;
}

export class CommandApprovalManager {
  private pendingApprovals = new Map<string, ApprovalEntry>();
  private runningProcesses = new Map<string, cp.ChildProcess>();
  private notifyWebview: ((msg: { type: string; payload?: any }) => void) | null = null;

  setNotifyWebview(fn: (msg: { type: string; payload?: any }) => void): void {
    this.notifyWebview = fn;
  }

  async requestApproval(toolCallId: string, command: string): Promise<boolean> {
    if (this.notifyWebview) {
      this.notifyWebview({ type: "COMMAND_PENDING", payload: { toolCallId, command } });
    }
    return new Promise<boolean>((resolve) => {
      this.pendingApprovals.set(toolCallId, { resolve });
    });
  }

  allow(toolCallId: string): void {
    const entry = this.pendingApprovals.get(toolCallId);
    if (entry) {
      entry.resolve(true);
      this.pendingApprovals.delete(toolCallId);
    }
  }

  deny(toolCallId: string): void {
    const entry = this.pendingApprovals.get(toolCallId);
    if (entry) {
      entry.resolve(false);
      this.pendingApprovals.delete(toolCallId);
    }
  }

  registerProcess(toolCallId: string, proc: cp.ChildProcess): void {
    this.runningProcesses.set(toolCallId, proc);
    if (this.notifyWebview) {
      this.notifyWebview({ type: "COMMAND_EXECUTING", payload: { toolCallId } });
    }
  }

  unregisterProcess(toolCallId: string): void {
    this.runningProcesses.delete(toolCallId);
  }

  abort(toolCallId: string): void {
    const proc = this.runningProcesses.get(toolCallId);
    if (proc && !proc.killed) {
      proc.kill();
      this.runningProcesses.delete(toolCallId);
    }
    const entry = this.pendingApprovals.get(toolCallId);
    if (entry) {
      entry.resolve(false);
      this.pendingApprovals.delete(toolCallId);
    }
  }

  abortAll(): void {
    for (const [id] of this.runningProcesses) {
      this.abort(id);
    }
    for (const [id] of this.pendingApprovals) {
      this.deny(id);
    }
  }
}
