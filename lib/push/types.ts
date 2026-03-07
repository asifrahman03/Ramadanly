export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export type ReminderOffsets = Record<PrayerName, number>;

export type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  city: string;
  country: string;
  timezone: string;
  reminderOffsets: ReminderOffsets;
  remindersEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type PrayerTimeCard = {
  id: PrayerName;
  name: string;
  time24: string;
  timeLabel: string;
};
