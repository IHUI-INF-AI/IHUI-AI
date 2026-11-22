// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86F 反向锁:canonical JSON 序列化在生产面只许有一份实现。
 *
 * 立因:audit-log-service(HMAC 链哈希输入)与 siem-exporter(导出签名载荷)
 * 曾各藏一份私有 canonicalStringify,同义双实现 —— 两处必漂移是本仓记过最多次
 * 的失败型,86F 票面判据点名"生产面声明处 ≤1"。
 * 量面=工作树源码(与 clawdbot-elapsed-wiring / provider-models-cache-key /
 * turn-ordinal-backfill 三处源码形状锁同一先例);CI 量的是检出面,同源同判。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = resolve(__dirname, '../../..')

/** 递归收集某目录下的 .ts 生产文件(跳过测试面)。 */
function collectTs(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      out.push(...collectTs(p))
    } else if (name.endsWith('.ts') && !name.includes('.test.')) {
      out.push(p)
    }
  }
  return out
}

describe('86F canonicalStringify 唯一实现(生产面)', () => {
  it('生产源码里 `function canonicalStringify` 声明处 =1(唯一真源在 packages/shared)', () => {
    const files = [
      ...collectTs(join(REPO, 'apps/api/src')),
      ...collectTs(join(REPO, 'packages/shared/src')),
    ]
    const decls = files
      .filter((f) => readFileSync(f, 'utf8').includes('function canonicalStringify'))
      .map((f) => f.slice(REPO.length + 1).replace(/\\/g, '/'))
    expect(decls).toEqual(['packages/shared/src/utils/canonical-json.ts'])
  })

  it('两个消费面都从 @ihui/shared import,不再自带实现(源码形状锁)', () => {
    for (const rel of [
      'apps/api/src/services/audit-log-service.ts',
      'apps/api/src/services/siem-exporter.ts',
    ]) {
      const src = readFileSync(join(REPO, rel), 'utf8')
      expect(src, rel).toContain("import { canonicalStringify } from '@ihui/shared'")
      expect(src, rel).not.toMatch(/function canonicalStringify/)
    }
  })

  it('shared 出口在 barrel 可达链上(防"实现在但没递出"的 86F 自伤型)', () => {
    const utilsIdx = readFileSync(join(REPO, 'packages/shared/src/utils/index.ts'), 'utf8')
    expect(utilsIdx).toContain("export * from './canonical-json'")
    const mainIdx = readFileSync(join(REPO, 'packages/shared/src/index.ts'), 'utf8')
    expect(mainIdx).toMatch(/export \* from '\.\/utils'/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
