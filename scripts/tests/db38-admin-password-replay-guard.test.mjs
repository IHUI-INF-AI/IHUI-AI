// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// DB-38 夹具:重放 0067/0071 不得把管理员口令写回仓库公开散列。
//
// 已入库迁移(0067/0071)按纪律不改写(其文件 hash 参与迁移账本),因此收口是
// 新增一条**常驻写侧守卫**迁移:users 的 INSERT / UPDATE OF password_hash
// 命中「仓库公开过的默认口令散列」即 RAISE。
// 本夹具从 0067/0071 里**现读出**散列字面量(不另抄一份清单),再要求守卫迁移把它们全部覆盖 ——
// 以后谁再往种子迁移里加一枚公开散列,本夹具立刻翻红。
//
// 运行:`node --test scripts/tests/db38-admin-password-replay-guard.test.mjs`
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DRIZZLE = join(REPO, 'packages', 'database', 'drizzle')
const SEED_0067 = join(DRIZZLE, '0067_system_admin.sql')
const SEED_0071 = join(DRIZZLE, '0071_restore_admin_immutability.sql')
const GUARD = join(DRIZZLE, '20261108160000_admin_password_replay_guard.sql')

const BCRYPT = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g

/** 只量会执行的代码:去掉整行 -- 注释(回滚/说明块都在注释里) */
const sqlCodeOf = (text) =>
  text
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join('\n')

const seedHashes = [
  ...new Set([
    ...readFileSync(SEED_0067, 'utf8').match(BCRYPT),
    ...readFileSync(SEED_0071, 'utf8').match(BCRYPT),
  ]),
]
const guardSrc = existsSync(GUARD) ? readFileSync(GUARD, 'utf8') : ''
const GUARD_CODE = sqlCodeOf(guardSrc)

// ── 判据 ────────────────────────────────────────────────────────
/** 种子迁移里每一枚公开散列都必须出现在守卫的黑名单里 */
const coversSeedHashes = (code) => seedHashes.every((h) => code.includes(h))

/** 守卫必须同时堵 INSERT(0067 首次插入/重放)与 UPDATE OF password_hash(0071 重放) */
const blocksInsertAndUpdate = (code) =>
  /CREATE TRIGGER[\s\S]{0,120}BEFORE INSERT ON "users"[\s\S]{0,80}FOR EACH ROW/.test(code) &&
  /CREATE TRIGGER[\s\S]{0,120}BEFORE UPDATE OF "password_hash" ON "users"[\s\S]{0,80}FOR EACH ROW/.test(code)

/** 命中即抛错(不是"让人自己注意"),且带明确 ERRCODE */
const raisesOnMatch = (code) =>
  /password_hash" = ANY \(v_public_hashes\)/.test(code) &&
  /RAISE EXCEPTION/.test(code) &&
  /ERRCODE = 'P0001'/.test(code)

/** 守卫本身必须幂等且不留 BACKUP 后的半截状态 */
const idempotent = (code) =>
  /CREATE OR REPLACE FUNCTION "users_block_public_admin_hash"/.test(code) &&
  (code.match(/DROP TRIGGER IF EXISTS "users_block_public_admin_hash_/g) || []).length >= 2

function health(code) {
  return Object.entries({ coversSeedHashes, blocksInsertAndUpdate, raisesOnMatch, idempotent })
    .filter(([, fn]) => !fn(code))
    .map(([k]) => k)
}

test('D38-0 守卫迁移在位,且 0067/0071 的公开散列已被现读出来(夹具自证)', () => {
  assert.ok(existsSync(GUARD), `守卫迁移缺失:${GUARD}`)
  assert.equal(seedHashes.length, 2, `0067/0071 应各有 1 枚公开散列,实际读到 ${seedHashes.length} 枚`)
})

test('D38-1 守卫覆盖 0067 与 0071 的默认口令散列,INSERT 与 UPDATE 两条重放路径都被拦', () => {
  assert.deepEqual(health(GUARD_CODE), [], `守卫判据未成立:${health(GUARD_CODE).join(',')}`)
})

test('D38-2 变异对照:漏掉一枚散列 / 只堵 UPDATE / 改成只告警,同一把尺子必须逐条翻假', () => {
  // 臂 A:从黑名单里删掉 0071 那枚散列(重放 0071 即可绕过)
  const missingHash = GUARD_CODE.replace(seedHashes[1], seedHashes[0])
  assert.notEqual(missingHash, GUARD_CODE, '夹具自证:臂 A 确实删掉了一枚散列')
  assert.ok(health(missingHash).includes('coversSeedHashes'), '少覆盖一枚公开散列必须被 coversSeedHashes 抓到')

  // 臂 B:只留 UPDATE 触发器,摘掉 INSERT(0067 重放重新插入默认口令的行会漏过去)
  const insertOnly = GUARD_CODE.replace(/CREATE TRIGGER[\s\S]{0,200}?BEFORE INSERT ON "users"[\s\S]{0,120}?users_block_public_admin_hash"\(\);/, '')
  assert.notEqual(insertOnly, GUARD_CODE, '夹具自证:臂 B 确实摘掉了 INSERT 触发器')
  assert.ok(health(insertOnly).includes('blocksInsertAndUpdate'), '摘掉 INSERT 守卫必须被 blocksInsertAndUpdate 抓到')

  // 臂 C:把 RAISE EXCEPTION 换成 RAISE NOTICE(只喊不拦)
  const noticeOnly = GUARD_CODE.replace('RAISE EXCEPTION', 'RAISE NOTICE')
  assert.notEqual(noticeOnly, GUARD_CODE, '夹具自证:臂 C 确实把异常降级成告警')
  assert.ok(health(noticeOnly).includes('raisesOnMatch'), '降级成 NOTICE 后 raisesOnMatch 必须翻假')

  // 臂 D:去掉 CREATE OR REPLACE 的幂等形态(改名成一次性 CREATE)
  const notIdempotent = GUARD_CODE.replace('CREATE OR REPLACE FUNCTION', 'CREATE FUNCTION')
  assert.notEqual(notIdempotent, GUARD_CODE, '夹具自证:臂 D 确实动过函数创建形态')
  assert.ok(health(notIdempotent).includes('idempotent'), '退回非幂等 CREATE 必须被 idempotent 抓到')
})
