// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 根护栏「清单 ↔ 内容」一致性对账(守门 266,blocking;跳过 `HUSKY_SKIP_ROOT_GUARD_CONSISTENCY=1`)。
 *
 * ## 这道门拦什么(2026-10-29/30 一夜两红的实测复盘,不是假想需求)
 *
 * `scripts/root-guard.mjs` 读 `scripts/data/root-guard-manifest.json`,把三个**判据面文件**
 * (guardian-runner / judgement-libs / agents-ironlaw)的 sha256 钉成封条;不一致 ⇒ 部署环 fail-closed。
 * 一夜之间它红了两次,**两次都不是入侵,而是同一个结构性缺陷:清单落后于被审内容,而提交链里
 * 没有任何一把尺子判这件事**:
 *   第一型 2026-10-29 有人改了 `scripts/guardian-runner.mjs` 入库,没同批重封清单 ⇒ 三处签出
 *           (本地/生产/远端)`--check` 全红,部署环每轮停在护栏,连 `fetch` 都走不到。
 *   第二型 07:34 提交 `5265a3a294` 又改了 `guardian-runner.mjs`(只改注册条目的**文案**),清单再次
 *           落后 ⇒ `expected=ea633dc642d3 actual=38c56e861951`,**main 自带不一致**,所有签出再次停摆。
 *
 * `check-immutable-guard.mjs` 拦不住这一型:它只要求提交信息里带 `immutable-exempt: <理由>`,
 * **不要求清单跟上**,而且它刻意不进提交链。
 *
 * ## 为什么这不与 root-guard 本体重复(§0.6;退役件 check-guardrail-hashes 的教训在前)
 *
 * 同三目标、同机制 ≠ 同判据。差的是**取材面**:
 *   · `root-guard --check` 取的是**工作树**(磁盘字节)。盘上那份自洽 ⇒ 它就绿 —— 可它绿的时候
 *     索引与 HEAD 完全可以对不上(正是第二型:一枚提交把规则文件推进 HEAD,清单仍绑旧值)。
 *   · 本门取的是**被审面**(全量 = HEAD blob,`--staged` = 索引 blob),判"这一枚要入库的内容
 *     自己是否带着跟得上的封条"。第二型那种提交会在**提交当场**翻红,而不是等下一次部署才发现。
 *
 * 哈希与 section 取值**一律 import `scripts/root-guard.mjs` 已有的实现**(`hashTarget` /
 * `loadManifest` / `REQUIRED_TARGET_IDS`),本文件**零**自写哈希原语、**零**自写区间截取 ——
 * 同仓两把尺必然漂移,而这两把尺一旦漂开,封条与判条说的就不是同一件事(镜像测试有一枚形状锁
 * 直接钉这一点;形状锁的禁语按拆字拼接构造,理由写在那一处)。
 *
 * ## 判据(绝对判据,不是差值棘轮)
 *
 *   对清单里每一个 target,按其 `mode` 在被审面取内容并算哈希:
 *     · `file`    ⇒ 整文件规范化后的 sha256 必须逐字等于清单值;
 *     · `section` ⇒ 走 root-guard 同一把 `extractSection` 尺(改区间外的字不该动封条,
 *                    改区间内的字必须重封 —— 这两向都由 hashTarget 决定,本门不复算)。
 *
 *   任一 target 不等 ⇒ 逐条点名(id / path / 清单值前 12 / 实际值前 12)⇒ **exit 1**;
 *   清单少掉 root-guard 自己登记的必备 id ⇒ 射程缩水,同样 **exit 1**(后门与漏封同罪);
 *   清单取不到 / JSON 形状坏 / targets 为空 / 登记的 path 在被审面不存在 / 铁律段锚点失踪
 *     ⇒ **exit 2 未判定**并点名原因(§0.3:没判绝不写成判过,也绝不退化成"只报数")。
 *
 *   判序与 root-guard 本体一致(单一口径,不各定一套):**未判定 > 红 > 绿** —— 读不到内容时
 *   说"判不了"比说"有人改了规则"更如实。
 *
 * ## 取材面纪律(§0.4)
 *
 *   全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;
 *   `--staged` 与 `--worktree` 同给 ⇒ exit 2(`selectFace` 单源);取不到**不回落另一个面**。
 *   清单先取(它决定目标集),目标一批取完 —— 两面都在同一个被审面、同一轮进程内取,
 *   中途不得换面。
 *
 * ## 修法只有一条(判红时点名)
 *
 *   `node scripts/root-guard.mjs --seal --reason "<写清这次为什么重封>"`,并让**清单与被改的规则
 *   文件同枚提交并推送**。`git checkout -- <path>` 还原工作树不解决问题(差面判读已实证过一次)。
 *
 * CLI:
 *   node scripts/check-root-guard-consistency.mjs                 # 全量:判 HEAD 面
 *   node scripts/check-root-guard-consistency.mjs --staged        # 提交链:判索引面
 *   node scripts/check-root-guard-consistency.mjs --worktree      # 人工排查(不作提交判据)
 *   node scripts/check-root-guard-consistency.mjs --json
 *   node scripts/check-root-guard-consistency.mjs --self-test     # 真跑 git 夹具,含"摘掉即翻红"成对
 *
 * 镜像测试(§22c:判据 import 本文件 `__test__`,测试里不复制第二份):
 *   node --test scripts/tests/check-root-guard-consistency.test.mjs
 *
 * 退出码:0 = 清单与被审面逐条一致;1 = 至少一条不等(或射程缩水);2 = 未判定。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// §0.6 判据单源:哈希口径与 section 区间求法只有 root-guard.mjs 这一份,本文件不重写。
// (sha256Of / extractSection 只被**自检夹具**用来造封条;判据本体走 hashTarget,见 ST15 形状锁。)
import {
  MANIFEST_PATH,
  REQUIRED_TARGET_IDS,
  extractSection,
  hashTarget,
  loadManifest,
  sha256Of,
} from './root-guard.mjs'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

/** 仓根由脚本自身位置推导,禁 `process.cwd()`(§15:共享工作区 cwd 不可靠,守门 70 同型)。 */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 清单相对路径由 root-guard 的绝对出口反推 —— 不在本文件再写一遍路径(§0.6)。 */
export const MANIFEST_REL = relative(ROOT, MANIFEST_PATH).replace(/\\/g, '/')

export const SELF_SKIP = 'HUSKY_SKIP_ROOT_GUARD_CONSISTENCY'

export const EXIT_OK = 0
export const EXIT_BREACH = 1
export const EXIT_UNDETERMINED = 2

/** 点名字符串只截前 12 位:整条 sha 会把报告撑成不可读的一屏,而判红要的只是"对没对上"。 */
export const SHA_HEAD = 12

/** 绝对路径 → 相对被审根的正斜杠路径(hashTarget 给 readFile 的是绝对路径)。 */
export function relFromRoot(abs, root = ROOT) {
  return relative(root, abs).replace(/\\/g, '/')
}

/**
 * hashTarget 要的 readFile 适配器:被审面取不到 ⇒ **抛**,绝不返回 null 或空串。
 * 返回空串会让 `sha256Of('')` 算出一个"看起来很正常"的哈希(假绿/假红的第三种状态),
 * 而抛错被 hashTarget 折成 `{ok:false}` ⇒ 上层落 exit 2「未判定」(§0.3)。
 */
export function makeTargetReader(readTarget, root = ROOT) {
  return (abs) => {
    const rel = relFromRoot(abs, root)
    let text
    try {
      text = readTarget(rel)
    } catch (e) {
      if (e instanceof Undetermined) throw e
      throw new Undetermined(`被审面读取 ${rel} 失败:${e?.message ?? e}`)
    }
    if (text === null || text === undefined) {
      throw new Undetermined(`被审面没有 ${rel}`)
    }
    return text
  }
}

/**
 * 纯判据(零 IO,可被构造面逐格钉):清单里每条 target 的哈希 vs 被审面内容。
 * 取值全部交给 `hashTarget`(root-guard 那份),本函数只判等与分档。
 * @param {{manifest:object, readFile:Function, root?:string}} p
 * @returns {{exit:number, code:string, rows:Array, missingRequired:string[]}}
 */
export function evaluateTargets({ manifest, readFile, root = ROOT }) {
  const rows = []
  let sawUnknown = false
  for (const t of manifest.targets) {
    const h = hashTarget(t, readFile, root)
    if (!h.ok) {
      sawUnknown = true
      rows.push({
        id: t.id,
        path: t.path,
        mode: t.mode,
        state: 'unknown',
        expected: t.sha256,
        actual: null,
        why: h.why,
      })
      continue
    }
    rows.push({
      id: t.id,
      path: t.path,
      mode: t.mode,
      state: h.sha256 === t.sha256 ? 'pass' : 'fail',
      expected: t.sha256,
      actual: h.sha256,
      bytes: h.bytes,
      why: '',
    })
  }
  // 射程缩水:root-guard 自己声明的必备 id 在清单里没了 ⇒ 那一面从此无人封条(与漏封同罪,判红)。
  // 必备集 import 自 root-guard(不写第二份),两边同改才不会各说各话。
  const missingRequired = REQUIRED_TARGET_IDS.filter(
    (id) => !manifest.targets.some((t) => t.id === id),
  )
  const sawFail = rows.some((r) => r.state === 'fail') || missingRequired.length > 0
  // 判序与 root-guard 的 checkAll 一致:未判定 > 红 > 绿。
  const exit = sawUnknown ? EXIT_UNDETERMINED : sawFail ? EXIT_BREACH : EXIT_OK
  const code = sawUnknown
    ? 'unjudged'
    : missingRequired.length > 0
      ? 'target-missing'
      : sawFail
        ? 'stale-manifest'
        : 'consistent'
  return { exit, code, rows, missingRequired }
}

/**
 * 按被审面构造目标读取器:一批 cat-file --batch 读完(同轮),missing 一律回 null(上层抛 ⇒ 未判定)。
 * `worktree` 档逐文件读盘 —— 它是人工逃生舱,不作提交判据。
 */
export function buildTargetReader(root, face, rels) {
  if (face === 'worktree') return (rel) => readWorktreeFile(root, rel)
  const keyOf = (rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`)
  const specs = [...new Set(rels.map(keyOf))]
  const got = catBatch(root, specs, { timeout: 120000 })
  return (rel) => got.get(keyOf(rel)) ?? null
}

/** 清单文本本身也取被审面(与目标同面;取不到 ⇒ null ⇒ 未判定,绝不回落工作树)。 */
export function readManifestText(root, face) {
  return buildTargetReader(root, face, [MANIFEST_REL])(MANIFEST_REL)
}

/**
 * 一整个判定面:清单 → 目标集 → 同面一批取内容 → 纯判据。
 * 任何一步取不到/形状坏 ⇒ exit 2 并点名,不猜、不回落、不只报数。
 */
export function runFace(root, face) {
  const base = { face, exit: EXIT_UNDETERMINED, code: 'manifest-missing', rows: [], missingRequired: [], why: '' }
  let manifestText
  try {
    manifestText = readManifestText(root, face)
  } catch (e) {
    if (e instanceof Undetermined) return { ...base, code: 'face-missing', why: e.message }
    throw e
  }
  if (manifestText === null) {
    return { ...base, why: `清单在被审面不存在:${MANIFEST_REL}(face=${face})` }
  }
  let manifest
  try {
    manifest = loadManifest(manifestText)
  } catch (e) {
    return { ...base, code: 'manifest-shape', why: String(e?.message ?? e) }
  }
  const rels = manifest.targets.map((t) => t.path)
  let readTarget
  try {
    readTarget = buildTargetReader(root, face, rels)
  } catch (e) {
    if (e instanceof Undetermined) return { ...base, code: 'face-missing', why: e.message }
    throw e
  }
  const out = evaluateTargets({ manifest, readFile: makeTargetReader(readTarget, root), root })
  return { ...out, why: '' }
}

/** 人读输出:判红逐条点名 + 唯一那条修法;未判定点名缺了哪个输入。 */
export function formatReport(out) {
  const head = `[root-guard-consistency face=${out.face}] code=${out.code}`
  const lines = []
  const fails = out.rows.filter((r) => r.state === 'fail')
  const unknowns = out.rows.filter((r) => r.state === 'unknown')
  if (out.exit === EXIT_OK) {
    lines.push(`✅ ${head} 清单 ${out.rows.length} 条与被审面逐条一致`)
  } else if (out.exit === EXIT_BREACH) {
    lines.push(`❌ ${head} 根护栏清单与被审面对不上 ⇒ 部署环将 fail-closed`)
    for (const r of fails) {
      lines.push(
        `   - ${r.id}  ${r.path} (mode=${r.mode})  清单=${r.expected.slice(0, SHA_HEAD)} 被审面=${(r.actual ?? '-').slice(0, SHA_HEAD)}`,
      )
    }
    for (const id of out.missingRequired) {
      lines.push(`   - 射程缩水:清单里没有 root-guard 登记的必备目标 ${id} ⇒ 那一面已无人封条`)
    }
    lines.push(
      `   怎么修:node scripts/root-guard.mjs --seal --reason "<写清这次为什么重封>",` +
        `并把**清单与被改的规则文件同枚提交并推送**(缺后半句就是下一次红)。` +
        `先复核被审面那份改动是不是你要交的:` +
        `git show HEAD:${MANIFEST_REL} 对比 git show HEAD:<target path>。`,
    )
  } else {
    lines.push(`❌ 未判定 ${head}`)
    if (out.why) lines.push(`   - ${out.why}`)
    for (const r of unknowns) lines.push(`   - ${r.id}  ${r.path} —— ${r.why}`)
    lines.push('   为什么不判绿也不判红:取不到输入按 §0.3 只能是「未判定」(§12e:恒红门的唯一结局是逼人 --no-verify)。')
  }
  lines.push(
    `[root-guard-consistency] 面=${out.face} 清单条数=${out.rows.length} / 一致=${out.rows.filter((r) => r.state === 'pass').length} / 不等=${fails.length} / 未判定=${unknowns.length} / 必备缺席=${out.missingRequired.length}`,
  )
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 自检:真跑 git 夹具(§22c 行为只能靠构造面证明;夹具落 mkScratch,§15b/守门 208)
// ---------------------------------------------------------------------------

const MD_BASE = '# t\n\n## 0. 全局铁律\nA\nB\n\n## 1. 其它\nC\n'

function writeIn(root, rel, text) {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

function seedRepo(files) {
  const root = mkScratch('rgconsistency-st-')
  gitRaw(['init', '-q', '-b', 'main'], root)
  gitRaw(['config', 'user.email', 'selftest@example.invalid'], root)
  gitRaw(['config', 'user.name', 'selftest'], root)
  gitRaw(['config', 'commit.gpgsign', 'false'], root)
  // 本仓实测过 core.hooksPath 指向不存在目录 ⇒ 静默跑 0 个钩子;夹具同样显式钉死"无钩子"。
  gitRaw(['config', 'core.hooksPath', '.git/no-hooks'], root)
  for (const [rel, text] of Object.entries(files)) writeIn(root, rel, text)
  gitRaw(['add', '-A'], root)
  gitRaw(['commit', '--no-verify', '-q', '-m', 'baseline'], root)
  return root
}

function commitTree(root, files, msg = 'change') {
  for (const [rel, text] of Object.entries(files)) writeIn(root, rel, text)
  gitRaw(['add', '-A'], root)
  gitRaw(['commit', '--no-verify', '-q', '-m', msg], root)
}

/** 夹具造封条:值一律由 root-guard 那两把尺(sha256Of / extractSection)算出,本文件不造第三条。 */
function manifestDoc(entries) {
  return `${JSON.stringify({ version: 1, targets: entries }, null, 2)}\n`
}

function fixtureFiles(overrides = {}) {
  return {
    [MANIFEST_REL]: manifestDoc([]),
    'scripts/guardian-runner.mjs': '// baseline runner\n',
    'scripts/lib/judgement-libs.json': '{"libs":["x"]}\n',
    'AGENTS.md': MD_BASE,
    ...overrides,
  }
}

function baseManifestEntries() {
  return [
    {
      id: 'guardian-runner',
      path: 'scripts/guardian-runner.mjs',
      mode: 'file',
      sha256: sha256Of('// baseline runner\n'),
    },
    {
      id: 'judgement-libs',
      path: 'scripts/lib/judgement-libs.json',
      mode: 'file',
      sha256: sha256Of('{"libs":["x"]}\n'),
    },
    {
      id: 'agents-ironlaw',
      path: 'AGENTS.md',
      mode: 'section',
      start: '## 0. 全局铁律',
      sha256: sha256Of(extractSection(MD_BASE, '## 0. 全局铁律')),
    },
  ]
}

export function selfTest() {
  const cases = []
  const ok = (name, cond, detail = '') => cases.push({ name, ok: Boolean(cond), detail })
  const run = (fn, files) => {
    const root = seedRepo(files)
    try {
      return fn(root)
    } finally {
      try {
        rmScratch(root, { bestEffort: true })
      } catch {
        /* 清理失败不得改写判据结论 */
      }
    }
  }
  const judged = (root, face = 'head') => {
    try {
      return runFace(root, face)
    } catch (e) {
      return { exit: 99, code: 'threw', rows: [], missingRequired: [], why: String(e?.message ?? e) }
    }
  }

  const good = fixtureFiles({ [MANIFEST_REL]: manifestDoc(baseManifestEntries()) })

  // ST1 清单与被审面逐条一致 ⇒ 绿
  run((root) => {
    const out = judged(root)
    ok(
      'ST1 三面一致 ⇒ exit 0 / consistent',
      out.exit === 0 && out.code === 'consistent' && out.rows.every((r) => r.state === 'pass'),
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  }, good)

  // ST2 5265a3a294 那一型:规则文件被改一个字节并提交、清单没跟上 ⇒ 红且点名该 id
  run((root) => {
    commitTree(root, { 'scripts/guardian-runner.mjs': '// baseline runner\n// 改一个字节\n' })
    const out = judged(root)
    ok(
      'ST2 改 guardian-runner 未重封清单 ⇒ exit 1 且点名 guardian-runner',
      out.exit === 1 &&
        out.code === 'stale-manifest' &&
        out.rows.some((r) => r.id === 'guardian-runner' && r.state === 'fail'),
      JSON.stringify({ exit: out.exit, code: out.code, rows: out.rows.map((r) => [r.id, r.state]) }),
    )
  }, good)

  // ST3 反向对照:同一枚改动 + 同批重封的清单 ⇒ 绿(证明红的成因是"清单落后",不是"文件被改")
  run((root) => {
    const newRunner = '// baseline runner\n// 改一个字节\n'
    commitTree(root, {
      'scripts/guardian-runner.mjs': newRunner,
      [MANIFEST_REL]: manifestDoc([
        ...baseManifestEntries().map((t) =>
          t.id === 'guardian-runner' ? { ...t, sha256: sha256Of(newRunner) } : t,
        ),
      ]),
    })
    const out = judged(root)
    ok(
      'ST3 同枚提交带上重封清单 ⇒ exit 0(成对反向牙)',
      out.exit === 0 && out.code === 'consistent',
      JSON.stringify({ exit: out.exit, code: out.code, rows: out.rows.map((r) => [r.id, r.state]) }),
    )
  }, good)

  // ST4 section 模式用的是 root-guard 那把区间尺:改区间外的字 ⇒ 封条不动仍绿
  run((root) => {
    commitTree(root, { 'AGENTS.md': MD_BASE.replace('## 1. 其它\nC\n', '## 1. 其它\nC 追加一句\n') })
    const out = judged(root)
    ok(
      'ST4 改铁律段**之外**的内容 ⇒ exit 0(section 尺复用证明)',
      out.exit === 0 && out.rows.some((r) => r.id === 'agents-ironlaw' && r.state === 'pass'),
      JSON.stringify({ exit: out.exit, rows: out.rows.map((r) => [r.id, r.state]) }),
    )
  }, good)

  // ST5 改铁律段里的一个字 ⇒ 红(与 ST4 成对:区间尺不是"整文件哈希"也不是"永不判")
  run((root) => {
    commitTree(root, { 'AGENTS.md': MD_BASE.replace('\nA\nB\n', '\nA\nB 改一字\n') })
    const out = judged(root)
    ok(
      'ST5 改铁律段**之内**一个字 ⇒ exit 1 且点名 agents-ironlaw',
      out.exit === 1 && out.rows.some((r) => r.id === 'agents-ironlaw' && r.state === 'fail'),
      JSON.stringify({ exit: out.exit, rows: out.rows.map((r) => [r.id, r.state]) }),
    )
  }, good)

  // ST6 铁律段锚点失踪 ⇒ 未判定(不当空段、也不当一致)
  run((root) => {
    commitTree(root, { 'AGENTS.md': '# t\n\n## 1. 其它\nC\n' })
    const out = judged(root)
    ok(
      'ST6 段锚点找不到 ⇒ exit 2 / unjudged 且点名 agents-ironlaw',
      out.exit === 2 &&
        out.code === 'unjudged' &&
        out.rows.some((r) => r.id === 'agents-ironlaw' && r.state === 'unknown'),
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  }, good)

  // ST7 清单不是合法 JSON ⇒ 未判定
  run((root) => {
    commitTree(root, { [MANIFEST_REL]: '{不是 JSON' })
    const out = judged(root)
    ok(
      'ST7 清单坏 JSON ⇒ exit 2 / manifest-shape(不冒红也不冒绿)',
      out.exit === 2 && out.code === 'manifest-shape',
      JSON.stringify({ exit: out.exit, code: out.code, why: (out.why ?? '').slice(0, 40) }),
    )
  }, good)

  // ST8 清单 targets 为空 ⇒ 未判定(枚举到 0 不得读成"没有要封的目标 ⇒ 绿")
  run((root) => {
    commitTree(root, { [MANIFEST_REL]: manifestDoc([]) })
    const out = judged(root)
    ok(
      'ST8 清单 targets 为空 ⇒ exit 2 / manifest-shape',
      out.exit === 2 && out.code === 'manifest-shape' && /非空数组/.test(out.why ?? ''),
      JSON.stringify({ exit: out.exit, code: out.code, why: (out.why ?? '').slice(0, 40) }),
    )
  }, good)

  // ST9 清单登记的路径在被审面不存在 ⇒ 未判定(绝不退化成空串哈希)
  run((root) => {
    gitRaw(['rm', '-q', 'scripts/lib/judgement-libs.json'], root)
    gitRaw(['commit', '--no-verify', '-q', '-m', 'drop a target file'], root)
    const out = judged(root)
    ok(
      'ST9 目标文件被删 ⇒ exit 2 / unjudged 且点名 judgement-libs',
      out.exit === 2 &&
        out.code === 'unjudged' &&
        out.rows.some((r) => r.id === 'judgement-libs' && r.state === 'unknown'),
      JSON.stringify({ exit: out.exit, code: out.code, rows: out.rows.map((r) => [r.id, r.state]) }),
    )
  }, good)

  // ST10 清单本身在被审面不存在 ⇒ 未判定
  run((root) => {
    gitRaw(['rm', '-q', MANIFEST_REL], root)
    gitRaw(['commit', '--no-verify', '-q', '-m', 'drop manifest'], root)
    const out = judged(root)
    ok(
      'ST10 清单缺席 ⇒ exit 2 / manifest-missing',
      out.exit === 2 && out.code === 'manifest-missing',
      JSON.stringify({ exit: out.exit, code: out.code }),
    )
  }, good)

  // ST11 射程缩水(清单少掉 root-guard 登记的必备 id)⇒ 红(后门与漏封同罪)
  run((root) => {
    const two = baseManifestEntries().slice(0, 2)
    commitTree(root, { [MANIFEST_REL]: manifestDoc(two) })
    const out = judged(root)
    ok(
      'ST11 清单少一条必备目标 ⇒ exit 1 / target-missing 并点名缺席 id',
      out.exit === 1 &&
        out.code === 'target-missing' &&
        out.missingRequired.includes('agents-ironlaw'),
      JSON.stringify({ exit: out.exit, code: out.code, missing: out.missingRequired }),
    )
  }, good)

  // ST12 索引面:暂存一枚改了规则文件而清单没跟上的提交 ⇒ --staged 当场红(提交链的真实咬合点)
  run((root) => {
    writeIn(root, 'scripts/guardian-runner.mjs', '// baseline runner\n// staged edit\n')
    gitRaw(['add', '-A'], root)
    const out = judged(root, 'staged')
    ok(
      'ST12 --staged 判索引 blob:未重封的暂存改动 ⇒ exit 1 且点名',
      out.exit === 1 && out.rows.some((r) => r.id === 'guardian-runner' && r.state === 'fail'),
      JSON.stringify({ exit: out.exit, code: out.code, rows: out.rows.map((r) => [r.id, r.state]) }),
    )
  }, good)

  // ST13 索引面自洽 ⇒ 绿(证明 ST12 的红不是 staged 档结构上必红)
  run((root) => {
    const stagedRunner = '// baseline runner\n// staged edit\n'
    writeIn(root, 'scripts/guardian-runner.mjs', stagedRunner)
    writeIn(
      root,
      MANIFEST_REL,
      manifestDoc(
        baseManifestEntries().map((t) =>
          t.id === 'guardian-runner' ? { ...t, sha256: sha256Of(stagedRunner) } : t,
        ),
      ),
    )
    gitRaw(['add', '-A'], root)
    const out = judged(root, 'staged')
    ok(
      'ST13 --staged 索引面自洽 ⇒ exit 0',
      out.exit === 0 && out.code === 'consistent',
      JSON.stringify({ exit: out.exit, code: out.code, rows: out.rows.map((r) => [r.id, r.state]) }),
    )
  }, good)

  // ST14 两面旗同给 ⇒ exit 2(selectFace 单源;取哪一面都会让另一面成为假绿)
  ok(
    'ST14 --staged 与 --worktree 同给 ⇒ exit 2',
    main(['--staged', '--worktree', '--root', '/nonexistent-root-xyz']) === 2,
    '',
  )

  // ST15 形状锁(§0.6 反向牙):本文件不得出现第二份哈希/区间实现。
  // ⚠️ 禁语必须**拆开拼接**:一旦把那两个 token 逐字写进本行(哪怕只写在注释里),
  //    src 就真含有一次该串 ⇒ 形状锁把"写下这条禁令"本身判成违规,本门自缚恒红。
  //    与守门 238 记过的「判据字面量恰是本门的禁语」同型。
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const banned = ['create' + 'Hash', 'node:' + 'crypto']
  const hits = banned.filter((token) => src.includes(token))
  ok(
    'ST15 本门零自写哈希 / 取值走 root-guard 的 hashTarget',
    hits.length === 0 &&
      /from '\.\/root-guard\.mjs'/.test(src) &&
      /\bhashTarget\(/.test(src) &&
      /loadManifest\(/.test(src),
    JSON.stringify({ bannedHits: hits }),
  )

  // ST16 未判定优先于红:既有不等又有读不到的目标时,结论是"判不了"而不是"有人改了规则"
  run((root) => {
    commitTree(root, { 'scripts/guardian-runner.mjs': '// drifted\n' })
    gitRaw(['rm', '-q', 'scripts/lib/judgement-libs.json'], root)
    gitRaw(['commit', '--no-verify', '-q', '-m', 'drift + drop'], root)
    const out = judged(root)
    ok(
      'ST16 同一轮里 fail 与 unknown 并存 ⇒ exit 2(未判定优先,与 root-guard 判序一致)',
      out.exit === 2 &&
        out.rows.some((r) => r.state === 'fail') &&
        out.rows.some((r) => r.state === 'unknown'),
      JSON.stringify({ exit: out.exit, code: out.code, rows: out.rows.map((r) => [r.id, r.state]) }),
    )
  }, good)

  let bad = 0
  for (const c of cases) {
    console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.ok ? '' : ` —— ${c.detail}`}`)
    if (!c.ok) bad += 1
  }
  console.log(
    `[root-guard-consistency:self-test] ${cases.length - bad}/${cases.length} 通过(必备目标 ${REQUIRED_TARGET_IDS.join('/')} / 清单 ${MANIFEST_REL})`,
  )
  return { total: cases.length, passed: cases.length - bad, failed: bad, cases }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgv(argv) {
  const opts = { staged: false, worktree: false, json: false, selfTest: false, root: ROOT, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--staged') opts.staged = true
    else if (a === '--worktree') opts.worktree = true
    else if (a === '--json') opts.json = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--root') opts.root = resolve(String(argv[++i]))
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`未知参数:${a}(--help 看用法)`)
  }
  return opts
}

const USAGE = [
  '用法: node scripts/check-root-guard-consistency.mjs [--staged|--worktree] [--json] [--root <仓根>]',
  '      node scripts/check-root-guard-consistency.mjs --self-test',
  '',
  `判据: ${MANIFEST_REL} 里每条 target 的 sha256 必须等于**被审面**那份内容(root-guard 的 hashTarget 口径)。`,
  `修法: node scripts/root-guard.mjs --seal --reason "…" —— 并把清单与规则文件同枚提交并推送。`,
  `应急跳过: ${SELF_SKIP}=1(仅限红确属他人那枚提交时;跳门留痕由 safe-commit attestation 负责)`,
].join('\n')

export function main(argv = process.argv.slice(2)) {
  let opts
  try {
    opts = parseArgv(argv)
  } catch (e) {
    console.error(`❌ ${e.message}`)
    return EXIT_UNDETERMINED
  }
  if (opts.help) {
    console.log(USAGE)
    return EXIT_OK
  }
  if (opts.selfTest) return selfTest().failed === 0 ? EXIT_OK : EXIT_BREACH
  if (process.env[SELF_SKIP] === '1') {
    console.log(`⚠️ [root-guard-consistency] 应急跳过:${SELF_SKIP}=1(本次不判定)`)
    return EXIT_OK
  }
  const picked = selectFace({ staged: opts.staged, worktree: opts.worktree, def: 'head' })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    return EXIT_UNDETERMINED
  }
  let out
  try {
    out = runFace(opts.root, picked.face)
  } catch (e) {
    console.error(`❌ 未判定:${e?.message ?? e}`)
    return EXIT_UNDETERMINED
  }
  if (opts.json) console.log(JSON.stringify(out, null, 2))
  else console.log(formatReport(out))
  return out.exit
}

// §22d isDirectRun 双形态:被 import 时不得跑 CLI 主流程;Windows 反斜杠必须经 pathToFileURL 归一。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  ROOT,
  MANIFEST_REL,
  SELF_SKIP,
  EXIT_OK,
  EXIT_BREACH,
  EXIT_UNDETERMINED,
  SHA_HEAD,
  REQUIRED_TARGET_IDS,
  relFromRoot,
  makeTargetReader,
  evaluateTargets,
  buildTargetReader,
  readManifestText,
  runFace,
  formatReport,
  selfTest,
  parseArgv,
  main,
  // 夹具构件(镜像测试直接复用同一份,不在测试里另写造封条的尺 —— §22c)
  MD_BASE,
  manifestDoc,
  baseManifestEntries,
  fixtureFiles,
  seedRepo,
  commitTree,
  writeIn,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
