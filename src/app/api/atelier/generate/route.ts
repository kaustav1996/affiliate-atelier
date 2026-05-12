import { NextResponse } from "next/server";
import { getActiveGenerationJob, startGenerationJob } from "@/lib/atelier-generation-jobs";
import { getCurrentUser } from "@/lib/auth/current";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const affiliate = user?.affiliate;

    if (!affiliate) {
      return NextResponse.json({ error: "Log in as an affiliate to generate a storefront." }, { status: 401 });
    }

    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: "Describe the storefront before generating." }, { status: 400 });
    }

    const activeJob = getActiveGenerationJob(affiliate.id);

    if (activeJob) {
      return NextResponse.json({ job: activeJob }, { status: 202 });
    }

    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { atelierPrompt: prompt },
    });

    const job = startGenerationJob({
      affiliateId: affiliate.id,
      slug: affiliate.slug,
      prompt,
    });

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed." },
      { status: 500 },
    );
  }
}
