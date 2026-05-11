import { NextResponse } from "next/server";
import { createCheckoutOrder } from "@/lib/orders";

export async function POST(request: Request) {
  try {
    const order = await createCheckoutOrder(await request.json());
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 400 },
    );
  }
}
