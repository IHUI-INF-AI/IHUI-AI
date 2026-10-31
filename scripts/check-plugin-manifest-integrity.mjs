#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-plugin-manifest-integrity.mjs — 已装插件面的逐文件完整性对账(**只读**三态尺)。
 *
 * 立的因(逆向-复现-超越 §0.11,G-21 半腿,2026-11-01):
 * 对照程序 Qoder CN 的插件包把逐文件 sha256 内联进 `catalog.v1.json` /
 * `bundled-resources/manifest.json`,声明"这个包里应当有哪些文件、每个文件是什么字节"。
 * 本仓的记录面(`~/.ihui/installed-plugins/registry.json` 的 `InstallRecord`)此前只有
 * "装过哪一代"(name / version / sourceUrl / sha pin),没有任何尺子能回答
 * **"盘上那份副本还是不是当时那批字节"** —— commit pin 证明源仓库没变,证明不了装机副本没被改。
 * ⇒ 写侧 `apps/cli/src/plugins/installer.ts` 的 `collectInstallFileDigests` 在安装落位那一刻
 * 逐文件记 `{path, sha256, bytes}` 进 `InstallRecord.fileDigests`;本门是同一契约的**读侧对账**。
 *
 * 判据(三态,逐条点名,不并桶):
 *   ok        台账每条都在盘上、字节与摘要逐字相等,且盘上没有未登记的档
 *   drift     三个子类**分开报**,绝不合成一个"漂移数":
 *             · mismatch —— 两边都有但 sha256 或 bytes 不等(内容有变)
 *             · missing  —— 台账有、盘上没有(文件被删/改名)
 *             · unlisted —— 盘上有、台账没有(未登记文件混入;未登记链接也落这一类并点名)
 *   unjudged  输入取不到 ⇒ 既不记绿也不冒红(§0.3)。逐条给 reason:
 *             · `ledger-field-absent` 老记录没有该字段 ⇒ 记 **pending**(升级前的正常态;
 *               判成 ok 是说"已核对过",判成 drift 是说"被篡改",两边都是假结论)
 *             · `ledger-entry-malformed` 台账条目形状坏(缺 sha / path 越根 / bytes 非数 / 空台账)
 *             · `install-dir-unreadable` / `install-dir-not-directory` / `install-dir-is-symlink`
 *               目录读不动(errno 点名)或档形不对
 *             · `registered-path-is-symlink` 登记过的路径当下是链接 ⇒ 不跟随,内容无从证
 *             · `record-name-unusable` / `record-name-unpathable` 记录名不可用或含穿越形态
 *             · `registry-unreadable` / `registry-json-invalid` / `registry-records-missing`
 *               / `no-install-records` / `name-not-in-registry` 台账整面取不到或枚举到 0 条
 *
 * 两条刻意写死的边界:
 *  1. **`install-dir-absent` 落 drift(missing 全量),不落 unjudged**:记录还在台账里说"这个
 *     插件装着",目录却整个没了 = 已装面消失了,这是真漂移。正常卸载会把记录一起摘掉
 *     (`installer.ts` 的 `uninstallPlugin` 按主键 filter),所以"有记录、无目录"不是正常态。
 *  2. **不跟随符号链接 / junction**(AGENTS §26 junction 递归穿透事故史):链接一律"点名不点货"。
 *     安装副本本不该含链接 —— 写侧 `copyDirRecursive` 把树内链接**物化成真实文件**才落位,
 *     所以装机面出现链接本身就是"这份副本不是当时落的那份"的信号。每进一层目录、每读一个档
 *     还做一次 realpath 归属核验:解析不出归属(判不了)与归属越出安装根(逃逸)一律整面拒,
 *     取向与写侧 `path-safety.ts` 的 G-705 同向且更严(本门不给 errno 白名单)。
 *
 * 只读纪律:本门**绝不写盘**(没有 --write / 没有自愈 / 没有重装)。要一份机器可读基线只能
 * `--print-baseline` 打到 stdout,由调用方自己决定留不留。判据实现只此一份(§0.6),镜像测试
 * `scripts/tests/check-plugin-manifest-integrity.test.mjs` import 本门体的 `__test__`,不复抄判据。
 *
 * 档位与接线:
 *   - 注册在 `scripts/guardian-runner.mjs` 的 **warn 档 + 差值棘轮**:历史装机记录结构上拿不到
 *     哈希(全是 unjudged/pending),且用户机装机态不是某一次提交能影响的量 —— 升 blocking 即
 *     §12e 恒红门,升档前置是存量归零。
 *   - 取材面纪律(§0.4)**不适用**:本门判的是**机器装机态**(`~/.ihui/installed-plugins/`),
 *     不是仓内 blob,所以 `--staged` 与全量档是同一判序;`--staged` 只为兼容 runner 统一追加而接受。
 *   - zip-bomb 那一维刻意不判:本仓插件取源是 `git clone`(`apps/cli/src/plugins/git-runner.ts`),
 *     没有解包面 ⇒ 传给既有比对判据的上限是 Infinity,而不是另写一份"不设限"的比对(§0.6)。
 *   - 装机根里的 `<name>.staging-*` / `<name>.superseded-*` 不在射程:那是交换在途/已被取代的
 *     副本,不是已装面(判它们的是 cache 层的归档处置)。
 *
 * 退出码:0 ok / 1 drift / 2 unjudged(含"无从判新增 vs 存量")。
 *
 * 用法:
 *   node scripts/check-plugin-manifest-integrity.mjs                       # 判当台装机面
 *   node scripts/check-plugin-manifest-integrity.mjs --plugins-root <dir>  # 人工指定安装根
 *   node scripts/check-plugin-manifest-integrity.mjs --name <plugin>       # 只判某一条记录
 *   node scripts/check-plugin-manifest-integrity.mjs --baseline <file>     # 差值棘轮:只把新增漂移算"新"
 *   node scripts/check-plugin-manifest-integrity.mjs --print-baseline      # 把当前漂移键集打到 stdout(不写盘)
 *   node scripts/check-plugin-manifest-integrity.mjs --json                # 机器可读结论
 *   node scripts/check-plugin-manifest-integrity.mjs --self-test           # 判据自检(scratch 夹具,不碰真装机面)
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

// 比对判据复用装机资产门(§0.6 单一真相源):missing / unlisted / mismatch 三分类的尺子住在那里,
// sha256 取算也只有那一处;本门只新增"台账 ↔ 装机面"的归属判定与三态定型。
import { EXIT, __test__ as assetJudgement } from './check-installed-asset-catalog.mjs'

const PREFIX = '[plugin-integrity]'

/** 与装机资产门同一组退出码(同一套"0 绿 / 1 红 / 2 未判定"语义,不自立一档)。 */
export { EXIT }

/** 台账字段名(写侧 `InstallRecord.fileDigests` 与本门读侧对账的同一契约键)。 */
export const LEDGER_FIELD = 'fileDigests'

/**
 * 本门自己的枚举熔断:撞上限一律 `unjudged`(点名上限),**绝不静默截断成一份"看起来一致"的清单**。
 * 写侧的台账上限住在 `apps/cli/src/plugins/installer.ts` 的 `DIGEST_LIMITS`;这里不是第二份判据,
 * 只是"盘上已经失控"时保护本门不把整块盘吞进内存的保险丝(量级比写侧上限更宽)。
 */
export const WALK_FUSE = Object.freeze({ maxFiles: 5000 })

/** 上限维度对本门不适用(git clone 取源,无解包面)⇒ 交给比对判据的正无穷,不另写一份比对。 */
const NO_SIZE_LIMITS = Object.freeze({
  maxEntries: Number.POSITIVE_INFINITY,
  maxExpandedBytes: Number.POSITIVE_INFINITY,
})

// ==================== 装机根与台账读取 ====================

/**
 * 解析安装根 `~/.ihui/installed-plugins/` —— 与 `apps/cli/src/plugins/paths.ts` 的
 * `getInstalledPluginsDir()` 同一取值序(`IHUI_HOME` > `HOME` > `USERPROFILE` > `os.homedir()`)。
 * 刻意不 import TS 侧实现:那是编译产物,本门在未构建时也必须能判;取值序实现只此一处,
 * 镜像测试经 `__test__.resolvePluginsRoot` 复用,不在测试里再抄一遍优先级。
 */
export function resolvePluginsRoot(env = process.env, override = null) {
  if (override) return { root: resolve(override), source: '--plugins-root' }
  const home = env.IHUI_HOME || env.HOME || env.USERPROFILE || homedir()
  return {
    root: join(home, '.ihui', 'installed-plugins'),
    source: 'IHUI_HOME>HOME>USERPROFILE>homedir',
  }
}

const DEFAULT_FSA = {
  readdirSync: (d, o) => readdirSync(d, o),
  lstatSync: (p) => lstatSync(p),
  readFileSync: (p, enc) => readFileSync(p, enc ?? null),
  realpathSync: (p) => realpathSync(p),
  existsSync: (p) => existsSync(p),
}

function errnoOf(e) {
  if (!e) return 'unknown'
  const code = e.code || e.errno
  return typeof code === 'string' ? code : 'unknown'
}

/** 台账(registry.json)读取:读不到 / 不是对象 / records 不是数组 ⇒ 一律未判定并点名。 */
export function readRegistry(pluginsRoot, fsa = DEFAULT_FSA) {
  const file = join(pluginsRoot, 'registry.json')
  let text
  try {
    text = fsa.readFileSync(file, 'utf8')
  } catch (e) {
    return { ok: false, reason: 'registry-unreadable', errno: errnoOf(e), file }
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return { ok: false, reason: 'registry-json-invalid', errno: e.message, file }
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.records)) {
    return { ok: false, reason: 'registry-records-missing', file }
  }
  return { ok: true, records: parsed.records, file }
}

// ==================== 台账侧(记录 → 逐文件摘要)====================

/** 记录名能不能当目录名用:拒空、拒 `.`/`..`、拒分隔符、拒绝对路径、拒 NUL(防目录穿越计数)。 */
export function usableRecordName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    return { ok: false, reason: 'record-name-unusable' }
  }
  if (name === '.' || name === '..') return { ok: false, reason: 'record-name-unpathable' }
  if (/[/\\]/.test(name) || isAbsolute(name) || name.includes('\0')) {
    return { ok: false, reason: 'record-name-unpathable' }
  }
  return { ok: true }
}

const SHA_RE = /^[0-9a-f]{64}$/

/**
 * 取出这条记录的逐文件摘要台账(与写侧 `collectInstallFileDigests` 的产出契约对账)。
 * `{ok:true, entries}` / `{ok:false, reason}`:reason 恰为 `ledger-field-absent`(老记录,带
 * `pending:true`)或 `ledger-entry-malformed`(形状坏)。
 * 越根路径(`..` / 绝对 / 空)判形状坏 —— 防的是"多出未登记文件"这一类被毁掉的路径当成正常档。
 */
export function ledgerOf(record) {
  const raw = record && record[LEDGER_FIELD]
  if (raw === undefined || raw === null) {
    return { ok: false, reason: 'ledger-field-absent', pending: true }
  }
  if (!Array.isArray(raw)) return { ok: false, reason: 'ledger-entry-malformed' }
  const entries = []
  for (const e of raw) {
    if (
      !e ||
      typeof e.path !== 'string' ||
      e.path === '' ||
      e.path.startsWith('./') ||
      isAbsolute(e.path) ||
      e.path.split(/[\\/]/).includes('..') ||
      typeof e.sha256 !== 'string' ||
      !SHA_RE.test(e.sha256) ||
      !Number.isFinite(e.bytes) ||
      e.bytes < 0
    ) {
      return { ok: false, reason: 'ledger-entry-malformed' }
    }
    entries.push({ path: e.path.split(sep).join('/'), sha256: e.sha256, bytes: e.bytes })
  }
  // 台账登记了 0 个档:写侧刻意不会写成这样(采不到就不写键),真出现就是"这一面没有内容可对"。
  if (entries.length === 0) return { ok: false, reason: 'ledger-entry-malformed' }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { ok: true, entries }
}

// ==================== 装机面(盘 → 逐文件摘要)====================

/**
 * 枚举安装目录,逐文件算摘要。**绝不跟随符号链接 / junction**,并且每进一层、每读一个档都做
 * realpath 归属核验:解析不出归属(判不了)与归属越出安装根(逃逸)一律整面拒,不回落"当它是普通文件"。
 * 熔断/越界/残档一律交回 `unjudged` 并点名原因,**绝不交回"部分清单"冒充已核对**(§0.3)。
 *
 * @returns {ok:true, files, links} 或 {ok:false, reason, errno?}
 */
export function walkInstallRoot(rootDir, fsa = DEFAULT_FSA) {
  const files = []
  const links = []

  let realRoot
  try {
    realRoot = fsa.realpathSync(rootDir)
  } catch (e) {
    return { ok: false, reason: 'install-dir-unreadable', errno: errnoOf(e) }
  }

  /** 归属核验:解析后必须仍落在 realRoot 内(等于 realRoot 自身也算)。解析不了 ⇒ false(= 拒)。 */
  const contained = (abs) => {
    let real
    try {
      real = fsa.realpathSync(abs)
    } catch {
      return false
    }
    const rel = relative(realRoot, real)
    return rel === '' || (!!rel && !rel.startsWith('..') && !isAbsolute(rel))
  }

  const relOf = (abs) => {
    const rel = relative(rootDir, abs)
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
    return rel.split(sep).join('/')
  }

  const walk = (dir) => {
    let ents
    try {
      ents = fsa.readdirSync(dir, { withFileTypes: true })
    } catch (e) {
      return { error: errnoOf(e) }
    }
    for (const ent of ents) {
      const abs = join(dir, ent.name)
      let st
      try {
        st = fsa.lstatSync(abs)
      } catch (e) {
        return { error: errnoOf(e) }
      }
      const rel = relOf(abs)
      if (rel === null) return { error: 'path-escape-root' }
      // lstat 判链接:链接"点名不点货"(§26 递归穿透红线)—— 既不读它,也不 realpath 它
      if (st.isSymbolicLink()) {
        links.push(rel)
        continue
      }
      if (st.isDirectory()) {
        // Windows junction / 目录链接的第二道锁:realpath 归属判不了或越界 ⇒ 整面拒
        if (!contained(abs)) return { error: 'junction-escape' }
        const r = walk(abs)
        if (r.error) return r
        continue
      }
      if (!st.isFile()) return { error: 'irregular-entry' }
      if (!contained(abs)) return { error: 'junction-escape' }
      let body
      try {
        body = fsa.readFileSync(abs)
      } catch (e) {
        return { error: errnoOf(e) }
      }
      files.push({ path: rel, sha256: assetJudgement.sha256Hex(body), bytes: body.length })
      if (files.length > WALK_FUSE.maxFiles) return { error: 'over-file-cap' }
    }
    return {}
  }

  let rootSt
  try {
    rootSt = fsa.lstatSync(rootDir)
  } catch (e) {
    return { ok: false, reason: 'install-dir-unreadable', errno: errnoOf(e) }
  }
  if (rootSt.isSymbolicLink()) return { ok: false, reason: 'install-dir-is-symlink' }
  if (!rootSt.isDirectory()) return { ok: false, reason: 'install-dir-not-directory' }

  const r = walk(rootDir)
  if (r.error) return { ok: false, reason: 'install-dir-unreadable', errno: r.error }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  links.sort()
  return { ok: true, files, links }
}

// ==================== 单条记录判定 ====================

const short = (sha) => (typeof sha === 'string' ? `${sha.slice(0, 12)}…` : String(sha))

/**
 * 判一条安装记录:台账(装机那一刻)↔ 盘上现状。
 * 返回 `{ name, state, reason?, missing[], mismatch[], unlisted[], counts }`;
 * 三态在此定型:`ok` / `drift` / `unjudged`(老记录带 `pending:true`)。
 */
export function judgeRecord(record, pluginsRoot, fsa = DEFAULT_FSA) {
  const name = record && record.name
  const nameVerdict = usableRecordName(name)
  if (!nameVerdict.ok) {
    return { name: String(name ?? ''), state: 'unjudged', reason: nameVerdict.reason }
  }

  const ledger = ledgerOf(record)
  if (!ledger.ok) {
    return {
      name,
      state: 'unjudged',
      reason: ledger.reason,
      ...(ledger.pending ? { pending: true } : {}),
    }
  }

  const dirAbs = join(pluginsRoot, name)
  if (!fsa.existsSync(dirAbs)) {
    // 记录说装着、目录整个没了 ⇒ 真漂移(全量落 missing),不是"取不到输入"(见头注边界 1)
    return {
      name,
      state: 'drift',
      reason: 'install-dir-absent',
      missing: ledger.entries.map((e) => e.path).sort(),
      mismatch: [],
      unlisted: [],
      counts: {
        ledger: ledger.entries.length,
        disk: 0,
        missing: ledger.entries.length,
        mismatch: 0,
        unlisted: 0,
      },
    }
  }

  const disk = walkInstallRoot(dirAbs, fsa)
  if (!disk.ok) {
    return {
      name,
      state: 'unjudged',
      reason: disk.reason,
      ...(disk.errno ? { errno: disk.errno } : {}),
    }
  }

  const registered = new Set(ledger.entries.map((e) => e.path))
  // 登记过的路径当下是链接:不跟随就无从证内容 ⇒ 未判定(绝不读成 mismatch 冒充"判过了")
  const blockedLinks = disk.links.filter((p) => registered.has(p))
  if (blockedLinks.length > 0) {
    return {
      name,
      state: 'unjudged',
      reason: 'registered-path-is-symlink',
      linksAtRegisteredPath: blockedLinks,
    }
  }

  // 三分类比对判据 = 装机资产门的 judge(§0.6 单一真相源,本门不复抄一份集合比对)
  const compared = assetJudgement.judge(
    { version: 1, root: name, entries: ledger.entries },
    { version: 1, root: name, entries: disk.files },
    NO_SIZE_LIMITS,
  )
  // 未登记的链接同样落 unlisted(它们是"盘上有、台账没有"的档),逐条点名形态
  const unlistedFromLinks = disk.links.filter((p) => !registered.has(p))
  const unlisted = [...compared.unlisted, ...unlistedFromLinks].sort()
  const anyDrift = compared.missing.length + compared.mismatch.length + unlisted.length > 0

  return {
    name,
    state: anyDrift ? 'drift' : 'ok',
    missing: [...compared.missing].sort(),
    mismatch: compared.mismatch.map((m) => ({
      path: m.path,
      expectedSha: m.expected.sha256,
      actualSha: m.actual.sha256,
      expectedBytes: m.expected.bytes,
      actualBytes: m.actual.bytes,
      changed: m.expected.sha256 !== m.actual.sha256,
      bytesChanged: m.expected.bytes !== m.actual.bytes,
    })),
    unlisted,
    unlistedSymlinks: unlistedFromLinks,
    counts: {
      ledger: ledger.entries.length,
      disk: disk.files.length,
      missing: compared.missing.length,
      mismatch: compared.mismatch.length,
      unlisted: unlisted.length,
    },
  }
}

// ==================== 整面判据(三态汇总 + 差值棘轮)====================

/** 一条漂移项的稳定身份(差值棘轮的键):`<插件名>::<类别>::<路径>`。三类不共键 ⇒ 不并桶。 */
export function driftKeyOf(name, klass, path) {
  return `${name}::${klass}::${path}`
}

/** 把一条 drift 记录摊成漂移项清单。 */
export function driftItemsOf(judged) {
  const items = []
  for (const p of judged.missing ?? []) items.push(driftKeyOf(judged.name, 'missing', p))
  for (const m of judged.mismatch ?? []) items.push(driftKeyOf(judged.name, 'mismatch', m.path))
  for (const p of judged.unlisted ?? []) items.push(driftKeyOf(judged.name, 'unlisted', p))
  return items
}

/**
 * 基线文本解析。**形状坏 ⇒ 棘轮未判定**,绝不把"读不懂基线"当成"存量为零"。
 * 形态:`{version:1, driftKeys:[ "<name>::<class>::<path>" ]}`(由 `--print-baseline` 产出)。
 */
export function parseBaseline(text) {
  let raw
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, reason: `基线不是合法 JSON: ${e.message}` }
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.driftKeys)) {
    return { ok: false, reason: '基线缺 driftKeys 数组' }
  }
  const keys = raw.driftKeys.filter((k) => typeof k === 'string')
  if (keys.length !== raw.driftKeys.length) {
    return { ok: false, reason: '基线 driftKeys 含非字符串项' }
  }
  return { ok: true, keys: new Set(keys) }
}

/** 基线只由调用方给路径;本门**永不写盘**。读不到 ⇒ 棘轮未判定。 */
export function loadBaseline(file, fsa = DEFAULT_FSA) {
  let text
  try {
    text = fsa.readFileSync(file, 'utf8')
  } catch (e) {
    return { ok: false, reason: `基线读不到: ${errnoOf(e)}` }
  }
  return parseBaseline(text)
}

/**
 * 整面判定。verdict ∈ `ok | drift | unjudged`;优先级 drift > unjudged > ok,而"枚举到 0 条记录"
 * 按 §0.3 落 unjudged(空面不等于绿)。
 */
export function reconcile(records, pluginsRoot, fsa = DEFAULT_FSA) {
  const judged = records.map((r) => judgeRecord(r, pluginsRoot, fsa))
  const ok = judged.filter((j) => j.state === 'ok')
  const drift = judged.filter((j) => j.state === 'drift')
  const unjudged = judged.filter((j) => j.state === 'unjudged')
  const pending = unjudged.filter((j) => j.pending === true)
  const items = drift.flatMap(driftItemsOf)

  let verdict
  if (records.length === 0) verdict = 'unjudged'
  else if (drift.length > 0) verdict = 'drift'
  else if (unjudged.length > 0) verdict = 'unjudged'
  else verdict = 'ok'

  return {
    verdict,
    pluginsRoot,
    records: records.length,
    judged,
    counts: {
      ok: ok.length,
      drift: drift.length,
      unjudged: unjudged.length,
      pending: pending.length,
      missing: drift.reduce((n, j) => n + (j.missing?.length ?? 0), 0),
      mismatch: drift.reduce((n, j) => n + (j.mismatch?.length ?? 0), 0),
      unlisted: drift.reduce((n, j) => n + (j.unlisted?.length ?? 0), 0),
    },
    driftItems: items,
    ...(records.length === 0 ? { reason: 'no-install-records' } : {}),
  }
}

/** 差值棘轮:有基线才分得出"新增 vs 存量";无基线 ⇒ new 未判定(不拿 0 冒充"没有新增")。 */
export function applyRatchet(result, baseline) {
  if (!baseline) {
    return { mode: 'absent', new: null, stock: null, note: '未给 --baseline:新增 vs 存量无从判' }
  }
  if (!baseline.ok) {
    return { mode: 'unjudged', new: null, stock: null, note: baseline.reason }
  }
  const fresh = result.driftItems.filter((k) => !baseline.keys.has(k))
  return {
    mode: 'judged',
    new: fresh.length,
    stock: result.driftItems.length - fresh.length,
    freshItems: fresh,
  }
}

// ==================== 输出(只读,永不写盘)====================

export function printHuman(result, ratchet) {
  const c = result.counts
  console.log(
    `${PREFIX} 面=装机(只读) 根=${result.pluginsRoot} 记录=${result.records} ` +
      `ok=${c.ok} drift=${c.drift} unjudged=${c.unjudged}(老记录 pending=${c.pending}) ` +
      `漂移项 mismatch=${c.mismatch} missing=${c.missing} unlisted=${c.unlisted}`,
  )
  for (const j of result.judged) {
    if (j.state === 'ok') {
      console.log(`  [ok      ] ${j.name}(${j.counts.ledger} 个文件逐字一致)`)
      continue
    }
    if (j.state === 'unjudged') {
      console.log(
        `  [${(j.pending ? 'pending' : 'unjudged').padEnd(8)}] ${j.name} reason=${j.reason}` +
          `${j.errno ? ` errno=${j.errno}` : ''}` +
          (j.linksAtRegisteredPath
            ? ` 链接位于登记路径: ${j.linksAtRegisteredPath.join(', ')}`
            : ''),
      )
      continue
    }
    console.log(
      `  [drift   ] ${j.name}${j.reason ? ` reason=${j.reason}` : ''} ` +
        `mismatch=${j.counts.mismatch} missing=${j.counts.missing} unlisted=${j.counts.unlisted}`,
    )
    for (const m of j.mismatch) {
      console.log(
        `      [mismatch] ${m.path} sha ${short(m.expectedSha)}→${short(m.actualSha)}` +
          (m.bytesChanged ? ` bytes ${m.expectedBytes}→${m.actualBytes}` : ''),
      )
    }
    for (const p of j.missing) console.log(`      [missing ] ${p}`)
    for (const p of j.unlisted) {
      console.log(
        `      [unlisted] ${p}${j.unlistedSymlinks?.includes(p) ? '(符号链接,未跟随)' : ''}`,
      )
    }
  }
  const ratchetText =
    ratchet.mode === 'judged'
      ? ` 新增=${ratchet.new} 存量=${ratchet.stock}`
      : ` 棘轮=${ratchet.mode}(${ratchet.note})`
  console.log(
    result.verdict === 'ok'
      ? `${PREFIX} 结论: ok(已装面逐文件与台账一致)${ratchetText}`
      : result.verdict === 'drift'
        ? `${PREFIX} 结论: drift(三类分开点名,见上)${ratchetText}`
        : `${PREFIX} 结论: unjudged(输入取不到 / 有记录无从证;不记绿也不冒红)${ratchetText}`,
  )
}

// ==================== 自检(scratch 盘上夹具 + 注入缝;不碰真装机面)====================

const buf = (s) => Buffer.from(s, 'utf8')

/** 按写侧同一契约造台账条目(自检夹具用,不代表第二份判据)。 */
function digestOf(files) {
  return Object.entries(files)
    .map(([p, body]) => ({
      path: p,
      sha256: assetJudgement.sha256Hex(buf(body)),
      bytes: buf(body).length,
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

/** 落一个装机根到 scratch:`<root>/registry.json` + `<root>/<name>/<文件>`。 */
function writeFixtureRoot(root, filesByPlugin, records) {
  mkdirSync(root, { recursive: true })
  for (const [name, files] of Object.entries(filesByPlugin)) {
    for (const [rel, body] of Object.entries(files)) {
      const abs = join(root, name, ...rel.split('/'))
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, buf(body))
    }
  }
  writeFileSync(join(root, 'registry.json'), JSON.stringify({ records }))
  return root
}

const statsOf = (kind) => ({
  isSymbolicLink: () => kind === 'symlink',
  isDirectory: () => kind === 'dir',
  isFile: () => kind === 'file',
})

/**
 * 注入面(链接判据的确定性夹具):真造符号链接在 Windows 需要特权,判据不能只在能造出来的机器上被测。
 * 所以这里把"链接"这一档用假 fsa 确定性地钉住;`reads` 记录被读过的相对路径,用来**证明链接本体
 * 一次都没被读**(点货 = 判据失效)。`escape` 列出的路径 realpath 失败(模拟 junction 越界)。
 */
function fakeFsa(rootAbs, { entries, escape = [] }) {
  const reads = []
  const absOf = (rel) => (rel === '' ? rootAbs : join(rootAbs, ...rel.split('/')))
  const relOf = (p) => (p === rootAbs ? '' : relative(rootAbs, p).split(sep).join('/'))
  return {
    reads,
    existsSync: (p) => p === rootAbs || entries.some((e) => absOf(e.path) === p),
    lstatSync: (p) => {
      const rel = relOf(p)
      if (rel === '') return statsOf('dir')
      const hit = entries.find((e) => e.path === rel)
      if (!hit) throw Object.assign(new Error(`ENOENT ${rel}`), { code: 'ENOENT' })
      return statsOf(hit.kind ?? 'file')
    },
    readdirSync: (dirAbs) => {
      const prefix = relOf(dirAbs) === '' ? '' : `${relOf(dirAbs)}/`
      const seen = new Set()
      for (const e of entries) {
        if (!e.path.startsWith(prefix)) continue
        const seg = e.path.slice(prefix.length).split('/')[0]
        if (seg) seen.add(seg)
      }
      return [...seen].map((name) => ({ name }))
    },
    readFileSync: (p) => {
      const rel = relOf(p)
      const hit = entries.find((e) => e.path === rel)
      if (!hit) throw Object.assign(new Error(`ENOENT ${rel}`), { code: 'ENOENT' })
      if (hit.kind === 'symlink') throw new Error(`注入面被要求读链接本体: ${rel}`)
      reads.push(rel)
      return buf(hit.body ?? '')
    },
    realpathSync: (p) => {
      const rel = relOf(p)
      if (escape.includes(rel)) throw Object.assign(new Error(`ELOOP ${rel}`), { code: 'ELOOP' })
      return absOf(rel)
    },
  }
}

/**
 * 判据自检。三态各被钉住,特别是「老记录不得判 ok / 不得判 drift」独立成例(⑥)。
 * 盘上夹具一律落批准的 scratch(AGENTS §15b),绝不碰真装机面、绝不往仓库树里写。
 */
export function selfTest() {
  const cases = []
  const push = (name, ok) => cases.push([name, ok === true])
  const scratch = mkScratch('plugin-integrity-')

  try {
    // ① ok:台账与盘上逐字一致
    {
      const files = {
        'plugin.json': '{"name":"p1","version":"1.0.0"}',
        'lib/a.js': 'export const a=1',
      }
      const root = writeFixtureRoot(join(scratch, 'case-ok'), { p1: files }, [
        { name: 'p1', sourceType: 'local', installedAt: 'x', [LEDGER_FIELD]: digestOf(files) },
      ])
      const r = reconcile(readRegistry(root, DEFAULT_FSA).records, root, DEFAULT_FSA)
      push(
        '① 台账与盘上一致 ⇒ ok(ok=1 drift=0 unjudged=0)',
        r.verdict === 'ok' && r.counts.ok === 1 && r.counts.drift === 0 && r.counts.unjudged === 0,
      )
    }

    // ② drift/mismatch:内容有变,只落 mismatch,不并进其它两类
    {
      const ledgerFiles = { 'plugin.json': 'one', 'lib/a.js': 'two' }
      const root = writeFixtureRoot(
        join(scratch, 'case-mismatch'),
        { p1: { 'plugin.json': 'CHANGED', 'lib/a.js': 'two' } },
        [{ name: 'p1', [LEDGER_FIELD]: digestOf(ledgerFiles) }],
      )
      const r = reconcile(readRegistry(root, DEFAULT_FSA).records, root, DEFAULT_FSA)
      const j = r.judged[0]
      push(
        '② 内容有变 ⇒ drift 且只落 mismatch(mismatch=1 missing=0 unlisted=0)并点名 sha 前后',
        r.verdict === 'drift' &&
          j.counts.mismatch === 1 &&
          j.counts.missing === 0 &&
          j.counts.unlisted === 0 &&
          j.mismatch[0].path === 'plugin.json' &&
          j.mismatch[0].expectedSha !== j.mismatch[0].actualSha &&
          j.mismatch[0].changed === true,
      )
    }

    // ③ drift/missing:文件被删
    {
      const ledgerFiles = { 'plugin.json': 'x', 'lib/a.js': 'y' }
      const root = writeFixtureRoot(join(scratch, 'case-missing'), { p1: { 'plugin.json': 'x' } }, [
        { name: 'p1', [LEDGER_FIELD]: digestOf(ledgerFiles) },
      ])
      const j = reconcile(readRegistry(root, DEFAULT_FSA).records, root, DEFAULT_FSA).judged[0]
      push(
        '③ 台账有盘上没有 ⇒ drift 且只落 missing 并点名该路径',
        j.state === 'drift' &&
          j.counts.missing === 1 &&
          j.counts.mismatch === 0 &&
          j.counts.unlisted === 0 &&
          j.missing.includes('lib/a.js'),
      )
    }

    // ④ drift/unlisted:多出未登记文件
    {
      const ledgerFiles = { 'plugin.json': 'x' }
      const root = writeFixtureRoot(
        join(scratch, 'case-unlisted'),
        { p1: { 'plugin.json': 'x', 'evil.js': 'console.log(1)' } },
        [{ name: 'p1', [LEDGER_FIELD]: digestOf(ledgerFiles) }],
      )
      const j = reconcile(readRegistry(root, DEFAULT_FSA).records, root, DEFAULT_FSA).judged[0]
      push(
        '④ 多出未登记文件 ⇒ drift 且只落 unlisted 并点名该路径',
        j.state === 'drift' &&
          j.counts.unlisted === 1 &&
          j.counts.missing === 0 &&
          j.counts.mismatch === 0 &&
          j.unlisted.includes('evil.js'),
      )
    }

    // ⑤ 三类同时命中 ⇒ 三个计数各自成立(证明"不并桶"不是只在一类里报名)
    {
      const ledgerFiles = { 'plugin.json': 'A', 'lib/gone.js': 'G', 'lib/keep.js': 'K' }
      const root = writeFixtureRoot(
        join(scratch, 'case-three-classes'),
        { p1: { 'plugin.json': 'B', 'lib/keep.js': 'K', 'lib/extra.js': 'E' } },
        [{ name: 'p1', [LEDGER_FIELD]: digestOf(ledgerFiles) }],
      )
      const r = reconcile(readRegistry(root, DEFAULT_FSA).records, root, DEFAULT_FSA)
      const j = r.judged[0]
      push(
        '⑤ 三类同面分开:mismatch=1 missing=1 unlisted=1,三条漂移键互不相同',
        j.counts.mismatch === 1 &&
          j.counts.missing === 1 &&
          j.counts.unlisted === 1 &&
          r.driftItems.length === 3 &&
          new Set(r.driftItems).size === 3,
      )
    }

    // ⑥ 老记录(没有 fileDigests 键)⇒ unjudged/pending —— **既不 ok 也不 drift**
    {
      const root = writeFixtureRoot(join(scratch, 'case-legacy'), { p1: { 'plugin.json': 'x' } }, [
        { name: 'p1', sourceType: 'local', installedAt: '2026-01-01T00:00:00.000Z' },
      ])
      const r = reconcile(readRegistry(root, DEFAULT_FSA).records, root, DEFAULT_FSA)
      const j = r.judged[0]
      push(
        '⑥ 老记录无台账字段 ⇒ unjudged+pending=true+reason=ledger-field-absent,整面 verdict=unjudged 且 ok=0 drift=0(绝不把升级前说成"已核对"或"被篡改")',
        j.state === 'unjudged' &&
          j.pending === true &&
          j.reason === 'ledger-field-absent' &&
          r.verdict === 'unjudged' &&
          r.counts.ok === 0 &&
          r.counts.drift === 0 &&
          r.driftItems.length === 0,
      )
    }

    // ⑦ 混合面:ok + 内容漂移 + 目录整个没 + 老记录 ⇒ 汇总 drift,各类各归其位
    {
      const f1 = { 'plugin.json': 'x' }
      const f2 = { 'plugin.json': 'good' }
      const root = writeFixtureRoot(
        join(scratch, 'case-mixed'),
        { p1: f1, p2: { 'plugin.json': 'BAD' } },
        [
          { name: 'p1', [LEDGER_FIELD]: digestOf(f1) },
          { name: 'p2', [LEDGER_FIELD]: digestOf(f2) },
          { name: 'p3', [LEDGER_FIELD]: digestOf({ 'plugin.json': 'gone' }) },
          { name: 'p4', installedAt: '2026-01-01T00:00:00.000Z' },
        ],
      )
      const r = reconcile(readRegistry(root, DEFAULT_FSA).records, root, DEFAULT_FSA)
      push(
        '⑦ 混合面 ⇒ verdict=drift,ok=1 drift=2 pending=1;目录整个没那条=install-dir-absent(算 drift 不算 unjudged)',
        r.verdict === 'drift' &&
          r.counts.ok === 1 &&
          r.counts.drift === 2 &&
          r.counts.pending === 1 &&
          r.judged[2].reason === 'install-dir-absent' &&
          r.judged[2].counts.missing === 1 &&
          r.judged[3].pending === true,
      )
    }

    // ⑧ 台账形状坏 / 路径越根 / 空台账 ⇒ 一律 unjudged(不冒 drift 也不冒 ok)
    {
      const root = writeFixtureRoot(
        join(scratch, 'case-malformed'),
        { p1: { 'plugin.json': 'x' } },
        [],
      )
      const probes = [
        {
          value: [{ path: '../../../../etc/passwd', sha256: 'a'.repeat(64), bytes: 1 }],
          label: '越根路径',
        },
        {
          value: [{ path: 'C:/Windows/win.ini', sha256: 'a'.repeat(64), bytes: 1 }],
          label: '绝对路径',
        },
        { value: [{ path: 'plugin.json', sha256: 'not-hex', bytes: 1 }], label: 'sha 非十六进制' },
        {
          value: [{ path: './plugin.json', sha256: 'a'.repeat(64), bytes: 1 }],
          label: '带 ./ 前缀',
        },
        { value: [{ path: 'plugin.json', sha256: 'a'.repeat(63), bytes: 1 }], label: 'sha 短一位' },
        { value: [{ path: 'plugin.json', sha256: 'a'.repeat(64) }], label: '缺 bytes' },
        { value: [{ sha256: 'a'.repeat(64), bytes: 1 }], label: '缺 path' },
        { value: [], label: '空台账(0 条登记)' },
      ]
      let allBad = true
      for (const { value, label } of probes) {
        const j = reconcile([{ name: 'p1', [LEDGER_FIELD]: value }], root, DEFAULT_FSA).judged[0]
        if (j.state !== 'unjudged' || j.reason !== 'ledger-entry-malformed') {
          allBad = false
          console.log(
            `${PREFIX} ⑧ 该形态未落 unjudged(ledger-entry-malformed):${label} ⇒ ${j.state}/${j.reason}`,
          )
        }
      }
      const absent = ledgerOf({ name: 'p1' })
      push(
        '⑧ 台账越根/绝对/缺字段/sha 短一位/空台账 ⇒ 全部 unjudged(ledger-entry-malformed);字段缺席另判 ledger-field-absent+pending',
        allBad && absent.reason === 'ledger-field-absent' && absent.pending === true,
      )
    }

    // ⑨ 记录名不可用(穿越形态 / 空 / 带分隔符)⇒ 逐条 unjudged,绝不参与"多出未登记"计数
    {
      const root = writeFixtureRoot(join(scratch, 'case-name'), { p1: { 'plugin.json': 'x' } }, [])
      const r = reconcile(
        [
          { name: '../evil', [LEDGER_FIELD]: digestOf({ x: 'y' }) },
          { name: '', [LEDGER_FIELD]: digestOf({ x: 'y' }) },
          { name: 'a/b', [LEDGER_FIELD]: digestOf({ x: 'y' }) },
          { name: 'a\\b', [LEDGER_FIELD]: digestOf({ x: 'y' }) },
        ],
        root,
        DEFAULT_FSA,
      )
      push(
        '⑨ 记录名 ../evil、空、a/b、a\\\\b ⇒ 全落 unjudged(record-name-*),drift=0 unlisted=0,整面不记绿',
        r.counts.unjudged === 4 &&
          r.counts.drift === 0 &&
          r.counts.unlisted === 0 &&
          r.judged[0].reason === 'record-name-unpathable' &&
          r.judged[1].reason === 'record-name-unusable' &&
          r.verdict === 'unjudged',
      )
      push(
        '⑨b usableRecordName 直接判:./ 与 .. 与绝对路径与含 NUL 全拒',
        usableRecordName('.').ok === false &&
          usableRecordName('..').ok === false &&
          usableRecordName('a\u0000b').ok === false &&
          usableRecordName('ok-name').ok === true,
      )
    }

    // ⑩ 台账整面取不到 / JSON 坏 / records 缺 / 枚举 0 条 ⇒ unjudged(空面不等于绿)
    {
      const emptyRoot = join(scratch, 'case-noregistry')
      mkdirSync(emptyRoot, { recursive: true })
      const r1 = reconcile([], emptyRoot, DEFAULT_FSA)
      const rr1 = readRegistry(emptyRoot, DEFAULT_FSA)
      const badRoot = join(scratch, 'case-badregistry')
      mkdirSync(badRoot, { recursive: true })
      writeFileSync(join(badRoot, 'registry.json'), '{ not json')
      const noArrRoot = join(scratch, 'case-norecords')
      mkdirSync(noArrRoot, { recursive: true })
      writeFileSync(join(noArrRoot, 'registry.json'), '{"version":1}')
      push(
        '⑩ 台账缺⇒registry-unreadable / JSON 坏⇒registry-json-invalid / records 缺⇒registry-records-missing / 0 条⇒no-install-records(四种都不记绿)',
        rr1.ok === false &&
          rr1.reason === 'registry-unreadable' &&
          readRegistry(badRoot, DEFAULT_FSA).reason === 'registry-json-invalid' &&
          readRegistry(noArrRoot, DEFAULT_FSA).reason === 'registry-records-missing' &&
          r1.verdict === 'unjudged' &&
          r1.reason === 'no-install-records',
      )
    }

    // ⑪ 安装路径躺着的是文件不是目录 ⇒ unjudged(不冒 drift,也不冒 ok)
    {
      const root = join(scratch, 'case-notdir')
      writeFixtureRoot(root, {}, [
        { name: 'p1', [LEDGER_FIELD]: digestOf({ 'plugin.json': 'abc' }) },
      ])
      writeFileSync(join(root, 'p1'), 'i am a file, not a directory')
      const r = reconcile(readRegistry(root, DEFAULT_FSA).records, root, DEFAULT_FSA)
      push(
        '⑪ 安装路径不是目录 ⇒ unjudged(install-dir-not-directory),绝不判成 drift/ok',
        r.judged[0].state === 'unjudged' &&
          r.judged[0].reason === 'install-dir-not-directory' &&
          r.verdict === 'unjudged' &&
          r.counts.drift === 0,
      )
    }

    // ⑫ 差值棘轮:同一份漂移,有基线 ⇒ new=0;摘一条 ⇒ new=1;不给基线 ⇒ new=null
    {
      const root = writeFixtureRoot(
        join(scratch, 'case-ratchet'),
        { p1: { 'plugin.json': 'changed', 'evil.js': 'e' } },
        [{ name: 'p1', [LEDGER_FIELD]: digestOf({ 'plugin.json': 'orig' }) }],
      )
      const r = reconcile(readRegistry(root, DEFAULT_FSA).records, root, DEFAULT_FSA)
      const items = r.driftItems
      const withBaseline = applyRatchet(
        r,
        parseBaseline(JSON.stringify({ version: 1, driftKeys: items })),
      )
      const grew = applyRatchet(
        r,
        parseBaseline(JSON.stringify({ version: 1, driftKeys: items.slice(1) })),
      )
      push(
        `⑫ 棘轮:漂移全入基线⇒new=0 stock=${items.length};基线少一枚⇒new=1;不给基线⇒new=null(不拿 0 冒充"没有新增")`,
        withBaseline.mode === 'judged' &&
          withBaseline.new === 0 &&
          withBaseline.stock === items.length &&
          grew.mode === 'judged' &&
          grew.new === 1 &&
          applyRatchet(r, null).new === null &&
          applyRatchet(r, null).mode === 'absent',
      )
    }

    // ⑬ 基线文本坏 / 缺 driftKeys / 读不到 ⇒ 棘轮未判定(不静默当"存量零")
    {
      const absentFile = loadBaseline(join(scratch, 'no-such-baseline.json'), DEFAULT_FSA)
      push(
        '⑬ 基线 JSON 坏 / 缺 driftKeys / 含非字符串项 / 文件读不到 ⇒ 一律不成立,new=null',
        parseBaseline('{oops').ok === false &&
          parseBaseline('{"version":1}').ok === false &&
          parseBaseline('{"driftKeys":[1,2]}').ok === false &&
          parseBaseline('{"driftKeys":["p1::missing::a.js"]}').ok === true &&
          absentFile.ok === false &&
          applyRatchet({ driftItems: [] }, { ok: false, reason: 'x' }).mode === 'unjudged',
      )
    }

    // ⑭ 链接判据(注入缝 ⇒ 跨平台确定):未登记链接落 unlisted 且**本体未被读**;
    //    登记路径当下是链接 ⇒ unjudged;realpath 越界(junction)⇒ unjudged。
    {
      const rootAbs = join(scratch, 'p1')
      const sha = assetJudgement.sha256Hex(buf('x'))
      const ledger = [{ path: 'plugin.json', sha256: sha, bytes: 1 }]

      const a = fakeFsa(rootAbs, {
        entries: [
          { path: 'plugin.json', kind: 'file', body: 'x' },
          { path: 'evil-link.txt', kind: 'symlink' },
        ],
      })
      const ja = judgeRecord({ name: 'p1', [LEDGER_FIELD]: ledger }, scratch, a)
      const b = fakeFsa(rootAbs, { entries: [{ path: 'plugin.json', kind: 'symlink' }] })
      const jb = judgeRecord({ name: 'p1', [LEDGER_FIELD]: ledger }, scratch, b)
      const c = fakeFsa(rootAbs, {
        entries: [
          { path: 'sub', kind: 'dir' },
          { path: 'sub/x.js', kind: 'file', body: 'X' },
        ],
        escape: ['sub'],
      })
      const jc = judgeRecord(
        { name: 'p1', [LEDGER_FIELD]: digestOf({ 'sub/x.js': 'X' }) },
        scratch,
        c,
      )
      push(
        '⑭ 链接三判据:未登记链接⇒drift/unlisted 且本体一次都没被读;登记路径上是链接⇒unjudged(registered-path-is-symlink);realpath 越界(junction)⇒unjudged',
        ja.state === 'drift' &&
          ja.unlisted.includes('evil-link.txt') &&
          ja.counts.mismatch === 0 &&
          a.reads.includes('evil-link.txt') === false &&
          a.reads.includes('plugin.json') === true &&
          jb.state === 'unjudged' &&
          jb.reason === 'registered-path-is-symlink' &&
          b.reads.length === 0 &&
          jc.state === 'unjudged' &&
          jc.reason === 'install-dir-unreadable' &&
          jc.errno === 'junction-escape',
      )

      // 真链接/真 junction 对照:环境造得出来就实测,造不出来如实报 unavailable(不冒充通过)
      try {
        const outside = join(scratch, 'outside-target')
        mkdirSync(outside, { recursive: true })
        writeFileSync(join(outside, 'SECRET.txt'), 'TOP-SECRET')
        const realRoot = writeFixtureRoot(
          join(scratch, 'case-real-link'),
          { p1: { 'plugin.json': 'x' } },
          [{ name: 'p1', [LEDGER_FIELD]: digestOf({ 'plugin.json': 'x' }) }],
        )
        let plantedName = 'planted-link.txt'
        try {
          symlinkSync(join(outside, 'SECRET.txt'), join(realRoot, 'p1', plantedName))
        } catch {
          plantedName = 'planted-junction'
          symlinkSync(outside, join(realRoot, 'p1', plantedName), 'junction')
        }
        const r = reconcile(readRegistry(realRoot, DEFAULT_FSA).records, realRoot, DEFAULT_FSA)
        const j = r.judged[0]
        push(
          '⑭-真 真链接/真 junction 落 unlisted 并点名,其内容未被哈希(mismatch=0 missing=0)',
          j.state === 'drift' &&
            j.unlisted.includes(plantedName) &&
            j.counts.mismatch === 0 &&
            j.counts.missing === 0 &&
            j.counts.disk === 1,
        )
      } catch (e) {
        console.log(
          `${PREFIX} 真链接夹具造不出来(${errnoOf(e)}):该维判据由 ⑭ 注入缝钉住,盘上形态本轮未实测(unavailable)`,
        )
      }
    }

    // ⑮ 写侧契约形状锁:台账条目只认 {path, sha256(64hex), bytes>=0},POSIX 相对路径
    {
      const good = { path: 'lib/deep/a.js', sha256: 'a'.repeat(64), bytes: 1 }
      const okLedger = ledgerOf({ name: 'p', [LEDGER_FIELD]: [good] })
      push(
        '⑮ 台账条目契约 = {path,sha256,bytes};形态不齐即 ledger-entry-malformed,路径归一为 POSIX 相对形',
        okLedger.ok === true &&
          okLedger.entries[0].path === 'lib/deep/a.js' &&
          ledgerOf({ name: 'p', [LEDGER_FIELD]: [{ ...good, sha256: 'a'.repeat(63) }] }).reason ===
            'ledger-entry-malformed' &&
          ledgerOf({ name: 'p', [LEDGER_FIELD]: [{ ...good, bytes: -1 }] }).reason ===
            'ledger-entry-malformed' &&
          ledgerOf({ name: 'p', [LEDGER_FIELD]: [{ ...good, path: 'a\\b\\c.js' }] }).ok === true,
      )
      // 漂移键的类别维度(不并桶的留痕形态)
      push(
        '⑮b 漂移身份键 = name::class::path,三类互不共键',
        driftKeyOf('p1', 'missing', 'a.js') === 'p1::missing::a.js' &&
          new Set([
            driftKeyOf('p1', 'missing', 'a.js'),
            driftKeyOf('p1', 'mismatch', 'a.js'),
            driftKeyOf('p1', 'unlisted', 'a.js'),
          ]).size === 3,
      )
    }

    // ⑯ 深层目录逐文件入账(相对路径以 POSIX 分隔进台账),一致 ⇒ ok
    {
      const files = { 'plugin.json': 'p', 'lib/deep/a.js': 'AAA', 'assets/i18n/en.json': '{}' }
      const root = writeFixtureRoot(join(scratch, 'case-nested'), { p1: files }, [
        { name: 'p1', [LEDGER_FIELD]: digestOf(files) },
      ])
      const r = reconcile(readRegistry(root, DEFAULT_FSA).records, root, DEFAULT_FSA)
      push(
        '⑯ 深层目录逐文件入账(lib/deep/a.js + assets/i18n/en.json)且一致 ⇒ ok(disk=ledger=3)',
        r.verdict === 'ok' && r.judged[0].counts.disk === 3 && r.judged[0].counts.ledger === 3,
      )
    }

    // ⑰ 装机根解析:IHUI_HOME 优先,与写侧 paths.ts 同一取值序;--plugins-root 覆盖
    {
      const a = resolvePluginsRoot({
        IHUI_HOME: join(scratch, 'iH'),
        HOME: '/h',
        USERPROFILE: '/u',
      })
      const b = resolvePluginsRoot({ HOME: join(scratch, 'h'), USERPROFILE: '/u' })
      const c = resolvePluginsRoot({ USERPROFILE: join(scratch, 'u') })
      const ov = resolvePluginsRoot({}, join(scratch, 'given'))
      push(
        '⑰ 取值序 IHUI_HOME>HOME>USERPROFILE,--plugins-root 覆盖之;根恒为 <home>/.ihui/installed-plugins',
        a.root === join(scratch, 'iH', '.ihui', 'installed-plugins') &&
          b.root === join(scratch, 'h', '.ihui', 'installed-plugins') &&
          c.root === join(scratch, 'u', '.ihui', 'installed-plugins') &&
          ov.root === resolve(join(scratch, 'given')) &&
          ov.source === '--plugins-root',
      )
    }

    // ⑱ 缺席装机面不等于一致:根不存在 / 台账不存在 ⇒ unjudged(绝不静默记绿)
    {
      const neverRoot = resolvePluginsRoot({ IHUI_HOME: join(scratch, 'never-written') })
      push(
        '⑱ 未装机的根 ⇒ registry-unreadable 且 reconcile([]) 落 unjudged(缺席不是"一致")',
        readRegistry(neverRoot.root, DEFAULT_FSA).reason === 'registry-unreadable' &&
          reconcile([], neverRoot.root, DEFAULT_FSA).verdict === 'unjudged',
      )
    }
  } finally {
    rmScratch(scratch)
  }

  let failed = 0
  for (const [name, ok] of cases) {
    console.log(`${ok ? '✅' : '❌'} ${name}`)
    if (!ok) failed += 1
  }
  console.log(`${PREFIX} [self-test] ${cases.length - failed}/${cases.length} 通过`)
  return failed === 0
}

// ==================== CLI ====================
export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) {
    console.log(
      [
        '用法: node scripts/check-plugin-manifest-integrity.mjs [--json] [--name <plugin>]',
        '      [--plugins-root <dir>] [--baseline <file>] [--print-baseline] [--self-test]',
        '      (--staged 被接受但判序与全量档同一把尺 —— 本门判机器装机态,无仓内取材面)',
        '只读:本门绝不写盘、绝不自愈、绝不重装;判据唯一实现 = 本文件(镜像测试 import __test__)。',
        '退出码: 0 ok / 1 drift / 2 unjudged',
      ].join('\n'),
    )
    return EXIT.OK
  }
  if (argv.includes('--self-test')) {
    return selfTest() ? EXIT.OK : EXIT.DRIFT
  }

  const VALUE_FLAGS = ['name', 'plugins-root', 'baseline']
  const unknown = []
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--json' || a === '--staged' || a === '--print-baseline') continue
    const eq = VALUE_FLAGS.find((f) => a === `--${f}` || a.startsWith(`--${f}=`))
    if (eq) {
      if (a === `--${eq}`) i += 1 // 吃掉它的取值
      continue
    }
    unknown.push(a)
  }
  if (unknown.length > 0) {
    console.error(`${PREFIX} 不认的参数: ${unknown.join(' ')}(未知参数不静默忽略,按未判定处置)`)
    return EXIT.UNDETERMINED
  }

  const flagValue = (name) => {
    const eq = argv.find((a) => a.startsWith(`--${name}=`))
    if (eq) return eq.slice(name.length + 3)
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv[i + 1] : undefined
  }

  const undetermined = (line) => {
    console.log(`${PREFIX} ${line}`)
    console.log(
      `${PREFIX} 结论: unjudged(输入取不到 / 有记录无从证;不记绿也不冒红) 棘轮=absent(未给 --baseline:新增 vs 存量无从判)`,
    )
    return EXIT.UNDETERMINED
  }

  const { root, source } = resolvePluginsRoot(process.env, flagValue('plugins-root') ?? null)
  const only = flagValue('name') ?? null

  if (!existsSync(root)) return undetermined(`装机根不存在: ${root}(来源=${source})⇒ 未判定,不记绿`)

  const rr = readRegistry(root, DEFAULT_FSA)
  if (!rr.ok) {
    return undetermined(
      `台账读不到: ${rr.file} reason=${rr.reason}${rr.errno ? ` errno=${rr.errno}` : ''}`,
    )
  }

  const records = only ? rr.records.filter((r) => r && r.name === only) : rr.records
  const result = reconcile(records, root, DEFAULT_FSA)
  if (only && records.length === 0) {
    result.verdict = 'unjudged'
    result.reason = 'name-not-in-registry'
  }

  const baselineArg = flagValue('baseline') ?? null
  const baseline = baselineArg ? loadBaseline(baselineArg, DEFAULT_FSA) : null
  const ratchet = applyRatchet(result, baseline)

  if (argv.includes('--print-baseline')) {
    // 只打到 stdout:把"要不要留档"的决定权留给调用方,本门一律不写盘。
    console.log(JSON.stringify({ version: 1, driftKeys: result.driftItems }, null, 2))
  } else if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...result, ratchet, rootSource: source }, null, 2))
  } else {
    printHuman(result, ratchet)
  }
  return result.verdict === 'ok'
    ? EXIT.OK
    : result.verdict === 'drift'
      ? EXIT.DRIFT
      : EXIT.UNDETERMINED
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`${PREFIX} ❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exitCode = EXIT.UNDETERMINED
  }
}

export const __test__ = {
  EXIT,
  LEDGER_FIELD,
  WALK_FUSE,
  resolvePluginsRoot,
  readRegistry,
  usableRecordName,
  ledgerOf,
  walkInstallRoot,
  judgeRecord,
  reconcile,
  driftKeyOf,
  driftItemsOf,
  parseBaseline,
  loadBaseline,
  applyRatchet,
  printHuman,
  selfTest,
  main,
  // 夹具机制的唯一实现也一并交出去:镜像测试用它造面,不在测试里再造第二份(§0.6/门 191)。
  fixture: { digestOf, writeFixtureRoot, fakeFsa },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
