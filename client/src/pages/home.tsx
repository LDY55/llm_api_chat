import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ConfigurationPanel } from "@/components/configuration-panel";
import { SystemPromptsSidebar } from "@/components/system-prompts-sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { SystemPrompt, ApiConfiguration } from "@shared/schema";
import { useSession } from "@/hooks/use-session";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Home() {
  const [, navigate] = useLocation();
  const { data: session, isLoading: sessionLoading } = useSession();
  const [configExpanded, setConfigExpanded] = useState(true);
  const [activePrompt, setActivePrompt] = useState<SystemPrompt | null>(null);
  const [googleMode, setGoogleMode] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const isMobile = useIsMobile();

  // Load prompts
  const { data: prompts = [] } = useQuery<SystemPrompt[]>({
    queryKey: ["/api/prompts"],
  });

  // Load configuration
  const { data: config } = useQuery<ApiConfiguration | null>({
    queryKey: [`/api/config?google=${googleMode}`],
  });

  // Set first prompt as active by default
  useEffect(() => {
    if (prompts.length > 0 && !activePrompt) {
      setActivePrompt(prompts[0]);
    }
  }, [prompts, activePrompt]);

  useEffect(() => {
    if (!sessionLoading && !session) {
      navigate("/login");
    }
  }, [sessionLoading, session, navigate]);

  const handleSelectPrompt = (prompt: SystemPrompt) => {
    setActivePrompt(prompt);
    if (isMobile) {
      setPromptsOpen(false);
    }
  };

  if (sessionLoading || !session) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <ConfigurationPanel
        expanded={configExpanded}
        onToggle={() => setConfigExpanded(!configExpanded)}
        config={config}
        googleMode={googleMode}
        onGoogleModeChange={setGoogleMode}
      />

      {isMobile && (
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
          <div className="text-xs text-muted-foreground">
            Active prompt: <span className="text-foreground">{activePrompt?.name ?? "None"}</span>
          </div>
          <Sheet open={promptsOpen} onOpenChange={setPromptsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                Prompts
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <SystemPromptsSidebar
                prompts={prompts}
                activePrompt={activePrompt}
                onSelectPrompt={handleSelectPrompt}
                activeModel={config?.model}
              />
            </SheetContent>
          </Sheet>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {!isMobile && (
          <SystemPromptsSidebar
            prompts={prompts}
            activePrompt={activePrompt}
            onSelectPrompt={handleSelectPrompt}
            activeModel={config?.model}
          />
        )}
        
        <ChatInterface
          activePrompt={activePrompt}
          config={config}
          googleMode={googleMode}
        />
      </div>
    </div>
  );
}
