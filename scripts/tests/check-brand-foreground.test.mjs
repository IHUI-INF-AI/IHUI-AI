// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 83(check-brand-foreground.mjs)的 §22c 镜像测试。
//
// 立项起因(2026-09-24):全仓"品牌实底 + 其上文字"按 AGENTS §4 从 brand.DEFAULT 迁到明暗同值的
// brand.cta 档后,R1_BG 已同步扩认 `DEFAULT|cta`,**R3 却漏扩** —— 棘轮从 235 "掉"到 87,不是债
// 变少,是那 235+ 处实底整片搬进门的盲区。本仓反复留案的教训:**判据必须覆盖门自己产出的形态**
// (门让你怎么写,门就得能看见怎么写;同守门 77 B6 括号形态盲区)。
// 本文件的职责:① 直接 import `__test__`(§22c:禁止在测试里复制判据实现)对 cta 形态做
// 红/绿成对夹具;② 变异对照 —— 旧版"只认 DEFAULT"的正则必须匹配不上 cta 夹具,证明这些断言
// 真的挂在扩面上,谁改回去当场红;③ **装车证明** —— guardian-runner 里确有本门注册块
// (id 反查、不硬写编号,本仓同日撞过号)+ blocking + skipEnv,且该 id 全 runner 唯一;
// ④ 真仓端到端:全量审计 exit 0 且 R3 存量回升到盲区修复前的合理量级(≥200,盲区态实测 87)。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gate } from '../check-brand-foreground.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')

test('__test__ 出口齐备(§22c 锚点:判据函数 + 扩面所系的正则本体 + R5 词法与取材层,缺一不可)', () => {
  for (const fn of [
    'extractStyleChunks',
    'findR1Violations',
    'countLightContainers',
    'countCtaFills',
    'computeBraceDeltas',
    'extractNamedStyleChunks',
    'isSiblingStylePair',
    'findR4Violations',
    'countWebClassPairs',
    'hasClassToken',
    'isR5Scope',
    'r5Prefilter',
    'findR7Violations',
    'collectR7StyleKeys',
    'r7IsMismatch',
    'isConstantWhite',
    'styleKeyRefsIn',
    'readJsxAttrValues',
    'parseTagHead',
    'maskNestedElements',
  ]) {
    assert.equal(typeof gate[fn], 'function', `缺少导出函数 ${fn}`)
  }
  for (const rx of [
    'R1_BG',
    'R1_BAD_FG',
    'R3_BRAND_FILL',
    'R3_FILL_CTA',
    'BRAND_FG',
    'BRAND_FG_CTA',
  ]) {
    assert.ok(gate[rx] instanceof RegExp, `缺少导出正则 ${rx}(镜像测试要靠它做变异对照)`)
  }
  // R7 的出口:基线键 + 三张判据表。少任意一张,矩阵就会单方面变宽而无人察觉。
  assert.equal(typeof gate.BASELINE_R7_KEY, 'string')
  assert.equal(
    gate.BASELINE_R7_KEY,
    'nestMismatchCounts',
    'R7 必须用自己的新键,不得复用 counts/ctaCounts/r4Counts/webClassPairCounts',
  )
  for (const k of ['counts', 'ctaCounts', 'r4Counts', gate.BASELINE_R5_KEY]) {
    assert.notEqual(
      gate.BASELINE_R7_KEY,
      k,
      `R7 复用了 ${k} ⇒ 一次 --update-baseline 会把另一条判据的存量发给 R7`,
    )
  }
  assert.ok(
    gate.R7_FILL_TIERS.has('brand.cta') && gate.R7_FILL_TIERS.has('brand.DEFAULT'),
    'R7 两档品牌底都要在射程内(只认 DEFAULT = 重演 cta 盲区)',
  )
  assert.ok(
    gate.R7_BAD_ON_CTA.has('surface.light'),
    'R7:cta × surface.light 必须在错配表里(深色 #262626 压 #4A7A96 = 3.25:1)',
  )
  assert.ok(
    !gate.R7_BAD_ON_DEFAULT.has('surface.light'),
    'R7:DEFAULT × surface.light 两态都可见,列入即满天假阳',
  )
  assert.deepEqual(
    gate.R7_STYLE_PROPS,
    ['style', 'contentContainerStyle'],
    'R7 只收这两个 style prop(放宽必造假阳)',
  )
  // R5 的常量出口(键名/类名/范围被改时,下面的对照断言才有意义)
  assert.equal(typeof gate.BASELINE_R5_KEY, 'string')
  assert.equal(gate.R5_BG_CLASS, 'bg-primary')
  assert.equal(gate.R5_FG_CLASS, 'text-primary-foreground')
  // 范围三端缺一不可:web / ui-react 是类名面原产地,miniapp-taro 于 2026-09-24 纳入
  // (它同样写 Tailwind 类名,此前 37 处退役配对既不在迁移面也不在判据面)。
  // 缩回范围不会让任何门变红,所以必须由本断言钉住。
  assert.deepEqual(gate.R5_DIRS, ['apps/web', 'packages/ui-react', 'apps/miniapp-taro'])
  assert.ok(gate.R5_DIRS.includes('apps/miniapp-taro'), 'R5 范围不得悄悄丢掉小程序端')
})

// ══ 缺陷 2 的五条必补夹具(成对:坏例子必红 + 好例子必绿)══

test('夹具 1:cta 实底 + 同块 surface.light → R1 必红(深色档案 #262626 压 #4A7A96 仅 3.25:1)', () => {
  const bad = [
    '  btn: {',
    '    backgroundColor: tokens.brand.cta,',
    '    color: tokens.surface.light,',
    '  },',
  ]
  assert.equal(
    gate.findR1Violations(bad).length,
    1,
    'cta 底 × surface.light 是跨档错配,R1 必须判红',
  )
  const badTk = [
    '  btn: {',
    '    backgroundColor: tk.brand.cta,',
    '    color: tk.text.primary,',
    '  },',
  ]
  assert.equal(
    gate.findR1Violations(badTk).length,
    1,
    'tk. 前缀 + text.primary 前景同样必红(共享包形态)',
  )
})

test('夹具 2:cta 实底 + 同块 ctaForeground → R1 必绿(§4 成对即合规,唯一正解)', () => {
  const good = [
    '  btn: {',
    '    backgroundColor: tokens.brand.cta,',
    '    color: tokens.brand.ctaForeground,',
    '  },',
  ]
  assert.equal(
    gate.findR1Violations(good).length,
    0,
    '按 §4 写的正确主 CTA 若判红 = 逼人 --no-verify',
  )
  const goodTk = [
    '  btn: {',
    '    backgroundColor: tk.brand.cta,',
    '    color: tk.brand.ctaForeground,',
    '  },',
  ]
  assert.equal(gate.findR1Violations(goodTk).length, 0, 'tk. 前缀成对同样必绿')
})

test('夹具 3:兄弟键 retryBtn(cta 底)× retryText(surface.light 字)→ R4 必命中', () => {
  const pairs = gate.findR4Violations([
    '  retryBtn: {',
    '    backgroundColor: tk.brand.cta,',
    '  },',
    '  retryText: {',
    '    color: tk.surface.light,',
    '  },',
  ])
  assert.deepEqual(pairs, ['retryBtn×retryText'], 'R4 与 R1 共用 R1_BG,cta 底拆到兄弟键时不得沉默')
  // 反向:兄弟键配 ctaForeground → R4 不命中(前景正配)
  assert.equal(
    gate.findR4Violations([
      '  retryBtn: {',
      '    backgroundColor: tk.brand.cta,',
      '  },',
      '  retryText: {',
      '    color: tk.brand.ctaForeground,',
      '  },',
    ]).length,
    0,
    '兄弟键成对(ctaForeground)R4 必绿',
  )
})

test('夹具 4:countCtaFills 必须计 cta 填充 —— 扩面前这一组实测返回 0(盲区),修后必 >0', () => {
  assert.equal(
    gate.countCtaFills(['    backgroundColor: tk.brand.cta,']),
    1,
    'tk.brand.cta 背景必计 1(盲区修复的直接证据)',
  )
  assert.equal(
    gate.countCtaFills(['    borderColor: tokens.brand.cta,']),
    1,
    'tokens.brand.cta 描边必计 1',
  )
  assert.equal(
    gate.countCtaFills(['    backgroundColor: tokens.brand.DEFAULT,']),
    1,
    '扩面不得缩旧面:DEFAULT 仍计',
  )
  assert.equal(
    gate.countCtaFills(['    backgroundColor: tk.brand.ctaForegroundish,']),
    0,
    'ctaForeground/前缀变体不得被当成填充误计',
  )
  // 按档配对:cta ↔ ctaForeground(同块 / 兄弟键)豁免
  assert.equal(
    gate.countCtaFills([
      '  btn: {',
      '    backgroundColor: tk.brand.cta,',
      '    color: tk.brand.ctaForeground,',
      '  },',
    ]),
    0,
    'R3 同块成对(cta+ctaForeground)不计 —— 这是 §4 当前唯一正确主 CTA 写法',
  )
  assert.equal(
    gate.countCtaFills([
      '  btn: {',
      '    backgroundColor: tk.brand.cta,',
      '  },',
      '  btnText: {',
      '    color: tk.brand.ctaForeground,',
      '  },',
    ]),
    0,
    'R3 兄弟键成对(cta↔ctaForeground)不计(与 R4 同一套命名配对)',
  )
  // 跨档配对不放行:DEFAULT 底 × ctaForeground 在深色档案下是白压白,恰是要拦的债
  assert.equal(
    gate.countCtaFills([
      '  btn: {',
      '    backgroundColor: tk.brand.DEFAULT,',
      '    color: tk.brand.ctaForeground,',
      '  },',
    ]),
    1,
    '跨档配对(DEFAULT 底 × ctaForeground)必须仍计 1,不得当成已配对放行',
  )
  assert.equal(
    gate.countCtaFills([
      '  btn: {',
      '    backgroundColor: tk.brand.cta,',
      '    color: tk.brand.foreground,',
      '  },',
    ]),
    1,
    '跨档配对(cta 底 × brand.foreground)同样不豁免',
  )
  // 无配对的实底卡片照旧计(R3 原本真正要拦的东西)
  assert.equal(
    gate.countCtaFills(['  card: {', '    backgroundColor: tk.brand.cta,', '  },']),
    1,
    '无任何配对前景的 cta 实底卡片必计',
  )
})

test('夹具 5(变异对照):旧判据(只认 DEFAULT)匹配不上 cta 夹具 ⇒ 上面各条的红/绿真挂在扩面上', () => {
  // 谁把 R1_BG / R3_BRAND_FILL 改回只认 DEFAULT,这两条正则源串断言先红;
  // 而"旧版正则对 cta 行零命中"证明夹具并非碰巧过 —— 缺陷 2 的"假绿"由这一对钉死。
  assert.match(
    gate.R1_BG.source,
    /DEFAULT\|cta/,
    'R1_BG 必须同时认 DEFAULT|cta(与 AGENTS §4 改档同步)',
  )
  assert.match(
    gate.R3_BRAND_FILL.source,
    /DEFAULT\|cta/,
    'R3_BRAND_FILL 必须与 R1_BG 同形扩面(一边判红一边看不见即本票起因)',
  )
  const legacyR1BG = /backgroundColor:\s*(?:tokens|tk)\.brand\.DEFAULT\b/
  const legacyR3Fill = /(?:backgroundColor|borderColor):\s*(?:tokens|tk)\.brand\.DEFAULT\b/
  assert.equal(
    legacyR1BG.test('    backgroundColor: tokens.brand.cta,'),
    false,
    '对照前提:旧 R1_BG 对 cta 行不匹配',
  )
  assert.equal(
    legacyR3Fill.test('    backgroundColor: tk.brand.cta,'),
    false,
    '对照前提:旧 R3 判据对 cta 行不匹配',
  )
  assert.equal(
    gate.R1_BG.test('    backgroundColor: tokens.brand.cta,'),
    true,
    '现 R1_BG 对 cta 行必匹配',
  )
  assert.equal(
    gate.R3_BRAND_FILL.test('    backgroundColor: tk.brand.cta,'),
    true,
    '现 R3_BRAND_FILL 对 cta 行必匹配',
  )
  // \b 防误伤:ctaForeground 是前景档,不得被 `brand\.cta\b` 当成填充命中
  assert.equal(gate.R3_BRAND_FILL.test('    color: tk.brand.ctaForeground,'), false)
})

// ══ R5(2026-09-24 立):web / ui-react 类名面退役配对 ══
//
// R1..R4 只看 RN style 对象,对 Tailwind 类名形态零覆盖 —— 退役档 `bg-primary` +
// `text-primary-foreground` 因此能在 web 侧无门看着地增长。本组断言的职责有三层:
//  ① 词法边界(N 组)—— 同一行两个 token 只是"够格",变体/透明档/前景档都不算实底;
//  ② **真内容阳性对照** —— 基线当日被并行会话清空(`4e0b24689a` 把 22 处迁完了),
//     于是"存量 0 处"既可能是"债清了"也可能是"门瞎了"。故必须拿真仓 HEAD 的
//     button.tsx 原文喂进判据(现值 0),再把 cta 档改名回退役档(必 >0):
//     同一条读文件+判据链,只有内容不同 ⇒ 这一对钉死"0 是判出来的,不是看不见"。
//  ③ **预筛完备性** —— 全量模式用 git grep 预筛(3453 文件逐个 git show 慢到不能用),
//     预筛静默丢文件 = 棘轮恒绿。断言按"每一条应计行所在文件必须在预筛结果里"做**完整**
//     证明(计数要求同行含 fg 字面量 ⇒ 该文件必在 fg 清单内),而非抽样。
test('R5 词法边界:实底/透明档/前景档/变体前缀/注释/豁免各判其所(实现在源脚本,本文件只调用)', () => {
  // 阳性:真仓退役形态(立项时 HEAD 的 22 处即是这类行)
  assert.equal(
    gate.countWebClassPairs(["  default: 'bg-primary text-primary-foreground shadow',"]),
    1,
  )
  // 反向四条:少一条判据就会把非债当债
  assert.equal(
    gate.countWebClassPairs(["  x: 'bg-primary/90 text-primary-foreground'"]),
    0,
    '透明档不是实底',
  )
  assert.equal(
    gate.countWebClassPairs(["  x: 'bg-primary-foreground text-primary-foreground'"]),
    0,
    '前景档不是底',
  )
  assert.equal(
    gate.countWebClassPairs(["  x: 'hover:bg-primary text-primary-foreground'"]),
    0,
    '变体前缀不算实底',
  )
  assert.equal(
    gate.countWebClassPairs(["  x: 'bg-cta text-cta-foreground'"]),
    0,
    '正解档绝不得计债',
  )
  // 注释与豁免出口(零容忍门必须有人工出口,否则唯一出路是 --no-verify)
  assert.equal(
    gate.countWebClassPairs(['   * - active 态:bg-primary + text-primary-foreground']),
    0,
    '整行注释不计',
  )
  assert.equal(
    gate.countWebClassPairs([
      "  x: 'bg-primary text-primary-foreground' // r5-cta-exempt: 合法浮层",
    ]),
    0,
  )
  assert.equal(
    gate.countWebClassPairs([
      '  // r5-cta-exempt: 原因',
      "  x: 'bg-primary text-primary-foreground'",
    ]),
    0,
    '上行豁免',
  )
  assert.equal(
    gate.countWebClassPairs([
      "  x: 'bg-primary text-primary-foreground'",
      "  y: 'bg-primary text-primary-foreground'",
    ]),
    2,
    '豁免不得外溢到后续行',
  )
  // 变异对照:naive includes 会把前三条误计 ⇒ 上面那三条的红真挂在词法规则上
  const naive = (l) => l.includes(gate.R5_BG_CLASS) && l.includes(gate.R5_FG_CLASS)
  for (const line of [
    "  x: 'bg-primary/90 text-primary-foreground'",
    "  x: 'bg-primary-foreground text-primary-foreground'",
  ]) {
    assert.equal(naive(line), true, '对照前提:naive 判据对此会误计')
    assert.equal(gate.countWebClassPairs([line]), 0, '词法规则必须判 0')
  }
})

test('R5 真内容阳性对照:HEAD 的 button.tsx 现值 0 处,但改名回退役档必 >0(证明"0"是判出来的)', () => {
  const rel = 'packages/ui-react/src/components/button.tsx'
  const head = execFileSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${rel}`], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    timeout: 30000,
  })
  const retired = head
    .split('\n')
    .map((l) =>
      l
        .split('bg-cta')
        .join('bg-primary')
        .split('text-cta-foreground')
        .join('text-primary-foreground'),
    )
  const current = head.split('\n')
  const nNow = gate.countWebClassPairs(current)
  const nIfRetired = gate.countWebClassPairs(retired)
  assert.equal(nNow, 0, `${rel} 在 HEAD 已迁到 cta 档(存量 0 是现状,不是判据失效)`)
  assert.ok(
    nIfRetired >= 4,
    `把 cta 档改名回退役档必须命中 ≥4 处(Button 主按钮 variant 有 6 个),实得 ${nIfRetired}`,
  )
  // 反向钉:若有人把判据改窄到看不见 className 字符串,nIfRetired 会掉到 0 ⇒ 本条当场红
  assert.ok(nIfRetired > nNow, '阳性对照必须严格大于现值,否则本门对 R5 形态是瞎的')
})

test('R5 预筛完备性:每一条应计行所在文件都必须在预筛结果里(完整证明,非抽样)', () => {
  // 完备性论证(不靠抽样):一条被计数的行**必须**含 `text-primary-foreground` 字面量,
  // 故"含该字面量的文件集"是"可被计数的文件集"的严格超集。把这个超集**逐个**读 HEAD blob
  // 算一遍,凡有债的文件都必须在预筛结果里 ⇒ 预筛丢文件必然被本条抓到。
  const fgFiles = execFileSync(
    'git',
    [
      '-c',
      'safe.directory=*',
      'grep',
      '-l',
      '-I',
      '-e',
      gate.R5_FG_CLASS,
      'HEAD',
      '--',
      ...gate.R5_DIRS,
    ],
    { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26, windowsHide: true, timeout: 60000 },
  )
    .split('\n')
    .filter(Boolean)
    .map((f) => f.replace(/^HEAD:/, ''))
    .filter((f) => gate.isR5Scope(f))
  assert.ok(
    fgFiles.length > 0,
    'R5 范围里连一处 text-primary-foreground 都找不到 ⇒ 取材面(范围/扩展名)已失效',
  )
  const pre = gate.r5Prefilter(true)
  assert.ok(
    Array.isArray(pre),
    'r5Prefilter 必须返回数组(null = 判不出来,全量模式会退回枚举;本条要的是"能判时不失")',
  )
  const preSet = new Set(pre)
  let total = 0
  for (const rel of fgFiles) {
    const txt = execFileSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${rel}`], {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      windowsHide: true,
      timeout: 30000,
    })
    const n = gate.countWebClassPairs(txt.split('\n'))
    total += n
    if (n > 0) assert.ok(preSet.has(rel), `预筛丢了有应计行的文件:${rel} ⇒ 棘轮恒绿而债在长`)
  }
  // 债的上限**取基线自身**,不写死 0 —— 2026-09-24 把 miniapp 纳入范围后,HEAD 合法存量是
  // 2 文件 / 3 处(已逐站判定的身份/排名片,§4 不覆盖装饰片)。写死 0 会逼后人改断言;
  // 绑基线则"超出基线即红"的原意完整保留,而收紧基线仍须走 --update-baseline 的显式动作。
  assert.ok(pre.length > 0, '预筛候选为 0 ⇒ 范围正则或 grep 取材面已失效(HEAD 至少有 fg∩bg 文件)')
  const baselineTotal = Object.values(
    JSON.parse(readFileSync(join(REPO, 'scripts', 'brand-foreground-baseline.json'), 'utf8'))
      .webClassPairCounts || {},
  ).reduce((a, b) => a + b, 0)
  assert.ok(
    total <= baselineTotal,
    `HEAD 现存 ${total} 条应计行 > 基线 ${baselineTotal} —— 债在长:迁移到 bg-cta / text-cta-foreground,` +
      `或按流程 --update-baseline(须人工确认),勿改本断言糊过去`,
  )
})

test('R5 基线键独立且不得与 R2/R3/R4 复用;失败文案必须点名 cta 正解', () => {
  const src = readFileSync(join(REPO, 'scripts', 'check-brand-foreground.mjs'), 'utf8')
  const base = JSON.parse(
    readFileSync(join(REPO, 'scripts', 'brand-foreground-baseline.json'), 'utf8'),
  )
  assert.equal(gate.BASELINE_R5_KEY, 'webClassPairCounts')
  for (const other of ['counts', 'ctaCounts', 'r4Counts']) {
    assert.notEqual(
      gate.BASELINE_R5_KEY,
      other,
      `R5 复用了 ${other} ⇒ 一次 --update-baseline 会把另一条判据的存量发给 R5`,
    )
  }
  assert.ok(
    Object.hasOwn(base, gate.BASELINE_R5_KEY),
    '基线必须含 webClassPairCounts 键(缺键时 ?? 0 等于零容忍,须是有意为之而非漏写)',
  )
  // --update-baseline 只重写四个计数面,必须把 webClassPairCounts 也列进 omit 清单,
  // 否则它会作为 ...notes 被旧值带走 ⇒ "实测清零但基线仍是旧数"的假绿
  assert.match(
    src,
    /webClassPairCounts:\s*_omitWebPair/,
    '--update-baseline 未把 R5 面列入 omit ⇒ 会拿旧值当新基线',
  )
  // 失败面:红点必须给出唯一正解与复现命令
  assert.match(src, /❌ R5 /, 'R5 失败行缺失')
  assert.match(
    src,
    /改为 bg-cta \/ text-cta-foreground \/ hover:bg-cta\/90/,
    'R5 失败提示必须点名 cta 正解写法',
  )
  assert.match(src, /check-brand-foreground\.mjs --staged/, 'R5 失败提示必须给单独复现命令')
})

// ══ R7(2026-09-25 立):跨 JSX 嵌套层的品牌底 / 前景错配 ══
//
// R1 只判同一个 style 块,R4 只判**名字**成兄弟的一对 —— 真仓的 `card` × `bankName`
// 两边都不沾,把两者连起来的唯一事实是渲染嵌套。R7 是本门里唯一要"解析 JSX"的判据,
// 而手搓解析器最坏的失效模式不是误报,是**解不出树→静默 0 处→看起来全绿**。
// 所以本组的重量全压在"真内容 A/B"上:同一份真仓 HEAD 文件,现状必 >0,
// 只把错配前景换成正配后必须归 0 —— 同一条读文件+建树+判据链,只有内容不同。
test('R7 真内容 A/B:HEAD 实档必命中,把前景换成正配后必归 0(证明"0 是判出来的")', () => {
  const read = (rel) =>
    execFileSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${rel}`], {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      windowsHide: true,
      timeout: 30000,
    })
  // (1) BankCardScreen:用户点名的立因文件,已改稿 ⇒ 现状 0,换回 surface.light 必 ≥2
  const bank = read('packages/app/src/features/bank-card/BankCardScreen.tsx').split('\n')
  assert.equal(gate.findR7Violations(bank).length, 0, 'BankCardScreen 已人工改稿,现状必须 0 处')
  const regressed = bank.map((l) =>
    /\bcolor:\s*tk\.brand\.ctaForeground\b/.test(l)
      ? l.replace('tk.brand.ctaForeground', 'tk.surface.light')
      : l,
  )
  const nBank = gate.findR7Violations(regressed).length
  assert.ok(
    nBank >= 2,
    `把 ctaForeground 换回 surface.light 必须命中 ≥2 处(bankName / cardNumber),实得 ${nBank}`,
  )
  // (2) TokenValueScreen:HEAD 现存债,必须逐条判出(该文件登记在棘轮基线里)
  const tv = read('packages/app/src/features/token-value/TokenValueScreen.tsx').split('\n')
  const nTv = gate.findR7Violations(tv)
  assert.ok(
    nTv.length >= 6,
    `TokenValueScreen 在 HEAD 确有 ≥6 处嵌套错配,实得 ${nTv.length} ⇒ 判据失效`,
  )
  assert.ok(
    nTv.every((v) => v.tier === 'brand.cta' && v.fgTok === 'surface.light'),
    'TokenValueScreen 的存量必须全是 cta 底 × surface.light(出现别的组合说明矩阵被改宽)',
  )
  const fixedTv = tv.map((l) =>
    /\bcolor:\s*tk\.surface\.light\b/.test(l)
      ? l.replace('tk.surface.light', 'tk.brand.ctaForeground')
      : l,
  )
  assert.equal(
    gate.findR7Violations(fixedTv).length,
    0,
    '同一文件只换前景就应归 0 —— 证明红点真挂在前景档位上',
  )
  // (3) 反向对照:内联在图标上的 color prop(R1/R4 结构上永远看不见的一型)
  const circle = read('apps/mobile-rn/src/screens/CircleIndexScreen.tsx').split('\n')
  assert.ok(
    gate.findR7Violations(circle).some((v) => v.container === 'fab' && v.fgTok === 'surface.card'),
    'CircleIndexScreen 的悬浮加号必须判出(<Plus color={tk.surface.card}/> 在 brand.cta 底里)',
  )
  // (4) 建门第一版的假阳现场:ArticleDetailScreen 的 `<FlatList ListEmptyComponent=…>`
  //     当时把子元素的 style 并进了宿主 key 集,使 commentEmptyText 冒充 commentNickname
  //     的背景边界。属性区与子树两条通道分开收之后必须归 0 —— 拿真文件钉,不靠夹具。
  const article = read('apps/mobile-rn/src/screens/ArticleDetailScreen.tsx').split('\n')
  assert.equal(
    gate.findR7Violations(article).length,
    0,
    'ArticleDetailScreen 必须 0 处(它曾是本判据的假阳样本)',
  )
  // (5) 全仓无解析异常:R7 的 catch 分支一旦触发就是"静默少判",必须当场红
  assert.deepEqual(
    gate.r7ParseErrors,
    [],
    `R7 建树过程抛出 ${gate.r7ParseErrors.length} 次 ⇒ 这些文件未被判定(假绿)`,
  )
})

test('R7 归属边界:中间层自带背景 / 平行兄弟 / 未收录 prop 都不得算债(建门实测的假阳形态)', () => {
  // 这一组是**回归钉**。第 3 条不是"判据够不着"而是**刻意的窄口径**:`titleStyle` 这类
  // 同名不同层的 prop 一旦收进来,全站标题色都会成为债 —— 与"宁漏不误报"直接冲突。
  // 第 5 条(属性内嵌套元素)的真仓形态改由 A/B 组用 ArticleDetailScreen 原文钉:
  // 建门第一版把 FlatList 子元素的 style 并进了宿主 key 集,使 commentEmptyText
  // 冒充 commentNickname 的背景边界 —— 那条假阳现在必须是 0。
  const runs = [
    [
      '中间层自有 rgba 底',
      [
        '    card: { backgroundColor: tk.brand.cta },',
        "    badge: { backgroundColor: 'rgba(255,255,255,0.25)' },",
        '    badgeText: { color: tk.surface.light },',
        '  return (<View style={styles.card}><View style={styles.badge}><Text style={styles.badgeText}>x</Text></View></View>)',
      ],
    ],
    [
      '平行兄弟未嵌套',
      [
        '    card: { backgroundColor: tk.brand.cta },',
        '    bankName: { color: tk.surface.light },',
        '  return (<View><View style={styles.card} /><Text style={styles.bankName}>x</Text></View>)',
      ],
    ],
    [
      '未收录的 style prop(刻意窄口径)',
      [
        '    card: { backgroundColor: tk.brand.cta },',
        '    tabLabel: { color: tk.surface.light },',
        '  return (<View style={styles.card}><TabBar titleStyle={styles.tabLabel} /></View>)',
      ],
    ],
    [
      '非品牌底上的正文',
      [
        '    container: { backgroundColor: tk.surface.light },',
        '    title: { color: tk.text.primary },',
        '  return (<View style={styles.container}><Text style={styles.title}>x</Text></View>)',
      ],
    ],
    [
      '条件三元含一枚正配',
      [
        '    card: { backgroundColor: tk.brand.cta },',
        '    on: { color: tk.surface.light },',
        '    ok: { color: tk.brand.ctaForeground },',
        '  return (<View style={styles.card}><Text style={active ? styles.on : styles.ok}>x</Text></View>)',
      ],
    ],
    [
      '兄弟命名归 R4 不归 R7',
      [
        '    retryBtn: { backgroundColor: tk.brand.cta },',
        '    retryText: { color: tk.surface.light },',
        '  return (<View style={styles.retryBtn}><Text style={styles.retryText}>x</Text></View>)',
      ],
    ],
    [
      'DEFAULT 底 × surface.light(两态可见)',
      [
        '    btn: { backgroundColor: tokens.brand.DEFAULT },',
        '    btnCaption: { color: tokens.surface.light },',
        '  return (<View style={styles.btn}><Text style={styles.btnCaption}>x</Text></View>)',
      ],
    ],
  ]
  for (const [label, lines] of runs) {
    const got = gate.findR7Violations(lines)
    assert.deepEqual(
      got.map((v) => `${v.container}×${v.fg}`),
      [],
      `R7 反向对照「${label}」必须 0 处,实得 ${JSON.stringify(got)}`,
    )
  }
  // 阳性:去掉"中间层自带底"这一条边界,同一夹具必须红 —— 证明上面那条的 0 是判出来的
  const noBoundary = [
    '    card: { backgroundColor: tk.brand.cta },',
    '    badge: { paddingHorizontal: 8 },',
    '    badgeText: { color: tk.surface.light },',
    '  return (<View style={styles.card}><View style={styles.badge}><Text style={styles.badgeText}>x</Text></View></View>)',
  ]
  assert.equal(
    gate.findR7Violations(noBoundary).length,
    1,
    '同一嵌套去掉中间层背景后必须判红(边界只在"确有背景"时才生效)',
  )
})

test('R7 解析前置单独取证:属性值读取 / style 引用识别 / 嵌套元素抹除(实现在源脚本,本文件只调用)', () => {
  assert.deepEqual(
    gate
      .readJsxAttrValues(' style={[styles.a, cond && styles.b]} color={"#fff"}', ['style'])
      .map((x) => x.value.trim()),
    ['[styles.a, cond && styles.b]'],
    '数组形态 style 必须整段取出(不得在第一个 `]` 前截断)',
  )
  assert.equal(
    gate.readJsxAttrValues(' style={{ backgroundColor: tk.brand.cta }}', ['style']).length,
    1,
    '内联对象形态',
  )
  assert.deepEqual(gate.styleKeyRefsIn('styles.card'), ['card'])
  assert.deepEqual(gate.styleKeyRefsIn('item.card'), [], '普通成员访问不得算 style 引用(假阳之源)')
  assert.deepEqual(gate.styleKeyRefsIn('cardStyles.on'), ['on'], '端内自定义 holder 名要认')
  assert.deepEqual(gate.styleKeyRefsIn('tk.surface.light'), [], '令牌路径不得被当成 style key')
  const tag =
    '<FlatList data={x} keyExtractor={(i) => i.id} ListEmptyComponent={<Text style={styles.eleph}>} />'
  const head = gate.parseTagHead(tag, 0, tag.length)
  assert.ok(
    head && head.name === 'FlatList' && head.selfClosing,
    '箭头 `=>` / 嵌套标签都不得提前终止标签头',
  )
  assert.equal(
    gate.styleKeyRefsIn(gate.maskNestedElements(tag, head.attrStart, head.attrEnd)).length,
    0,
    '嵌套元素的 style 必须被抹除',
  )
  assert.equal(
    gate.styleKeyRefsIn(tag.slice(head.attrStart, head.attrEnd))[0],
    'eleph',
    '对照:不抹除就会并进宿主 key 集',
  )
  // 泛型标签(RN 端常见的 `<FlatList<T>`)的 `<`/`>` 不得被当成标签终点
  const gen = '<FlatList<BankCardItem> data={x} />'
  const gh = gate.parseTagHead(gen, 0, gen.length)
  assert.ok(gh && gh.name === 'FlatList' && gh.selfClosing, '泛型参数不得截断标签头')
  assert.deepEqual(
    gate.styleKeyRefsIn(gen.slice(gh.attrStart, gh.attrEnd)),
    [],
    '泛型段本身不是 style 引用',
  )
})

test('R7 失败面与基线:红点必须点名两档正配、给复现命令;两个文档性注记键必须存活', () => {
  const src = readFileSync(join(REPO, 'scripts', 'check-brand-foreground.mjs'), 'utf8')
  const base = JSON.parse(
    readFileSync(join(REPO, 'scripts', 'brand-foreground-baseline.json'), 'utf8'),
  )
  assert.match(src, /❌ R7 /, 'R7 失败行缺失')
  assert.match(
    src,
    /底取 brand\.cta 时文字\*\*只能\*\*取 brand\.ctaForeground/,
    'R7 修复提示必须按档点名正配前景',
  )
  assert.match(src, /基线棘轮只减不增\):\$?\{?r7\.length/, 'R7 失败行必须说明走棘轮')
  // blocking 门必须有人工出口,否则唯一出路是 --no-verify(本仓最高反面教训)
  assert.match(src, /r7-nest-exempt:/, 'R7 必须声明行内豁免出口(且要求带原因)')
  // 与 R4 互斥的剪枝必须在**产出端**,不是展示层过滤 —— 后置过滤等于仍占基线额度
  assert.match(
    src,
    /if \(cname && isSiblingStylePair\(cname, nodes\[n\]\.keys\[0\]\)\) continue/,
    'R7 必须在产出端就让位给 R4(同一次债不得被两条判据各计一次)',
  )
  assert.ok(Object.hasOwn(base, gate.BASELINE_R7_KEY), '基线必须含 nestMismatchCounts 键')
  // --update-baseline 会把五个计数面整段重写:R7 面必须列入 omit 清单,
  // 否则它会作为 ...notes 被旧值带走 ⇒ "实测清零但基线仍是旧数"的假绿(R5 同一条坑)
  assert.match(
    src,
    /nestMismatchCounts:\s*_omitNest/,
    '--update-baseline 未把 R7 面列入 omit ⇒ 会拿旧值当新基线',
  )
  // 他人手记的两个文档性键必须仍在(上一轮改动曾把 pairedCtaNotVisibleToRule 冲掉过)
  for (const docKey of [
    'pairedCtaNotVisibleToRule',
    'ctaFillRenameLedger',
    'r7NestMismatchLedger',
  ]) {
    assert.ok(
      Object.hasOwn(base, docKey),
      `基线丢了文档性注记键 ${docKey}(那是"计数为什么这样"的取证)`,
    )
  }
  // R7 存量与基线的一致性由下面"真仓端到端"那条做**交叉核对**(扫出来的数 vs 基线合计),
  // 这里不钉魔法数 16 —— 原先写 `assert.equal(measured, 16)` 是把基线自己求完和再和字面量比,
  // 既发现不了漂移(两边同源),又让"把 16 处 AA 缺陷合法修掉"当场测试红,是纯粹的自锁。
  const measured = Object.values(base[gate.BASELINE_R7_KEY]).reduce((a, b) => a + b, 0)
  assert.ok(Number.isInteger(measured) && measured >= 0, `R7 基线合计非有限非负整数:${measured}`)
  for (const [f, c] of Object.entries(base[gate.BASELINE_R7_KEY])) {
    assert.ok(Number.isInteger(c) && c >= 1, `基线里 ${f} 的额度是 ${c} —— 0 值条目必须删掉,留着会让"清零"看起来像未登记`)
  }
})

test('装车证明:guardian-runner 里确有本门注册块(blocking + skipEnv),编号反查且全 runner 唯一', () => {
  const runner = readFileSync(join(REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const block = runner.match(
    /\{\s*\n\s*id: '([0-9]+[a-z]?)',[\s\S]{0,400}?script: 'check-brand-foreground\.mjs'/,
  )
  assert.ok(block, '本门未接入 runner(找不到 id→script 相邻的注册块)—— 判据存在而永不调用 = 没有')
  const myId = block[1]
  const occ = runner.match(new RegExp(`id: '${myId}'`, 'g')) || []
  assert.equal(
    occ.length,
    1,
    `id ${myId} 在 runner 中出现 ${occ.length} 次 ⇒ 与别的门撞号,注册块可能互相顶掉`,
  )
  // 注册块尾部:mode 与 skipEnv(反查所得的 id 定位,不硬写编号)
  const tailStart = runner.indexOf(`id: '${myId}'`)
  const tail = runner.slice(tailStart, tailStart + 3000)
  assert.match(tail, /mode:\s*'blocking'/, '本门必须 blocking(warn 门拦不住新增实底回潮)')
  assert.match(
    tail,
    /skipEnv:\s*'HUSKY_SKIP_BRAND_FOREGROUND'/,
    '应急跳过通道必须声明且与脚本内 SKIP_ENV 同名',
  )
  const ids = [...runner.matchAll(/^\s{4}id: '([0-9a-z]+)',$/gm)].map((m) => m[1])
  const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))]
  assert.deepEqual(dupes, [], `runner 存在重号: ${dupes.join(', ')}`)
})

test('真仓端到端:全量审计 exit 0,且 R3 存量已回升(盲区态实测 87,扩面后必 ≥200)', () => {
  assert.ok(existsSync(join(REPO, 'scripts', 'brand-foreground-baseline.json')), '基线文件必须在位')
  const out = execFileSync(
    process.execPath,
    [join(REPO, 'scripts', 'check-brand-foreground.mjs')],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300_000,
    },
  )
  // exit 0(execFileSync 非零会抛)之外再钉存量数字:R3 扩面前真仓 HEAD 实测 87(DEFAULT 残量),
  // 扩面后回升到 235(= 迁移前的量级)。留 ≥200 下限:并行会话合法清理实底可让它下降,但一旦有人
  // 把判据改回只认 DEFAULT,存量立刻掉回 87 一档 ⇒ 本断言当场红,这就是"盲区不得复辟"的装车证明。
  const m = out.match(/R3 存量 (\d+) 处/)
  assert.ok(m, `输出未含 R3 存量计数(结论行被改动?):${out}`)
  // R7 的计数必须出现在结论行:它没有分母(命中数 / 范围)就分不清"债清完了"与"树解不出来"
  const m7 = out.match(/R7 (\d+) 处全部 ≤ 基线/)
  assert.ok(m7, `结论行未含 R7 计数(R7 静默失效的唯一表现就是这行少一截):${out}`)
  // 真正的防漂移:扫出来的数必须等于基线合计。两个独立来源(实扫 vs 冻结台账)不一致即红 ——
  // 有人未登记地改了存量会红,把存量合法清到 0 则两边同时归 0,不会误伤。
  const baseNest = Object.values(
    JSON.parse(readFileSync(join(REPO, 'scripts', 'brand-foreground-baseline.json'), 'utf8'))
      .nestMismatchCounts || {},
  ).reduce((a, b) => a + b, 0)
  assert.equal(
    Number(m7[1]),
    baseNest,
    `全量 R7 实测 ${m7[1]} ≠ 基线合计 ${baseNest} ⇒ 存量被未登记地改动(或基线未随之收紧)`,
  )
  const total = Number(m[1])
  assert.ok(
    total >= 200,
    `R3 存量 ${total} < 200 ⇒ cta 填充从判据里消失了(扩面被改回,或基线被误校准)`,
  )
  const base = JSON.parse(
    readFileSync(join(REPO, 'scripts', 'brand-foreground-baseline.json'), 'utf8'),
  )
  const baseSum = Object.values(base.ctaCounts).reduce((a, b) => a + b, 0)
  assert.ok(baseSum >= total, `基线合计 ${baseSum} < 实测 ${total} ⇒ 门在红态,交付无效`)
})

test('自检入口可用:--self-test 退出码 0', () => {
  const out = execFileSync(
    process.execPath,
    [join(REPO, 'scripts', 'check-brand-foreground.mjs'), '--self-test'],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
    },
  )
  assert.match(out, /self-test 全部通过/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
