import { useState } from "react";
import { SettingsProvider, useSettings } from "./context/SettingsContext";
import { ConversationsProvider } from "./context/ConversationsContext";
import { Settings } from "./components/Settings";
import { Chat } from "./components/Chat";
import { Sidebar } from "./components/Sidebar";
import { Menu, Settings as SettingsIcon, AlertCircle } from "lucide-react";
import { Button } from "./components/ui/button";

function AppContent() {
  const { isConfigured } = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden font-sans">
      {/* Sidebar for Desktop */}
      <div className="hidden sm:block">
        <Sidebar />
      </div>

      {/* Sidebar for Mobile (Overlay) */}
      {sidebarOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 w-4/5 max-w-sm h-full bg-background shadow-xl">
            <Sidebar isMobile onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {showSettings ? (
        <div className="flex-1 flex flex-col h-full bg-muted/20 overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full p-4 pt-8 relative">
            <button
              onClick={() => setShowSettings(false)}
              className="mb-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
            >
              ← Back to Chat
            </button>
            <div className="bg-background rounded-2xl shadow-sm border overflow-hidden">
              <Settings />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 h-full flex flex-col">
          {/* Mobile Header for Sidebar Toggle */}
          <div className="sm:hidden flex items-center px-4 py-3 border-b bg-card shrink-0 gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="-ml-2">
              <Menu size={20} />
            </Button>
            <h1 className="text-lg font-bold text-primary flex-1 truncate">Chat</h1>
            {!isConfigured && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-destructive/10 text-destructive border border-destructive/20 rounded-full text-[10px] font-bold shadow-sm shrink-0">
                <AlertCircle size={12} />
                <span className="hidden min-[380px]:inline">Not Configured</span>
              </div>
            )}
            <Button variant="outline" size="icon" className="w-8 h-8 shrink-0" onClick={() => setShowSettings(true)}>
              <SettingsIcon className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <Chat onOpenSettings={() => setShowSettings(true)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ConversationsProvider>
        <AppContent />
      </ConversationsProvider>
    </SettingsProvider>
  );
}
