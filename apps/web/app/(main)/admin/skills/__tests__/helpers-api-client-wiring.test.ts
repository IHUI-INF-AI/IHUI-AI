// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 装车证明(AGENTS.md §3 共享层优先 / 守门 73 同族):admin 技能页 helpers 的**市场列表**
// 调用必须经 @ihui/api-client 出口,不得回退为页面内 api() 直连拼 URL。
//
// 同时钉死"刻意未收口"的三条判定 —— 它们不是遗漏,是量化后的结论,理由是:
//  1) fetchSkills:resource.ts 的 getSkills 解包形态是 PageData(声明 list),而后端
//     GET /api/skills 实际返回 { skills, total },fetchSkills 读的是 .skills —— 硬套恒空。
//  2) page.tsx 的 POST /api/skills 与 DELETE /api/skills/:id 是**非 GET**:web 包装层
//     fetchApi 在它们收到 401 时会弹登录框,而两个 mutation 都没有 onError 分支
//     (SkillTable 只渲染 query error) ⇒ 弹窗是唯一 401 反馈。共享 fetchApi 没有
//     onUnauthorized 钩子可注册,迁移等于把"能弹窗"换成"毫无反应"。
// 故:下面对 api()/fetchApi 的**肯定式**断言是防"下一个人无脑清数字",不是防写错。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const helpersFile = resolve(here, '..', 'helpers.ts')
const pageFile = resolve(here, '..', 'page.tsx')
// here = apps/web/app/(main)/admin/skills/__tests__ → 上溯 7 级到仓库根
const skillsMarketFile = resolve(
  here,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'api-client',
  'src',
  'endpoints',
  'skills-market.ts',
)

/** 取 searchMarketSkills 的函数体(顶层 \n} 收口,体内无列 0 的嵌套块) */
function marketFnBody(src: string): string {
  const m = src.match(/export async function searchMarketSkills[\s\S]*?\n}/)
  if (!m) throw new Error('未找到 searchMarketSkills 函数体 —— 签名被改?断言失效前先修本测试')
  return m[0]
}

describe('helpers.searchMarketSkills 走 @ihui/api-client(共享层优先)', () => {
  const src = readFileSync(helpersFile, 'utf8')

  it('从 @ihui/api-client 导入 fetchMarketSkills', () => {
    expect(src).toMatch(/import\s*\{[^}]*\bfetchMarketSkills\b[^}]*\}\s*from\s*'@ihui\/api-client'/)
  })

  it('函数体内无 api( 直连、无裸 fetch、无手拼 URLSearchParams', () => {
    const body = marketFnBody(src)
    expect(body).not.toMatch(/\bapi\s*\(/)
    expect(body).not.toMatch(/\bfetch\s*\(/)
    expect(body).not.toMatch(/URLSearchParams/)
    expect(body).not.toMatch(/\/api\/skills\/market/)
  })

  it('失败仍按原语义抛错(react-query 错误分支不变)', () => {
    expect(marketFnBody(src)).toMatch(/if \(!r\.success\) throw new Error\(r\.error\)/)
  })
})

describe('未收口三项的判定就地钉死(防无脑清数字)', () => {
  const helpers = readFileSync(helpersFile, 'utf8')
  const page = readFileSync(pageFile, 'utf8')

  it('api() 仍经 web 包装层 @/lib/api 的 fetchApi(非 GET 401 弹登录框的通路在位)', () => {
    expect(helpers).toMatch(/import\s*\{\s*fetchApi\s*\}\s*from\s*'@\/lib\/api'/)
    expect(helpers).toMatch(
      /export async function api<T>[\s\S]*?await fetchApi<[^>]*>\(url, options\)/,
    )
  })

  it('fetchSkills 仍自行解包 .skills(未误套 getSkills 的 PageData 形态)', () => {
    expect(helpers).toMatch(/api<\{\s*skills: Skill\[\]\s*\}>\('\/api\/skills'\)/)
    expect(helpers).not.toMatch(/\bgetSkills\b/)
  })

  it('page.tsx 的建/删两处仍走 api()(401 弹窗依赖未被打断)', () => {
    expect(page).toMatch(/api\('\/api\/skills',\s*\{\s*method: 'POST'/)
    expect(page).toMatch(
      /api\(`\/api\/skills\/\$\{encodeURIComponent\(id\)\}`,\s*\{\s*method: 'DELETE'/,
    )
    // 反向:这两处若被换成 api-client 端点,本文件上方的 api() 通路断言仍绿,
    // 但 401 反馈会静默消失 —— 故此处必须正向点名 method。
    expect(page).not.toMatch(/from\s*'@ihui\/api-client'/)
  })
})

describe('api-client fetchMarketSkills 出口契约', () => {
  const src = readFileSync(skillsMarketFile, 'utf8')

  it('打 /api/skills/market 且用 buildQs 拼参数(不写死查询串)', () => {
    expect(src).toMatch(
      /export function fetchMarketSkills[\s\S]*?\/api\/skills\/market\$\{buildQs\(query\)\}`/,
    )
  })

  it('query 面含 q/tag/page/pageSize 四参(与消费方过滤语义一致)', () => {
    expect(src).toMatch(
      /export interface SkillMarketQuery\s*\{[\s\S]*?q\?: string[\s\S]*?tag\?: string[\s\S]*?page\?: number[\s\S]*?pageSize\?: number[\s\S]*?\}/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
