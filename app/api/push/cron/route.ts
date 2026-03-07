import { NextResponse } from "next/server";
import { runPushSchedule } from "@/lib/push/scheduler";
import { canSendWebPush } from "@/lib/push/webpush";

const unauthorized = () => NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) return unauthorized();
  }

  if (!canSendWebPush()) {
    return NextResponse.json(
      { ok: false, error: "missing vapid keys" },
      { status: 500 },
    );
  }

  try {
    const result = await runPushSchedule();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, error: "scheduler failed" }, { status: 500 });
  }
}
