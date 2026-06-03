import { X } from "lucide-react";

interface Props {
  personaName: string;
  onDismiss: () => void;
}

export function PersonaFilterBanner({ personaName, onDismiss }: Props) {
  return (
    <div
      className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/30 px-3 py-2"
      style={{ background: "hsl(var(--primary) / 0.1)" }}
      role="status"
    >
      <p className="text-xs font-medium" style={{ color: "hsl(var(--primary))" }}>
        Showing skills for: <span className="font-semibold">{personaName}</span>
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded p-1 transition-colors hover:bg-primary/10 focus-ring"
        style={{ color: "hsl(var(--primary))" }}
        aria-label="Clear persona filter"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
