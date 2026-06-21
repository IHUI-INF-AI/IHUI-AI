/**
 * 通用 Page Actions 工具
 * 集中处理导航 / 点击 / 滚动 / 等待等常用操作
 */

import type { Page, Locator } from '@playwright/test'
import { expect } from '@playwright/test'

export const DEFAULT_TIMEOUT = 8000
export const LONG_TIMEOUT = 15000
export const NAV_TIMEOUT = 25000

export async function gotoStable(page: Page, path: string, opts: { timeout?: number; waitSelector?: string } = {}) {
  const timeout = opts.timeout ?? NAV_TIMEOUT
  await page.goto(path, { waitUntil: 'load', timeout })
  if (opts.waitSelector) {
    await page.waitForSelector(opts.waitSelector, { timeout: opts.timeout ?? LONG_TIMEOUT })
  }
}

export async function waitVisible(locator: Locator, timeout = DEFAULT_TIMEOUT) {
  await expect(locator).toBeVisible({ timeout })
}

export async function safeClick(locator: Locator, timeout = DEFAULT_TIMEOUT) {
  await expect(locator).toBeVisible({ timeout })
  await locator.click({ timeout })
}

export async function scrollIntoViewIfNeeded(locator: Locator, timeout = DEFAULT_TIMEOUT) {
  await expect(locator).toBeInViewport({ timeout })
}

export async function clearLocalStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

export async function setLocalStorage(page: Page, key: string, value: unknown) {
  await page.evaluate((args: { k: string; v: unknown }) => {
    localStorage.setItem(args.k, typeof args.v === 'string' ? args.v : JSON.stringify(args.v))
  }, { k: key, v: value })
}

export async function getLocalStorage<T = unknown>(page: Page, key: string): Promise<T | null> {
  return page.evaluate((k: string) => {
    const v = localStorage.getItem(k)
    if (v == null) return null
    try { return JSON.parse(v) as T } catch { return v as unknown as T }
  }, key)
}

export async function removeLocalStorage(page: Page, key: string) {
  await page.evaluate((k: string) => localStorage.removeItem(k), key)
}

export async function expectEventually<T>(fn: () => Promise<T>, validate: (v: T) => boolean, timeout = DEFAULT_TIMEOUT, interval = 200): Promise<T> {
  const start = Date.now()
  let lastError: unknown
  while (Date.now() - start < timeout) {
    try {
      const v = await fn()
      if (validate(v)) return v
    } catch (e) { lastError = e }
    await new Promise(r => setTimeout(r, interval))
  }
  if (lastError) throw lastError
  throw new Error(`expectEventually timed out after ${timeout}ms`)
}
