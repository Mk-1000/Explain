// ENHANCED CHAT HANDLERS
// Replace chat-handlers.ts with this enhanced version

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { PopupChatWindowManager } from '../windows/popup-chat-window';
import type { AIProvider, ChatConfig, ChatConversation } from '../../shared/types';
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
  provider?: string;
}

export interface ChatError {
  message: string;
  code: string;
  timestamp: number;
  processingTime: number;
  userAction?: string;
  troubleshooting?: string[];
}

export function registerChatHandlers(
  chatManager: PopupChatWindowManager,
  aiProvider?: AIProvider
): void {
  console.log('[ChatHandlers] Registering chat IPC handlers');

  /**
   * Handle chat message from user with enhanced error handling and provider fallback
   */
  ipcMain.handle(
    'chat:send-message',
    async (event: IpcMainInvokeEvent, request: ChatRequest): Promise<ChatResponse | ChatError> => {
      const startTime = Date.now();
      console.log('[ChatHandlers] Processing chat message:', {
        messageLength: request.message?.length,
        historyLength: request.conversationHistory?.length,
        useContext: request.useContext,
      });

      try {
        // Validate request
        if (!request.message || typeof request.message !== 'string') {
          throw new Error('Message is required and must be a string');
        }

        const trimmedMessage = request.message.trim();
        
        if (trimmedMessage.length === 0) {
          throw new Error('Message cannot be empty');
        }
        
        if (trimmedMessage.length > 10000) {
          throw new Error('Message is too long (maximum 10,000 characters)');
        }

        // Get configuration
        const config = chatManager.getConfig();
        const systemPrompt = chatManager.buildSystemPrompt();
        
        console.log('[ChatHandlers] Using config:', {
          responseStyle: config.responseStyle,
          tone: config.tone,
          creativity: config.creativity,
          contextAwareness: config.contextAwareness,
          maxTokens: chatManager.getMaxTokens(),
          temperature: chatManager.getTemperature(),
        });

        // Build message context with smart truncation
        const messages: Array<{ role: string; content: string }> = [
          { role: 'system', content: systemPrompt },
        ];

        // Add conversation history if context awareness is enabled
        if (config.contextAwareness && request.useContext && request.conversationHistory) {
          const optimizedHistory = optimizeContext(
            request.conversationHistory,
            chatManager.getMaxTokens()
          );
          
          console.log(`[ChatHandlers] Using ${optimizedHistory.length} context messages (optimized from ${request.conversationHistory.length})`);
          
          optimizedHistory.forEach((msg) => {
            messages.push({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content,
            });
          });
        }

        // Add current message
        messages.push({ role: 'user', content: trimmedMessage });

        // Get configured providers in priority order
        const providerConfigs = ConfigManager.getProviders()
          .filter(p => p.enabled)
          .sort((a, b) => a.priority - b.priority);
        
        if (providerConfigs.length === 0) {
          throw Object.assign(
            new Error('No AI provider configured'),
            {
              code: 'NO_PROVIDER',
              userAction: 'Configure at least one AI provider in Settings',
              troubleshooting: [
                'Open Settings > AI Providers',
                'Enable at least one provider',
                'Add your API key',
                'Test the connection',
              ],
            }
          );
        }

        console.log(`[ChatHandlers] Trying ${providerConfigs.length} providers:`, 
          providerConfigs.map(p => `${p.name} (priority: ${p.priority})`));

        // Try providers in order until one succeeds
        let lastError: Error | null = null;
        const failedProviders: Array<{ name: string; error: string }> = [];
        
        for (const providerConfig of providerConfigs) {
          const provider = ProviderManager.getProvider(providerConfig.name);
          
          if (!provider) {
            console.warn(`[ChatHandlers] Provider ${providerConfig.name} not found`);
            continue;
          }
          
          try {
            console.log(`[ChatHandlers] Attempting with provider: ${provider.name}`);
            
            // Call AI provider with chat configuration
            const result = await enhanceWithProvider(
              provider, 
              messages, 
              config, 
              chatManager
            );

            const response: ChatResponse = {
              message: result.text,
              messageId: generateMessageId(),
              timestamp: Date.now(),
              tokensUsed: result.tokensUsed,
              processingTime: Date.now() - startTime,
              provider: provider.name,
            };

            console.log('[ChatHandlers] Success:', {
              provider: provider.name,
              messageLength: response.message.length,
              tokensUsed: response.tokensUsed,
              processingTime: response.processingTime,
            });

            return response;
            
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.warn(`[ChatHandlers] Provider ${provider.name} failed:`, error.message);
            
            failedProviders.push({
              name: provider.name,
              error: error.message,
            });
            
            lastError = error;
            continue; // Try next provider
          }
        }
        
        // All providers failed
        console.error('[ChatHandlers] All providers failed:', failedProviders);
        
        throw Object.assign(
          new Error(
            `All ${providerConfigs.length} provider(s) failed. ` +
            `Last error: ${lastError?.message || 'Unknown error'}`
          ),
          {
            code: 'ALL_PROVIDERS_FAILED',
            userAction: 'Check your provider configuration and API keys',
            troubleshooting: [
              'Verify API keys are correct in Settings',
              'Check internet connection',
              'Try a different provider',
              'View detailed errors in the console',
            ],
            failedProviders,
          }
        );

      } catch (error) {
        console.error('[ChatHandlers] Error processing message:', error);
        
        // Build structured error response
        const errorObj = error as Error & {
          code?: string;
          userAction?: string;
          troubleshooting?: string[];
          failedProviders?: Array<{ name: string; error: string }>;
        };
        
        const chatError: ChatError = {
          message: errorObj.message || 'Failed to process chat message',
          code: errorObj.code || 'CHAT_ERROR',
          timestamp: Date.now(),
          processingTime: Date.now() - startTime,
          userAction: errorObj.userAction || getErrorAction(errorObj),
          troubleshooting: errorObj.troubleshooting || getErrorTroubleshooting(errorObj),
        };
        
        return chatError;
      }
    }
  );

  /**
   * Get current chat configuration
   */
  ipcMain.handle('chat:get-config', async (): Promise<ChatConfig> => {
    console.log('[ChatHandlers] Getting chat config');
    return chatManager.getConfig();
  });

  /**
   * Update chat configuration
   */
  ipcMain.handle(
    'chat:update-config',
    async (event: IpcMainInvokeEvent, config: Partial<ChatConfig>): Promise<void> => {
      console.log('[ChatHandlers] Updating chat config:', config);
      chatManager.updateConfig(config);
    }
  );

  /**
   * Clear conversation history
   */
  ipcMain.handle('chat:clear-history', async (): Promise<void> => {
    console.log('[ChatHandlers] Conversation history cleared');
    // Can be used to clear server-side cache if implemented
  });

  /**
   * Export conversation to markdown
   */
  ipcMain.handle(
    'chat:export-conversation',
    async (event: IpcMainInvokeEvent, messages: ChatMessage[]): Promise<string> => {
      console.log(`[ChatHandlers] Exporting ${messages.length} messages`);
      
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

  /**
   * Get available providers for chat
   */
  ipcMain.handle('chat:get-providers', async (): Promise<Array<{name: string; configured: boolean; enabled: boolean}>> => {
    console.log('[ChatHandlers] Getting available providers');
    
    const configs = ConfigManager.getProviders();
    const providers = ProviderManager.getAllProviders();
    
    return providers.map(p => {
      const config = configs.find(c => c.name === p.name);
      return {
        name: p.name,
        configured: p.isConfigured(),
        enabled: config?.enabled || false,
      };
    });
  });

  /**
   * Save chat conversation
   */
  ipcMain.handle(
    'chat:save-conversation',
    async (event: IpcMainInvokeEvent, conversation: ChatConversation): Promise<void> => {
      console.log(`[ChatHandlers] Saving conversation: ${conversation.id}`);
      ConfigManager.saveChatConversation(conversation);
    }
  );

  /**
   * Get chat history
   */
  ipcMain.handle('chat:get-history', async (): Promise<ChatConversation[]> => {
    console.log('[ChatHandlers] Getting chat history');
    return ConfigManager.getChatHistory();
  });

  /**
   * Delete chat conversation
   */
  ipcMain.handle(
    'chat:delete-conversation',
    async (event: IpcMainInvokeEvent, id: string): Promise<void> => {
      console.log(`[ChatHandlers] Deleting conversation: ${id}`);
      ConfigManager.deleteChatConversation(id);
    }
  );

  /**
   * Clear chat history
   */
  ipcMain.handle('chat:clear-all-history', async (): Promise<void> => {
    console.log('[ChatHandlers] Clearing all chat history');
    ConfigManager.clearChatHistory();
  });

  console.log('[ChatHandlers] All chat handlers registered successfully');
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
  // Check if provider supports chat completions
  if ('enhanceChat' in provider && typeof provider.enhanceChat === 'function') {
    const chatProvider = provider as AIProvider & {
      enhanceChat(
        messages: Array<{ role: string; content: string }>,
        options: {
          temperature?: number;
          maxTokens?: number;
          topP?: number;
        }
      ): Promise<{ text: string; tokensUsed?: number }>;
    };
    
    return await chatProvider.enhanceChat(messages, {
      temperature: chatManager.getTemperature(),
      maxTokens: chatManager.getMaxTokens(),
      topP: 1.0,
    });
  }

  // Fallback: use the enhance method with the last user message
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
  
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
 * Optimize conversation context to fit within token limits
 */
function optimizeContext(
  messages: ChatMessage[],
  maxTokens: number = 4000
): ChatMessage[] {
  // Rough estimate: ~4 characters per token
  const targetChars = maxTokens * 4;
  
  // Always keep most recent messages
  const result: ChatMessage[] = [];
  let totalChars = 0;
  
  // Add messages from newest to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgChars = msg.content.length;
    
    if (totalChars + msgChars > targetChars) {
      // Stop if we exceed limit
      break;
    }
    
    result.unshift(msg);
    totalChars += msgChars;
  }
  
  return result;
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get user-friendly action for error
 */
function getErrorAction(error: Error): string {
  const msg = error.message.toLowerCase();
  
  if (msg.includes('api key') || msg.includes('unauthorized')) {
    return 'Check your API key in Settings > AI Providers';
  }
  
  if (msg.includes('rate limit')) {
    return 'Wait a moment and try again (rate limit reached)';
  }
  
  if (msg.includes('network') || msg.includes('timeout')) {
    return 'Check your internet connection';
  }
  
  if (msg.includes('no provider') || msg.includes('not configured')) {
    return 'Configure an AI provider in Settings';
  }
  
  return 'Try again or check your configuration';
}

/**
 * Get troubleshooting steps for error
 */
function getErrorTroubleshooting(error: Error): string[] {
  const msg = error.message.toLowerCase();
  const steps: string[] = [];
  
  if (msg.includes('api key') || msg.includes('unauthorized')) {
    steps.push('Go to Settings > AI Providers');
    steps.push('Verify your API key is correct');
    steps.push('Test the connection');
  }
  
  if (msg.includes('ollama')) {
    steps.push('Ensure Ollama is running (ollama serve)');
    steps.push('Check the model is installed (ollama list)');
    steps.push('Verify Ollama is accessible at http://localhost:11434');
  }
  
  if (msg.includes('network') || msg.includes('timeout')) {
    steps.push('Check your internet connection');
    steps.push('Verify firewall settings allow the app');
    steps.push('Try using a different provider');
  }
  
  if (msg.includes('rate limit')) {
    steps.push('Wait 1-2 minutes before trying again');
    steps.push('Consider upgrading your API plan');
    steps.push('Use a different provider temporarily');
  }
  
  if (steps.length === 0) {
    steps.push('Check the console for detailed error messages');
    steps.push('Try restarting the application');
    steps.push('Contact support if the issue persists');
  }
  
  return steps;
}
