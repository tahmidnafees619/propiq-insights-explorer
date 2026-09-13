import { AlertCircle, RotateCw } from "lucide-react";
export function ErrorState({
  message = "Something went wrong",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="card-surface p-6 flex items-center gap-4 border-l-4"
      style={{ borderLeftColor: "#D5533F" }}
    >
      <AlertCircle className="text-red-400 shrink-0" size={22} />
      <div className="flex-1">
        <p className="text-sm text-foreground font-medium">Error loading data</p>
        <p className="text-xs text-muted-foreground mt-1">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#28363E] hover:bg-[#394B56] transition btn-press"
        >
          <RotateCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}
