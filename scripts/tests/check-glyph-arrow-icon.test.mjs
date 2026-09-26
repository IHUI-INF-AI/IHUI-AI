// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「文本箭头当图标 / 箭头字号倒挂」的 §22c 镜像测试。
 *
 * 与 `--self-test` 的分工:self-test 验**判据**;本文件验**接线与判据不得被改松** ——
 * 判据存在而永不调用 = 没有(守门 70/76/81 的同型教训),而一条按规矩写就红的门被放宽一档,
 * 结局同样是没人再守门。
 *
 * 注册前置:本门尚未进 `scripts/guardian-runner.mjs`(编号/挂点由编排方掌握)。
 * 因此本文件写成"未注册时绿、注册后必须 blocking + skipEnv + 编号唯一"的方向性断言 ——
 * 摘线或错接线都会被这里抓回,而不是靠人记得。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as gate } from '../check-glyph-arrow-icon.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const RUNNER = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
const SCRIPT = 'check-glyph-arrow-icon.mjs'

test('§22c phase B:源脚本必须 export __test__ 且含核心判据(缺一项即测试在验空气)', () => {
  for (const k of [
    'scan',
    'scanRepo',
    'auditFile',
    'splitFresh',
    'findGlyphIconChildren',
    'parseTagAt',
    'collectFontSizes',
    'findOpticalMismatch',
    'wordsOf',
    'stemOf',
    'isLabelName',
    'BARE_GLYPH_RE',
    'BRACED_GLYPH_RE',
    'BACK_LABEL_EXPR_RE',
    'BACK_TEXT_LITERAL_RE',
    'BACK_EXEMPT_LINE_RE',
    'classifyBackLabel',
    'findBackLabelChildren',
    'walkAffordanceChildren',
    'findRnDoubleHeaders',
    'headerBackFiles',
    'importsOf',
    'barrelExportMap',
    'RN_SCREEN_PREFIXES',
    'RN_APP_BARREL',
    'HANDLER_ATTR_RE',
    'PREFILTER',
    'SCAN_DIRS',
    'MECHANISMS',
    'SELF_EXEMPT_RE',
    'SELF_SKIP',
  ]) {
    assert.ok(k in gate, `__test__ 缺 ${k}`)
  }
})

test('§22c phase C:本测试必须从源脚本 import __test__(不得复制判据成第二份真相)', () => {
  const self = readFileSync(join(HERE, 'check-glyph-arrow-icon.test.mjs'), 'utf8')
  assert.match(
    self,
    /import\s*\{\s*__test__\s+as\s+\w+\s*\}\s*from\s*['"]\.\.\/check-glyph-arrow-icon\.mjs['"]/,
    '缺 __test__ import,又写成镜像常量',
  )
})

test('扫描面必须覆盖每一个会渲染界面的端 + 单一入口路径不得写死盘符', () => {
  // 2026-09-26 扩面:这里曾**逐字钉死"任务书点名的四端"**,于是 apps/extension / desktop / cli /
  // mobile-cap / ui-react / ui-native / shared 共 376 个源文件在门外,而门外当时就有一处真违规
  // (AgentPage 的 i18n「返回」摆箭头位)。锁把面写死成"立项那几端",本身就是洞的一部分 ——
  // 判据的覆盖面应当由"哪些端会渲染界面"决定,而不是由某张任务书决定。
  assert.deepEqual(gate.SCAN_DIRS, [
    'apps/mobile-rn',
    'packages/app',
    'apps/miniapp-taro',
    'apps/web/app',
    'apps/web/src',
    'apps/extension',
    'apps/desktop',
    'apps/cli/src',
    'apps/mobile-cap',
    'packages/ui-react/src',
    'packages/ui-native/src',
    'packages/shared/src',
  ])
  for (const d of gate.SCAN_DIRS) assert.ok(existsSync(join(ROOT, d)), `扫描面目录不存在:${d}`)
  const src = readFileSync(join(ROOT, 'scripts', SCRIPT), 'utf8')
  assert.doesNotMatch(src, /\b[DdGg]:[\\/]/, '取材路径不得写死盘符(§15)')
})

test('预筛必须是判据字面量的超集 —— 加了字形忘了加进预筛 = 门对该形态全盲', () => {
  // 右向四个是立项那批;左向 ‹/← 与 GA4 的「返回」是 2026-09-25 小程序返回键收口补的。
  // 本断言的存在理由正是"上一轮加判据时,预筛与判据分别由两次改动写,漏者无声"。
  const glyphs = new Set(['›', '»', '→', '》', '‹', '←', '>'])
  for (const g of glyphs) {
    // 整格判据里的每个字符都必须出现在预筛模式串里(或该字符本就由更宽的词根覆盖)
    assert.ok(
      gate.BARE_GLYPH_RE.test(g) && gate.BRACED_GLYPH_RE.test(`{'${g}'}`),
      `判据认 ${g} 的前提不成立`,
    )
    if (g !== '>') assert.ok(gate.PREFILTER.includes(g), `预筛漏了 ${g}:该字形将永远扫不到`)
  }
  for (const w of ['fontSize', 'font-size', '返回'])
    assert.ok(gate.PREFILTER.includes(w), `预筛漏了 ${w}:GA2/GA4 将永远扫不到`)
  // GA7 的标识符与 GA6 同理是**跨文件判据**的识别字面量:漏 headerShown ⇒ H3 整型隐身;
  // 漏 onBack ⇒ H2 的候选 wrapper 被预筛整批丢掉(2026-09-26 立项同批补,防"两次改动各写一半"复现)。
  for (const w of ['BackChevron', 'NavBar', 'navigationStyle', 'headerShown', 'onBack'])
    assert.ok(gate.PREFILTER.includes(w), `预筛漏了 ${w}:GA6/GA7 将永远扫不到`)
  // GA4 的键名判据必须认 back 与 back<数字> 两种,且**不得**认带宾语的标签
  for (const k of ['common.back', 'forgot.back', 'adaptersSelectertaro.back4'])
    assert.ok(
      gate.BACK_LABEL_EXPR_RE.test(`{tt('${k}', '返回')}`),
      `GA4 漏认键名 ${k}(该形态将永远扫不到)`,
    )
  for (const k of ['pay.backHome', 'forgot.backLogin', 'live.calendar.prevMonth'])
    assert.ok(
      !gate.BACK_LABEL_EXPR_RE.test(`{t('${k}')}`),
      `GA4 误纳带宾语/翻页的标签 ${k}(换成裸箭头反而不表意)`,
    )
})

test('豁免原因不得由注释闭合符冒充(两条通道同口径;裸标记生效等于整行免检)', () => {
  // 端到端走 auditFile,而不是只喂 collectExemptLines —— 证明的是"提交链里这一行真会被判"。
  const GA1_LINE = 'export const P = ({ go }) => <Text onClick={go}>›</Text> {'
  const GA4_LINE = 'export const P = ({ go }) => <Text onClick={go}>返回</Text> {'
  const close = '/* MARKER: */}\n' // JSX 注释容器:标记之后只剩 星号/斜杠/花括号
  const reasonClose = '/* MARKER: 与封面同源的指示符 */}\n'
  const cases = [
    { name: 'glyph-arrow-exempt', rule: 'GA1', line: GA1_LINE },
    { name: 'back-label-exempt', rule: 'GA4', line: GA4_LINE },
  ]
  for (const c of cases) {
    const bare = (c.line + close.replace('MARKER', c.name)).replace(/\s+$/, '')
    const withReason = (c.line + reasonClose.replace('MARKER', c.name)).replace(/\s+$/, '')
    const nOf = (src) => gate.auditFile('apps/miniapp-taro/src/t.tsx', src).findings.filter((f) => f.rule === c.rule).length
    assert.equal(nOf(c.line + '\n'), 1, `${c.name}:阳性对照失效 —— 已知违规看不见,后面两条断言都无意义`)
    assert.equal(nOf(bare), 1, `${c.name}:裸标记 + 注释闭合符被当成"带了原因"⇒ 整行免检`)
    assert.equal(nOf(withReason), 0, `${c.name}:真原因必须放过,否则人工出口是空头承诺`)
  }
})

test('装车前置:未注册时本门必须不在 runner 里;一旦注册则必须 blocking + 声明 skipEnv', () => {
  const ids = [...RUNNER.matchAll(/^\s*id: '([^']+)',/gm)].map((m) => m[1])
  const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))]
  assert.deepEqual(
    dupes,
    [],
    `runner 存在重复编号:${dupes.join(',')}(同日多会话在同一位置各加一道门必然撞号)`,
  )
  const at = RUNNER.indexOf(`script: '${SCRIPT}'`)
  if (at < 0) {
    // 尚未注册(编排方负责挂点)。这里只钉"别的世界结论":应急通道不得被别人占用
    assert.ok(!RUNNER.includes(gate.SELF_SKIP), `${gate.SELF_SKIP} 不得已被别的门声明`)
    return
  }
  const start = RUNNER.lastIndexOf('id:', at)
  const block = RUNNER.slice(start, at + 600)
  assert.match(block, /mode:\s*'blocking'/, '本门拦的是用户实拍缺陷形态,注册成 warn 等于没有')
  assert.match(block, new RegExp(`skipEnv:\\s*'${gate.SELF_SKIP}'`), '缺应急通道声明')
  assert.equal(
    ids.filter((v) => v === /id: '([^']+)'/.exec(block)[1]).length,
    1,
    '本门编号在 runner 中必须恰好出现一次',
  )
})

test('应急跳过 env 必须真被脚本读取(本仓有数道门的"跳过方法"是空头承诺)', () => {
  const src = readFileSync(join(ROOT, 'scripts', SCRIPT), 'utf8')
  assert.match(
    src,
    /process\.env\[SELF_SKIP\]\s*===\s*'1'/,
    'SELF_SKIP 从未被读 → 文档里的跳过方法是假的',
  )
  assert.equal(gate.SELF_SKIP, 'HUSKY_SKIP_GLYPH_ARROW_ICON')
  assert.ok(
    !/HUSKY_SKIP_NO_EMOJI\b/.test(src),
    '本门不得复用 11h 的跳过通道 —— 那会让一次跳过关掉两道门',
  )
})

test('§22d isDirectRun:被 import 时绝不跑 CLI,且必须经 pathToFileURL 归一(Windows 反斜杠坑)', () => {
  const src = readFileSync(join(ROOT, 'scripts', SCRIPT), 'utf8')
  assert.match(src, /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.match(src, /if \(isDirectRun\) \{/)
  assert.ok(
    src.indexOf('if (isDirectRun)') < src.indexOf('export const __test__'),
    '__test__ 必须导在 isDirectRun 之后',
  )
  // 本文件能执行到这里,本身就是"import 未触发 main()"的证明(触发了就会 process.exit 掉测试进程)
})

test('GA1 必须保留"可证 affordance"这一限制(去掉它 = 把面包屑/表格数据全判红)', () => {
  const src = readFileSync(join(ROOT, 'scripts', SCRIPT), 'utf8')
  // 2026-09-25 起 GA1/GA4 共用一遍遍历 walkAffordanceChildren,证据函数由 affordanceReason
  // 改名为 affordanceEvidence(要额外带出 anchor 元素给 GA4 的块级豁免用)。
  // 本锁因此改为钉"证据被算出 ⇒ 且 push 以它为条件"这一**配对**,而不是某个变量名;
  // 真正的牙在下面那对端到端正反例(摘掉条件 ⇒ 反向例立即变红),配对只是把意图留在原地。
  assert.match(
    src,
    /const ev = affordanceEvidence\([\s\S]{0,200}?if\s*\(ev\)\s*out\.push/,
    'affordance 判定被摘 ⇒ 本门从"拦字形图标"变成"拦一切标点"',
  )
  // 端到端正反成对:同一段整格 ›,有可点祖先必红、无可点证据必绿
  assert.equal(
    gate.findGlyphIconChildren(
      ...textOf('export const A = ({ go }) => <View onClick={go}><Text>›</Text></View>'),
    ).length,
    1,
    '阳性对照失效:已知目标看不见',
  )
  assert.equal(
    gate.findGlyphIconChildren(...textOf('export const A = () => <View><Text>›</Text></View>'))
      .length,
    0,
    '反向对照失效:无可点证据也被判红',
  )
})

/** 把源码片段变成 [code, strMask] —— 镜像测试与自检共用同一条取材路径,不另造一套语义 */
function textOf(src) {
  const { code, strMask } = gate.stripCommentsKeepStrings(src)
  return [code, strMask]
}

test('GA2 的词元切分与词干规则不得回退成子串匹配(remove 曾被当成 more)', () => {
  assert.ok(!gate.isLabelName('removeText'), '子串匹配会把 remove 认成 more ⇒ 满天假红')
  assert.ok(gate.isLabelName('showMoreText') && gate.isArrowName('showMoreArrow'))
  assert.equal(gate.stemOf('show-more-arrow'), gate.stemOf('show-more-text'))
  const pairs = gate.findOpticalMismatch(
    gate.collectFontSizes(
      gate.stripCommentsAndStrings(
        '.show-more-text{font-size:26rpx}\n.show-more-arrow{font-size:28rpx}\n',
      ),
    ),
  )
  assert.equal(pairs.violations.length, 1, '任务书原文形态的 CSS 字号倒挂必须被看见')
  const ok = gate.findOpticalMismatch(
    gate.collectFontSizes(
      gate.stripCommentsAndStrings(
        '.show-more-text{font-size:26rpx}\n.show-more-arrow{font-size:26rpx}\n',
      ),
    ),
  )
  assert.equal(ok.violations.length, 0, '同档即合规:判据只拦"箭头比标签大"')
})

test('自豁免必须按路径前缀生效,且不得扩成"注释里写一句就整文件免检"', () => {
  assert.ok(gate.SELF_EXEMPT_RE.test('scripts/check-glyph-arrow-icon.mjs'))
  assert.ok(gate.SELF_EXEMPT_RE.test('scripts/tests/check-glyph-arrow-icon.test.mjs'))
  assert.ok(
    !gate.SELF_EXEMPT_RE.test('apps/web/src/components/x.tsx'),
    '前缀过宽会把业务代码一起放掉',
  )
  assert.equal(
    gate.collectExemptLines('a // glyph-arrow-exempt:').size,
    0,
    '裸标记不得生效(必须带原因)',
  )
  assert.equal(gate.collectExemptLines('a // glyph-arrow-exempt: 与封面同高').size, 1)
})

test('HEAD 口径:全量必须判 HEAD blob,不得回退成"按磁盘读"(共享工作树滞后会闪红)', () => {
  const src = readFileSync(join(ROOT, 'scripts', SCRIPT), 'utf8')
  assert.match(
    src,
    /'ls-tree',\s*'-r',\s*'--name-only',\s*'-z',\s*'HEAD'/,
    '全量清单不再按 HEAD 树取',
  )
  // 2026-09-25 同位重锚(不是放宽):blob 批读的实现已收口到 scripts/lib/face-reader.mjs,
  // 本门源码里因此**不再出现** `cat-file','--batch` 字面量。原判据若继续钉该字面量,就会在
  // 合规代码上恒红(按规矩写就红的门 = 逼人 --no-verify)。判据换成同一方向的三件事:
  //   ① 批读必须真的来自共用层(而不是本门自带一份、更不是退回 readFileSync 读工作树);
  //   ② 本门不得再自己拼 git 派生 —— 搬回去就红,红的是"又长出第二份取材实现"这件事;
  //   ③ 本门用"空 stderr 哨兵"区分 `git grep` 零命中与派生失败(共用层缺"带退出码的只读派生
  //      出口"这一原语),该耦合必须由测试看守:上游改文案 ⇒ 这里红,而不是预筛静默退化成全量。
  assert.match(
    src,
    /import\s*\{[^}]*\bcatBatch\b[^}]*\}\s*from\s*'\.\/lib\/face-reader\.mjs'/,
    '内容必须走共用层的 blob 批读(catBatch),不是 readFileSync(工作树)',
  )
  assert.doesNotMatch(
    src,
    /execFileSync\s*\(|execSync\s*\(/,
    '取材派生必须收口到 scripts/lib/face-reader.mjs —— 本门自带一份就是那五处易错点的入口',
  )
  assert.doesNotMatch(
    src,
    /safe\.directory=\*/,
    'safe.directory 由共用层统一给,端内不得再拼(拼了就是又一处只有一个人会写对的陷阱)',
  )
  assert.match(
    readFileSync(join(ROOT, 'scripts', 'lib', 'face-reader.mjs'), 'utf8'),
    /\(git 无输出\)/,
    '共用层的"空输出哨兵"改名了 → 本门 gitGrep 的零命中判定会静默升成异常,须同步改 NO_MATCH_SENTINEL',
  )
  // 棘轮锚点=该文件 HEAD 自身,而不是静态清单也不是 0
  assert.equal(gate.splitFresh(new Map([['a.tsx', 70]]), new Map([['a.tsx', 70]])).fresh.length, 0)
  assert.equal(gate.splitFresh(new Map([['a.tsx', 71]]), new Map([['a.tsx', 70]])).fresh.length, 1)
  assert.ok(
    !existsSync(join(ROOT, 'scripts', 'glyph-arrow-icon-baseline.json')),
    '存量已按 HEAD 自计,不得再留静态基线清单(清单过期=门瞎)',
  )
})

test('S0 机制清单必须就是 AGENTS.md 点名的那些唯一实现,且每个条目自带锚点与矢量判据', () => {
  // 按**路径集合**对账而不是按条数:条数断言只会说"不对",路径集合会说"多了谁/少了谁"。
  // 第 4/5 条(2026-09-25)= 页头返回键的**两份同名实现**(小程序端内 + RN/共享屏层)。
  // 为什么两份都要登记:只看着端内那一份时,共享层 `packages/app` 那份被摘线(改回文本字形、
  // 或没人 import)本门全绿 —— 而 RN 与桌面端同时失去唯一实现。同名不同实现最容易只记一份。
  assert.deepEqual(
    [...gate.MECHANISMS.map((m) => m.file)].sort(),
    [
      'apps/miniapp-taro/src/components/BackChevron.tsx',
      'apps/miniapp-taro/src/components/LineIcon/icons.ts',
      'apps/web/src/components/common/view-more-link.tsx',
      'packages/app/src/components/BackChevron.tsx',
      'packages/app/src/components/MoreLink.tsx',
    ].sort(),
    'S0 机制清单与既定五条形成了偏差',
  )
  for (const m of gate.MECHANISMS) {
    assert.ok(
      m.symbol && m.icon && m.file && m.note,
      `${m.file || '?'} 缺 symbol/icon/file/note 之一`,
    )
    assert.ok(existsSync(join(ROOT, m.file)), `共享实现已不存在:${m.file}`)
    assert.ok(!/\.test\.|__tests__/.test(m.file), '机制清单不得收录测试夹具')
  }
  // 文档点名的路径必须就是清单这几条(按端内相对路径比对,文档写的是 `components/LineIcon/icons.ts` 这种尾段)
  const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')
  for (const m of gate.MECHANISMS) {
    const tail = m.file.split('/').slice(-2).join('/')
    assert.ok(agents.includes(tail), `AGENTS.md 未点名 ${tail} —— 本门在替一份不在文档里的实现背书`)
  }
})

test('守门面必须覆盖**每一个会渲染界面的端**(2026-09-26 扩面:5 个 UI 端曾在门外)', () => {
  // 门只扫 5 条目录时,apps/extension / desktop / cli / mobile-cap / ui-react / ui-native / shared
  // 共 376 个源文件在门外 —— 而门外当时就有一处真违规(AgentPage 的 i18n「返回」摆箭头位),
  // 它不是"漏改",是结构上看不见:pre-commit 永远不会为它喊红。
  const dirs = gate.SCAN_DIRS.join('\n')
  for (const need of [
    'apps/miniapp-taro',
    'apps/web',
    'apps/mobile-rn',
    'packages/app',
    'apps/extension',
    'apps/desktop',
    'apps/cli',
    'apps/mobile-cap',
    'packages/ui-react',
    'packages/ui-native',
    'packages/shared',
  ]) {
    assert.ok(dirs.includes(need), `扫描面缺 ${need} —— 该端上的返回 affordance 无人看守`)
  }
  // 每一条扫描目录都必须真实存在(目录被改名而表没跟上 = 门对着空气扫,守门 103 的 T1 同型)
  for (const d of gate.SCAN_DIRS) {
    assert.ok(existsSync(join(ROOT, d)), `SCAN_DIRS 里的 ${d} 不存在 ⇒ 该条静默零覆盖`)
  }
})

test('真仓 HEAD 上 S0 必须为 0(机制此刻就在位;谁摘线谁变红,不是门自己恒红)', () => {
  const { result } = gate.scanRepo(ROOT, 'head', null, {
    wiring: new Map(gate.MECHANISMS.map((m) => [m.file, [`${m.symbol} 消费方`]])),
  })
  assert.deepEqual(
    result.violations.s0.map((x) => x.msg),
    [],
    `S0 现状即结论:${result.violations.s0.map((x) => `${x.file}:${x.msg}`).join(' | ')}`,
  )
})

test('GA5 / GA6 必须真的挂在 scan() 上(判据写在文件里而没人调用 = 没有这道门)', () => {
  // 守门 70/76/81 的同一型事故:函数存在、自检也过,但 scan() 从没调它 ⇒ 提交链上一路绿灯。
  // 这里不读源码注释,直接喂内存 reader 走 scan,拿**出口桶**证明接线。
  const read = (p) => FIXTURES[p] ?? null
  const { violations, notes } = gate.scan(read, Object.keys(FIXTURES), { checkWiring: true })
  assert.equal(violations.ga5.length, 1, 'GA5 整格混写未经 scan() 产出(接线断了或判据被摘)')
  // 该红的两个(裸键型 + NavBar 型),该绿的一个(custom 页)—— 只有红没有绿就是恒红门,
  // 而恒红门的实际结局是逼人 --no-verify、连带废掉全部守门。"取不到 config"的正反例由 --self-test 管。
  assert.deepEqual(
    violations.ga6.map((x) => x.file).sort(),
    [
      'apps/miniapp-taro/src/pages/dupe/index.tsx',
      'apps/miniapp-taro/src/pages/navbar/index.tsx',
    ],
    `GA6 跨文件判据未经 scan() 产出,或继承链判序坏:${violations.ga6.map((x) => x.file).join(' | ')}`,
  )
  assert.equal(notes.chromeUndetermined.length, 0, '本夹具两处 config 齐备 ⇒ 不该出现未判定')
  // GA6 与屏文件同面:config 必须由**同一个 readFile** 取,不得自己 import 磁盘
  assert.ok(
    !/readFileSync\([^)]*\.config\.ts/.test(
      readFileSync(join(ROOT, 'scripts', 'check-glyph-arrow-icon.mjs'), 'utf8'),
    ),
    'GA6 直接按磁盘读页面 config 会造出"索引里没改而磁盘上改了"的假红/假绿',
  )
})

test('GA7 必须真挂在 scan() 上,且正反两例的输入逐字取自 HEAD 真文件(§22c:镜像只复读实现就是复读机)', () => {
  // 立门的那一型是**跨文件组合**(wrapper 的 NavBar × 子屏的 BackChevron),所以判"接线"不能靠夹具
  // 名字 —— 夹具复刻的是实现的形状;这里喂 git show 现读的三份真文件,scan() 必须量到 HEAD 上
  // 真实存在的 SettingsScreen 双层页头,量不到 = 判据被摘或解析层坏了。
  const gitShow = (p) =>
    execFileSync('git', ['show', `HEAD:${p}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120000,
      windowsHide: true,
    })
  const WRAP = 'apps/mobile-rn/src/screens/SettingsScreen.tsx'
  const CHILD = 'packages/app/src/features/settings/SettingsScreen.tsx'
  const BARREL = 'packages/app/src/index.ts'
  const src = Object.fromEntries([WRAP, CHILD, BARREL].map((p) => [p, gitShow(p)]))
  const { violations, notes } = gate.scan((p) => src[p] ?? null, [WRAP, CHILD, BARREL], {
    checkWiring: false,
  })
  assert.ok(
    violations.ga7.length >= 1,
    'GA7 组合层双返回未经 scan() 产出(判据被摘线,或 barrel 一跳解析坏了)—— HEAD 全量实测该页就是红点之一',
  )
  assert.ok(
    violations.ga7.some((x) => x.file === WRAP),
    `GA7 应点名 wrapper(mobile-rn 侧组合层)而不是子屏:${violations.ga7.map((x) => x.file).join(' | ')}`,
  )
  assert.equal(
    notes.rnDoubleUndetermined.length,
    0,
    '真文件 barrel 是命名再导出、三份齐备 ⇒ 不该有未判定;闪出未判定说明解析层对着真实形态失效了',
  )
  // 反向对照也用真文件:ActivityDetailScreen 的 3 套页头分属**互斥 return 分支**(returns@26,40,57),
  // 那是正当形态 —— 首版按整文件计数把 12 处读数里的 9 处判成了假阳,这条锁禁止口径退回去。
  const ADR = 'packages/app/src/features/activity-detail/ActivityDetailScreen.tsx'
  const adr = gitShow(ADR)
  assert.ok(
    (adr.match(/\breturn\b/g) || []).length >= 3 && (adr.match(/<BackChevron\b/g) || []).length >= 3,
    '夹具前提变了(该文件不再是"多分支各一套页头"的形态)⇒ 这条反向锁需要换受害者,不得删',
  )
  const r2 = gate.scan((p) => (p === ADR ? adr : null), [ADR], { checkWiring: false })
  assert.equal(r2.violations.ga7.length, 0, '互斥分支各画一套被误判 = 假阳回流,分支口径已退化')
  // 静态锁:scan() 真调 findRnDoubleHeaders;scanRepo 真把 headerBackFiles 补进批次(GA7 的依赖
  // 与屏文件必须同面同轮 —— 漏补时 --staged 只含 wrapper,子屏永远"取不到",整条判据在提交链失明)
  const SRC = readFileSync(join(ROOT, 'scripts', 'check-glyph-arrow-icon.mjs'), 'utf8')
  assert.ok(/findRnDoubleHeaders\(readFile, files\)/.test(SRC), 'scan() 不再调用 findRnDoubleHeaders = 摘线')
  assert.ok(
    /\.\.\.headerBackFiles\(root, face\)/.test(SRC),
    'scanRepo 的取材批次丢了 headerBackFiles = GA7 依赖读不到,会把"没读"洗成"没命中"',
  )
  const body = SRC.slice(SRC.indexOf('export function findRnDoubleHeaders'))
  const ga7Body = body.slice(0, body.indexOf('// ── 扫描'))
  assert.ok(
    ga7Body.length > 100 && !ga7Body.includes('readFileSync('),
    'GA7 直接按磁盘读 barrel/子屏 = 与 GA6 的 config 磁盘读同一型假红/假绿来源',
  )
})

test('新增豁免族必须在守门 108 的存活期表里登记(否则它只报数不判红,等于无限期豁免)', () => {
  const expiry = readFileSync(join(ROOT, 'scripts', 'check-exemption-expiry.mjs'), 'utf8')
  for (const fam of ['back-label-exempt', 'nav-chrome-exempt']) {
    assert.ok(
      new RegExp(`'${fam}':\\s*\\d+`).test(expiry),
      `${fam} 是本门的人工出口,却没在 108 的 FAMILY_LIFETIME_DAYS 登记 —— 未登记族只报数,豁免就永不过期`,
    )
  }
})

// 上面那条 scan 接线断言的夹具:三种出口各一个(ga5 命中 / ga6 命中 / ga6 未判定)
const FIXTURES = {
  'apps/miniapp-taro/src/mix.tsx':
    "export const P = ({ go }) => <Text onClick={go}>← 返回</Text>\n",
  'apps/miniapp-taro/src/pages/dupe/index.tsx':
    "import BackChevron from '@/components/BackChevron'\nexport default function V() {\n  return <BackChevron />\n}\n",
  'apps/miniapp-taro/src/pages/dupe/index.config.ts':
    "export default definePageConfig({ navigationBarTitleText: '标题' })\n",
  'apps/miniapp-taro/src/pages/navbar/index.tsx':
    "import NavBar from '@/components/NavBar'\nexport default function W() {\n  return <NavBar />\n}\n",
  'apps/miniapp-taro/src/pages/alright/index.tsx':
    "import NavBar from '@/components/NavBar'\nexport default function Z() {\n  return <NavBar />\n}\n",
  'apps/miniapp-taro/src/pages/alright/index.config.ts':
    "export default definePageConfig({ navigationStyle: 'custom' })\n",
  'apps/miniapp-taro/src/app.config.ts':
    "export default defineAppConfig({ window: { navigationBarTitleText: 'I' } })\n",
  'apps/miniapp-taro/src/components/MoreLink.tsx': 'x',
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
