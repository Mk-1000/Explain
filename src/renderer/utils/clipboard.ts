/**
 * Clipboard helpers (quick-start-guide: renderer/utils/clipboard.ts).
 * Wraps electronAPI for clipboard and paste-in-place.
 */

export async function writeClipboard(text: string): Promise<void> {
  await window.electronAPI.writeClipboard(text);
}

export async function readClipboard(): Promise<string> {
  return window.electronAPI.readClipboard();
}

/**
 * Write text to clipboard and simulate Paste (Ctrl/Cmd+V) so the selection is replaced.
 * Call from main process via IPC; this invokes it.
 */
export async function writeAndPaste(text: string): Promise<void> {
  await window.electronAPI.writeAndPaste(text);
}
