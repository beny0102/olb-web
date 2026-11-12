import type { Metadata } from "next";
import { UsersConsole } from "@/components/admin/users-console";
import { PortalFooter } from "@/components/portal/footer";
import { PortalHeader } from "@/components/portal/header";

export const metadata: Metadata = {
  title: "Usuarios",
  description:
    "Administración de usuarios y membresías de la liga: cuentas, estado, roles y ámbitos de acceso.",
};

export default function AdminUsersPage() {
  return (
    <>
      <PortalHeader active="admin" />
      <main>
        <UsersConsole />
      </main>
      <PortalFooter />
    </>
  );
}
