"use client";

import { Button, Card, CardBody, Input, Select, SelectItem } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

export default function SetupLocationPage() {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("United States");
  const [message, setMessage] = useState("set your city so prayer times stay accurate.");
  const [isFinding, setIsFinding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as SavedLocation;
      if (parsed.city) setCity(parsed.city);
      if (parsed.country) setCountry(parsed.country);
    } catch {
      // ignore malformed local value
    }
  }, []);

  const fetchPrayerTimes = async (nextCity: string, nextCountry: string) => {
    const res = await fetch(
      `${ALADHAN_API_BASE_URL}?city=${encodeURIComponent(nextCity)}&country=${encodeURIComponent(nextCountry)}&method=2`,
    );
    if (!res.ok) throw new Error("failed prayer lookup");
  };

  const onUseLocation = async () => {
    try {
      setIsFinding(true);
      setMessage("requesting your location...");
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
      if (!geoRes.ok) throw new Error("location failed");
      const geoData = (await geoRes.json()) as ReverseGeoResponse;
      const foundCity = geoData.city ?? geoData.locality ?? geoData.principalSubdivision;
      const foundCountry = geoData.countryName;
      if (!foundCity || !foundCountry) throw new Error("incomplete location");
      setCity(foundCity);
      setCountry(foundCountry);
      setMessage("location found. save to continue.");
    } catch {
      setMessage("couldn’t get location. enter city manually.");
    } finally {
      setIsFinding(false);
    }
  };

  const onSave = async () => {
    if (!city.trim()) {
      setMessage("enter your city first.");
      return;
    }

    try {
      setIsSaving(true);
      await fetchPrayerTimes(city.trim(), country);
      window.localStorage.setItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify({ city: city.trim(), country } satisfies SavedLocation),
      );
      router.push("/");
    } catch {
      setMessage("city/country not found. try another city spelling.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_18%,#4f1318_0%,#1a0d12_35%,#09080b_75%)] px-4 py-16 text-white sm:px-8">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(to_top,rgba(3,22,25,0.95),rgba(3,22,25,0))]" />
      <section className="mx-auto w-full max-w-2xl">
        <Card className="border border-white/20 bg-black/35 text-white shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <CardBody className="gap-5 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300/90">setup location</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">lock in your prayer city</h1>
            <p className="text-sm text-white/75">{message}</p>

            <Input
              value={city}
              onValueChange={setCity}
              placeholder="search city (ex: chicago)"
              variant="bordered"
              radius="md"
              classNames={{
                input: "text-white",
                inputWrapper: "bg-white/5 border-white/20 min-h-12",
              }}
            />

            <Select
              aria-label="Country"
              selectedKeys={[country]}
              onSelectionChange={(keys) => {
                if (keys === "all") return;
                const selected = Array.from(keys)[0];
                if (selected) setCountry(String(selected));
              }}
              variant="bordered"
              radius="md"
              classNames={{
                trigger: "bg-white/5 border-white/20 text-white min-h-12",
                value: "text-white data-[has-value=false]:text-white/70",
                selectorIcon: "text-white/80",
              }}
              renderValue={(items) => (
                <span className="text-white">{items.map((item) => item.textValue).join(", ")}</span>
              )}
            >
              {countryOptions.map((item) => (
                <SelectItem key={item}>{item}</SelectItem>
              ))}
            </Select>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onPress={onSave}
                isLoading={isSaving}
                size="lg"
                className="h-12 px-6 text-base font-semibold bg-white/10 text-white border border-white/20"
              >
                save and continue
              </Button>
              <Button
                onPress={onUseLocation}
                isLoading={isFinding}
                size="lg"
                className="h-12 px-6 text-base font-semibold bg-amber-300/20 text-amber-100 border border-amber-200/35"
              >
                use my location
              </Button>
            </div>
          </CardBody>
        </Card>
      </section>
    </main>
  );
}
