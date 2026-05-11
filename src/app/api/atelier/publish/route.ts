import { NextResponse } from "next/server";
import { requireAffiliate } from "@/lib/auth/current";
import { publishAffiliateDraft } from "@/lib/publish";

export async function POST() {
  try {
    const { affiliate } = await requireAffiliate();
    const updatedAffiliate = await publishAffiliateDraft(affiliate.id, affiliate.slug);
    return NextResponse.json({ affiliate: updatedAffiliate, ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publish failed." },
      { status: 500 },
    );
  }
}
