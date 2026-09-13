import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-8">
      <div className="mb-6 opacity-60">{icon ?? <HouseIllustration />}</div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-2 max-w-sm">{description}</p>}
    </div>
  );
}

function HouseIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2F99DA" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#3DAE91" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <path
        d="M20 60 L60 25 L100 60 L100 100 L20 100 Z"
        stroke="url(#g1)"
        strokeWidth="2"
        fill="rgba(47,153,218,0.05)"
      />
      <rect
        x="50"
        y="70"
        width="20"
        height="30"
        stroke="#2F99DA"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <rect
        x="30"
        y="68"
        width="12"
        height="12"
        stroke="#3DAE91"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <rect
        x="78"
        y="68"
        width="12"
        height="12"
        stroke="#3DAE91"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
    </svg>
  );
}
