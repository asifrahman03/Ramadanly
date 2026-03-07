import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { PushSubscriptionRecord } from "@/lib/push/types";

const SUB_INDEX_KEY = "ramadanly:push:subs";
const FIRED_PREFIX = "ramadanly:push:fired";

const memoryStore = new Map<string, PushSubscriptionRecord>();
const memoryFired = new Set<string>();

const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

const getIdFromEndpoint = (endpoint: string) => createHash("sha1").update(endpoint).digest("hex");
const subKey = (id: string) => `ramadanly:push:sub:${id}`;

export const toSubscriptionId = (endpoint: string) => getIdFromEndpoint(endpoint);

export const saveSubscription = async (record: PushSubscriptionRecord) => {
  if (!redis) {
    memoryStore.set(record.id, record);
    return;
  }

  await redis.set(subKey(record.id), record);
  await redis.sadd(SUB_INDEX_KEY, record.id);
};

export const removeSubscriptionByEndpoint = async (endpoint: string) => {
  const id = getIdFromEndpoint(endpoint);

  if (!redis) {
    memoryStore.delete(id);
    return;
  }

  await redis.del(subKey(id));
  await redis.srem(SUB_INDEX_KEY, id);
};

export const listSubscriptions = async (): Promise<PushSubscriptionRecord[]> => {
  if (!redis) {
    return [...memoryStore.values()];
  }

  const ids = (await redis.smembers<string[]>(SUB_INDEX_KEY)) ?? [];
  if (!ids.length) return [];

  const values = await redis.mget<PushSubscriptionRecord[]>(...ids.map((id) => subKey(id)));
  return values.filter((item): item is PushSubscriptionRecord => Boolean(item));
};

const firedKey = (dateKey: string, subId: string, prayerId: string, type: "reminder" | "athan") =>
  `${FIRED_PREFIX}:${dateKey}:${subId}:${prayerId}:${type}`;

export const hasFired = async (dateKey: string, subId: string, prayerId: string, type: "reminder" | "athan") => {
  const key = firedKey(dateKey, subId, prayerId, type);

  if (!redis) {
    return memoryFired.has(key);
  }

  const value = await redis.get<string | null>(key);
  return value === "1";
};

export const markFired = async (dateKey: string, subId: string, prayerId: string, type: "reminder" | "athan") => {
  const key = firedKey(dateKey, subId, prayerId, type);

  if (!redis) {
    memoryFired.add(key);
    return;
  }

  await redis.set(key, "1", { ex: 60 * 60 * 48 });
};

export const usingPersistentStore = Boolean(redis);
