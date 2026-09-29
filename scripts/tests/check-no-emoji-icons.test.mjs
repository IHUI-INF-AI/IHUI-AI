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

/**
 * ── 2026-09-29 追加:三处**失明**的锁(与本文件上方"读文件容错"两码事)────────────────
 *
 * 当天现读到的事实:这道 blocking 门在仓库里明明有 26 处"字符当 UI 图标",而 `--staged` 与
 * 全量两档**都报绿**。三个原因各自独立,少修一个都还是瞎的:
 *  ① 表情面板(InputArea)整文件豁免 ⇒ 同文件里按钮位的 emoji 一起被放过;
 *  ② `RENDER_EMOJI_RE` 是行内判据 ⇒ 被 prettier 拆成独立行的 JSX 文本子节点(`>␤ ★ ␤ </Text>`)看不见;
 *  ③ 注释豁免写成"整行以 `{` 起手即放过",而 JSX 表达式行**全都**以 `{` 起手
 *     ⇒ `{selected && <Text>✓</Text>}` 这一族整族隐身(这才是 26→5 的差)。
 * 下面 T1–T6 就是把这三处 + "判据只许有一份实现"钉成机器可查。区段表只从 `EMOJI_RE.source`
 * 派生(本文件原本已有三处逐字复制,第四处就是下一次漂移的起点)。
 */
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const GATE_PATH = SCRIPT
const norm = (s) => s.replace(/\s+/g, ' ').trim()
let cachedSrc = null
const srcText = () => (cachedSrc ??= readFileSync(GATE_PATH, 'utf8'))

/** 跑一次 `--self-test`。刻意清掉跳门 env —— 否则"跳过"会被读成"通过"。 */
function runSelfTest(scriptPath) {
  try {
    const out = execFileSync(process.execPath, [scriptPath, '--self-test'], {
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, HUSKY_SKIP_NO_EMOJI: '' },
    })
    return { rc: 0, out }
  } catch (e) {
    return { rc: e.status ?? -1, out: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

test('T1 注释豁免不得再吃掉整行 JSX 表达式(旧写法 `|\\{` 是 26 处隐身的根因)', () => {
  const line = norm(srcText()).match(/if \(\/\^\\s\*\([^)]*\)\//)?.[0] || ''
  assert.ok(line, '未定位到豁免 1 的判定式 ⇒ 尺子失效,不得视作通过')
  assert.ok(line.includes(String.raw`{\/\*`), `豁免 1 必须只认 \`{/*\` 起手的 JSX 注释,实得:${line}`)
  assert.ok(!/\|\{\)/.test(line), `豁免 1 不得再出现裸 \\{ 分支(它放过所有 JSX 表达式行):${line}`)
})

test('T2 区段表只许有一份:派生正则必须从 EMOJI_RE.source 取,不得自己抄', () => {
  // 用**逐字子串**而不是再写一层转义正则:上一版这里断言自己写错了转义(`\.\*` 对 `.*`),
  // 结果是"测试红"被误读成"判据被改"—— 形状锁的表达式越复杂,越容易锁的是它自己。
  assert.ok(
    srcText().includes(String.raw`EMOJI_CHAR_CLASS = /^\[(.*)\]$/u.exec(EMOJI_RE.source)`),
    'EMOJI_CHAR_CLASS 必须从 EMOJI_RE.source 提取(区段表只许有一份)',
  )
  for (const name of ['PANEL_ELEMENT_RE', 'PANEL_ARRAY_RE', 'BARE_EMOJI_LINE_RE']) {
    const at = srcText().indexOf(`const ${name}`)
    assert.ok(at > 0, `未找到 ${name} 的定义 ⇒ 该判据已被摘线`)
    const def = srcText().slice(at, at + 340)
    assert.ok(!/\\u\{1F000\}/.test(def), `${name} 不得自己抄一份 Unicode 区段表:${def.slice(0, 140)}`)
    assert.match(def, /EMOJI_CHAR_CLASS/, `${name} 必须由 EMOJI_CHAR_CLASS 派生`)
  }
})

test('T3 区段表提取失败必须大声退出 2,不得静默降级成"全不豁免"或"全放行"', () => {
  assert.match(srcText(), /if \(!EMOJI_CHAR_CLASS\)[\s\S]{0,300}process\.exit\(2\)/)
})

test('T4 主循环与自检共用同一份判定(judgeLine),不得留第二份内联实现', () => {
  const calls = srcText().match(/judgeLine\(/g) || []
  assert.ok(calls.length >= 2, `judgeLine 必须既有定义又有调用点,实得 ${calls.length} 处`)
  // 判"主循环里不许自己跑 isExempt"必须**按循环体窗口**取,不能全文搜 ——
  // 上一版全文负向断言被 judgeLine 自己体内那句 `if (isExempt(...)) return null` 顶红,
  // 红的是断言写法,不是门被改了(本仓记过多次"假阳比漏报更贵")。
  const at = srcText().indexOf('lines.forEach((line, idx) => {')
  assert.ok(at > 0, '未定位到扫描主循环 ⇒ 该锁失效,不得视作通过')
  const body = srcText().slice(at, at + 600)
  assert.ok(body.includes('judgeLine('), `主循环没走 judgeLine:${body.slice(0, 200)}`)
  assert.ok(!body.includes('isExempt('), '主循环不得再直接调 isExempt 后自跑三个正则(那正是"自检绿而门瞎"的形态)')
})

test('T5 门体自检必须真绿(装车证明,不读文档数字)', () => {
  const r = runSelfTest(GATE_PATH)
  assert.equal(r.rc, 0, `--self-test 应 rc=0,实得 ${r.rc}\n${r.out}`)
  assert.match(r.out, /自检 \d+ 通过 \/ 0 失败/)
})

test('T6 三条变异各自必须把自检翻红(证明每条新判据都有牙,不是恒绿断言)', () => {
  const dir = mkScratch('emoji-gate-mutation-')
  try {
    copyScriptWithClosure(join(REPO, 'scripts'), 'check-no-emoji-icons.mjs', join(dir, 'scripts'))
    const dst = join(dir, 'scripts', 'check-no-emoji-icons.mjs')
    const base = readFileSync(dst, 'utf8')
    const mutations = [
      [
        '豁免 1 回退成"整行以 { 即放过"',
        // String.raw 免掉双层转义:目标文件里那段式子的字面文本就是 `|\{\/\*`
        () => base.replace(String.raw`|\{\/\*`, String.raw`|\{`),
      ],
      [
        '豁免 2 回退成整文件豁免',
        () =>
          base.replace(
            /if \(EMOJI_PICKER_FILE_RE\.test\(file\)\) \{[\s\S]*?\n  \}\n/,
            'if (EMOJI_PICKER_FILE_RE.test(file)) return true\n',
          ),
      ],
      [
        '违规 3(裸 emoji 行)摘线',
        () =>
          base.replace(
            /const bare = BARE_EMOJI_LINE_RE\.exec\(line\.trim\(\)\)[\s\S]*?\n  \}\n\n  return null/,
            'return null',
          ),
      ],
    ]
    for (const [label, mutate] of mutations) {
      const mutated = mutate()
      assert.notEqual(mutated, base, `变异「${label}」没有真的改动源码 ⇒ 这条臂是空转的`)
      writeFileSync(dst, mutated)
      const r = runSelfTest(dst)
      assert.notEqual(r.rc, 0, `变异「${label}」之后自检仍全绿 ⇒ 该判据没有牙\n${r.out}`)
    }
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
