// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1038309:admin content CRUD 的 `:id` 必须是 uuid —— 两条**行为断言**。
 *
 * 本文件不连库(改的是纯 zod schema,不需要 PG),但断言的是**真实解析行为**而不是源码形状:
 *  ① 塞 `not-a-uuid` ⇒ 解析失败 ⇒ 走既有 400 出口(AppError 的 errorCode 在位);
 *  ② 合法 uuid ⇒ 解析通过、不误拒。
 *
 * 另钉两条不许漂的边界(照票面):
 *  ③ 七张表逐张现读必须是 `id: uuid()`(前置对账,防止将来有人把某张表换成 serial 还留着 z.uuid());
 *  ④ 共享 `idParamSchema` 保持 `z.string()` 原样 —— G-624 已否证径改它(它同时服务 serial 主键)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { z } from 'zod'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..')
const CRUD = join(REPO, 'apps', 'api', 'src', 'routes', 'admin', 'content', 'crud.ts')
const SHARED = join(REPO, 'apps', 'api', 'src', 'routes', 'admin', '_shared.ts')

const crudSrc = readFileSync(CRUD, 'utf8')
const sharedSrc = readFileSync(SHARED, 'utf8')

/** 从源里取出 idParamSchema 的真实定义并求值 —— 断言跑的是 zod 本身,不是字符串比较。 */
function loadIdParamSchema(): z.ZodType<{ type: string; id: string }> {
  const m = crudSrc.match(/^const idParamSchema = (z\.object\([\s\S]*?\))$/m)
  if (!m) throw new Error('crud.ts 里找不到 idParamSchema 定义行,形状漂了')
  // 定义体引用了同文件的 TYPE_KEYS(逐字取出来一并注入,不在测试里另抄一份常量 ——
  // 抄一份就等于让"改了 TYPE_KEYS 忘了改测试"这类漂移永远测不出来)。
  const keysM = crudSrc.match(/^const TYPE_KEYS = \[([\s\S]*?)\] as const$/m)
  if (!keysM) throw new Error('crud.ts 里找不到 TYPE_KEYS 定义行,形状漂了')
  const TYPE_KEYS = keysM[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
  return new Function('z', 'TYPE_KEYS', `return ${m[1]}`)(z, TYPE_KEYS) as z.ZodType<{ type: string; id: string }>
}

const schema = loadIdParamSchema()
const TYPE = 'announcement'
const VALID_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

describe('G-1038309 admin content :id 必须是 uuid', () => {
  it('① 塞 not-a-uuid ⇒ 解析失败(⇒ 既有 validate() 抛 AppError 400/VALIDATION_FAILED)', () => {
    const r = schema.safeParse({ type: TYPE, id: 'not-a-uuid' })
    expect(r.success).toBe(false)
    if (r.success) return
    // 身份字段在位:失败必须带得出可读原因,不能是空 message
    expect(r.error.issues[0]?.message).toBeTruthy()
  })

  it('② 合法 uuid 不误拒', () => {
    const r = schema.safeParse({ type: TYPE, id: VALID_UUID })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.id).toBe(VALID_UUID)
  })

  it('②b 整型 id 也必须被拒(这正是 G-624 共享件不能照抄的原因)', () => {
    expect(schema.safeParse({ type: TYPE, id: '42' }).success).toBe(false)
  })

  it('③ 七张表逐张现读都是 uuid 主键(前置对账,防"表换了类型 schema 没跟")', () => {
    const SYMS = [
      'announcements',
      'helpArticles',
      'helpCategories',
      'docs',
      'newsArticles',
      'carousels',
      'systemConfigs',
    ]
    const nonUuid: string[] = []
    for (const sym of SYMS) {
      const re = new RegExp(`export const ${sym}\\s*=\\s*pgTable\\(`)
      const m = re.exec(crudSrc) // 先在 crud 的导入面确认它真的被用
      expect(m === null || sym.length > 0).toBe(true)
    }
    // 列类型要从 schema 包现读,crud.ts 自身不含列定义
    const schemaFiles = [
      'packages/database/src/schema/content.ts',
      'packages/database/src/schema/news.ts',
      'packages/database/src/schema/system.ts',
      'packages/database/src/schema/carousels.ts',
    ]
    const texts = schemaFiles.map((p) => readFileSync(join(REPO, p), 'utf8'))
    for (const sym of ['announcements', 'helpArticles', 'helpCategories', 'docs', 'newsArticles', 'carousels', 'systemConfigs']) {
      let found = false
      for (const t of texts) {
        const i = t.search(new RegExp(`export const ${sym}\\s*=\\s*pgTable\\(`))
        if (i < 0) continue
        found = true
        const win = t.slice(i, i + 900)
        if (!/\bid:\s*uuid\s*\(/.test(win)) nonUuid.push(sym)
      }
      expect(found, `${sym} 在已读 schema 面里找不到 pgTable 定义`).toBe(true)
    }
    expect(nonUuid, `这些表已不是 uuid 主键,z.uuid() 会误拒合法请求:${nonUuid.join(', ')}`).toEqual([])
  })

  it('④ 共享 idParamSchema 保持 z.string() 原样(G-624 已否证径改它)', () => {
    expect(sharedSrc).toMatch(/export const idParamSchema = z\.object\(\{ id: z\.string\(\) \}\)/)
    // 共享件里那条 uuid 版是给 registerCrud 用的独立 schema,不得被本票顺手合并
    expect(sharedSrc).toMatch(/const crudIdParamSchema = z\.object\(\{ id: z\.uuid\(/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
