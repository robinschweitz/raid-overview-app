// src/RaidCalendar.tsx
import React from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type ToolbarProps,
} from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { format, parse, startOfWeek, getDay, isValid, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from "date-fns";
import { de } from "date-fns/locale";

const locales = { de };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

type Raid = {
  id: string;
  date: any; // string OR sheets serial
  members: any[];
};

type Props = {
  raids: Raid[];
  lootArchive: any[];
  onSelectRaid: (raid: Raid) => void;
  renderRaidList: () => React.ReactNode;
};

function parseRaidDate(dateValue: unknown): Date | null {
  if (dateValue == null) return null;

  const s = String(dateValue).trim();
  if (!s) return null;

  const d = parse(s, "dd.MM.yyyy", new Date());
  return isValid(d) ? d : null;
}

function navigateDate(current: Date, action: "PREV" | "NEXT" | "TODAY", view: string) {
  if (action === "TODAY") return new Date();

  const dir = action === "NEXT" ? 1 : -1;

  if (view === Views.WEEK) return dir === 1 ? addWeeks(current, 1) : subWeeks(current, 1);
  if (view === Views.DAY) return dir === 1 ? addDays(current, 1) : subDays(current, 1);

  // default month
  return dir === 1 ? addMonths(current, 1) : subMonths(current, 1);
}

function CustomToolbar({
  label,
  view,
//   date,
  onView,
  onNavigate,
}: ToolbarProps) {
  return (
    <div className="rbc-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span className="rbc-btn-group" style={{ display: "flex", gap: 6 , margin: "5 auto"}}>
        <button type="button" onClick={() => onNavigate("PREV")}>
          Zurück
        </button>
        <button type="button" onClick={() => onNavigate("TODAY")}>
          Heute
        </button>
        <button type="button" onClick={() => onNavigate("NEXT")}>
          Weiter
        </button>
      </span>

      <span className="rbc-toolbar-label" style={{ fontWeight: 600 }}>
        {label}
      </span>

      <span className="rbc-btn-group" style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          className={view === Views.MONTH ? "rbc-active" : ""}
          onClick={() => onView(Views.MONTH)}
        >
          Monat
        </button>
        <button
          type="button"
          className={view === Views.WEEK ? "rbc-active" : ""}
          onClick={() => onView(Views.WEEK)}
        >
          Woche
        </button>
        <button
          type="button"
          className={view === Views.AGENDA ? "rbc-active" : ""}
          onClick={() => onView(Views.AGENDA)}
        >
          Liste
        </button>
      </span>
    </div>
  );
}

export const RaidCalendar: React.FC<Props> = ({
  raids,
  lootArchive,
  onSelectRaid,
  renderRaidList,
}) => {
  const [view, setView] = React.useState<string>(Views.MONTH);
  const [date, setDate] = React.useState<Date>(new Date());

  const events = React.useMemo(() => {
    return raids
      .map((raid) => {
        const d = parseRaidDate(raid.date);
        if (!d) return null;

        const start = new Date(d);
        start.setHours(19, 30, 0, 0);

        const end = new Date(d);
        end.setHours(23, 0, 0, 0);

        const lootCount = lootArchive.filter((l: any) => l.raidId === raid.id).length;
        const memberCount = raid.members?.length ?? 0;

        return {
          title: `${raid.id} • ${memberCount} Spieler • ${lootCount} Loot`,
          start,
          end,
          resource: raid,
        };
      })
      .filter(Boolean) as any[];
  }, [raids, lootArchive]);

  // Your requested behavior: "Liste" shows your original list
  if (view === Views.AGENDA) {
    return (
      <div style={{ background: "#121212", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" onClick={() => setView(Views.MONTH)} style={{ padding: "8px 10px" }}>
              ← Zurück zum Kalender
            </button>
            <h3 style={{ margin: 0 }}>Raid Liste</h3>
          </div>
          <div style={{ opacity: 0.8, fontSize: 13 }}>{raids.length} Raids</div>
        </div>

        {renderRaidList()}
      </div>
    );
  }

  return (
    <div style={{ height: 700, background: "#121212", borderRadius: 12, padding: 12 }}>
      <Calendar
        localizer={localizer}
        events={events}
        view={view as any}
        date={date}
        onView={(nextView) => setView(nextView as any)}
        onNavigate={(actionOrDate: any) => {
          // RBC sometimes calls onNavigate(date) and sometimes onNavigate(action)
          if (actionOrDate instanceof Date) {
            setDate(actionOrDate);
            return;
          }
          const next = navigateDate(date, actionOrDate, view);
          setDate(next);
        }}
        views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
        popup
        selectable={false}
        onSelectEvent={(e: any) => onSelectRaid(e.resource)}
        components={{
          toolbar: CustomToolbar,
        }}
        messages={{
          month: "Monat",
          week: "Woche",
          day: "Tag",
          agenda: "Liste",
          today: "Heute",
          previous: "Zurück",
          next: "Weiter",
          noEventsInRange: "Keine Raids in diesem Zeitraum.",
        }}
        style={{ color: "#eaeaea" }}
      />
    </div>
  );
};
