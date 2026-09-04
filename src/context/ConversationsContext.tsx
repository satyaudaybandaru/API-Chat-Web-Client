import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Conversation, Message } from "@/types";

const CONVERSATIONS_KEY = "@ai_chat_conversations_web";

let idCounter = 0;
export function generateId(prefix: string): string {
  idCounter++;
  return `${prefix}_${Date.now()}_${idCounter}_${Math.random().toString(36).substr(2, 6)}`;
}

interface ConversationsContextValue {
  conversations: Conversation[];
  isLoading: boolean;
  createConversation: () => Conversation;
  getConversation: (id: string) => Conversation | undefined;
  updateConversation: (id: string, messages: Message[]) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  clearAll: () => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    try {
      const stored = localStorage.getItem(CONVERSATIONS_KEY);
      const parsed: Conversation[] = stored ? JSON.parse(stored) : [];

      if (parsed.length > 0) {
        setConversations(parsed);
        setActiveConversationId(parsed[0].id);
      } else {
        const newConv: Conversation = {
          id: generateId("conv"),
          title: "New Chat",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setConversations([newConv]);
        setActiveConversationId(newConv.id);
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([newConv]));
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  function persist(updated: Conversation[]) {
    try {
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
    } catch {}
  }

  const createConversation = useCallback((): Conversation => {
    const conv: Conversation = {
      id: generateId("conv"),
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => {
      const next = [conv, ...prev];
      persist(next);
      return next;
    });
    setActiveConversationId(conv.id);
    return conv;
  }, []);

  const getConversation = useCallback(
    (id: string) => conversations.find((c) => c.id === id),
    [conversations]
  );

  const updateConversation = useCallback(
    (id: string, messages: Message[]) => {
      setConversations((prev) => {
        const next = prev.map((c) => {
          if (c.id !== id) return c;
          let title = c.title;
          if (title === "New Chat" && messages.length > 0) {
            const first = messages.find((m) => m.role === "user");
            if (first) {
              title = first.content.slice(0, 48) + (first.content.length > 48 ? "..." : "");
              if (!title.trim()) title = "New Chat";
            }
          }
          return { ...c, title, messages, updatedAt: Date.now() };
        });
        const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
        persist(sorted);
        return sorted;
      });
    },
    []
  );

  const renameConversation = useCallback(
    (id: string, title: string) => {
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === id ? { ...c, title, updatedAt: Date.now() } : c
        );
        persist(next);
        return next;
      });
    },
    []
  );

  const deleteConversation = useCallback((id: string) => {
    let autoCreated: Conversation | null = null;

    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        autoCreated = {
          id: generateId("conv"),
          title: "New Chat",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        persist([autoCreated]);
        return [autoCreated];
      }
      persist(next);
      return next;
    });

    setActiveConversationId((prevActive) => {
      if (prevActive === id) {
        if (autoCreated) return autoCreated.id;
        const stored = localStorage.getItem(CONVERSATIONS_KEY);
        const parsed: Conversation[] = stored ? JSON.parse(stored) : [];
        if (parsed.length > 0) return parsed[0].id;
      }
      return prevActive;
    });
  }, []);

  const clearAll = useCallback(() => {
    setConversations([]);
    setActiveConversationId(null);
    localStorage.removeItem(CONVERSATIONS_KEY);
  }, []);

  return (
    <ConversationsContext.Provider
      value={{
        conversations,
        isLoading,
        createConversation,
        getConversation,
        updateConversation,
        renameConversation,
        deleteConversation,
        clearAll,
        activeConversationId,
        setActiveConversationId
      }}
    >
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error("useConversations must be used within ConversationsProvider");
  return ctx;
}
