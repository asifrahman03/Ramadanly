"use client";

import NextLink from "next/link";
import { Button, Card, CardBody, Chip } from "@heroui/react";
import { HeroGeometric } from "@/components/ui/shape-landing-hero";

const coreFeatures = [
  {
    title: "uncompromising accountability",
    text: "when athan starts, your workspace locks until you confirm you completed salah.",
  },
  {
    title: "hyper-accurate syncing",
    text: "ramadanly detects your location and syncs precise city prayer times with Aladhan API.",
  },
  {
    title: "strategic pre-athan reminders",
    text: "set custom minute offsets so wudu and preparation happen before the call.",
  },
  {
    title: "daily score tracking",
    text: "track your day out of 5 and push for the perfect score with allah first.",
  },
];

const pillars = [
  {
    name: "fajr",
    line: "champions win before sunrise. stand for fajr and open the day with discipline.",
  },
  {
    name: "dhuhr",
    line: "midday reset. pause the grind, answer the call, return with sharper focus.",
  },
  {
    name: "asr",
    line: "finish strong, not scattered. protect your late-game focus.",
  },
  {
    name: "maghrib",
    line: "sunset check-in. heart over hustle. close the day with remembrance.",
  },
  {
    name: "isha",
    line: "close like an elite. seal the night with intention and accountability.",
  },
];

export default function HomePage() {
  return (
    <main className="bg-[radial-gradient(circle_at_10%_20%,#4a1115_0%,#1a0d12_35%,#09080b_75%)] text-white font-[family-name:var(--font-manrope)]">
      <section className="relative">
        <HeroGeometric
          badge="ramadanly"
          title1="elite discipline"
          title2="for salah and focus"
          description="real winners never miss salah. keep allah first while your workflow stays sharp and accountable."
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#09080b]" />
        <div className="absolute inset-x-0 bottom-10 z-20 flex justify-center gap-3 px-4">
          <Button
            as={NextLink}
            href="/workspace"
            size="lg"
            className="bg-amber-300/25 text-amber-100 border border-amber-200/45"
          >
            enter workspace lock app
          </Button>
          <Button as={NextLink} href="/setup-location" size="lg" className="bg-white/5 text-white border border-white/20">
            setup location
          </Button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8">
        <Card className="border border-white/15 bg-black/35 text-white">
          <CardBody className="gap-4 p-6 sm:p-8">
            <Chip className="w-fit bg-amber-300/20 text-amber-200 border border-amber-300/30">workspace lock</Chip>
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight">your work pauses until you answer the call</h2>
            <p className="text-white/75 text-sm sm:text-base max-w-4xl">
              in a world built to distract you, ramadanly acts like a digital accountability partner. when athan sounds,
              excuses end. your workflow hard-stops until you check: “i completed my salah and i&apos;m returning with discipline”.
            </p>
          </CardBody>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8">
        <h3 className="text-xl sm:text-3xl font-semibold tracking-tight">core features built for consistency</h3>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {coreFeatures.map((feature) => (
            <Card key={feature.title} className="border border-white/15 bg-black/35 text-white">
              <CardBody className="gap-2 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-200/90">{feature.title}</p>
                <p className="text-sm text-white/70">{feature.text}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-8">
        <h3 className="text-xl sm:text-3xl font-semibold tracking-tight">the 5 pillars of daily discipline</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {pillars.map((pillar) => (
            <Card key={pillar.name} className="border border-white/15 bg-black/35 text-white">
              <CardBody className="gap-2 p-5">
                <p className="text-sm uppercase tracking-[0.22em] text-amber-200/90">{pillar.name}</p>
                <p className="text-sm text-white/70">{pillar.line}</p>
              </CardBody>
            </Card>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button as={NextLink} href="/workspace" size="lg" className="bg-amber-300/25 text-amber-100 border border-amber-200/45">
            start ramadanly
          </Button>
        </div>
      </section>
    </main>
  );
}
