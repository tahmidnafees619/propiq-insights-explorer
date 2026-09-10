import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Info } from "lucide-react";

import { FeatureImportanceChart } from "@/components/charts/FeatureImportanceChart";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ConfidenceGauge } from "@/components/predictor/ConfidenceGauge";
import { PredictionResult } from "@/components/predictor/PredictionResult";
import { PropertyForm } from "@/components/predictor/PropertyForm";
import { ValueBreakdown } from "@/components/predictor/ValueBreakdown";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePredict } from "@/hooks/usePredict";

export const Route = createFileRoute("/predictor")({
  head: () => ({
    meta: [
      { title: "Price Predictor — PropIQ" },
      {
        name: "description",
        content: "Estimate any King County home value with the PropIQ gradient boosting model.",
      },
    ],
  }),
  component: PredictorPage,
});

function PredictorPage() {
  const predict = usePredict();
  const result = predict.data;

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Price Predictor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure a property and the model returns an estimated sale price with a calibrated
          confidence range.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PropertyForm onSubmit={(input) => predict.mutate(input)} loading={predict.isPending} />

        <div className="space-y-4">
          {predict.isPending && <PredictingState />}

          {/* The predictor never falls back to demo data: a fabricated price
              presented as a model output would be misleading, so failures are
              shown instead. */}
          {!predict.isPending && predict.isError && <PredictionError error={predict.error} />}

          {!predict.isPending && !predict.isError && !result && (
            <div className="card-surface gradient-top-border flex min-h-[500px] items-center justify-center">
              <EmptyState
                title="No prediction yet"
                description="Configure property details on the left and click Analyze to see the estimated value, confidence range, and key value drivers."
              />
            </div>
          )}

          {!predict.isPending && result && (
            <>
              {result.extrapolated && result.notes.length > 0 && (
                <ExtrapolationNotice notes={result.notes} />
              )}
              <PredictionResult result={result} />
              <ValueBreakdown result={result} />
              <FeatureImportanceChart />
              <ConfidenceGauge result={result} />
            </>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

function PredictingState() {
  return (
    <div className="card-surface flex min-h-[500px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent" />
        <p className="text-sm text-muted-foreground">Running gradient boosting model…</p>
      </div>
    </div>
  );
}

/**
 * Renders a failed prediction.
 *
 * Field-level validation messages are listed individually so the user can see
 * exactly which input the API rejected, rather than a generic failure.
 */
function PredictionError({ error }: { error: { displayMessage: string; details: { field: string; message: string }[]; isNetworkError: boolean } }) {
  return (
    <div className="card-surface min-h-[500px] p-6">
      <div className="flex items-start gap-3 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#EF4444]" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {error.isNetworkError ? "Could not reach the model" : "That property could not be priced"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{error.displayMessage}</p>

          {error.details.length > 0 && (
            <ul className="mt-3 space-y-1">
              {error.details.map((detail) => (
                <li key={detail.field} className="text-xs text-muted-foreground">
                  <span className="font-mono text-[#F59E0B]">{detail.field}</span> — {detail.message}
                </li>
              ))}
            </ul>
          )}

          {error.isNetworkError && (
            <p className="mt-3 text-xs text-muted-foreground">
              Start the API with{" "}
              <code className="rounded bg-[#1E2D4A] px-1.5 py-0.5 font-mono text-[10px]">
                uvicorn app.main:app --reload
              </code>{" "}
              in <code className="font-mono text-[10px]">propiq-backend/</code>, then try again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ExtrapolationNotice({ notes }: { notes: string[] }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4">
      <Info size={16} className="mt-0.5 shrink-0 text-[#F59E0B]" />
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#F59E0B]">
          Outside the training range
        </h3>
        {notes.map((note) => (
          <p key={note} className="mt-1 text-xs text-muted-foreground">
            {note}
          </p>
        ))}
      </div>
    </div>
  );
}
