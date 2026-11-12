import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Configuración inicial",
  description:
    "Crea la organización y la primera cuenta de administración de una instalación de Open League Baseball.",
};

export default function SetupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
