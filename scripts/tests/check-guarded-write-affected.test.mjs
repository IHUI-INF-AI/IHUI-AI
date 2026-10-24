#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试文件需 console 输出 */
/**
 * 守门 243(check-guarded-write-affected.mjs)的镜像测试。
 *
 * §22c:判据只有一份,住在门体 `__test__` 导出里;本文件不得复制 QTY_COL / 正则。
 * 三件事:① 成对夹具(命中档 + 三类合法对照档);② 形状锁(注册条目 blocking+skipEnv 成套,
 * 读 runner 现值);③ 覆盖面自锁(词法层必须是复用 batch-write-lexer,不得回抄分词器)。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../check-guarded-write-affected.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const cases = []
const ok = (name, cond) => cases.push({ name, pass: Boolean(cond) })

const badG1 = `      await db
        .update(products)
        .set({ stock: sql\`\${products.stock} - 1\`, sold: sql\`\${products.sold} + 1\` })
        .where(and(eq(products.id, id), gt(products.stock, 0)))
`
const goodReturning = `      const rows = await db
        .update(products)
        .set({ stock: sql\`\${products.stock} - 1\` })
        .where(and(eq(products.id, id), gt(products.stock, 0)))
        .returning({ id: products.id })
`
ok('G1 命中:扣库存不读回影响行', G.findDiscardedGuardedWrites(badG1).length === 1)
ok('G1 放过 returning 档', G.findDiscardedGuardedWrites(goodReturning).length === 0)
ok(
  'G1 放过"结果被接成变量"档',
  G.findDiscardedGuardedWrites(badG1.replace('      await db', '      const r = await db')).length === 0,
)
ok(
  'G1 放过单调推进(非额度列)',
  G.findDiscardedGuardedWrites(
    `      await tx
        .update(conv)
        .set({ lastMessageAt: row.createdAt })
        .where(and(eq(conv.id, cid), lt(conv.lastMessageAt, row.createdAt)))
`,
  ).length === 0,
)
ok(
  'G1 放过范围删除(守卫是选择条件)',
  G.findDiscardedGuardedWrites(
    `      await tx
        .delete(msgs)
        .where(and(eq(msgs.conversationId, cid), gt(msgs.createdAt, target.createdAt)))
`,
  ).length === 0,
)

ok(
  'G3 命中:余额相对扣减无额度守卫',
  G.findUnguardedDecrement(
    `      await db
        .update(margins)
        .set({ tokenQuantity: sql\`\${margins.tokenQuantity} - amount\` })
        .where(eq(margins.userId, uid))
`,
  ).length === 1,
)
ok(
  'G3 放过带 gte 守卫的扣减',
  G.findUnguardedDecrement(
    `      await db
        .update(margins)
        .set({ tokenQuantity: sql\`\${margins.tokenQuantity} - amount\` })
        .where(and(eq(margins.userId, uid), gte(margins.tokenQuantity, amount)))
`,
  ).length === 0,
)
ok('额度列判定有牙(gt(stock) 算 / eq(id) 不算)', G.guardsQuantityColumn('gt(products.stock, 0)') && !G.guardsQuantityColumn('eq(a.id, 1)'))
// 坐标锁:遮蔽面删注释字符 ⇒ 下标不可映射回原文;报表必须按锚定位,定不到就明说
const shifted = `// 注释一\n// 注释二\n// 注释三\nawait db\n  .update(products)\n  .set({ stock: sql\`\${products.stock} - 1\` })\n  .where(and(eq(products.id, id), gt(products.stock, 0)))\n`
const one = G.findDiscardedGuardedWrites(shifted)[0]
ok('遮蔽面上确有命中(坐标锁前置条件)', Boolean(one))
ok('报表行号按原文锚定位(第 7 行,不是遮蔽面上的偏移)', G.locateLine(shifted, one.whereFull)?.line === 7)
ok('同形锚两次命中给两个行号(不给重复错坐标)', (() => {
  const locate = G.makeLocator(shifted + shifted)
  const a = locate(one.whereFull)
  const b = locate(one.whereFull)
  return typeof a === 'number' && typeof b === 'number' && b > a
})())
ok('锚不在原文时报"未定位"而不是猜', String(G.makeLocator(shifted)('and(eq(nope.col, 1))')).includes('未定位'))

ok(
  'G2 命中:回调 catch 回 SUCCESS',
  G.findCallbackSwallowingFailure(
    `  server.post('/withdrawal/notify', async (req, reply) => {
    try { await h() } catch (e) { return reply.send({ code: 'SUCCESS', message: 'OK' }) }
  })`,
  ).length === 1,
)
ok(
  'G2 放过回 FAIL 待重投',
  G.findCallbackSwallowingFailure(
    `  server.post('/withdrawal/notify', async (req, reply) => {
    try { await h() } catch (e) { return reply.code(500).send({ code: 'FAIL', message: '副作用处理失败,待重试' }) }
  })`,
  ).length === 0,
)

// 形状锁:装车证明(读 runner 现值,不读本文档)
const runner = readFileSync(path.join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
const at = runner.indexOf("id: '243'")
const entry = at < 0 ? null : runner.slice(at, runner.indexOf('\n  },', at))
ok('243 已登记进 runner', Boolean(entry) && entry.length > 80)
ok('243 mode blocking 在位', Boolean(entry) && /mode:\s*'blocking'/.test(entry))
ok('243 skipEnv 成套', Boolean(entry) && /HUSKY_SKIP_GUARDED_WRITE_AFFECTED/.test(entry))
ok('243 射程 apps/api/src/', Boolean(entry) && /apps\/api\/src\//.test(entry))

// 覆盖面自锁:判据必须住在那台分词器上(回抄一份必然漂移)
const gate = readFileSync(path.join(ROOT, 'scripts', 'check-guarded-write-affected.mjs'), 'utf8')
ok('门体 import 复用 batch-write-lexer 的 findWriteChains', /from '\.\/lib\/batch-write-lexer\.mjs'/.test(gate) && gate.includes('findWriteChains'))
ok('门体不得自带括号配平/分词实现', !/function\s+closeParen|function\s+scanSpans/.test(gate))
ok('词法残留落未判定(leaks 非空不记绿)', /leaks\.length/.test(gate) && /未判定/.test(gate))

let rc = 0
for (const c of cases) {
  console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
  if (!c.pass) rc = 1
}
console.log(`mirror ${cases.filter((c) => c.pass).length}/${cases.length}`)
process.exit(rc)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
