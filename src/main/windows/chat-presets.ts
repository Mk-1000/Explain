import type { ChatConfig } from './popup-chat-window';

/**
 * Predefined configuration presets for common use cases
 */
export const ChatPresets: Record<string, ChatConfig> = {
  /**
   * Quick Help - Fast, concise answers
   */
  quickHelp: {
    responseStyle: 'concise',
    tone: 'friendly',
    creativity: 'low',
    contextAwareness: false,
    maxTokens: 300,
    temperature: 0.3,
  },

  /**
   * Code Assistant - Technical, detailed explanations
   */
  codeAssistant: {
    responseStyle: 'detailed',
    tone: 'technical',
    creativity: 'low',
    contextAwareness: true,
    maxTokens: 2000,
    temperature: 0.4,
  },

  /**
   * Writing Coach - Professional, balanced feedback
   */
  writingCoach: {
    responseStyle: 'balanced',
    tone: 'professional',
    creativity: 'medium',
    contextAwareness: true,
    maxTokens: 1200,
    temperature: 0.7,
  },

  /**
   * Creative Brainstorm - High creativity, exploratory
   */
  creativeBrainstorm: {
    responseStyle: 'detailed',
    tone: 'casual',
    creativity: 'high',
    contextAwareness: true,
    maxTokens: 1500,
    temperature: 0.9,
  },

  /**
   * Study Buddy - Educational, patient, thorough
   */
  studyBuddy: {
    responseStyle: 'detailed',
    tone: 'friendly',
    creativity: 'medium',
    contextAwareness: true,
    maxTokens: 1800,
    temperature: 0.6,
  },

  /**
   * Business Communication - Professional, concise
   */
  businessComm: {
    responseStyle: 'concise',
    tone: 'professional',
    creativity: 'low',
    contextAwareness: false,
    maxTokens: 800,
    temperature: 0.4,
  },

  /**
   * Casual Chat - Friendly, conversational
   */
  casualChat: {
    responseStyle: 'balanced',
    tone: 'casual',
    creativity: 'medium',
    contextAwareness: true,
    maxTokens: 1000,
    temperature: 0.7,
  },

  /**
   * Research Assistant - Detailed, factual, comprehensive
   */
  researchAssistant: {
    responseStyle: 'detailed',
    tone: 'professional',
    creativity: 'low',
    contextAwareness: true,
    maxTokens: 2500,
    temperature: 0.3,
  },

  /**
   * Debugging Helper - Technical, step-by-step
   */
  debuggingHelper: {
    responseStyle: 'detailed',
    tone: 'technical',
    creativity: 'low',
    contextAwareness: true,
    maxTokens: 2000,
    temperature: 0.2,
  },

  /**
   * Content Creator - Creative, engaging, detailed
   */
  contentCreator: {
    responseStyle: 'detailed',
    tone: 'friendly',
    creativity: 'high',
    contextAwareness: true,
    maxTokens: 2000,
    temperature: 0.8,
  },
};

/**
 * Helper function to apply a preset configuration
 */
export function applyPreset(presetName: keyof typeof ChatPresets): ChatConfig {
  const preset = ChatPresets[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }
  return { ...preset };
}

/**
 * Get all available preset names and descriptions
 */
export function getPresetList(): Array<{ name: string; description: string }> {
  return [
    {
      name: 'quickHelp',
      description: 'Fast, concise answers for quick questions',
    },
    {
      name: 'codeAssistant',
      description: 'Technical, detailed code explanations and help',
    },
    {
      name: 'writingCoach',
      description: 'Professional feedback for writing improvement',
    },
    {
      name: 'creativeBrainstorm',
      description: 'High creativity for idea generation and exploration',
    },
    {
      name: 'studyBuddy',
      description: 'Educational, patient learning assistance',
    },
    {
      name: 'businessComm',
      description: 'Professional, concise business communication',
    },
    {
      name: 'casualChat',
      description: 'Friendly, conversational everyday chat',
    },
    {
      name: 'researchAssistant',
      description: 'Detailed, factual research support',
    },
    {
      name: 'debuggingHelper',
      description: 'Technical, step-by-step debugging assistance',
    },
    {
      name: 'contentCreator',
      description: 'Creative, engaging content generation',
    },
  ];
}
