import { formatGbp, todayIso } from "../domain/spending";
import type { DailyTotal } from "../domain/types";

interface WeeklyChartProps {
  dailyTotals: DailyTotal[];
  weekTotal: number;
}

const CHART_HEIGHT = 80;

export function WeeklyChart({ dailyTotals, weekTotal }: WeeklyChartProps) {
  const maxTotal = Math.max(...dailyTotals.map((d) => d.total), 1);
  const today = todayIso();

  return (
    <section className="weekly-chart" aria-label="Spending last 7 days">
      <div className="section-header">
        <h2 className="section-title">This week</h2>
        <span className="weekly-chart__week-total">{formatGbp(weekTotal)}</span>
      </div>
      <div className="weekly-chart__grid">
        {dailyTotals.map(({ date, total }) => {
          const isToday = date === today;
          const barPx = total > 0
            ? Math.max((total / maxTotal) * CHART_HEIGHT, 4)
            : 0;
          const dayLabel = new Date(date + "T12:00:00").toLocaleDateString(
            "en-GB",
            { weekday: "short" },
          );

          return (
            <div
              key={date}
              className={`weekly-chart__col${isToday ? " weekly-chart__col--today" : ""}`}
            >
              <div className="weekly-chart__bar-wrap">
                <div
                  className="weekly-chart__bar"
                  style={{ height: barPx }}
                  aria-label={`${isToday ? "Today" : dayLabel}: ${formatGbp(total)}`}
                />
              </div>
              <span className="weekly-chart__label">
                {isToday ? "Today" : dayLabel}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
