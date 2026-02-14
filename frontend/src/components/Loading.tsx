import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function Loading() {
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="mb-8">
          <Skeleton className="h-12 w-[480px] mb-3" />
          <Skeleton className="h-6 w-[380px]" />
        </div>

        {/* Tabs skeleton */}
        <Skeleton className="h-9 w-[260px] mb-6 rounded-lg" />

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Leaderboard skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-7 w-[280px]" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="size-10 rounded-full shrink-0" />
                  <Skeleton className="size-14 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-[160px]" />
                    <Skeleton className="h-4 w-[100px]" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-14 shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Chart skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Skeleton className="size-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-[180px]" />
                  <Skeleton className="h-4 w-[120px]" />
                </div>
                <div className="space-y-1 shrink-0">
                  <Skeleton className="h-9 w-16 ml-auto" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-[280px] w-full rounded-lg" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-[120px]" />
                    <Skeleton className="h-4 w-[60px]" />
                  </div>
                  <Skeleton className="h-2.5 w-full rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Methodology skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-9 w-[300px]" />
            <Skeleton className="h-5 w-full" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
