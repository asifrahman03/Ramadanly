import { NextResponse } from "next/server";
import { removeSubscriptionByEndpoint } from "@/lib/push/storage";

type UnsubscribeBody = {
  endpoint?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as UnsubscribeBody;

    if (!body.endpoint) {
      return NextResponse.json({ ok: false, error: "missing endpoint" }, { status: 400 });
    }

    await removeSubscriptionByEndpoint(body.endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "failed to remove subscription" }, { status: 500 });
  }
}
