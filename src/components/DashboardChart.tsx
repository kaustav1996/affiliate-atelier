"use client";

import { formatMoney } from "@/lib/money";

type DashboardChartProps = {
  trend: Array<{
    label: string;
    salesInCents: number;
    commissionInCents: number;
  }>;
};

export function DashboardChart({ trend }: DashboardChartProps) {
  const maxValue = Math.max(...trend.map((item) => item.commissionInCents), 1);

  return (
    <div className="trend-chart" aria-label="Commission trend chart">
      <div className="chart-bars">
        {trend.map((item) => (
          <div className="chart-bar-wrap" key={item.label}>
            <span
              className="chart-bar"
              style={{ height: `${Math.max(8, (item.commissionInCents / maxValue) * 100)}%` }}
              title={`${item.label}: ${formatMoney(item.commissionInCents)}`}
            />
            <small>{item.label.slice(3)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
