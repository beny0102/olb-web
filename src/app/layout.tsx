import type { Metadata } from "next";
import { Barlow_Condensed, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-barlow",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

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
    <html lang="es" className={`${barlow.variable} ${hanken.variable}`}>
      <body>{children}</body>
    </html>
  );
}
