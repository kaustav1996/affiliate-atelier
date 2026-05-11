import { NextResponse } from "next/server";
import { requireAffiliate } from "@/lib/auth/current";
import { generateAffiliateStorefront } from "@/lib/codex/run-codex";
import { clearDraftDirectory } from "@/lib/generated-storefront";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { affiliate } = await requireAffiliate();
    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: "Describe the storefront before generating." }, { status: 400 });
    }

    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { atelierPrompt: prompt },
    });

    await clearDraftDirectory(affiliate.slug);
    const result = await generateAffiliateStorefront({ slug: affiliate.slug, prompt });

    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { draftGeneratedAt: new Date() },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed." },
      { status: 500 },
    );
  }
}
