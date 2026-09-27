// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:守门 112「压缩分母对账」。
 *
 * 为什么必须存在:门 112 判的是"分母有没有经唯一出口",而这类判据最容易**静默失效**
 * (正则改坏 / 出口名改名 / 豁免行判定错位),表现都是"仓库永远干净"。这里用纯函数 +
 * 构造输入证明它**有牙**,并用"装车证明"证明它真的在提交链上被调度、且文档点到了名
 * (守门 89 的 R1/R4 拦的就是"造好没装车")。
 *
 * 跑法:node --test scripts/tests/check-compaction-denominator.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { scanContent, inScanScope, assertNonEmptyScan } from '../check-compaction-denominator.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SCRIPT = 'check-compaction-denominator.mjs'

test('M1 阳性:token 数直接除以 contextLimit ⇒ 必须判红并点名行号', () => {
  const text = 'export function f(lastPromptTokens: number, contextLimit: number) {\n  const ratio = lastPromptTokens / contextLimit\n  return ratio > 0.88\n}\n'
  const hits = scanContent('apps/cli/src/demo.ts', text)
  assert.equal(hits.length, 1, `期望 1 处,实得 ${JSON.stringify(hits)}`)
  assert.equal(hits[0].line, 2, '行号必须停在真正做除法的那一行')
})

test('M2 成对反例:同一行改为经唯一出口取分母 ⇒ 必须判绿(证明 M1 不是恒真)', () => {
  const text = 'const contextLimit = effectiveContextWindow({ contextWindow, maxOutputTokens })\nconst ratio = lastPromptTokens / contextLimit\n'
  assert.deepEqual(scanContent('apps/cli/src/demo.ts', text), [])
})

test('M3 注释与字符串不得判红(否则门会在自己的说明里红;2026-09-25 本测试抓到原判据只剥注释不剥串)', () => {
  const text = '// lastPromptTokens / contextLimit 是旧写法,仅存说明\nconst s = "tokens / contextLimit"\n'
  assert.deepEqual(scanContent('apps/cli/src/demo.ts', text), [])
})

test('M3b 与 M3 成对:模板字符串里的除法仍须判红(那里能真放代码,一并剥掉就是把判据剥钝)', () => {
  assert.equal(scanContent('apps/cli/src/demo.ts', 'const msg = `比率 ${tokens / contextLimit}`\n').length, 1)
})

test('M4 行内豁免必须生效,且必须挂在原始行上(第一版判在剥皮行上=豁免永远不成立)', () => {
  const exempted = 'const ratio = lastPromptTokens / contextLimit // compaction-denominator-exempt: 自检夹具 until 2099-12-31\n'
  assert.deepEqual(scanContent('apps/cli/src/demo.ts', exempted), [])
  const plain = 'const ratio = lastPromptTokens / contextLimit\n'
  assert.equal(scanContent('apps/cli/src/demo.ts', plain).length, 1)
})

test('M5 判据失效不得表现为"扫 0 个文件记绿"', () => {
  assert.throws(() => assertNonEmptyScan([], 'HEAD'), /无法判定|0 个/, '空枚举必须大声失败')
  assert.doesNotThrow(() => assertNonEmptyScan(['apps/cli/src/a.ts'], 'HEAD'))
})

test('M6 扫描面按结构判,不按文件名猜', () => {
  assert.equal(inScanScope('apps/cli/src/compaction-v2.ts'), true)
  assert.equal(inScanScope('packages/context-compaction/src/index.ts'), true)
  assert.equal(inScanScope('apps/cli/node_modules/foo/bar.ts'), false, '依赖树不得进扫描面')
  assert.equal(inScanScope('apps/cli/src/README.md'), false, '文档不是被审内容')
})

test('M7 装车证明:门必须真在提交链里,且编号唯一、mode 与 skipEnv 齐备', () => {
  const runner = readFileSync(path.join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const blocks = [...runner.matchAll(/^    id: '(\d+)',\n([\s\S]*?)(?=^  \},\n)/gm)].filter(
    ([, , body]) => body.includes(`script: '${SCRIPT}'`),
  )
  assert.equal(blocks.length, 1, `runner 里本门注册块应为恰好 1,实得 ${blocks.length}(0=没装车,>1=撞号)`)
  const body = blocks[0][2]
  assert.match(body, /mode:\s*'blocking'/, '本门必须是 blocking(warn 等于没有)')
  assert.match(body, /skipEnv:\s*'HUSKY_SKIP_COMPACTION_DENOMINATOR'/, '应急通道必须在注册块里声明')
})

test('M8 文档点名(守门 89 R4 的同一条:接线了但文档不提=没人知道有这道门)', () => {
  for (const doc of ['AGENTS.md', 'README.md']) {
    const text = readFileSync(path.join(ROOT, doc), 'utf8')
    assert.ok(
      text.includes('check-compaction-denominator') || text.includes('check-compaction-denominator.mjs'.replace('.mjs', '')),
      `${doc} 通篇未点名本门`,
    )
  }
})

test('M9 失败提示里的每条命令都必须真能跑(提示写错=把人支去撞墙)', () => {
  const runner = readFileSync(path.join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const block = [...runner.matchAll(/^    id: '(\d+)',\n([\s\S]*?)(?=^  \},\n)/gm)].find(([, , b]) => b.includes(`script: '${SCRIPT}'`))
  assert.ok(block, 'runner 里没有本门(M7 已断言,此处防御性再来一次)')
  const hints = [...block[2].matchAll(/node (scripts\/[\w./-]+\.mjs)/g)].map((m) => m[1])
  assert.ok(hints.length >= 2, `onFailHint 里应至少给出"单独复验 + 自检"两条命令,实得 ${hints.length}`)
  for (const h of new Set(hints)) {
    assert.ok(path.isAbsolute(path.join(ROOT, h)) && readFileSync(path.join(ROOT, h), 'utf8').length > 0, `提示指向的文件不存在:${h}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
