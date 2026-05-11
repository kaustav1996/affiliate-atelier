import { ValidationStatus } from "@/generated/prisma/enums";
import { copyDraftToPublished } from "@/lib/generated-storefront";
import { prisma } from "@/lib/prisma";

export async function getPublishGate(affiliateId: string) {
  const latestRun = await prisma.validationRun.findFirst({
    where: { affiliateId },
    orderBy: { createdAt: "desc" },
  });

  return {
    latestRun,
    canPublish: latestRun?.status === ValidationStatus.PASSED,
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
