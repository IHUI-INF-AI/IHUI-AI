// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import cron, { type ScheduledTask } from 'node-cron'
import type { FastifyBaseLogger } from 'fastify'
import type { Redis } from 'ioredis'
import type { AiWorldAuthoritativeLeaderboard, AiWorldLeaderboardRefresh } from '@ihui/types'
import { DistributedLock } from '../utils/distributed-lock.js'
import { logger } from '../utils/logger.js'
import {
  AUTHORITATIVE_REFRESH_CRON,
  AUTHORITATIVE_REFRESH_TIMEZONE,
  buildAuthoritativeLeaderboard,
  fetchAuthoritativeSources,
} from '../services/authoritative-leaderboard.js'

const SNAPSHOT_KEY = 'ihui:ai-world:authoritative:v1'
const STATE_KEY = 'ihui:ai-world:authoritative:state:v1'
const LOCK_KEY = 'ihui:ai-world:authoritative:lock'
const REFRESH_LOCK_TTL_MS = 15 * 60_000
const STALE_AFTER_MS = 24 * 60 * 60_000
const DEFAULT_CRON = '17 */6 * * *'

export type AuthoritativeRefreshTrigger = 'startup' | 'cron' | 'manual'
export type AuthoritativeRefreshStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped'

export interface AuthoritativeRefreshState {
  status: AuthoritativeRefreshStatus
  trigger: AuthoritativeRefreshTrigger | null
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  lastSuccessAt: string | null
  lastError: string | null
  sources: Record<'aa' | 'lmarena' | 'openrouter', 'ok' | 'failed' | 'unknown'>
}

const IDLE_STATE: AuthoritativeRefreshState = {
  status: 'idle',
  trigger: null,
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  lastSuccessAt: null,
  lastError: null,
  sources: { aa: 'unknown', lmarena: 'unknown', openrouter: 'unknown' },
}

let scheduledTask: ScheduledTask | null = null
let startupTimer: NodeJS.Timeout | null = null
let inProcessRunning = false
let fallbackCache: AiWorldAuthoritativeLeaderboard | null | undefined

function nowIso(): string {
  return new Date().toISOString()
}

function isFresh(lastSuccessAt: string | null | undefined): boolean {
  if (!lastSuccessAt) return false
  const ts = Date.parse(lastSuccessAt)
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts <= STALE_AFTER_MS
}

function normalizeRefresh(
  payload: AiWorldAuthoritativeLeaderboard,
  state: AuthoritativeRefreshState | null,
  mode: 'auto' | 'fallback',
): AiWorldLeaderboardRefresh {
  const lastSuccessAt = payload.refresh?.lastSuccessAt || payload.generatedAt
  return {
    mode,
    schedule: payload.refresh?.schedule || AUTHORITATIVE_REFRESH_CRON,
    timezone: payload.refresh?.timezone || AUTHORITATIVE_REFRESH_TIMEZONE,
    lastSuccessAt,
    lastAttemptAt: state?.startedAt || payload.refresh?.lastAttemptAt || lastSuccessAt,
    lastError: state?.lastError ?? payload.refresh?.lastError ?? null,
    stale: mode === 'fallback' ? true : !isFresh(lastSuccessAt),
  }
}

function readFallback(): AiWorldAuthoritativeLeaderboard | null {
  if (fallbackCache !== undefined) return fallbackCache
  try {
    const raw = readFileSync(
      new URL('../data/authoritative-leaderboard-fallback.json', import.meta.url),
      'utf8',
    )
    const parsed = JSON.parse(raw) as AiWorldAuthoritativeLeaderboard
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.cross)) {
      fallbackCache = null
      return null
    }
    fallbackCache = parsed
    return parsed
  } catch (err) {
    logger.warn('[authoritative-leaderboard] 读取内置底稿失败', { err })
    fallbackCache = null
    return null
  }
}

async function readState(
  redis: Redis | null | undefined,
): Promise<AuthoritativeRefreshState | null> {
  if (!redis) return null
  try {
    const raw = await redis.get(STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthoritativeRefreshState>
    return {
      ...IDLE_STATE,
      ...parsed,
      sources: { ...IDLE_STATE.sources, ...(parsed.sources ?? {}) },
    }
  } catch (err) {
    logger.warn('[authoritative-leaderboard] 读取刷新状态失败', { err })
    return null
  }
}

async function writeState(
  redis: Redis | null | undefined,
  state: AuthoritativeRefreshState,
): Promise<void> {
  if (!redis) return
  try {
    await redis.set(STATE_KEY, JSON.stringify(state))
  } catch (err) {
    logger.warn('[authoritative-leaderboard] 写入刷新状态失败', { err })
  }
}

/**
 * 读取最新快照。
 *
 * Redis 有值就用 Redis；没有就回退到构建期内置底稿，并把 refresh 标成 fallback。
 * 返回的 refresh.stale 由 lastSuccessAt 计算（超过 24 小时即标滞后，页面会显式提示）。
 */
export async function getAuthoritativeLeaderboard(
  redis: Redis | null | undefined,
): Promise<AiWorldAuthoritativeLeaderboard | null> {
  const state = await readState(redis)
  if (redis) {
    try {
      const raw = await redis.get(SNAPSHOT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as AiWorldAuthoritativeLeaderboard
        if (parsed?.schemaVersion === 1 && Array.isArray(parsed.cross)) {
          return { ...parsed, refresh: normalizeRefresh(parsed, state, 'auto') }
        }
        logger.warn('[authoritative-leaderboard] Redis 快照结构异常，回退内置底稿')
      }
    } catch (err) {
      logger.warn('[authoritative-leaderboard] Redis 快照读取失败，回退内置底稿', { err })
    }
  }
  const fallback = readFallback()
  if (!fallback) return null
  return { ...fallback, refresh: normalizeRefresh(fallback, state, 'fallback') }
}

export async function getAuthoritativeRefreshState(
  redis: Redis | null | undefined,
): Promise<AuthoritativeRefreshState> {
  return (await readState(redis)) ?? { ...IDLE_STATE }
}

async function performRefresh(
  redis: Redis | null | undefined,
  log: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>,
  trigger: AuthoritativeRefreshTrigger,
): Promise<AuthoritativeRefreshState> {
  const startedAt = nowIso()
  const startedMs = Date.now()
  const runningState: AuthoritativeRefreshState = {
    ...IDLE_STATE,
    status: 'running',
    trigger,
    startedAt,
    lastSuccessAt: (await getAuthoritativeLeaderboard(redis))?.refresh.lastSuccessAt ?? null,
  }
  await writeState(redis, runningState)

  try {
    log.info({ trigger }, '[authoritative-leaderboard] 开始抓取三家官方源')
    const bundle = await fetchAuthoritativeSources()
    const generatedAt = nowIso()
    const payload = buildAuthoritativeLeaderboard(bundle, {
      generatedAt,
      refresh: {
        mode: 'auto',
        schedule: AUTHORITATIVE_REFRESH_CRON,
        timezone: AUTHORITATIVE_REFRESH_TIMEZONE,
        lastSuccessAt: generatedAt,
        lastAttemptAt: startedAt,
        lastError: null,
        stale: false,
      },
    })
    if (!redis) throw new Error('Redis 不可用，无法持久化权威榜快照')
    await redis.set(SNAPSHOT_KEY, JSON.stringify(payload))
    const finishedAt = nowIso()
    const successState: AuthoritativeRefreshState = {
      status: 'success',
      trigger,
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      lastSuccessAt: generatedAt,
      lastError: null,
      sources: { aa: 'ok', lmarena: 'ok', openrouter: 'ok' },
    }
    await writeState(redis, successState)
    log.info(
      {
        trigger,
        durationMs: successState.durationMs,
        cross: payload.cross.length,
        aa: payload.aa.length,
        lmarena: payload.lmarena.overallCount,
        openrouter: payload.openrouter.length,
        lmarenaAsOf: bundle.lmarena.asOf,
        openrouterAsOf: bundle.openrouter.asOf,
      },
      '[authoritative-leaderboard] 刷新完成',
    )
    return successState
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const failedState: AuthoritativeRefreshState = {
      status: 'failed',
      trigger,
      startedAt,
      finishedAt: nowIso(),
      durationMs: Date.now() - startedMs,
      lastSuccessAt: runningState.lastSuccessAt,
      lastError: message,
      sources: { aa: 'failed', lmarena: 'failed', openrouter: 'failed' },
    }
    await writeState(redis, failedState)
    log.error({ err, trigger }, '[authoritative-leaderboard] 刷新失败，保留上一份快照')
    return failedState
  }
}

/**
 * 执行一次刷新 tick：先抢 Redis 分布式锁，抢不到说明别的实例在跑，直接跳过。
 * Redis 不可用时退化为进程内互斥，保证不会在本进程内重入。
 */
export async function runAuthoritativeRefresh(
  redis: Redis | null | undefined,
  log: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>,
  trigger: AuthoritativeRefreshTrigger,
): Promise<AuthoritativeRefreshState> {
  if (inProcessRunning) {
    log.warn({ trigger }, '[authoritative-leaderboard] 本进程已有刷新在跑，跳过')
    return (
      (await getAuthoritativeRefreshState(redis)) ?? { ...IDLE_STATE, status: 'skipped', trigger }
    )
  }

  if (redis) {
    let lock: Awaited<ReturnType<DistributedLock['tryLock']>> = null
    try {
      lock = await new DistributedLock(redis).tryLock(LOCK_KEY, undefined, {
        ttlMs: REFRESH_LOCK_TTL_MS,
        watchdog: true,
      })
      if (!lock) {
        log.info({ trigger }, '[authoritative-leaderboard] 另一实例正在刷新，跳过本 tick')
        return (
          (await getAuthoritativeRefreshState(redis)) ?? {
            ...IDLE_STATE,
            status: 'skipped',
            trigger,
          }
        )
      }
    } catch (err) {
      log.warn({ err, trigger }, '[authoritative-leaderboard] 抢锁失败，退化为进程内互斥')
    }
    if (!lock && !redis) {
      return { ...IDLE_STATE, status: 'skipped', trigger }
    }
    if (!lock) {
      // 抢锁异常但 Redis 仍然可用：不并发跑，避免两份抓取同时写同一快照。
      return { ...IDLE_STATE, status: 'skipped', trigger, lastError: '锁不可用' }
    }
    inProcessRunning = true
    try {
      return await performRefresh(redis, log, trigger)
    } finally {
      inProcessRunning = false
      try {
        await lock.release()
      } catch (err) {
        log.warn({ err }, '[authoritative-leaderboard] 释放刷新锁失败，等待 TTL 兜底')
      }
    }
  }

  inProcessRunning = true
  try {
    return await performRefresh(null, log, trigger)
  } finally {
    inProcessRunning = false
  }
}

async function refreshIfStale(
  redis: Redis | null | undefined,
  log: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>,
  trigger: AuthoritativeRefreshTrigger,
): Promise<void> {
  const snapshot = await getAuthoritativeLeaderboard(redis)
  if (snapshot && !snapshot.refresh.stale) return
  await runAuthoritativeRefresh(redis, log, trigger)
}

export function startAuthoritativeLeaderboardScheduler(
  redis: Redis,
  log: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>,
): void {
  if (scheduledTask) return
  if (process.env.ENABLE_AUTHORITATIVE_LEADERBOARD === 'false') {
    log.info('[authoritative-leaderboard] 已按 ENABLE_AUTHORITATIVE_LEADERBOARD=false 禁用')
    return
  }
  const expression = cron.validate(AUTHORITATIVE_REFRESH_CRON)
    ? AUTHORITATIVE_REFRESH_CRON
    : DEFAULT_CRON
  if (expression !== AUTHORITATIVE_REFRESH_CRON) {
    log.warn(
      { cron: AUTHORITATIVE_REFRESH_CRON },
      '[authoritative-leaderboard] cron 表达式非法，改用默认',
    )
  }
  scheduledTask = cron.schedule(
    expression,
    () => {
      void runAuthoritativeRefresh(redis, log, 'cron').catch((err) => {
        log.error({ err }, '[authoritative-leaderboard] 定时刷新异常')
      })
    },
    { timezone: AUTHORITATIVE_REFRESH_TIMEZONE },
  )
  log.info(
    { cron: expression, timezone: AUTHORITATIVE_REFRESH_TIMEZONE },
    '[authoritative-leaderboard] 自动刷新已启动',
  )

  // 启动后延迟 45s 补跑一次；只补过期快照，避免每次重启都重复抓取。
  startupTimer = setTimeout(() => {
    void refreshIfStale(redis, log, 'startup').catch((err) => {
      log.error({ err }, '[authoritative-leaderboard] 启动补跑异常')
    })
  }, 45_000)
  startupTimer.unref?.()
}

export function stopAuthoritativeLeaderboardScheduler(): void {
  if (startupTimer) {
    clearTimeout(startupTimer)
    startupTimer = null
  }
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
    logger.info('[authoritative-leaderboard] 自动刷新调度已停止')
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
