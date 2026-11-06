import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin/admin-console";
import { PortalFooter } from "@/components/portal/footer";
import { PortalHeader } from "@/components/portal/header";

export const metadata: Metadata = {
  title: "Administración",
  description:
    "Consola de administración de la Liga Metropolitana: temporadas, competencias, equipos, jugadores, roster y juegos.",
};

export default function AdminPage() {
  return (
    <>
      <PortalHeader active="admin" />
      <main>
        <AdminConsole />
      </main>
      <PortalFooter />
    </>
  );
}
