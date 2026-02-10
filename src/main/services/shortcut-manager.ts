import { clipboard, screen } from 'electron';
import { execSync } from 'child_process';
import type { TextCaptureResult, PlatformCapabilities } from '../../shared/types';

// Platform detection constants
const IS_MAC = process.platform === 'darwin';
const IS_WINDOWS = process.platform === 'win32';
const IS_LINUX = process.platform === 'linux';

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 5,
  initialDelayMs: 50,
  maxDelayMs: 300,
  backoffMultiplier: 1.5,
  clipboardCheckIntervalMs: 20,
};

// Platform capabilities cache
let platformCapabilities: {
  hasRobotJS: boolean;
  hasXdotool: boolean;
  hasXclip: boolean;
  hasWtype: boolean;
} | null = null;

/**
 * Clear platform capabilities cache (useful for testing or when tools are installed)
 */
function clearPlatformCapabilitiesCache(): void {
  platformCapabilities = null;
}

/**
 * Sleep utility with promise
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
    RETRY_CONFIG.maxDelayMs
  );
  return Math.floor(delay);
}

/**
 * Detect available platform tools
 */
function detectPlatformCapabilities(): typeof platformCapabilities {
  if (platformCapabilities) return platformCapabilities;

  const capabilities = {
    hasRobotJS: false,
    hasXdotool: false,
    hasXclip: false,
    hasWtype: false,
  };

  // Check Linux tools FIRST (before RobotJS) since they're more reliable
  if (IS_LINUX) {
    try {
      execSync('which xdotool', { stdio: 'ignore', timeout: 500 });
      capabilities.hasXdotool = true;
      console.log('[ShortcutManager] ✅ xdotool detected - will be used for text capture');
    } catch {
      console.log('[ShortcutManager] ⚠️ xdotool not found - install with: sudo apt install xdotool');
    }

    try {
      execSync('which xclip', { stdio: 'ignore', timeout: 500 });
      capabilities.hasXclip = true;
    } catch {
      // xclip not found
    }

    try {
      execSync('which wtype', { stdio: 'ignore', timeout: 500 });
      capabilities.hasWtype = true;
      console.log('[ShortcutManager] ✅ wtype detected (Wayland) - will be used for text capture');
    } catch {
      // wtype not found (Wayland)
    }
  }

  // Try RobotJS LAST (optional dependency, less reliable on Linux)
  try {
    require('robotjs');
    capabilities.hasRobotJS = true;
    if (IS_LINUX) {
      console.log('[ShortcutManager] ⚠️ RobotJS detected but will only be used as fallback on Linux');
    }
  } catch {
    // RobotJS not available - that's okay, we have fallbacks
  }

  platformCapabilities = capabilities;
  return capabilities;
}

/**
 * Wait for clipboard change with timeout (simplified - now using direct checks)
 * This function is kept for potential future use but not currently used
 */
async function waitForClipboardChange(
  originalContent: string,
  timeoutMs: number
): Promise<{ changed: boolean; newContent: string }> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    await sleep(RETRY_CONFIG.clipboardCheckIntervalMs);
    
    const currentContent = clipboard.readText();
    if (currentContent !== originalContent) {
      return { changed: true, newContent: currentContent };
    }
  }
  
  return { changed: false, newContent: originalContent };
}

/**
 * Simulate copy using RobotJS
 * On Linux, RobotJS often requires the target window to be focused
 */
function simulateCopyWithRobotJS(): boolean {
  try {
    const robot = require('robotjs');
    const modifier = IS_MAC ? 'command' : 'control';
    
    // On Linux, RobotJS may need a small delay and the window to be active
    // Try to ensure we're sending to the right window
    if (IS_LINUX) {
      // Small delay to ensure key events are processed
      // RobotJS on Linux can be finicky
      robot.setKeyboardDelay(10);
    }
    
    robot.keyTap('c', [modifier]);
    return true;
  } catch (error) {
    console.error('[ShortcutManager] RobotJS copy error:', error);
    return false;
  }
}

/**
 * Simulate copy using xdotool (Linux X11)
 * More reliable than RobotJS on Linux
 */
function simulateCopyWithXdotool(): boolean {
  try {
    // Use xdotool to send Ctrl+C to the active window
    // --clearmodifiers ensures no modifier keys interfere
    // --window %1 sends to the active window explicitly
    execSync('xdotool key --clearmodifiers --window $(xdotool getactivewindow) ctrl+c', {
      timeout: 1000,
      stdio: 'ignore',
    });
    return true;
  } catch (error) {
    // Fallback: try without explicit window (sends to active window by default)
    try {
      execSync('xdotool key --clearmodifiers ctrl+c', {
        timeout: 1000,
        stdio: 'ignore',
      });
      return true;
    } catch (fallbackError) {
      console.error('[ShortcutManager] xdotool copy error:', fallbackError);
      return false;
    }
  }
}

/**
 * Simulate copy using wtype (Linux Wayland)
 */
function simulateCopyWithWtype(): boolean {
  try {
    execSync('wtype -M ctrl -P c -m ctrl -p c', {
      timeout: 1000,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Simulate copy using osascript (macOS)
 */
function simulateCopyWithOsascript(): boolean {
  try {
    execSync('osascript -e \'tell application "System Events" to keystroke "c" using command down\'', {
      timeout: 1000,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Simulate copy using PowerShell (Windows)
 */
function simulateCopyWithPowerShell(): boolean {
  try {
    execSync('powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^c\')"', {
      timeout: 1000,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempt to simulate copy using best available method
 * On Linux, prioritize xdotool/wtype over RobotJS for better reliability
 */
function simulateCopy(): { success: boolean; method: string | null } {
  const caps = detectPlatformCapabilities();
  if (!caps) {
    // Fallback to platform-specific commands if detection failed
    if (IS_MAC) {
      if (simulateCopyWithOsascript()) {
        return { success: true, method: 'osascript' };
      }
    } else if (IS_WINDOWS) {
      if (simulateCopyWithPowerShell()) {
        return { success: true, method: 'powershell' };
      }
    }
    return { success: false, method: null };
  }

  // Platform-specific priority order
  if (IS_LINUX) {
    // On Linux, prefer xdotool/wtype over RobotJS (more reliable)
    // Try xdotool for X11 first
    if (caps.hasXdotool) {
      if (simulateCopyWithXdotool()) {
        return { success: true, method: 'xdotool' };
      }
    }

    // Try wtype for Wayland
    if (caps.hasWtype) {
      if (simulateCopyWithWtype()) {
        return { success: true, method: 'wtype' };
      }
    }

    // RobotJS as fallback on Linux (less reliable)
    if (caps.hasRobotJS) {
      if (simulateCopyWithRobotJS()) {
        return { success: true, method: 'robotjs' };
      }
    }
  } else if (IS_MAC) {
    // macOS: Try RobotJS first, then osascript
    if (caps.hasRobotJS) {
      if (simulateCopyWithRobotJS()) {
        return { success: true, method: 'robotjs' };
      }
    }
    // macOS fallback
    if (simulateCopyWithOsascript()) {
      return { success: true, method: 'osascript' };
    }
  } else if (IS_WINDOWS) {
    // Windows: Try RobotJS first, then PowerShell
    if (caps.hasRobotJS) {
      if (simulateCopyWithRobotJS()) {
        return { success: true, method: 'robotjs' };
      }
    }
    // Windows fallback
    if (simulateCopyWithPowerShell()) {
      return { success: true, method: 'powershell' };
    }
  }

  return { success: false, method: null };
}

/**
 * Get selected text with enhanced retry logic and metadata
 */
async function getSelectedTextWithRetry(): Promise<TextCaptureResult> {
  const startTime = Date.now();
  const caps = detectPlatformCapabilities();
  const platformToolAvailable = caps ? (caps.hasRobotJS || caps.hasXdotool || caps.hasWtype) : (IS_MAC || IS_WINDOWS);

  // Store original clipboard
  const originalClipboard = clipboard.readText();
  let copySimulated = false;
  let captureMethod: string | null = null;
  let finalText = '';
  let capturedFrom: 'selection' | 'clipboard' | 'fallback' | 'none' = 'none';
  let attemptCount = 0;
  let lastError: string | undefined;

  // First, try to simulate copy and capture selected text
  const copyResult = simulateCopy();
  
  if (copyResult.success) {
    copySimulated = true;
    captureMethod = copyResult.method;
    console.log(`[ShortcutManager] Copy simulated using: ${copyResult.method}`);
    
    // Wait longer for clipboard to update (Linux apps can be slower, especially with RobotJS)
    // RobotJS on Linux may need more time to process
    const initialWait = IS_LINUX && copyResult.method === 'robotjs' ? 250 : 150;
    await sleep(initialWait);
    
    // Try multiple times to detect clipboard change
    for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
      attemptCount = attempt + 1;
      
      // Check if clipboard changed
      const currentClipboard = clipboard.readText();
      
      if (currentClipboard !== originalClipboard && currentClipboard.trim()) {
        // Clipboard changed - we captured selected text!
        finalText = currentClipboard.trim();
        capturedFrom = 'selection';
        console.log(`[ShortcutManager] ✅ Captured selected text (${finalText.length} chars) after ${attemptCount} attempts`);
        
        // Restore original clipboard after a delay
        setTimeout(() => {
          try {
            clipboard.writeText(originalClipboard);
            console.log('[ShortcutManager] Clipboard restored');
          } catch (error) {
            console.error('[ShortcutManager] Failed to restore clipboard:', error);
          }
        }, 200);

        break;
      }
      
      // Wait before next check with exponential backoff
      if (attempt < RETRY_CONFIG.maxAttempts - 1) {
        const delay = getBackoffDelay(attempt);
        await sleep(delay);
      }
    }
    
    // If clipboard didn't change after copy simulation
    if (!finalText) {
      console.log(`[ShortcutManager] ⚠️ Copy simulated (${copyResult.method}) but clipboard did not change`);
      console.log(`[ShortcutManager] Original clipboard: "${originalClipboard.substring(0, 50)}..."`);
      console.log(`[ShortcutManager] Current clipboard: "${clipboard.readText().substring(0, 50)}..."`);
      
      // If copy was simulated but clipboard didn't change, the method might not be working
      // This is common with RobotJS on Linux - it sends the keypress but doesn't actually copy
      // The fallback to clipboard will handle this case
    }
  } else {
    // Copy simulation not available
    lastError = 'Copy simulation not available';
    attemptCount = 0;
    console.log('[ShortcutManager] Copy simulation not available, using clipboard fallback');
  }

  // If selection capture failed or wasn't attempted, use clipboard as fallback
  if (!finalText) {
    const clipboardText = clipboard.readText();
    if (clipboardText && clipboardText.trim()) {
      finalText = clipboardText.trim();
      capturedFrom = copySimulated ? 'fallback' : 'clipboard';
      console.log(`[ShortcutManager] Using clipboard text (${finalText.length} chars) as ${capturedFrom}`);
    } else {
      // No text found anywhere
      capturedFrom = 'none';
      console.log('[ShortcutManager] No text found in selection or clipboard');
    }
  }

  const totalDuration = Date.now() - startTime;

  return {
    text: finalText,
    capturedFrom,
    copySimulated,
    captureMethod: captureMethod as TextCaptureResult['captureMethod'],
    attemptCount,
    totalDuration,
    platformToolAvailable,
    error: lastError,
  };
}

/**
 * Get cursor position using best available method
 */
function getCursorPosition(): { x: number; y: number } {
  const caps = detectPlatformCapabilities();

  // Try RobotJS first
  if (caps?.hasRobotJS) {
    try {
      const robot = require('robotjs');
      const pos = robot.getMousePos();
      return { x: pos.x, y: pos.y };
    } catch (error) {
      console.error('[ShortcutManager] RobotJS getMousePos failed:', error);
    }
  }

  // Linux fallback: use xdotool
  if (IS_LINUX && caps?.hasXdotool) {
    try {
      const output = execSync('xdotool getmouselocation --shell', {
        encoding: 'utf-8',
        timeout: 500,
      });
      
      const xMatch = output.match(/X=(\d+)/);
      const yMatch = output.match(/Y=(\d+)/);
      
      if (xMatch && yMatch) {
        return {
          x: parseInt(xMatch[1], 10),
          y: parseInt(yMatch[1], 10),
        };
      }
    } catch (error) {
      // xdotool failed, continue to fallback
    }
  }

  // Fallback: use Electron screen API
  try {
    const point = screen.getCursorScreenPoint();
    if (point && typeof point.x === 'number' && typeof point.y === 'number') {
      return { x: point.x, y: point.y };
    }
  } catch (error) {
    console.warn('[ShortcutManager] Screen getCursorScreenPoint failed:', error);
  }

  // Final fallback: use screen center
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    return {
      x: Math.floor(width / 2),
      y: Math.floor(height / 2),
    };
  } catch {
    return { x: 0, y: 0 };
  }
}

/**
 * Get platform-specific installation instructions
 */
function getInstallationInstructions(): string | null {
  if (!IS_LINUX) return null;

  const caps = detectPlatformCapabilities();
  if (!caps) return null;
  
  if (!caps.hasXdotool && !caps.hasWtype) {
    // Detect if running Wayland or X11
    const sessionType = process.env.XDG_SESSION_TYPE || 'x11';
    
    if (sessionType === 'wayland') {
      return 'Install wtype for Wayland support: sudo apt install wtype (Debian/Ubuntu) or sudo pacman -S wtype (Arch)';
    } else {
      return 'Install xdotool for X11 support: sudo apt install xdotool (Debian/Ubuntu) or sudo pacman -S xdotool (Arch)';
    }
  }

  return null;
}

/**
 * Get platform capabilities
 */
function getPlatformCapabilities(): PlatformCapabilities {
  const caps = detectPlatformCapabilities();
  const defaultCaps = {
    hasRobotJS: false,
    hasXdotool: false,
    hasWtype: false,
    hasXclip: false,
  };
  const effectiveCaps = caps || defaultCaps;
  
  const hasNativeSelection = IS_MAC || IS_WINDOWS || effectiveCaps.hasXdotool || effectiveCaps.hasWtype;
  
  let recommendedMethod: 'robotjs' | 'clipboard-only' | 'system-command';
  if (effectiveCaps.hasRobotJS) {
    recommendedMethod = 'robotjs';
  } else if (hasNativeSelection) {
    recommendedMethod = 'system-command';
  } else {
    recommendedMethod = 'clipboard-only';
  }

  return {
    hasRobotJS: effectiveCaps.hasRobotJS,
    hasNativeSelection,
    platform: process.platform,
    recommendedMethod,
    hasXdotool: effectiveCaps.hasXdotool,
    hasWtype: effectiveCaps.hasWtype,
    hasXclip: effectiveCaps.hasXclip,
  };
}

// Export class
class ShortcutManagerClass {
  async getSelectedText(): Promise<TextCaptureResult> {
    return getSelectedTextWithRetry();
  }

  getCursorPosition(): { x: number; y: number } {
    return getCursorPosition();
  }

  getPlatformCapabilities(): PlatformCapabilities {
    return getPlatformCapabilities();
  }

  getInstallationInstructions(): string | null {
    return getInstallationInstructions();
  }

  clearCache(): void {
    clearPlatformCapabilitiesCache();
  }
}

const ShortcutManager = new ShortcutManagerClass();
export default ShortcutManager;
