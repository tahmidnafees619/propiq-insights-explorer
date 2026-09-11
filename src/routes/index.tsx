import { createFileRoute } from "@tanstack/react-router";
import { Cpu, Database, Target, TrendingUp } from "lucide-react";

import { BarChartBedrooms } from "@/components/charts/BarChartBedrooms";
import { GradeVsPrice } from "@/components/charts/GradeVsPrice";
import { PriceDistribution } from "@/components/charts/PriceDistribution";
import { ScatterPlot } from "@/components/charts/ScatterPlot";
import { SeasonalTrendChart } from "@/components/charts/SeasonalTrendChart";
import { KPICard } from "@/components/dashboard/KPICard";
import { PropertyTable } from "@/components/dashboard/PropertyTable";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";
import { useStats } from "@/hooks/useStats";
import { fmtCompact, fmtCurrency, fmtNumber } from "@/lib/formatters";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PropIQ" },
      {
        name: "description",
        content: "Real-time market intelligence across 21k+ King County properties.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats, isDemo } = useStats();

  // MAE is the model's average dollar error; expressing it against the
  // average sale price is what makes the number meaningful.
  const errorShare = stats.avg_price > 0 ? (stats.mae / stats.avg_price) * 100 : 0;

  return (
    <PageWrapper>
      <Reveal className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Market Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            King County, WA · {fmtNumber(stats.total_properties)} property sales analysed
          </p>
        </div>
        <DataSourceBadge isDemo={isDemo} />
      </Reveal>

      <Stagger className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <KPICard
            label="Properties Analysed"
            value={stats.total_properties}
            sub="King County sale records"
            icon={Database}
            accent="blue"
            format={(n) => fmtNumber(Math.round(n))}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Average Sale Price"
            value={stats.avg_price}
            sub={`Median ${fmtCompact(stats.median_price)}`}
            icon={TrendingUp}
            accent="green"
            format={(n) => fmtCurrency(n)}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Model R² Score"
            value={stats.model_r2 * 100}
            sub="Gradient boosting, held-out test set"
            icon={Cpu}
            accent="blue"
            format={(n) => `${n.toFixed(1)}%`}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Avg Prediction Error"
            value={stats.mae}
            sub={`±${errorShare.toFixed(1)}% of average home value`}
            icon={Target}
            accent="amber"
            format={(n) => fmtCurrency(n)}
          />
        </StaggerItem>
      </Stagger>

      <Reveal className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ScatterPlot />
        </div>
        <div className="lg:col-span-2">
          <BarChartBedrooms />
        </div>
      </Reveal>

      <Reveal className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PriceDistribution />
        <SeasonalTrendChart variant="mini" />
        <GradeVsPrice />
      </Reveal>

      <Reveal>
        <PropertyTable />
      </Reveal>
    </PageWrapper>
  );
}
