// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 装车证明(AGENTS.md §3 共享层优先 / 守门 73 同族):admin 技能页的**全部**后端调用
// 必须经 @ihui/api-client 出口,不得回退为页面内 api() 直连拼 URL。
//
// 本目录曾有"刻意不收口"的三处,2026-09-25 全部迁移完成,三条阻塞理由逐条被消除:
//  1) fetchSkills —— getSkills 此前声明 `PageData`(list),后端实返 `{skills,total}`,
//     硬套恒空。现出口类型改为 SkillListResponse(与后端逐键同值),解包点 `.skills`。
//  2) 3) page.tsx 的 POST / DELETE 两处是**非 GET**,此前唯一的 401 反馈来自 web 包装层
//     fetchApi 的弹窗逻辑,而共享包没有注册口 ⇒ 迁移等于"点了没反应"。现共享包补了
//     setUnauthorizedHandler(client.ts),apps/web/src/lib/api.ts 把**与包装层同一份**
//     requestLoginDialogForUnauthorized 注册进去,弹窗通路不再依赖走不走包装层。
//     DELETE 出口历史上不编码 :id(调用点自行编码)⇒ 编码收口进出口,调用点删除。
// 下面既有**肯定式**(必须走出口)也有**否定式**(不得重新拼 URL / 不得解 .list)断言:
// 判错的表行上一票已经证明会有,所以出口契约本身也在这里钉死。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const helpersFile = resolve(here, '..', 'helpers.ts')
const pageFile = resolve(here, '..', 'page.tsx')
// here = apps/web/app/(main)/admin/skills/__tests__ → 上溯 7 级到仓库根
const toRoot = (...tail: string[]) =>
  resolve(here, ...Array.from({ length: 7 }, () => '..'), ...tail)
const skillsMarketFile = toRoot('packages', 'api-client', 'src', 'endpoints', 'skills-market.ts')
const resourceFile = toRoot('packages', 'api-client', 'src', 'endpoints', 'resource.ts')
const webApiFile = toRoot('apps', 'web', 'src', 'lib', 'api.ts')

/** 取 searchMarketSkills 的函数体(顶层 \n} 收口,体内无列 0 的嵌套块) */
function marketFnBody(src: string): string {
  const m = src.match(/export async function searchMarketSkills[\s\S]*?\n}/)
  if (!m) throw new Error('未找到 searchMarketSkills 函数体 —— 签名被改?断言失效前先修本测试')
  return m[0]
}

/** 同上,按函数名取体(端内 helper 与 api-client 出口共用这一把尺子) */
function fnBody(src: string, name: string): string {
  const m = src.match(new RegExp(`export (?:async )?function ${name}[\\s\\S]*?\\n}`))
  if (!m) throw new Error(`未找到 ${name} 函数体 —— 签名被改?断言失效前先修本测试`)
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

describe('三处迁移的装车断言(端内一律经出口)', () => {
  const helpers = readFileSync(helpersFile, 'utf8')
  const page = readFileSync(pageFile, 'utf8')

  it('helpers 从 @ihui/api-client 导入三个出口,且全目录不再要 web 包装层', () => {
    expect(helpers).toMatch(
      /import\s*\{[^}]*\bcreateSkill\b[^}]*\bdeleteSkill\b[^}]*\bgetSkills\b[^}]*\}\s*from\s*'@ihui\/api-client'/,
    )
    // 端内 api()/fetchApi 直连通路必须彻底断掉(迁移前它是唯一的 401 通路)
    expect(helpers).not.toMatch(/from\s*'@\/lib\/api'/)
    expect(helpers).not.toMatch(/fetchApi\s*[<(]|await\s+fetch\s*\(/)
    expect(page).not.toMatch(/from\s*'@ihui\/api-client'/) // 端点调用收在 helpers,页面不直连
  })

  it('page.tsx 两处 mutation 走 helpers 包装,不再手拼 /api/skills URL 与方法', () => {
    expect(page).toMatch(/return postSkill\(body\)/)
    // 形参名随"以 name 为身份"收口改为 name(条目没有 id;见 types.ts 的 Skill 注释与
    // skill-table-name-identity.test.tsx)。本锚点判的是"走 helpers 包装、不手拼 URL/方法"。
    expect(page).toMatch(/mutationFn:\s*\(name: string\)\s*=>\s*removeSkill\(name\)/)
    expect(page).not.toMatch(/\/api\/skills/)
    expect(page).not.toMatch(/method:\s*'(POST|DELETE)'/)
  })

  it('失败语义与迁移前 api() 逐字一致(三个包装函数各自 if (!r.success) throw)', () => {
    // 逐函数判,不按整文件计数 —— 整文件计数会被本文件头注里引用的那句原文顶上去
    for (const name of ['postSkill', 'removeSkill', 'fetchSkills']) {
      expect(fnBody(helpers, name)).toMatch(/if \(!r\.success\) throw new Error\(r\.error\)/)
    }
  })

  it('fetchSkills 解 .skills 且不得退回 PageData 的 .list', () => {
    const body = fnBody(helpers, 'fetchSkills')
    expect(body).toMatch(/r\.data\?\.skills \?\? \[\]/)
    expect(body).not.toMatch(/\.list/)
  })

  it('401 弹窗通路在位:web 端把包装层同一个函数注册给共享包', () => {
    const web = readFileSync(webApiFile, 'utf8')
    expect(web).toMatch(
      /setUnauthorizedHandler\(\(ctx\)\s*=>\s*requestLoginDialogForUnauthorized\(ctx\.method\)\)/,
    )
    // 包装层与钩子共用一份实现(不得复制第二份判断)
    expect(web.match(/requestLoginDialogForUnauthorized/g)!.length).toBeGreaterThanOrEqual(3)
  })
})

describe('api-client 出口契约(getSkills / deleteSkill)', () => {
  const src = readFileSync(resourceFile, 'utf8')

  it('getSkills 的响应类型与后端实返键名同值({ skills, total }),不再是 PageData', () => {
    expect(src).toMatch(
      /export interface SkillListResponse\s*\{\s*\n\s*skills: Skill\[\]\s*\n\s*total: number\s*\n\s*\}/,
    )
    const body = fnBody(src, 'getSkills')
    expect(body).toMatch(/fetchApi<SkillListResponse>\(`\/api\/skills\$\{buildQs\(query\)\}`\)/)
    expect(body).not.toMatch(/PageData/)
  })

  it('deleteSkill 对 :id 做 encodeURIComponent(调用点无须再编码)', () => {
    const body = fnBody(src, 'deleteSkill')
    expect(body).toMatch(/\/api\/skills\/\$\{encodeURIComponent\(id\)\}/)
    expect(body).toMatch(/method:\s*'DELETE'/)
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
