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

/**
 * 判序纯函数的函数体。镜像钉的是"每一维真的被这段代码引用",而不是文案里写了档位。
 * 立因:2026-10-31 主流程内联判序时,一次改稿把 `if (r.h2.length > base.h2.length)` 吃成语句 `NaN`
 * (ASI 合法 ⇒ 无语法错),H2 变成无条件报项 = 恒红门,而 41 组自检全绿 —— 判序不住在可测的地方,
 * 就没人能证明它还按预期的方向拦。抽成函数后这段体就是唯一的问责面。
 */
function verdictBody() {
  const at = GATE_SRC.indexOf('function stagedVerdict(')
  assert.ok(at > 0, '判序函数不在了 ⇒ 有人把它内联回主流程,NaN 那一型就是这么漏进来的')
  const end = GATE_SRC.indexOf('\n}\n', at)
  assert.ok(end > at, '判序函数体读不到结尾 ⇒ 结构变了,这条锁要跟着重写而不是删')
  return GATE_SRC.slice(at, end)
}

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
    // 唯一口 Tappable:pressed 态由组件内部持有,交给原生 Pressable 的是**数组**形态 style。
    '<Tappable style={{ width: 24, height: 24 }} onPress={go} />',
  ])
    assert.equal(scanText(form, T).h2.length, 0, `反馈形态漏认:【${form.slice(0, 46)}…】`)
  // 反向锁:pressFeedback 返回函数形态 style,会被 cssInterop 换成 `{}`(守门 131 真机定案)。
  // 它从合法形态里摘掉后必须判红 —— 否则这一维还在给"样式整份消失"的写法发免检。
  assert.equal(
    scanText('<Pressable style={pressFeedback(styles.a)} onPress={go} />', T).h2.length,
    1,
    'pressFeedback 仍被认作有反馈 ⇒ 函数形态回潮被放行',
  )
  assert.equal(
    scanText('<Tappable style={pressFeedback(styles.a)} onPress={go} />', T).h2.length,
    1,
    'Tappable 上叠 pressFeedback(双重包裹)必须照判 ⇒ 换了组件不能掩盖旧机制回潮',
  )
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

test('⑬ 反馈判据认原语默认态:把 TouchableOpacity 的自带变暗算成缺反馈 = 957 枚误报', () => {
  const { hasNativeFeedback } = __test__
  assert.equal(hasNativeFeedback('TouchableOpacity', ' style={{}} '), true, '默认 activeOpacity=0.2 就是反馈')
  assert.equal(hasNativeFeedback('TouchableOpacity', ' activeOpacity={1} '), false, '显式关掉才算关')
  assert.equal(hasNativeFeedback('TouchableHighlight', ' '), true)
  assert.equal(hasNativeFeedback('TouchableWithoutFeedback', ' '), false, '类名自述无反馈')
  assert.equal(hasNativeFeedback('Pressable', ' '), false, 'Pressable 没有默认按压态')
  // 反向对照(误报回归哨兵):判据被改回"只数 onPressIn"时,HEAD 面会从三位数涨回四位数。
  // 这里刻意用**上界**而不是等值 —— 存量在减,钉死一个数就成了一枚会自己腐烂的钉。
  const out = run([]).stdout
  const m = /无按压反馈: (\d+) 处/.exec(out)
  assert.ok(m, `结论行读不到反馈计数:${out.slice(0, 200)}`)
  assert.ok(
    Number(m[1]) < 700,
    `无按压反馈读到 ${m[1]} 处 ⇒ 原语默认态那一条判据大概是被人删了(957 枚 TouchableOpacity 会被误报)`,
  )
})

test('⑮ 遮罩不当"缺反馈":半透黑底按下去就是关层,要求变暗等于制造全屏闪', () => {
  const { isScrim, isTranslucentBlack, scrimByStyle } = __test__
  assert.equal(isScrim(' className="flex-1 bg-black/20" activeOpacity={1}'), true)
  assert.equal(isScrim(" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}"), true)
  assert.equal(isScrim(" style={{ backgroundColor: '#000000' }}"), false, '不透明黑不是遮罩')
  assert.equal(isTranslucentBlack('#000000'), false)
  assert.equal(isTranslucentBlack('#00000080'), true)
  const table = __test__.styleTable(
    "const styles = StyleSheet.create({ scrim: { backgroundColor: 'rgba(0,0,0,0.5)' }, card: { backgroundColor: '#ffffff' } })",
  )
  assert.equal(scrimByStyle(' style={styles.scrim} ', table), true)
  assert.equal(scrimByStyle(' style={styles.card} ', table), false, '白底卡片不得被当成遮罩(否则遮罩成了消红通道)')
})

test('⑭ 注册表文案不钉移动量:runner 的 label 里不得写死存量数字', () => {
  // 为什么反向钉:上一版这里比的是"label 写的处数 == 门现读的处数",而存量是一条一直在减的
  // 移动量 —— 任何人修好一枚 H2,这条锁就把一次**进步**判成文案漂移(§0.2 同型:会自己腐烂的钉
  // 只会逼人跳门)。现值由门自己在结论行打印,文案只写口径。
  const label = maskComments(RUNNER)
  const at = label.indexOf("script: 'check-rn-interaction-hygiene.mjs'")
  assert.ok(at > 0)
  const block = label.slice(Math.max(0, at - 900), at + 1400)
  assert.match(block, /存量只报数/, 'label 应写口径,不写数字')
  assert.doesNotMatch(
    block,
    /\d+ 处存量|棘轮\(\d+ 处/,
    'label 里写了死数字 ⇒ 下一次清理就会把进步判成文案漂移(别把移动量钉成健康期望)',
  )
})
test('⑯ H3 已升绝对零容忍:资格锁 + 判序必须引用它 + 区间配不平仍落盲区', () => {
  const { scanKeyboard, elementRange } = __test__
  // 未闭合的区间不可信 ⇒ 必须读成盲区,不能把"后面全部文件"当成子树(上一版就是这么误报 HomeScreen 的)
  assert.equal(scanKeyboard('<ScrollView><View><TextInput /></View>').length, 0, '闭标签没配平却判了违规')
  assert.equal(scanKeyboard('<ScrollView>{children}</ScrollView>').length, 1)
  const r = elementRange('<ScrollView a={1}>{x}</ScrollView>', 0, 'ScrollView')
  assert.equal(r.closed, true)
  assert.equal(elementRange('<ScrollView a={1}>{x}', 0, 'ScrollView').closed, false)
  // 资格锁(§0.2:升 blocking 的前置 = 存量归零)。取材面 = HEAD blob(§0.4 全量档口径)。
  // 上一版取工作树有它的时期理由:那 34 处存量正躺在 HEAD 上,拿 HEAD 当资格等于永远不许升档。
  // 存量清零后这条理由消失,而工作树在共享仓里常年滞后 HEAD(旁路落地只推 HEAD/索引,不写盘)
  // ⇒ 拿它当资格锁就是让"别人没回写的那份盘"把我门自检钉成恒红(§12e 同型)。
  // "存量归没有归零"这件事本来就应在被审面上判,在这一维上工作树不是权威面。
  const head = run([]).stdout
  const m = /keyboardShouldPersistTaps: (\d+) 处/.exec(head)
  assert.ok(m, `结论行读不到 H3 计数:${head.slice(0, 200)}`)
  assert.equal(
    Number(m[1]),
    0,
    'H3 已是绝对零容忍 ⇒ 候选回潮先在这里响,而不是堵住所有触碰这些文件的 pre-commit',
  )
  // 判序必须真的引用这一维(否则"升了档"只写在文案里 = 假账)
  assert.match(verdictBody(), /r\.h3\.length/, 'H3 升了档却不在判序里引用 ⇒ 文案与判据两份真相')
  assert.match(
    head,
    /提交链绝对零容忍[\s\S]{0,40}闭标签配不平的候选不进这一维/,
    '结论行必须自己说清 H3 的档位与盲区口径',
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

test('⑰ H4 内容文字桶已升绝对零:资格锁 + 提交链必须真的引用它', () => {
  const { scanFontLock } = __test__
  const r = scanFontLock(
    `<Text style={styles.a} allowFontScaling={false}>{t('x.y')}</Text><Text style={styles.b} allowFontScaling={false}>{'×'}</Text>`,
  )
  assert.equal(r.content.length, 1, '内容文字必须进内容桶')
  assert.equal(r.glyph.length, 1, '图标字形必须留在字形桶(判它即逼人跳门)')
  const scaled = scanFontLock(
    '<Text style={[styles.a, scaleText(styles.a)]} allowFontScaling={false}>{t("x.y")}</Text>',
  )
  assert.equal(scaled.content.length, 0, '已接 scaleText 的格子不得再算缺陷')
  assert.equal(scaled.scaled.length, 1)
  // 资格锁:工作树(=本枚要落的内容)内容桶必须为 0,否则这一维就是恒红门
  const out = run(['--worktree']).stdout
  const m = /关系统字号缩放: (\d+) 处内容文字/.exec(out)
  assert.ok(m, `读不到 H4 内容桶计数:${out.slice(0, 200)}`)
  assert.equal(Number(m[1]), 0, 'H4 已是绝对零容忍 ⇒ 内容桶回潮先在这里响,而不是堵住所有人的 pre-commit')
  assert.match(verdictBody(), /r\.h4\.content/, 'H4 升了档却不在判序里引用 ⇒ 文案与判据两份真相')
})

test('⑱ 判序住在可测的地方:主流程只许委托,方向锁不许被删', () => {
  // 委托锁:staged 段不得再自己写档位判断(§0.6 单一真相源 + NaN 事故的直接防线)
  const at = GATE_SRC.indexOf('// staged 档')
  assert.ok(at > 0, '读不到提交链那段 ⇒ 结构变了,这条锁要跟着重写而不是删')
  const staged = GATE_SRC.slice(at, GATE_SRC.indexOf('if (added.length)', at))
  assert.ok(staged.length > 200, '提交链那段短到读不出内容 ⇒ 尺子失效')
  assert.match(
    staged,
    /for \(const msg of stagedVerdict\(/,
    '主流程没在委托判序 ⇒ 有人把档位判断内联回去了,自检就走不到它(NaN 那一型)',
  )
  assert.doesNotMatch(
    staged,
    /if \(r\.h[1234]/,
    '提交链段里出现了内联的档位判断 ⇒ 与 stagedVerdict 两份真相,必有一份会漂',
  )
  // 方向锁必须在门内自检里(删断言比改判据更常见,所以钉文字而不是只钉"自检通过")
  for (const key of ['H2 持平即红', 'H2 减少必须放行', 'H2 新增必须拦', '判序失效:四维全空'])
    assert.ok(GATE_SRC.includes(key), `方向锁「${key}」不在了 ⇒ 这一维的方向又成了没人证的断言`)
  const out = run(['--self-test'])
  assert.equal(out.status, 0, out.stderr.slice(0, 400))
  const n = Number(/自检 (\d+) 组通过/.exec(out.stdout)?.[1] ?? 0)
  assert.ok(n >= 50, `自检只剩 ${n} 组(本票落地时 ≥50)⇒ 有断言被删掉了,不是判据变好了`)
})
