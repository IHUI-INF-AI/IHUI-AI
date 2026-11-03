// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回灌腿归属闸锁(2026-10-29 立,2026-11-01 升级)。
 *
 * 立因:四条客户端会话回灌腿(qoder/trae/workbuddy/minimax)按 `(provider_code, uid)` 读写号池,
 * 而 `(provider_code, uid)` 全局唯一约束早在 2026-10-23 加 owner_user_id 列时被**摘掉**,
 * 换成两条 partial unique(运营池一行 + 每个用户各一行)。于是同 uid 可以多行并存
 * (2026-10-29 现读:qoder 的 `019f1c4d…453` 确有 2 行,一行运营池 healthy,
 * 一行属某用户且连败 3/3 被临时摘出调度)⇒ 不带归属的 UPDATE 一把命中两行,
 * 把本机客户端的票写进他人私有副本(AGENTS §5「认证不等于授权」)。
 *
 * 判据升级(2026-11-01):原形状锁要求"每条按 uid 的谓词都必须带 owner-null 闸",
 * 结果把"回灌写个人池唯一行"结构性禁死 —— 本机号已被某用户个人池持有时,回灌只能
 * 另建运营池行(uid 2345730760515203 实测两行、心跳与签到绑定分叉)。安全边界的目标
 * 是"一次写只能命中一行",精确到主键 id 同样满足且更强 ⇒ 现在每个 update 的 where
 * 必须能收窄到单行:`eq(id)` 或 `isNull(ownerUserId)` 二选一;按 uid 裸写仍判红。
 * 目标行含个人池唯一行的腿(trae,2026-11-01;qoder/workbuddy 同日跟进)再收紧一档:必须 eq(id)。
 * 阳性对照:裸 uid 判红,owner-null / id 两种收窄判绿。另加接线锁:上述腿必须真调
 * chooseSyncTargetRow 且全文不留 owner 过滤(否则个人池行进不了候选集,收窄再严也漏写)。
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
  'relay-minimax-session-sync.ts',
] as const
/** 2026-11-01 起目标行可为"个人池唯一行"的腿:写必须按主键 id,不得再靠 owner-null 通配。
 *  四条腿同日全部收口(qoder/workbuddy/minimax 与 trae 同型:只认运营池行 ⇒ 本机号落个人池时
 *  回灌看不见它 —— qoder/minimax 会另建运营池重复行,workbuddy 恒"池内没有该 uid"模板永不回灌)。 */
const ID_WRITE_LEGS = [
  'relay-qoder-session-sync.ts',
  'relay-trae-session-sync.ts',
  'relay-workbuddy-session-sync.ts',
  'relay-minimax-session-sync.ts',
] as const

/** prettier 会把长谓词折行 ⇒ 先归一化空白再比(形状锁只比语义,不比排版) */
const squash = (s: string) => s.replace(/\s+/g, ' ')

/**
 * 提取每个 `db.update(aiRelayAccountPool)` 链上 `.where(...)` 的括号内容。
 * 用局部正则实例,避免共享 lastIndex 在测试并发时串扰。
 */
function updateWhereBlocks(raw: string): string[] {
  const src = squash(raw)
  const updateRe = /\.update\(aiRelayAccountPool\)/g
  const out: string[] = []
  let cursor = 0
  while (true) {
    updateRe.lastIndex = cursor
    const m = updateRe.exec(src)
    if (!m) break
    const after = m.index + m[0].length
    const nextRe = /\.update\(aiRelayAccountPool\)/g
    nextRe.lastIndex = after
    const next = nextRe.exec(src)
    const bound = next ? next.index : src.length
    const whereIdx = src.indexOf('.where(', after)
    if (whereIdx === -1 || whereIdx > bound) {
      cursor = after
      continue
    }
    const start = whereIdx + '.where('.length
    let depth = 1
    let j = start
    while (j < src.length && depth > 0) {
      const ch = src[j]
      if (ch === '(') depth++
      else if (ch === ')') depth--
      j++
    }
    out.push(src.slice(start, j - 1))
    cursor = j
  }
  return out
}

const ID_GATE = /eq\(aiRelayAccountPool\.id,/
const OWNER_NULL_GATE = /isNull\(aiRelayAccountPool\.ownerUserId\)/
const UID_PREDICATE = /eq\(aiRelayAccountPool\.uid,/

for (const file of LEGS) {
  test(`${file}: 每个 update 都能收窄到单行(id 精确 或 运营池 owner-null)`, () => {
    const blocks = updateWhereBlocks(readFileSync(resolve(SCRIPTS_DIR, file), 'utf8'))
    assert.ok(blocks.length > 0, `${file} 读不到任何 update 块 ⇒ 本锁射程空转`)
    for (const block of blocks) {
      assert.ok(
        ID_GATE.test(block) || OWNER_NULL_GATE.test(block),
        `${file}: update 谓词既无 eq(id) 也无 owner_user_id IS NULL ⇒ ` +
          `同 uid 多行并存时会一把命中多行: ${block.slice(0, 160)}`,
      )
    }
  })
}

for (const file of ID_WRITE_LEGS) {
  test(`${file}: 目标行可为个人池唯一行 ⇒ 每个 update 必须按主键 id`, () => {
    const blocks = updateWhereBlocks(readFileSync(resolve(SCRIPTS_DIR, file), 'utf8'))
    assert.ok(blocks.length > 0, `${file} 读不到任何 update 块 ⇒ 本锁射程空转`)
    for (const block of blocks) {
      assert.ok(
        ID_GATE.test(block),
        `${file}: update 未按主键 id 收窄(owner-null 只覆盖运营池,个人池目标会漏写)`,
      )
      assert.ok(
        !UID_PREDICATE.test(block),
        `${file}: update 谓词里仍出现 uid ⇒ 多行并存时会写穿他人副本`,
      )
    }
  })
}

/**
 * 接线锁(§0.9 "造好没装车 = 没有"):写了 eq(id) 不等于会选到个人池行 —— 若腿把
 * `isNull(ownerUserId)` 留在候选查询里,个人池行永远进不了候选集,归属闸再严也白搭。
 * 故对同一批腿再加两条:① 必须真调 chooseSyncTargetRow(判据单源,不许自己复算);
 * ② 全文不得再出现 owner_user_id IS NULL 过滤(候选面必须与归属无关)。
 */
const CHOOSER_CALLSITE = /chooseSyncTargetRow\(/
const OWNER_FILTER = /isNull\(aiRelayAccountPool\.ownerUserId\)/

for (const file of ID_WRITE_LEGS) {
  test(`${file}: 候选面与归属无关(调 chooseSyncTargetRow,不留 owner 过滤)`, () => {
    const src = readFileSync(resolve(SCRIPTS_DIR, file), 'utf8')
    assert.match(src, CHOOSER_CALLSITE, `${file}: 未调用 chooseSyncTargetRow ⇒ 判据出现第二把尺`)
    assert.doesNotMatch(
      src,
      OWNER_FILTER,
      `${file}: 仍有 owner_user_id IS NULL 过滤 ⇒ 个人池行进不了候选集,回灌必然漏它`,
    )
  })
}

test('阳性对照:裸 uid 写判红,id / owner-null 两种收窄判绿', () => {
  const [bare] = updateWhereBlocks(
    `await db.update(aiRelayAccountPool).set({ a: 1 }).where(and(eq(aiRelayAccountPool.providerCode, 'trae'), eq(aiRelayAccountPool.uid, uid)))`,
  )
  const [byId] = updateWhereBlocks(
    `await db.update(aiRelayAccountPool).set({ a: 1 }).where(eq(aiRelayAccountPool.id, row.id))`,
  )
  const [byOwner] = updateWhereBlocks(
    `await db.update(aiRelayAccountPool).set({ a: 1 }).where(and(eq(aiRelayAccountPool.uid, uid), isNull(aiRelayAccountPool.ownerUserId)))`,
  )
  assert.ok(bare && byId && byOwner, '解析器没取到三个对照块')
  assert.equal(ID_GATE.test(bare) || OWNER_NULL_GATE.test(bare), false)
  assert.equal(ID_GATE.test(byId), true)
  assert.equal(OWNER_NULL_GATE.test(byOwner), true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
