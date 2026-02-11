import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ChatWindow.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ChatConfig {
  responseStyle: 'concise' | 'balanced' | 'detailed';
  tone: 'professional' | 'casual' | 'technical' | 'friendly';
  creativity: 'low' | 'medium' | 'high';
  contextAwareness: boolean;
  maxTokens: number;
  temperature: number;
}

export const ChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load initial config and setup listeners
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const initialConfig = await window.electronAPI.chat.getConfig();
        setConfig(initialConfig);
      } catch (err) {
        console.error('Failed to load config:', err);
      }
    };

    loadConfig();

    // Listen for config updates
    const unsubscribe = window.electronAPI.onChatConfigUpdated((newConfig) => {
      setConfig(newConfig);
    });

    // Listen for initialization with initial text
    const unsubscribeInit = window.electronAPI.onChatInitialized(
      ({ config: initConfig, initialText }) => {
        setConfig(initConfig);
        if (initialText) {
          setInputValue(initialText);
          inputRef.current?.focus();
        }
      }
    );

    return () => {
      unsubscribe();
      unsubscribeInit();
    };
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentMessages = [...messages, userMessage];
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await window.electronAPI.chat.sendMessage({
        message: userMessage.content,
        conversationHistory: messages,
        useContext: config?.contextAwareness ?? true,
      });

      const assistantMessage: ChatMessage = {
        id: response.messageId,
        role: 'assistant',
        content: response.message,
        timestamp: response.timestamp,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputValue, isLoading, messages, config]);

  const handleExportChat = useCallback(async () => {
    try {
      const exportText = await window.electronAPI.chat.exportConversation(messages);
      // Copy to clipboard
      navigator.clipboard.writeText(exportText);
      alert('Conversation exported to clipboard!');
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [messages]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Escape: Close window
      if (e.key === 'Escape') {
        window.electronAPI.closeWindow();
        return;
      }

      // Ctrl+Enter or Cmd+Enter: Send message
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isLoading && inputValue.trim()) {
          handleSendMessage();
        }
        return;
      }

      // Ctrl+L or Cmd+L: Clear conversation
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        setMessages([]);
        window.electronAPI.chat.clearHistory();
        return;
      }

      // Ctrl+K or Cmd+K: Focus input
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // Ctrl+S or Cmd+S: Save conversation (export)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (messages.length > 0) {
          handleExportChat();
        }
        return;
      }

      // Ctrl+Shift+C or Cmd+Shift+C: Copy last response
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
        if (lastAssistantMessage) {
          navigator.clipboard.writeText(lastAssistantMessage.content);
          // Show brief feedback (could be enhanced with a toast)
          console.log('Copied last response to clipboard');
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [messages, isLoading, inputValue, handleSendMessage, handleExportChat]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter: Send message (Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    window.electronAPI.chat.clearHistory();
  };

  const updateConfig = async (updates: Partial<ChatConfig>) => {
    try {
      await window.electronAPI.chat.updateConfig(updates);
      setConfig((prev) => (prev ? { ...prev, ...updates } : null));
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  };

  const closeWindow = () => {
    window.electronAPI.closeWindow();
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">💬</span>
          <span>AI Chat Assistant</span>
        </div>
        <div className="chat-actions">
          <button
            className="icon-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            ⚙️
          </button>
          <button className="icon-button" onClick={handleClearChat} title="Clear chat">
            🗑️
          </button>
          <button className="icon-button" onClick={handleExportChat} title="Export chat">
            📤
          </button>
          <button className="icon-button close-button" onClick={closeWindow} title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && config && (
        <div className="settings-panel">
          <div className="setting-group">
            <label>Response Style:</label>
            <select
              value={config.responseStyle}
              onChange={(e) =>
                updateConfig({
                  responseStyle: e.target.value as 'concise' | 'balanced' | 'detailed',
                })
              }
            >
              <option value="concise">Concise</option>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>

          <div className="setting-group">
            <label>Tone:</label>
            <select
              value={config.tone}
              onChange={(e) =>
                updateConfig({
                  tone: e.target.value as 'professional' | 'casual' | 'technical' | 'friendly',
                })
              }
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="technical">Technical</option>
              <option value="friendly">Friendly</option>
            </select>
          </div>

          <div className="setting-group">
            <label>Creativity:</label>
            <select
              value={config.creativity}
              onChange={(e) =>
                updateConfig({ creativity: e.target.value as 'low' | 'medium' | 'high' })
              }
            >
              <option value="low">Low (Factual)</option>
              <option value="medium">Medium</option>
              <option value="high">High (Creative)</option>
            </select>
          </div>

          <div className="setting-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={config.contextAwareness}
                onChange={(e) => updateConfig({ contextAwareness: e.target.checked })}
              />
              <span>Remember conversation context</span>
            </label>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💭</div>
            <p>Start a conversation with your AI assistant</p>
            {config && (
              <div className="config-preview">
                <small>
                  Current mode: {config.responseStyle} · {config.tone}
                </small>
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <div className="message-avatar">
                {message.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="message-content">
                <div className="message-text">{message.content}</div>
                <div className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Input Area */}
      <div className="input-container">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          rows={3}
          disabled={isLoading}
        />
        <button
          className="send-button"
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isLoading}
        >
          {isLoading ? '⏳' : '📤'} Send
        </button>
      </div>
    </div>
  );
};
