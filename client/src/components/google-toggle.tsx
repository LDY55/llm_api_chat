import { Switch } from "@/components/ui/switch";

interface GoogleToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
}

export function GoogleToggle({ checked, onChange }: GoogleToggleProps) {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-xs text-muted-foreground">Google</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label="Toggle Google" />
    </div>
  );
}
