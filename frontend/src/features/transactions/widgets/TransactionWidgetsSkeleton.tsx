import { Card, CardContent, CardHeader, Skeleton } from "@/lib/ui";

function WidgetCardSkeleton({
  rows = 3,
  showLargeAmount = false,
}: {
  rows?: number;
  showLargeAmount?: boolean;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {showLargeAmount && <Skeleton className="h-9 w-32" />}

        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryChartSkeleton() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-44" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton className="mx-auto aspect-square max-h-[220px] w-full shrink-0 rounded-full sm:w-[40%]" />
        <div className="flex flex-1 flex-col gap-3 sm:w-[60%]">
          <Skeleton className="h-4 w-56" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SpendingBreakdownSkeleton() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <Skeleton className="h-7 w-52" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChartSkeleton() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <Skeleton className="h-[220px] w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

export function TransactionWidgetsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_2fr]">
        <WidgetCardSkeleton showLargeAmount rows={5} />
        <CategoryChartSkeleton />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SpendingBreakdownSkeleton />
        <TrendChartSkeleton />
      </div>
    </div>
  );
}
