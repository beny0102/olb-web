"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import {
  AdminApiError,
  exportLeague,
  importLeague,
} from "@/lib/admin-api";
import {
  bundleSummaryRows,
  exportLeagueErrorMessage,
  formatFileSize,
  importConflicts,
  importDiffRows,
  importLeagueErrorMessage,
  importPayloadCode,
  leagueBundleMetadata,
  parseLeagueBundleText,
  type LeagueBundle,
  type LeagueImportConflict,
  type LeagueImportResult,
} from "@/lib/admin-transfer";
import type { LeagueSeason } from "@/lib/types";

type Message = { kind: "ok" | "error"; text: string } | null;

const INPUT =
  "min-h-12 w-full border border-line-strong bg-raised px-3 font-body text-body-md text-ink outline-none transition-colors focus:border-band disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-ink-muted";
const LABEL = "font-label-caps text-label-caps uppercase text-ink-muted";
const BUTTON =
  "min-h-12 border-b-2 border-transparent bg-band px-6 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY =
  "min-h-12 border border-line-strong bg-raised px-4 font-label-caps text-label-caps uppercase text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60";
const CELL = "border-b border-line px-3 py-2 text-left font-body text-body-sm text-ink";
const HEAD =
  "border-b border-line-strong px-3 py-2 text-left font-label-caps text-label-caps uppercase text-ink-muted";
const TABLE_WRAP = "mt-4 overflow-x-auto";

function formatTimestamp(value: string): string {
  if (value.length === 0) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function errorStatus(error: unknown): number {
  return error instanceof AdminApiError ? error.status : -1;
}

function MessageLine({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={`mt-4 border-l-4 px-3 py-2 font-body text-body-sm ${
        message.kind === "ok"
          ? "border-gold bg-surface-low text-ink"
          : "border-accent bg-accent-soft text-ink"
      }`}
    >
      {message.text}
    </div>
  );
}

function ConflictList({ conflicts }: { conflicts: LeagueImportConflict[] }) {
  if (conflicts.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="font-label-caps text-label-caps uppercase text-accent">
        Conflictos ({conflicts.length})
      </h4>
      <ul className="mt-2 divide-y divide-line border border-line-strong">
        {conflicts.map((conflict, index) => (
          <li key={`${conflict.entity}-${conflict.id}-${index}`} className="px-3 py-2">
            <span className="font-label-caps text-label-caps uppercase text-ink-muted">
              {conflict.entity}
            </span>
            <p className="font-body text-body-sm text-ink">
              {conflict.message || conflict.key || conflict.id}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiffTable({
  result,
  title,
}: {
  result: LeagueImportResult;
  title: string;
}) {
  return (
    <div className="mt-4">
      <h4 className="font-display text-headline-sm uppercase text-ink">{title}</h4>
      <div className={TABLE_WRAP}>
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr>
              <th className={HEAD}>Entidad</th>
              <th className={HEAD}>Creados</th>
              <th className={HEAD}>Actualizados</th>
              <th className={HEAD}>Sin cambios</th>
            </tr>
          </thead>
          <tbody>
            {importDiffRows(result).map((row) => (
              <tr key={row.key}>
                <td className={CELL}>{row.label}</td>
                <td className={CELL}>{row.created}</td>
                <td className={CELL}>{row.updated}</td>
                <td className={CELL}>{row.unchanged}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.warnings.length > 0 ? (
        <ul className="mt-3 list-disc border-l-4 border-gold bg-surface-low px-6 py-3 font-body text-body-sm text-ink">
          {result.warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function TransferPanel({
  token,
  organizationSlug,
  seasons,
  selectedSeasonId,
  onImported,
}: {
  token: string;
  organizationSlug: string;
  seasons: LeagueSeason[];
  selectedSeasonId: string | null;
  onImported: () => Promise<void> | void;
}) {
  const [exportSeasonId, setExportSeasonId] = useState(selectedSeasonId ?? "");
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<Message>(null);
  const [exportInfo, setExportInfo] = useState<{
    fileName: string;
    bytes: number;
    summary: ReturnType<typeof leagueBundleMetadata>["summary"];
  } | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [bundle, setBundle] = useState<LeagueBundle | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<LeagueImportResult | null>(null);
  const [applied, setApplied] = useState<LeagueImportResult | null>(null);
  const [serverConflicts, setServerConflicts] = useState<LeagueImportConflict[]>([]);
  const [importMessage, setImportMessage] = useState<Message>(null);
  const [pending, setPending] = useState<"preview" | "apply" | null>(null);

  useEffect(() => {
    setExportSeasonId(selectedSeasonId ?? "");
  }, [selectedSeasonId]);

  async function handleExport() {
    setExporting(true);
    setExportMessage(null);
    try {
      const result = await exportLeague(token, exportSeasonId || null);
      const blob = new Blob([result.content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportInfo({
        fileName: result.fileName,
        bytes: result.bytes,
        summary: leagueBundleMetadata(result.bundle).summary,
      });
      setExportMessage({ kind: "ok", text: `Liga exportada: ${result.fileName}.` });
    } catch (error) {
      setExportMessage({
        kind: "error",
        text:
          error instanceof AdminApiError
            ? exportLeagueErrorMessage(error.status)
            : "No se pudo exportar la liga. Inténtalo de nuevo.",
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setBundle(null);
    setParseError(null);
    setPreview(null);
    setApplied(null);
    setServerConflicts([]);
    setImportMessage(null);

    try {
      const text = await file.text();
      const parsed = parseLeagueBundleText(text);
      setBundle(parsed.bundle);
      setParseError(parsed.error);
    } catch {
      setBundle(null);
      setParseError("No se pudo leer el archivo seleccionado.");
    }
  }

  function handleImportError(error: unknown) {
    const status = errorStatus(error);
    const detail = error instanceof AdminApiError ? error.detail : null;
    const code = error instanceof AdminApiError ? importPayloadCode(error.payload) : null;
    const metadata = bundle ? leagueBundleMetadata(bundle) : null;
    setServerConflicts(
      error instanceof AdminApiError ? importConflicts(error.payload) : [],
    );
    setImportMessage({
      kind: "error",
      text:
        error instanceof AdminApiError
          ? importLeagueErrorMessage(
              { status, code, detail },
              {
                organizationSlug: organizationSlug || "esta organización",
                bundleSlug: metadata?.organizationSlug ?? null,
              },
            )
          : "No se pudo importar la liga. Inténtalo de nuevo.",
    });
  }

  async function handlePreview() {
    if (!bundle) return;
    setPending("preview");
    setImportMessage(null);
    setApplied(null);
    setServerConflicts([]);
    try {
      const result = await importLeague(token, bundle, true);
      setPreview(result);
      setImportMessage(
        result.conflicts.length > 0
          ? {
              kind: "error",
              text: `Previsualización con ${result.conflicts.length} conflicto(s). Corrige el paquete antes de aplicar.`,
            }
          : { kind: "ok", text: "Previsualización lista: sin conflictos." },
      );
    } catch (error) {
      setPreview(null);
      handleImportError(error);
    } finally {
      setPending(null);
    }
  }

  async function handleApply() {
    if (!bundle || !preview || preview.conflicts.length > 0 || serverConflicts.length > 0) {
      return;
    }
    setPending("apply");
    setImportMessage(null);
    try {
      const result = await importLeague(token, bundle, false);
      setApplied(result);
      setPreview(result);
      setServerConflicts([]);
      setImportMessage({ kind: "ok", text: "Liga importada correctamente." });
      await onImported();
    } catch (error) {
      handleImportError(error);
    } finally {
      setPending(null);
    }
  }

  const metadata = bundle ? leagueBundleMetadata(bundle) : null;
  const conflicts = preview && preview.conflicts.length > 0
    ? preview.conflicts
    : serverConflicts;
  const mismatch =
    metadata !== null &&
    organizationSlug.length > 0 &&
    metadata.organizationSlug !== organizationSlug;
  const canApply =
    bundle !== null &&
    preview !== null &&
    preview.conflicts.length === 0 &&
    serverConflicts.length === 0 &&
    pending === null;

  return (
    <section
      data-testid="transfer-panel"
      className="border border-line-strong bg-raised"
    >
      <div className="h-1 bg-band" />
      <div className="p-5 md:p-6">
        <span className="font-label-caps text-label-caps uppercase text-accent">
          Transferencia de liga
        </span>
        <h2 className="mt-1 font-display text-headline-sm uppercase text-ink">
          Exportar e importar
        </h2>
        <p className="mt-2 max-w-3xl font-body text-body-sm text-ink-muted">
          Descarga la liga como JSON o carga un paquete exportado para previsualizar los cambios
          antes de aplicarlos. La importación exige que la organización del paquete coincida con
          esta consola.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="border border-line p-4">
            <h3 className="font-display text-headline-sm uppercase text-ink">Exportar</h3>
            <div className="mt-3">
              <label className={LABEL} htmlFor="export-season">
                Temporada a exportar
              </label>
              <select
                id="export-season"
                value={exportSeasonId}
                onChange={(event) => setExportSeasonId(event.target.value)}
                className={`${INPUT} mt-1`}
              >
                <option value="">Todas las temporadas</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.year} · {season.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting}
              className={`${BUTTON} mt-3`}
            >
              {exporting ? "Exportando…" : "Exportar liga"}
            </button>
            <MessageLine message={exportMessage} />
            {exportInfo ? (
              <div className="mt-4 border-t border-line pt-3">
                <p className="font-body text-body-sm text-ink">
                  <span className="font-semibold">{exportInfo.fileName}</span>{" "}
                  <span className="text-ink-muted">({formatFileSize(exportInfo.bytes)})</span>
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {bundleSummaryRows(exportInfo.summary).map((row) => (
                    <div key={row.key}>
                      <dt className="font-label-caps text-label-caps uppercase text-ink-muted">
                        {row.label}
                      </dt>
                      <dd className="font-tabular-stats text-tabular-stats text-ink">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>

          <div className="border border-line p-4">
            <h3 className="font-display text-headline-sm uppercase text-ink">Importar</h3>
            <p className="mt-2 font-body text-body-sm text-ink-muted">
              Organización de esta consola:{" "}
              <span className="font-semibold text-ink">{organizationSlug || "—"}</span>
            </p>
            <div className="mt-3">
              <label className={LABEL} htmlFor="import-file">
                Paquete JSON
              </label>
              <input
                id="import-file"
                type="file"
                accept="application/json,.json"
                onChange={(event) => void handleFileChange(event)}
                className="mt-1 block w-full max-w-full border border-line-strong bg-raised px-2 py-2 font-body text-body-sm text-ink file:mr-3 file:border-0 file:bg-band file:px-3 file:py-1 file:font-label-caps file:text-label-caps file:uppercase file:text-band-ink"
              />
              {fileName ? (
                <p className="mt-1 font-body text-body-sm text-ink-muted">{fileName}</p>
              ) : null}
            </div>

            {parseError ? (
              <div className="mt-3 border-l-4 border-accent bg-accent-soft px-3 py-2 font-body text-body-sm text-ink">
                {parseError}
              </div>
            ) : null}

            {metadata ? (
              <div className="mt-4 border-t border-line pt-3">
                <dl className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className={LABEL}>Formato</dt>
                    <dd className="font-body text-body-sm text-ink">{metadata.format}</dd>
                  </div>
                  <div>
                    <dt className={LABEL}>Organización</dt>
                    <dd className="font-body text-body-sm text-ink">
                      {metadata.organizationName || "—"} · {metadata.organizationSlug}
                    </dd>
                  </div>
                  <div>
                    <dt className={LABEL}>Exportado</dt>
                    <dd className="font-body text-body-sm text-ink">
                      {formatTimestamp(metadata.exportedAt)}
                    </dd>
                  </div>
                </dl>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {bundleSummaryRows(metadata.summary).map((row) => (
                    <div key={row.key}>
                      <dt className="font-label-caps text-label-caps uppercase text-ink-muted">
                        {row.label}
                      </dt>
                      <dd className="font-tabular-stats text-tabular-stats text-ink">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {mismatch ? (
                  <p className="mt-3 border-l-4 border-accent bg-accent-soft px-3 py-2 font-body text-body-sm text-ink">
                    El paquete pertenece a «{metadata.organizationSlug}» y esta consola opera
                    «{organizationSlug}». La API rechazará la importación.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handlePreview()}
                disabled={bundle === null || pending !== null}
                className={SECONDARY}
              >
                {pending === "preview" ? "Previsualizando…" : "Previsualizar"}
              </button>
              <button
                type="button"
                onClick={() => void handleApply()}
                disabled={!canApply}
                className={BUTTON}
              >
                {pending === "apply" ? "Aplicando…" : "Aplicar"}
              </button>
            </div>
            <MessageLine message={importMessage} />

            <ConflictList conflicts={conflicts} />

            {preview ? <DiffTable result={preview} title="Diferencias previsualizadas" /> : null}
            {applied ? <DiffTable result={applied} title="Resultado aplicado" /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
