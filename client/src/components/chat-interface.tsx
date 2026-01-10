import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Trash2, Loader2, Paperclip, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SystemPrompt, ApiConfiguration, ChatMessage } from "@shared/schema";
import type { LLMResponse, ChatRequest } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import * as XLSX from "xlsx";

interface ChatInterfaceProps {
  activePrompt: SystemPrompt | null;
  config: ApiConfiguration | null | undefined;
  googleMode: boolean;
}

export function ChatInterface({ activePrompt, config, googleMode }: ChatInterfaceProps) {
  const [currentMessage, setCurrentMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<
    Array<{
      id: string;
      name: string;
      kind: "text" | "image";
      mimeType: string;
      text?: string;
      data?: string;
      sizeBytes: number;
    }>
  >([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load chat messages
  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/messages"],
  });

  const addMessageMutation = useMutation({
    mutationFn: async (messageData: { content: string; role: string }) => {
      return apiRequest("POST", "/api/messages", messageData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  const clearMessagesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/messages");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({
        title: "Чат очищен",
        description: "Вся история сообщений удалена",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось очистить чат",
        variant: "destructive",
      });
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (chatData: ChatRequest) => {
      const response = await apiRequest("POST", `/api/chat?google=${googleMode}`, chatData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.message || `HTTP ${response.status}`);
      }
      
      return response.json() as Promise<LLMResponse>;
    },
    onSuccess: (data) => {
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const assistantMessage = data.choices[0].message.content;
        addMessageMutation.mutate({
          content: assistantMessage,
          role: "assistant",
        });
      } else {
        // Handle unexpected response format
        addMessageMutation.mutate({
          content: "Получен неожиданный формат ответа от API. Проверьте настройки модели и эндпоинта.",
          role: "assistant",
        });
      }
      setIsLoading(false);
    },
    onError: (error: any) => {
      console.error("Chat error:", error);
      
      let errorMessage = "Не удалось получить ответ от LLM";
      if (error.message) {
        if (error.message.includes("404")) {
          errorMessage = "Ошибка 404: Неверный эндпоинт API. Проверьте URL в настройках.";
        } else if (error.message.includes("401")) {
          errorMessage = "Ошибка 401: Неверный токен авторизации. Проверьте API ключ.";
        } else if (error.message.includes("403")) {
          errorMessage = "Ошибка 403: Доступ запрещен. Проверьте права доступа к API.";
        } else {
          errorMessage = `Ошибка API: ${error.message}`;
        }
      }
      
      addMessageMutation.mutate({
        content: errorMessage,
        role: "assistant",
      });
      setIsLoading(false);
      
      toast({
        title: "Ошибка отправки",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 900 * 1024;
  const MAX_IMAGE_BYTES = 512 * 1024;
  const MAX_TEXT_CHARS = 100000;
  const textEncoder = new TextEncoder();

  const readFileAsText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

  const readFileAsDataURL = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const readFileAsArrayBuffer = (file: File) =>
    new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    event.target.value = "";

    const next: typeof attachments = [];
    let totalBytes = attachments.reduce((sum, item) => sum + item.sizeBytes, 0);

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the 10MB limit.`,
          variant: "destructive",
        });
        continue;
      }

      if (totalBytes + file.size > MAX_TOTAL_BYTES) {
        toast({
          title: "Attachments too large",
          description: "Total attachment size exceeds 900KB.",
          variant: "destructive",
        });
        break;
      }

      try {
        if (file.type.startsWith("image/")) {
          if (file.size > MAX_IMAGE_BYTES) {
            toast({
              title: "Image too large",
              description: `${file.name} exceeds the 512KB limit.`,
              variant: "destructive",
            });
            continue;
          }
          const dataUrl = await readFileAsDataURL(file);
          const base64 = dataUrl.split(",")[1] ?? "";
          const payloadSize = base64.length;
          if (totalBytes + payloadSize > MAX_TOTAL_BYTES) {
            toast({
              title: "Attachments too large",
              description: "Total attachment size exceeds 900KB.",
              variant: "destructive",
            });
            continue;
          }
          next.push({
            id: crypto.randomUUID(),
            name: file.name,
            kind: "image",
            mimeType: file.type || "application/octet-stream",
            data: base64,
            sizeBytes: payloadSize,
          });
          totalBytes += payloadSize;
          continue;
        }

        const lower = file.name.toLowerCase();
        if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
          const buffer = await readFileAsArrayBuffer(file);
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheets = workbook.SheetNames.map((name) => {
            const sheet = workbook.Sheets[name];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            return `Sheet: ${name}\n${csv}`;
          });
          let text = sheets.join("\n\n");
          if (text.length > MAX_TEXT_CHARS) {
            text = `${text.slice(0, MAX_TEXT_CHARS)}\n\n[Truncated]`;
          }
          const payloadSize = textEncoder.encode(text).length;
          if (totalBytes + payloadSize > MAX_TOTAL_BYTES) {
            toast({
              title: "Attachments too large",
              description: "Total attachment size exceeds 900KB.",
              variant: "destructive",
            });
            continue;
          }
          next.push({
            id: crypto.randomUUID(),
            name: file.name,
            kind: "text",
            mimeType: "text/csv",
            text,
            sizeBytes: payloadSize,
          });
          totalBytes += payloadSize;
          continue;
        }

        const text = await readFileAsText(file);
        const normalized =
          text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n\n[Truncated]` : text;
        const payloadSize = textEncoder.encode(normalized).length;
        if (totalBytes + payloadSize > MAX_TOTAL_BYTES) {
          toast({
            title: "Attachments too large",
            description: "Total attachment size exceeds 900KB.",
            variant: "destructive",
          });
          continue;
        }
        next.push({
          id: crypto.randomUUID(),
          name: file.name,
          kind: "text",
          mimeType: file.type || "text/plain",
          text: normalized,
          sizeBytes: payloadSize,
        });
        totalBytes += payloadSize;
      } catch (error) {
        console.error("Failed to read file", error);
        toast({
          title: "Failed to read file",
          description: file.name,
          variant: "destructive",
        });
      }
    }

    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSendMessage = async () => {
    const content = currentMessage.trim();
    if (!content && attachments.length === 0) return;

    if (!config) {
      toast({
        title: "Конфигурация отсутствует",
        description: "Пожалуйста, настройте API перед отправкой сообщений",
        variant: "destructive",
      });
      return;
    }

    const attachmentSummary =
      attachments.length > 0
        ? `\n\n[Files: ${attachments.map((file) => file.name).join(", ")}]`
        : "";

    // Clear input
    setCurrentMessage("");
    setAttachments([]);
    setIsLoading(true);

    // Add user message
    addMessageMutation.mutate({
      content: `${content}${attachmentSummary}`.trim(),
      role: "user",
    });

    // Prepare conversation history
    const conversationMessages = messages.map(msg => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    // Add current message
    conversationMessages.push({
      role: "user",
      content: `${content}${attachmentSummary}`.trim(),
    });

    const trimmedMessages =
      attachments.length > 0 ? conversationMessages.slice(-6) : conversationMessages;

    // Send to LLM
    chatMutation.mutate({
      messages: trimmedMessages,
      systemPrompt: activePrompt?.content,
      attachments: attachments.map(({ id, sizeBytes, ...rest }) => rest),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    if (confirm("Очистить всю историю чата?")) {
      clearMessagesMutation.mutate();
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Reset chat when model, Google mode, or system prompt changes
  const prevModelRef = useRef<string | null>(null);
  const prevGoogleRef = useRef<boolean | null>(null);
  const prevPromptRef = useRef<number | null>(null);

  useEffect(() => {
    const prevModel = prevModelRef.current;
    const prevGoogle = prevGoogleRef.current;
    const prevPrompt = prevPromptRef.current;

    const modelChanged =
      prevModel !== null && config?.model && prevModel !== config.model;
    const googleChanged =
      prevGoogle !== null && prevGoogle !== googleMode;
    const promptChanged =
      prevPrompt !== null && activePrompt && prevPrompt !== activePrompt.id;

    if (modelChanged || googleChanged || promptChanged) {
      clearMessagesMutation.mutate();
    }

    prevModelRef.current = config?.model ?? null;
    prevGoogleRef.current = googleMode;
    prevPromptRef.current = activePrompt?.id ?? null;
  }, [config?.model, googleMode, activePrompt?.id]);

  const isConfigured = config?.token && config?.model && (googleMode || config?.endpoint);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[90%] sm:max-w-3xl px-4 py-3 rounded-2xl ${
                message.role === "user"
                  ? "bg-primary text-white rounded-br-md"
                  : "bg-card border border-border rounded-bl-md shadow-sm"
              }`}
            >
              <div className={`text-sm ${message.role === "user" ? "text-white" : "text-foreground"}`}>
                {message.role === "user" ? (
                  message.content
                ) : (
                  <div className="markdown-content">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
              </div>
              <div className={`text-xs mt-2 ${
                message.role === "user" ? "opacity-75" : "text-muted-foreground"
              }`}>
                {message.timestamp 
                  ? new Date(message.timestamp).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""
                }
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message flex justify-start">
            <div className="max-w-[90%] sm:max-w-3xl bg-card border border-border px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Печатает...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border p-3 sm:p-4 bg-card">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
          <div className="flex-1">
            <Textarea
              placeholder="Type your message..."
              rows={3}
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="resize-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
                  >
                    <span className="max-w-[180px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(file.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-row sm:flex-col gap-2 sm:items-start">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.txt,.md,.csv,.tsv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex-1 sm:flex-none px-6 py-3"
              title="Attach files"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || (!currentMessage.trim() && attachments.length === 0) || !isConfigured}
              className="flex-1 sm:flex-none px-6 py-3 bg-primary hover:bg-blue-700"
            >
              <Send className="w-5 h-5" />
            </Button>
            <Button
              onClick={handleClearChat}
              disabled={clearMessagesMutation.isPending}
              variant="secondary"
              className="flex-1 sm:flex-none px-6 py-3 bg-slate-500 hover:bg-slate-600 text-white dark:bg-slate-700"
              title="Очистить чат"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mt-3 text-xs text-muted-foreground">
          <div>
            {isLoading ? "Отправка сообщения..." : "Готов к отправке"}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span>Сообщений: {messages.length}</span>
            <span className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-1 ${
                isConfigured ? "bg-green-500" : "bg-red-500"
              }`} />
              {isConfigured ? "API настроен" : "API не настроен"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
