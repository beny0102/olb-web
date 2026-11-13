import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/scorer/auth-provider";
import { ScoreOfflineNotice } from "@/components/score/offline-notice";
import { ScorePwaRegister } from "@/components/score/pwa-register";
import { SCORE_MANIFEST_PATH } from "@/lib/score";

export const metadata: Metadata = {
  title: {
    default: "Anotador",
    template: "%s · Anotador OLB",
  },
  description: "Anotador local de Open League Baseball.",
  applicationName: "OLB Scorer",
  manifest: SCORE_MANIFEST_PATH,
};

export const viewport: Viewport = {
  themeColor: "#111b31",
};

/**
 * Scorer routes keep their own chrome (ScorerShell) and never render the
 * portal header or footer. The auth provider and the PWA worker only mount
 * inside `/score`.
 */
export default function ScoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-league="metropolitana" className="portal-shell min-h-dvh font-body">
      <ScoreOfflineNotice />
      <AuthProvider>{children}</AuthProvider>
      <ScorePwaRegister />
    </div>
  );
}
