import { eventDetail, eventTitle, formatTime } from "@/lib/format";
import type { Event } from "@/lib/types";

export function EventFeed({ events }: { events: Event[] }) {
  const recent = [...events].sort((a, b) => b.seq - a.seq).slice(0, 24);

  return (
    <section className="panel" aria-label="Registro de eventos">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold">Registro</h2>
        <span className="font-mono text-[11px] text-muted">{events.length} eventos</span>
      </header>

      {recent.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">Todavía no hay eventos.</p>
      ) : (
        <ol className="max-h-[26rem] divide-y divide-line overflow-y-auto">
          {recent.map((event) => {
            const detail = eventDetail(event);
            return (
              <li key={event.id} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5 w-9 shrink-0 font-mono text-[11px] text-muted">
                  #{event.seq}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{eventTitle(event)}</p>
                  {detail ? <p className="mt-0.5 truncate text-xs text-muted">{detail}</p> : null}
                </div>
                <time
                  className="shrink-0 font-mono text-[11px] text-muted"
                  dateTime={event.occurredAt}
                >
                  {formatTime(event.occurredAt)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
