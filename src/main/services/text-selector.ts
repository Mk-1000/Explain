import ShortcutManager from './shortcut-manager';
import type { TextCaptureResult } from '../../shared/types';

export async function getSelectedText(): Promise<TextCaptureResult> {
  return ShortcutManager.getSelectedText();
}

export function getCursorPosition(): { x: number; y: number } {
  return ShortcutManager.getCursorPosition();
}
