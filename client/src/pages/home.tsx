import { useState, useEffect } from "react";
import { ConfigurationPanel } from "@/components/configuration-panel";
import { SystemPromptsSidebar } from "@/components/system-prompts-sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { useQuery } from "@tanstack/react-query";
import type { SystemPrompt, ApiConfiguration } from "@shared/schema";

export default function Home() {
  const [configExpanded, setConfigExpanded] = useState(true);
  const [activePrompt, setActivePrompt] = useState<SystemPrompt | null>(null);

  // Load prompts
  const { data: prompts = [] } = useQuery<SystemPrompt[]>({
    queryKey: ["/api/prompts"],
  });

  // Load configuration
  const { data: config } = useQuery<ApiConfiguration | null>({
    queryKey: ["/api/config"],
  });

  // Set first prompt as active by default
  useEffect(() => {
    if (prompts.length > 0 && !activePrompt) {
      setActivePrompt(prompts[0]);
    }
  }, [prompts, activePrompt]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <ConfigurationPanel 
        expanded={configExpanded}
        onToggle={() => setConfigExpanded(!configExpanded)}
        config={config}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <SystemPromptsSidebar 
          prompts={prompts}
          activePrompt={activePrompt}
          onSelectPrompt={setActivePrompt}
        />
        
        <ChatInterface 
          activePrompt={activePrompt}
          config={config}
        />
      </div>
    </div>
  );
}
