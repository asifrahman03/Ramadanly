import { NextResponse } from "next/server";
import { saveSubscription, toSubscriptionId } from "@/lib/push/storage";
import type { PrayerName, ReminderOffsets } from "@/lib/push/types";

const validPrayerNames: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

type SubscribeBody = {
  subscription: {
    endpoint: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  city: string;
  country: string;
  timezone: string;
  reminderOffsets: Partial<Record<PrayerName, number>>;
  remindersEnabled: boolean;
};

const sanitizeOffsets = (offsets: Partial<Record<PrayerName, number>>): ReminderOffsets => {
  const safeOffsets: ReminderOffsets = {
    fajr: 10,
    dhuhr: 10,
    asr: 10,
    maghrib: 10,
    isha: 10,
  };

  validPrayerNames.forEach((prayer) => {
    const value = offsets[prayer];
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    safeOffsets[prayer] = Math.max(0, Math.min(180, Math.round(value)));
  });

  return safeOffsets;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubscribeBody;

    if (!body?.subscription?.endpoint) {
      return NextResponse.json({ ok: false, error: "missing endpoint" }, { status: 400 });
    }

    const endpoint = body.subscription.endpoint;
    const keys = body.subscription.keys;
    if (!keys?.p256dh || !keys.auth) {
      return NextResponse.json({ ok: false, error: "missing subscription keys" }, { status: 400 });
    }
    const safeKeys = {
      p256dh: keys.p256dh,
      auth: keys.auth,
    };

    const id = toSubscriptionId(endpoint);
    const nowIso = new Date().toISOString();

    await saveSubscription({
      id,
      endpoint,
      keys: safeKeys,
      city: body.city?.trim() || "New York",
      country: body.country?.trim() || "United States",
      timezone: body.timezone?.trim() || "UTC",
      reminderOffsets: sanitizeOffsets(body.reminderOffsets ?? {}),
      remindersEnabled: Boolean(body.remindersEnabled),
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "failed to save subscription" }, { status: 500 });
  }
}
