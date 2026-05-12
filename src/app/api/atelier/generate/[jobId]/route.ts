import { NextResponse } from "next/server";
import { getGenerationJob } from "@/lib/atelier-generation-jobs";
import { requireAffiliate } from "@/lib/auth/current";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { affiliate } = await requireAffiliate();
  const { jobId } = await params;
  const job = getGenerationJob(affiliate.id, jobId);

  if (!job) {
    return NextResponse.json(
      { error: "Generation job was not found. If the dev server restarted, start generation again." },
      { status: 404 },
    );
  }

  return NextResponse.json({ job });
}
