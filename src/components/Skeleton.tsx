/* Loading States */
export default function Skeleton({ className = "" }) {
  return (
    <div className={`relative overflow-hidden bg-gray-200 rounded-md ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
    </div>
  );
}

