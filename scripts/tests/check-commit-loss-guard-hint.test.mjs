// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:守门 30a 的"仅本地 tag"提示必须真被打印(判据从源文件 import,不复制实现)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 判定单元向源取(门体已带 §22d 入口守卫,静态 import 不会把门跑一遍 —— 由末尾 E1 那条锁住)。
import { __test__ as gate } from '../check-commit-loss-guard.mjs'

const SRC = path.resolve(import.meta.dirname, '..', 'check-commit-loss-guard.mjs')
const src = readFileSync(SRC, 'utf8')

test('HOLLOW_TAG_HINT 常量必须存在且带三要素:症状串 / 死路结论 / 正确判据', () => {
  const m = src.match(
    /const HOLLOW_TAG_HINT =([\s\S]*?)\n\/\*\*|const HOLLOW_TAG_HINT =([\s\S]*?)\n\n/,
  )
  assert.ok(m, 'HOLLOW_TAG_HINT 常量不见了')
  const body = (m[1] || m[2] || '') + ''
  for (const needle of ['unable to read', 'remote unpack failed', '空壳', '--missing=allow-any'])
    assert.ok(body.includes(needle), `提示里缺少"${needle}"`)
})

test('两处"仅本地"warn 都必须挂上该提示(漏一处就等于没说)', () => {
  const warns = [...src.matchAll(/仅本地\(\$\{/g)].length
  // 只数标识符出现次数,不拼 console.log 的字面形态 —— prettier 会把长行折成多行,
  // 按格式匹配的用例会在"谁都没改坏逻辑"的时候红掉(本用例第一版就栽在这)。
  const uses = [...src.matchAll(/\bHOLLOW_TAG_HINT\b/g)].length - 1 // 减掉 const 定义那一处
  assert.ok(warns >= 2, `只找到 ${warns} 处"仅本地"warn,登记面缩水了`)
  assert.equal(uses, warns, `warn ${warns} 处 / 提示引用 ${uses} 处 —— 有成对缺口`)
})

test('提示不得改变退出语义(warn 仍是 warn)', () => {
  assert.ok(!/HOLLOW_TAG_HINT[\s\S]{0,80}process\.exit\(1\)/.test(src), '提示被接到了失败分支上')
})

test('两处"仅本地"warn 的清单形态 = 源的 briefList(截断规则只有一份,§22c)', () => {
  // 2026-09-18 那次刷屏事故的修法是"前 5 个 + 总数",规则只有 briefList 这一处实现。
  // 这里不再抄它的输出格式(抄了就成了 §22c 说的第二份真相),只锁两件事:
  //   ① 两句 warn 的清单确实走源函数;② 源函数确实还在做"短列表原样 / 长列表截断并报数"。
  const warns = [...src.matchAll(/仅本地\(\$\{/g)]
  assert.equal(warns.length, 2, `只找到 ${warns.length} 处"仅本地"warn,登记面缩水了`)
  for (const w of warns) {
    const line = src.slice(w.index).split('\n')[0]
    assert.match(line, /briefList\(/, '这句 warn 的清单必须由源的 briefList 给出,不得另抄一份截断')
  }
  const many = Array.from({ length: 6 }, (_, i) => `t${i}`)
  assert.equal(gate.briefList(['a', 'b', 'c']), 'a, b, c', '未超上限必须原样列出(不截断)')
  const long = gate.briefList(many)
  assert.ok(!long.includes('t5'), `超上限必须截断,实得:${long}`)
  assert.ok(long.includes(String(many.length)), `截断后必须报出总数,实得:${long}`)
})

test('紧急跳过提示里的变量名 = 门真正读取的常量(否则就是假逃生舱)', () => {
  // 判据读的是 gate.SKIP_ENV(§22 唯一的紧急出口);提示文案里教用户设的名字若与它不同,
  // 用户照文案设了却毫无效果 —— 那只会逼人改用 --no-verify,连带废掉整条守门链。
  const name = String(gate.SKIP_ENV).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  assert.ok(name.length > 0, '源没给出紧急跳过变量名常量')
  assert.match(
    src,
    new RegExp(`紧急跳过[^\\n]*\\$\{C\\.cyan\}${name}=1 git commit`),
    `blocking 分支教的紧急跳过名必须等于源常量 ${gate.SKIP_ENV}`,
  )
})

test('E1 §22d:裸 import 门体 ⇒ 零输出、exit 0', () => {
  /**
   * 本文件顶部的 `import { __test__ }` 之所以安全,全靠门体那条 `if (isDirectRun)` 守卫。
   * 守卫被人删回"顶层无条件 main()"时,任何 import 都会把整道门跑一遍:探针的 cwd 是
   * **夹具 scratch 目录(非 git 仓库)**,fsck 取不到判据 ⇒ 门打印「无法判定」并 exit 2,
   * 于是这条用例读到红 —— 判据失效的表现是响,不是安静。
   */
  const dir = mkScratch('clg-hint-import-')
  try {
    const probe = path.join(dir, 'probe.mjs')
    writeFileSync(
      probe,
      `import(${JSON.stringify(pathToFileURL(SRC).href)}).then((m) => process.stdout.write('PROBE_KEYS=' + Object.keys(m).join(',') + '\\n'))\n`,
      'utf8',
    )
    const r = spawnSync(process.execPath, [probe], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const got = `${r.stdout || ''}${r.stderr || ''}`
    assert.equal(r.status, 0, `裸 import 必须 exit 0,实得 ${r.status}\n${got}`)
    assert.equal(r.stderr, '', `裸 import 不得写 stderr(写了说明 main() 被跑起来)\n${got}`)
    assert.equal(r.stdout, 'PROBE_KEYS=__test__\n', `裸 import 只许探针出声,实得 stdout=${JSON.stringify(r.stdout)}`)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
