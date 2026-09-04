export interface MessageImage {
  uri: string;
  base64?: string;
  width?: number;
  height?: number;
  mimeType?: string;
}

export interface GeneratedMedia {
  type: "image" | "video";
  url: string;
  prompt: string;
  revisedPrompt?: string;
  model: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  images?: MessageImage[];
  generatedMedia?: GeneratedMedia[];
  timestamp: number;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  topP: number | null;
  topK: number | null;
  maxTokens: number;
  streaming: boolean;
}
