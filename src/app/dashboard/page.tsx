import Link from "next/link";
import { CopyAffiliateLink } from "@/components/CopyAffiliateLink";
import { DashboardChart } from "@/components/DashboardChart";
import { LogoutButton } from "@/components/LogoutButton";
import { requireAffiliate } from "@/lib/auth/current";
import { formatMoney, formatPercent } from "@/lib/money";
import { getAffiliateLiveMetrics } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, affiliate } = await requireAffiliate();
  const [metrics, products] = await Promise.all([
    getAffiliateLiveMetrics(affiliate.id),
    prisma.product.findMany({ select: { commissionRate: true } }),
  ]);
  const productCommissionRate =
    products.length > 0
      ? products.reduce((sum, product) => sum + product.commissionRate, 0) / products.length
      : affiliate.commissionRate;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Affiliate dashboard</p>
          <h1>{user.name}</h1>
          <p>Your live metrics exclude every Atelier validation order.</p>
        </div>
        <nav>
          <Link href="/">Store</Link>
          <Link href="/dashboard/atelier">Atelier</Link>
          <LogoutButton />
        </nav>
      </header>

      <section className="affiliate-link-panel">
        <div>
          <p className="eyebrow">Referral link</p>
          <h2>/a/{affiliate.slug}</h2>
          <p>Attribution survives cart and checkout for live purchases.</p>
        </div>
        <CopyAffiliateLink slug={affiliate.slug} />
      </section>

      <section className="metric-grid">
        <article>
          <span>Total live sales</span>
          <strong>{formatMoney(metrics.totalSalesInCents)}</strong>
        </article>
        <article>
          <span>Total live commission</span>
          <strong>{formatMoney(metrics.totalCommissionInCents)}</strong>
        </article>
        <article>
          <span>Live order count</span>
          <strong>{metrics.liveOrderCount}</strong>
        </article>
        <article>
          <span>Product commission</span>
          <strong>{formatPercent(productCommissionRate)}</strong>
        </article>
      </section>

      <section className="dashboard-proof-strip" aria-label="Metric integrity">
        <span>LIVE orders are the dashboard source of truth.</span>
        <strong>Atelier validation orders remain visible to tests, but never enter sales, commission, order count, trend, or recent order metrics.</strong>
      </section>

      <section className="dashboard-split">
        <article className="dashboard-panel">
          <div className="panel-heading-row">
            <div>
              <p className="eyebrow">Commission trend</p>
              <h2>Last 14 days</h2>
            </div>
            <span>{formatPercent(metrics.conversionRate || 0)} conversion signal</span>
          </div>
          <DashboardChart trend={metrics.trend} />
        </article>

        <article className="dashboard-panel">
          <p className="eyebrow">Recent live orders</p>
          <h2>Business ledger</h2>
          <div className="order-list">
            {metrics.recentOrders.length ? (
              metrics.recentOrders.map((order) => (
                <div key={order.id} className="order-row">
                  <div>
                    <strong>{order.email}</strong>
                    <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <span>{formatMoney(order.commissionInCents)}</span>
                </div>
              ))
            ) : (
              <p>No live orders yet.</p>
            )}
          </div>
        </article>
      </section>
      <section className="exclusion-note">Clean demo state: dashboard values should return to zero after reset.</section>
    </main>
  );
}
