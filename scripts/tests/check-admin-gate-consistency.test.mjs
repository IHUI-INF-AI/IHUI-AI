// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/check-admin-gate-consistency.test.mjs
 * O13b admin 面守门的 §22c 镜像单测:直接 import 源脚本 __test__ 导出,无复制实现。
 * 运行:node --test scripts/tests/check-admin-gate-consistency.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const { detectRawRoleIdComparisons, detectLocalRequireAdmin, evaluateFile, evaluatePlatformInvariants, platformScopesFromSource, LEGACY_RAW_ROLEGATE } = (
  await import('../check-admin-gate-consistency.mjs')
).__test__

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('裸 roleId 数值比较被识别(>=1 / >0 / ===1 / <1 各形态)', () => {
  assert.equal(detectRawRoleIdComparisons('if (request.jwtPayload?.roleId >= 1) return').length, 1)
  assert.equal(detectRawRoleIdComparisons('if (u.roleId > 0) allow()').length, 1)
  assert.equal(detectRawRoleIdComparisons('if (dbUser.roleId === 1) wildcard()').length, 1)
  assert.equal(detectRawRoleIdComparisons('if (roleId < 1) deny()').length, 1)
})

test('非特权判定形态零误报(赋值 / 对象字面量 / 常量比较 / 注释)', () => {
  const src = [
    'const roleId = payload.roleId ?? 0',
    'return { userId, roleId: 1 }',
    'if (roleId < ADMIN_ROLE_ID) {',
    '// roleId >= 1 视为管理员(注释)',
    'type Row = { roleId: number }',
  ].join('\n')
  assert.deepEqual(detectRawRoleIdComparisons(src), [])
})

test('存量豁免、新增拦截:白名单文件条数内放行、超登记拦下', () => {
  // ⚠️ 夹具不得写死路径 —— 本仓已在此处栽过两次:白名单条目会随 O13b 收敛被删,写死
  // 'apps/api/src/routes/oss.ts' 会在"收敛成功当天"抛 TypeError(条目没了 → .count 取不到),
  // 看起来像判据被改坏,诱发的错误处置是把条目加回去 = 回滚收敛。
  // 探针必须取 count===1 的条目:本例要"2 处 > 登记"才能验拦截,取到 count=6 的会假通过。
  const legacy = Object.entries(LEGACY_RAW_ROLEGATE).find(([, v]) => v.count === 1)?.[0]
  assert.ok(
    !!legacy,
    '自测前置:白名单需至少一条 count===1 的条目(若已全清,本例应随判据一起删除,而不是补条目)',
  )
  assert.ok(LEGACY_RAW_ROLEGATE[legacy].count >= 1)
  const within = evaluateFile({ relPath: legacy, source: 'if (x.roleId >= 1) ok()' })
  assert.deepEqual(within, [], '登记条数内不得报违规')
  const grown = evaluateFile({ relPath: legacy, source: 'x.roleId >= 1\ny.roleId >= 1' })
  assert.equal(grown.length, 1, '超过登记条数必须拦截')
})

test('未登记文件出现裸比较 ⇒ 违规;集中封装自身豁免', () => {
  const fresh = evaluateFile({ relPath: 'apps/api/src/routes/totally-new.ts', source: 'if (r.roleId >= 1) grant()' })
  assert.equal(fresh.length, 1)
  assert.match(fresh[0], /RULE-1/)
  const central = evaluateFile({
    relPath: 'apps/api/src/plugins/require-permission.ts',
    source: 'if (roleId >= 1) return\nconst requireAdmin = async () => {}',
  })
  assert.deepEqual(central, [], '集中封装是定义点,不得自我拦截')
})

test('RULE-2:集中封装之外重定义 requireAdmin 被识别,import 行不计', () => {
  assert.equal(detectLocalRequireAdmin("import { requireAdmin } from '../../plugins/require-permission.js'").length, 0)
  assert.equal(detectLocalRequireAdmin('async function requireAdmin(req, reply) {}').length, 1)
  assert.equal(detectLocalRequireAdmin('const requireAdmin = async (req, reply) => {}').length, 1)
})

test('RULE-3:dataClass=platform 条目 thirdPartyEligible 必须为 false,否则拦(自相矛盾哨兵)', () => {
  assert.equal(
    evaluatePlatformInvariants([{ domain: 'platform', scope: 's:x', dataClass: 'platform', thirdPartyEligible: true }]).length,
    1,
  )
  assert.deepEqual(
    evaluatePlatformInvariants([
      // domain=platform 但 dataClass 非 platform(edu:read/edu:write 真实形态):不属本不变量
      { domain: 'platform', scope: 'edu:read', dataClass: 'scoped-read', thirdPartyEligible: true },
      { domain: 'platform', scope: 's:y', dataClass: 'platform', thirdPartyEligible: false },
      { domain: 'agent', scope: 's:a', dataClass: 'compute', thirdPartyEligible: true },
    ]),
    [],
  )
})

test('真实 capability-catalog 解析:platform 清单存在且不变量成立(解析器漂移哨兵)', () => {
  const src = readFileSync(resolve(ROOT, 'packages/types/src/capability-catalog.ts'), 'utf8')
  const plat = platformScopesFromSource(src)
  assert.ok(plat.length >= 1, 'platform 域 scope 清单不得为空(为空=解析器看不见该域,判据失效)')
  assert.ok(plat.some((s) => s.scope === 'publish:operate'))
  assert.deepEqual(evaluatePlatformInvariants(plat), [])
})

test('存量白名单只减不增 + 表自身卫生(不留 0 条目)', () => {
  const entries = Object.entries(LEGACY_RAW_ROLEGATE)
  const total = entries.reduce((n, [, v]) => n + v.count, 0)
  assert.ok(total <= 74, `白名单登记总数 ${total} 超过 2026-09-21 盘点值 74(只减不增)`)
  assert.ok(
    entries.every(([, v]) => v.count >= 1),
    '不得留 count=0 的空条目 —— 收敛完成即删项,留 0 会让"表里有它"被误读成"还有债"',
  )
  // **刻意不设下界**。原断言是 `total <= 74 && total >= 40`,那个 `>= 40` 与"只减不增"
  // 方向相反:收敛越成功总数越小,实测已降到 23 —— 于是 O13b 每收敛一批,本例就在达成
  // 当天变红,而红点看起来像"有人改坏了白名单",最省事的"修复"是把条目加回去 = 回滚收敛。
  // 棘轮的下界就是 0(全部收敛完即目标态),要钉的只有上界与表卫生两条。
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
