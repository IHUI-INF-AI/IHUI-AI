// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:check-auth-handler-registration-parity 的接线与源码级反向锁。
// 判据行为(分类/决策)由门自身的 --self-test 成对证明;本文件钉的是**只有镜像能钉**的东西:
//   T1 装车证明 —— 从 HEAD 面的 guardian-runner.mjs 里按"script 行 → 上溯 `  {` → 下找 `  },`"
//      整块取出本门注册项,判 mode:'blocking' + skipEnv + stagedTriggers **成套**(缺一项即红);
//   T2 "未注册时不得被读成已装车" —— 同一提取器对不含本门的合成 runner 必须返回 null
//      (证明 T1 的"取到块"不是恒真;否则摘线后测试只是跟着一起变哑);
//   T3 门编号在 runner 中恰好出现一次(撞号 = skipEnv/失败归属串门,守门 89 R5 同型);
//   T4 遮罩不得有第二份(必须 import ./lib/code-mask.mjs,源码里不得再定义 maskCommentsAndStrings);
//   T5 取材面形状锁(内容必须走 face-reader 的 catBatch;不得出现 process.cwd() 定根 /
//      execSync / 裸 `git show` 拼串取内容);
//   T6 真仓 HEAD 端到端(spawn 门本体 --json):枚举必须看得见 apps/web(已注册的消费端)——
//      "看不见本仓实际产出的形态"等于判据失明。注意**不断言 exit 0**:真仓此刻存在未注册端
//      是该门要喊的红,把它断言成 0 就是替仓库欠账发合格证。
//   T7 台账与门的常量同源:门导出的 LEDGER_FILE 在盘上存在,且逐条过门自己的 schema。

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { gitRaw } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-auth-handler-registration-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = 'check-auth-handler-registration-parity.mjs'
const GATE_SRC = readFileSync(resolve(ROOT, 'scripts', SCRIPT), 'utf8')
const TEST_SRC = readFileSync(resolve(HERE, `check-auth-handler-registration-parity.test.mjs`), 'utf8')

function runnerHeadText() {
  return gitRaw(['show', 'HEAD:scripts/guardian-runner.mjs'], ROOT, { timeout: 60000 })
}

/** 按"script 行锚定 → 上溯块首 `  {` → 下找 `  },`"整块提取;找不到返回 null。 */
function extractEntry(runnerText, scriptName) {
  const lines = runnerText.split('\n')
  const anchor = lines.findIndex((l) => l.trim() === `script: '${scriptName}',`)
  if (anchor < 0) return null
  let start = -1
  for (let i = anchor; i >= 0; i--) {
    if (lines[i] === '  {') {
      start = i
      break
    }
  }
  if (start < 0) return { malformed: true }
  let end = -1
  for (let i = anchor; i < lines.length; i++) {
    if (lines[i] === '  },') {
      end = i
      break
    }
  }
  if (end < 0) return { malformed: true }
  return { block: lines.slice(start, end + 1).join('\n') }
}

test('T1 装车证明:本门在 HEAD 面 runner 的注册块成套(blocking + skipEnv + stagedTriggers)', () => {
  const e = extractEntry(runnerHeadText(), SCRIPT)
  assert.ok(e && !e.malformed, `注册块缺失或形状漂:${JSON.stringify(e)}`)
  assert.ok(e.block.includes(`script: '${SCRIPT}',`), 'script 行必须在块内')
  assert.match(e.block, /mode: 'blocking'/, '定级必须是 blocking(票面要求)')
  assert.match(e.block, /skipEnv: 'HUSKY_SKIP_AUTH_HANDLER_PARITY'/, 'skipEnv 必须成套')
  assert.match(e.block, /stagedTriggers: \[[^\]]*'apps\/'[^\]]*\]/, 'stagedTriggers 必须覆盖 apps/(端注册形态的改动要唤起本门)')
  assert.match(e.block, /id: ['"]\d+['"],/, '必须带数字 id')
})

test('T2 未注册时不得被读成已装车:同一提取器对合成 runner 返回 null(提取器有牙)', () => {
  const synthetic = "const checks = [\n  {\n    id: '1',\n    script: 'check-some-other-gate.mjs',\n    mode: 'blocking',\n  },\n]\n"
  assert.equal(extractEntry(synthetic, SCRIPT), null, '不含本门的 runner 必须提取为 null —— 否则 T1 是恒真式')
})

test('T3 本门编号在 runner 中恰好出现一次(script 行同样唯一,防同门双注册)', () => {
  const t = runnerHeadText()
  const e = extractEntry(t, SCRIPT)
  assert.ok(e && e.block, '前置:T1 的注册块必须在位')
  const id = /id: '(\d+)'/.exec(e.block)?.[1]
  assert.ok(id, 'id 可解析')
  const idCount = t.split('\n').filter((l) => l.trim() === `id: '${id}',`).length
  assert.equal(idCount, 1, `id ${id} 在 runner 中出现 ${idCount} 次(撞号会让 skipEnv/失败归属串门)`)
  const scriptCount = t.split('\n').filter((l) => l.trim() === `script: '${SCRIPT}',`).length
  assert.equal(scriptCount, 1, '同一 script 注册两行 = runner 跑两遍')
})

test('T4 遮罩不得有第二份:门 import lib/code-mask,且源码里不得自行定义 maskCommentsAndStrings', () => {
  assert.match(GATE_SRC, /from '\.\/lib\/code-mask\.mjs'/, '必须走共用遮罩实现')
  assert.doesNotMatch(GATE_SRC, /function\s+maskCommentsAndStrings/, '门内不得再写一份(两处实现必漂移)')
})

test('T5 取材面形状锁:内容走 face-reader 的 catBatch;禁 process.cwd() 定根 / execSync / 自派生 git show 读内容', () => {
  assert.match(GATE_SRC, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(GATE_SRC, /catBatch\(/, '内容必须经层读取入口 catBatch(只 import 不用 = 守门 118 的半接线)')
  assert.doesNotMatch(GATE_SRC, /process\.cwd\(/, '定根不得依赖站立目录(守门 70 的镜像 13/14 恒红那一型)')
  assert.doesNotMatch(GATE_SRC, /\bexecSync\b/, '禁 execSync 拼串派生 git')
  assert.doesNotMatch(GATE_SRC, /['"]git show|execFileSync\(\s*['"]git/, '内容不得经自派生 git show 取(必须走层)')
})

test('T6 真仓 HEAD 端到端:门本体 --json 可 parse,且必须看得见 apps/web 这一"已注册消费端"真形态', () => {
  const r = spawnSync(
    process.execPath,
    [resolve(ROOT, 'scripts', SCRIPT), '--json'],
    { encoding: 'utf8', windowsHide: true, timeout: 300000, cwd: ROOT },
  )
  assert.equal(r.error, undefined, `门本体派生失败:${r.error?.message}`)
  assert.ok([0, 1].includes(r.status), `exit 必须是 0/1 的判定结论(实得 ${r.status};2=无法判定另议)`)
  const j = JSON.parse(r.stdout)
  const web = j.ends.find((e) => e.end === 'apps/web')
  assert.ok(web, 'HEAD 面必须枚举到 apps/web 为消费端(看不见真实形态 = 判据失明)')
  assert.equal(web.registered, true, 'apps/web 现状必须被识别为已注册(接线判据的阳性对照)')
  assert.ok(j.ends.length >= 4, `消费端枚举不得空转(实得 ${j.ends.length})`)
  assert.ok(j.mechanism && j.mechanism.exported && j.mechanism.notifyCalled, 'AP3:注册口在 HEAD 面必须在位,否则本测试与门都在替"摘线"背书')
})

test('T7 台账与门同源:盘上台账存在、可 parse,且逐条过门自己的 schema', () => {
  const p = resolve(ROOT, 'scripts', gate.LEDGER_FILE.replace(/^scripts\//, ''))
  assert.ok(existsSync(p), `台账必须在位(${gate.LEDGER_FILE})`)
  const parsed = gate.parseLedger(readFileSync(p, 'utf8'))
  assert.equal(parsed.absent, false)
  assert.deepEqual(parsed.problems, [], '台账结构问题会砸 T7,但**线上判据**对坏 JSON 报 exit 2(T2 语义)')
  for (const e of parsed.entries) {
    assert.match(e.app, /^apps\/[\w-]+$/, 'app 必须是 apps/<端> 形态')
    assert.ok(typeof e.reason === 'string' && e.reason.trim().length > 20, '豁免理由必须成句')
    assert.match(e.reviewBy, /^\d{4}-\d{2}-\d{2}$/, 'reviewBy 必须是 ISO 日期')
    assert.ok(e.reviewBy >= new Date().toISOString().slice(0, 10), `台账条目已过期:${e.app}`)
  }
})

test('T8 反向锁:镜像测试自己不得再抄一份判据(§22c)', () => {
  // 判据行为只能 import 或 spawn 门本体;在测试里重新实现 classifyFile/decideParity 就是第二份真相。
  assert.doesNotMatch(TEST_SRC, /function\s+classifyFile/, '测试内不得定义镜像判据')
  assert.doesNotMatch(TEST_SRC, /function\s+decideParity/, '测试内不得定义镜像决策')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
