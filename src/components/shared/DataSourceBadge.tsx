import { Database, FlaskConical } from 'lucide-react';

/**
 * Marks whether the page is showing live records or the bundled showcase
 * dataset.
 *
 * The demo dataset exists so the dashboard is never empty, but a viewer
 * should always be able to tell which one they are looking at, so this badge
 * is rendered wherever demo data can appear.
 */
export function DataSourceBadge({ isDemo, className = '' }: { isDemo: boolean; className?: string }) {
  const Icon = isDemo ? FlaskConical : Database;

  return (
    <span
      title={
        isDemo
          ? 'Showing the bundled demo dataset. Start the API and seed the database to see live records.'
          : 'Showing live records from the PropIQ API.'
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${
        isDemo
          ? 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B]'
          : 'border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]'
      } ${className}`}
    >
      <Icon size={11} />
      {isDemo ? 'Demo data' : 'Live data'}
    </span>
  );
}
