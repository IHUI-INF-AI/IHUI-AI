// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上传会话状态词表对账(第十五批 ZCode 吸收线尾格)。
 *
 * 立因:`checksum_mismatch` 是第十四批之前的合并校验失败终态,由
 * `apps/api/src/routes/chunked-upload.ts` **写**、由 `services/upload-integrity.ts` 的
 * `TERMINAL_STATUSES` **判**,而"状态字典"当时只存在于
 * `packages/database/src/schema/upload-sessions.ts` 的**注释**里 —— 那份注释列了四态、
 * 漏了第五态,且没有任何一道判据会发现。typecheck 看不见注释,自然也看不见它与代码分叉。
 *
 * 本文件把字典变成代码(唯一出口 `UPLOAD_SESSION_STATUS` + 两个子集),并钉三条:
 *  V1 分档完备:终态 ∪ 可回收 = 全集,且两两不相交(漏一档 = 该状态永不被回收或被误删)
 *  V2 第五态确实在词表里且在终态侧(正面点名 `checksum_mismatch`,防"字典又被改回四态")
 *  V3 结构锁:两个消费文件不得再自拼裸状态字面量,也不得另立 `new Set([...])` 清单
 *     (第二真相的形态正是"各处各自列一遍")
 *  V4 变异对照:把终态侧任一项挪走,V1/V2 必红(证明这两条不是恒真式)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  UPLOAD_SESSION_STATUS,
  UPLOAD_SESSION_TERMINAL_STATUSES,
  UPLOAD_SESSION_REAPABLE_STATUSES,
} from '@ihui/database'

const ALL = Object.values(UPLOAD_SESSION_STATUS) as string[]

/**
 * 仓库根由**本文件自身位置**推导(三层:tests → api → apps → 根)。
 * 刻意不用 `process.cwd()` —— 本仓已多次出现"ROOT 取自 cwd ⇒ 镜像测试在真仓上跑却以为在跑夹具"
 * 的失效(守门 70 的 14 例里 13 例恒红那一型),而这里读的是**被测源文件**,错根就是错结论。
 */
const ROOT = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const read = (...rel: string[]) => readFileSync(resolve(ROOT, ...rel), 'utf8')

describe('上传会话状态词表:唯一字典 + 分档完备', () => {
  it('V1 终态 ∪ 可回收 = 全集,且两档不相交', () => {
    const union = new Set([
      ...UPLOAD_SESSION_TERMINAL_STATUSES,
      ...UPLOAD_SESSION_REAPABLE_STATUSES,
    ])
    expect([...union].sort()).toEqual([...ALL].sort())
    const overlap = UPLOAD_SESSION_TERMINAL_STATUSES.filter((s) =>
      (UPLOAD_SESSION_REAPABLE_STATUSES as readonly string[]).includes(s),
    )
    expect(overlap).toEqual([])
  })

  it('V2 第五态 checksum_mismatch 在词表内,且落在终态侧(永不回收)', () => {
    expect(ALL).toContain('checksum_mismatch')
    expect(UPLOAD_SESSION_TERMINAL_STATUSES).toContain('checksum_mismatch')
    expect(UPLOAD_SESSION_REAPABLE_STATUSES).not.toContain('checksum_mismatch')
  })

  it('V3 结构锁:消费文件不得再自拼裸状态字面量或第二份清单', () => {
    const route = read('apps', 'api', 'src', 'routes', 'chunked-upload.ts')
    const integrity = read('apps', 'api', 'src', 'services', 'upload-integrity.ts')
    // 赋值/比较位置的字符串字面量状态(注释与字符串内的示例不计:判据只看代码形态)
    const bare = /\bstatus:\s*'[a-z_]+'|\.status\s*[!=]==?\s*'[a-z_]+'/
    expect(route.match(bare) ?? []).toEqual([])
    expect(integrity.match(bare) ?? []).toEqual([])
    // 不得再 `new Set(['completed', ...])` 这类就地列清单
    expect(integrity).toContain('UPLOAD_SESSION_TERMINAL_STATUSES')
    expect(integrity).not.toMatch(/new Set\(\s*\['/)
    expect(integrity).toContain('UPLOAD_SESSION_REAPABLE_STATUSES')
  })

  it('V4 变异对照:把任一终态挪出终态侧,V1 必红(证明判据有牙)', () => {
    const mutatedTerminal = UPLOAD_SESSION_TERMINAL_STATUSES.slice(0, -1)
    const union = new Set([...mutatedTerminal, ...UPLOAD_SESSION_REAPABLE_STATUSES])
    expect([...union].sort()).not.toEqual([...ALL].sort())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
