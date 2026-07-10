/**
 * 等待稳定性工具
 * 解决懒加载 / 异步渲染 / 字体加载导致的 flakiness
 */

import type { Page, Locator } from '@playwright/test'

export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout })
  } catch {
    // ignore
  }
}

export async function waitForFontsLoaded(page: Page, timeout = 3000) {
  try {
    await page.evaluate((t: number) => Promise.race([
      (document as any).fonts.ready,
      new Promise(resolve => setTimeout(resolve, t)),
    ]), timeout)
  } catch {
    // ignore
  }
}

export async function waitForImagesLoaded(page: Page, timeout = 5000) {
  try {
    await page.evaluate((t: number) => Promise.race([
      Promise.all(Array.from(document.images).map(img => {
        if (img.complete) return Promise.resolve()
        return new Promise(resolve => {
          img.addEventListener('load', resolve)
          img.addEventListener('error', resolve)
        })
      })),
      new Promise(resolve => setTimeout(resolve, t)),
    ]), timeout)
  } catch {
    // ignore
  }
}

export async function waitStable(page: Page, timeout = 3000) {
  await waitForNetworkIdle(page, timeout)
  await waitForFontsLoaded(page, timeout)
  await waitForImagesLoaded(page, timeout)
}

export async function waitElementStable(locator: Locator, timeout = 3000) {
  await locator.waitFor({ state: 'visible', timeout })
  await locator.evaluate((el: HTMLElement) => new Promise<void>((resolve) => {
    if (!el.isConnected) return resolve()
    const obs = new MutationObserver(() => {
      if (!document.body.contains(el)) { obs.disconnect(); resolve() }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { obs.disconnect(); resolve() }, timeout)
  }))
}
