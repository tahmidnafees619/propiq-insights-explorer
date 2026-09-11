import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Info } from "lucide-react";

import { FeatureImportanceChart } from "@/components/charts/FeatureImportanceChart";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ConfidenceGauge } from "@/components/predictor/ConfidenceGauge";
import { ComparableSales } from "@/components/predictor/ComparableSales";
import { FloorPlanSchematic } from "@/components/predictor/FloorPlanSchematic";
import { PredictionResult } from "@/components/predictor/PredictionResult";
import { PropertyForm } from "@/components/predictor/PropertyForm";
import { ValueBreakdown } from "@/components/predictor/ValueBreakdown";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePredict } from "@/hooks/usePredict";
import { DEFAULT_PLAN_DRAFT, toPlanInput } from "@/lib/floorplan";

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

  // The form owns its fields; it reports a draft up on every edit so the
  // schematic can redraw without lifting fifteen pieces of state.
  const [draft, setDraft] = useState(DEFAULT_PLAN_DRAFT);
  // Stable identity, or the form's effect would fire on every parent render.
  const handleDraft = useCallback(
    (next: Parameters<typeof toPlanInput>[0]) => setDraft(toPlanInput(next)),
    [],
  );

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
        <PropertyForm
          onSubmit={(input) => predict.mutate(input)}
          onDraftChange={handleDraft}
          loading={predict.isPending}
        />

        <div className="space-y-4">
          {/* Always visible: the page previews the property being configured
              rather than showing an empty frame until a result arrives. */}
          <FloorPlanSchematic draft={draft} />

          {predict.isPending && <PredictingState />}

          {/* The predictor never falls back to demo data: a fabricated price
              presented as a model output would be misleading, so failures are
              shown instead. */}
          {!predict.isPending && predict.isError && <PredictionError error={predict.error} />}

          {!predict.isPending && !predict.isError && !result && (
            <div className="card-surface flex items-center justify-center px-6 py-10">
              <EmptyState
                title="No prediction yet"
                description="Adjust the property on the left — the schematic updates as you go — then run the model for an estimate, confidence range and comparable sales."
              />
            </div>
          )}

          {!predict.isPending && result && (
            <>
              {result.extrapolated && result.notes.length > 0 && (
                <ExtrapolationNotice notes={result.notes} />
              )}
              <PredictionResult result={result} />
              <ComparableSales result={result} />
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
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#2F99DA] border-t-transparent" />
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
function PredictionError({
  error,
}: {
  error: {
    displayMessage: string;
    details: { field: string; message: string }[];
    isNetworkError: boolean;
  };
}) {
  return (
    <div className="card-surface min-h-[500px] p-6">
      <div className="flex items-start gap-3 rounded-xl border border-[#D5533F]/40 bg-[#D5533F]/10 p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#D5533F]" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {error.isNetworkError
              ? "Could not reach the model"
              : "That property could not be priced"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{error.displayMessage}</p>

          {error.details.length > 0 && (
            <ul className="mt-3 space-y-1">
              {error.details.map((detail) => (
                <li key={detail.field} className="text-xs text-muted-foreground">
                  <span className="font-mono text-[#D0A74E]">{detail.field}</span> —{" "}
                  {detail.message}
                </li>
              ))}
            </ul>
          )}

          {error.isNetworkError && (
            <p className="mt-3 text-xs text-muted-foreground">
              Start the API with{" "}
              <code className="rounded bg-[#28363E] px-1.5 py-0.5 font-mono text-[10px]">
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
    <div className="flex items-start gap-3 rounded-xl border border-[#D0A74E]/40 bg-[#D0A74E]/10 p-4">
      <Info size={16} className="mt-0.5 shrink-0 text-[#D0A74E]" />
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#D0A74E]">
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
