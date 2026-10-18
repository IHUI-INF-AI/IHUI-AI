#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 224(告警身份抖动对账)的镜像测试(§22c:import 源脚本的 `__test__`,零复制判据)。
 *
 * 这里钉的是四件事,全都是"门自己会骗人"的方向:
 *  ① 装车证明:注册条目 blocking 与 skipEnv 必须成套,且门体头注点名的 skipEnv 逐字等于注册条目 ——
 *     头注说接了而注册表没有 = 给所有人造红;注册了而头注没写 = 守门 89 R1/R4 的那一型。
 *  ② 判据不咬自己的解释文字:注释与"单引号串里的示例代码"都不算实现,但**模板字面量必须仍读得到**
 *     (用了 `blankStrings` 就连真代码一起抹 ⇒ 门整型失明,实测过)。
 *  ③ 发信台账两支都写:成功写、失败也写。只写成功那一支,量算仪就会把"投递一直失败"读成"零发信"
 *     —— 与 §5e「失败必须响」同一条,只是这次瞎的是量的人。
 *  ④ 豁免台账不得指向已不存在的路径(清单腐烂),且到期日必须是可解的日期。
 *
 * 用法:`node --test scripts/tests/check-alert-identity-volatility.test.mjs`
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gitRaw, catBatch } from '../lib/face-reader.mjs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { __test__ as G } from '../check-alert-identity-volatility.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = 'scripts/check-alert-identity-volatility.mjs'
const RUNNER = 'scripts/guardian-runner.mjs'
const LEDGER_JSON = 'scripts/data/alert-identity-exemptions.json'

function headBlob(rel) {
  const map = catBatch(ROOT, [`HEAD:${rel}`])
  return map.get(`HEAD:${rel}`)
}

/** 按花括号配平取整个函数体(与 git-guardian-notify 等镜像档同一形态;只判存在不判缩进)。 */
function funcBody(src, name) {
  const start = src.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `HEAD 面找不到 ${name}()`)
  const open = src.indexOf('{', start)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1)
  }
  assert.fail(`${name}() 花括号未配平`)
}

test('① 装车证明:门 224 的注册条目在 HEAD 面成套,且门体头注与注册条目逐字同形', () => {
  const runner = headBlob(RUNNER)
  assert.equal(typeof runner, 'string', 'HEAD 面取不到 runner ⇒ 本用例无从判(不得当作通过)')
  const entries = [...String(runner).matchAll(/\{\s*\n\s*id:\s*'(\d+)',[\s\S]{0,900}?\n  \}/g)]
  assert.ok(entries.length > 0, '注册条目一条都没解析出来 ⇒ 判据失效,不是"没接"')
  const mine = entries.map((m) => m[0]).find((blk) => /check-alert-identity-volatility\.mjs/.test(blk))
  assert.ok(mine, '注册表里没有本门的条目(头注却声称已接 = 守门 89 R1)')
  assert.match(mine, /mode:\s*'blocking'/, '定级未登记 ⇒ 静默回落成 warn')
  const skipEnv = /skipEnv:\s*'([A-Z0-9_]+)'/.exec(mine)?.[1]
  assert.ok(skipEnv, 'blocking 而无 skipEnv ⇒ 出问题时没人能应急放行(§22c 形态锁)')
  const header = headBlob(GATE)
  assert.ok(header.includes(skipEnv), `门体头注没点名注册条目那把 skipEnv(${skipEnv})⇒ 文档与注册表必然漂开`)
  assert.match(header, /id 224|守门 id 224/, '头注必须点名自己的门号')
})

test('② 判据既不咬解释文字,也不被遮罩做瞎(成对夹具)', () => {
  const commentCase = '// dedupKey: `stall;tip=${p.tipSha}` 这是历史成因叙述\nconst a = 1'
  assert.equal(G.judgeFile('scripts/x.mjs', commentCase).length, 0, '注释里的示例被当实现判红')
  const fixtureCase = 'const bad = "dedupKey: `x;at=${iso}`"'
  assert.equal(G.judgeFile('scripts/x.mjs', fixtureCase).length, 0, '单引号串里的示例代码被当实现判红')
  const realCase = 'notifyGuardRed(n, d, { dedupKey: `x;at=${p.lastSuccessIso}` })'
  assert.ok(G.judgeFile('scripts/x.mjs', realCase).length, '真模板字面量读不到 = 门失明(blankStrings 那一型)')
})

test('③ 发信台账:成功与失败两支都必须写账(只写成功=把投递失败读成零发信)', () => {
  const src = headBlob('scripts/git-guardian.mjs')
  assert.equal(typeof src, 'string', 'HEAD 面取不到 git-guardian ⇒ 未判定')
  const body = funcBody(String(src), 'notifyGuardRed')
  assert.ok(body.length > 2000, `函数体抽出来只有 ${body.length} 字符 ⇒ 提取器失效,不得继续判`)
  const okAt = body.indexOf('if (r.ok) {')
  const elseAt = body.indexOf('} else {', okAt)
  assert.ok(okAt > 0 && elseAt > okAt, '找不到投递结论的两支 ⇒ 本用例失效(结构变了要同步改这里,不能默默放行)')
  const succPart = body.slice(okAt, elseAt)
  const failPart = body.slice(elseAt)
  assert.match(succPart, /appendMailSendLedger/, '成功支不写账 ⇒ 风暴量不出来(今天 18 封就是这么隐形的)')
  assert.match(failPart, /appendMailSendLedger/, '失败支不写账 ⇒ "一直寄不出去"被读成"零发信"')
})

test('④ 豁免台账:每条都必须指向 HEAD 面存在的路径,到期日必须可解', () => {
  const text = headBlob(LEDGER_JSON)
  assert.equal(typeof text, 'string', '台账在 HEAD 面取不到')
  const rows = JSON.parse(text)
  assert.ok(Array.isArray(rows), '台账必须是数组')
  const files = String(gitRaw(['ls-tree', '-r', '--name-only', 'HEAD'], ROOT) || '').split(/\r?\n/)
  for (const r of rows) {
    assert.ok(files.includes(r.file), `豁免指向不存在的路径 ${r.file} ⇒ 清单腐烂(§0.7:豁免也会到期)`)
    assert.ok(r.reason && String(r.reason).length > 10, `${r.file} 的豁免没写原因`)
    assert.ok(Number.isFinite(Date.parse(String(r.until))), `${r.file} 的到期日不可解 ⇒ 等于永久豁免`)
    assert.ok(r.ticket, `${r.file} 的豁免没点名字出处(ticket)`)
  }
})

test('⑤ 量算仪射程:发信台账必须是它的源之一,且取不到时报 null 不报 0', () => {
  const src = headBlob('scripts/alert-volume-report.mjs')
  assert.match(String(src), /mail-send-ledger\.jsonl/, '量算仪没把投递台账当源 ⇒ 最大的发信面仍然隐形')
  assert.match(String(src), /ledgerTotal24h:\s*ledger\s*\?\s*ledger\.windows\['24h'\]\.mailCount\s*:\s*null/, '取不到必须落 null(用 0 冒充"没寄过"是今天那一型的另一半)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
