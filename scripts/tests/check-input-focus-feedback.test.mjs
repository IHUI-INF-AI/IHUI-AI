// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-input-focus-feedback.mjs` 的 §22c 镜像测试(台账 G-1113923,2026-10-08 立)。
 *
 * 只 import 门自己导出的 `__test__` 判据,**不在本文件重写任何一份解析/归属规则** ——
 * 镜像若自己再抄一遍尺子,源门漂移时测试照样绿(§22c 的原始动因:镜像只复读就是复读机)。
 * 本文件负责的是门体自检覆盖不到的那一侧:①装车成套性(头注声明 vs runner 现读,双向),
 * ②取材面形状锁(必须经 face-reader,不散写 git show / 磁盘直读),③遮罩单一实现形状锁,
 * ④空扫/两面旗同给这两支"失效必须响"的端到端证据(构造临时仓,不靠真仓状态)。
 *
 * 跑法:`node --test scripts/tests/check-input-focus-feedback.test.mjs`
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-input-focus-feedback.mjs'
// 注册条目形状由守门 89 那一份解析器裁定(§22c:同料两份必漂),本文件不再手写 `script: '<门名>'`。
import { __test__ as wiring } from '../check-gate-wiring.mjs'
import { catBatch, gitBinary } from '../lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC_NAME = 'check-input-focus-feedback.mjs'
const GATE = join(ROOT, 'scripts', SRC_NAME)
const RUNNER_REL = 'scripts/guardian-runner.mjs'

/**
 * 默认跑**真仓那一份门体**;T9 要把 `scripts/` 里那份副本传进来 —— 门体的 ROOT 是按自身文件位置
 * 推的(D57 卫生项:不得按 cwd),所以只换 cwd 不换脚本会照样扫真仓,那条"空扫判死"就成了一条假锁。
 */
const runGate = (args, cwd = ROOT, timeout = 300_000, script = GATE) => {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    // 派生层三通道必须显式给(BUSY 病窗只杀"继承 stdin 的子进程",裸 spawn 会间歇失败)
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

/** 被审内容一律走层的 catBatch;面取不到时返回 null 交调用方决定退档,不静默当"没有"。 */
function headBlob(rel) {
  try {
    return catBatch(ROOT, [`HEAD:${rel}`], { maxBuffer: 1 << 26 }).get(`HEAD:${rel}`) ?? null
  } catch {
    return null
  }
}

const RN_FILE = 'packages/app/src/features/probe/Probe.tsx'
const MP_FILE = 'apps/miniapp-taro/src/components/Probe.tsx'
const WB_FILE = 'apps/web/src/features/probe/page.tsx'

// ─── T1 装车成套性:头注的接线声明必须与 runner 现读**双向**一致 ───
test('T1 未注册时头注不得自称已接线(注册了也不得自称未接入)', () => {
  let face = 'HEAD blob'
  let gateSrc = headBlob(`scripts/${SRC_NAME}`)
  const runner = headBlob(RUNNER_REL)
  if (gateSrc === null) {
    // 本门与镜像测试同批落地:提交前 HEAD 面必然取不到门体。此时**两份输入一起退到工作树面**
    // (清单与内容同面同轮的纪律不因"其中一份还没提交"而混面),并在断言消息里写明用的哪一面。
    face = '工作树(门尚未提交到 HEAD)'
    gateSrc = readFileSync(GATE, 'utf8')
  }
  assert.ok(gateSrc, '门源码两种面都取不到 ⇒ 本用例无从判定,必须红而不是静默通过')
  const { byScript } = wiring.parseRunnerRegistrations(runner || '')
  const registered = !!runner && (byScript.get(SRC_NAME) || []).length > 0

  const claim = gateSrc.match(/【接线状态:([^】]+)】/)
  assert.ok(claim, '头注缺【接线状态:…】标记 ⇒ 接线声明无处可读(措辞不进断言,改写说明文字不会假红)')
  assert.equal(
    claim[1] === '已接入',
    registered,
    `面=${face} 头注声明「接线状态:${claim[1]}」与 runner 现读不一致(registered=${registered})`,
  )
  if (registered) return
  // 未注册时另一个方向也要有牙:头注里不得留下"已接提交链 / 已进 guardian-runner"这一类既成事实措辞。
  assert.doesNotMatch(
    gateSrc,
    /已接\s*pre-commit|已接入提交链|已登记进\s*guardian-runner/,
    '未注册却留下既成事实措辞 = 下一个读头注的人会把没接线当已接线',
  )
})

// ─── T2 取材面形状锁:被审内容只能经 face-reader,不得散写第二份取材 ───
test('T2 取材面形状锁:catBatch/selectFace 在位,散写 git show 与磁盘直读不得出现', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '必须引共用取材层')
  assert.match(src, /catBatch\(/, '没有真调用层的读取入口 ⇒ 门 118 判半接线')
  assert.match(src, /selectFace\(/, '判定面选择必须由层统一(少一个面=悄悄多一面)')
  assert.match(src, /readWorktreeFile\(/, '--worktree 逃生舱也必须走层')
  assert.doesNotMatch(src, /['"]show['"]\s*,/, '散写 git show 取被审内容 = 第二份取材实现')
  assert.doesNotMatch(src, /readFileSync\(\s*join\(\s*ROOT/, '磁盘直读被审内容 = 恒红/假绿来回跳')
  // 索引面与 HEAD 面必须是两个不同的规格串;写死一个 = --staged 与全量同面(假绿的一成因)。
  assert.match(src, /face === 'staged' \? '' : 'HEAD'/, "索引 blob 的规格必须是 ':<path>'")
})

// ─── T3 遮罩单一实现形状锁 ───
test('T3 遮罩只有一份:两面出自共用层,门内不得自带分词器', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(
    src,
    /from '\.\/lib\/(code-mask|radius-roles)\.mjs'/,
    '遮罩/分词必须引共用层(全仓一份,见 lib/code-mask.mjs 头注)',
  )
  assert.match(src, /maskFaces\(/, '没有真调用共用的两面出口 = 半接线')
  assert.doesNotMatch(src, /function\s+(scanSpans|maskComments|maskCommentsAndStrings|maskedSpans)\b/, '门内不得再写一台分词器')
  assert.doesNotMatch(src, /from 'node:fs'/, '被审内容不走磁盘 ⇒ 门体不该 import fs')
})

// ─── T4 三端各有牙:摘掉聚焦反馈必须点名,接回必须放过(与门内自检成对)───
test('T4 三端各自的书写语言都判得动(少一端=给那一端开空白支票)', () => {
  const fixtures = {
    miniapp: {
      rel: MP_FILE,
      red: '<Input className="w-full border border-border" placeholder="手机号" />',
      green: '<Input className="w-full border border-border" {...ff.spread} style={ff.focusStyle} />',
    },
    web: {
      rel: WB_FILE,
      red: '<input className="h-9 rounded-sm border border-border px-3" />',
      green: '<input className="h-9 rounded-sm border border-border px-3 focus-visible:border-primary" />',
    },
    rn: {
      rel: RN_FILE,
      red: 'const styles = createStyles({\n  input: { borderWidth: 1, borderColor: "#DDDDDD" },\n})\nexport function P() {\n  return <TextInput style={styles.input} />\n}',
      green:
        'const styles = createStyles({\n  input: { borderWidth: 1, borderColor: "#DDDDDD" },\n  inputFocused: { borderColor: "#000000" },\n})\nexport function P() {\n  return <TextInput style={[styles.input, focused ? styles.inputFocused : null]} onFocus={onFocus} />\n}',
    },
  }
  for (const [end, f] of Object.entries(fixtures)) {
    const r = gate.judgeText(f.rel, f.red)
    assert.equal(r.hits.length, 1, `${end} 端"有描边无聚焦"必须点名,实得 ${JSON.stringify(r.hits)}`)
    const g = gate.judgeText(f.rel, f.green)
    assert.equal(g.hits.length, 0, `${end} 端接回聚焦反馈后必须放过,实得 ${JSON.stringify(g.hits)}`)
    assert.equal(g.passed.length, 1, `${end} 端的放过必须计数(不进三态就无从对账)`)
  }
})

// ─── T5 证据窗:十余行外兄弟容器的描边不得算给本元素(历史假阳的反向锁)───
test('T5 证据窗=该元素自己的属性区(上一轮探针栽过的那一格)', () => {
  const far = Array.from({ length: 14 }, (_, i) => `    <Text key={${i}}>l${i}</Text>`).join('\n')
  const src = `<View className="border-t border-border">\n${far}\n  <Input\n    className="bg-white"\n    placeholder="模型名称"\n  />\n</View>`
  const r = gate.judgeText(MP_FILE, src)
  assert.equal(r.hits.length, 0, `兄弟容器的 border-t 不得归属本输入框:${JSON.stringify(r.hits)}`)
  const moved = src.replace('className="bg-white"', 'className="border border-border"')
  const r2 = gate.judgeText(MP_FILE, moved)
  assert.equal(r2.hits.length, 1, '把描边移进自己的属性区就必须进入射程(证明 T5 的绿不是判据失明)')
  // 行号按夹具自己算,不写死字面量 —— 写死的行号会随夹具增删而漂,漂了的那一位是"看起来在断言"的空锁。
  const atLine = moved.split('\n').findIndex((l) => l.includes('<Input')) + 1
  assert.equal(r2.hits[0].line, atLine, '命中行号必须落在开标签自己那一行')
})

// ─── T6 遮罩方向:聚焦/描边字样只写在注释里都不算数 ───
test('T6 注释里的聚焦措辞不得当作反馈(判据不能读自己的说明)', () => {
  const withComment =
    '<Input\n  className="border border-border"\n  /* focus:border-primary 早已接好,放心 */\n  placeholder="验证码"\n/>'
  const r = gate.judgeText(MP_FILE, withComment)
  assert.equal(r.hits.length, 1, '注释不算聚焦反馈 ⇒ 必须仍点名')
  const real = withComment.replace('/* focus:border-primary 早已接好,放心 */', 'onFocus={onFocus}')
  assert.equal(gate.judgeText(MP_FILE, real).hits.length, 0, '同一枚换成真 props 必须放过(成对)')
  const borderInComment =
    '<View>\n  {/* 这里以前写 className="border border-border",后来改成无边框 */}\n  <Input className="bg-muted" onFocus={onFocus} />\n</View>'
  assert.equal(gate.judgeText(MP_FILE, borderInComment).hits.length, 0, '注释里的描边字样不得算描边证据')
})

// ─── T7 三态不并桶 + --strict 的 exit 2 必须与未判定数自洽 ───
test('T7 --strict 且未判定>0 ⇒ exit 2(拒绝发合格证),读数与账面自洽', () => {
  const plain = runGate(['--json'])
  assert.equal(plain.code, 0, `全量 HEAD 面存量按棘轮只报数 ⇒ 必须 0;实得 ${plain.code}\n${plain.out.slice(0, 400)}`)
  const r = JSON.parse(plain.out)
  assert.ok(r.scannedFiles > 500, `扫描面必须覆盖三端(现读 ${r.scannedFiles} 文件)`)
  const strict = runGate(['--strict', '--json'])
  assert.equal(
    strict.code,
    r.undetermined.length > 0 ? 2 : 0,
    `未判定 ${r.undetermined.length} 处 ⇒ --strict 必须 exit 2;实得 ${strict.code}`,
  )
  assert.equal(r.exit, r.unreadable.length || r.emptyScan ? 2 : r.red.length ? 1 : 0, '退出码必须由三态推导,不得另算一遍')
})

// ─── T8 两面旗同给 = 自相矛盾 ⇒ 判死 ───
test('T8 --staged 与 --worktree 同给 ⇒ exit 2 并点名原因', () => {
  const { code, out } = runGate(['--staged', '--worktree'])
  assert.equal(code, 2, `两面旗互斥必须判死,实得 ${code}`)
  assert.match(out, /不得同用|互斥/)
})

// ─── T9 空扫判死:临时仓里没有任何候选文件 ⇒ 不得读成"没有违规" ───
test('T9 候选枚举为空 ⇒ 判死而不是绿(临时构造面,不靠真仓状态)', async () => {
  const { mkScratch, rmScratch } = await import('../lib/scratch-dir.mjs')
  const scratch = mkScratch('iff-')
  try {
    mkdirSync(join(scratch, 'scripts', 'lib'), { recursive: true })
    copyFileSync(GATE, join(scratch, 'scripts', SRC_NAME))
    // 依赖图整层搬过去,不手写"我猜它需要哪几个":`gitdir.mjs` 还 import 了
    // `../seal-c-root-stray.mjs`,清单少一项的表现不是报错而是门在临时仓里加载失败 ⇒ 假红。
    for (const f of readdirSync(join(ROOT, 'scripts', 'lib'))) {
      if (!f.endsWith('.mjs')) continue
      copyFileSync(join(ROOT, 'scripts', 'lib', f), join(scratch, 'scripts', 'lib', f))
    }
    copyFileSync(join(ROOT, 'scripts', 'seal-c-root-stray.mjs'), join(scratch, 'scripts', 'seal-c-root-stray.mjs'))
    const g = (args) =>
      spawnSync(gitBinary(), ['-c', 'safe.directory=*', '-C', scratch, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    let inited = true
    try {
      g(['init', '-q'])
      g(['config', 'user.name', 'mirror'])
      g(['config', 'user.email', 'mirror@example.invalid'])
      writeFileSync(join(scratch, 'README.md'), '# 与本判据无关的占位\n', 'utf8')
      g(['add', '-A'])
      g(['commit', '-qm', 'scratch base'])
    } catch {
      inited = false
    }
    assert.ok(inited, '夹具应能建起临时仓(建不起也不得因此判绿 —— 下面仍要求 exit 2)')
    const { code, out } = runGate([], scratch, 120_000, join(scratch, 'scripts', SRC_NAME))
    assert.equal(code, 2, `head 面枚举到 0 个候选文件必须判死,实得 ${code}\n${out}`)
    assert.match(out, /无法判定|取不到|0 个/)
  } finally {
    rmScratch(scratch)
  }
})

// ─── T10 头注纪律锁:判据的三条硬规矩必须写在脸上(否则下一个改门的人会整片抹掉)───
test('T10 头注必须写明证据窗、三态、棘轮锚点与存量恒红告诫', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /证据窗|属性区/, '头注要写清"只看自己的属性区"')
  assert.match(src, /ModelConfigDialog/, '头注要留下上一轮假阳的出处,否则下一个人会重新造一遍')
  assert.match(src, /未判定/, '三态分桶必须成文')
  assert.match(src, /恒红门/, '存量不为 0 就接线 = 恒红门,这条告诫不得丢')
  assert.match(src, /HEAD blob/, '取材面必须写在脸上(--staged/--worktree 同理)')
})

// ─── T11 跨文件一跳的接线锁:本次面与 HEAD 锚点面必须用同一把尺子 ───
test('T11 reclassifyHits 必须同时接在本次面与锚点面(锚点退回旧写法即红)', () => {
  const src = readFileSync(GATE, 'utf8')
  const calls = src.match(/reclassifyHits\(/g) || []
  assert.ok(
    calls.length >= 2,
    `reclassifyHits 至少要有两处调用(本次面 + HEAD 锚点面),实得 ${calls.length} —— 只判本次面会把"尺子变准"读成"仓库新增命中"`,
  )
  assert.ok(
    /headCounts\.set\(h\.file/.test(src),
    'HEAD 锚点必须由**重分类之后**的 hits 逐文件计数;留着 judgeText(...).hits.length 那支就是两把尺子',
  )
})

// ─── T12 声明体切分:参数解构形态必须取到函数体(本门第一版在这里失明) ───
test('T12 componentBody 跳过参数区取函数体,bodyProvidesFocus 正反各一条', () => {
  const withFocus =
    'function Input({\n  className,\n  style,\n}: Props) {\n  return <TextInput style={[style, focused ? { borderColor: primaryColor } : null]} className={className} />\n}\n'
  const noFocus =
    'function Input({\n  className,\n  style,\n}: Props) {\n  return <TextInput style={[style, null]} className={className} />\n}\n'
  const b1 = gate.componentBody(withFocus, 'Input')
  assert.ok(b1, '切不出函数体 ⇒ 后面一律落未判定,这里必须能切出来')
  assert.ok(b1.includes('focused'), '函数体必须含返回区(旧写法取"名字后第一个 {"会截到参数对象)')
  assert.equal(gate.bodyProvidesFocus(b1), 'borderColor', '件内同时有聚焦条件与可见描边 ⇒ 给出证据')
  const b2 = gate.componentBody(noFocus, 'Input')
  assert.equal(gate.bodyProvidesFocus(b2), null, '只有描边没有聚焦条件 ⇒ 不构成证据(不许"看不见就当放过")')
})

// ─── T13 真仓端到端:这一跳救回假阳,但没有把整门读瞎 ───
test('T13 AgentRuntimePanel 的 Input 不再算命中,而 web 小写标签站点仍必须在命中面(阳性对照)', () => {
  const { code, out } = runGate(['--json'], ROOT, 240_000)
  assert.ok(code === 0 || code === 1, `门应给出结论,实得 exit ${code}\n${String(out).slice(-400)}`)
  const j = JSON.parse(String(out).slice(String(out).indexOf('{')))
  const sites = j.sites || []
  assert.ok(
    !sites.some((s) => s.file === 'apps/mobile-rn/src/components/AgentRuntimePanel.tsx' && s.line === 142),
    '该站点的 <Input> 由 @ihui/ui-native 件内提供聚焦,仍算命中就是假阳',
  )
  assert.ok(
    sites.some((s) => s.end === 'web' && !/^[A-Z]/.test(s.tag)),
    '小写宿主标签(input/textarea/select)不该被这一跳救掉;一个都没有 ⇒ 这一跳把整门读瞎了',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
