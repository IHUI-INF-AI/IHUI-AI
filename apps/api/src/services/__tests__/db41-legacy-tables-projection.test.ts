// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DB-46 夹具（纯静态，读路由源码文本）。
 *
 * 缺陷：旧表通用 raw 辅助用 SELECT *，表一加列就自动出参；page 只有下界，
 * (page-1)*pageSize 可无限大。
 * 判据：全部旧表读取走显式列投影；列表页码夹到上限。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'routes', 'agent-extended.ts'),
  'utf8',
)

describe('DB-46 旧表读取白名单 + 页码上限', () => {
  it('读取不再使用 SELECT *', () => {
    expect(SRC).not.toContain('SELECT * FROM')
    expect(SRC).toContain('READ_COLUMNS')
  })

  it('列表页码有上限', () => {
    expect(SRC).toContain('MAX_LIST_PAGE')
    expect(SRC).toContain('Math.min(Math.max(1, opts.page), MAX_LIST_PAGE)')
  })
})
