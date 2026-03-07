import { getPrayerTimesByCity, toMinutes } from "@/lib/push/prayer-times";
import { hasFired, listSubscriptions, markFired, removeSubscriptionByEndpoint } from "@/lib/push/storage";
import type { PrayerName, PushPayload, PushSubscriptionRecord } from "@/lib/push/types";
import { sendPush } from "@/lib/push/webpush";

const PRAYER_ORDER: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const ATHAN_GRACE_MINUTES = 2;
const CRON_WINDOW_MINUTES = 1;

const getNowInTimeZone = (timeZone: string) => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dateKey = `${map.year}-${map.month}-${map.day}`;
  const minuteOfDay = Number(map.hour) * 60 + Number(map.minute);

  return { dateKey, minuteOfDay };
};

const inWindow = (nowMinute: number, targetMinute: number, windowMins = CRON_WINDOW_MINUTES) =>
  nowMinute >= targetMinute && nowMinute <= targetMinute + windowMins;

const buildReminderPayload = (
  record: PushSubscriptionRecord,
  prayerName: string,
  prayerId: PrayerName,
  offsetMins: number,
  timeLabel: string,
): PushPayload => ({
  title: `${prayerName} in ${offsetMins} minute${offsetMins === 1 ? "" : "s"}`,
  body: `${prayerName} athan is at ${timeLabel}.`,
  url: `/workspace?notifyPrayer=${prayerId}&notifyType=reminder`,
  tag: `reminder-${prayerId}-${record.timezone}`,
});

const buildAthanPayload = (record: PushSubscriptionRecord, prayerName: string, prayerId: PrayerName): PushPayload => ({
  title: `${prayerName} athan is now`,
  body: `time to pray ${prayerName}. tap to open your prayer window.`,
  url: `/workspace?notifyPrayer=${prayerId}&notifyType=athan`,
  tag: `athan-${prayerId}-${record.timezone}`,
});

const sendAndTrack = async (
  record: PushSubscriptionRecord,
  dateKey: string,
  prayerId: PrayerName,
  type: "reminder" | "athan",
  payload: PushPayload,
) => {
  const alreadyFired = await hasFired(dateKey, record.id, prayerId, type);
  if (alreadyFired) return { sent: false, removed: false };

  const result = await sendPush(record, payload);
  if (!result.ok) {
    if (result.statusCode === 404 || result.statusCode === 410) {
      await removeSubscriptionByEndpoint(record.endpoint);
      return { sent: false, removed: true };
    }

    return { sent: false, removed: false };
  }

  await markFired(dateKey, record.id, prayerId, type);
  return { sent: true, removed: false };
};

export const runPushSchedule = async () => {
  const subscriptions = await listSubscriptions();
  let remindersSent = 0;
  let athansSent = 0;
  let removedSubscriptions = 0;

  await Promise.all(
    subscriptions.map(async (record) => {
      if (!record.remindersEnabled) return;

      const { dateKey, minuteOfDay } = getNowInTimeZone(record.timezone);
      const prayerTimes = await getPrayerTimesByCity(record.city, record.country);

      await Promise.all(
        prayerTimes.map(async (prayer) => {
          const prayerMinute = toMinutes(prayer.time24);
          const offset = Math.max(0, record.reminderOffsets[prayer.id] ?? 10);
          const reminderMinute = Math.max(0, prayerMinute - offset);

          if (inWindow(minuteOfDay, reminderMinute, CRON_WINDOW_MINUTES) && minuteOfDay < prayerMinute) {
            const reminderResult = await sendAndTrack(
              record,
              dateKey,
              prayer.id,
              "reminder",
              buildReminderPayload(record, prayer.name, prayer.id, offset, prayer.timeLabel),
            );
            if (reminderResult.sent) remindersSent += 1;
            if (reminderResult.removed) removedSubscriptions += 1;
          }

          if (inWindow(minuteOfDay, prayerMinute, ATHAN_GRACE_MINUTES)) {
            const athanResult = await sendAndTrack(
              record,
              dateKey,
              prayer.id,
              "athan",
              buildAthanPayload(record, prayer.name, prayer.id),
            );
            if (athanResult.sent) athansSent += 1;
            if (athanResult.removed) removedSubscriptions += 1;
          }
        }),
      );
    }),
  );

  return {
    subscriptions: subscriptions.length,
    remindersSent,
    athansSent,
    removedSubscriptions,
    prayerOrder: PRAYER_ORDER,
  };
};
