// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回灌腿归属闸锁(2026-10-29 立)。
 *
 * 立因:三条客户端会话回灌腿(qoder/trae/workbuddy)按 `(provider_code, uid)` 读写号池,
 * 而 `(provider_code, uid)` 全局唯一约束早在 2026-10-23 加 owner_user_id 列时被**摘掉**,
 * 换成两条 partial unique(运营池一行 + 每个用户各一行)。于是同 uid 可以多行并存
 * (2026-10-29 现读:qoder 的 `019f1c4d…453` 确有 2 行,一行运营池 healthy,
 * 一行属某用户且连败 3/3 被临时摘出调度)⇒ 不带归属的 UPDATE 一把命中两行,
 * 把本机客户端的票写进他人私有副本(AGENTS §5「认证不等于授权」)。
 *
 * 判据(自平衡,不靠手数):按 `(provider, uid)` 谓词出现总数 N,带 owner-null 闸的 M;
 * 两者必须相等,且 N>0。新增一枚漏闸的谓词当场翻红;把闸摘掉也翻红(阳性对照)。
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '../scripts')
const LEGS = [
  'relay-qoder-session-sync.ts',
  'relay-trae-session-sync.ts',
  'relay-workbuddy-session-sync.ts',
] as const

/** prettier 会把长谓词折行 ⇒ 先归一化空白再比(形状锁只比语义,不比排版) */
const squash = (s: string) => s.replace(/\s+/g, ' ')

const UID_PREDICATE = /eq\(aiRelayAccountPool\.uid, [^)]+\)/g
const OWNER_GATE = /isNull\(aiRelayAccountPool\.ownerUserId\)/g

for (const file of LEGS) {
  test(`${file}: 每一枚按 uid 寻址的池谓词都必须带 owner_user_id IS NULL 归属闸`, () => {
    const src = squash(readFileSync(resolve(SCRIPTS_DIR, file), 'utf8'))
    const byUid = src.match(UID_PREDICATE)?.length ?? 0
    const gated = src.match(OWNER_GATE)?.length ?? 0
    assert.ok(byUid > 0, `${file} 读不到任何 (provider,uid) 池谓词 ⇒ 本锁射程空转`)
    assert.equal(
      gated,
      byUid,
      `${file}: ${byUid} 枚按 uid 寻址的读写谓词里只有 ${gated} 枚带归属闸 ⇒ ` +
        `同 uid 多行并存时会把凭据写进他人私有副本`,
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
