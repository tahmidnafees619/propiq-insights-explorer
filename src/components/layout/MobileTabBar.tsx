import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Brain, BarChart3, Info } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/predictor", label: "Predict", icon: Brain },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/about", label: "About", icon: Info },
] as const;

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 grid grid-cols-4 backdrop-blur-xl border-t"
      style={{ background: "rgba(7,13,16,0.9)", borderColor: "#28363E" }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center justify-center py-2.5 gap-1 transition ${active ? "text-[#2F99DA]" : "text-muted-foreground"}`}
          >
            <Icon size={18} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
