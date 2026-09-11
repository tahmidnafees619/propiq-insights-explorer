import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, Github } from "lucide-react";

import { useMotionEnabled } from "@/components/motion";
import { SPRING } from "@/lib/motion";

const links = [
  { to: "/", label: "Explorer" },
  { to: "/predictor", label: "Predictor" },
  { to: "/insights", label: "Insights" },
  { to: "/about", label: "About" },
] as const;

const REPO = "https://github.com/tahmidnafees619/propiq-insights-explorer-main";

export function Navbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const enabled = useMotionEnabled();

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl border-b"
      style={{ background: "rgba(6,11,24,0.8)", borderColor: "#1E2D4A" }}
    >
      <div className="flex items-center justify-between h-14 px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-foreground">Prop</span>
            <span className="text-[#3B82F6]">IQ</span>
          </span>
          <Home size={14} className="text-[#3B82F6]" />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`relative px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {/*
                 * One pill, shared across every tab by `layoutId`, so it
                 * travels between items instead of blinking out and in. Only
                 * ever rendered once — two elements claiming the same id would
                 * make Framer animate between them unpredictably.
                 */}
                {active && (
                  <motion.span
                    layoutId="navbar-pill"
                    className="absolute inset-0 rounded-lg bg-[#111D35]"
                    transition={
                      enabled ? { type: "spring", ...SPRING.responsive } : { duration: 0 }
                    }
                  />
                )}
                <span className="relative z-10">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-[#10B981] pulse-dot" />
            Model Live
          </div>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-[#1E2D4A] hover:border-[#3B82F6] hover:text-foreground text-muted-foreground transition btn-press hover-lift"
          >
            <Github size={14} /> GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
