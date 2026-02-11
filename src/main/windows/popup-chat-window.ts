import { BrowserWindow, screen } from 'electron';
import path from 'path';

export interface ChatConfig {
  responseStyle: 'concise' | 'balanced' | 'detailed';
  tone: 'professional' | 'casual' | 'technical' | 'friendly';
  creativity: 'low' | 'medium' | 'high';
  contextAwareness: boolean;
  maxTokens: number;
  temperature: number;
}

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  responseStyle: 'balanced',
  tone: 'professional',
  creativity: 'medium',
  contextAwareness: true,
  maxTokens: 1000,
  temperature: 0.7,
};

export class PopupChatWindowManager {
  private windows: Map<number, BrowserWindow> = new Map();
  private activeConfig: ChatConfig = { ...DEFAULT_CHAT_CONFIG };

  /**
   * Create a new popup chat window at the specified position
   */
  create(x: number, y: number, initialText?: string): BrowserWindow {
    console.log(`[ChatWindow] Creating chat window at (${x}, ${y})${initialText ? ` with initial text: "${initialText.substring(0, 50)}..."` : ''}`);
    const display = screen.getDisplayNearestPoint({ x, y });
    const { width: screenWidth, height: screenHeight } = display.workArea;

    // Chat window dimensions
    const windowWidth = 450;
    const windowHeight = 600;

    // Position the window to ensure it's fully visible
    let windowX = Math.max(0, Math.min(x - windowWidth / 2, screenWidth - windowWidth));
    let windowY = Math.max(0, Math.min(y + 20, screenHeight - windowHeight));

    const window = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: windowX,
      y: windowY,
      frame: false,
      transparent: true,
      resizable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: true,
      show: false, // Don't show until ready
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/index.js'),
      },
    });

    // Load the chat UI
    if (process.env.NODE_ENV === 'development') {
      window.loadURL('http://localhost:5173/chat.html');
      // Open dev tools in development to help debug
      window.webContents.openDevTools();
    } else {
      // In production, chat.html is built to dist/renderer/chat.html
      const packagedChat = path.join(process.resourcesPath, 'app.asar', 'dist', 'renderer', 'chat.html');
      const localChat = path.join(__dirname, '../../renderer/chat.html');
      window.loadFile(packagedChat).catch(() => {
        // Fallback to local path if packaged path doesn't work
        window.loadFile(localChat);
      });
    }

    // Store window reference
    this.windows.set(window.id, window);

    // Show window when ready
    window.once('ready-to-show', () => {
      console.log('[ChatWindow] Window ready to show, displaying...');
      window.show();
      window.focus();
    });

    // Send initial data when ready
    window.webContents.once('did-finish-load', () => {
      console.log('[ChatWindow] Window loaded, sending initialization data');
      console.log('[ChatWindow] Current URL:', window.webContents.getURL());
      this.send(window, 'chat-initialized', {
        config: this.activeConfig,
        initialText: initialText || '',
      });
    });

    // Log when page starts loading
    window.webContents.on('did-start-loading', () => {
      console.log('[ChatWindow] Started loading:', window.webContents.getURL());
    });

    // Log errors
    window.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error(`[ChatWindow] Failed to load: ${errorCode} - ${errorDescription}`);
      console.error(`[ChatWindow] URL: ${validatedURL}, isMainFrame: ${isMainFrame}`);
    });

    // Log console messages from renderer
    window.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[ChatWindow Console ${level}]: ${message} (${sourceId}:${line})`);
    });

    // Cleanup on close
    window.on('closed', () => {
      this.windows.delete(window.id);
    });

    // Handle blur to close (optional - can be configured)
    window.on('blur', () => {
      // Don't auto-close to allow users to switch windows
      // window.close();
    });

    return window;
  }

  /**
   * Update the AI configuration for all chat windows
   */
  updateConfig(config: Partial<ChatConfig>): void {
    this.activeConfig = { ...this.activeConfig, ...config };
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
      window.webContents.send(channel, data);
    }
  }

  /**
   * Broadcast a message to all active chat windows
   */
  broadcastToAll(channel: string, data: unknown): void {
    this.windows.forEach((window) => {
      this.send(window, channel, data);
    });
  }

  /**
   * Close all active chat windows
   */
  closeAll(): void {
    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.windows.clear();
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
