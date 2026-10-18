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

/**
 * 按花括号配平取整个函数体。
 * ⚠️ 不能"从函数名往后找第一个 `{`"——`(opts = {})` 的默认值先命中,取到的是那个空对象
 * (实测本档第一次就这么瞎掉:函数体长度 2,断言立刻把它报成"提取器失效"而不是假过)。
 * 先把圆括号配平走完到参数表结束,再取 body 的开括号。
 */
function funcBody(src, name) {
  const start = src.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `HEAD 面找不到 ${name}()`)
  let paren = 0
  let i = src.indexOf('(', start)
  for (; i < src.length; i++) {
    if (src[i] === '(') paren++
    else if (src[i] === ')' && --paren === 0) break
  }
  const open = src.indexOf('{', i)
  let depth = 0
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}' && --depth === 0) return src.slice(open, j + 1)
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

test('③ 发信台账:每一支投递结论都写账(成功/失败 × 真实/自测 = 4 支),漏一支就有一型发信无人记账', () => {
  const src = headBlob('scripts/git-guardian.mjs')
  assert.equal(typeof src, 'string', 'HEAD 面取不到 git-guardian ⇒ 未判定')
  const body = funcBody(String(src), 'notifyGuardRed')
  assert.ok(body.length > 2000, `函数体只抽出 ${body.length} 字符 ⇒ 提取器失效,不得继续判`)
  const calls = (body.match(/appendMailSendLedger/g) || []).length
  assert.equal(calls, 4, `notifyGuardRed 里应有 4 处写账(真实成功/真实失败/自测成功/自测失败),实测 ${calls}`)
  // 逐支锚定:凡出现"送达"结论处,前后 700 字符内必须有账 —— 防止四支都写成只覆盖同一支
  for (const anchor of [
    'withAlertMark(state, name, fp, now, true)',
    'withAlertMark(state, name, fp, now, false)',
    '通知自测已送达',
    '通知自测失败',
  ]) {
    const at = body.indexOf(anchor)
    assert.ok(at > 0, `找不到锚点「${anchor}」⇒ 本用例失效(结构变了要同步改这里,不能默默放行)`)
    const win = body.slice(Math.max(0, at - 700), at + 700)
    assert.match(win, /appendMailSendLedger/, `「${anchor}」这一支不写账 ⇒ 量算仪会把它读成"没寄过"`)
  }
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
