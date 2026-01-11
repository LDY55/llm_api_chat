import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2, Plus, FileText, Eye, EyeOff } from "lucide-react";
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

  const handleClearAll = () => {
    if (confirm("Очистить все заметки?")) {
      clearNotesMutation.mutate();
    }
  };

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
              {createdLabel && <span>Created: {createdLabel}</span>}
              {activeNote.summary && <span>Summary: {activeNote.summary}</span>}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {isPreview ? "Markdown preview" : "Markdown editor"}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setIsPreview((prev) => !prev)}
                aria-label={isPreview ? "Switch to editor" : "Switch to preview"}
              >
                {isPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {isPreview ? (
              <div className="markdown-content flex-1 overflow-y-auto rounded-md border border-border bg-background p-3 text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {draftContent.trim() ? draftContent : " "}
                </ReactMarkdown>
              </div>
            ) : (
              <Textarea
                placeholder="Write a note..."
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                className="flex-1 resize-none"
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
