import React, { useState } from "react";
import { useConversations } from "@/context/ConversationsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, Edit2, Check, X } from "lucide-react";
import type { Conversation } from "@/types";

export function Sidebar({ isMobile, onClose }: { isMobile?: boolean; onClose?: () => void }) {
  const { conversations, createConversation, deleteConversation, renameConversation, activeConversationId, setActiveConversationId } = useConversations();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleCreate = () => {
    createConversation();
    if (isMobile && onClose) onClose();
  };

  const handleSelect = (id: string) => {
    setActiveConversationId(id);
    if (isMobile && onClose) onClose();
  };

  const handleStartRename = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleCommitRename = (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      renameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    deleteConversation(id);
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 border-r w-full sm:w-64">
      <div className="p-4 border-b flex flex-col gap-5 bg-card">
        <div className="flex items-center gap-3 px-1 text-[#8C4048]">
        </div>
        <Button onClick={handleCreate} className="w-full flex items-center gap-2 shadow-sm font-semibold">
          <Plus size={16} /> New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 flex flex-col gap-1">
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEditing = conv.id === editingId;

            return (
              <div
                key={conv.id}
                onClick={() => !isEditing && handleSelect(conv.id)}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors group ${isActive ? "bg-primary/10 text-primary hover:bg-primary/15" : "hover:bg-muted text-foreground"
                  }`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                    <Input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCommitRename(e, conv.id);
                        if (e.key === "Escape") handleCancelRename(e as any);
                      }}
                      className="h-8 text-sm px-2"
                    />
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => handleCommitRename(e, conv.id)}>
                        <Check size={14} className="text-emerald-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelRename}>
                        <X size={14} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <MessageSquare size={16} className="shrink-0 opacity-70" />
                      <span className="truncate text-sm font-medium">{conv.title}</span>
                    </div>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={(e) => handleStartRename(e, conv)}
                      >
                        <Edit2 size={13} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(e, conv.id)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
