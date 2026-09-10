import { createFileRoute } from "@tanstack/react-router";
import { Waves, Trophy, MapPin } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { SeasonalTrendChart } from "@/components/charts/SeasonalTrendChart";
import { useFeatureImportance } from "@/hooks/useFeatureImportance";
import { useStats } from "@/hooks/useStats";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";
import { fmtCompact } from "@/lib/formatters";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Market Insights — PropIQ" },
      { name: "description", content: "What drives price in King County: feature importance, seasonality, and location effects." },
    ],
  }),
  component: InsightsPage,
});

/**
 * Plain-language notes on each feature.
 *
 * These describe the direction and rough magnitude of an effect; the exact
 * share the model attributes to each is rendered from live data alongside.
 */
const explanations: Record<string, string> = {
  lat: "Latitude proxies for neighbourhood. Northern King County commands a persistent premium.",
  grade: "Construction grade signals build quality, and its effect compounds at the top end.",
  sqft_living: "The strongest size signal, though price per square foot falls as homes get larger.",
  long: "Longitude separates the urban core from the eastern suburbs and rural east county.",
  sqft_living15: "The size of the 15 nearest homes captures neighbourhood character beyond raw coordinates.",
  yr_built: "Newer construction carries a premium once size and location are controlled for.",
  view: "A rated view adds meaningfully on top of base value, independent of waterfront status.",
  sqft_lot: "Lot size matters most for single-family homes outside the dense cores.",
  sqft_above: "Above-ground space is valued more highly than the equivalent basement footage.",
  sqft_lot15: "Neighbouring lot sizes distinguish dense blocks from large-parcel areas.",
  waterfront: "A strong signal, but rare - under 1% of sales - so it contributes little overall importance.",
  condition: "Maintenance condition moves price modestly next to construction grade.",
  bathrooms: "Adds value, though much of its signal is already carried by living area.",
  sqft_basement: "Finished basements add space at a discount to above-ground area.",
  bedrooms: "A weak driver once square footage is controlled for - quality beats quantity.",
  floors: "Storey count barely moves price once total area is known.",
};

function InsightsPage() {
  const { data } = useFeatureImportance();
  const { data: stats, isDemo } = useStats();
  const max = Math.max(...data.map(d => d.importance), 0.0001);

  // Derive the headline claims from live data rather than hardcoding them, so
  // they stay true when the dataset or the model changes.
  const top3Share = data.slice(0, 3).reduce((sum, f) => sum + f.importance_percent, 0);
  const locationShare = data
    .filter(f => f.feature === 'lat' || f.feature === 'long')
    .reduce((sum, f) => sum + f.importance_percent, 0);

  const grades = stats.grade_breakdown;
  const lowGrade = grades.find(g => g.grade === 7) ?? grades[0];
  const highGrade = grades.find(g => g.grade === 10) ?? grades[grades.length - 1];
  const gradeMultiple = lowGrade && highGrade ? highGrade.avg_price / lowGrade.avg_price : 0;

  return (
    <PageWrapper>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Market Insights</h1>
          <p className="text-sm text-muted-foreground mt-1">
            What actually moves real estate prices in King County. The top three drivers alone
            account for {top3Share.toFixed(0)}% of the model&apos;s predictive power.
          </p>
        </div>
        <DataSourceBadge isDemo={isDemo} />
      </div>

      <section className="mb-8">
        <div className="label-mute mb-3">Market Overview</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InsightCard
            icon={<Waves size={20} />}
            accent="blue"
            delay={0}
            headline={`Waterfront Premium: +${Math.round(stats.waterfront_premium_percent)}%`}
            body={`Waterfront homes average ${Math.round(stats.waterfront_premium_percent)}% more than inland properties, though they make up under 1% of all sales.`}
          />
          <InsightCard
            icon={<Trophy size={20} />}
            accent="green"
            delay={0.08}
            headline={`Grade Drives ${gradeMultiple.toFixed(1)}× Value`}
            body={`Moving from grade ${lowGrade?.grade ?? 7} (${fmtCompact(lowGrade?.avg_price ?? 0)}) to grade ${highGrade?.grade ?? 10} (${fmtCompact(highGrade?.avg_price ?? 0)}) multiplies the average sale price. Build quality compounds.`}
          />
          <InsightCard
            icon={<MapPin size={20} />}
            accent="amber"
            delay={0.16}
            headline={`Location = ${Math.round(locationShare)}% of Price`}
            body={`Latitude and longitude alone account for ${locationShare.toFixed(1)}% of the model's predictive power, more than any single physical attribute.`}
          />
        </div>
      </section>

      <section className="mb-8">
        <div className="label-mute mb-3">What Drives Price?</div>
        <div className="card-surface gradient-top-border p-6 space-y-3">
          {data.map((f, i) => (
            <div key={f.feature} className="grid grid-cols-12 gap-3 items-center py-2 border-b border-[#1E2D4A] last:border-b-0">
              <div className="col-span-1 text-xs font-mono text-[#3B82F6]">#{i + 1}</div>
              <div className="col-span-3 text-sm font-medium text-foreground">{f.label}</div>
              <div className="col-span-4">
                <div className="h-2 rounded-full bg-[#1E2D4A] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(f.importance / max) * 100}%`, background: i < 3 ? 'linear-gradient(90deg,#10B981,#3B82F6)' : '#3B82F6' }} />
                </div>
              </div>
              <div className="col-span-1 text-xs text-muted-foreground text-right tabular-nums">{(f.importance * 100).toFixed(1)}%</div>
              <div className="col-span-3 text-xs text-muted-foreground">{explanations[f.feature]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="label-mute mb-3">Price Heat Map by Location</div>
        <div className="card-surface gradient-top-border p-6 relative overflow-hidden" style={{ height: 360 }}>
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(30,45,74,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(30,45,74,0.4) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          {[
            { x: '20%', y: '30%', label: '47.62, -122.34' },
            { x: '55%', y: '50%', label: '47.49, -122.21' },
            { x: '75%', y: '25%', label: '47.71, -122.18' },
            { x: '40%', y: '70%', label: '47.31, -122.39' },
            { x: '85%', y: '65%', label: '47.58, -121.97' },
          ].map((p, i) => (
            <div key={i} className="absolute" style={{ left: p.x, top: p.y }}>
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-[#3B82F6] pulse-dot" style={{ boxShadow: '0 0 20px #3B82F6' }} />
                <div className="absolute top-4 left-4 text-[10px] text-muted-foreground whitespace-nowrap font-mono">{p.label}</div>
              </div>
            </div>
          ))}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-[#060B18]/80 via-transparent to-transparent">
            <div className="text-center">
              <MapPin className="mx-auto text-[#3B82F6] mb-2" size={28} />
              <p className="text-sm text-foreground font-medium">Interactive Map</p>
              <p className="text-xs text-muted-foreground">Illustrative placeholder — geographic clustering is on the roadmap</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="label-mute mb-3">Seasonal Patterns</div>
        <SeasonalTrendChart variant="full" />
      </section>
    </PageWrapper>
  );
}
