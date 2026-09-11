import { createFileRoute } from "@tanstack/react-router";
import { Waves, Trophy, MapPin } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { SeasonalTrendChart } from "@/components/charts/SeasonalTrendChart";
import { PriceChoropleth } from "@/components/charts/PriceChoropleth";
import { useFeatureImportance } from "@/hooks/useFeatureImportance";
import { useStats } from "@/hooks/useStats";
import { useZipcodeStats } from "@/hooks/useZipcodeStats";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";
import { Reveal } from "@/components/motion";
import { fmtCompact } from "@/lib/formatters";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Market Insights — PropIQ" },
      {
        name: "description",
        content:
          "What drives price in King County: feature importance, seasonality, and location effects.",
      },
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
  sqft_living15:
    "The size of the 15 nearest homes captures neighbourhood character beyond raw coordinates.",
  yr_built: "Newer construction carries a premium once size and location are controlled for.",
  view: "A rated view adds meaningfully on top of base value, independent of waterfront status.",
  sqft_lot: "Lot size matters most for single-family homes outside the dense cores.",
  sqft_above: "Above-ground space is valued more highly than the equivalent basement footage.",
  sqft_lot15: "Neighbouring lot sizes distinguish dense blocks from large-parcel areas.",
  waterfront:
    "A strong signal, but rare - under 1% of sales - so it contributes little overall importance.",
  condition: "Maintenance condition moves price modestly next to construction grade.",
  bathrooms: "Adds value, though much of its signal is already carried by living area.",
  sqft_basement: "Finished basements add space at a discount to above-ground area.",
  bedrooms: "A weak driver once square footage is controlled for - quality beats quantity.",
  floors: "Storey count barely moves price once total area is known.",
};

function InsightsPage() {
  const { data } = useFeatureImportance();
  const { data: stats, isDemo } = useStats();
  const max = Math.max(...data.map((d) => d.importance), 0.0001);

  // Derive the headline claims from live data rather than hardcoding them, so
  // they stay true when the dataset or the model changes.
  const top3Share = data.slice(0, 3).reduce((sum, f) => sum + f.importance_percent, 0);
  const locationShare = data
    .filter((f) => f.feature === "lat" || f.feature === "long")
    .reduce((sum, f) => sum + f.importance_percent, 0);

  const grades = stats.grade_breakdown;
  const lowGrade = grades.find((g) => g.grade === 7) ?? grades[0];
  const highGrade = grades.find((g) => g.grade === 10) ?? grades[grades.length - 1];
  const gradeMultiple = lowGrade && highGrade ? highGrade.avg_price / lowGrade.avg_price : 0;

  // Name the extremes rather than making the reader hunt for them on the map.
  const { data: zipStats } = useZipcodeStats();
  const rankedZips = [...zipStats.zipcodes].sort((a, b) => b.median_price - a.median_price);
  const priciestZip = rankedZips[0];
  const cheapestZip = rankedZips[rankedZips.length - 1];

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

      <Reveal className="mb-8">
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
      </Reveal>

      <Reveal className="mb-8">
        <div className="label-mute mb-3">What Drives Price?</div>
        <div className="card-surface gradient-top-border p-6 space-y-3">
          {data.map((f, i) => (
            <div
              key={f.feature}
              className="grid grid-cols-12 gap-3 items-center py-2 border-b border-[#1E2D4A] last:border-b-0"
            >
              <div className="col-span-1 text-xs font-mono text-[#3B82F6]">#{i + 1}</div>
              <div className="col-span-3 text-sm font-medium text-foreground">{f.label}</div>
              <div className="col-span-4">
                <div className="h-2 rounded-full bg-[#1E2D4A] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(f.importance / max) * 100}%`,
                      background: i < 3 ? "linear-gradient(90deg,#10B981,#3B82F6)" : "#3B82F6",
                    }}
                  />
                </div>
              </div>
              <div className="col-span-1 text-xs text-muted-foreground text-right tabular-nums">
                {(f.importance * 100).toFixed(1)}%
              </div>
              <div className="col-span-3 text-xs text-muted-foreground">
                {explanations[f.feature]}
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="label-mute">Median Price by ZIP Code</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Location carries {locationShare.toFixed(0)}% of the model&apos;s predictive power.
              Hover any ZIP for its median, price per square foot, and sale count.
            </p>
          </div>
          <div className="hidden sm:block text-right text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">{priciestZip?.zipcode}</span> is the
              priciest at {fmtCompact(priciestZip?.median_price ?? 0)}
            </div>
            <div>
              <span className="font-medium text-foreground">{cheapestZip?.zipcode}</span> the most
              affordable at {fmtCompact(cheapestZip?.median_price ?? 0)}
            </div>
          </div>
        </div>
        <div className="card-surface gradient-top-border p-4 sm:p-6">
          <PriceChoropleth />
        </div>
      </Reveal>

      <Reveal>
        <div className="label-mute mb-3">Seasonal Patterns</div>
        <SeasonalTrendChart variant="full" />
      </Reveal>
    </PageWrapper>
  );
}
