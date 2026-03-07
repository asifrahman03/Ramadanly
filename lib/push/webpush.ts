import webpush from "web-push";
import type { PushPayload, PushSubscriptionRecord } from "@/lib/push/types";

let configured = false;

const ensureWebPushConfigured = () => {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  const subject = process.env.VAPID_SUBJECT ?? "mailto:notifications@ramadanly.app";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
};

export const canSendWebPush = () => ensureWebPushConfigured();

export const sendPush = async (record: PushSubscriptionRecord, payload: PushPayload) => {
  if (!ensureWebPushConfigured()) {
    return { ok: false as const, statusCode: 500, reason: "missing vapid keys" };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: record.endpoint,
        keys: {
          auth: record.keys.auth,
          p256dh: record.keys.p256dh,
        },
      },
      JSON.stringify(payload),
      {
        TTL: 60,
        urgency: "high",
      },
    );
    return { ok: true as const, statusCode: 201 };
  } catch (error) {
    const statusCode =
      typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode: number }).statusCode)
        : 500;

    return {
      ok: false as const,
      statusCode,
      reason: "push send failed",
    };
  }
};
