import "@/theme/tokens.css";
import "@/theme/leagues/metropolitana.css";
import "@/theme/teams.css";

export default function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-league="metropolitana" className="portal-shell min-h-dvh font-body">
      {children}
    </div>
  );
}
