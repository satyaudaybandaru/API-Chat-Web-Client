import React, { useState, useRef, useEffect } from "react";
import type { Message, GeneratedMedia, MessageImage } from "@/types";
import { useSettings } from "@/context/SettingsContext";
import { useConversations, generateId } from "@/context/ConversationsContext";
import { sendMessage } from "@/utils/api";
import { generateImage, generateVideo } from "@/utils/generationApi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, ImageIcon, Settings as SettingsIcon, Zap, X, Film, PlusCircle, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ImageViewer } from "./ImageViewer";

export function Chat({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { settings, isConfigured, supportsVision, supportsImageGen, supportsVideoGen } = useSettings();
  const { activeConversationId, getConversation, updateConversation, createConversation } = useConversations();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConversation = activeConversationId ? getConversation(activeConversationId) : null;
  const messages = activeConversation?.messages ?? [];

  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<MessageImage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming, isGenerating]);

  // Handle file uploads and convert to Base64
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: MessageImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64 = await convertToBase64(file);
      newImages.push({
        uri: URL.createObjectURL(file), // For local preview
        base64: base64.split(",")[1], // Strip data URI prefix
        mimeType: file.type
      });
    }
    setPendingImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isConfigured) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isConfigured) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length === 0) return;

      const newImages: MessageImage[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await convertToBase64(file);
        newImages.push({
          uri: URL.createObjectURL(file),
          base64: base64.split(",")[1],
          mimeType: file.type
        });
      }
      setPendingImages((prev) => [...prev, ...newImages]);
    }
  };

  const persistMessages = (newMessages: Message[]) => {
    if (activeConversationId) {
      updateConversation(activeConversationId, newMessages);
    }
  };

  async function handleSend() {
    if ((!input.trim() && pendingImages.length === 0) || !isConfigured) return;

    let convId = activeConversationId;
    if (!convId) {
      const newConv = createConversation();
      convId = newConv.id;
    }

    const currentText = input.trim();
    const currentImages = [...pendingImages];

    setInput("");
    setPendingImages([]);

    const userMsg: Message = {
      id: generateId("msg"),
      role: "user",
      content: currentText,
      images: currentImages.length > 0 ? currentImages : undefined,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    // Immediate persist user message
    if (convId) updateConversation(convId, newMessages);

    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let fullContent = "";
    let assistantAdded = false;
    let assistantId = generateId("msg");

    await sendMessage(settings, newMessages, {
      signal: controller.signal,
      onChunk: (chunk) => {
        fullContent += chunk;
        if (!assistantAdded) {
          const assistantMsg: Message = {
            id: assistantId,
            role: "assistant",
            content: fullContent,
            timestamp: Date.now(),
          };
          const next = [...newMessages, assistantMsg];
          if (convId) updateConversation(convId, next);
          assistantAdded = true;
        } else {
          if (convId) {
            updateConversation(convId, [...newMessages, {
              id: assistantId,
              role: "assistant",
              content: fullContent,
              timestamp: Date.now(),
            }]);
          }
        }
      },
      onDone: () => {
        setIsStreaming(false);
      },
      onError: (err) => {
        setIsStreaming(false);
        let finalError = err;
        if (currentImages.length > 0) {
          finalError = `${err}\n\n💡 Hint: You included an image in this request. If the model you are using does not support vision/image inputs, it will reject the request. Please check the official documentation for your chosen model.`;
        }

        const errMsg: Message = {
          id: generateId("msg"),
          role: "assistant",
          content: finalError,
          timestamp: Date.now(),
          error: true,
        };
        if (convId) updateConversation(convId, [...newMessages, errMsg]);
      },
    });
  }

  async function handleGenerateMedia() {
    if (!input.trim() || !isConfigured) return;

    let convId = activeConversationId;
    if (!convId) {
      const newConv = createConversation();
      convId = newConv.id;
    }

    const currentText = input.trim();
    setInput("");

    const userMsg: Message = {
      id: generateId("msg"),
      role: "user",
      content: currentText,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    if (convId) updateConversation(convId, newMessages);

    setIsGenerating(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let media: GeneratedMedia[] = [];
      if (supportsVideoGen && !supportsImageGen) {
        const result = await generateVideo(settings, { prompt: currentText, duration: 5, aspectRatio: "16:9" }, controller.signal);
        media = [result];
      } else {
        const result = await generateImage(settings, { prompt: currentText, n: 1, size: "1024x1024", quality: "standard", style: "vivid" }, controller.signal);
        media = result;
      }

      const assistantMsg: Message = {
        id: generateId("msg"),
        role: "assistant",
        content: "",
        generatedMedia: media,
        timestamp: Date.now(),
      };

      if (convId) updateConversation(convId, [...newMessages, assistantMsg]);
    } catch (err: unknown) {
      const errMsg: Message = {
        id: generateId("msg"),
        role: "assistant",
        content: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
        error: true,
      };
      if (convId) updateConversation(convId, [...newMessages, errMsg]);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleStop() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsStreaming(false);
    setIsGenerating(false);
  }

  return (
    <div
      className="flex flex-col h-full bg-background relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-primary m-4 rounded-3xl pointer-events-none transition-all">
          <div className="text-center flex flex-col items-center gap-4 text-primary">
            <ImageIcon size={64} className="animate-bounce" />
            <h2 className="text-3xl font-bold">Drop images here</h2>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b bg-card sm:flex hidden">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold flex items-baseline gap-2 tracking-tight caacupe-one-regular">
            <span className="text-slate-800 dark:text-slate-200 drop-shadow-sm pb-1">
              API Chat Web Client
            </span>
            <span className="text-xs font-normal text-muted-foreground hidden lg:inline font-sans pb-1">(Secure, Local-first, No Data Upload)</span>
          </h1>
          <span className="text-xs text-muted-foreground font-medium">{activeConversation?.title || "New Chat"} • {settings.model}</span>
        </div>
        <div className="flex items-center gap-3">
          {!isConfigured && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-full text-xs font-bold shadow-sm">
              <AlertCircle size={14} />
              API Not Configured
            </div>
          )}
          <Button variant="outline" size="icon" onClick={onOpenSettings}>
            <SettingsIcon className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4 sm:p-6" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-4">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-200 dark:border-slate-700">
              <Bot className="w-12 h-12 text-slate-700 dark:text-slate-300" />
            </div>
            <h1 className="text-6xl font-extrabold tracking-tight caacupe-one-regular text-slate-800 dark:text-slate-200 pb-2 drop-shadow-sm">API Chat Web Client</h1>
            {!isConfigured ? (
              <p className="text-xl text-muted-foreground leading-relaxed">Please configure your API settings first.</p>
            ) : (
              <p className="text-muted-foreground">Type a message to start a conversation.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 sm:gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
              >
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user"
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-primary text-primary-foreground"
                    }`}
                >
                  {msg.role === "user" ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div
                  className={`flex flex-col gap-2 max-w-[85%] sm:max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"
                    }`}
                >
                  {/* Uploaded Images */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex gap-2 flex-wrap justify-end">
                      {msg.images.map((img, i) => (
                        <img
                          key={i}
                          src={img.uri}
                          alt="Uploaded"
                          className="w-32 h-32 object-cover rounded-lg border cursor-pointer"
                          onClick={() => setViewerSrc(img.uri)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Generated Media */}
                  {msg.generatedMedia && msg.generatedMedia.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {msg.generatedMedia.map((media, i) => (
                        media.type === "image" ? (
                          <img
                            key={i}
                            src={media.url}
                            alt={media.prompt}
                            className="w-64 h-64 sm:w-80 sm:h-80 object-cover rounded-lg border cursor-pointer"
                            onClick={() => setViewerSrc(media.url)}
                          />
                        ) : (
                          <div key={i} className="flex items-center gap-3 p-4 border rounded-lg bg-muted">
                            <Film className="w-8 h-8 text-primary" />
                            <div>
                              <p className="font-semibold text-sm">Generated Video</p>
                              <a href={media.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                                Open Video
                              </a>
                            </div>
                          </div>
                        )
                      ))}
                      {msg.generatedMedia[0]?.revisedPrompt && (
                        <p className="text-xs text-muted-foreground italic mt-1 max-w-sm">
                          ✦ {msg.generatedMedia[0].revisedPrompt}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Text Content */}
                  {(msg.content || msg.error) && (
                    <div
                      className={`p-3 sm:p-4 rounded-2xl ${msg.role === "user"
                        ? "bg-secondary text-secondary-foreground rounded-tr-sm"
                        : msg.error
                          ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-tl-sm"
                          : "bg-muted text-foreground border rounded-tl-sm"
                        }`}
                    >
                      {msg.role === "assistant" && !msg.error ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-p:leading-relaxed prose-pre:bg-background">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{msg.content}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex gap-3 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Bot size={18} />
                </div>
                <div className="p-4 rounded-2xl bg-muted border rounded-tl-sm flex items-center gap-2 h-12">
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            {isGenerating && (
              <div className="flex gap-3 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Bot size={18} />
                </div>
                <div className="p-4 rounded-2xl bg-muted border rounded-tl-sm flex items-center gap-3">
                  <Zap className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-sm font-medium text-muted-foreground animate-pulse">Generating media...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 sm:p-4 bg-background border-t">
        <div className="max-w-4xl mx-auto flex flex-col gap-2">

          {/* Pending Image Previews */}
          {pendingImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {pendingImages.map((img, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={img.uri} alt="Preview" className="w-16 h-16 object-cover rounded-lg border" />
                  <button
                    onClick={() => removePendingImage(i)}
                    className="absolute -top-2 -right-2 bg-foreground text-background rounded-full p-1 shadow-sm hover:scale-110 transition-transform"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative flex items-end gap-2 bg-card border rounded-2xl p-1.5 sm:p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all">

            {/* File Input */}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />

            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConfigured || isStreaming || isGenerating}
              title="Attach Image"
            >
              <ImageIcon size={20} />
            </Button>

            {(supportsImageGen || supportsVideoGen) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl text-primary"
                onClick={handleGenerateMedia}
                disabled={!input.trim() || !isConfigured || isStreaming || isGenerating}
                title="Generate Image/Video"
              >
                <Zap size={20} />
              </Button>
            )}

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConfigured ? "Type a message..." : "Configure API in settings first..."}
              className="min-h-[44px] max-h-32 border-0 focus-visible:ring-0 resize-none shadow-none bg-transparent py-3"
              disabled={!isConfigured || isStreaming || isGenerating}
            />

            {(isStreaming || isGenerating) ? (
              <Button
                size="icon"
                variant="destructive"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={handleStop}
              >
                <X size={18} />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={handleSend}
                disabled={(!input.trim() && pendingImages.length === 0) || !isConfigured}
              >
                <Send size={18} className={(input.trim() || pendingImages.length > 0) ? "translate-x-0.5" : ""} />
              </Button>
            )}
          </div>
        </div>
      </div>

      <ImageViewer src={viewerSrc} isOpen={!!viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  );
}
