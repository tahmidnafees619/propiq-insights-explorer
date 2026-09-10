import { Link, useRouterState } from '@tanstack/react-router';
import { LayoutDashboard, Brain, BarChart3, Info } from 'lucide-react';

const items = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/predictor', label: 'Predict', icon: Brain },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/about', label: 'About', icon: Info },
] as const;

export function MobileTabBar() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 grid grid-cols-4 backdrop-blur-xl border-t" style={{ background: 'rgba(6,11,24,0.9)', borderColor: '#1E2D4A' }}>
      {items.map(item => {
        const Icon = item.icon;
        const active = pathname === item.to;
        return (
          <Link key={item.to} to={item.to} className={`flex flex-col items-center justify-center py-2.5 gap-1 transition ${active ? 'text-[#3B82F6]' : 'text-muted-foreground'}`}>
            <Icon size={18} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
