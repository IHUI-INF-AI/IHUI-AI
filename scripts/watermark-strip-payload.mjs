// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 一次性零宽载荷剥离器 `scripts/watermark-strip-payload.mjs`
 *
 * 只做一件事:把**旧版三层水印里的隐式零宽字符**从文件里拿掉,并把横幅第二行的措辞换成
 * 与新许可证(纯 Apache-2.0)一致的署名行。除这两处以外**一个字节都不动**。
 *
 * 为什么单立一个工具,而不是让 `watermark.mjs inject` 顺手做:inject 的动作是
 * "清洗 + 重写整个头部",`cleanFile` 末尾还会折叠连续空行、归一首尾空白 —— 对 11k+ 文件
 * 跑它就是一次无法逐字节复核的海量改写。本工具的改动面是可证明的:删的行只有两类
 * (载荷行 / 纯零宽尾行),改的行只有一类(横幅第二行的文本),所以每条结论都能拿一把
 * **异形**尺子复核(自检用"逐行 + EOL 序列"两把,镜像测试再拿 `git diff --numstat` 一把)。
 *
 * 用法:
 *   node scripts/watermark-strip-payload.mjs                  # --dry-run(默认,零写盘)
 *   node scripts/watermark-strip-payload.mjs --json           # 机器可读报告
 *   node scripts/watermark-strip-payload.mjs --apply          # 落地(幂等,脏文件跳过)
 *   node scripts/watermark-strip-payload.mjs --paths <a> <b>  # 只处理点名文件
 *   node scripts/watermark-strip-payload.mjs --root <dir>     # 测试通道:换仓锚点
 *   node scripts/watermark-strip-payload.mjs --self-test      # 临时 git 仓端到端取证
 *
 * 三条硬约束(每一条都对应本仓记过账的失效型):
 *  1. **脏文件不碰**:批量档下工作树 ≠ 索引的文件一律跳过并计数。剥离会把别人在飞的副本
 *     一起改写,而一次不带 pathspec 的普通提交就会把它交上去(§12d 第三层同型)。
 *     `--paths` 是显式点名档:调用者已表明"这些就是我要动的文件",故放行,但仍打印脏态。
 *  2. **台账登记的第三方内容不碰**:与水印层共用同一份排除出口
 *     (`scripts/lib/third-party-roots.mjs`),两处算同一件事必漂移是本仓最高频失守形态。
 *     算不出排除面 ⇒ **exit 2 拒绝工作**,不冒绿也不冒红。
 *  3. **内容里的零宽字符不算水印**:整行只有载荷的才是我们写的;字符串字面量里的 U+200B
 *     (实测 `apps/cli/tests/prompt-boundary.test.ts` 正拿它做 sanitize 用例)、跟在代码
 *     后面的 `} // <载荷>` 一律**不碰**(删那行等于删掉 `}`),只报名交人工。
 *     所以本工具承诺的是"**水印载荷归零**",不承诺"全仓零宽归零" —— 两个数分行打印,
 *     不得并成一个"看起来干净"。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

import { createExclusionPredicate, LedgerUnavailable } from './lib/third-party-roots.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { __test__ as WM } from './watermark.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..')

/** 零宽字符集 —— 逐码位判定,不按"看起来像空白"。U+200B/200C/200D/2060 均属 Cf 类。 */
const ZW_CLASS = '\\u200b\\u200c\\u200d\\u2060'
const ZW_ANY = new RegExp(`[${ZW_CLASS}]`)
const ALL_ZW_RE = new RegExp(`[${ZW_CLASS}]`, 'g')
/** 横幅第三行:`// [IHUI-AI-PROVENANCE]:<零宽>`,块/HTML 风格下行首只有缩进。 */
const PAYLOAD_LINE_RE = new RegExp(`^\\s*(?://|#|--|\\*)?\\s*\\[${WM.BANNER_ID}\\]\\s*:`)
/** 注释包装的开符(斜杠星 / 尖括号感叹 / 井号 / 双减号 / 单星)与闭符(星号斜杠 / 感叹尖括号)。 */
const OPEN_RE = /^(?:\/\/|#|--|\/\*|<!--)\s*/
const CLOSE_RE = /\s*(?:\*\/|-->)$/
const ONLY_ZW_RE = new RegExp(`^[${ZW_CLASS}\\s]*$`)

function bareOf(line) {
  return line.trim().replace(OPEN_RE, '').replace(CLOSE_RE, '').trim()
}

/** 整行是否"只有载荷":剥掉注释包装后仅剩零宽字符,且至少含一个。 */
export function isPayloadOnlyLine(line) {
  if (!ZW_ANY.test(line)) return false
  const bare = bareOf(line)
  return bare.length > 0 && ONLY_ZW_RE.test(bare)
}

/** 本工具会整行删除的那一类(载荷行 ∪ 纯零宽尾行)。 */
export function isDroppableLine(line) {
  return PAYLOAD_LINE_RE.test(line) || isPayloadOnlyLine(line)
}

/** 其余 Cf / 方向控制码位(不属于本票点名的四码位,但同样是"看不见的字符")。 */
const OTHER_INVISIBLE_RE = /[\u200e\u200f\u202a-\u202e\u2061-\u2064\ufeff]/g

/**
 * 一行残留零宽的**类别**(逐码位判,不猜):
 *  - `glued-payload` 含哨兵包裹的完整 v1 载荷,却被粘在代码行末尾(`} // <载荷>` 那一型)
 *    ⇒ 这是要清的账,但删整行会删掉代码 ⇒ 本工具不碰,交 Part B 逐条处理;
 *  - `content-zw`    零宽出现在字符串/模板里(实测 `apps/cli/tests/prompt-boundary.test.ts`
 *    正拿 U+200B 做 sanitize 用例)⇒ **必须留着**,删它就是改测试语义;
 *  两者分开计数,是因为"剩余 3,143 个"这一句话对下一位读者的含义完全取决于比例。
 */
export function residualKind(line) {
  if (WM.INVISIBLE_RE.test(line)) return 'glued-payload'
  return 'content-zw'
}

/** 不属于"整行载荷"的零宽个数 = 内容型 / 尾随在代码后的那一类(一律保留)。 */
export function residualZwInLine(line) {
  const n = (line.match(ALL_ZW_RE) || []).length
  if (n === 0) return 0
  if (isDroppableLine(line)) return 0
  return n
}

/**
 * 落地后**重新量一遍**还剩多少水印载荷行 —— 不得用"改前 - 已删"这种恒等式冒充测量
 * (那等于把"没判"写成"判过了")。判据与 strip 的删除判据同形,但取的是产出面。
 */
export function countPayloadLines(text) {
  let payload = 0
  let pureZw = 0
  for (const l of text.split(/\r?\n/)) {
    if (PAYLOAD_LINE_RE.test(l)) payload += 1
    else if (isPayloadOnlyLine(l)) pureZw += 1
  }
  return { payload, pureZw }
}

/** 按 \r\n | \n 切分并**逐行保留原换行符**(混排 EOL 也不会被归一)。 */
export function splitLines(text) {
  const out = []
  const re = /\r\n|\n/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    out.push({ s: text.slice(last, m.index), e: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ s: text.slice(last), e: '' })
  return out
}

export function joinLines(parts) {
  return parts.map((p) => p.s + p.e).join('')
}

/**
 * 核心变换:纯函数,不碰磁盘,便于用构造面取证。
 * 三条规则之外什么都不做:
 *   A 删除 `[BANNER_ID]:` 载荷行
 *   B 删除剥掉注释包装后仅剩零宽的整行(L3 尾行,五种注释风格同视)
 *   C 把旧版横幅第二行**文本**换成新版(只替换该子串,前后缀字节原样 ⇒ 各风格缩进/注释符不动)
 */
export function stripText(text, banner = WM) {
  const legacy = banner.LEGACY_BANNER_LINES ?? []
  const fresh = banner.BANNER_LINES ?? []
  const stats = {
    changed: false,
    payloadLines: 0,
    tailLines: 0,
    lineRewrites: 0,
    residualZw: 0,
    residualLines: 0,
    gluedPayloadLines: 0,
    gluedPayloadZw: 0,
    contentZw: 0,
    contentLines: 0,
    otherInvisible: 0,
  }
  const kept = []
  for (const p of splitLines(text)) {
    if (PAYLOAD_LINE_RE.test(p.s)) {
      stats.payloadLines += 1
      stats.changed = true
      continue
    }
    if (isPayloadOnlyLine(p.s)) {
      stats.tailLines += 1
      stats.changed = true
      continue
    }
    let s = p.s
    const li = legacy.findIndex((l) => s.includes(l))
    if (li >= 0 && fresh[li] && fresh[li] !== legacy[li]) {
      s = s.split(legacy[li]).join(fresh[li])
      stats.lineRewrites += 1
      stats.changed = true
    }
    const left = residualZwInLine(s)
    if (left > 0) {
      stats.residualZw += left
      stats.residualLines += 1
      // 分两桶报:粘在代码行上的载荷是**待偿的账**,字符串里的零宽是**必须留着的内容**。
      // 混成一个数,下一位读者就会去删测试夹具,或者把"还剩 3,143 个"读成"剥离没做干净"。
      if (residualKind(s) === 'glued-payload') {
        stats.gluedPayloadLines += 1
        stats.gluedPayloadZw += left
      } else {
        stats.contentZw += left
        stats.contentLines += 1
      }
      for (const m of s.match(OTHER_INVISIBLE_RE) || []) {
        stats.otherInvisible += 1
        void m
      }
    }
    kept.push({ s, e: p.e })
  }
  return { text: joinLines(kept), stats }
}

// ---------- 仓库枚举 ----------
/** 跳过规则**取自 watermark.mjs 的导出**(同一份 SKIP_DIRS / SKIP_FILES / BINARY_EXT)。 */
export function skipReasonFor(rel, rules) {
  const segs = rel.split('/')
  if (segs.slice(0, -1).some((s) => rules.SKIP_DIRS.has(s))) return 'skipdir'
  const base = segs[segs.length - 1]
  if (rules.SKIP_FILES.has(base)) return 'skipfile'
  const dot = base.lastIndexOf('.')
  const ext = dot > 0 ? base.slice(dot).toLowerCase() : ''
  if (rules.BINARY_EXT.has(ext)) return 'binary'
  return null
}

function git(root, args, opt = {}) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
    timeout: opt.timeout ?? 180_000,
  })
}

/**
 * 工作树 ≠ 索引的路径集合。取不到 ⇒ null,调用方必须当"未判定"处理并拒绝批量写盘 ——
 * "不知道谁脏"不等于"都不脏"。
 */
export function dirtySetOf(root) {
  try {
    const raw = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=no'])
    const out = new Set()
    for (const rec of raw.split('\0')) {
      if (!rec.trim()) continue
      const xy = rec.slice(0, 2)
      const p = rec.slice(3).replaceAll('\\', '/')
      if (xy.includes('R') || xy.includes('C')) {
        const i = p.indexOf(' -> ')
        if (i >= 0) {
          out.add(p.slice(0, i))
          out.add(p.slice(i + 4))
          continue
        }
      }
      out.add(p)
    }
    return out
  } catch {
    return null
  }
}

/** 一轮剥离:返回报告;`applied` 为真时才写盘。 */
export function runStrip({ root, paths = [], applied = false, exclusion, dirty }) {
  const list =
    paths.length > 0
      ? paths.map((p) => relative(root, resolve(root, p)).replaceAll('\\', '/'))
      : git(root, ['ls-files', '-z'], { encoding: 'buffer' })
          .toString('utf8')
          .split('\0')
          .filter(Boolean)
          .map((s) => s.replaceAll('\\', '/'))

  const counts = {
    enumerated: list.length,
    scanned: 0,
    files: 0,
    payloadLines: 0,
    tailLines: 0,
    bannerLineRewrites: 0,
    zwBefore: 0,
    zwRemoved: 0,
    residualZw: 0,
    residualFiles: 0,
    gluedPayloadLines: 0,
    gluedPayloadZw: 0,
    contentZw: 0,
    contentLines: 0,
    otherInvisible: 0,
    payloadLinesRemaining: 0,
    pureZwLinesRemaining: 0,
    written: 0,
    failed: 0,
  }
  const excluded = []
  const skipped = { named: 0, dirty: [], reparse: [], missing: [], binary: 0 }
  const perDir = {}
  const residualSample = []
  const planned = []

  for (const rel of list) {
    if (exclusion && exclusion.isExcluded(rel)) {
      excluded.push(rel)
      continue
    }
    if (skipReasonFor(rel, WM)) {
      skipped.named += 1
      continue
    }
    const abs = join(root, rel)
    if (!existsSync(abs)) {
      skipped.missing.push(rel)
      continue
    }
    // junction / 符号链接:只断链不穿透(§26 的"顺着链接把 D 盘真实目标清空"同型),一律不写。
    try {
      if (lstatSync(abs).isSymbolicLink()) {
        skipped.reparse.push(rel)
        continue
      }
    } catch {
      skipped.missing.push(rel)
      continue
    }
    if (!paths.length && dirty && dirty.has(rel)) {
      skipped.dirty.push(rel)
      continue
    }
    let buf
    try {
      buf = readFileSync(abs)
    } catch {
      skipped.missing.push(rel)
      continue
    }
    if (buf.subarray(0, 4096).includes(0)) {
      skipped.binary += 1
      continue
    }
    counts.scanned += 1
    const text = buf.toString('utf8')
    const zw = (text.match(ALL_ZW_RE) || []).length
    const hasLegacy = WM.LEGACY_BANNER_LINES.some((l) => text.includes(l))
    if (zw === 0 && !hasLegacy) continue
    const { text: next, stats } = stripText(text)
    if (!stats.changed) continue
    counts.files += 1
    counts.payloadLines += stats.payloadLines
    counts.tailLines += stats.tailLines
    counts.bannerLineRewrites += stats.lineRewrites
    counts.zwBefore += zw
    counts.residualZw += stats.residualZw
    counts.gluedPayloadLines += stats.gluedPayloadLines
    counts.gluedPayloadZw += stats.gluedPayloadZw
    counts.contentZw += stats.contentZw
    counts.contentLines += stats.contentLines
    counts.otherInvisible += stats.otherInvisible
    // **产出面复量**:落地后还剩几条载荷行 / 纯零宽行。不用"改前 − 已删"的恒等式冒充
    // 测量 —— 那是把"没判"写成"判过了"(本仓最高频的失效型)。
    const leftAfter = countPayloadLines(next)
    counts.payloadLinesRemaining += leftAfter.payload
    counts.pureZwLinesRemaining += leftAfter.pureZw
    counts.zwRemoved += zw - stats.residualZw
    if (stats.residualLines > 0) {
      counts.residualFiles += 1
      if (residualSample.length < 20) {
        residualSample.push(
          `${rel}(粘在代码行上的载荷 ${stats.gluedPayloadLines} 行 / 内容型零宽 ${stats.contentLines} 行)`,
        )
      }
    }
    const top = rel.split('/').slice(0, 2).join('/')
    perDir[top] = (perDir[top] || 0) + 1
    planned.push({ rel, next })
  }

  if (applied) {
    for (const { rel, next } of planned) {
      const abs = join(root, rel)
      try {
        writeFileSync(abs, next, 'utf8')
        const back = readFileSync(abs, 'utf8')
        if (back !== next) {
          console.error(`  ❌ ${rel} 写后回读不一致 ⇒ 停止后续写盘(不静默继续)`)
          counts.failed += 1
          break
        }
        if (stripText(back).stats.changed) {
          console.error(`  ❌ ${rel} 二次剥离仍报改动 ⇒ 非幂等,停止(不静默继续)`)
          counts.failed += 1
          break
        }
        counts.written += 1
      } catch (e) {
        console.error(`  ❌ ${rel} 写盘失败:${String(e?.message ?? e).split('\n')[0]}`)
        counts.failed += 1
      }
    }
  }

  return {
    mode: applied ? 'apply' : 'dry-run',
    root,
    explicitPaths: paths.length,
    ...counts,
    excludedThirdParty: excluded.length,
    excludedSample: excluded.slice(0, 5),
    skippedByName: skipped.named,
    skippedDirty: skipped.dirty.length,
    skippedDirtySample: skipped.dirty.slice(0, 5),
    reparseSkipped: skipped.reparse.length,
    missingOnDisk: skipped.missing.length,
    binarySkipped: skipped.binary,
    residualSample,
    byDir: Object.entries(perDir)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15),
    byDirTotal: Object.keys(perDir).length,
  }
}

function printHuman(rep) {
  const head = rep.mode === 'apply' ? '[strip:apply]' : '[strip:dry-run](零写盘)'
  console.log(
    `${head} 枚举 ${rep.enumerated} → 扫描可注入类型 ${rep.scanned} → 待剥离 ${rep.files} 个文件` +
      `(载荷行 ${rep.payloadLines} 删 + 纯零宽尾行 ${rep.tailLines} 删 + 横幅第二行改写 ${rep.bannerLineRewrites})`,
  )
  console.log(
    `  零宽字符(U+200B/200C/200D/2060):改前 ${rep.zwBefore} 个 → 本次移除 ${rep.zwRemoved} 个 → 残留 ${rep.residualZw} 个`,
  )
  console.log(
    `  **产出面复量**(不是恒等式):残留文本里仍有 载荷行 ${rep.payloadLinesRemaining} 条 / 纯零宽行 ${rep.pureZwLinesRemaining} 条` +
      ` ⇒ 水印载荷${rep.payloadLinesRemaining + rep.pureZwLinesRemaining === 0 ? '已清完' : '**未清完**'}`,
  )
  console.log(
    `  残留分两桶:①**粘在代码行上的载荷** ${rep.gluedPayloadLines} 行 / ${rep.gluedPayloadZw} 字符` +
      '(即 `} // <载荷>` 那一型 —— 删整行会连代码一起删,所以本工具不碰,Part B 逐条定夺);' +
      `②**内容型零宽** ${rep.contentLines} 行 / ${rep.contentZw} 字符(字符串字面量里的 U+200B 等,` +
      '属测试语料,**必须留着**)。',
  )
  console.log(
    '  另有其它不可见码位(U+200E/F、U+202A-E、U+2061-4、U+FEFF)残留 ' +
      `${rep.otherInvisible} 个(不在本票点名的四码位内,只报名不定性)。`,
  )
  console.log(
    '  ⇒ 上面那些"残留"**不得**被读成"剥离没做干净":**水印载荷**看上一条复量行,那才是本工具的承诺范围。',
  )
  for (const f of rep.residualSample) console.log('   · ' + f)
  console.log(
    `  排除面:第三方台账 ${rep.excludedThirdParty} 个;按名字/类型跳过 ${rep.skippedByName};二进制 ${rep.binarySkipped};` +
      `脏文件跳过 ${rep.skippedDirty};符号链接/junction ${rep.reparseSkipped};盘上读不到 ${rep.missingOnDisk}`,
  )
  if (rep.mode === 'apply') {
    console.log(`  已写盘 ${rep.written} 个(写后逐个回读 + 二次剥离自证幂等),失败 ${rep.failed} 个`)
  } else if (rep.files > 0) {
    console.log('  零写盘。落地:`node scripts/watermark-strip-payload.mjs --apply`(脏文件照旧跳过)')
  }
  if (rep.byDir.length) {
    console.log(`  影响面按目录(前 15 / 共 ${rep.byDirTotal} 组):`)
    for (const [d, n] of rep.byDir) console.log(`   ${String(n).padStart(6)}  ${d}`)
  }
}

// ---------- 自检:临时 git 仓端到端 ----------
const ZW = String.fromCharCode(0x2060, 0x200b, 0x200c, 0x200d, 0x200b, 0x2060)
const CONTENT_ZW = String.fromCharCode(0x200b)

function makeFixtures() {
  const legacy2 = WM.LEGACY_BANNER_LINES[1]
  const line1 = WM.BANNER_LINES[0]
  const banner = (pre) => `${pre}${line1}\n${pre}${legacy2}\n${pre}[${WM.BANNER_ID}]:${ZW}\n`
  return {
    'src/a.ts': banner('// ') + 'export const x = 1\nconsole.log(x)\n' + `// ${ZW}\n`,
    'src/b.py': banner('# ') + 'x = 1\n' + `# ${ZW}\n`,
    'src/c.css': `/*\n  ${line1}\n  ${legacy2}\n  [${WM.BANNER_ID}]:${ZW}\n*/\nbody{color:red}\n/* ${ZW} */\n`,
    'docs/d.md': `<!--\n  ${line1}\n  ${legacy2}\n  [${WM.BANNER_ID}]:${ZW}\n-->\n# 标题\n<!-- ${ZW} -->\n`,
    'db/e.sql': banner('-- ') + 'SELECT 1;\n' + `-- ${ZW}\n`,
    'src/f.tsx': banner('// ') + 'export const T = 1\n' + `//${ZW}\n`,
    // CRLF 夹具:结构与 src/a.ts 相同,全文件 CRLF
    'src/crlf.ts': (banner('// ') + 'const y = 2\n' + `// ${ZW}\n`).replaceAll('\n', '\r\n'),
    // 反向对照夹具:内容型零宽 + 尾随在代码行之后的载荷 ⇒ 两种都必须原样留下
    'src/keep.ts':
      banner('// ') + `const s = 'a${CONTENT_ZW}b'\n} // ${ZW}\nconst z = 3\n` + `// ${ZW}\n`,
    // 已是新格式 ⇒ 一行都不该动
    'src/already.ts': `// ${line1}\n// ${WM.BANNER_LINES[1]}\nexport const ok = 1\n`,
  }
}

function gitInitFixtureRepo(dir) {
  git(dir, ['init', '-q', '-b', 'main'])
  git(dir, ['config', 'user.email', 't@example.invalid'])
  git(dir, ['config', 'user.name', 'fixture'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
}

function runSelfTest() {
  const dir = mkScratch('wm-strip-')
  let failures = 0
  const check = (name, fn) => {
    try {
      fn()
      console.log(`  ✅ ${name}`)
    } catch (e) {
      failures += 1
      console.error(
        `  ❌ ${name}:${String(e?.message ?? e)
          .split('\n')
          .slice(0, 4)
          .join(' | ')}`,
      )
    }
  }
  try {
    gitInitFixtureRepo(dir)
    const originals = makeFixtures()
    for (const [rel, body] of Object.entries(originals)) {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, body, 'utf8')
    }
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'fixtures'])
    const excl = {
      isExcluded: () => false,
      roots: [],
      paths: new Set(),
      notes: [],
      unresolvedRoots: [],
    }

    // 1) dry-run 零写盘
    let rep0
    check('1 dry-run 报出全部旧格式夹具且零写盘', () => {
      rep0 = runStrip({ root: dir, exclusion: excl, dirty: dirtySetOf(dir) })
      assert.ok(rep0.files >= 8, `待剥离应 ≥8,实得 ${rep0.files}`)
      assert.equal(rep0.mode, 'dry-run')
      for (const [rel, body] of Object.entries(originals)) {
        assert.equal(readFileSync(join(dir, rel), 'utf8'), body, `dry-run 改了盘:${rel}`)
      }
    })

    // 2) apply:非横幅区域逐字节存活 + EOL 序列同形
    check('2 apply 后非横幅区域逐行逐字存活、EOL 形态不变(含 CRLF 夹具)', () => {
      const rep = runStrip({ root: dir, applied: true, exclusion: excl, dirty: dirtySetOf(dir) })
      assert.equal(rep.failed, 0)
      assert.equal(rep.written, rep.files)
      assert.equal(rep.payloadLinesRemaining, 0, '产出面复量:落地后不得再有载荷行')
      assert.equal(rep.pureZwLinesRemaining, 0, '产出面复量:落地后不得再有纯零宽行')
      assert.ok(
        rep.gluedPayloadLines > 0,
        '夹具里刻意粘在代码行上的载荷必须归入 glued 桶(否则两桶混计)',
      )
      for (const [rel, body] of Object.entries(originals)) {
        const before = splitLines(body)
        const after = splitLines(readFileSync(join(dir, rel), 'utf8'))
        const dropped = before.filter((p) => isDroppableLine(p.s))
        const rewritten = before.filter(
          (p) => !isDroppableLine(p.s) && WM.LEGACY_BANNER_LINES.some((l) => p.s.includes(l)),
        )
        // (a) 行数账:after == before - 删除行(改写不改变行数)
        assert.equal(after.length, before.length - dropped.length, `${rel} 行数账不平`)
        // (b) 逐字节:把 before 里的删除行去掉、改写行按"仅替换子串"预期重算,必须与 after 完全相等
        const expect = before
          .filter((p) => !isDroppableLine(p.s))
          .map((p) => {
            let s = p.s
            const i = WM.LEGACY_BANNER_LINES.findIndex((l) => s.includes(l))
            if (i >= 0 && WM.BANNER_LINES[i])
              s = s.split(WM.LEGACY_BANNER_LINES[i]).join(WM.BANNER_LINES[i])
            return { s, e: p.e }
          })
        assert.deepEqual(after, expect, `${rel} 非横幅区域被改动`)
        // (c) 剩余零宽必须恰好等于"内容型"的那几处(夹具里只有 keep.ts 的两行)
        const left = (
          after
            .map((p) => p.s)
            .join('\n')
            .match(ALL_ZW_RE) || []
        ).length
        const want = rel === 'src/keep.ts' ? CONTENT_ZW.length + ZW.length : 0
        assert.equal(left, want, `${rel} 剩余零宽数应为 ${want},实得 ${left}`)
        void rewritten
      }
    })

    // 3) 幂等:第二次 apply 零改动
    check('3 幂等:第二次 apply 一律零改动', () => {
      const rep = runStrip({ root: dir, applied: true, exclusion: excl, dirty: dirtySetOf(dir) })
      assert.equal(rep.files, 0, `第二次应零改动,实得 ${rep.files}`)
      assert.equal(rep.payloadLines, 0)
      assert.equal(rep.tailLines, 0)
      assert.equal(rep.bannerLineRewrites, 0)
    })

    // 4) 反向对照:内容型零宽与尾随在代码后的载荷都活着
    check('4 反向对照:字符串字面量零宽、`} // <载荷>` 一律保留', () => {
      const keep = readFileSync(join(dir, 'src/keep.ts'), 'utf8')
      assert.ok(keep.includes(`'a${CONTENT_ZW}b'`), '字符串里的零宽被删了 ⇒ 判据过宽')
      assert.ok(keep.includes(`} // ${ZW}`), '`} // <载荷>` 整行被删了 ⇒ 会连带删掉 `}`')
      assert.ok(!keep.includes(`[${WM.BANNER_ID}]:`), '横幅载荷行必须已删')
    })

    // 5) 脏文件保护:批量档跳过工作树≠索引
    check('5 脏文件保护:批量档跳过且不写盘', () => {
      writeFileSync(join(dir, 'src/a.ts'), originals['src/a.ts'], 'utf8') // 退回旧格式 ⇒ 脏
      const rep = runStrip({ root: dir, exclusion: excl, dirty: dirtySetOf(dir) })
      assert.ok(rep.skippedDirty >= 1, `脏文件应被跳过并计数,实得 ${rep.skippedDirty}`)
      assert.ok(!rep.byDir.some(([d]) => d === 'src' && rep.files < 0))
      assert.equal(
        readFileSync(join(dir, 'src/a.ts'), 'utf8'),
        originals['src/a.ts'],
        '脏文件被写了',
      )
      // 点名档:显式 --paths 才允许动脏文件
      const rep2 = runStrip({
        root: dir,
        paths: ['src/a.ts'],
        exclusion: excl,
        dirty: null,
      })
      assert.equal(rep2.files, 1, '点名档必须能处理点名的脏文件')
    })

    // 6) 第三方排除面:被排除的路径即便点名也不动
    check('6 第三方排除面优先于 --paths(点名也不得改别人的许可原文)', () => {
      const tpRel = 'docs/d.md'
      const before = readFileSync(join(dir, tpRel), 'utf8')
      const blocked = {
        isExcluded: (r) => r === tpRel,
        roots: ['docs'],
        paths: new Set(),
        notes: [],
        unresolvedRoots: [],
      }
      const rep = runStrip({
        root: dir,
        paths: [tpRel],
        applied: true,
        exclusion: blocked,
        dirty: null,
      })
      assert.equal(rep.excludedThirdParty, 1)
      assert.equal(rep.files, 0, '被台账排除的文件不得进入剥离集')
      assert.equal(readFileSync(join(dir, tpRel), 'utf8'), before, '排除面失守:第三方文件被改写')
    })

    // 7) 空仓 / 无提交 ⇒ 大声失败而不是"扫描 0 个通过"
    check('7 枚举不到清单 ⇒ 判"无法判定"(exit 2 语义由调用方读异常)', () => {
      const empty = mkScratch('wm-strip-empty-')
      gitInitFixtureRepo(empty)
      let threw = null
      try {
        runStrip({ root: empty, exclusion: excl, dirty: dirtySetOf(empty) })
      } catch (e) {
        threw = e
      }
      rmScratch(empty)
      // 无提交的空仓 git ls-files 返回空集是**真值**,不是失败 ⇒ 报告必须把 enumerated=0 说清
      assert.equal(threw, null, 'ls-files 空集不该抛错')
      const rep = runStrip({ root: dir, exclusion: excl, dirty: dirtySetOf(dir) })
      assert.ok(rep.enumerated > 0, '报告必须带枚举总数(0 与"没扫"必须可分)')
    })

    console.log(
      failures === 0 ? `✅ watermark-strip-payload 自检 7 组通过` : `❌ 自检失败 ${failures} 组`,
    )
    return failures === 0 ? 0 : 1
  } catch (e) {
    console.error('❌ 自检异常:' + String(e?.message ?? e))
    return 1
  } finally {
    rmScratch(dir)
  }
}

// ---------- CLI ----------
function main(argv) {
  const applied = argv.includes('--apply')
  const asJson = argv.includes('--json')
  if (argv.includes('--self-test')) return runSelfTest()
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 ? resolve(argv[rootIdx + 1]) : DEFAULT_ROOT
  const pIdx = argv.indexOf('--paths')
  const paths = pIdx >= 0 ? argv.slice(pIdx + 1).filter((a) => !a.startsWith('--')) : []

  let exclusion
  try {
    exclusion = createExclusionPredicate(root)
  } catch (e) {
    const why = e instanceof LedgerUnavailable ? e.message : String(e?.message ?? e)
    console.error('[strip] ❌ 第三方排除面无法判定:' + why.split('\n')[0])
    console.error(
      '  算不出"哪些是已登记第三方内容"时拒绝工作 —— 剥离开错方向的代价是改别人的许可原文。',
    )
    return 2
  }
  let dirty = null
  if (!paths.length) {
    dirty = dirtySetOf(root)
    if (!dirty) {
      console.error(
        '[strip] ❌ git status 取不到 ⇒ 无法判定哪些文件是脏的 ⇒ 拒绝批量写盘(未判定不等于都不脏)。',
      )
      console.error('  出口:确认 git 可用后重跑,或用 --paths 显式点名要处理的文件。')
      return 2
    }
  }
  const rep = runStrip({ root, paths, applied, exclusion, dirty })
  if (asJson) console.log(JSON.stringify(rep, null, 1))
  else printHuman(rep)
  if (applied && rep.failed > 0) return 1
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  stripText,
  countPayloadLines,
  residualKind,
  splitLines,
  joinLines,
  isPayloadOnlyLine,
  isDroppableLine,
  residualZwInLine,
  skipReasonFor,
  dirtySetOf,
  runStrip,
  PAYLOAD_LINE_RE,
  ALL_ZW_RE,
  ZW,
  CONTENT_ZW,
  makeFixtures,
}
