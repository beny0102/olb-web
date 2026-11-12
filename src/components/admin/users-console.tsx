"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ADMIN_TOKEN_KEY,
  type AdminIdentity,
  type AdminMembership,
  type AdminOrganization,
  type AdminRole,
  type AdminScopeType,
  type AdminUser,
} from "@/lib/admin";
import {
  AdminApiError,
  listCompetitions,
  listOrganizations,
  listSeasons,
  listTeamSeasons,
  me,
} from "@/lib/admin-api";
import {
  ROLE_OPTIONS,
  SCOPE_TYPE_OPTIONS,
  USER_PASSWORD_MIN_LENGTH,
  createMembership,
  createUser,
  createUserPayload,
  deleteMembership,
  listMemberships,
  listUsers,
  membershipPayload,
  membershipScopeLabel,
  mergeMemberships,
  mergeUsers,
  resetUserPassword,
  roleLabel,
  teamSeasonScopeLabel,
  updateUserStatus,
  userStatusLabel,
  validateMembershipForm,
  validatePassword,
  validateUserForm,
  type CreateUserResponse,
  type MembershipDraft,
  type MembershipFormErrors,
  type MembershipFormValues,
  type ScopeNames,
  type UserFormErrors,
  type UserFormValues,
} from "@/lib/admin-users";
import type {
  LeagueCompetition,
  LeagueSeason,
  LeagueTeamSeason,
} from "@/lib/types";

type Phase = "booting" | "login" | "forbidden" | "ready";
type Message = { kind: "ok" | "error"; text: string } | null;

interface ScopeOption {
  id: string;
  label: string;
}

interface ScopeOptions {
  organization: ScopeOption[];
  competition: ScopeOption[];
  team_season: ScopeOption[];
}

interface ScopeCatalog {
  organizations: AdminOrganization[];
  seasons: LeagueSeason[];
  competitions: LeagueCompetition[];
  teamSeasons: LeagueTeamSeason[];
}

const EMPTY_CATALOG: ScopeCatalog = {
  organizations: [],
  seasons: [],
  competitions: [],
  teamSeasons: [],
};

const EMPTY_USER_FORM: UserFormValues = { name: "", email: "", password: "" };
const EMPTY_MEMBERSHIP: MembershipDraft = {
  scopeType: "organization",
  scopeId: "",
  role: "viewer",
};
const EMPTY_MEMBERSHIP_FORM: MembershipFormValues = {
  userId: "",
  scopeType: "organization",
  scopeId: "",
  role: "viewer",
};

const INPUT =
  "min-h-12 w-full min-w-0 border border-line-strong bg-raised px-3 font-body text-body-md text-ink outline-none transition-colors focus:border-band disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-ink-muted";
const LABEL = "font-label-caps text-label-caps uppercase text-ink-muted";
const BUTTON =
  "inline-flex min-h-12 items-center justify-center border-b-2 border-transparent bg-band px-6 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY =
  "inline-flex min-h-12 items-center justify-center border border-band px-6 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band transition-colors hover:bg-band hover:text-band-ink disabled:cursor-not-allowed disabled:opacity-60";
const SMALL_BUTTON =
  "inline-flex min-h-9 items-center justify-center border border-line-strong px-3 font-label-caps text-label-caps uppercase text-ink transition-colors hover:border-band disabled:cursor-not-allowed disabled:opacity-60";
const SMALL_DANGER =
  "inline-flex min-h-9 items-center justify-center border border-line-strong px-3 font-label-caps text-label-caps uppercase text-accent transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60";
const EMPTY = "font-body text-body-sm text-ink-muted";
const CREATE_MEMBERSHIP_REQUIRED =
  "Añade al menos una membresía para crear el usuario.";

function errorText(error: unknown): string {
  return error instanceof AdminApiError
    ? error.message
    : "Error inesperado. Inténtalo de nuevo.";
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
      {hint ? <span className="font-body text-body-sm text-ink-muted">{hint}</span> : null}
      {error ? (
        <p role="alert" className="font-body text-body-sm text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FormMessage({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className={
        message.kind === "ok"
          ? "border-l-4 border-band bg-surface-low px-3 py-2 font-body text-body-sm text-ink"
          : "border-l-4 border-accent bg-accent-soft px-3 py-2 font-body text-body-sm text-ink"
      }
    >
      {message.text}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-label-caps text-label-caps uppercase text-band-muted">{label}</div>
      <div className="mt-1 break-words font-tabular-stats text-tabular-stats text-band-ink">
        {value}
      </div>
    </div>
  );
}

function Card({
  testId,
  kicker,
  title,
  description,
  children,
}: {
  testId: string;
  kicker: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section data-testid={testId} className="min-w-0 border border-line-strong bg-raised">
      <div className="h-1 bg-band" />
      <div className="p-5 md:p-6">
        <span className="font-label-caps text-label-caps uppercase text-accent">{kicker}</span>
        <h2 className="mt-1 font-display text-headline-sm uppercase text-ink">{title}</h2>
        {description ? (
          <p className="mt-2 font-body text-body-sm text-ink-muted">{description}</p>
        ) : null}
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

function ScopePicker({
  idPrefix,
  value,
  options,
  errors,
  onChange,
}: {
  idPrefix: string;
  value: MembershipDraft;
  options: ScopeOptions;
  errors?: MembershipFormErrors;
  onChange: (next: MembershipDraft) => void;
}) {
  const scopes = options[value.scopeType];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Field label="Tipo de ámbito" htmlFor={`${idPrefix}-scope-type`} error={errors?.scopeType}>
        <select
          id={`${idPrefix}-scope-type`}
          value={value.scopeType}
          onChange={(event) =>
            onChange({
              ...value,
              scopeType: event.target.value as AdminScopeType,
              scopeId: "",
            })
          }
          className={INPUT}
        >
          {SCOPE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Ámbito"
        htmlFor={`${idPrefix}-scope-id`}
        error={errors?.scopeId}
        hint={scopes.length === 0 ? "No hay ámbitos cargados de este tipo." : undefined}
      >
        <select
          id={`${idPrefix}-scope-id`}
          value={value.scopeId}
          onChange={(event) => onChange({ ...value, scopeId: event.target.value })}
          className={INPUT}
        >
          <option value="">— Selecciona —</option>
          {scopes.map((scope) => (
            <option key={scope.id} value={scope.id}>
              {scope.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Rol" htmlFor={`${idPrefix}-role`} error={errors?.role}>
        <select
          id={`${idPrefix}-role`}
          value={value.role}
          onChange={(event) => onChange({ ...value, role: event.target.value as AdminRole })}
          className={INPUT}
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function SessionCard({
  mode,
  message,
}: {
  mode: "login" | "forbidden";
  message: string | null;
}) {
  const login = mode === "login";
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 md:px-8">
      <section className="border border-line-strong bg-raised">
        <div className={login ? "h-1 bg-accent" : "h-1 bg-gold"} />
        <div className="p-6 md:p-8">
          <span className="font-label-caps text-label-caps uppercase text-accent">
            {login ? "Acceso restringido" : "Acceso denegado"}
          </span>
          <h1 className="mt-1 font-display text-headline-md uppercase text-ink">Usuarios</h1>
          <p className="mt-2 font-body text-body-md text-ink-muted">
            {message ??
              (login
                ? "Necesitas una sesión de administración para gestionar usuarios y membresías."
                : "La cuenta no tiene una membresía org_admin en esta organización.")}
          </p>
          <p className="mt-3 font-body text-body-sm text-ink-muted">
            {login
              ? "Inicia sesión en la consola y vuelve a esta página."
              : "Pide acceso a la organización o usa la cuenta de administración."}
          </p>
          <Link href="/admin" className={`${BUTTON} mt-6 w-full md:w-auto`}>
            Ir a la consola
          </Link>
        </div>
      </section>
    </div>
  );
}

function CreateUserCard({
  token,
  options,
  onCreated,
  onAuthError,
}: {
  token: string;
  options: ScopeOptions;
  onCreated: (response: CreateUserResponse) => void;
  onAuthError: (message: string) => void;
}) {
  const [values, setValues] = useState<UserFormValues>(EMPTY_USER_FORM);
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [draft, setDraft] = useState<MembershipDraft>(EMPTY_MEMBERSHIP);
  const [draftErrors, setDraftErrors] = useState<MembershipFormErrors>({});
  const [drafts, setDrafts] = useState<MembershipDraft[]>([]);
  const [draftMessage, setDraftMessage] = useState<Message>(null);
  const [message, setMessage] = useState<Message>(null);
  const [pending, setPending] = useState(false);

  function update(field: keyof UserFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function addDraft() {
    const nextErrors = validateMembershipForm(draft);
    setDraftErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const duplicate = drafts.some(
      (row) =>
        row.scopeType === draft.scopeType &&
        row.scopeId === draft.scopeId &&
        row.role === draft.role,
    );
    if (duplicate) {
      setDraftMessage({ kind: "error", text: "Esa membresía ya está en la lista." });
      return;
    }
    setDrafts((current) => [...current, draft]);
    setDraft({ ...EMPTY_MEMBERSHIP, scopeType: draft.scopeType });
    setDraftErrors({});
    setDraftMessage(null);
  }

  function removeDraft(index: number) {
    setDrafts((current) => current.filter((_, position) => position !== index));
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateUserForm(values);
    setErrors(nextErrors);
    setMessage(null);
    if (Object.keys(nextErrors).length > 0) return;
    if (drafts.length === 0) return;

    setPending(true);
    try {
      const response = await createUser(token, createUserPayload(values, drafts));
      onCreated(response);
      setValues(EMPTY_USER_FORM);
      setDrafts([]);
      setDraft(EMPTY_MEMBERSHIP);
      setDraftErrors({});
      setDraftMessage(null);
      setMessage({
        kind: "ok",
        text: `Usuario creado con ${drafts.length} membresía${drafts.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onAuthError(error.message);
        return;
      }
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card
      testId="form-create-user"
      kicker="Paso 1"
      title="Crear usuario"
      description="La cuenta recibe una contraseña inicial y al menos una membresía. Sin membresía no aparecería en esta lista ni podría iniciar sesión."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre" htmlFor="user-name" error={errors.name}>
          <input
            id="user-name"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            maxLength={120}
            className={INPUT}
            placeholder="Ana Pérez"
          />
        </Field>
        <Field label="Correo" htmlFor="user-email" error={errors.email}>
          <input
            id="user-email"
            type="email"
            autoComplete="off"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            maxLength={254}
            className={INPUT}
            placeholder="ana@liga.olb"
          />
        </Field>
        <Field
          label="Contraseña inicial"
          htmlFor="user-password"
          hint={`Mínimo ${USER_PASSWORD_MIN_LENGTH} caracteres.`}
          error={errors.password}
        >
          <input
            id="user-password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) => update("password", event.target.value)}
            className={INPUT}
          />
        </Field>

        <div className="border-t border-line pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={LABEL}>Membresías iniciales</span>
            <span className="font-tabular-stats text-tabular-stats text-ink">
              {drafts.length}
            </span>
          </div>
          <p className="mt-1 font-body text-body-sm text-ink-muted">
            Añade al menos una membresía. Una cuenta sin membresía no aparece en la lista al
            recargar y no puede iniciar sesión.
          </p>
          <div className="mt-3">
            <ScopePicker
              idPrefix="create-user"
              value={draft}
              options={options}
              errors={draftErrors}
              onChange={(next) => {
                setDraft(next);
                setDraftErrors({});
                setDraftMessage(null);
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={SMALL_BUTTON} onClick={addDraft}>
              Añadir a la lista
            </button>
            <FormMessage message={draftMessage} />
          </div>

          {drafts.length > 0 ? (
            <ul className="mt-3 border-t border-line">
              {drafts.map((row, index) => (
                <li
                  key={`${row.scopeType}-${row.scopeId}-${row.role}`}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-b-0"
                >
                  <span className="font-body text-body-sm text-ink">
                    {roleLabel(row.role)} ·{" "}
                    {options[row.scopeType].find((scope) => scope.id === row.scopeId)?.label ??
                      row.scopeId}
                  </span>
                  <button
                    type="button"
                    className={SMALL_DANGER}
                    onClick={() => removeDraft(index)}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <FormMessage message={message} />
        {drafts.length === 0 ? (
          <p
            id="create-user-membership-required"
            role="status"
            className="border-l-4 border-accent bg-accent-soft px-3 py-2 font-body text-body-sm text-ink"
          >
            {CREATE_MEMBERSHIP_REQUIRED}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || drafts.length === 0}
          aria-describedby={
            drafts.length === 0 ? "create-user-membership-required" : undefined
          }
          className={`${BUTTON} w-full`}
        >
          {pending ? "Creando…" : "Crear usuario"}
        </button>
      </form>
    </Card>
  );
}

function MembershipCard({
  token,
  users,
  options,
  onCreated,
  onAuthError,
}: {
  token: string;
  users: AdminUser[];
  options: ScopeOptions;
  onCreated: (membership: AdminMembership) => void;
  onAuthError: (message: string) => void;
}) {
  const [values, setValues] = useState<MembershipFormValues>(EMPTY_MEMBERSHIP_FORM);
  const [errors, setErrors] = useState<MembershipFormErrors>({});
  const [message, setMessage] = useState<Message>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateMembershipForm(values);
    setErrors(nextErrors);
    setMessage(null);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    try {
      const membership = await createMembership(token, membershipPayload(values));
      onCreated(membership);
      setValues((current) => ({ ...current, scopeId: "" }));
      setMessage({ kind: "ok", text: "Membresía añadida." });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onAuthError(error.message);
        return;
      }
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card
      testId="form-membership"
      kicker="Paso 2"
      title="Añadir membresía"
      description="El rol se aplica al ámbito elegido. Un usuario puede acumular varios roles."
    >
      {users.length === 0 ? (
        <p className={EMPTY}>Crea un usuario antes de asignar membresías.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Usuario" htmlFor="membership-user" error={errors.userId}>
            <select
              id="membership-user"
              value={values.userId}
              onChange={(event) => {
                setValues((current) => ({ ...current, userId: event.target.value }));
                setErrors((current) => {
                  if (!("userId" in current)) return current;
                  const next = { ...current };
                  delete next.userId;
                  return next;
                });
              }}
              className={INPUT}
            >
              <option value="">— Selecciona —</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email} · {user.name}
                </option>
              ))}
            </select>
          </Field>
          <ScopePicker
            idPrefix="membership"
            value={values}
            options={options}
            errors={errors}
            onChange={(next) => {
              setValues((current) => ({ ...current, ...next }));
              setErrors((current) => {
                const remaining = { ...current };
                delete remaining.scopeType;
                delete remaining.scopeId;
                delete remaining.role;
                return remaining;
              });
            }}
          />
          <FormMessage message={message} />
          <button type="submit" disabled={pending} className={`${BUTTON} w-full`}>
            {pending ? "Añadiendo…" : "Añadir membresía"}
          </button>
        </form>
      )}
    </Card>
  );
}

function UsersTable({
  token,
  users,
  memberships,
  names,
  onUserUpdated,
  onMembershipRemoved,
  onAuthError,
}: {
  token: string;
  users: AdminUser[];
  memberships: AdminMembership[];
  names: ScopeNames;
  onUserUpdated: (user: AdminUser) => void;
  onMembershipRemoved: (membershipId: string) => void;
  onAuthError: (message: string) => void;
}) {
  const [message, setMessage] = useState<Message>(null);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);
  const [passwordPending, setPasswordPending] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AdminMembership | null>(null);
  const [removeMessage, setRemoveMessage] = useState<Message>(null);
  const [removePending, setRemovePending] = useState(false);

  const byUser = useMemo(() => {
    const map = new Map<string, AdminMembership[]>();
    for (const membership of memberships) {
      const rows = map.get(membership.userId);
      if (rows) rows.push(membership);
      else map.set(membership.userId, [membership]);
    }
    return map;
  }, [memberships]);

  const userById = useMemo(() => {
    const map = new Map<string, AdminUser>();
    for (const user of users) map.set(user.id, user);
    return map;
  }, [users]);

  function openPassword(userId: string) {
    setPasswordFor((current) => (current === userId ? null : userId));
    setPasswordValue("");
    setPasswordError(null);
    setPasswordMessage(null);
  }

  async function toggleStatus(user: AdminUser) {
    const next = user.status === "active" ? "disabled" : "active";
    setPendingUser(user.id);
    setMessage(null);
    try {
      const updated = await updateUserStatus(token, user.id, next);
      onUserUpdated(updated);
      setMessage({
        kind: "ok",
        text: `Usuario ${updated.email} ${next === "disabled" ? "deshabilitado" : "habilitado"}.`,
      });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onAuthError(error.message);
        return;
      }
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPendingUser(null);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>, user: AdminUser) {
    event.preventDefault();
    const validation = validatePassword(passwordValue);
    setPasswordError(validation);
    setPasswordMessage(null);
    if (validation) return;

    setPasswordPending(true);
    try {
      const result = await resetUserPassword(token, user.id, passwordValue);
      setPasswordValue("");
      setPasswordMessage({
        kind: "ok",
        text: `Contraseña actualizada. Sesiones revocadas: ${result.sessionsRevoked}.`,
      });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onAuthError(error.message);
        return;
      }
      setPasswordMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPasswordPending(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemovePending(true);
    setRemoveMessage(null);
    try {
      await deleteMembership(token, removeTarget.id);
      onMembershipRemoved(removeTarget.id);
      setRemoveTarget(null);
      setMessage({ kind: "ok", text: "Membresía eliminada." });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onAuthError(error.message);
        return;
      }
      setRemoveMessage({ kind: "error", text: errorText(error) });
    } finally {
      setRemovePending(false);
    }
  }

  const removeUser = removeTarget ? userById.get(removeTarget.userId) : null;

  return (
    <section data-testid="list-users" className="min-w-0 border border-line-strong bg-raised">
      <div className="h-1 bg-band" />
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="font-label-caps text-label-caps uppercase text-accent">
              Cuentas
            </span>
            <h2 className="mt-1 font-display text-headline-sm uppercase text-ink">
              Usuarios y membresías
            </h2>
            <p className="mt-2 font-body text-body-sm text-ink-muted">
              El estado deshabilita el acceso sin borrar la cuenta ni sus membresías.
            </p>
          </div>
          <span className="font-tabular-stats text-tabular-stats text-ink">{users.length}</span>
        </div>

        <div className="mt-4">
          <FormMessage message={message} />
        </div>

        {removeTarget ? (
          <div
            role="alert"
            className="mt-4 border-l-4 border-accent bg-accent-soft px-3 py-2"
          >
            <p className="font-body text-body-sm text-ink">
              ¿Quitar el rol <strong>{roleLabel(removeTarget.role)}</strong> en{" "}
              <strong>{membershipScopeLabel(removeTarget, names)}</strong>
              {removeUser ? ` de ${removeUser.email}` : ""}?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={removePending}
                className={SMALL_DANGER}
                onClick={() => void confirmRemove()}
              >
                {removePending ? "Quitando…" : "Confirmar baja"}
              </button>
              <button
                type="button"
                disabled={removePending}
                className={SMALL_BUTTON}
                onClick={() => {
                  setRemoveTarget(null);
                  setRemoveMessage(null);
                }}
              >
                Cancelar
              </button>
            </div>
            <div className="mt-2">
              <FormMessage message={removeMessage} />
            </div>
          </div>
        ) : null}

        {users.length === 0 ? (
          <p className="mt-4 font-body text-body-sm text-ink-muted">
            No hay usuarios para mostrar. Crea el primero.
          </p>
        ) : (
          <div className="mt-4 w-full overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-band bg-table-head">
                  <th className="px-3 py-2 font-label-caps text-label-caps uppercase text-ink">
                    Correo
                  </th>
                  <th className="px-3 py-2 font-label-caps text-label-caps uppercase text-ink">
                    Nombre
                  </th>
                  <th className="px-3 py-2 font-label-caps text-label-caps uppercase text-ink">
                    Estado
                  </th>
                  <th className="px-3 py-2 font-label-caps text-label-caps uppercase text-ink">
                    Membresías
                  </th>
                  <th className="px-3 py-2 font-label-caps text-label-caps uppercase text-ink">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => {
                  const rows = byUser.get(user.id) ?? [];
                  const active = user.status === "active";
                  return (
                    <Fragment key={user.id}>
                      <tr
                        data-testid={`user-row-${user.id}`}
                        className={
                          index % 2 === 0
                            ? "border-b border-line bg-raised align-top"
                            : "border-b border-line bg-table-alt align-top"
                        }
                      >
                        <td className="px-3 py-3 font-mono text-[12px] whitespace-nowrap text-ink">
                          {user.email}
                        </td>
                        <td className="px-3 py-3 font-body text-body-sm text-ink">
                          {user.name}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={
                              active
                                ? "inline-flex border border-band bg-surface-low px-2 py-0.5 font-label-caps text-label-caps uppercase text-ink"
                                : "inline-flex border border-line-strong bg-surface px-2 py-0.5 font-label-caps text-label-caps uppercase text-ink-muted"
                            }
                          >
                            {userStatusLabel(user.status)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {rows.length === 0 ? (
                            <span className="font-body text-body-sm text-accent">
                              Sin membresía · no puede iniciar sesión
                            </span>
                          ) : (
                            <ul className="space-y-1.5">
                              {rows.map((membership) => (
                                <li
                                  key={membership.id}
                                  className="flex flex-wrap items-center gap-1.5"
                                >
                                  <span className="border border-line-strong bg-raised px-1.5 py-0.5 font-label-caps text-label-caps uppercase text-ink">
                                    {roleLabel(membership.role)}
                                  </span>
                                  <span className="font-body text-body-sm text-ink-muted">
                                    {membershipScopeLabel(membership, names)}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Quitar ${roleLabel(membership.role)} en ${membershipScopeLabel(membership, names)}`}
                                    className="font-label-caps text-[10px] uppercase tracking-[0.08em] text-accent underline underline-offset-2"
                                    onClick={() => {
                                      setRemoveTarget(membership);
                                      setRemoveMessage(null);
                                    }}
                                  >
                                    Quitar
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={active ? SMALL_DANGER : SMALL_BUTTON}
                              disabled={pendingUser === user.id}
                              onClick={() => void toggleStatus(user)}
                            >
                              {active ? "Deshabilitar" : "Habilitar"}
                            </button>
                            <button
                              type="button"
                              className={SMALL_BUTTON}
                              onClick={() => openPassword(user.id)}
                            >
                              Contraseña
                            </button>
                          </div>
                        </td>
                      </tr>
                      {passwordFor === user.id ? (
                        <tr className="border-b border-line bg-surface-low">
                          <td colSpan={5} className="px-3 py-3">
                            <form
                              onSubmit={(event) => void submitPassword(event, user)}
                              className="flex flex-col gap-3 md:flex-row md:items-end"
                            >
                              <div className="w-full md:max-w-sm">
                                <Field
                                  label="Nueva contraseña"
                                  htmlFor={`password-${user.id}`}
                                  hint={`Mínimo ${USER_PASSWORD_MIN_LENGTH} caracteres. La API revoca sus sesiones.`}
                                  error={passwordError ?? undefined}
                                >
                                  <input
                                    id={`password-${user.id}`}
                                    type="password"
                                    autoComplete="new-password"
                                    value={passwordValue}
                                    onChange={(event) => setPasswordValue(event.target.value)}
                                    className={INPUT}
                                  />
                                </Field>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="submit"
                                  disabled={passwordPending}
                                  className={SMALL_BUTTON}
                                >
                                  {passwordPending ? "Guardando…" : "Cambiar contraseña"}
                                </button>
                                <button
                                  type="button"
                                  disabled={passwordPending}
                                  className={SMALL_BUTTON}
                                  onClick={() => openPassword(user.id)}
                                >
                                  Cerrar
                                </button>
                              </div>
                            </form>
                            <div className="mt-2">
                              <FormMessage message={passwordMessage} />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export function UsersConsole() {
  const [phase, setPhase] = useState<Phase>("booting");
  const [token, setToken] = useState<string | null>(null);
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [memberships, setMemberships] = useState<AdminMembership[]>([]);
  const [catalog, setCatalog] = useState<ScopeCatalog>(EMPTY_CATALOG);
  const [reloadNonce, setReloadNonce] = useState(0);

  const handleAuthError = useCallback((message: string) => {
    try {
      window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {
      // Storage can be unavailable in private mode; the session is still dropped.
    }
    setBootError(message);
    setToken(null);
    setPhase("login");
  }, []);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(ADMIN_TOKEN_KEY);
    } catch {
      stored = null;
    }
    if (!stored) {
      setPhase("login");
      return;
    }
    let cancelled = false;
    const activeToken = stored;
    me(activeToken)
      .then((current) => {
        if (cancelled) return;
        const organization = current.memberships.find(
          (membership) =>
            membership.scopeType === "organization" && membership.role === "org_admin",
        );
        setToken(activeToken);
        setIdentity(current);
        if (!organization) {
          setPhase("forbidden");
          return;
        }
        setOrganizationId(organization.scopeId);
        setPhase("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) {
          try {
            window.localStorage.removeItem(ADMIN_TOKEN_KEY);
          } catch {
            // Ignore storage failures.
          }
        }
        setBootError(errorText(error));
        setPhase("login");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "ready" || !token || !organizationId) return;
    let cancelled = false;
    setLoadError(null);
    setCatalogError(null);

    async function loadUsers() {
      try {
        const [userRows, membershipRows] = await Promise.all([
          listUsers(token as string),
          listMemberships(token as string),
        ]);
        if (cancelled) return;
        setUsers((current) => mergeUsers(current, userRows));
        setMemberships(membershipRows);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) {
          handleAuthError(error.message);
          return;
        }
        if (error instanceof AdminApiError && error.status === 403) {
          setBootError(error.message);
          setPhase("forbidden");
          return;
        }
        setLoadError(errorText(error));
      }
    }

    async function loadCatalog() {
      try {
        const organization = organizationId as string;
        const [organizations, seasons] = await Promise.all([
          listOrganizations(),
          listSeasons(organization),
        ]);
        const competitionGroups = await Promise.allSettled(
          seasons.map((season) => listCompetitions(season.id)),
        );
        const competitions = competitionGroups.flatMap((group) =>
          group.status === "fulfilled" ? group.value : [],
        );
        const teamGroups = await Promise.allSettled(
          competitions.map((competition) => listTeamSeasons(competition.id)),
        );
        const teamSeasons = teamGroups.flatMap((group) =>
          group.status === "fulfilled" ? group.value : [],
        );
        if (cancelled) return;
        setCatalog({ organizations, seasons, competitions, teamSeasons });
      } catch (error) {
        if (cancelled) return;
        setCatalogError(errorText(error));
      }
    }

    void loadUsers();
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [phase, token, organizationId, reloadNonce, handleAuthError]);

  const names = useMemo<ScopeNames>(
    () => ({
      organizations: Object.fromEntries(
        catalog.organizations.map((organization) => [organization.id, organization.name]),
      ),
      competitions: Object.fromEntries(
        catalog.competitions.map((competition) => [competition.id, competition.name]),
      ),
      teamSeasons: Object.fromEntries(
        catalog.teamSeasons.map((teamSeason) => [
          teamSeason.id,
          teamSeasonScopeLabel(teamSeason),
        ]),
      ),
    }),
    [catalog],
  );

  const options = useMemo<ScopeOptions>(() => {
    const seasonNames = Object.fromEntries(
      catalog.seasons.map((season) => [season.id, `${season.name} (${season.year})`]),
    );
    return {
      organization: catalog.organizations
        .filter((organization) => organization.id === organizationId)
        .map((organization) => ({
          id: organization.id,
          label: organization.name,
        })),
      competition: catalog.competitions.map((competition) => ({
        id: competition.id,
        label: seasonNames[competition.seasonId]
          ? `${competition.name} · ${seasonNames[competition.seasonId]}`
          : competition.name,
      })),
      team_season: catalog.teamSeasons.map((teamSeason) => ({
        id: teamSeason.id,
        label: teamSeasonScopeLabel(teamSeason),
      })),
    };
  }, [catalog, organizationId]);

  function handleUserCreated(response: CreateUserResponse) {
    setUsers((current) => mergeUsers(current, [response.user]));
    setMemberships((current) => mergeMemberships(current, response.memberships));
  }

  function handleMembershipCreated(membership: AdminMembership) {
    setMemberships((current) => mergeMemberships(current, [membership]));
  }

  if (phase === "booting") {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-16 md:px-8">
        <p className="font-body text-body-md text-ink-muted">Comprobando sesión…</p>
      </div>
    );
  }

  if (phase === "login") {
    return <SessionCard mode="login" message={bootError} />;
  }

  if (phase === "forbidden") {
    return <SessionCard mode="forbidden" message={bootError} />;
  }

  const organizationName =
    catalog.organizations.find((organization) => organization.id === organizationId)?.name ??
    organizationId ??
    "—";

  return (
    <div>
      <section className="bg-band text-band-ink">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-accent px-2 py-1 font-label-caps text-label-caps uppercase text-band-ink">
              Usuarios y permisos
            </span>
            <span className="font-label-caps text-label-caps uppercase text-band-muted">
              org_admin · {identity?.user.email}
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-display-hero-mobile uppercase sm:text-display-hero">
                Usuarios
              </h1>
              <p className="mt-4 max-w-3xl font-body text-body-md text-band-muted">
                Cuentas, estado y membresías por ámbito. Cada membresía concede un rol sobre una
                organización, una competencia o un equipo en temporada.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex min-h-12 shrink-0 items-center border border-band-muted px-4 font-label-caps text-label-caps uppercase text-band-ink transition-colors hover:border-gold"
            >
              Volver a la consola
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
            <Stat label="Usuarios" value={users.length} />
            <Stat label="Membresías" value={memberships.length} />
            <Stat label="Organización" value={organizationName} />
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
        {loadError ? (
          <div className="mb-6 border-l-4 border-accent bg-accent-soft px-4 py-3 font-body text-body-sm text-ink">
            {loadError}
          </div>
        ) : null}
        {catalogError ? (
          <div className="mb-6 border-l-4 border-gold bg-surface-low px-4 py-3 font-body text-body-sm text-ink">
            No se pudieron cargar todos los ámbitos: {catalogError} Las listas de selección
            pueden estar incompletas.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-body text-body-sm text-ink-muted">
            Los usuarios sin membresía existen, pero no pueden iniciar sesión en ningún ámbito.
          </p>
          <button
            type="button"
            className={SECONDARY}
            onClick={() => setReloadNonce((value) => value + 1)}
          >
            Actualizar listas
          </button>
        </div>

        <div className="mt-4">
          <UsersTable
            token={token as string}
            users={users}
            memberships={memberships}
            names={names}
            onUserUpdated={(updated) =>
              setUsers((current) =>
                current.map((user) => (user.id === updated.id ? updated : user)),
              )
            }
            onMembershipRemoved={(membershipId) =>
              setMemberships((current) =>
                current.filter((membership) => membership.id !== membershipId),
              )
            }
            onAuthError={handleAuthError}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <CreateUserCard
            token={token as string}
            options={options}
            onCreated={handleUserCreated}
            onAuthError={handleAuthError}
          />
          <MembershipCard
            token={token as string}
            users={users}
            options={options}
            onCreated={handleMembershipCreated}
            onAuthError={handleAuthError}
          />
        </div>
      </div>
    </div>
  );
}
