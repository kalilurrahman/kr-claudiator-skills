import { PERSONAS } from "@/lib/personas";

interface Props {
  onPersonaSelect: (id: string) => void;
  activeId?: string | null;
}

export function PersonaCards({ onPersonaSelect, activeId }: Props) {
  return (
    <div className="persona-grid">
      {PERSONAS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPersonaSelect(p.id)}
          className={`persona-card focus-ring ${activeId === p.id ? "persona-card-active" : ""}`}
          aria-label={`Filter skills for ${p.title}`}
        >
          <div className="persona-card-emoji" aria-hidden>
            {p.emoji}
          </div>
          <div className="persona-card-title">{p.title}</div>
          <div className="persona-card-subtitle">{p.subtitle}</div>
        </button>
      ))}
    </div>
  );
}
