import ShortcutManager from './shortcut-manager';

export function getSelectedText(): string {
  return ShortcutManager.getSelectedText();
}

export function getCursorPosition(): { x: number; y: number } {
  return ShortcutManager.getCursorPosition();
}
