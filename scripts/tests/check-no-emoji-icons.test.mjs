// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/check-no-emoji-icons.mjs 的镜像测试(此前**根本没有**)。
 *
 * 立因:这道 blocking 门扫整棵工作树却对 `readFileSync` 无 try/catch。并行会话在
 * `readdirSync` 与读取之间删掉一个文件,就以未捕获 ENOENT 崩出去、Node 退出码 1 ⇒
 * "我读不到"被上报成"你违规"(按项目口径读不到应走 exit 2/无法判定)。而一道 blocking
 * 门无端红的实际后果不是"这次提交红",是**每次提交都被迫 --no-verify,连带约 110 道门作废**
 * (AGENTS §12e / 守门 78 同型)。
 *
 * 判据只钉**结构位**,不钉相邻文本(整块文本搜会在合规代码上恒红 —— 本项目当天连修三次同族)。
 * 三条结构判据收进 `readGuardShape()` 一处,并配一条**变异对照**:把修复前那一版的主循环读取
 * 原样嵌进来当反例,同一函数必须判它"不成形"。缺了这条,任何把正则写宽的改动都会让本文件
 * 变成"永远为真的断言"(§22c 同型失效)。另配端到端一条:真跑一次,崩溃与违规必须能区分。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-no-emoji-icons.mjs')

/**
 * 从"扫描主循环的读点"起算一个窗口,逐项判容错结构是否成形。
 * 定位失败(找不到读点)必须显式报错,不得当成"已包住"而放行。
 */
function readGuardShape(src) {
  const at = src.indexOf("readFileSync(file, 'utf8')")
  assert.ok(at > 0, '未定位到扫描主循环的读点 ⇒ 判据定位失败,不能视作通过')
  const win = src.slice(at, at + 700)
  return {
    有catch: /\}\s*catch\s*\(/.test(win),
    认ENOENT: /ENOENT/.test(win),
    认EBUSY: /EBUSY/.test(win),
    照抛其它异常: /throw\s+e/.test(win),
    有计数: /(?:let|const)\s+unreadable\b/.test(src),
    打印计数: /读不到而跳过/.test(src),
  }
}

const 完整成形 = (shape) => Object.entries(shape).filter(([, v]) => !v).map(([k]) => k)

test('结构:读文件的容错六项齐备(缺任一项即红)', () => {
  const missing = 完整成形(readGuardShape(readFileSync(SCRIPT, 'utf8')))
  assert.deepEqual(missing, [], `容错结构不完整: ${missing.join(' / ')}`)
})

test('变异对照:修复前那一版必须被判为不成形', () => {
  // 9974db24956^ 的主循环读取原样抄入(反例夹具,勿"顺手修好")。
  const before = `
let totalViolations = 0
const fileReports = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\\n')
  const findings = []
  if (findings.length) {
    totalViolations += findings.length
    fileReports.push({ file, findings })
  }
}

console.log(\`  违规数:   \${totalViolations} 处 (BLOCKING)\`)
process.exit(totalViolations > 0 ? 1 : 0)
`
  const missing = 完整成形(readGuardShape(before))
  assert.ok(
    missing.includes('有catch') && missing.includes('认ENOENT') && missing.includes('打印计数'),
    `反例未被识别 ⇒ 判据太宽(实际判缺: ${missing.join(' / ') || '无'}),本测试断言无效`,
  )
})

test('端到端:真跑一次,不得以未捕获异常收场(崩溃 ≠ 违规)', () => {
  const r = spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    cwd: REPO,
    timeout: 180_000,
    windowsHide: true,
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  assert.ok(
    !/ENOENT|EBUSY|Node\.js v\d+/.test(out),
    `输出里出现未捕获异常签名(退出码 ${r.status}):\n${out.split(/\r?\n/).slice(-8).join('\n')}`,
  )
  assert.match(out, /扫描文件/, '没打印扫描结果 ⇒ 很可能没真跑')
  assert.ok(r.status === 0 || r.status === 1, `退出码只能是 0(通过)/1(违规),实得 ${r.status}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
