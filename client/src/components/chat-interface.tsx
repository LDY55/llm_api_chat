import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Trash2, Loader2, Copy, Check, GripHorizontal } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SystemPrompt, ApiConfiguration, ChatMessage } from "@shared/schema";
import type { LLMResponse, ChatRequest } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";

interface ChatInterfaceProps {
  activePrompt: SystemPrompt | null;
  config: ApiConfiguration | null | undefined;
  googleMode: boolean;
}

const MIN_INPUT_HEIGHT = 84;
const DEFAULT_INPUT_HEIGHT = 120;
const MAX_INPUT_HEIGHT = 360;

export function ChatInterface({ activePrompt, config, googleMode }: ChatInterfaceProps) {
  const [currentMessage, setCurrentMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [inputHeight, setInputHeight] = useState(DEFAULT_INPUT_HEIGHT);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const isResizingInputRef = useRef(false);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(DEFAULT_INPUT_HEIGHT);
  
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

  const handleSendMessage = async () => {
    const content = currentMessage.trim();
    if (!content) return;

    if (!config) {
      toast({
        title: "Конфигурация отсутствует",
        description: "Пожалуйста, настройте API перед отправкой сообщений",
        variant: "destructive",
      });
      return;
    }

    // Clear input
    setCurrentMessage("");
    setIsLoading(true);

    // Add user message
    addMessageMutation.mutate({
      content,
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
      content,
    });

    // Send to LLM
    chatMutation.mutate({
      messages: conversationMessages,
      systemPrompt: activePrompt?.content,
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

  const handleCopyMessage = async (message: ChatMessage) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message.content);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = message.content;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopiedMessageId(message.id);
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopiedMessageId(null);
      }, 1500);
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy message",
        variant: "destructive",
      });
    }
  };

  const clampInputHeight = useCallback((height: number) => {
    return Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, height));
  }, []);

  const handleInputResize = useCallback((event: MouseEvent) => {
    if (!isResizingInputRef.current) return;
    const delta = resizeStartYRef.current - event.clientY;
    const nextHeight = clampInputHeight(resizeStartHeightRef.current + delta);
    setInputHeight(nextHeight);
  }, [clampInputHeight]);

  const stopInputResize = useCallback(() => {
    isResizingInputRef.current = false;
    window.removeEventListener("mousemove", handleInputResize);
    window.removeEventListener("mouseup", stopInputResize);
  }, [handleInputResize]);

  const startInputResize = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    isResizingInputRef.current = true;
    resizeStartYRef.current = event.clientY;
    resizeStartHeightRef.current = inputHeight;

    window.addEventListener("mousemove", handleInputResize);
    window.addEventListener("mouseup", stopInputResize);
  }, [handleInputResize, inputHeight, stopInputResize]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const savedHeight = window.localStorage.getItem("chat-input-height");
    if (!savedHeight) return;

    const parsedHeight = Number(savedHeight);
    if (!Number.isFinite(parsedHeight)) return;
    setInputHeight(clampInputHeight(parsedHeight));
  }, [clampInputHeight]);

  useEffect(() => {
    window.localStorage.setItem("chat-input-height", String(inputHeight));
  }, [inputHeight]);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleInputResize);
      window.removeEventListener("mouseup", stopInputResize);
    };
  }, [handleInputResize, stopInputResize]);

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
              className={`group relative max-w-[90%] sm:max-w-3xl px-4 py-3 rounded-2xl ${
                message.role === "user"
                  ? "bg-primary text-white rounded-br-md"
                  : "bg-card border border-border rounded-bl-md shadow-sm"
              }`}
            >
              <button
                type="button"
                onClick={() => handleCopyMessage(message)}
                className={`absolute right-2 top-2 rounded-md p-1.5 transition-opacity ${
                  message.role === "user"
                    ? "text-white/80 hover:text-white hover:bg-white/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                } opacity-100 sm:opacity-0 sm:group-hover:opacity-100`}
                title="Copy message"
                aria-label="Copy message"
              >
                {copiedMessageId === message.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <div
                className={`text-sm pr-8 ${
                  message.role === "user" ? "text-white" : "text-foreground"
                }`}
              >
                <div
                  className={`chat-markdown markdown-content ${
                    message.role === "user" ? "markdown-content-user" : ""
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      input: ({ checked, ...props }) => {
                        return (
                          <input
                            {...props}
                            type="checkbox"
                            disabled={false}
                            readOnly
                            defaultChecked={Boolean(checked)}
                            className="cursor-pointer"
                          />
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
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
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1">
            <div className="space-y-1.5">
              <button
                type="button"
                onMouseDown={startInputResize}
                className="flex h-4 w-full items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:text-foreground cursor-row-resize"
                title="Потяните, чтобы изменить высоту поля ввода"
                aria-label="Потяните, чтобы изменить высоту поля ввода"
              >
                <GripHorizontal className="h-3.5 w-3.5" />
              </button>

              <Textarea
                placeholder="Type your message..."
                rows={3}
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                style={{ height: `${inputHeight}px` }}
                className="resize-none overflow-y-auto focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          <div className="flex flex-row sm:flex-col gap-2 self-start">
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !currentMessage.trim() || !isConfigured}
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
