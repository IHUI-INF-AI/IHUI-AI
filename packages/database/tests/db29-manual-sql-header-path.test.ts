// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DB-36 夹具：manual-sql 里 CONCURRENTLY 脚本的头注 psql 路径必须真实存在。
 * 只做文本 + 文件存在性断言，不执行任何 SQL。
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SQL_PATH = fileURLToPath(
  new URL(
    '../../../packages/database/scripts/manual-sql/20261003103000_chat_messages_created_at_idx_CONCURRENTLY.sql',
    import.meta.url,
  ),
)

describe('DB-36 manual-sql 头注路径', () => {
  it('头注里的 psql -f 路径指向真实存在的文件', () => {
    const source = readFileSync(SQL_PATH, 'utf8')
    const match = source.match(/psql\s+"\$DATABASE_URL"[^\n]*\s-f\s+(\S+\.sql)/)
    expect(match).toBeTruthy()
    const referencedPath = match![1]
    expect(referencedPath).toMatch(
      /^packages\/database\/scripts\/manual-sql\/20261003103000_chat_messages_created_at_idx_CONCURRENTLY\.sql$/,
    )
    const absolute = fileURLToPath(new URL(`../../../${referencedPath}`, import.meta.url))
    expect(existsSync(absolute)).toBe(true)
  })
})
