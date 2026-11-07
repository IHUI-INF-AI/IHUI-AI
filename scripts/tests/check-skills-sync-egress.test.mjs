// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 `scripts/check-skills-sync-egress.mjs` 的 §22c 镜像测试(BUG-NEW-02 出票件)。
//
// 覆盖四件事,缺一即本票不成立:
//   ① 基线自身成立:11 处逐点登记,每点都写明「不在事件循环内、有显式 timeout」;
//   ② 基线树 → 绿(判据不会把存量债一次性钉红);
//   ③ 新增裸 `requests.<method>` → 红,且点名文件与行号;
//   ④ 存量被清掉 → 绿(棘轮只拦新增,清债不反向钉红);
//   ⑤ 待判目录缺失 → 退 2「无法判定」,不冒绿。
//
// 判据与基线都只从生产侧那一份取(§22c:不在测试里抄第二份实现)。

import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../check-skills-sync-egress.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE = resolve(HERE, '..', 'check-skills-sync-egress.mjs')

function runGate(root) {
  const result = spawnSync(process.execPath, [GATE, '--root', root], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/** 把基线逐点还原成最小文件树;`skipIndex` 用于制造"存量下调"。 */
function writeBaselineTree(root, skipIndex = -1) {
  const byFile = new Map()
  G.BASELINE.forEach((entry, index) => {
    if (index === skipIndex) return
    if (!byFile.has(entry.file)) byFile.set(entry.file, [])
    byFile.get(entry.file).push(entry)
  })

  for (const [relFile, entries] of byFile) {
    const absFile = join(root, ...relFile.split('/'))
    mkdirSync(dirname(absFile), { recursive: true })
    const lines = entries.map((entry) =>
      entry.kind === 'urlopen'
        ? `    with urllib.request.urlopen(req, ${entry.timeout}) as resp:`
        : `    resp = ${entry.kind}(URL, ${entry.timeout})`,
    )
    writeFileSync(absFile, `${lines.join('\n')}\n`, 'utf8')
  }
}

function withScratch(fn) {
  const dir = mkScratch('skills-sync-egress')
  try {
    return fn(dir)
  } finally {
    rmScratch(dir)
  }
}

test('基线:11 处逐点登记,每点都写明不在事件循环且带显式 timeout', () => {
  assert.equal(G.BASELINE.length, 11)
  for (const entry of G.BASELINE) {
    assert.match(entry.file, /^apps\/ai-service\/app\/skills\//)
    assert.ok(entry.reason.includes('不在事件循环内'), `${entry.file}: 缺「不在事件循环内」理由`)
    assert.ok(entry.reason.includes('timeout'), `${entry.file}: 缺「有显式 timeout」理由`)
  }
})

test('基线树 → 退出 0(存量债不被一次性钉红)', () => {
  withScratch((root) => {
    writeBaselineTree(root)
    const result = runGate(root)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /11\/11 处基线内/)
  })
})

test('新增裸 requests.post → 退出 1 且点名', () => {
  withScratch((root) => {
    writeBaselineTree(root)
    const target = join(root, ...G.BASELINE[0].file.split('/'))
    const body = readFileSync(target, 'utf8')
    writeFileSync(target, `${body}\n    extra = requests.post(EXTRA_URL, timeout=30)\n`, 'utf8')

    const result = runGate(root)
    assert.equal(result.status, 1, result.stdout)
    assert.match(result.stderr, /发现 1 处新增裸同步网络调用/)
    assert.match(result.stderr, /requests\.post/)
  })
})

test('清掉一处存量 → 退出 0 且报棘轮下调', () => {
  withScratch((root) => {
    // 抽 csdn 的 1 条 urlopen(该文件仍有其余 3 条),证明"存量变少"不会被当成基线失效。
    writeBaselineTree(root, 2)
    const result = runGate(root)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /存量下调 1 处/)
  })
})

test('待判目录缺失 → 退出 2,不冒绿', () => {
  withScratch((root) => {
    mkdirSync(join(root, 'empty'), { recursive: true })
    const result = runGate(root)
    assert.equal(result.status, 2, result.stdout)
    assert.match(result.stderr, /无法判定/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
