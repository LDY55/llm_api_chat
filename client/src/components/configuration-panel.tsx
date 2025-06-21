import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ApiConfiguration } from "@shared/schema";

interface ConfigurationPanelProps {
  expanded: boolean;
  onToggle: () => void;
  config: ApiConfiguration | null | undefined;
}

export function ConfigurationPanel({ expanded, onToggle, config }: ConfigurationPanelProps) {
  const { data: configList } = useQuery<{ configs: ApiConfiguration[]; activeId: number | null }>({
    queryKey: ["/api/configs"],
  });

  const [selectedId, setSelectedId] = useState<number | undefined>(config?.id);
  const [name, setName] = useState(config?.name || "");
  const [endpoint, setEndpoint] = useState(config?.endpoint || "");
  const [token, setToken] = useState(config?.token || "");
  const [model, setModel] = useState(config?.model || "");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update form when active config changes
  useEffect(() => {
    if (config) {
      setSelectedId(config.id);
      setName(config.name);
      setEndpoint(config.endpoint);
      setToken(config.token);
      setModel(config.model);
    }
  }, [config]);

  const saveConfigMutation = useMutation({
    mutationFn: async (
      configData: { id?: number; name: string; endpoint: string; token: string; model: string },
    ) => {
      return apiRequest("POST", "/api/config", configData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/configs"] });
      toast({
        title: "Конфигурация сохранена",
        description: "API настройки успешно обновлены",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить конфигурацию",
        variant: "destructive",
      });
    },
  });

  const testConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/config/test");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Тест успешен",
          description: "Соединение с API работает корректно",
        });
      } else {
        toast({
          title: "Тест не пройден",
          description: data.message || "Проверьте настройки API",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка тестирования",
        description: "Не удалось протестировать соединение",
        variant: "destructive",
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/configs/${id}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/configs"] });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/configs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/configs"] });
      toast({ title: "Конфигурация удалена" });
    },
    onError: () => {
      toast({ title: "Не удалось удалить конфигурацию", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!name.trim() || !endpoint.trim() || !token.trim() || !model.trim()) {
      toast({
        title: "Заполните все поля",
        description: "Все поля конфигурации обязательны для заполнения",
        variant: "destructive",
      });
      return;
    }

    saveConfigMutation.mutate({
      id: selectedId,
      name: name.trim(),
      endpoint: endpoint.trim(),
      token: token.trim(),
      model: model.trim(),
    });
  };

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm transition-all duration-300">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Конфигурация API</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="text-slate-500 hover:text-slate-700"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>
        </div>
        
        {expanded && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2">
                Сохраненные конфиги
              </Label>
              <Select
                value={selectedId ? String(selectedId) : "new"}
                onValueChange={(val) => {
                  if (val === "new") {
                    setSelectedId(undefined);
                    setName("");
                    setEndpoint("");
                    setToken("");
                    setModel("");
                  } else {
                    const id = parseInt(val);
                    setSelectedId(id);
                    const cfg = configList?.configs.find((c) => c.id === id);
                    if (cfg) {
                      setName(cfg.name);
                      setEndpoint(cfg.endpoint);
                      setToken(cfg.token);
                      setModel(cfg.model);
                      activateMutation.mutate(id);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите конфиг" />
                </SelectTrigger>
                <SelectContent>
                  {configList?.configs.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">Новый…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="name" className="text-sm font-medium text-slate-700 mb-2">
                Название
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="OpenAI"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="endpoint" className="text-sm font-medium text-slate-700 mb-2">
                Эндпоинт API
              </Label>
              <Input
                id="endpoint"
                type="url"
                placeholder="https://api.openai.com/v1/chat/completions"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="mt-2"
              />
              <div className="mt-1 text-xs text-slate-500">
                Примеры:
                <br />• OpenAI: https://api.openai.com/v1/chat/completions
                <br />• NVIDIA: https://integrate.api.nvidia.com/v1/chat/completions
                <br />• Anthropic: https://api.anthropic.com/v1/messages
              </div>
            </div>
            
            <div>
              <Label htmlFor="token" className="text-sm font-medium text-slate-700 mb-2">
                API Токен
              </Label>
              <Input
                id="token"
                type="password"
                placeholder="sk-..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="model" className="text-sm font-medium text-slate-700 mb-2">
                Модель
              </Label>
              <Input
                id="model"
                type="text"
                placeholder="gpt-3.5-turbo"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-2"
              />
              <div className="mt-1 text-xs text-slate-500">
                Примеры:
                <br />• OpenAI: gpt-4, gpt-3.5-turbo
                <br />• NVIDIA: meta/llama3-70b-instruct
                <br />• Anthropic: claude-3-sonnet-20240229
              </div>
            </div>
          </div>
        )}
        
        {expanded && (
          <div className="mt-4 flex justify-end space-x-3">
            <Button
              onClick={() => testConfigMutation.mutate()}
              disabled={testConfigMutation.isPending || !config}
              variant="outline"
              className="border-primary text-primary hover:bg-blue-50"
            >
              {testConfigMutation.isPending ? "Тестирование..." : "Тестировать API"}
            </Button>
            {selectedId && (
              <Button
                onClick={() => deleteConfigMutation.mutate(selectedId)}
                variant="destructive"
                disabled={deleteConfigMutation.isPending}
              >
                Удалить
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={saveConfigMutation.isPending}
              className="bg-primary hover:bg-blue-700"
            >
              {saveConfigMutation.isPending ? "Сохранение..." : "Сохранить конфигурацию"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
