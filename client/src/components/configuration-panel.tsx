import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { ThemeToggle } from "@/components/theme-toggle";
import type { ApiConfiguration } from "@shared/schema";

interface ConfigurationPanelProps {
  expanded: boolean;
  onToggle: () => void;
  config: ApiConfiguration | null | undefined;
  googleMode: boolean;
  onGoogleModeChange: (val: boolean) => void;
}

export function ConfigurationPanel({ expanded, onToggle, config, googleMode, onGoogleModeChange }: ConfigurationPanelProps) {
  const { data: configList } = useQuery<{ configs: ApiConfiguration[]; activeId: number | null }>({
    queryKey: [`/api/configs?google=${googleMode}`],
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
      configData: { id?: number; name: string; endpoint: string; token: string; model: string; useGoogle: boolean },
    ) => {
      return apiRequest("POST", `/api/config?google=${googleMode}`, configData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/config?google=${googleMode}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/configs?google=${googleMode}`] });
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
      const response = await apiRequest("POST", `/api/config/test?google=${googleMode}`);
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
      return apiRequest("POST", `/api/configs/${id}/activate?google=${googleMode}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/config?google=${googleMode}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/configs?google=${googleMode}`] });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/configs/${id}?google=${googleMode}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/config?google=${googleMode}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/configs?google=${googleMode}`] });
      toast({ title: "Конфигурация удалена" });
    },
    onError: () => {
      toast({ title: "Не удалось удалить конфигурацию", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!name.trim() || (!googleMode && !endpoint.trim()) || !token.trim() || !model.trim()) {
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
      useGoogle: googleMode,
    });
  };

  return (
    <div className="bg-card border-b border-border shadow-sm transition-all duration-300">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Конфигурация API</h2>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="flex items-center space-x-2">
              <Label htmlFor="google-mode" className="text-sm">Google API</Label>
              <Switch id="google-mode" checked={googleMode} onCheckedChange={onGoogleModeChange} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        
        {expanded && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
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

            <div className="md:col-span-2 flex flex-col gap-2">
              <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Название
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="OpenAI"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="token" className="text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
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
              <Label htmlFor="model" className="text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
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
              <div className="mt-1 text-xs text-muted-foreground">
                Примеры:
                <br />• OpenAI: gpt-4, gpt-3.5-turbo
                <br />• NVIDIA: meta/llama3-70b-instruct
                <br />• Anthropic: claude-3-sonnet-20240229
              </div>
            </div>


            <div>
              <Label htmlFor="endpoint" className="text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
                Эндпоинт API
              </Label>
              <Input
                id="endpoint"
                type="url"
                placeholder="https://api.openai.com/v1/chat/completions"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                disabled={googleMode}
                className="mt-2"
              />
              <div className="mt-1 text-xs text-muted-foreground">
                Примеры:
                <br />• OpenAI: https://api.openai.com/v1/chat/completions
                <br />• NVIDIA: https://integrate.api.nvidia.com/v1/chat/completions
                <br />• Anthropic: https://api.anthropic.com/v1/messages
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
              className="border-primary text-primary hover:bg-primary/10 dark:hover:bg-primary/20"
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
