import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, Github } from "lucide-react";

import { useMotionEnabled } from "@/components/motion";
import { useIntro } from "@/components/intro/IntroProvider";
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
  // The title sheet ends with the wordmark dismantling into individual
  // letters; the real logo below only fades in once that has finished, so the
  // two never read as the same object competing for the same space.
  const { introActive } = useIntro();

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl border-b"
      style={{ background: "rgba(7,13,16,0.8)", borderColor: "#28363E" }}
    >
      <div className="flex items-center justify-between h-14 px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <motion.span
            className="flex items-center gap-2"
            initial={false}
            animate={{ opacity: introActive ? 0 : 1 }}
            transition={enabled ? { duration: 0.4, ease: "easeOut" } : { duration: 0 }}
          >
            <span className="text-lg font-bold tracking-tight">
              <span className="text-foreground">Prop</span>
              <span className="text-[var(--ink-500)]">IQ</span>
            </span>
            <Home size={14} className="text-[var(--ink-500)]" />
          </motion.span>
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
                    className="absolute inset-0 rounded-lg bg-[#192329]"
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
            <span className="w-2 h-2 rounded-full bg-[#3DAE91] pulse-dot" />
            Model Live
          </div>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-[#28363E] hover:border-[#2F99DA] hover:text-foreground text-muted-foreground transition btn-press hover-lift"
          >
            <Github size={14} /> GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
