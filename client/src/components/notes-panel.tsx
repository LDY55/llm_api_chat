import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Trash2,
  Plus,
  FileText,
  Eye,
  EyeOff,
  Bold,
  Italic,
  Sparkles,
  Languages,
  HelpCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Note } from "@shared/schema";

const NOTES_QUERY_KEY = ["/api/notes"];

export function NotesPanel() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [translation, setTranslation] = useState("");
  const [explanation, setExplanation] = useState("");
  const [bubble, setBubble] = useState<{
    content: string;
    x: number;
    y: number;
    open: boolean;
  }>({ content: "", x: 0, y: 0, open: false });
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<{ text: string; rect: DOMRect } | null>(null);

  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: NOTES_QUERY_KEY,
  });

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeId) ?? null,
    [notes, activeId]
  );

  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter((note) => {
      const haystack = [note.title, note.content, note.summary ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [notes, searchQuery]);

  const createdLabel = useMemo(() => {
    if (!activeNote) return "";
    const date = new Date(activeNote.createdAt);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }, [activeNote]);

  const createNoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notes", { content: "" });
      return (await res.json()) as Note;
    },
    onSuccess: (note) => {
      queryClient.setQueryData<Note[]>(NOTES_QUERY_KEY, (prev) => [
        note,
        ...(prev ?? []),
      ]);
      setActiveId(note.id);
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const res = await apiRequest("PUT", `/api/notes/${id}`, { content });
      return (await res.json()) as Note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Note[]>(NOTES_QUERY_KEY, (prev) =>
        (prev ?? []).filter((note) => note.id !== id)
      );
    },
  });

  const clearNotesMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/notes");
    },
    onSuccess: () => {
      queryClient.setQueryData<Note[]>(NOTES_QUERY_KEY, []);
      setActiveId(null);
      setDraftContent("");
    },
  });

  const fixTextMutation = useMutation({
    mutationFn: async () => {
      if (!draftContent.trim()) return "";
      const response = await apiRequest("POST", "/api/chat?google=true", {
        messages: [{ role: "user", content: draftContent }],
        systemPrompt:
          "Исправь орфографию и пунктуацию. Сохрани markdown и форматирование. " +
          "Не меняй смысл. Верни только исправленный текст без объяснений.",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content?.trim() ?? "";
    },
    onSuccess: (content) => {
      if (content) {
        setDraftContent(content);
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Ошибка LLM: ${message}`);
    },
  });

  const getSelectionText = () => {
    const textarea = textareaRef.current;
    if (!textarea) return "";
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    if (start === end) return "";
    return draftContent.slice(start, end).trim();
  };

  const getTextareaSelectionRect = () => {
    const textarea = textareaRef.current;
    if (!textarea) return null;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    if (start === end) return null;
    const areaRect = textarea.getBoundingClientRect();
    const style = window.getComputedStyle(textarea);
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.visibility = "hidden";
    div.style.whiteSpace = "pre-wrap";
    div.style.wordWrap = "break-word";
    div.style.font = style.font;
    div.style.lineHeight = style.lineHeight;
    div.style.padding = style.padding;
    div.style.border = style.border;
    div.style.boxSizing = style.boxSizing;
    div.style.width = style.width;
    div.style.letterSpacing = style.letterSpacing;
    div.style.textTransform = style.textTransform;
    div.style.textIndent = style.textIndent;
    div.style.textAlign = style.textAlign;
    div.style.minHeight = style.height;
    div.style.left = `${areaRect.left}px`;
    div.style.top = `${areaRect.top}px`;
    div.style.overflow = "hidden";
    div.textContent = draftContent.slice(0, end);
    const span = document.createElement("span");
    span.textContent = "\u200b";
    div.appendChild(span);
    document.body.appendChild(div);
    div.scrollTop = textarea.scrollTop;
    div.scrollLeft = textarea.scrollLeft;
    const rect = span.getBoundingClientRect();
    document.body.removeChild(div);
    if (!rect) return null;
    return rect;
  };

  const getSelectionInfo = () => {
    if (isPreview) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      const range = selection.getRangeAt(0);
      const text = selection.toString().trim();
      if (!text) return null;
      const container = previewRef.current;
      if (container && !container.contains(range.commonAncestorContainer)) return null;
      const rect = range.getBoundingClientRect();
      return { text, rect };
    }
    const text = getSelectionText();
    if (!text) return null;
    const rect = getTextareaSelectionRect();
    return rect ? { text, rect } : null;
  };

  const getSelectionPayload = () => getSelectionInfo() ?? selectionRef.current;

  const updateSelectionCache = () => {
    const info = getSelectionInfo();
    if (info) {
      selectionRef.current = info;
    }
  };

  const showBubble = (content: string, rect: DOMRect) => {
    const x = Math.max(12, Math.min(rect.left, window.innerWidth - 280));
    const y = Math.min(rect.bottom + 8, window.innerHeight - 80);
    setBubble({ content, x, y, open: true });
  };

  const translateSelectionMutation = useMutation({
    mutationFn: async () => {
      const selection = getSelectionPayload();
      if (!selection) return { text: "", rect: null as DOMRect | null };
      const text = selection.text;
      const rect = selection.rect;
      const response = await apiRequest("POST", "/api/chat?google=true", {
        messages: [{ role: "user", content: text }],
        systemPrompt:
          "Переведи текст на русский язык. Сохрани смысл. Верни только перевод.",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return {
        text: data.choices?.[0]?.message?.content?.trim() ?? "",
        rect,
      };
    },
    onSuccess: (result) => {
      if (!result.text || !result.rect) return;
      setTranslation(result.text);
      showBubble(result.text, result.rect);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Ошибка LLM: ${message}`);
    },
  });

  const explainSelectionMutation = useMutation({
    mutationFn: async () => {
      const selection = getSelectionPayload();
      if (!selection) return { text: "", rect: null as DOMRect | null };
      const text = selection.text;
      const rect = selection.rect;
      const isSingleWord = !/\s/.test(text.trim());
      const isAbbreviation = /^[A-ZА-ЯЁ]{2,}$/.test(text.trim()) || /^(?:[A-ZА-ЯЁ]\.){2,}$/.test(text.trim());
      const systemPrompt = isSingleWord
        ? isAbbreviation
          ? "Дай краткие варианты расшифровки аббревиатуры. Верни только список вариантов."
          : "Дай краткое определение одного слова. Верни только определение."
        : "Кратко поясни выделенный фрагмент простыми словами. Не меняй смысл. Верни только пояснение.";
      const response = await apiRequest("POST", "/api/chat?google=true", {
        messages: [{ role: "user", content: text }],
        systemPrompt,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return {
        text: data.choices?.[0]?.message?.content?.trim() ?? "",
        rect,
      };
    },
    onSuccess: (result) => {
      if (!result.text || !result.rect) return;
      setExplanation(result.text);
      showBubble(result.text, result.rect);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Ошибка LLM: ${message}`);
    },
  });

  useEffect(() => {
    if (!activeId && notes.length > 0) {
      setActiveId(notes[0].id);
    }
  }, [activeId, notes]);

  useEffect(() => {
    if (activeNote) {
      setDraftContent(activeNote.content);
    } else {
      setDraftContent("");
    }
  }, [activeNote?.id]);

  useEffect(() => {
    if (!activeNote) return;
    if (draftContent === activeNote.content) return;
    const handle = setTimeout(() => {
      updateNoteMutation.mutate({ id: activeNote.id, content: draftContent });
    }, 400);
    return () => clearTimeout(handle);
  }, [draftContent, activeNote, updateNoteMutation]);

  const handleDelete = (id: number) => {
    deleteNoteMutation.mutate(id);
    if (activeId === id) {
      const remaining = notes.filter((note) => note.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
  };

  const applyInlineWrapper = (wrapper: string) => {
    const apply = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? 0;
      const before = draftContent.slice(0, start);
      const selection = draftContent.slice(start, end);
      const after = draftContent.slice(end);
      const next = `${before}${wrapper}${selection}${wrapper}${after}`;
      setDraftContent(next);
      requestAnimationFrame(() => {
        textarea.focus();
        const cursor = start + wrapper.length;
        const cursorEnd = end + wrapper.length;
        textarea.setSelectionRange(cursor, cursorEnd);
      });
    };

    if (isPreview) {
      setIsPreview(false);
      setTimeout(apply, 0);
    } else {
      apply();
    }
  };

  const toggleCheckboxByIndex = (checkboxIndex: number, checked: boolean) => {
    setDraftContent((prev) => {
      const parts = prev.split("\n");
      let count = -1;
      let changed = false;
      const pattern = /\[( |x|X)\]/g;
      const nextParts = parts.map((line) => {
        if (changed) return line;
        let lineChanged = false;
        const nextLine = line.replace(pattern, (match) => {
          count += 1;
          if (count === checkboxIndex) {
            lineChanged = true;
            return checked ? "[x]" : "[ ]";
          }
          return match;
        });
        if (lineChanged) changed = true;
        return nextLine;
      });
      return changed ? nextParts.join("\n") : prev;
    });
  };

  const handlePreviewClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target || target.tagName !== "INPUT") return;
    const input = target as HTMLInputElement;
    if (input.type !== "checkbox") return;
    event.preventDefault();
    event.stopPropagation();
    const container = previewRef.current;
    if (!container) return;
    const checkboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    );
    const index = checkboxes.indexOf(input);
    if (index < 0) return;
    toggleCheckboxByIndex(index, !input.checked);
  };

  const handleClearAll = () => {
    if (confirm("Очистить все заметки?")) {
      clearNotesMutation.mutate();
    }
  };

  useEffect(() => {
    if (!bubble.open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (bubbleRef.current && target && bubbleRef.current.contains(target)) {
        return;
      }
      setBubble((prev) => ({ ...prev, open: false }));
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [bubble.open]);

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      <aside className="flex w-64 flex-col border-r border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">Заметки (JSON)</div>
          <Button
            type="button"
            size="sm"
            onClick={() => createNoteMutation.mutate()}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Новая
          </Button>
        </div>
        <div className="mt-3">
          <Input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
          {filteredNotes.length === 0 && (
            <div className="text-xs text-muted-foreground">Пока нет заметок</div>
          )}
          {filteredNotes.map((note) => {
            const content = (
              <button
                type="button"
                onClick={() => setActiveId(note.id)}
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                  note.id === activeId
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-4 w-4" />
                <div className="flex-1 truncate">{note.title}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDelete(note.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </button>
            );

            if (!note.summary) {
              return (
                <div key={note.id}>
                  {content}
                </div>
              );
            }

            return (
              <Tooltip key={note.id}>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs leading-snug">
                  {note.summary}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {notes.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleClearAll}
            className="mt-3 w-full gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Очистить все
          </Button>
        )}
      </aside>
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-6">
        <div className="text-xs text-muted-foreground">
          Автосохранение в файле проекта (notes.json)
        </div>
        {activeNote ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsPreview((prev) => !prev)}
                    aria-label={isPreview ? "Switch to editor" : "Switch to preview"}
                  >
                    {isPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isPreview ? "Редактирование" : "Предпросмотр"}
                </TooltipContent>
              </Tooltip>
              {createdLabel && <span>Created: {createdLabel}</span>}
              {activeNote.summary && <span>Summary: {activeNote.summary}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={() => applyInlineWrapper("**")}
                    aria-label="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Жирный</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={() => applyInlineWrapper("*")}
                    aria-label="Italic"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Каллиграфия</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={() => {
                      if (isPreview) setIsPreview(false);
                      fixTextMutation.mutate();
                    }}
                    disabled={fixTextMutation.isPending}
                    aria-label="Fix punctuation"
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Исправить</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={() => {
                      const selection = getSelectionPayload();
                      if (!selection) {
                        alert("Выделите текст для перевода.");
                        return;
                      }
                      translateSelectionMutation.mutate();
                    }}
                    disabled={translateSelectionMutation.isPending}
                    aria-label="Translate to Russian"
                  >
                    <Languages className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Перевести</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={() => {
                      const selection = getSelectionPayload();
                      if (!selection) {
                        alert("Выделите текст для пояснения.");
                        return;
                      }
                      explainSelectionMutation.mutate();
                    }}
                    disabled={explainSelectionMutation.isPending}
                    aria-label="Explain selection"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Пояснить</TooltipContent>
              </Tooltip>
            </div>
            {bubble.open && (
              <div
                ref={bubbleRef}
                className="fixed z-50 max-w-xs rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md"
                style={{ left: bubble.x, top: bubble.y }}
              >
                <div className="whitespace-pre-wrap">{bubble.content}</div>
                <button
                  type="button"
                  className="mt-2 text-[10px] text-muted-foreground underline"
                  onClick={() => setBubble((prev) => ({ ...prev, open: false }))}
                >
                  Закрыть
                </button>
              </div>
            )}
            {isPreview ? (
              <div
                ref={previewRef}
                onClick={handlePreviewClick}
                onMouseUp={updateSelectionCache}
                onKeyUp={updateSelectionCache}
                className="markdown-content flex-1 overflow-y-auto rounded-md border border-border bg-background p-3 text-sm"
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
                  {draftContent.trim() ? draftContent : " "}
                </ReactMarkdown>
              </div>
            ) : (
              <Textarea
                placeholder="Write a note..."
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                className="flex-1 resize-none"
                ref={textareaRef}
                onMouseUp={updateSelectionCache}
                onKeyUp={updateSelectionCache}
              />
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Создайте заметку слева
          </div>
        )}
      </div>
    </div>
  );
}
