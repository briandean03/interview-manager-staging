import Skeleton from "./Skeleton";

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col space-y-4"
          >
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <Skeleton className="h-20 w-full rounded-xl" />

      {/* Calendar */}
      <Skeleton className="h-72 w-full rounded-xl" />

    </div>
  );
}
