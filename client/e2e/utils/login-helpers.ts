/**
 * 登录页 e2e 测试共享工具 (2026-07-02 立)
 *
 * 目的: 抽取 login-i18n-screenshots.spec.ts / i18n-no-regression.spec.ts 等
 *       多语言登录测试的通用 setup, 避免 5+ 个 spec 重复实现.
 *
 * 提供:
 *   - injectLocale:  注入 i18n 语言到 localStorage (多 storage key 兜底)
 *   - injectTheme:   注入主题 (light/dark) 到 html.dark + localStorage
 *   - waitForLoginDialog: 等待 LoginDialog 弹窗 + 翻译加载完成
 *   - switchLoginTab:    切换登录 Tab (account/phone)
 *   - switchToRegisterMode: 切换到注册模式 (显示协议文字)
 *   - ASSERTIONS:    5 语言硬断言矩阵
 *   - LOCALES / LOGIN_TABS / THEMES / AUTO_THEMES: 常量
 */

import type { Page } from '@playwright/test'

// 抗噪: PW_BASE_URL 在 Windows PowerShell/cmd 下被引用后可能带尾随空格或引号
// 这里强制 trim 并 strip 引号, 防止 `${BASE}/login` 拼出 "8888 /login" 触发 invalid URL
const _rawBase = process.env.PW_BASE_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:8888'
export const BASE = _rawBase.trim().replace(/^['"]+|['"]+$/g, '')

export const LOCALES = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko'] as const
export type Locale = typeof LOCALES[number]

export const LOGIN_TABS = [
  { value: 'account', label: '账号' },
  { value: 'phone', label: '手机' },
] as const

export const THEMES = ['light', 'dark'] as const
export type Theme = typeof THEMES[number]

// auto 模式: 跟随系统偏好, 需要用 Playwright colorScheme 模拟
// auto-light = auto 模式 + 系统浅色 (colorScheme: 'light')
// auto-dark  = auto 模式 + 系统暗色 (colorScheme: 'dark')
export const AUTO_THEMES = ['auto-light', 'auto-dark'] as const
export type AutoTheme = typeof AUTO_THEMES[number]

/**
 * 5 语言硬断言矩阵 (登录模式 Tab + 注册模式协议)
 */
export const ASSERTIONS: Record<Locale, {
  loginTabs: { account: string; phone: string }
  registerAgreement: { prefixContains: string; userAgreement: string; privacyPolicy: string }
}> = {
  'zh-CN': {
    loginTabs: { account: '账号登录', phone: '手机登录' },
    registerAgreement: { prefixContains: '我已阅读', userAgreement: '《用户协议》', privacyPolicy: '《隐私政策》' },
  },
  en: {
    loginTabs: { account: 'Account Login', phone: 'Phone Login' },
    registerAgreement: { prefixContains: 'I have read', userAgreement: 'User Agreement', privacyPolicy: 'Privacy Policy' },
  },
  'zh-TW': {
    loginTabs: { account: '賬號登錄', phone: '手機登錄' },
    registerAgreement: { prefixContains: '我已閱讀', userAgreement: '《用戶協議》', privacyPolicy: '《隱私政策》' },
  },
  ja: {
    loginTabs: { account: 'アカウントログイン', phone: '携帯ログイン' },
    registerAgreement: { prefixContains: '読み', userAgreement: '《ユーザー利用規約》', privacyPolicy: '《プライバシーポリシー》' },
  },
  ko: {
    loginTabs: { account: '계정 로그인', phone: '휴대폰 로그인' },
    registerAgreement: { prefixContains: '읽고', userAgreement: '《사용자 약관》', privacyPolicy: '《개인정보 보호정책》' },
  },
}

/**
 * 注入 i18n 语言到 localStorage
 * 多种 storage key 兜底 (项目历史原因可能有变化)
 */
export async function injectLocale(page: Page, locale: Locale): Promise<void> {
  await page.addInitScript((loc: string) => {
    try {
      const keys = ['i18n-locale', 'locale', 'app-locale', 'preferred-locale', 'i18n_locale', 'language']
      for (const k of keys) {
        window.localStorage.setItem(k, JSON.stringify({ value: loc }))
      }
      window.localStorage.setItem('language', loc)
      window.localStorage.setItem('el-locale', loc)
    } catch {
      /* ignore */
    }
  }, locale)
}

/** 注入主题到 html.dark + localStorage */
export async function injectTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((t: string) => {
    try {
      window.localStorage.setItem('theme-mode', JSON.stringify({ value: t }))
      document.documentElement.classList.toggle('dark', t === 'dark')
    } catch {
      /* ignore */
    }
  }, theme)
}

/**
 * 注入 auto 主题模式 (跟系统偏好)
 * 需配合 Playwright context option colorScheme 使用
 * auto-light: localStorage 设 auto + colorScheme: 'light'
 * auto-dark:  localStorage 设 auto + colorScheme: 'dark'
 */
export async function injectAutoTheme(page: Page, autoTheme: AutoTheme): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('theme-mode', JSON.stringify({ value: 'auto' }))
      // 不手动加 dark class, 让 darkMode.ts 的 auto 逻辑根据 prefers-color-scheme 决定
    } catch {
      /* ignore */
    }
  })
  // colorScheme 在 context 级别设置 (通过 test.use({ colorScheme: ... }))
  // 这里只设 localStorage, 实际 dark/light 由浏览器 prefers-color-scheme 决定
}

/** 等待 LoginDialog 弹窗 + 翻译加载完成 */
export async function waitForLoginDialog(page: Page): Promise<void> {
  await page.waitForSelector('.el-dialog.login-dialog', { state: 'visible', timeout: 15_000 })
  await page.waitForSelector('.login-tabs .el-tabs__item', { state: 'visible' })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(500)
}

/** 切换到目标 Tab (登录模式) */
export async function switchLoginTab(page: Page, tabValue: 'account' | 'phone'): Promise<void> {
  if (tabValue === 'account') return
  const tabItem = page.locator('.login-tabs .el-tabs__item').nth(1)
  await tabItem.click({ timeout: 5_000 })
  await page.waitForTimeout(300)
}

/** 切换到注册模式 (显示协议文字) */
export async function switchToRegisterMode(page: Page): Promise<void> {
  const toggleBtn = page.locator('.mode-toggle-btn, .login-content button:has-text("注册"), .login-content button:has-text("Register")').first()
  if (await toggleBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await toggleBtn.click({ timeout: 3_000 }).catch(() => {})
    await page.waitForTimeout(400)
  }
}

/**
 * 检测页面是否有 i18n 键名裸露 (xxx.yyy 形式)
 * 返回命中的键名数组 (空数组 = 无裸露)
 */
export async function detectExposedKeys(page: Page): Promise<string[]> {
  const bodyText = await page.locator('body').textContent().catch(() => '')
  if (!bodyText) return []
  const matches = bodyText.match(/\b(login|auth|app|nav|home|footer|common|tabs|agreement)\.[a-z][a-zA-Z0-9]+/g)
  return matches ? [...new Set(matches)] : []
}

/** i18n 键名裸露正则 (含点号的键名) */
export const EXPOSED_KEY_PATTERN = /\b[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]+\b/
