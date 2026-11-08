// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DB-32 夹具：verify-schema.mjs 不得内嵌明文凭据，必须读 DATABASE_URL，
 * 缺失时显式退出。纯文本断言，不连数据库。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SCRIPT_PATH = fileURLToPath(
  new URL('../../../packages/database/verify-schema.mjs', import.meta.url),
)

describe('DB-32 verify-schema 凭据', () => {
  it('源码不含硬编码口令', () => {
    const source = readFileSync(SCRIPT_PATH, 'utf8')
    expect(source).not.toContain('ihui_dev_d6412937d5e397bc')
    expect(source).not.toMatch(/postgresql:\/\/ihui:ihui_dev_/)
  })

  it('连接串来自 DATABASE_URL，缺失即非零退出', () => {
    const source = readFileSync(SCRIPT_PATH, 'utf8')
    expect(source).toMatch(/process\.env\.DATABASE_URL/)
    expect(source).toMatch(/process\.exit\(1\)/)
  })
})
