export function SkeletonCard() {
  return (
    <div className="p-4 border border-border/50 bg-card rounded-xl animate-pulse">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-5 w-16 bg-muted rounded-full" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-2/3 bg-muted rounded" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-12 bg-muted rounded-full" />
        <div className="h-5 w-16 bg-muted rounded-full" />
        <div className="h-5 w-10 bg-muted rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
