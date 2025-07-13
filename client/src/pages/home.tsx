import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ConfigurationPanel } from "@/components/configuration-panel";
import { SystemPromptsSidebar } from "@/components/system-prompts-sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { useQuery } from "@tanstack/react-query";
import type { SystemPrompt, ApiConfiguration } from "@shared/schema";
import { useSession } from "@/hooks/use-session";

export default function Home() {
  const [, navigate] = useLocation();
  const { data: session, isLoading: sessionLoading } = useSession();
  const [configExpanded, setConfigExpanded] = useState(true);
  const [activePrompt, setActivePrompt] = useState<SystemPrompt | null>(null);
  const [googleMode, setGoogleMode] = useState(false);

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
      
      <div className="flex flex-1 overflow-hidden">
        <SystemPromptsSidebar
          prompts={prompts}
          activePrompt={activePrompt}
          onSelectPrompt={setActivePrompt}
          activeModel={config?.model}
        />
        
        <ChatInterface
          activePrompt={activePrompt}
          config={config}
          googleMode={googleMode}
        />
      </div>
    </div>
  );
}
