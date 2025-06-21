import { Sun, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const checked = theme === "dark";

  return (
    <div className="flex items-center space-x-2">
      <Sun className="h-4 w-4 text-slate-500" />
      <Switch
        checked={checked}
        onCheckedChange={(val) => setTheme(val ? "dark" : "light")}
        aria-label="Toggle theme"
      />
      <Moon className="h-4 w-4 text-slate-500" />
    </div>
  );
}
