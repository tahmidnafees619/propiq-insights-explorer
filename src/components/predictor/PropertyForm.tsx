import { useEffect, useMemo, useState } from "react";
import { Settings, Sparkles, Loader2 } from "lucide-react";
import type { PredictionInput } from "@/types";
import { MagneticButton } from "@/components/motion";

interface Props {
  onSubmit: (input: PredictionInput) => void;
  /**
   * Fires on every edit, not just on submit, so the schematic can redraw as
   * the property is configured.
   */
  onDraftChange?: (draft: PredictionInput) => void;
  loading?: boolean;
}

const beds = [1, 2, 3, 4, 5, 6, 7, 8];
const baths = [1, 1.5, 2, 2.5, 3, 3.5, 4];
const floors = [1, 1.5, 2, 2.5, 3];
const views = ["None", "Fair", "Average", "Good", "Excellent"];

export function PropertyForm({ onSubmit, onDraftChange, loading }: Props) {
  const [sqft, setSqft] = useState(2200);
  const [lot, setLot] = useState(7500);
  const [basement, setBasement] = useState(400);
  const [bed, setBed] = useState(3);
  const [bath, setBath] = useState(2.5);
  const [floor, setFloor] = useState(2);
  const [grade, setGrade] = useState(8);
  const [cond, setCond] = useState(3);
  const [water, setWater] = useState(false);
  const [view, setView] = useState(0);
  const [yrBuilt, setYrBuilt] = useState(1995);
  const [neighborSqft, setNeighborSqft] = useState(2100);
  const [sqftLot15, setSqftLot15] = useState(7500);
  const [lat, setLat] = useState(47.5);
  const [long, setLong] = useState(-122.2);

  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - yrBuilt);

  // The API rejects a home whose floors do not fit inside its stated living
  // area. Deriving above-ground area instead of accepting it as a free input
  // makes that class of error unreachable from the form.
  const cappedBasement = Math.min(basement, sqft);
  const above = sqft - cappedBasement;

  const gradeColor = useMemo(() => {
    if (grade <= 4) return "#D5533F";
    if (grade <= 8) return "#D0A74E";
    return "#3DAE91";
  }, [grade]);

  // One source of truth for the payload, so the schematic previews exactly
  // what submitting would send.
  const draft: PredictionInput = useMemo(
    () => ({
      sqft_living: sqft,
      sqft_lot: lot,
      sqft_above: above,
      sqft_basement: cappedBasement,
      bedrooms: bed,
      bathrooms: bath,
      floors: floor,
      grade,
      condition: cond,
      waterfront: water ? 1 : 0,
      view,
      yr_built: yrBuilt,
      sqft_living15: neighborSqft,
      sqft_lot15: sqftLot15,
      lat,
      long,
    }),
    [
      sqft,
      lot,
      above,
      cappedBasement,
      bed,
      bath,
      floor,
      grade,
      cond,
      water,
      view,
      yrBuilt,
      neighborSqft,
      sqftLot15,
      lat,
      long,
    ],
  );

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  return (
    <div
      className={`card-surface gradient-top-border p-6 transition-all duration-300 ${water ? "card-glow" : ""}`}
    >
      <div className="flex items-center gap-2 mb-6">
        <Settings size={18} className="text-[#2F99DA]" />
        <h2 className="text-base font-semibold text-foreground">Configure Property Details</h2>
      </div>

      <Section label="Size & Layout">
        <SliderRow
          label="Living Area"
          value={sqft}
          min={500}
          max={10000}
          step={50}
          onChange={setSqft}
          suffix="sqft"
        />
        <SliderRow
          label="Lot Size"
          value={lot}
          min={1000}
          max={50000}
          step={100}
          onChange={setLot}
          suffix="sqft"
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Basement sqft"
            value={cappedBasement}
            onChange={setBasement}
            min={0}
            max={sqft}
            step={50}
          />
          <ReadOnlyValue
            label="Above Ground sqft"
            value={above}
            hint="Living area minus basement"
          />
        </div>
      </Section>

      <Section label="Rooms">
        <PillRow label="Bedrooms" options={beds} value={bed} onChange={setBed} />
        <PillRow label="Bathrooms" options={baths} value={bath} onChange={setBath} />
        <PillRow label="Floors" options={floors} value={floor} onChange={setFloor} />
      </Section>

      <Section label="Quality Ratings">
        <GradientSlider
          label="Construction Grade"
          min={1}
          max={13}
          value={grade}
          onChange={setGrade}
          color={gradeColor}
          legend={["Poor", "Average", "Luxury"]}
        />
        <GradientSlider
          label="Condition"
          min={1}
          max={5}
          value={cond}
          onChange={setCond}
          color="#2F99DA"
          legend={["Poor", "OK", "Excellent"]}
        />
      </Section>

      <Section label="Features & Location">
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-sm text-foreground font-medium">Waterfront Property</div>
            <div className="text-xs text-muted-foreground">Adds significant premium</div>
          </div>
          <button
            onClick={() => setWater((w) => !w)}
            className="relative w-12 h-6 rounded-full transition"
            style={{ background: water ? "#2F99DA" : "#28363E" }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all"
              style={{ left: water ? 26 : 2 }}
            />
          </button>
        </div>
        <div>
          <div className="label-mute mb-2">View Quality</div>
          <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-[#0C1318] border border-[#28363E]">
            {views.map((v, i) => (
              <button
                key={v}
                onClick={() => setView(i)}
                className={`text-[11px] py-1.5 rounded-lg transition btn-press ${view === i ? "bg-[#2F99DA] text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="label-mute">Year Built</span>
            <span className="text-xs text-muted-foreground">
              Est. age: <span className="text-foreground font-medium">{age} years</span>
            </span>
          </div>
          <input
            type="number"
            value={yrBuilt}
            min={1900}
            max={currentYear}
            onChange={(e) => setYrBuilt(clamp(Number(e.target.value), 1900, currentYear))}
            className="w-full bg-[#0C1318] border border-[#28363E] rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#2F99DA] transition"
          />
        </div>
        <SliderRow
          label="Neighboring Avg Sqft"
          value={neighborSqft}
          min={800}
          max={6000}
          step={50}
          onChange={setNeighborSqft}
          suffix="sqft"
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Lot Size (15)"
            value={sqftLot15}
            onChange={setSqftLot15}
            min={200}
            max={2000000}
            step={100}
          />
          <NumberInput
            label="Latitude"
            value={lat}
            onChange={setLat}
            step={0.01}
            min={47}
            max={47.9}
          />
        </div>
        <NumberInput
          label="Longitude"
          value={long}
          onChange={setLong}
          step={0.01}
          min={-122.6}
          max={-121.3}
        />
      </Section>

      {/* The page's primary action, and the only magnetic control in the app. */}
      <MagneticButton
        disabled={loading}
        onClick={() => onSubmit(draft)}
        className="w-full h-14 rounded-xl font-semibold text-sm disabled:opacity-70 flex items-center justify-center gap-2 mt-4"
        /*
         * Brass appears nowhere else in the interface, which is precisely what
         * makes it read as the primary action. Dark text on brass measures
         * 8.7:1 — white would sit under 2:1 and fail outright.
         */
        style={{
          background: "linear-gradient(135deg, var(--brass-400) 0%, var(--brass-600) 100%)",
          boxShadow: "0 0 28px -8px rgba(208,167,78,0.55)",
          color: "var(--ground)",
        }}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Running ML Model...
          </>
        ) : (
          <>
            <Sparkles size={16} /> Analyze & Predict Price
          </>
        )}
      </MagneticButton>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-4 border-t border-[#28363E] first:border-t-0 space-y-4">
      <div className="label-mute">{label}</div>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium text-foreground px-2 py-0.5 rounded-md bg-[#28363E]">
          {value.toLocaleString()} {suffix}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-[#28363E] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #2F99DA, #3DAE91)" }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full -mt-2 opacity-0 h-4 cursor-pointer"
      />
    </div>
  );
}

/** Keep a value inside the range the API will accept. */
function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * A bounded number input.
 *
 * Values are clamped on change so the form can only ever submit a payload the
 * API accepts — every bound here mirrors a constraint in `PredictionInput`.
 */
function NumberInput({
  label,
  value,
  onChange,
  step,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <div className="label-mute mb-1">{label}</div>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
        className="w-full bg-[#0C1318] border border-[#28363E] rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#2F99DA] transition"
      />
    </div>
  );
}

/** A derived value shown for context but not directly editable. */
function ReadOnlyValue({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <div className="label-mute mb-1">{label}</div>
      <div
        title={hint}
        className="w-full rounded-xl border border-dashed border-[#28363E] bg-[#0C1318]/60 px-3 py-2 text-sm text-muted-foreground"
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function PillRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="label-mute mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition btn-press ${value === o ? "bg-[#2F99DA] text-white" : "bg-[#0C1318] border border-[#28363E] text-muted-foreground hover:text-foreground hover:border-[#2F99DA]"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function GradientSlider({
  label,
  value,
  min,
  max,
  onChange,
  color,
  legend,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  color: string;
  legend: string[];
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className="text-xs font-medium text-foreground px-2 py-0.5 rounded-md"
          style={{ background: `${color}22`, color }}
        >
          {value}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-[#28363E] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, #D5533F 0%, #D0A74E 50%, #3DAE91 100%)`,
          }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full -mt-2 opacity-0 h-4 cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        {legend.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}
