import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Map,
  Brain,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";

import { useMotionEnabled } from "@/components/motion";
import { SPRING } from "@/lib/motion";
import { useModelMetrics } from "@/hooks/useModelMetrics";
import { fmtCompact } from "@/lib/formatters";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/insights", label: "Market Map", icon: Map },
  { to: "/predictor", label: "Price Predictor", icon: Brain },
  { to: "/about", label: "Model Report", icon: FileText },
] as const;

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  // Report the model that is actually deployed rather than a pinned figure.
  const { data: metrics } = useModelMetrics();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const enabled = useMotionEnabled();

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 border-r transition-all duration-200"
      style={{
        width: collapsed ? 60 : 240,
        background: "#0A1120",
        borderColor: "#1E2D4A",
        height: "calc(100vh - 3.5rem)",
        position: "sticky",
        top: "3.5rem",
      }}
    >
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {items.map((item, i) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={i}
              to={item.to}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${active ? "text-foreground" : "text-muted-foreground hover:bg-[#0D1526] hover:text-foreground"}`}
              title={item.label}
            >
              {/* Shared with every other item, so it slides between them. */}
              {active && (
                <motion.span
                  layoutId="sidebar-pill"
                  className="absolute inset-0 rounded-xl bg-[#111D35]"
                  transition={enabled ? { type: "spring", ...SPRING.responsive } : { duration: 0 }}
                />
              )}
              <Icon size={18} className={`relative z-10 ${active ? "text-[#3B82F6]" : ""}`} />
              {!collapsed && <span className="relative z-10 text-sm">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="m-3 p-3 rounded-xl border border-[#1E2D4A] bg-[#0D1526]">
          <div className="label-mute mb-1">Active Model</div>
          <div className="text-xs text-foreground font-medium">
            {metrics.model_name.replace("Regressor", "")}
          </div>
          <div className="text-xs text-muted-foreground">
            R² {metrics.r2.toFixed(2)} · MAE {fmtCompact(metrics.mae)}
          </div>
        </div>
      )}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center h-10 border-t border-[#1E2D4A] text-muted-foreground hover:text-foreground transition btn-press"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
