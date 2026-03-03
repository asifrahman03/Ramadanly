"use client";

import { Button, Card, CardBody, Checkbox, Chip, Input, Progress } from "@heroui/react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NextLink from "next/link";

type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

type PrayerCard = {
  id: PrayerName;
  name: string;
  timeLabel: string;
  time24: string;
  lockHeadline: string;
  lockLine: string;
  unlockLine: string;
};

type CompletionMap = Record<PrayerName, boolean>;

type PrayerStatus = "upcoming" | "due" | "missed" | "completed";
type StatusColor = "warning" | "danger" | "success";

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

type ReverseGeoResponse = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
};
type SavedLocation = { city: string; country: string };

const ALADHAN_API_BASE_URL = "https://api.aladhan.com/v1/timingsByCity";
const BIGDATACLOUD_BASE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const LOCATION_STORAGE_KEY = "ramadanly-location";
const REMINDER_OFFSETS_STORAGE_KEY = "ramadanly-reminder-offsets";
const REMINDERS_ENABLED_STORAGE_KEY = "ramadanly-reminders-enabled";
const pillarClasses = [
  "h-32 w-10",
  "h-44 w-12",
  "h-36 w-11",
  "h-48 w-14",
  "h-40 w-10",
  "h-44 w-12",
  "h-36 w-11",
  "h-48 w-14",
];

const prayerCopy: Record<
  PrayerName,
  { name: string; lockHeadline: string; lockLine: string; unlockLine: string }
> = {
  fajr: {
    name: "Fajr",
    lockHeadline: "champions win before sunrise.",
    lockLine: "you do not chase goals half asleep. stand for fajr and take your first victory.",
    unlockLine: "day opened with discipline.",
  },
  dhuhr: {
    name: "Dhuhr",
    lockHeadline: "midday reset. no drift allowed.",
    lockLine: "pause the grind, answer the call, return with sharper focus.",
    unlockLine: "momentum renewed with salah.",
  },
  asr: {
    name: "Asr",
    lockHeadline: "finish strong, not scattered.",
    lockLine: "asr is where serious people separate from excuses.",
    unlockLine: "late-game focus protected.",
  },
  maghrib: {
    name: "Maghrib",
    lockHeadline: "sunset check-in. heart over hustle.",
    lockLine: "close the day with remembrance, then move with barakah.",
    unlockLine: "evening grounded in worship.",
  },
  isha: {
    name: "Isha",
    lockHeadline: "close like an elite.",
    lockLine: "final prayer. finish your day accountable to Allah, not your to-do list.",
    unlockLine: "night sealed with intention.",
  },
};

const fallbackPrayerCards: PrayerCard[] = [
  { id: "fajr", time24: "05:43", timeLabel: "5:43am", ...prayerCopy.fajr },
  { id: "dhuhr", time24: "12:20", timeLabel: "12:20pm", ...prayerCopy.dhuhr },
  { id: "asr", time24: "16:48", timeLabel: "4:48pm", ...prayerCopy.asr },
  { id: "maghrib", time24: "18:22", timeLabel: "6:22pm", ...prayerCopy.maghrib },
  { id: "isha", time24: "19:45", timeLabel: "7:45pm", ...prayerCopy.isha },
];

const defaultCompletion: CompletionMap = {
  fajr: false,
  dhuhr: false,
  asr: false,
  maghrib: false,
  isha: false,
};
const defaultReminderOffsets: Record<PrayerName, number> = {
  fajr: 10,
  dhuhr: 10,
  asr: 10,
  maghrib: 10,
  isha: 10,
};
const defaultReminderFired: Record<PrayerName, boolean> = {
  fajr: false,
  dhuhr: false,
  asr: false,
  maghrib: false,
  isha: false,
};

const statusStyle: Record<PrayerStatus, StatusColor> = {
  upcoming: "warning",
  due: "warning",
  missed: "danger",
  completed: "success",
};
const statusChipClass: Record<PrayerStatus, string> = {
  upcoming: "bg-amber-300/20 text-amber-200 border border-amber-300/30",
  due: "bg-amber-300/20 text-amber-200 border border-amber-300/30",
  missed: "bg-rose-300/20 text-rose-200 border border-rose-300/30",
  completed: "bg-green-300/20 text-green-200 border border-green-300/30",
};

const localDateKey = () => {
  return localDateKeyFromDate(new Date());
};

const localDateKeyFromDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const toMinutes = (time24: string) => {
  const [h, m] = time24.split(":").map(Number);
  return h * 60 + m;
};

const to12Hour = (time24: string) => {
  const [hours, mins] = time24.split(":").map(Number);
  const suffix = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(mins).padStart(2, "0")}${suffix}`;
};

const cleanApiTime = (value: string) => value.split(" ")[0].split("(")[0].trim();

const buildPrayerCards = (timings: AladhanTimingResponse["data"]["timings"]): PrayerCard[] => {
  const nextTimes: Record<PrayerName, string> = {
    fajr: cleanApiTime(timings.Fajr),
    dhuhr: cleanApiTime(timings.Dhuhr),
    asr: cleanApiTime(timings.Asr),
    maghrib: cleanApiTime(timings.Maghrib),
    isha: cleanApiTime(timings.Isha),
  };

  return (Object.keys(nextTimes) as PrayerName[]).map((prayerId) => ({
    id: prayerId,
    name: prayerCopy[prayerId].name,
    time24: nextTimes[prayerId],
    timeLabel: to12Hour(nextTimes[prayerId]),
    lockHeadline: prayerCopy[prayerId].lockHeadline,
    lockLine: prayerCopy[prayerId].lockLine,
    unlockLine: prayerCopy[prayerId].unlockLine,
  }));
};

const getCompletionForKey = (dayKey: string) => {
  if (typeof window === "undefined") return defaultCompletion;
  const saved = window.localStorage.getItem(`ramadanly-completed-${dayKey}`);
  if (!saved) return defaultCompletion;

  try {
    return { ...defaultCompletion, ...(JSON.parse(saved) as Partial<CompletionMap>) };
  } catch {
    return defaultCompletion;
  }
};

const getReminderOffsets = () => {
  if (typeof window === "undefined") return defaultReminderOffsets;
  const saved = window.localStorage.getItem(REMINDER_OFFSETS_STORAGE_KEY);
  if (!saved) return defaultReminderOffsets;

  try {
    return {
      ...defaultReminderOffsets,
      ...(JSON.parse(saved) as Partial<Record<PrayerName, number>>),
    };
  } catch {
    return defaultReminderOffsets;
  }
};

const getReminderFiredForKey = (dayKey: string) => {
  if (typeof window === "undefined") return defaultReminderFired;
  const saved = window.localStorage.getItem(`ramadanly-reminder-fired-${dayKey}`);
  if (!saved) return defaultReminderFired;

  try {
    return {
      ...defaultReminderFired,
      ...(JSON.parse(saved) as Partial<Record<PrayerName, boolean>>),
    };
  } catch {
    return defaultReminderFired;
  }
};

const getDuePrayer = (now: Date, completion: CompletionMap, cards: PrayerCard[]) => {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return (
    cards.find((prayer, index) => {
      if (completion[prayer.id]) return false;
      const prayerStart = toMinutes(prayer.time24);
      const nextPrayer = cards[index + 1];
      const nextPrayerStart = nextPrayer ? toMinutes(nextPrayer.time24) : Number.POSITIVE_INFINITY;
      return nowMins >= prayerStart && nowMins < nextPrayerStart;
    }) ?? null
  );
};

export default function Home() {
  const [now, setNow] = useState(() => new Date());
  const [dayKey, setDayKey] = useState(() => localDateKey());
  const [completion, setCompletion] = useState<CompletionMap>(() => getCompletionForKey(localDateKey()));
  const [reminderOffsets, setReminderOffsets] = useState<Record<PrayerName, number>>(() => getReminderOffsets());
  const [remindersEnabled, setRemindersEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(REMINDERS_ENABLED_STORAGE_KEY) === "true";
  });
  const [reminderFired, setReminderFired] = useState<Record<PrayerName, boolean>>(() =>
    getReminderFiredForKey(localDateKey()),
  );
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied";
    return window.Notification.permission;
  });
  const [reminderMessage, setReminderMessage] = useState("");
  const [confirmPrayerId, setConfirmPrayerId] = useState<PrayerName | null>(null);
  const [prayerCards, setPrayerCards] = useState<PrayerCard[]>(fallbackPrayerCards);
  const [locationLine, setLocationLine] = useState("syncing your city prayer times...");
  const [timesError, setTimesError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const reminderTimeoutsRef = useRef<number[]>([]);

  const clearReminderTimeouts = useCallback(() => {
    reminderTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    reminderTimeoutsRef.current = [];
  }, []);

  const sendReminderNotification = useCallback(
    (prayer: PrayerCard, offset: number) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (window.Notification.permission !== "granted") return;

      new window.Notification(`${prayer.name} in ${offset} minute${offset === 1 ? "" : "s"}`, {
        body: `${prayer.name} athan is at ${prayer.timeLabel}.`,
      });
      setReminderFired((prev) => ({ ...prev, [prayer.id]: true }));
    },
    [],
  );

  const loadPrayerTimes = useCallback(async () => {
    try {
      setIsLocating(true);
      setTimesError(null);
      setLocationLine("syncing your city prayer times...");
      const savedLocationRaw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (savedLocationRaw) {
        const parsed = JSON.parse(savedLocationRaw) as SavedLocation;
        if (parsed.city && parsed.country) {
          const savedTimingsRes = await fetch(
            `${ALADHAN_API_BASE_URL}?city=${encodeURIComponent(parsed.city)}&country=${encodeURIComponent(parsed.country)}&method=2`,
          );
          if (!savedTimingsRes.ok) throw new Error("unable to fetch prayer times");
          const savedTimingsData = (await savedTimingsRes.json()) as AladhanTimingResponse;
          setPrayerCards(buildPrayerCards(savedTimingsData.data.timings));
          setLocationLine(`${parsed.city}, ${parsed.country}`);
          return;
        }
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 300_000,
        });
      });

      const geoRes = await fetch(
        `${BIGDATACLOUD_BASE_URL}?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`,
      );
      if (!geoRes.ok) throw new Error("unable to read your location");
      const geoData = (await geoRes.json()) as ReverseGeoResponse;

      const city = geoData.city ?? geoData.locality ?? geoData.principalSubdivision;
      const country = geoData.countryName;
      if (!city || !country) throw new Error("could not resolve city and country");

      const timingsRes = await fetch(
        `${ALADHAN_API_BASE_URL}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=2`,
      );
      if (!timingsRes.ok) throw new Error("unable to fetch prayer times");
      const timingsData = (await timingsRes.json()) as AladhanTimingResponse;

      setPrayerCards(buildPrayerCards(timingsData.data.timings));
      setLocationLine(`${city}, ${country}`);
      window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ city, country }));
    } catch {
      setPrayerCards(fallbackPrayerCards);
      setLocationLine("location sync unavailable - using fallback schedule");
      setTimesError("allow location access for accurate city prayer times.");
    } finally {
      setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow((prev) => {
        const next = new Date();
        const prevDay = localDateKeyFromDate(prev);
        const nextDay = localDateKeyFromDate(next);
        if (prevDay !== nextDay) {
          setDayKey(nextDay);
          setCompletion(getCompletionForKey(nextDay));
          setReminderFired(getReminderFiredForKey(nextDay));
          setConfirmPrayerId(null);
        }
        return next;
      });
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void loadPrayerTimes();
  }, [dayKey, loadPrayerTimes]);

  useEffect(() => {
    window.localStorage.setItem(`ramadanly-completed-${dayKey}`, JSON.stringify(completion));
  }, [completion, dayKey]);

  useEffect(() => {
    window.localStorage.setItem(REMINDER_OFFSETS_STORAGE_KEY, JSON.stringify(reminderOffsets));
  }, [reminderOffsets]);

  useEffect(() => {
    window.localStorage.setItem(REMINDERS_ENABLED_STORAGE_KEY, String(remindersEnabled));
  }, [remindersEnabled]);

  useEffect(() => {
    window.localStorage.setItem(`ramadanly-reminder-fired-${dayKey}`, JSON.stringify(reminderFired));
  }, [dayKey, reminderFired]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("denied");
      return;
    }
    setNotificationPermission(window.Notification.permission);
  }, []);

  useEffect(() => {
    clearReminderTimeouts();
    if (!remindersEnabled) return;
    if (notificationPermission !== "granted") return;

    const nowDate = new Date();
    const nowMins = nowDate.getHours() * 60 + nowDate.getMinutes();

    prayerCards.forEach((prayer) => {
      if (reminderFired[prayer.id]) return;

      const prayerMins = toMinutes(prayer.time24);
      const offsetMins = Math.max(0, reminderOffsets[prayer.id] ?? 10);
      const reminderMins = Math.max(0, prayerMins - offsetMins);

      if (nowMins >= reminderMins && nowMins < prayerMins) {
        sendReminderNotification(prayer, offsetMins);
        return;
      }

      if (nowMins >= prayerMins) return;

      const target = new Date();
      target.setHours(Math.floor(reminderMins / 60), reminderMins % 60, 0, 0);
      const delayMs = target.getTime() - nowDate.getTime();
      if (delayMs <= 0) return;

      const timeoutId = window.setTimeout(() => {
        sendReminderNotification(prayer, offsetMins);
      }, delayMs);
      reminderTimeoutsRef.current.push(timeoutId);
    });

    return () => {
      clearReminderTimeouts();
    };
  }, [
    clearReminderTimeouts,
    dayKey,
    notificationPermission,
    prayerCards,
    reminderFired,
    reminderOffsets,
    remindersEnabled,
    sendReminderNotification,
  ]);

  const statuses = useMemo(() => {
    const nowMins = now.getHours() * 60 + now.getMinutes();

    return prayerCards.reduce<Record<PrayerName, PrayerStatus>>((acc, prayer, index) => {
      if (completion[prayer.id]) {
        acc[prayer.id] = "completed";
        return acc;
      }

      const prayerStart = toMinutes(prayer.time24);
      const nextPrayer = prayerCards[index + 1];
      const nextPrayerStart = nextPrayer ? toMinutes(nextPrayer.time24) : Number.POSITIVE_INFINITY;

      if (nowMins < prayerStart) {
        acc[prayer.id] = "upcoming";
        return acc;
      }

      if (nowMins >= nextPrayerStart) {
        acc[prayer.id] = "missed";
        return acc;
      }

      acc[prayer.id] = "due";
      return acc;
    }, {} as Record<PrayerName, PrayerStatus>);
  }, [completion, now, prayerCards]);

  const setPrayerCompleted = (id: PrayerName, isCompleted: boolean) => {
    setCompletion((prev) => ({ ...prev, [id]: isCompleted }));
  };

  const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;

    dragState.current = {
      isDown: true,
      startX: event.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
    };
  };

  const stopDrag = () => {
    dragState.current.isDown = false;
  };

  const onDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el || !dragState.current.isDown) return;

    event.preventDefault();
    const x = event.pageX - el.offsetLeft;
    const walk = (x - dragState.current.startX) * 1.35;
    el.scrollLeft = dragState.current.scrollLeft - walk;
  };

  const completedCount = useMemo(() => Object.values(completion).filter(Boolean).length, [completion]);
  const lockedPrayer = useMemo(() => getDuePrayer(now, completion, prayerCards), [completion, now, prayerCards]);
  const completionPercent = (completedCount / prayerCards.length) * 100;
  const confirmDone = lockedPrayer ? confirmPrayerId === lockedPrayer.id : false;

  const unlockPrayer = () => {
    if (!lockedPrayer || !confirmDone) return;
    setCompletion((prev) => ({ ...prev, [lockedPrayer.id]: true }));
    setConfirmPrayerId(null);
  };

  const setReminderOffset = (prayerId: PrayerName, value: string) => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? Math.max(0, Math.min(180, Math.round(parsed))) : 0;
    setReminderOffsets((prev) => ({ ...prev, [prayerId]: safeValue }));
  };

  const enableReminderNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setReminderMessage("this browser doesn’t support notifications.");
      return;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission !== "granted") {
      setRemindersEnabled(false);
      setReminderMessage("notifications are blocked. allow them in browser settings.");
      return;
    }

    setRemindersEnabled(true);
    setReminderMessage("reminders are on.");
  };

  const reflectionLine = useMemo(() => {
    if (completedCount === 5) return "perfect score. you led your day and kept Allah first.";
    if (completedCount >= 3) return "solid discipline today. finish the night strong and close all five.";
    if (completedCount >= 1) return "you showed up. keep locking in and stack the next prayer on time.";
    return "day starts now. one prayer on time can reset your whole rhythm.";
  }, [completedCount]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_20%,#4a1115_0%,#1a0d12_35%,#09080b_75%)] px-4 py-16 text-white sm:px-8 sm:py-10 font-[family-name:var(--font-space-grotesk)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,130,78,0.18)_0%,rgba(255,130,78,0)_45%,rgba(117,220,155,0.12)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_top,rgba(3,22,25,0.95),rgba(3,22,25,0))]" />
      <section className="relative mx-auto flex w-full max-w-6xl flex-col rounded-[2.2rem] border border-white/15 bg-black/35 px-6 py-8 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:px-10 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-amber-300/90">discipline mode</p>
            <h1 className="mt-2 text-5xl font-bold tracking-tight text-white sm:text-6xl">
              Rama
              <span className="bg-gradient-to-r from-amber-300 to-amber-600 bg-clip-text text-transparent">
                danly
              </span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
              real winners never miss salah. your work pauses until you answer the call.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/60">{locationLine}</p>
            {timesError && <p className="mt-2 text-xs text-rose-300">{timesError}</p>}
            <div className="mt-4 flex w-full max-w-3xl flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onPress={() => void loadPrayerTimes()}
                isLoading={isLocating}
                size="lg"
                className="h-12 px-6 text-base font-semibold bg-amber-300/20 text-amber-100 border border-amber-200/35"
              >
                refresh prayer times
              </Button>
              <Button
                as={NextLink}
                href="/setup-location"
                size="lg"
                className="h-12 px-6 text-base font-semibold bg-white/5 text-white border border-white/20"
              >
                setup location
              </Button>
            </div>
            <Card className="mt-4 border border-white/15 bg-white/5 text-white">
              <CardBody className="gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-white/80">pre-athan reminders (minutes before each prayer)</p>
                  <div className="flex items-center gap-2">
                    <Chip
                      variant="flat"
                      className={
                        notificationPermission === "granted"
                          ? "bg-green-300/20 text-green-200 border border-green-300/30"
                          : "bg-amber-300/20 text-amber-200 border border-amber-300/30"
                      }
                    >
                      {notificationPermission}
                    </Chip>
                    <Button
                      size="sm"
                      className="bg-amber-300/20 text-amber-100 border border-amber-200/35"
                      onPress={() => void enableReminderNotifications()}
                    >
                      enable
                    </Button>
                    <Button
                      size="sm"
                      className="bg-white/5 text-white border border-white/20"
                      onPress={() => {
                        setRemindersEnabled(false);
                        setReminderMessage("reminders are off.");
                      }}
                    >
                      turn off
                    </Button>
                  </div>
                </div>
                {reminderMessage && <p className="text-xs text-white/70">{reminderMessage}</p>}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                  {prayerCards.map((prayer) => (
                    <Input
                      key={prayer.id}
                      type="number"
                      min={0}
                      max={180}
                      label={prayer.name}
                      value={String(reminderOffsets[prayer.id] ?? 10)}
                      onValueChange={(value) => setReminderOffset(prayer.id, value)}
                      classNames={{
                        label: "text-white/80",
                        input: "text-white",
                        inputWrapper: "bg-white/5 border-white/20",
                      }}
                    />
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
          <Card className="border border-white/15 bg-white/5 text-white sm:w-[320px]">
            <CardBody className="gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.2em] text-white/70">today&apos;s score</p>
                <Chip color="success" variant="flat">
                  {completedCount}/5 complete
                </Chip>
              </div>
              <Progress
                aria-label="Daily prayer completion progress"
                color="success"
                value={completionPercent}
                classNames={{ indicator: "bg-gradient-to-r from-emerald-400 to-lime-300" }}
              />
              <p className="text-sm text-white/75">{reflectionLine}</p>
            </CardBody>
          </Card>
        </div>

        <div
          ref={scrollerRef}
          className="mt-10 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing"
          onMouseDown={startDrag}
          onMouseLeave={stopDrag}
          onMouseUp={stopDrag}
          onMouseMove={onDrag}
          aria-label="Prayer time cards"
        >
          <motion.div
            className="flex w-max gap-6"
            initial={{ x: 36, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          >
            {prayerCards.map((prayer, index) => (
              <motion.div
                key={prayer.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.45, ease: "easeOut" }}
              >
                <Card className="relative min-h-[300px] w-[250px] overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 text-white shadow-[0_10px_30px_rgba(0,0,0,0.32)]">
                  <CardBody className="h-full justify-between gap-5 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-white/70">{prayer.name}</p>
                        <p className="mt-2 text-4xl font-bold tracking-tight">{prayer.timeLabel}</p>
                      </div>
                      <Chip className={statusChipClass[statuses[prayer.id]]} color={statusStyle[statuses[prayer.id]]}>
                        {statuses[prayer.id]}
                      </Chip>
                    </div>
                    <p className="text-sm text-white/75">{prayer.unlockLine}</p>
                    <Checkbox
                      isSelected={completion[prayer.id]}
                      onValueChange={(isSelected) => setPrayerCompleted(prayer.id, isSelected)}
                      color="default"
                      classNames={{ label: "text-white/90" }}
                    >
                      completed
                    </Checkbox>
                  </CardBody>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <p className="mt-2 text-center text-base text-white/65 sm:text-lg">
          drag sideways to see all prayers
        </p>
      </section>

      {lockedPrayer && (
        <motion.section
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          aria-live="assertive"
          aria-label={`${lockedPrayer.name} lock overlay`}
        >
          <Card className="w-full max-w-xl border border-amber-300/40 bg-zinc-950/90 text-white">
            <CardBody className="gap-6 p-6 sm:p-8">
              <Chip color="warning" variant="shadow" className="w-fit uppercase tracking-[0.2em]">
                workspace locked
              </Chip>
              <div>
                <p className="text-2xl font-bold leading-tight text-amber-300 sm:text-3xl">
                  {lockedPrayer.lockHeadline}
                </p>
                <p className="mt-3 text-sm text-white/80 sm:text-base">{lockedPrayer.lockLine}</p>
              </div>
              <Card className="border border-white/10 bg-white/5 text-white">
                <CardBody className="gap-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/60">current prayer</p>
                  <p className="text-3xl font-bold tracking-tight">
                    {lockedPrayer.name} <span className="text-base text-white/70">({lockedPrayer.timeLabel})</span>
                  </p>
                </CardBody>
              </Card>
              <Checkbox
                isSelected={confirmDone}
                onValueChange={(isSelected) =>
                  setConfirmPrayerId(isSelected ? lockedPrayer.id : null)
                }
                color="success"
                classNames={{
                  label: "text-grey",
                }}
              >
                I completed {lockedPrayer.name} salah and I&apos;m returning with discipline.
              </Checkbox>
              <Button
                color="success"
                size="lg"
                onPress={unlockPrayer}
                isDisabled={!confirmDone}
                className="font-semibold uppercase tracking-[0.16em]"
              >
                unlock workspace
              </Button>
            </CardBody>
          </Card>
        </motion.section>
      )}

      <style jsx>{`
        div[aria-label="Prayer time cards"]::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </main>
  );
}
