import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Settings } from "@/types";
import { detectVisionSupport, probeVisionSupport } from "@/utils/api";
import { detectImageGenModel, detectVideoGenModel } from "@/utils/generationApi";

const SETTINGS_KEY = "@ai_chat_settings";
const API_KEY_SECURE_KEY = "ai_chat_api_key";

const DEFAULT_SETTINGS: Settings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o",
  systemPrompt: "",
  temperature: 0.7,
  topP: null,
  topK: null,
  maxTokens: 2048,
  streaming: true,
};

interface SettingsContextValue {
  settings: Settings;
  isConfigured: boolean;
  isLoading: boolean;
  supportsVision: boolean | null;
  supportsImageGen: boolean;
  supportsVideoGen: boolean;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  testConnection: (params?: { baseUrl: string; apiKey: string; model: string }) => Promise<{ success: boolean; message: string }>;
  refreshVisionSupport: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [supportsVision, setSupportsVision] = useState<boolean | null>(null);
  const [supportsImageGen, setSupportsImageGen] = useState(false);
  const [supportsVideoGen, setSupportsVideoGen] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      const parsed: Partial<Settings> = stored ? JSON.parse(stored) : {};
      const apiKey = localStorage.getItem(API_KEY_SECURE_KEY) ?? "";
      const next = { ...DEFAULT_SETTINGS, ...parsed, apiKey };
      setSettings(next);
      setSupportsVision(detectVisionSupport(next.model));
      setSupportsImageGen(detectImageGenModel(next.model));
      setSupportsVideoGen(detectVideoGenModel(next.model));
    } catch {
      // use defaults
    } finally {
      setIsLoading(false);
    }
  }

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      // Update capability heuristics immediately if model changed
      if (partial.model !== undefined) {
        setSupportsVision(detectVisionSupport(next.model));
        setSupportsImageGen(detectImageGenModel(next.model));
        setSupportsVideoGen(detectVideoGenModel(next.model));
      }
      (async () => {
        try {
          const { apiKey, ...rest } = next;
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
          if (apiKey !== undefined) {
            if (apiKey === "") {
              localStorage.removeItem(API_KEY_SECURE_KEY);
            } else {
              localStorage.setItem(API_KEY_SECURE_KEY, apiKey);
            }
          }
        } catch {}
      })();
      return next;
    });
  }, []);

  const refreshVisionSupport = useCallback(async () => {
    const { baseUrl, apiKey, model } = settings;
    if (!baseUrl || !apiKey || !model) return;
    const result = await probeVisionSupport(baseUrl, apiKey, model);
    setSupportsVision(result);
  }, [settings]);

  const testConnection = useCallback(async (params?: { baseUrl: string; apiKey: string; model: string }): Promise<{
    success: boolean;
    message: string;
  }> => {
    const baseUrl = params?.baseUrl ?? settings.baseUrl;
    const apiKey = params?.apiKey ?? settings.apiKey;
    const model = params?.model ?? settings.model;
    
    if (!baseUrl || !apiKey || !model) {
      return { success: false, message: "Please fill in all required fields." };
    }
    try {
      const url = baseUrl.replace(/\/$/, "") + "/chat/completions";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
          stream: false,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        return {
          success: false,
          message: `Error ${res.status}: ${body.slice(0, 120)}`,
        };
      }
      // Probe vision support after a successful connection
      probeVisionSupport(baseUrl, apiKey, model).then(setSupportsVision);
      return { success: true, message: "Connection successful!" };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: msg };
    }
  }, [settings]);

  const isConfigured = Boolean(
    settings.baseUrl && settings.apiKey && settings.model
  );

  return (
    <SettingsContext.Provider
      value={{ settings, isConfigured, isLoading, supportsVision, supportsImageGen, supportsVideoGen, updateSettings, testConnection, refreshVisionSupport }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
