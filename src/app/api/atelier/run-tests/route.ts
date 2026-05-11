import { execa } from "execa";
import { NextResponse } from "next/server";
import { ValidationStatus } from "@/generated/prisma/enums";
import { requireAffiliate } from "@/lib/auth/current";
import { listGeneratedFiles } from "@/lib/generated-storefront";
import { repairAffiliateStorefront } from "@/lib/codex/run-codex";
import { prisma } from "@/lib/prisma";

async function runGeneratedValidation({
  affiliateSlug,
  runId,
  baseUrl,
}: {
  affiliateSlug: string;
  runId: string;
  baseUrl: string;
}) {
  const result = await execa(
    "npx",
    ["playwright", "test", "tests/generated-storefront.spec.ts", "--project=chromium"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BASE_URL: baseUrl,
        AFFILIATE_SLUG: affiliateSlug,
        VALIDATION_RUN_ID: runId,
      },
      timeout: 1000 * 60 * 2,
      reject: false,
    },
  );

  return {
    exitCode: result.exitCode,
    logs: [result.stdout, result.stderr].filter(Boolean).join("\n\n") || "Playwright finished.",
  };
}

export async function POST(request: Request) {
  const { affiliate } = await requireAffiliate();
  const run = await prisma.validationRun.create({
    data: {
      affiliateId: affiliate.id,
      status: ValidationStatus.RUNNING,
      prompt: affiliate.atelierPrompt,
      logs: "Validation run created. Launching Playwright purchase flow.",
    },
  });

  const baseUrl = process.env.BASE_URL || new URL(request.url).origin;

  try {
    const firstAttempt = await runGeneratedValidation({
      affiliateSlug: affiliate.slug,
      runId: run.id,
      baseUrl,
    });

    if (firstAttempt.exitCode !== 0) {
      let combinedLogs = [
        "Initial validation failed. Starting Codex CLI auto-repair.",
        firstAttempt.logs,
      ].join("\n\n");

      try {
        const repair = await repairAffiliateStorefront({
          slug: affiliate.slug,
          prompt: affiliate.atelierPrompt || "",
          validationLogs: firstAttempt.logs,
        });
        combinedLogs = [combinedLogs, "Codex repair completed.", repair.logs].join("\n\n");

        await prisma.validationRun.update({
          where: { id: run.id },
          data: { logs: combinedLogs },
        });

        const secondAttempt = await runGeneratedValidation({
          affiliateSlug: affiliate.slug,
          runId: run.id,
          baseUrl,
        });
        combinedLogs = [combinedLogs, "Validation after Codex repair:", secondAttempt.logs].join("\n\n");

        if (secondAttempt.exitCode === 0) {
          const passedRun = await prisma.validationRun.update({
            where: { id: run.id },
            data: {
              status: ValidationStatus.PASSED,
              logs: combinedLogs,
              completedAt: new Date(),
            },
          });

          return NextResponse.json({
            run: passedRun,
            logs: combinedLogs,
            files: repair.files,
            repaired: true,
            ok: true,
          });
        }
      } catch (repairError) {
        combinedLogs = [
          combinedLogs,
          "Codex repair failed.",
          repairError instanceof Error ? repairError.message : String(repairError),
        ].join("\n\n");
      }

      const failedRun = await prisma.validationRun.update({
        where: { id: run.id },
        data: {
          status: ValidationStatus.FAILED,
          logs: combinedLogs,
          failureReason: "Validation failed after Codex auto-repair attempt.",
          completedAt: new Date(),
        },
      });
      return NextResponse.json(
        {
          run: failedRun,
          logs: combinedLogs,
          files: await listGeneratedFiles(affiliate.slug, "draft"),
          repaired: true,
          ok: false,
        },
        { status: 400 },
      );
    }

    const passedRun = await prisma.validationRun.update({
      where: { id: run.id },
      data: {
        status: ValidationStatus.PASSED,
        logs: firstAttempt.logs,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ run: passedRun, logs: firstAttempt.logs, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation failed.";
    const failedRun = await prisma.validationRun.update({
      where: { id: run.id },
      data: {
        status: ValidationStatus.FAILED,
        logs: message,
        failureReason: message,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ run: failedRun, logs: message, ok: false }, { status: 500 });
  }
}
