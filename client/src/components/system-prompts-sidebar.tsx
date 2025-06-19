import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SystemPrompt } from "@shared/schema";

interface SystemPromptsSidebarProps {
  prompts: SystemPrompt[];
  activePrompt: SystemPrompt | null;
  onSelectPrompt: (prompt: SystemPrompt) => void;
}

export function SystemPromptsSidebar({ prompts, activePrompt, onSelectPrompt }: SystemPromptsSidebarProps) {
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addPromptMutation = useMutation({
    mutationFn: async (promptData: { name: string; content: string }) => {
      return apiRequest("POST", "/api/prompts", promptData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      setNewPromptName("");
      setNewPromptContent("");
      toast({
        title: "Промпт добавлен",
        description: "Новый системный промпт успешно создан",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить промпт",
        variant: "destructive",
      });
    },
  });

  const deletePromptMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/prompts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      toast({
        title: "Промпт удален",
        description: "Системный промпт успешно удален",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить промпт",
        variant: "destructive",
      });
    },
  });

  const handleAddPrompt = () => {
    if (!newPromptName.trim() || !newPromptContent.trim()) {
      toast({
        title: "Заполните все поля",
        description: "Название и содержание промпта обязательны",
        variant: "destructive",
      });
      return;
    }

    addPromptMutation.mutate({
      name: newPromptName.trim(),
      content: newPromptContent.trim(),
    });
  };

  const handleDeletePrompt = (id: number) => {
    if (confirm("Удалить этот промпт?")) {
      deletePromptMutation.mutate(id);
      
      // If deleted prompt was active, clear selection
      if (activePrompt && activePrompt.id === id) {
        const remainingPrompts = prompts.filter(p => p.id !== id);
        if (remainingPrompts.length > 0) {
          onSelectPrompt(remainingPrompts[0]);
        }
      }
    }
  };

  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">Системные промпты</h3>
        
        <div className="space-y-3">
          <Input
            placeholder="Название промпта"
            value={newPromptName}
            onChange={(e) => setNewPromptName(e.target.value)}
            className="text-sm"
          />
          <Textarea
            placeholder="Текст промпта..."
            rows={3}
            value={newPromptContent}
            onChange={(e) => setNewPromptContent(e.target.value)}
            className="text-sm resize-none"
          />
          <Button 
            onClick={handleAddPrompt}
            disabled={addPromptMutation.isPending}
            className="w-full bg-primary hover:bg-blue-700 text-sm"
          >
            {addPromptMutation.isPending ? "Добавление..." : "Добавить промпт"}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className={`p-3 border rounded-lg hover:border-slate-300 transition-colors cursor-pointer ${
                activePrompt?.id === prompt.id ? 'border-primary bg-blue-50' : 'border-slate-200'
              }`}
              onClick={() => onSelectPrompt(prompt)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-800 truncate">
                    {prompt.name}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {prompt.content}
                  </p>
                </div>
                <div className="flex space-x-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPrompt(prompt);
                    }}
                    title="Выбрать"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePrompt(prompt.id);
                    }}
                    title="Удалить"
                    disabled={deletePromptMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <div className="text-xs text-slate-500 mb-1">Активный промпт:</div>
        <div className="text-sm font-medium text-slate-700">
          {activePrompt ? activePrompt.name : "Не выбран"}
        </div>
      </div>
    </div>
  );
}
