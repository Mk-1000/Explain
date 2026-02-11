import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { PopupChatWindowManager, ChatConfig } from '../windows/popup-chat-window';
import type { AIProvider, EnhancementResult } from '../../shared/types';
import ProviderManager from '../ai-providers/provider-manager';
import ConfigManager from '../services/config-manager';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatRequest {
  message: string;
  conversationHistory: ChatMessage[];
  useContext: boolean;
}

export interface ChatResponse {
  message: string;
  messageId: string;
  timestamp: number;
  tokensUsed?: number;
  processingTime: number;
}

export function registerChatHandlers(
  chatManager: PopupChatWindowManager,
  aiProvider?: AIProvider
): void {
  /**
   * Handle chat message from user
   */
  ipcMain.handle(
    'chat:send-message',
    async (event: IpcMainInvokeEvent, request: ChatRequest): Promise<ChatResponse> => {
      const startTime = Date.now();

      try {
        const config = chatManager.getConfig();
        const systemPrompt = chatManager.buildSystemPrompt();

        // Build message context
        const messages: Array<{ role: string; content: string }> = [
          { role: 'system', content: systemPrompt },
        ];

        // Add conversation history if context awareness is enabled
        if (config.contextAwareness && request.useContext) {
          const historyToInclude = request.conversationHistory.slice(-6); // Last 6 messages
          historyToInclude.forEach((msg) => {
            messages.push({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content,
            });
          });
        }

        // Add current message
        messages.push({ role: 'user', content: request.message });

        // Get provider - use passed provider or get from ProviderManager
        const provider = aiProvider || ProviderManager.getConfiguredProviders()[0];
        
        if (!provider) {
          throw new Error('No AI provider configured. Please configure a provider in Settings.');
        }

        // Call AI provider with enhanced parameters
        const result = await enhanceWithProvider(provider, messages, config, chatManager);

        return {
          message: result.text,
          messageId: generateMessageId(),
          timestamp: Date.now(),
          tokensUsed: result.tokensUsed,
          processingTime: Date.now() - startTime,
        };
      } catch (error) {
        console.error('[Chat] Error processing message:', error);
        throw new Error(
          error instanceof Error ? error.message : 'Failed to process chat message'
        );
      }
    }
  );

  /**
   * Get current chat configuration
   */
  ipcMain.handle('chat:get-config', async (): Promise<ChatConfig> => {
    return chatManager.getConfig();
  });

  /**
   * Update chat configuration
   */
  ipcMain.handle(
    'chat:update-config',
    async (event: IpcMainInvokeEvent, config: Partial<ChatConfig>): Promise<void> => {
      chatManager.updateConfig(config);
    }
  );

  /**
   * Clear conversation history (handled on frontend, but can sync with backend if needed)
   */
  ipcMain.handle('chat:clear-history', async (): Promise<void> => {
    // Can be used to clear server-side cache if implemented
    console.log('[Chat] Conversation history cleared');
  });

  /**
   * Export conversation
   */
  ipcMain.handle(
    'chat:export-conversation',
    async (event: IpcMainInvokeEvent, messages: ChatMessage[]): Promise<string> => {
      const timestamp = new Date().toISOString();
      let exportText = `# Chat Export - ${timestamp}\n\n`;

      messages.forEach((msg) => {
        const role = msg.role === 'user' ? 'You' : 'AI Assistant';
        const time = new Date(msg.timestamp).toLocaleTimeString();
        exportText += `**${role}** (${time}):\n${msg.content}\n\n`;
      });

      return exportText;
    }
  );
}

/**
 * Helper function to enhance text with the AI provider using chat configuration
 */
async function enhanceWithProvider(
  provider: AIProvider,
  messages: Array<{ role: string; content: string }>,
  config: ChatConfig,
  chatManager: PopupChatWindowManager
): Promise<{ text: string; tokensUsed?: number }> {
  // For providers that support chat completions (OpenAI, Anthropic, OpenRouter)
  if ('enhanceChat' in provider && typeof provider.enhanceChat === 'function') {
    return await provider.enhanceChat(messages, {
      temperature: chatManager.getTemperature(),
      maxTokens: chatManager.getMaxTokens(),
    });
  }

  // Fallback: use the enhance method with the last user message
  const lastUserMessage = messages[messages.length - 1].content;
  const result = await provider.enhance(lastUserMessage, {
    type: 'rephrase',
    maxVariants: 1,
  });

  return {
    text: result.suggestions[0]?.text || '',
    tokensUsed: result.tokensUsed,
  };
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
