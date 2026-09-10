import { Link, useRouterState } from '@tanstack/react-router';
import { Home, Github } from 'lucide-react';

const links = [
  { to: '/', label: 'Explorer' },
  { to: '/predictor', label: 'Predictor' },
  { to: '/insights', label: 'Insights' },
  { to: '/about', label: 'About' },
] as const;

export function Navbar() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ background: 'rgba(6,11,24,0.8)', borderColor: '#1E2D4A' }}>
      <div className="flex items-center justify-between h-14 px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-foreground">Prop</span><span className="text-[#3B82F6]">IQ</span>
          </span>
          <Home size={14} className="text-[#3B82F6]" />
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map(l => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${active ? 'text-foreground bg-[#111D35]' : 'text-muted-foreground hover:text-foreground hover:bg-[#0D1526]'}`}
              >
                {l.label}
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
            href="https://github.com"
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
