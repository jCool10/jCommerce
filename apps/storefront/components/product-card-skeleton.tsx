// Skeleton placeholder matching ProductCard shape — shimmer driven by Tailwind
// custom keyframe (`animate-shimmer`) already defined in tailwind.config.
export function ProductCardSkeleton(): JSX.Element {
  return (
    <div
      className="flex flex-col rounded-md border border-border bg-bg"
      aria-hidden="true"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-t-md bg-muted">
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-bg/50 to-transparent" />
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="h-4 w-3/4 rounded-sm bg-muted" />
        <div className="h-4 w-1/2 rounded-sm bg-muted" />
        <div className="mt-2 h-6 w-1/3 rounded-sm bg-muted" />
      </div>
    </div>
  );
}

interface ProductGridSkeletonProps {
  count?: number;
}

export function ProductGridSkeleton({
  count = 8,
}: ProductGridSkeletonProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
