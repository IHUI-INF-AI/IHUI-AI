// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// XUI-084: 后台 API 套餐 price 服务端是「分」(plans.price integer)。旧实现三腿把分当元：
// 表格 `¥{p.price}`、编辑回填 `String(p.price)`、提交原样传回。
// 本夹具升级为“后端写入 → 前端渲染 → 回读”真实生产函数闭环，并锁死唯一换算点。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ADMIN_PACKAGE_PRICE_UNIT,
  formYuanToPriceCents,
  packageToForm,
  priceCentsToFormYuan,
  priceCentsToYuanText,
} from '../app/(main)/admin/api-platform/packages/price-unit'
import type { ApiPackage } from '../app/(main)/admin/api-platform/packages/types'

const WEB_ROOT = process.cwd()
const REPO_ROOT = join(WEB_ROOT, '..', '..')
const readWeb = (...p: string[]) => readFileSync(join(WEB_ROOT, ...p), 'utf8')
const readRepo = (...p: string[]) => readFileSync(join(REPO_ROOT, ...p), 'utf8')
const readPackageFile = (name: string) =>
  readWeb('app', '(main)', 'admin', 'api-platform', 'packages', name)

const backendRow = (price: number): ApiPackage => ({
  id: 'pkg-1',
  name: '测试套餐',
  price,
  quota: 1000,
  period: 'month',
  description: null,
  status: 1,
  createdAt: '2026-11-08T00:00:00.000Z',
})

describe('XUI-084 后台 API 套餐 price 分→元（唯一换算点 + 首尾相等）', () => {
  it('契约：plans.price 以分为单位，admin 写入 schema 只收整数分', () => {
    const billing = readRepo('packages', 'database', 'src', 'schema', 'billing.ts')
    expect(billing).toContain('price 以分为单位')
    const route = readRepo('apps', 'api', 'src', 'routes', 'admin-api-platform.ts')
    expect(route).toMatch(/price:\s*z\.number\(\)\.int\(\)\.min\(0\)/)
    expect(ADMIN_PACKAGE_PRICE_UNIT).toBe('fen')
  })

  it('换算只有一处：三个消费点都调 price-unit，且自己不乘/除 100', () => {
    const consumers = ['ApiPackageTable.tsx', 'helpers.ts', 'page.tsx']
    for (const name of consumers) {
      const src = readPackageFile(name)
      expect(src).toMatch(/from ['"]\.\/price-unit['"]/)
      expect(src).not.toMatch(/\*\s*100|100\s*\*|\/\s*100|100\s*\//)
    }
    expect(readPackageFile('price-unit.ts')).toContain('cents / 100')
    expect(readPackageFile('price-unit.ts')).toContain('* 100')
  })

  it('渲染与回填都按元，且与分整数一一对应', () => {
    const expected = new Map([
      [0, ['¥0.00', '0']],
      [1, ['¥0.01', '0.01']],
      [2999, ['¥29.99', '29.99']],
      [19900, ['¥199.00', '199']],
      [12345, ['¥123.45', '123.45']],
    ])
    for (const [cents, [renderText, formText]] of expected) {
      expect(priceCentsToYuanText(cents)).toBe(renderText)
      expect(priceCentsToFormYuan(cents)).toBe(formText)
    }
  })

  it('后端写入 → 前端渲染 → 回读：分整数首尾相等', () => {
    for (const cents of [0, 1, 2999, 19900, 12345]) {
      // 后端写入：plans.price integer(分)，只收整数
      expect(Number.isInteger(cents)).toBe(true)
      const row = backendRow(cents)
      // 前端渲染（列表列真实函数）
      const rendered = priceCentsToYuanText(row.price)
      // 编辑回填（真实 packageToForm）
      const form = packageToForm(row)
      // 提交回读（真实表单提交函数）
      const submitted = formYuanToPriceCents(form.price)
      expect(submitted).toBe(row.price)
      expect(rendered).toBe(priceCentsToYuanText(submitted))
    }
  })

  it('反例：旧实现把 2999 分原样展示/回填（100 倍错位）', () => {
    expect(`¥${2999}`).not.toBe('¥29.99')
    expect(String(2999)).not.toBe('29.99')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
