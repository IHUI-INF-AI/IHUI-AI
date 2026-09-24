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

test('扫描面必须是任务书点名的四端 + 单一入口路径不得写死盘符', () => {
  assert.deepEqual(gate.SCAN_DIRS, [
    'apps/mobile-rn',
    'packages/app',
    'apps/miniapp-taro',
    'apps/web/app',
    'apps/web/src',
  ])
  for (const d of gate.SCAN_DIRS) assert.ok(existsSync(join(ROOT, d)), `扫描面目录不存在:${d}`)
  const src = readFileSync(join(ROOT, 'scripts', SCRIPT), 'utf8')
  assert.doesNotMatch(src, /\b[DdGg]:[\\/]/, '取材路径不得写死盘符(§15)')
})

test('预筛必须是判据字面量的严格超集 —— 加了字形忘了加进预筛 = 门对该形态全盲', () => {
  const glyphs = new Set(['›', '»', '→', '》', '>'])
  for (const g of glyphs) {
    // 整格判据里的每个字符都必须出现在预筛模式串里(或该字符本就由更宽的词根覆盖)
    assert.ok(
      gate.BARE_GLYPH_RE.test(g) && gate.BRACED_GLYPH_RE.test(`{'${g}'}`),
      `判据认 ${g} 的前提不成立`,
    )
    if (g !== '>') assert.ok(gate.PREFILTER.includes(g), `预筛漏了 ${g}:该字形将永远扫不到`)
  }
  for (const w of ['fontSize', 'font-size'])
    assert.ok(gate.PREFILTER.includes(w), `预筛漏了 ${w}:GA2 将永远扫不到`)
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
  assert.match(
    src,
    /if\s*\(via\)\s*hits\.push/,
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
  assert.match(src, /cat-file',\s*'--batch/, '内容必须走 blob 批读,不是 readFileSync(工作树)')
  // 棘轮锚点=该文件 HEAD 自身,而不是静态清单也不是 0
  assert.equal(gate.splitFresh(new Map([['a.tsx', 70]]), new Map([['a.tsx', 70]])).fresh.length, 0)
  assert.equal(gate.splitFresh(new Map([['a.tsx', 71]]), new Map([['a.tsx', 70]])).fresh.length, 1)
  assert.ok(
    !existsSync(join(ROOT, 'scripts', 'glyph-arrow-icon-baseline.json')),
    '存量已按 HEAD 自计,不得再留静态基线清单(清单过期=门瞎)',
  )
})

test('S0 机制清单必须就是 AGENTS.md 定的"三端唯一实现",且每个条目自带锚点与矢量判据', () => {
  assert.equal(gate.MECHANISMS.length, 3, 'AGENTS.md 定的是三端唯一实现,清单不得自增自减')
  for (const m of gate.MECHANISMS) {
    assert.ok(
      m.symbol && m.icon && m.file && m.note,
      `${m.file || '?'} 缺 symbol/icon/file/note 之一`,
    )
    assert.ok(existsSync(join(ROOT, m.file)), `共享实现已不存在:${m.file}`)
    assert.ok(!/\.test\.|__tests__/.test(m.file), '机制清单不得收录测试夹具')
  }
  // 文档点名的三条路径必须就是清单这三条(按端内相对路径比对,文档写的是 `components/LineIcon/icons.ts` 这种尾段)
  const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')
  for (const m of gate.MECHANISMS) {
    const tail = m.file.split('/').slice(-2).join('/')
    assert.ok(agents.includes(tail), `AGENTS.md 未点名 ${tail} —— 本门在替一份不在文档里的实现背书`)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
