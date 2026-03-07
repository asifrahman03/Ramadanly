import { NextResponse } from "next/server";
import { listSubscriptions } from "@/lib/push/storage";
import { canSendWebPush, sendPush } from "@/lib/push/webpush";

type TestBody = {
  endpoint?: string;
};

export async function POST(req: Request) {
  try {
    if (!canSendWebPush()) {
      return NextResponse.json(
        { ok: false, error: "missing vapid keys on server" },
        { status: 500 },
      );
    }

    const body = (await req.json()) as TestBody;
    if (!body.endpoint) {
      return NextResponse.json({ ok: false, error: "missing endpoint" }, { status: 400 });
    }

    const subscriptions = await listSubscriptions();
    const target = subscriptions.find((item) => item.endpoint === body.endpoint);

    if (!target) {
      return NextResponse.json({ ok: false, error: "subscription not found" }, { status: 404 });
    }

    const result = await sendPush(target, {
      title: "ramadanly test push",
      body: "if you can see this, background push is working.",
      url: "/workspace",
      tag: "ramadanly-test-push",
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: result.statusCode });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "failed to send test notification" }, { status: 500 });
  }
}
