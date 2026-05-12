import { NextResponse } from "next/server";
import { requireAffiliate } from "@/lib/auth/current";
import { publishDefaultStorefront } from "@/lib/publish";

export async function POST() {
  try {
    const { affiliate } = await requireAffiliate();
    const updatedAffiliate = await publishDefaultStorefront(affiliate.id, affiliate.slug);
    return NextResponse.json({ affiliate: updatedAffiliate, files: [], ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reset failed." },
      { status: 500 },
    );
  }
}
