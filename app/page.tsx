"use client";

import { Button, Card, CardBody, Checkbox, Chip, Input, Progress, Select, SelectItem } from "@heroui/react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type PrayerStatus = "upcoming" | "missed" | "completed";
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

const ALADHAN_API_BASE_URL = "https://api.aladhan.com/v1/timingsByCity";
const BIGDATACLOUD_BASE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const countryOptions = [
  "United States",
  "Canada",
  "United Kingdom",
  "Saudi Arabia",
  "Pakistan",
  "India",
  "United Arab Emirates",
  "Egypt",
  "Turkey",
  "Malaysia",
  "Indonesia",
];
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

const statusStyle: Record<PrayerStatus, StatusColor> = {
  upcoming: "warning",
  missed: "danger",
  completed: "success",
};
const statusChipClass: Record<PrayerStatus, string> = {
  upcoming: "bg-amber-300/20 text-amber-200 border border-amber-300/30",
  missed: "bg-rose-300/20 text-rose-200 border border-rose-300/30",
  completed: "bg-white/12 text-white border border-white/35",
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

const getDuePrayer = (now: Date, completion: CompletionMap, cards: PrayerCard[]) => {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return cards.find((prayer) => nowMins >= toMinutes(prayer.time24) && !completion[prayer.id]) ?? null;
};

export default function Home() {
  const [now, setNow] = useState(() => new Date());
  const [completion, setCompletion] = useState<CompletionMap>(() => getCompletionForKey(localDateKey()));
  const [confirmPrayerId, setConfirmPrayerId] = useState<PrayerName | null>(null);
  const [prayerCards, setPrayerCards] = useState<PrayerCard[]>(fallbackPrayerCards);
  const [locationLine, setLocationLine] = useState("syncing your city prayer times...");
  const [timesError, setTimesError] = useState<string | null>(null);
  const [manualCity, setManualCity] = useState("");
  const [manualCountry, setManualCountry] = useState("United States");
  const [isManualLoading, setIsManualLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const dayKey = useMemo(() => localDateKeyFromDate(now), [now]);

  const loadPrayerTimes = useCallback(async () => {
    try {
      setIsLocating(true);
      setTimesError(null);
      setLocationLine("syncing your city prayer times...");
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
      setManualCountry(country);

      const timingsRes = await fetch(
        `${ALADHAN_API_BASE_URL}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=2`,
      );
      if (!timingsRes.ok) throw new Error("unable to fetch prayer times");
      const timingsData = (await timingsRes.json()) as AladhanTimingResponse;

      setPrayerCards(buildPrayerCards(timingsData.data.timings));
      setLocationLine(`${city}, ${country}`);
    } catch {
      setPrayerCards(fallbackPrayerCards);
      setLocationLine("location sync unavailable - using fallback schedule");
      setTimesError("allow location access for accurate city prayer times.");
    } finally {
      setIsLocating(false);
    }
  }, []);

  const onManualSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualCity.trim()) return;

    try {
      setIsManualLoading(true);
      setTimesError(null);
      const timingsRes = await fetch(
        `${ALADHAN_API_BASE_URL}?city=${encodeURIComponent(manualCity.trim())}&country=${encodeURIComponent(manualCountry)}&method=2`,
      );
      if (!timingsRes.ok) throw new Error("unable to fetch prayer times");
      const timingsData = (await timingsRes.json()) as AladhanTimingResponse;
      setPrayerCards(buildPrayerCards(timingsData.data.timings));
      setLocationLine(`${manualCity.trim()}, ${manualCountry}`);
    } catch {
      setTimesError("couldn’t find that city. try format like: chicago");
    } finally {
      setIsManualLoading(false);
    }
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow((prev) => {
        const next = new Date();
        const prevDay = localDateKeyFromDate(prev);
        const nextDay = localDateKeyFromDate(next);
        if (prevDay !== nextDay) {
          setCompletion(getCompletionForKey(nextDay));
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

  const statuses = useMemo(() => {
    const nowMins = now.getHours() * 60 + now.getMinutes();

    return prayerCards.reduce<Record<PrayerName, PrayerStatus>>((acc, prayer) => {
      if (completion[prayer.id]) {
        acc[prayer.id] = "completed";
        return acc;
      }

      acc[prayer.id] = nowMins < toMinutes(prayer.time24) ? "upcoming" : "missed";
      return acc;
    }, {} as Record<PrayerName, PrayerStatus>);
  }, [completion, now, prayerCards]);

  const setPrayerCompleted = (id: PrayerName, isCompleted: boolean) =>
    setCompletion((prev) => ({ ...prev, [id]: isCompleted }));

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

  const reflectionLine = useMemo(() => {
    if (completedCount === 5) return "perfect score. you led your day and kept Allah first.";
    if (completedCount >= 3) return "solid discipline today. finish the night strong and close all five.";
    if (completedCount >= 1) return "you showed up. keep locking in and stack the next prayer on time.";
    return "day starts now. one prayer on time can reset your whole rhythm.";
  }, [completedCount]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_20%,#4a1115_0%,#1a0d12_35%,#09080b_75%)] px-4 py-8 text-white sm:px-8 sm:py-10 font-[family-name:var(--font-space-grotesk)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,130,78,0.18)_0%,rgba(255,130,78,0)_45%,rgba(117,220,155,0.12)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_top,rgba(3,22,25,0.95),rgba(3,22,25,0))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-56 items-end justify-between px-2 opacity-70 sm:px-8">
        {pillarClasses.map((pillarClass, index) => (
          <div key={pillarClass + index} className="flex flex-col items-center justify-end">
            <div className={`relative ${pillarClass} rounded-t-[999px] border border-amber-100/30 bg-[linear-gradient(to_top,rgba(216,145,75,0.35),rgba(34,26,24,0.8))]`}>
              <div className="absolute left-1/2 top-3 h-1 w-2/3 -translate-x-1/2 rounded-full bg-amber-100/35" />
              <div className="absolute left-1/2 top-8 h-[55%] w-[2px] -translate-x-1/2 bg-amber-100/25" />
              <div className="absolute left-1/2 bottom-3 h-1 w-2/3 -translate-x-1/2 rounded-full bg-amber-100/25" />
            </div>
            <div className="h-2 w-[115%] rounded-sm bg-amber-100/20" />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[repeating-radial-gradient(circle_at_22px_100%,rgba(248,200,126,0.22)_0_16px,transparent_16px_44px)] opacity-50" />
      <section className="relative mx-auto flex w-full max-w-6xl flex-col rounded-[2.2rem] border border-white/15 bg-black/35 px-6 py-8 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:px-10 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-amber-300/90">discipline mode</p>
            <h1 className="mt-2 text-5xl font-bold tracking-tight text-white sm:text-6xl">Ramadanly</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
              real winners never miss salah. your work pauses until you answer the call.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/60">{locationLine}</p>
            {timesError && <p className="mt-2 text-xs text-rose-300">{timesError}</p>}
            <form onSubmit={onManualSearch} className="mt-4 flex w-full max-w-3xl flex-col gap-2 sm:flex-row">
              <Input
                value={manualCity}
                onValueChange={setManualCity}
                placeholder="search city (ex: chicago)"
                variant="bordered"
                radius="md"
                classNames={{
                  input: "text-white",
                  inputWrapper: "bg-white/5 border-white/20",
                }}
              />
              <Select
                aria-label="Country"
                selectedKeys={[manualCountry]}
                onSelectionChange={(keys) => {
                  if (keys === "all") return;
                  const selected = Array.from(keys)[0];
                  if (selected) setManualCountry(String(selected));
                }}
                variant="bordered"
                radius="md"
                className="sm:max-w-[220px]"
                classNames={{
                  trigger: "bg-white/5 border-white/20",
                  value: "text-white",
                }}
              >
                {countryOptions.map((country) => (
                  <SelectItem key={country}>{country}</SelectItem>
                ))}
              </Select>
              <Button
                type="submit"
                isLoading={isManualLoading}
                className="bg-white/10 text-white border border-white/20"
              >
                update times
              </Button>
              <Button
                type="button"
                onPress={() => void loadPrayerTimes()}
                isLoading={isLocating}
                className="bg-amber-300/20 text-amber-100 border border-amber-200/35"
              >
                use my location
              </Button>
            </form>
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
                onValueChange={(isSelected) => setConfirmPrayerId(isSelected ? lockedPrayer.id : null)}
                color="success"
              >
                i completed {lockedPrayer.name} salah and i&apos;m returning with discipline.
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
