import { clipboard } from 'electron';

function getSelectedTextSync(): string {
  try {
    const robot = require('robotjs');
    const originalClipboard = clipboard.readText();
    const modifier = process.platform === 'darwin' ? 'command' : 'control';
    robot.keyTap('c', [modifier]);
    const startTime = Date.now();
    while (Date.now() - startTime < 80) {
      // brief wait for clipboard
    }
    const selectedText = clipboard.readText();
    setTimeout(() => {
      clipboard.writeText(originalClipboard);
    }, 100);
    return selectedText !== originalClipboard ? selectedText : '';
  } catch {
    return '';
  }
}

function getCursorPosition(): { x: number; y: number } {
  try {
    const robot = require('robotjs');
    const pos = robot.getMousePos();
    return { x: pos.x, y: pos.y };
  } catch {
    return { x: 0, y: 0 };
  }
}

class ShortcutManagerClass {
  getSelectedText(): string {
    return getSelectedTextSync();
  }

  getCursorPosition(): { x: number; y: number } {
    return getCursorPosition();
  }
}

const ShortcutManager = new ShortcutManagerClass();
export default ShortcutManager;
