import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { existsSync } from 'fs';
import type { ChatConfig } from '../../shared/types';
import { DEFAULT_CHAT_CONFIG } from '../../shared/constants';
import ConfigManager from '../services/config-manager';

export class PopupChatWindowManager {
  private windows: Map<number, BrowserWindow> = new Map();
  private activeConfig: ChatConfig;

  constructor() {
    // Load config from persistent storage
    this.activeConfig = ConfigManager.getChatConfig();
  }

  /**
   * Create a new popup chat window at the specified position
   */
  create(x: number, y: number, initialText?: string): BrowserWindow {
    console.log(`[ChatWindow] Creating chat window at (${x}, ${y})`);
    console.log(`[ChatWindow] Initial text: ${initialText ? `${initialText.length} chars` : 'none'}`);
    
    const display = screen.getDisplayNearestPoint({ x, y });
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.workArea;

    // Chat window dimensions
    const windowWidth = 450;
    const windowHeight = 600;
    const padding = 20;

    // Smart positioning algorithm
    let windowX = x - windowWidth / 2; // Center on cursor horizontally
    let windowY = y + 20; // Below cursor

    // Ensure window is fully visible horizontally
    if (windowX < screenX + padding) {
      windowX = screenX + padding;
    } else if (windowX + windowWidth > screenX + screenWidth - padding) {
      windowX = screenX + screenWidth - windowWidth - padding;
    }

    // Ensure window is fully visible vertically
    if (windowY < screenY + padding) {
      windowY = screenY + padding;
    } else if (windowY + windowHeight > screenY + screenHeight - padding) {
      // Position above cursor if no room below
      windowY = y - windowHeight - 20;
      
      // If still off-screen, center vertically
      if (windowY < screenY + padding) {
        windowY = screenY + (screenHeight - windowHeight) / 2;
      }
    }

    console.log(`[ChatWindow] Final position: (${Math.floor(windowX)}, ${Math.floor(windowY)})`);
    console.log(`[ChatWindow] Screen bounds: (${screenX}, ${screenY}) to (${screenX + screenWidth}, ${screenY + screenHeight})`);

    const window = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: Math.floor(windowX),
      y: Math.floor(windowY),
      frame: false,
      transparent: true,
      resizable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: true,
      show: false,
      focusable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/index.js'),
        devTools: process.env.NODE_ENV === 'development',
      },
    });

    // Load the chat UI with enhanced error handling
    this.loadChatUI(window);

    // Store window reference
    this.windows.set(window.id, window);
    console.log(`[ChatWindow] Window ID ${window.id} created, total active: ${this.windows.size}`);

    // Show window when ready with platform-specific focus handling
    window.once('ready-to-show', () => {
      console.log('[ChatWindow] Window ready, showing and focusing');
      window.show();
      window.focus();
      
      // Platform-specific focus enforcement
      if (process.platform === 'linux') {
        // On Linux, sometimes need extra steps to get focus
        window.moveTop();
        window.setAlwaysOnTop(true);
        
        // Reset alwaysOnTop after a brief delay
        setTimeout(() => {
          if (!window.isDestroyed()) {
            window.setAlwaysOnTop(false);
            window.setAlwaysOnTop(true); // Keep it on top for chat
          }
        }, 100);
      } else if (process.platform === 'darwin') {
        // macOS: app.focus() can help
        const { app } = require('electron');
        app.focus({ steal: true });
      }
    });

    // Send initial data when DOM is ready (more reliable than did-finish-load)
    window.webContents.once('dom-ready', () => {
      console.log('[ChatWindow] DOM ready, sending initialization data');
      
      const initData = {
        config: this.activeConfig,
        initialText: initialText || '',
        timestamp: Date.now(),
        windowId: window.id,
      };
      
      console.log('[ChatWindow] Init data:', {
        configKeys: Object.keys(initData.config),
        textLength: initData.initialText.length,
        windowId: initData.windowId,
      });
      
      this.send(window, 'chat-initialized', initData);
    });

    // Also send on did-finish-load as backup
    window.webContents.once('did-finish-load', () => {
      console.log('[ChatWindow] Content loaded (did-finish-load)');
      
      // Send again in case dom-ready fired too early
      setTimeout(() => {
        if (!window.isDestroyed()) {
          this.send(window, 'chat-initialized', {
            config: this.activeConfig,
            initialText: initialText || '',
            timestamp: Date.now(),
            windowId: window.id,
          });
        }
      }, 100);
    });

    // Enhanced logging for debugging
    window.webContents.on('did-start-loading', () => {
      console.log('[ChatWindow] Started loading:', window.webContents.getURL());
    });

    window.webContents.on('did-stop-loading', () => {
      console.log('[ChatWindow] Stopped loading');
    });

    window.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error(`[ChatWindow] Failed to load:`, {
        errorCode,
        errorDescription,
        url: validatedURL,
        isMainFrame,
      });
    });

    // Log renderer console messages in development
    if (process.env.NODE_ENV === 'development') {
      window.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const levelStr = ['verbose', 'info', 'warning', 'error'][level] || 'log';
        console.log(`[ChatWindow Renderer ${levelStr}]: ${message} (${sourceId}:${line})`);
      });
    }

    // Cleanup on close
    window.on('closed', () => {
      this.windows.delete(window.id);
      console.log(`[ChatWindow] Window ${window.id} closed, remaining: ${this.windows.size}`);
    });

    // Optional: Don't auto-close on blur for better UX
    // Users can close manually with Escape or close button
    // window.on('blur', () => {
    //   setTimeout(() => {
    //     if (!window.isDestroyed() && !window.isFocused()) {
    //       window.close();
    //     }
    //   }, 500);
    // });

    return window;
  }

  /**
   * Load chat UI with multiple fallback paths
   */
  private loadChatUI(window: BrowserWindow): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ChatWindow] Loading from dev server');
      window.loadURL('http://localhost:5173/chat.html')
        .then(() => {
          console.log('[ChatWindow] Dev URL loaded successfully');
          // Open dev tools in development
          window.webContents.openDevTools();
        })
        .catch((err) => {
          console.error('[ChatWindow] Failed to load dev URL:', err);
        });
    } else {
      // Try multiple production paths
      const chatPaths = [
        path.join(process.resourcesPath, 'app.asar', 'dist', 'renderer', 'chat.html'),
        path.join(process.resourcesPath, 'dist', 'renderer', 'chat.html'),
        path.join(__dirname, '../../renderer/chat.html'),
        path.join(__dirname, '../renderer/chat.html'),
      ];
      
      console.log('[ChatWindow] Trying production paths:', chatPaths);
      
      let loaded = false;
      for (const chatPath of chatPaths) {
        try {
          if (existsSync(chatPath)) {
            console.log(`[ChatWindow] Found chat.html at: ${chatPath}`);
            window.loadFile(chatPath);
            loaded = true;
            break;
          } else {
            console.log(`[ChatWindow] Path does not exist: ${chatPath}`);
          }
        } catch (err) {
          console.warn(`[ChatWindow] Error checking path ${chatPath}:`, err);
        }
      }
      
      if (!loaded) {
        console.error('[ChatWindow] Failed to load chat.html from any path');
        
        // Show error dialog to user
        const { dialog } = require('electron');
        dialog.showErrorBox(
          'Chat UI Error',
          'Failed to load chat interface. Please reinstall the application.'
        );
      }
    }
  }

  /**
   * Update the AI configuration for all chat windows
   */
  updateConfig(config: Partial<ChatConfig>): void {
    console.log('[ChatWindow] Updating config:', config);
    this.activeConfig = { ...this.activeConfig, ...config };
    // Persist to storage
    ConfigManager.setChatConfig(this.activeConfig);
    this.broadcastToAll('chat-config-updated', this.activeConfig);
  }

  /**
   * Get the current chat configuration
   */
  getConfig(): ChatConfig {
    return { ...this.activeConfig };
  }

  /**
   * Send a message to a specific window
   */
  send(window: BrowserWindow, channel: string, data: unknown): void {
    if (!window.isDestroyed()) {
      try {
        window.webContents.send(channel, data);
        console.log(`[ChatWindow] Sent ${channel} to window ${window.id}`);
      } catch (err) {
        console.error(`[ChatWindow] Error sending ${channel}:`, err);
      }
    } else {
      console.warn(`[ChatWindow] Attempted to send to destroyed window`);
    }
  }

  /**
   * Broadcast a message to all active chat windows
   */
  broadcastToAll(channel: string, data: unknown): void {
    console.log(`[ChatWindow] Broadcasting ${channel} to ${this.windows.size} windows`);
    this.windows.forEach((window) => {
      this.send(window, channel, data);
    });
  }

  /**
   * Close all active chat windows
   */
  closeAll(): void {
    console.log(`[ChatWindow] Closing all ${this.windows.size} windows`);
    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.windows.clear();
  }

  /**
   * Get the number of active chat windows
   */
  getActiveWindowCount(): number {
    return this.windows.size;
  }

  /**
   * Build system prompt based on current configuration
   */
  buildSystemPrompt(): string {
    const { responseStyle, tone, creativity } = this.activeConfig;

    let prompt = 'You are a helpful AI assistant. ';

    // Response style
    switch (responseStyle) {
      case 'concise':
        prompt += 'Provide brief, to-the-point responses. Be succinct and focus only on essential information. ';
        break;
      case 'detailed':
        prompt += 'Provide comprehensive, detailed explanations. Include relevant context, examples, and thorough analysis. ';
        break;
      case 'balanced':
      default:
        prompt += 'Provide clear, balanced responses with appropriate detail. ';
        break;
    }

    // Tone
    switch (tone) {
      case 'professional':
        prompt += 'Maintain a professional, formal tone suitable for business communication. ';
        break;
      case 'casual':
        prompt += 'Use a casual, conversational tone as if talking to a friend. ';
        break;
      case 'technical':
        prompt += 'Use precise, technical language with domain-specific terminology when appropriate. ';
        break;
      case 'friendly':
        prompt += 'Be warm, approachable, and encouraging in your responses. ';
        break;
    }

    // Creativity
    switch (creativity) {
      case 'low':
        prompt += 'Be factual and straightforward in your responses.';
        break;
      case 'high':
        prompt += 'Feel free to be creative and explore different perspectives.';
        break;
      case 'medium':
      default:
        prompt += 'Balance factual accuracy with creative insights when appropriate.';
        break;
    }

    return prompt;
  }

  /**
   * Get temperature value based on creativity setting
   */
  getTemperature(): number {
    const { creativity, temperature } = this.activeConfig;
    
    // If custom temperature is set, use it
    if (temperature !== DEFAULT_CHAT_CONFIG.temperature) {
      return temperature;
    }

    // Otherwise, derive from creativity setting
    switch (creativity) {
      case 'low':
        return 0.3;
      case 'high':
        return 0.9;
      case 'medium':
      default:
        return 0.7;
    }
  }

  /**
   * Get max tokens based on response style
   */
  getMaxTokens(): number {
    const { responseStyle, maxTokens } = this.activeConfig;

    // If custom maxTokens is set, use it
    if (maxTokens !== DEFAULT_CHAT_CONFIG.maxTokens) {
      return maxTokens;
    }

    // Otherwise, derive from response style
    switch (responseStyle) {
      case 'concise':
        return 500;
      case 'detailed':
        return 2000;
      case 'balanced':
      default:
        return 1000;
    }
  }
}
