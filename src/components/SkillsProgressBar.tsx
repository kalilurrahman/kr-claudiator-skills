interface ProgressBarProps {
  current: number;
  target: number;
}

export function SkillsProgressBar({ current, target }: ProgressBarProps) {
  const pct = Math.round((current / target) * 100);

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground">Claudiator Skills Progress</span>
        <span className="text-xs text-muted-foreground">{current}/{target} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full gradient-hero"
          style={{
            width: `${pct}%`,
            animation: "progressFill 1s ease-out forwards",
          }}
        />
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        New skills added at{" "}
        <a
          href="https://github.com/kalilurrahman/kr-claudiator-skills"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          github.com/kalilurrahman/kr-claudiator-skills
        </a>
      </p>
    </div>
  );
}
