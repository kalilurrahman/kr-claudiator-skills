import { useEffect, useState } from "react";

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

interface HomeStatsProps {
  skillCount: number;
  categoryCount: number;
}

export function HomeStats({ skillCount, categoryCount }: HomeStatsProps) {
  const skills = useCountUp(skillCount);
  const cats = useCountUp(categoryCount);

  const pills = [
    { label: "Skills", value: skills.toLocaleString() },
    { label: "Categories", value: cats.toLocaleString() },
    { label: "", value: "Claude Code + CoWork" },
    { label: "", value: "Open Source · MIT" },
  ];

  return (
    <section className="py-6">
      <div className="container max-w-6xl mx-auto px-6">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {pills.map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-foreground"
            >
              <span className="text-gradient-brand font-bold">{p.value}</span>
              {p.label && <span className="text-muted-foreground">{p.label}</span>}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
