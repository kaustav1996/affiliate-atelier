import Link from "next/link";
import { AtelierClient } from "@/components/AtelierClient";
import { LogoutButton } from "@/components/LogoutButton";
import { requireAffiliate } from "@/lib/auth/current";
import { listGeneratedFiles } from "@/lib/generated-storefront";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AtelierPage() {
  const { affiliate } = await requireAffiliate();
  const [files, validationRuns] = await Promise.all([
    listGeneratedFiles(affiliate.slug, "draft"),
    prisma.validationRun.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        logs: true,
        failureReason: true,
        createdAt: true,
        completedAt: true,
      },
    }),
  ]);

  return (
    <main className="dashboard-shell atelier-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Atelier</p>
          <h1>Generate, validate, publish.</h1>
          <p>
            Codex writes only inside generated/affiliates/{affiliate.slug}/draft. The published storefront link opens
            what customers see at /a/{affiliate.slug}; before publish it falls back to the default affiliate store.
          </p>
        </div>
        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href={`/a/${affiliate.slug}`} target="_blank">
            Open published storefront
          </Link>
          <LogoutButton />
        </nav>
      </header>

      <AtelierClient
        slug={affiliate.slug}
        initialPrompt={affiliate.atelierPrompt || ""}
        initialFiles={files}
        validationRuns={validationRuns.map((run) => ({
          ...run,
          createdAt: run.createdAt.toISOString(),
          completedAt: run.completedAt?.toISOString() || null,
        }))}
      />
    </main>
  );
}
