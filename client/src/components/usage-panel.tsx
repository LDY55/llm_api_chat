import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ApiUsageEntry } from "@shared/schema";

const USAGE_QUERY_KEY = ["/api/usage"];

type UsageRow = ApiUsageEntry & { id: string };

export function UsagePanel() {
  const { data = [] } = useQuery<ApiUsageEntry[]>({
    queryKey: USAGE_QUERY_KEY,
  });

  const rows = useMemo<UsageRow[]>(() => {
    return [...data]
      .map((entry, index) => ({
        ...entry,
        id: `${entry.date}-${entry.tokenLabel}-${index}`,
      }))
      .sort((a, b) => {
        const dateSort = b.date.localeCompare(a.date);
        if (dateSort !== 0) return dateSort;
        return b.totalTokens - a.totalTokens;
      });
  }, [data]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No usage data yet.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-6">
      <div className="text-xs text-muted-foreground">
        Daily usage per API key (requests and token totals).
      </div>
      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-foreground">
        <div className="col-span-2">Date</div>
        <div className="col-span-5">Key</div>
        <div className="col-span-2 text-right">Requests</div>
        <div className="col-span-3 text-right">Tokens</div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-12 gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
          >
            <div className="col-span-2">{row.date}</div>
            <div className="col-span-5 truncate">
              {row.tokenLabel}
              {row.model ? ` • ${row.model}` : ""}
              {typeof row.useGoogle === "boolean" ? ` • ${row.useGoogle ? "Google" : "Custom"}` : ""}
            </div>
            <div className="col-span-2 text-right tabular-nums">{row.requests}</div>
            <div className="col-span-3 text-right tabular-nums">{row.totalTokens}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
