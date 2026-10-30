#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 273 的镜像测试:钉「这道门真的装在提交链上」「判据只有一份」「H1 升绝对零的资格仍然成立」。
// 判据实现一律从门体 __test__ 调(§22c 禁止在测试里复制判据)。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { maskComments } from '../lib/code-mask.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(ROOT, 'scripts/check-rn-interaction-hygiene.mjs')
const RUNNER = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
const GATE_SRC = readFileSync(GATE, 'utf8')
const { __test__ } = await import(pathToFileURL(GATE).href)
const { scanText, tierFromSource, runSelfTest, SKIP_ENV, SRC_RELS, GEO_REL, TIER_KEY, GEO_FIXTURE } =
  __test__

const run = (args) =>
  spawnSync(process.execPath, [GATE, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 28,
  })

test('① 装车:runner 注册块存在,blocking + skipEnv + 三条 stagedTriggers 成套', () => {
  const at = RUNNER.indexOf("script: 'check-rn-interaction-hygiene.mjs'")
  assert.ok(at > 0, 'runner 里没有本门的注册块 ⇒ 头注自称已接线就是假的(门 89 R1/R2)')
  const block = RUNNER.slice(Math.max(0, at - 900), at + 1400)
  assert.match(block, /id:\s*'273'/, '注册块缺 id 273')
  assert.match(block, /mode:\s*'blocking'/, '必须 blocking —— warn 拦不住任何事')
  assert.match(block, new RegExp(`skipEnv:\\s*'${SKIP_ENV}'`), 'skipEnv 与门内 SKIP_ENV 必须同名')
  for (const rel of SRC_RELS)
    assert.ok(
      block.includes(`'${rel}/'`),
      `门内射程枚举有 ${rel},而 runner 的 stagedTriggers 没有 ⇒ 改了射程没改触发面(静默失效)`,
    )
})

test('② 编号唯一:代码面上 id 273 只出现一次(R5/R13 同型防线)', () => {
  // 必须先用仓内遮罩库剥注释:注册行上方那句「编号 273:注册前已核 `id: \'273\'` 为 0」
  // 本身含同一串,不剥注释就把每一条注释都数成一条注册条目,唯一性判据当场失真。
  const code = maskComments(RUNNER)
  const n = (code.match(/id:\s*'273'/g) ?? []).length
  assert.equal(n, 1, `id '273' 在代码面出现 ${n} 次 ⇒ 要么撞号,要么同一对象里写了两个 id`)
})

test('③ 判据只有一份:镜像测试 import 门体 __test__,不自抄正则', () => {
  assert.match(
    GATE_SRC,
    /export const __test__ = \{[\s\S]*scanText[\s\S]*tierFromSource/,
    '门体没把核心判据暴露给测试 ⇒ 测试只能复制一份,而复制必然漂移(§22c)',
  )
  assert.match(
    readFileSync(fileURLToPath(import.meta.url), 'utf8'),
    /__test__ \} = await import\(pathToFileURL\(GATE\)\.href\)/,
    '本测试必须从门体取判据,而不是在测试里重写一遍',
  )
})

test('④ 判据行为锁:命中尺寸按"补满才算过",反馈四形态任一即放行', () => {
  const T = 36
  assert.equal(scanText('<Pressable style={{ width: 24, height: 24 }} onPress={go} />', T).h1.length, 1)
  assert.equal(scanText('<Pressable style={{ width: 44, height: 44 }} onPress={go} />', T).h1.length, 0)
  assert.equal(
    scanText('<Pressable hitSlop={2} style={{ width: 28, height: 28 }} onPress={go} onPressIn={p} />', T)
      .h1.length,
    1,
    'hitSlop 只补 4(28→32)仍不足档,写了不算过关 —— 否则 hitSlop={0} 就是消红通道',
  )
  assert.equal(
    scanText('<Pressable hitSlop={4} style={{ width: 28, height: 28 }} onPress={go} onPressIn={p} />', T)
      .h1.length,
    0,
  )
  assert.equal(
    scanText('<Pressable style={{ width: 24, height: 24 }} onPress={go} />', T).h2.length,
    1,
    '完全没有按压反馈必须被点名',
  )
  for (const form of [
    '<Pressable style={{ width: 24, height: 24 }} onPress={go} onPressIn={p} />',
    '<Pressable style={{ width: 24, height: 24 }} onPress={go} onPressOut={q} />',
    '<Pressable style={{ width: 24, height: 24 }} onPress={go}>{({ pressed }) => <View />}</Pressable>',
    '<Pressable className="active:opacity-60" style={{ width: 24, height: 24 }} onPress={go} />',
  ])
    assert.equal(scanText(form, T).h2.length, 0, `反馈形态漏认:【${form.slice(0, 46)}…】`)
})

test('⑤ 跨端源的 hitSlop 只补到 RN 腿 ⇒ 进 slopOnly 普查,不得读成两端都过关', () => {
  const badge =
    '<TouchableOpacity hitSlop={8} style={{ width: 20, height: 20 }} onPress={go} onPressIn={p} />'
  const cross = scanText(badge, 36, 'packages/app/src/features/x/Screen.tsx')
  const rn = scanText(badge, 36, 'apps/mobile-rn/src/components/X.tsx')
  assert.equal(cross.h1.length, 0)
  assert.equal(cross.slopOnly.length, 1, 'Taro 无 hitSlop 机制(端内 Sheet.tsx 头注自述"本端不设")⇒ 跨端源必须点名')
  assert.equal(rn.slopOnly.length, 0, 'RN 独占源里 hitSlop 是真补上了')
})

test('⑥ 档位只认被审面的 geometry.js,读不出 ⇒ exit 2,不猜 36', () => {
  assert.equal(tierFromSource(GEO_FIXTURE), 36)
  assert.equal(tierFromSource('export const A = 1'), null, '读不出必须 null ⇒ 由调用方落未判定')
  assert.equal(
    tierFromSource('export const GEOMETRY_PX = {\n  /** tapBox: 99 */\n  glyphMd: 20,\n}'),
    null,
    '注释里的档位不算数(遮罩后仍命中就是坏尺子)',
  )
  const live = run([])
  assert.match(
    live.stdout,
    /档位 36\(现读 packages\/design-tokens\/src\/geometry\.js\)/,
    `真面上必须报出"档位现读自 geometry.js",否则读档这一环不可观测:${live.stdout.slice(0, 200)}`,
  )
})

test('⑦ H1 升绝对零的资格锁:HEAD 面存量必须为 0(否则本门就是恒红门)', () => {
  const r = run([])
  const out = r.stdout + r.stderr
  const m = /命中尺寸<(\d+): (\d+) 处/.exec(out)
  assert.ok(m, `结论行读不到命中尺寸计数 ⇒ 尺子失效:${out.slice(0, 200)}`)
  assert.equal(Number(m[1]), 36, '档位读数必须是 geometry.js 的 tapBox')
  assert.equal(
    Number(m[2]),
    0,
    'H1 在提交链上是绝对零容忍(§0.2:升 blocking 的前置 = 存量归零)。存量回潮时先在这里翻红,' +
      '而不是等每个人的 pre-commit 被一道恒红门堵住 —— 那逼人 --no-verify,连带废掉全部守门。',
  )
  assert.equal(r.status, 0, `全量档应只报数不判红:${out.slice(-260)}`)
})

test('⑧ --self-test 真跑通(不是"文件里有这段代码")', () => {
  assert.equal(runSelfTest(), 0, '门内自检失败')
  const r = run(['--self-test'])
  assert.equal(r.status, 0, r.stderr.slice(0, 400))
  assert.match(r.stdout, /SELF-TEST OK/, '自检没有结论行 = 没跑')
})

test('⑨ 两面旗同给 ⇒ exit 2(守门 118:不猜哪面)', () => {
  const both = run(['--staged', '--worktree'])
  assert.equal(both.status, 2, both.stdout.slice(0, 200))
})

test('⑩ 跳过变量名一致且失效方向是"多要一次说明"', () => {
  const r = spawnSync(process.execPath, [GATE], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, [SKIP_ENV]: '1' },
  })
  assert.equal(r.status, 0)
  assert.match(r.stderr, /已跳过/, '跳门必须显式留痕,不得静默记绿(§0.10)')
})

test('⑪ R4 点名义务:README 的守门索引里有本门名(文档面读 HEAD blob)', () => {
  const readme = spawnSync('git', ['show', 'HEAD:README.md'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 28,
  })
  assert.equal(readme.status, 0, `读不到 HEAD 面 README:${readme.stderr}`)
  assert.ok(
    readme.stdout.includes('check-rn-interaction-hygiene.mjs'),
    '门已接线而文档通篇未点名 ⇒ 门 89 R4 判红;点名应落 README「守门脚本点名索引」的 UI/样式 行',
  )
})

test('⑫ 射程枚举与门体常量同源(三根 src 都在枚举里)', () => {
  assert.deepEqual(
    [...SRC_RELS].sort(),
    ['apps/mobile-rn/src', 'packages/app/src', 'packages/ui-native/src'].sort(),
    '射程写死在镜像测试里是故意的:哪天有人删掉一根(尤其 packages/app),这条会先响',
  )
  assert.equal(GEO_REL, 'packages/design-tokens/src/geometry.js')
  assert.equal(TIER_KEY, 'tapBox', '档位键名换了就必须同步改本门取值处,不许就近吸附成第二个数')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
