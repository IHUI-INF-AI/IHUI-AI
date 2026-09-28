// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// `scripts/lib/code-mask.mjs` 的常驻回归(§22c:本文件**只 import 生产实现**,一条判据都不重写)。
//
// 为什么必须有它(2026-09-28 上收守门 118 私有遮噪器那一票的承重墙):
//   遮噪层被十几道门共用(131 / 135 / 148 / 150 / 156 …),而那次上收的**硬约束**是
//   "旧导出的字节级行为不得变" —— 改了就是替别人的门在无人预期时换读数。这种"必须逐字节
//   同形"的承诺,靠"我跑过了"不算证据:它必须有一个**历史参照件**当场比。
//   所以下面 `legacyMaskCommentsAndStrings` 是改前那份实现的**逐字快照**(禁止演进 ——
//   它一旦跟着生产实现改,这条回归就退化成自我确认;形态同
//   `apps/cli/tests/fixtures/toJsonProperty.legacy.ts` 那一条规矩)。
//
// 语料取**本机 scripts/ 下的 .mjs 全文**:这里比的是"同一个纯函数在同一个输入上输出是否等值",
// 不是"仓库某一面是什么" ⇒ 与被审面纪律无关(两侧输入完全同一份,不存在混面)。
//
// 跑法:node --test scripts/tests/code-mask.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  blankStrings,
  maskedSpans,
  maskComments,
  maskCommentsAndStrings,
  maskCommentsStringsAndRegex,
  regexCanStart,
  scanLiterals,
  scanSpans,
} from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

/** 改前那份实现的**逐字快照**(2026-09-28 之前的 `maskCommentsAndStrings`)。禁止演进。 */
function legacyMaskCommentsAndStrings(src) {
  if (typeof src !== 'string') return ''
  const out = src.split('')
  let i = 0
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '
  }
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (c === '/' && n === '/') {
      let j = src.indexOf('\n', i)
      if (j < 0) j = src.length
      blank(i, j)
      i = j
      continue
    }
    if (c === '/' && n === '*') {
      let j = src.indexOf('*/', i + 2)
      j = j < 0 ? src.length : j + 2
      blank(i, j)
      i = j
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < src.length) {
        if (src[j] === '\\') {
          j += 2
          continue
        }
        if (src[j] === c) {
          j++
          break
        }
        // 未闭合的引号不当字符串(防整文件被吞)
        if (src[j] === '\n' && c !== '`') break
        j++
      }
      blank(i, j)
      i = j
      continue
    }
    i++
  }
  return out.join('')
}

function corpus() {
  const listed = execFileSync(
    'git',
    ['-c', 'safe.directory=*', '-C', ROOT, 'ls-files', 'scripts'],
    { encoding: 'utf8', maxBuffer: 32 << 20, windowsHide: true },
  )
    .split('\n')
    .filter((p) => /\.mjs$/.test(p))
  const files = []
  for (const rel of listed) {
    try {
      files.push({ rel, text: readFileSync(join(ROOT, rel), 'utf8') })
    } catch {
      // 工作树里可能没有(别人删了没提交),跳过并如实由下一条断言控制下限
    }
  }
  return files
}

test('M1 兼容导出与历史快照逐字节同形(上收不得替别人的门换读数)', () => {
  const files = corpus()
  assert.ok(files.length >= 100, `语料只有 ${files.length} 份,这条回归等于没跑`)
  let differ = 0
  const names = []
  for (const f of files) {
    if (legacyMaskCommentsAndStrings(f.text) !== maskCommentsAndStrings(f.text)) {
      differ += 1
      if (names.length < 5) names.push(f.rel)
    }
  }
  assert.equal(differ, 0, `兼容导出换了字节级行为:${differ} 份不等,样例 ${names.join(', ')}`)
})

test('M2 两档的分界可测:正则体在新档被遮、在兼容档逐字留着(阳性对照)', () => {
  // 真语料见证:两档在大量真实文件上给出不同读数 ⇒ "新档其实没认正则"这一型不可能悄悄成立
  const differ = corpus().filter(
    (f) => maskCommentsAndStrings(f.text) !== maskCommentsStringsAndRegex(f.text),
  ).length
  assert.ok(differ >= 50, `真仓语料里两档只有 ${differ} 份不等 ⇒ 新档可能根本没生效`)
  // 构造面:为什么守门 156 需要新档 —— 正则体里那个未配对的 `(` 会污染"按括号配平取实参"
  const src = 't(\n  "name",\n  /\\(/.test(s),\n)\n'
  const bal = (x) => (x.match(/\(/g) || []).length - (x.match(/\)/g) || []).length
  const legacy = maskCommentsAndStrings(src)
  const strict = maskCommentsStringsAndRegex(src)
  assert.ok(bal(legacy) > 0, '兼容档把正则里的 `(` 当代码 ⇒ 开括号凭空多一个(156 的"配不平"就是这么来的)')
  assert.equal(bal(strict), 0, '新档必须遮掉正则体让配平恢复,否则那 3 处未判定收不掉')
  // 反向:真调用与真字符串不得因为"更聪明"而被吞掉
  assert.ok(strict.includes('.test('), '正则之后的真代码必须逐字可见')
  assert.ok(!strict.includes('name'), '字符串照旧要遮,两档在这一点上没有区别')
})

test('M3 两个导出都等长且行数不漂(各门按行回溯归属的坐标不能动)', () => {
  for (const src of corpus().slice(0, 40).map((f) => f.text)) {
    for (const fn of [maskCommentsAndStrings, maskCommentsStringsAndRegex]) {
      const m = fn(src)
      assert.equal(m.length, src.length, '遮罩改变了长度 ⇒ 列位与偏移全部漂移')
      assert.equal(m.split('\n').length, src.split('\n').length, '遮罩吞掉了换行')
    }
  }
})

test('M4 遮噪是一台分词器的投影,不是各写一遍(§22c 反向锁的源面)', () => {
  const lib = readFileSync(join(ROOT, 'scripts', 'lib', 'code-mask.mjs'), 'utf8')
  assert.equal((lib.match(/function scanSpans\(/g) || []).length, 1, '分词器必须只有一台')
  assert.equal((lib.match(/function readStringSpan\(/g) || []).length, 1, '字符串扫描只能有一份')
  assert.equal((lib.match(/function readRegexSpan\(/g) || []).length, 1, '正则扫描只能有一份')
  // 兼容档走 regex:false(关掉正则档的同一次分词),新档把 regex 收进 span 集合 —— 两档的**档**
  // 必须能被机器看见;谁把 regex:false 顺手改成默认,十几道共用旧导出的门就会同时换读数。
  assert.match(lib, /blankSpans\(src, \['line', 'block', 'string'\], \{ regex: false \}\)/)
  assert.match(lib, /blankSpans\(src, \['line', 'block', 'string', 'regex'\]\)/)
  // 不得再留着第二台朴素 while 状态机(它就是 24 道门被判 no-content 的那台)
  assert.doesNotMatch(lib, /while \(i < src\.length\) \{/, 'lib 里不得有第二台独立状态机')
})

test('M5 blankStrings 必须是 scanLiterals 的一行投影(分叉成第二台 ⇒ 一半判定重新变盲)', () => {
  const src = 'const re = /["\']/g\nconst s = "abc"\n// c\n'
  assert.equal(blankStrings(src), scanLiterals(src).blanked)
})

test('M6 maskComments 只遮注释、保留字符串;注释里的正则形态不得留在代码面', () => {
  const src =
    "import { catBatch } from './lib/face-reader.mjs'\n" +
    "// 建议改成 from './lib/other.mjs'\n" +
    "const re = /['\"]/g\n"
  const masked = maskComments(src)
  assert.ok(masked.includes("from './lib/face-reader.mjs'"), '模块说明符本身就是字符串,不得被遮掉')
  assert.ok(!masked.includes("from './lib/other.mjs'"), '注释里的提及不得被读成装车(放行方向的红)')
  assert.ok(masked.includes('/'), '正则不在本档射程(它服务的是"字符串要保留"那一侧)')
})

test('M7 正则档的两头都钉住:真除法不得开正则状态,认得出的正则体必须被遮', () => {
  assert.equal(
    scanSpans('const q = a / b / c\nconst r = d / e\n').filter((s) => s.kind === 'regex').length,
    0,
    '把除法当正则 ⇒ 遮噪面被扩大,判据开始看不见真 token',
  )
  assert.equal(
    scanSpans('const q = a / b / c\n', { regex: false }).filter((s) => s.kind === 'regex').length,
    0,
  )
  const rx = scanSpans('const re = /readFileSync\\(join\\(ROOT/g\n')
  assert.equal(rx.length, 1, '正则字面量必须被识别成一个 span')
  assert.equal(rx[0].kind, 'regex')
  assert.ok(
    !/readFileSync\s*\(/.test(maskCommentsStringsAndRegex('const re = /readFileSync\\(join\\(ROOT/g\n')),
    '正则体内的假调用必须不可见,否则 M2 的绿只是"遮罩整体关掉"的假象',
  )
})

test('M8 regexCanStart 的两侧:关键字之后必为正则,`)` 与标识符之后按除法', () => {
  assert.equal(regexCanStart('', 'return'), true, 'return /x/ 按除法就是**看不见**,不是保守')
  assert.equal(regexCanStart('(', ''), true)
  assert.equal(regexCanStart(')', ''), false, ') 之后是除法/取模,判成正则就吞掉真 token')
  assert.equal(regexCanStart('e', 'name'), false)
})

test('M9 非字符串入参一律返回空串(兼容档的历史形态,新档同形)', () => {
  for (const v of [undefined, null, 42, {}]) {
    assert.equal(maskCommentsAndStrings(v), '')
    assert.equal(maskCommentsStringsAndRegex(v), '')
  }
})

test('M11 `maskedSpans` 的区间清单与历史朴素走法逐字节同形(守门 150 的 jsx-scope 靠它分诊)', () => {
  // 同一份规矩的第二格:2026-09-28 并发会话给 `maskedSpans` 定了对外契约(JSX 扫描要区分
  // "被抹的是字符串还是注释")。上收后它是 `scanSpans(src,{regex:false})` 的投影,所以这里
  // 钉的是**投影没换区间语义** —— 清单漂了,150 的注释/字符串分诊就会静默改判,而账面照样绿。
  const legacySpans = (src) => {
    const spans = []
    if (typeof src !== 'string') return spans
    let i = 0
    while (i < src.length) {
      const c = src[i]
      const n = src[i + 1]
      if (c === '/' && n === '/') {
        let j = src.indexOf('\n', i)
        j = j < 0 ? src.length : j
        spans.push({ start: i, end: j, kind: 'comment' })
        i = j
        continue
      }
      if (c === '/' && n === '*') {
        let j = src.indexOf('*/', i + 2)
        j = j < 0 ? src.length : j + 2
        spans.push({ start: i, end: j, kind: 'comment' })
        i = j
        continue
      }
      if (c === '"' || c === "'" || c === '`') {
        let j = i + 1
        while (j < src.length) {
          if (src[j] === '\\') {
            j += 2
            continue
          }
          if (src[j] === c) {
            j++
            break
          }
          if (src[j] === '\n' && c !== '`') break
          j++
        }
        spans.push({ start: i, end: j, kind: 'string' })
        i = j
        continue
      }
      i++
    }
    return spans
  }
  const files = corpus()
  assert.ok(files.length >= 100, `语料只有 ${files.length} 份,这条回归等于没跑`)
  let differ = 0
  for (const f of files) {
    if (JSON.stringify(legacySpans(f.text)) !== JSON.stringify(maskedSpans(f.text))) differ += 1
  }
  assert.equal(differ, 0, `maskedSpans 的区间清单漂了 ${differ} 份文件`)
})

test('M10 消费方接线锁:守门 156 必须真的改用认正则那一档(改了 lib 而没人用 = 上收白做)', () => {
  const gate = readFileSync(
    join(ROOT, 'scripts', 'check-selftest-registrant-evaluates.mjs'),
    'utf8',
  )
  assert.match(gate, /maskCommentsStringsAndRegex/, '156 没引新档 ⇒ 它那 3 处未判定永远收不掉')
  assert.doesNotMatch(
    gate,
    /function\s+maskCommentsStringsAndRegex\s*\(/,
    '156 不得自带第二份遮罩实现',
  )
  // 上收的另一半:118 只许留判据
  const g118 = readFileSync(join(ROOT, 'scripts', 'check-gate-face-discipline.mjs'), 'utf8')
  assert.match(g118, /from '\.\/lib\/code-mask\.mjs'/, '118 必须引这一层')
  for (const def of ['scanSpans', 'readStringSpan', 'readRegexSpan', 'maskComments', 'blankStrings']) {
    assert.ok(
      !new RegExp(`function ${def}\\s*\\(`).test(g118),
      `118 里还留着 \`function ${def}(\` —— 遮噪器必须住在 lib,不得再分叉第二台`,
    )
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
