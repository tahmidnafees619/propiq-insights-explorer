import { createFileRoute } from "@tanstack/react-router";
import { Filter, BarChart3, Cpu, Code2, Database, Boxes, Github, Linkedin } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Reveal } from "@/components/motion";
import { useModelMetrics } from "@/hooks/useModelMetrics";
import { useStats } from "@/hooks/useStats";
import { fmtCurrency, fmtNumber } from "@/lib/formatters";

/** Short note explaining where each candidate model landed. */
const MODEL_NOTES: Record<string, string> = {
  LinearRegression: "Baseline; misses non-linear interactions",
  Ridge: "Regularised baseline; near-identical to plain OLS here",
  RandomForestRegressor: "Strong, but larger to serve",
  GradientBoostingRegressor: "Best balance of accuracy and latency",
};

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — PropIQ" },
      {
        name: "description",
        content: "How PropIQ predicts King County home prices: data, modeling, and architecture.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  // Every figure on this page is read from the deployed model's own report,
  // so the case study can never drift out of step with the shipped model.
  const { data: metrics } = useModelMetrics();
  const { data: stats } = useStats();

  return (
    <PageWrapper>
      <header className="mb-12 max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">PropIQ Case Study</h1>
        <p className="text-base text-muted-foreground mt-3">
          An end-to-end ML pipeline that turns {fmtNumber(stats.total_properties)} King County
          property records into accurate, explainable home-value predictions.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {["Python", "Scikit-Learn", "FastAPI", "React", "TypeScript"].map((t) => (
            <span
              key={t}
              className="text-xs px-3 py-1 rounded-full border border-[#1E2D4A] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      </header>

      <Section title="The Business Problem">
        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
          Real estate pricing is opaque. Buyers, sellers, and agents make six-figure decisions on
          rough comps and gut feel. PropIQ replaces that with a transparent ML model that quantifies{" "}
          <em>which</em> features actually drive price, by how much, and with what confidence —
          backed by tens of thousands of real transactions.
        </p>
      </Section>

      <Section title="My Approach">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              n: 1,
              title: "Data Collection & Cleaning",
              icon: Filter,
              items: [
                "Sourced 21k+ King County records",
                "Handled missing values & outliers",
                "Engineered age, ratio, geo features",
                "Stored in SQLite for fast queries",
              ],
            },
            {
              n: 2,
              title: "Exploratory Analysis",
              icon: BarChart3,
              items: [
                "Distribution & correlation analysis",
                "Feature-by-price scatter plots",
                "Seasonal trend decomposition",
                "Geo-clustering by zip",
              ],
            },
            {
              n: 3,
              title: "ML Modeling & Deployment",
              icon: Cpu,
              items: [
                "Baseline: Linear Regression",
                `Tuned: Gradient Boosting (R² ${metrics.r2.toFixed(3)})`,
                "Served via FastAPI endpoint",
                "React dashboard for live use",
              ],
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.n} className="card-surface gradient-top-border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#3B82F6] text-white text-sm font-bold flex items-center justify-center">
                    {s.n}
                  </div>
                  <Icon size={18} className="text-[#3B82F6]" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-3">{s.title}</h3>
                <ul className="space-y-1.5">
                  {s.items.map((it) => (
                    <li key={it} className="text-xs text-muted-foreground flex gap-2">
                      <span className="text-[#3B82F6]">›</span> {it}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Model Performance">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <MetricTile
            label="R² Score"
            value={metrics.r2.toFixed(3)}
            sub="On held-out sale prices"
          />
          <MetricTile
            label="Mean Abs. Error"
            value={fmtCurrency(metrics.mae)}
            sub="Average dollar miss"
          />
          <MetricTile
            label="Median Error"
            value={`${metrics.median_ape.toFixed(1)}%`}
            sub="Typical percentage miss"
          />
          <MetricTile
            label="Within ±10%"
            value={`${metrics.within_10_pct.toFixed(0)}%`}
            sub="Of homes priced closely"
          />
        </div>

        <div className="card-surface gradient-top-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-[#1E2D4A]">
                <th className="text-left p-4 font-medium text-xs uppercase tracking-wider">
                  Model
                </th>
                <th className="text-left p-4 font-medium text-xs uppercase tracking-wider">
                  R² Score
                </th>
                <th className="text-left p-4 font-medium text-xs uppercase tracking-wider">MAE</th>
                <th className="text-left p-4 font-medium text-xs uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.leaderboard.map((row, index) => {
                const best = index === 0;
                return (
                  <tr
                    key={row.model}
                    className={`border-b border-[#1E2D4A] last:border-b-0 ${best ? "bg-[#3B82F6]/10" : ""}`}
                  >
                    <td className="p-4 font-medium text-foreground">
                      {row.model}
                      {best && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-[#3B82F6] text-white">
                          BEST
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-foreground tabular-nums">{row.r2.toFixed(3)}</td>
                    <td className="p-4 text-foreground tabular-nums">{fmtCurrency(row.mae)}</td>
                    <td className="p-4 text-muted-foreground text-xs">
                      {MODEL_NOTES[row.model] ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Scored on a 20% held-out split of {fmtNumber(metrics.n_samples)} sales using{" "}
          {metrics.n_features} features. R² and MAE are reported on actual sale prices, not the
          log-transformed target the model trains on — the log-space R² is a flattering{" "}
          {metrics.r2_log.toFixed(3)}.
        </p>
      </Section>

      <Section title="Technical Architecture">
        <div className="card-surface gradient-top-border p-8">
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
            {["CSV Data", "Python Cleaning", "SQLite DB", "FastAPI", "React UI"].map(
              (step, i, arr) => (
                <div key={step} className="flex items-center gap-2 md:gap-4">
                  <div className="px-4 py-3 rounded-xl border border-[#1E2D4A] bg-[#0A1120] text-sm text-foreground font-medium hover:border-[#3B82F6] transition">
                    {step}
                  </div>
                  {i < arr.length - 1 && (
                    <svg width="20" height="12" viewBox="0 0 20 12" className="text-[#3B82F6]">
                      <path
                        d="M0 6 L18 6 M14 1 L19 6 L14 11"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      </Section>

      <Section title="Tech Stack">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { name: "Python", icon: Code2, desc: "Data pipeline & modeling", color: "#3B82F6" },
            { name: "FastAPI", icon: Boxes, desc: "Async prediction API", color: "#10B981" },
            { name: "Scikit-Learn", icon: Cpu, desc: "Gradient Boosting model", color: "#F59E0B" },
            { name: "SQLite", icon: Database, desc: "Embedded property store", color: "#3B82F6" },
            { name: "React", icon: Code2, desc: "Dashboard frontend", color: "#10B981" },
            { name: "Recharts", icon: BarChart3, desc: "Data visualization", color: "#F59E0B" },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.name} className="card-surface gradient-top-border p-5 hover-lift">
                <Icon size={22} style={{ color: t.color }} className="mb-3" />
                <div className="text-sm font-semibold text-foreground">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Developer">
        <div className="card-surface gradient-top-border p-6">
          <h3 className="text-base font-semibold text-foreground">Md. Tahmidur Rahman Nafees</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Department of Electrical and Computer Engineering, North South University
          </p>
          <p className="text-sm text-muted-foreground mt-4 max-w-2xl leading-relaxed">
            Full-stack development and machine learning implementation — the data pipeline and model
            training, interval calibration and explainability, the FastAPI service, and the React
            dashboard.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <a
              href="https://www.linkedin.com/in/md-tahmidur-rahman-nafees-04a6a3227/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-[#1E2D4A] hover:border-[#3B82F6] text-foreground transition btn-press hover-lift"
            >
              <Linkedin size={14} /> LinkedIn
            </a>
            <a
              href="https://github.com/tahmidnafees619/propiq-insights-explorer-main"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-[#1E2D4A] hover:border-[#3B82F6] text-foreground transition btn-press hover-lift"
            >
              <Github size={14} /> View on GitHub
            </a>
          </div>
        </div>
      </Section>

      <footer className="mt-16 pt-8 border-t border-[#1E2D4A] flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Built by Md. Tahmidur Rahman Nafees · King County, WA dataset
        </p>
        <a
          href="https://github.com/tahmidnafees619/propiq-insights-explorer-main"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-[#1E2D4A] hover:border-[#3B82F6] text-foreground transition btn-press hover-lift"
        >
          <Github size={14} /> View on GitHub
        </a>
      </footer>
    </PageWrapper>
  );
}

function MetricTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card-surface p-4">
      <div className="label-mute mb-1">{label}</div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal className="mb-12">
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      {children}
    </Reveal>
  );
}
