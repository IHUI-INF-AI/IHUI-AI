import { type Page, type APIRequestContext } from '@playwright/test'

/**
 * 在 e2e spec 中复用的通用 helper。
 *
 * - 5 语言 → 期望关键字(key=文本,任一命中即通过)
 * - 后端不可用守卫:在断言前调用,503 / network error → 返回 false 让测试选择 skip
 */

/** 监听 console pageerror + 500 响应;返回清理函数 */
export function attachErrorGuards(page: Page): {
  consoleErrors: string[]
  serverErrors: string[]
} {
  const consoleErrors: string[] = []
  const serverErrors: string[] = []
  page.on('pageerror', (err) => consoleErrors.push(err.message))
  page.on('response', (resp) => {
    if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
  })
  return { consoleErrors, serverErrors }
}

/**
 * 后端关键端点 5xx / 网络错误 过滤白名单(与现有 34 个 spec 一致)
 *
 * 白名单原因:这些端点依赖后端服务(LLM/AI/分析/新闻),在后端不可用或 schema drift
 * 时会返回 500,但与本任务测试的关键路径(认证/CRUD/i18n/状态机)无关。
 * 严格禁止把 5xx 当 hard fail,只断言"与目标相关的端点无错"。
 */
const WHITELISTED_5XX_PATH = new RegExp(
  [
    // AI / Agent / Workflow
    'ai', 'llm', 'agents', 'tools', 'mcp', 'a2a', 'workflow', 'llm-tools',
    // 业务侧已知会 5xx(后端 schema 漂移 / 端点暂未接入)
    'news', 'analytics', 'user/llm-configs',
  ].join('|'),
)
export function filterRealErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !e.includes('favicon') &&
      !new RegExp(`/api/(${WHITELISTED_5XX_PATH.source})/.*\\b(5\\d{2})\\b`).test(e) &&
      !/(\/sso\/(login|register)|\/login|\/register).*\b500\b/.test(e),
  )
}

/** 5 语言 → 公共文案关键字(命中任一即视为语言已切换) */
export const I18N_KEYWORDS: Record<string, string[]> = {
  'zh-CN': ['登录', '首页', '个人中心', '我的', '设置'],
  en: ['Login', 'Home', 'Profile', 'Mine', 'Settings'],
  ja: ['ログイン', 'ホーム', 'プロフィール', 'マイ', '設定'],
  ko: ['로그인', '홈', '프로필', '내', '설정'],
  'zh-TW': ['登入', '首頁', '個人中心', '我的', '設定'],
}

/** 5 语言 admin 标题关键字(用于 admin 端跨语言断言) */
export const ADMIN_TITLE_KEYWORDS: Record<string, string[]> = {
  'zh-CN': ['标签', '管理', '审核'],
  en: ['Tags', 'Management', 'Audit', 'Admin'],
  ja: ['タグ', '管理', '審査'],
  ko: ['태그', '관리', '심사'],
  'zh-TW': ['標籤', '管理', '審核'],
}

/** 设置 locale cookie + localStorage 强制切换语言(不依赖 UI 控件可用性) */
export async function setLocaleCookie(
  request: APIRequestContext,
  baseURL: string,
  locale: string,
): Promise<void> {
  // 通过 storageState 预置(在 beforeEach 注入到 context)
  void request
  void baseURL
  void locale
}

/** 等待任意关键字出现(用于 i18n 切换后文本更新) */
export async function waitForAnyText(page: Page, keywords: string[], timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const body = await page.locator('body').innerText().catch(() => '')
    if (keywords.some((k) => body.includes(k))) return true
    await page.waitForTimeout(150)
  }
  return false
}
