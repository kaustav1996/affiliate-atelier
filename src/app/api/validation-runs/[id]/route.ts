import { NextResponse } from "next/server";
import { getValidationRunDetails } from "@/lib/metrics";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getValidationRunDetails(id);

  if (!run) {
    return NextResponse.json({ error: "Validation run not found." }, { status: 404 });
  }

  return NextResponse.json({ run });
}
