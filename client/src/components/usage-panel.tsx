import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ApiUsageEntry, ApiConfiguration } from "@shared/schema";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const USAGE_QUERY_KEY = ["/api/usage"];
const CUSTOM_CONFIGS_QUERY_KEY = ["/api/configs?google=false"];
const GOOGLE_CONFIGS_QUERY_KEY = ["/api/configs?google=true"];

type UsageRow = ApiUsageEntry & { id: string };

type ConfigResponse = { configs: ApiConfiguration[]; activeId: number | null };

type ConfigOption = { id: string; label: string };

export function UsagePanel() {
  const [selectedConfig, setSelectedConfig] = useState("all");
  const { data = [] } = useQuery<ApiUsageEntry[]>({
    queryKey: USAGE_QUERY_KEY,
  });
  const { data: customConfigs } = useQuery<ConfigResponse>({
    queryKey: CUSTOM_CONFIGS_QUERY_KEY,
  });
  const { data: googleConfigs } = useQuery<ConfigResponse>({
    queryKey: GOOGLE_CONFIGS_QUERY_KEY,
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

  const configOptions = useMemo<ConfigOption[]>(() => {
    const options: ConfigOption[] = [{ id: "all", label: "All configs" }];
    const custom = (customConfigs?.configs ?? []).map((cfg) => ({
      id: `custom:${cfg.id}`,
      label: `${cfg.name} (Custom)`,
    }));
    const google = (googleConfigs?.configs ?? []).map((cfg) => ({
      id: `google:${cfg.id}`,
      label: `${cfg.name} (Google)`,
    }));
    const hasUnknown = rows.some((row) => typeof row.configId !== "number");
    return [
      ...options,
      ...custom,
      ...google,
      ...(hasUnknown ? [{ id: "unknown", label: "Unknown config" }] : []),
    ];
  }, [customConfigs?.configs, googleConfigs?.configs, rows]);

  const filteredRows = useMemo(() => {
    if (selectedConfig === "all") return rows;
    if (selectedConfig === "unknown") {
      return rows.filter((row) => typeof row.configId !== "number");
    }
    const [scope, rawId] = selectedConfig.split(":");
    const id = Number(rawId);
    if (!Number.isFinite(id)) return rows;
    return rows.filter((row) => {
      if (row.configId !== id) return false;
      if (scope === "google") return row.useGoogle === true;
      if (scope === "custom") return row.useGoogle === false;
      return true;
    });
  }, [rows, selectedConfig]);

  if (filteredRows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No usage data yet.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>Daily usage per API key (requests and token totals).</div>
        <Select value={selectedConfig} onValueChange={setSelectedConfig}>
          <SelectTrigger className="h-8 w-56 text-xs">
            <SelectValue placeholder="Filter by config" />
          </SelectTrigger>
          <SelectContent>
            {configOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-foreground">
        <div className="col-span-2">Date</div>
        <div className="col-span-5">Key</div>
        <div className="col-span-2 text-right">Requests</div>
        <div className="col-span-3 text-right">Tokens</div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {filteredRows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-12 gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
          >
            <div className="col-span-2">{row.date}</div>
            <div className="col-span-5 truncate">
              {row.tokenLabel}
              {row.model ? ` - ${row.model}` : ""}
              {typeof row.useGoogle === "boolean"
                ? ` - ${row.useGoogle ? "Google" : "Custom"}`
                : ""}
            </div>
            <div className="col-span-2 text-right tabular-nums">{row.requests}</div>
            <div className="col-span-3 text-right tabular-nums">{row.totalTokens}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
