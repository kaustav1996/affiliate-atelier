import { ValidationStatus } from "@/generated/prisma/enums";
import { clearAffiliateGeneratedStorefront, copyDraftToPublished } from "@/lib/generated-storefront";
import { prisma } from "@/lib/prisma";

export async function getPublishGate(affiliateId: string) {
  const [affiliate, latestRun] = await Promise.all([
    prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: { draftGeneratedAt: true },
    }),
    prisma.validationRun.findFirst({
      where: { affiliateId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const validationCompletedAt = latestRun?.completedAt || latestRun?.createdAt || null;
  const validationCoversDraft =
    !affiliate?.draftGeneratedAt || Boolean(validationCompletedAt && validationCompletedAt >= affiliate.draftGeneratedAt);

  return {
    latestRun,
    canPublish: latestRun?.status === ValidationStatus.PASSED && validationCoversDraft,
  };
}

export async function publishAffiliateDraft(affiliateId: string, slug: string) {
  const { latestRun, canPublish } = await getPublishGate(affiliateId);

  if (!latestRun || !canPublish) {
    throw new Error("Publish is disabled until the latest validation run passes.");
  }

  await copyDraftToPublished(slug);

  return prisma.affiliate.update({
    where: { id: affiliateId },
    data: {
      publishedAt: new Date(),
      lastValidationRunId: latestRun.id,
    },
  });
}

export async function publishDefaultStorefront(affiliateId: string, slug: string) {
  await clearAffiliateGeneratedStorefront(slug);

  return prisma.affiliate.update({
    where: { id: affiliateId },
    data: {
      draftGeneratedAt: null,
      publishedAt: null,
      lastValidationRunId: null,
    },
  });
}
