export function LoadingSkeleton({
  className = "",
  height = "h-32",
}: {
  className?: string;
  height?: string;
}) {
  return <div className={`shimmer rounded-2xl ${height} ${className}`} />;
}
