import { NextResponse } from "next/server";
import { getGenerationJob } from "@/lib/atelier-generation-jobs";
import { getCurrentUser } from "@/lib/auth/current";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getCurrentUser();
  const affiliate = user?.affiliate;

  if (!affiliate) {
    return NextResponse.json({ error: "Log in as an affiliate to check generation status." }, { status: 401 });
  }

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
