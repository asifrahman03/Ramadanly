import type { PrayerName, PrayerTimeCard } from "@/lib/push/types";

type AladhanTimingResponse = {
  data: {
    timings: {
      Fajr: string;
      Dhuhr: string;
      Asr: string;
      Maghrib: string;
      Isha: string;
    };
  };
};

const ALADHAN_API_BASE_URL = "https://api.aladhan.com/v1/timingsByCity";

const cleanApiTime = (value: string) => value.split(" ")[0].split("(")[0].trim();

const to12Hour = (time24: string) => {
  const [hours, mins] = time24.split(":").map(Number);
  const suffix = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(mins).padStart(2, "0")}${suffix}`;
};

export const toMinutes = (time24: string) => {
  const [h, m] = time24.split(":").map(Number);
  return h * 60 + m;
};

export const prayerNameCopy: Record<PrayerName, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export const getPrayerTimesByCity = async (city: string, country: string): Promise<PrayerTimeCard[]> => {
  const res = await fetch(
    `${ALADHAN_API_BASE_URL}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=2`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("unable to fetch prayer times");

  const data = (await res.json()) as AladhanTimingResponse;
  const timings = data.data.timings;
  const nextTimes: Record<PrayerName, string> = {
    fajr: cleanApiTime(timings.Fajr),
    dhuhr: cleanApiTime(timings.Dhuhr),
    asr: cleanApiTime(timings.Asr),
    maghrib: cleanApiTime(timings.Maghrib),
    isha: cleanApiTime(timings.Isha),
  };

  return (Object.keys(nextTimes) as PrayerName[]).map((prayerId) => ({
    id: prayerId,
    name: prayerNameCopy[prayerId],
    time24: nextTimes[prayerId],
    timeLabel: to12Hour(nextTimes[prayerId]),
  }));
};
