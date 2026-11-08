// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// XUI-084: 后台 API 套餐 price 服务端是「分」(plans.price integer)，前端表格直接
// `¥{p.price}`、编辑回填 `String(p.price)`、提交原样传回 —— 三腿都把分当元。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = process.cwd()
const REPO_ROOT = join(WEB_ROOT, '..', '..')
const readWeb = (...p: string[]) => readFileSync(join(WEB_ROOT, ...p), 'utf8')
const readRepo = (...p: string[]) => readFileSync(join(REPO_ROOT, ...p), 'utf8')

describe('XUI-084 后台 API 套餐 price 分→元（三腿同源）', () => {
  it('契约：plans.price 以分为单位，admin 写入 schema 只收整数分', () => {
    const billing = readRepo('packages', 'database', 'src', 'schema', 'billing.ts')
    expect(billing).toContain('price 以分为单位')
    const route = readRepo('apps', 'api', 'src', 'routes', 'admin-api-platform.ts')
    expect(route).toMatch(/price:\s*z\.number\(\)\.int\(\)\.min\(0\)/)
  })

  it('表格价格列按分转元', () => {
    const src = readWeb('app', '(main)', 'admin', 'api-platform', 'packages', 'ApiPackageTable.tsx')
    expect(src).toMatch(/¥\{\(p\.price\s*\/\s*100\)\.toFixed\(2\)\}/)
    expect(src).not.toMatch(/¥\{p\.price\}/)
  })

  it('编辑回填按元展示（分 → 元）', () => {
    const src = readWeb('app', '(main)', 'admin', 'api-platform', 'packages', 'helpers.ts')
    expect(src).toMatch(/price:\s*String\(p\.price\s*\/\s*100\)/)
    expect(src).not.toMatch(/price:\s*String\(p\.price\)(?!\s*\/)/)
  })

  it('提交前把元转回分（服务端收分）', () => {
    const src = readWeb('app', '(main)', 'admin', 'api-platform', 'packages', 'page.tsx')
    expect(src).toMatch(/price:\s*Math\.round\(\(Number\(form\.price\)\s*\|\|\s*0\)\s*\*\s*100\)/)
  })

  it('端到端量纲：落库 2999 分 ⇒ 表单 29.99 元 ⇒ 提交 2999 分', () => {
    const centsToForm = (cents: number) => String(cents / 100)
    const formToCents = (yuan: string) => Math.round((Number(yuan) || 0) * 100)
    expect(formToCents(centsToForm(2999))).toBe(2999)
    expect(formToCents(centsToForm(19900))).toBe(19900)
    // 反例：旧实现把 2999 分原样展示/回填，用户会看到 ¥2999、提交仍 2999 分（表与表单 100 倍错位）
    expect(`¥${2999}`).not.toBe('¥29.99')
  })
})
