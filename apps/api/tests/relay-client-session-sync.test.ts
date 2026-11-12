// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端会话回灌落库(loomy/zcode/raccoon 三腿共用写入端)判据锁(2026-11-12 立)。
 * 钉的是当日真实事故:壳以 `--provider loomy`(空格形态)传参,tsx 侧只认等号形态
 * ⇒「必须 --provider」。修复是双向的:壳侧统一等号形态(scripts/tests/
 * sync-client-session-legs.test.mjs 锁那个面),tsx 侧双形态都收(本文件直测
 * parseArgs 行为)。不连库、不 spawn、不碰本机客户端(§22c 各锁各的面)。
 */
import { describe, it, expect, vi } from 'vitest'

// 兜底 env:静态 import 链会走 config/crypto 的校验(setup-env.ts 已提供,这里再兜一层,
// 保证单文件直跑也不崩)。vi.hoisted 在 import 之前执行。
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:5399/ihui_test'
  process.env.JWT_SECRET ??= 'client-session-sync-test-jwt-secret-0123456789'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'client-session-sync-test-cred-key-0123456789ab'
})

import { __test__ } from '../scripts/relay-client-session-sync.js'

const { parseArgs } = __test__

describe('relay-client-session-sync parseArgs', () => {
  it('① 等号形态(壳的唯一传参形态):--provider=loomy --stdin ⇒ 合法', () => {
    const o = parseArgs(['--provider=loomy', '--stdin', '--json'])
    expect(o.error).toBeNull()
    expect(o.provider).toBe('loomy')
    expect(o.stdin).toBe(true)
    expect(o.json).toBe(true)
  })

  it('② 空格形态(人工直跑习惯):--provider zcode 取下一个 argv(16:43 事故回归锁)', () => {
    const o = parseArgs(['--provider', 'zcode', '--stdin'])
    expect(o.error).toBeNull()
    expect(o.provider).toBe('zcode')
    expect(o.stdin).toBe(true)
  })

  it('③ 空格形态吞掉下一个旗标 ⇒ 被当值吃掉,stdin 缺失由 --stdin 守卫兜住(报未判定,不静默放行)', () => {
    const o = parseArgs(['--provider', '--stdin'])
    expect(o.error).toContain('必须 --stdin')
  })

  it('④ 缺 provider ⇒ 必须 --provider;缺 stdin ⇒ 必须 --stdin(凭据只走标准输入,不落盘)', () => {
    expect(parseArgs(['--stdin']).error).toContain('必须 --provider')
    expect(parseArgs(['--provider=raccoon']).error).toContain('必须 --stdin')
    expect(parseArgs([]).error).toContain('必须 --provider')
  })

  it('⑤ 未知参数 ⇒ 未判定;裸 -- 透传;--dry-run 照常', () => {
    expect(parseArgs(['--provider=loomy', '--stdin', '--bogus']).error).toBe('未知参数: --bogus')
    const o = parseArgs(['--', '--provider=raccoon', '--stdin', '--dry-run'])
    expect(o.error).toBeNull()
    expect(o.dryRun).toBe(true)
    expect(o.provider).toBe('raccoon')
  })

  it('⑥ 等号形态空值 ⇒ 按缺失处理(不猜默认平台)', () => {
    expect(parseArgs(['--provider=', '--stdin']).error).toContain('必须 --provider')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
