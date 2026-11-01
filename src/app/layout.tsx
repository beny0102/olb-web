import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Open League Baseball",
    template: "%s · Open League Baseball",
  },
  description:
    "Anotación, gestión de liga y visualización de juego para ligas de beisbol que no tienen presupuesto de Hawk-Eye.",
  applicationName: "Open League Baseball",
  openGraph: {
    title: "Open League Baseball",
    description: "Beisbol amateur con datos abiertos: anotación, estado en vivo y pitcheo en 3D.",
    siteName: "Open League Baseball",
    locale: "es_MX",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
