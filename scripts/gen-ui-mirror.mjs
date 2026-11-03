#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 派生器:必须打印逐对结论与差集 */
/**
 * gen-ui-mirror.mjs —— 「RN 壳 → 小程序壳」的 spec 绑定块派生器(2026-10-28 立)。
 *
 * 为什么要有它(现读):`packages/shared/src/ui/*-spec.ts` 是取值单源,但**档 → 类**的映射表仍是
 * 两端各抄一份。`check-ui-spec-mirror.mjs` 只判「这个常量名有没有出现在壳里」——它判不了
 * 「同一个 12px 档,RN 映射成 p-3、小程序映射成 p-4」这种**取值漂移**(Card 同屏错位就是这么来的:
 * 两端都在源码里写了 CARD_PADDING_PX,但一端落在块上、一端压在根上,名字接上了、值没接上)。
 *
 * 本器补的正是那一格:两端几何映射表(形如 `const X_CLASS: Record<number, string> = { 12: 'p-3' }`)
 * **必须逐字相等**,且只允许由 RN 壳单方持有后派生到小程序壳。理由:
 *   · 两端都写 Tailwind 风格类,同一档位在 nativewind 与 weapp-tailwindcss 下是同一个类名字面量;
 *   · 类名字面量必须留在壳文件里(spec 不在扫描面内),所以不能把映射搬进 spec,
 *     只能「RN 壳定一次,小程序壳镜像同一份」——这正是「一模一样」契约可机械复核的那一半。
 *
 * 判什么(纯文本,零 AST 依赖,零判据复算):
 *   · 绑定块 = 该 spec 的 import 语句 + 所有**直接引用 spec 导出名**的顶层 `const` 声明;
 *   · 与 RN 壳逐条比对:声明名集合、每条声明的归一化正文(去行尾空白);
 *   · 小程序壳缺哪条 / 哪条不同 ⇒ 红灯并逐条点名。
 *
 * `--apply` 只做两件事:把 RN 的 spec import 原样落到小程序壳、把不一致的映射声明原样覆盖/补齐
 * (缺的插在最后一条 import 之后)。**不生成结构**:组件结构属平台承载(规则6),仍由端内手写,
 * 本器绝不改写 JSX 体。
 *
 * 取材面:本器是写盘器物,**恒读工作树**(2026-11-03 核实:读出口 readDisk = readFileSync(join(ROOT,…))、
 * 写出口 writeFileSync 同面 —— 与 §0.4「全量档判 HEAD blob」是**两回事**:本器不属守门档,它要把 RN 壳
 * 的当前字节派生进小程序壳,只读面结构上写不了盘;入库面判定归 check-ui-spec-mirror.mjs(它默认 HEAD blob)。
 * 落点账本登记同样按工作树 blob 实测(与 collectiblePaths 的 worktree 面同尺)。
 *
 * 退出码(§0.3):0 = 全部一致(或不在射程);1 = 有漂移;2 = 未判定(取不到 spec / 两端壳缺一)。
 *
 * 写盘申报(2026-11-03 立,与其它七条跨端写盘腿同形):`--apply` 成功写出的小程序壳,批末逐枚
 * 实测工作树 blob 后追写 `scripts/lib/cross-end-landing-ledger.mjs` 账本(leg 名见 CROSS_END_LEG),
 * 落库交给收编侧按「账本在册 ∧ 工作树 blob 逐字节等于登记 oid ∧ 超静默期 ∧ 非 ignored」处理;
 * 只读档(不带 --apply)与预演一个字节都不登记。轮首先读账本:本 leg 已登记 ∧ 工作树 blob 仍未动
 * ⇒ 该枚本轮不重写(否则会把「待收编副本」改写成第二形态,收编侧只能判 contested),报 skipLanded。
 * 写了盘没登记上 ⇒ landingError 点名并把结论按失败计(§0.3 不得冒成功);账本读不到 ⇒ 照旧全量
 * 尝试 + `ledger=unjudged`,不退场不判死。
 *
 * 归属闸(2026-11-03 立,挂守护周期腿的**前置条件**):落点小程序壳出现在 `git status --porcelain`
 * 里(他席未提交改动 / 已暂存 / 未跟踪)⇒ 归属未知 ⇒ **本轮不写**,进 held 集并逐条点名;脏集本身
 * 取不到 ⇒ 一条都不写并标 `ownership=unjudged`(失效方向恒为"少写一次",绝不覆盖别人的在飞工作,
 * AGENTS.md §12/§16)。判据单源 = `scripts/lib/git-paths.mjs`(与三枚 lander、fix-rn-color-literals
 * 同一份,§0.6/门 191)。闸只挡写盘动作,红/绿/未判定三档计数与退出码判序一字未动。
 *
 * Usage:
 *   node scripts/gen-ui-mirror.mjs                 # 只读对账(全部配对)
 *   node scripts/gen-ui-mirror.mjs --only=switch   # 只判一对
 *   node scripts/gen-ui-mirror.mjs --apply         # 落盘(幂等,且过归属闸)
 *   node scripts/gen-ui-mirror.mjs --self-test     # 纯内存夹具自检
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  parseWaivers,
  todayIso,
  waiverVerdict,
  normalizeFractionalSpacing,
  fractionalToRpx,
  WAIVER_LEDGER_REL,
} from './lib/ui-mirror-waivers.mjs'
// 写盘申报账本(2026-11-03 立):落点判据/幂等/形状校验全在库内,本文件只调它(§0.6 单一真相源)。
import { appendLanding, isRowComplete, readLanding, ledgerPathFor } from './lib/cross-end-landing-ledger.mjs'
// 取 oid 与 collectiblePaths 同尺:库内 worktree 面用 gitRaw(['hash-object','--',rel], root),
// 这里必须问同一把尺(自拼裸 git 或换 hash-object 参数 = 两侧算法不一致 ⇒ 永远 contested)。
import { gitRaw } from './lib/face-reader.mjs'
// 归属闸(2026-11-03 立,挂守护周期腿的**前置条件**):判据单源 = scripts/lib/git-paths.mjs
// (三枚 lander 与 fix-rn-color-literals 共用同一份,§0.6 / 门 191 —— 本文件不得再写第二份)。
// 多会话共享工作区里,自动腿写他席正在编辑的文件 = 覆盖别人的未提交工作(§12/§16 事故型)。
// 判据与点名文案都在库里(`ownershipGate` = `ownershipDirtyPathsDetailed` + `isCleanOwned` 的带文案适配)。
import { isCleanOwned, ownershipGate } from './lib/git-paths.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RN_DIR = 'packages/ui-native/src'
const MP_DIR = 'apps/miniapp-taro/src/components'
const SPEC_DIR = 'packages/shared/src/ui'

/**
 * 本腿的在册短名。**逐字取既有自称名,不自立新名**(取证 `git grep -n "gen-ui-mirror"`):
 *   · `scripts/git-guardian.mjs` 对它**零命中**(守护只在 sweepParityCockpit 里派生 parity-auto,
 *     且只传 --json ⇒ 本腿从未被守护带过写档);
 *   · 全仓唯一给它登记过名字的地方 = `scripts/parity-auto.mjs` 的 `id: 'ui-mirror'`(:124),
 *     同文件 `SELF_HEALABLE`(:68)也以这个名字把本腿列为「红灯可机器自修」;
 *   · 同族素材同名:豁免台账 `scripts/data/ui-mirror-waivers.json`(lib/ui-mirror-waivers.mjs 的
 *     WAIVER_LEDGER_REL)。
 * 对照证据由 scripts/tests/gen-ui-mirror-landing.test.mjs 钉(名字必须逐字出现在 parity-auto 源里)。
 */
export const CROSS_END_LEG = 'ui-mirror'

// ─── 写盘申报账本层(2026-11-03 立,七枚跨端写盘腿同形)────────────────────────
/** 与 collectiblePaths(worktree 面)同一把尺取当前 blob oid;取不到 ⇒ null(点名不猜)。 */
export function worktreeBlobOid(rel, root = ROOT) {
  try {
    return String(gitRaw(['hash-object', '--', rel], root)).trim().toLowerCase()
  } catch {
    return null
  }
}

/** 本 leg 在册且行完整的 path→oid 映射;账本取不到 ⇒ {ok:false, reason}(不冒充空集)。 */
export function landedOidMap({ root = ROOT, leg = CROSS_END_LEG } = {}) {
  const rd = readLanding({ root })
  if (!rd.ok) return { ok: false, reason: rd.reason, map: new Map() }
  const map = new Map()
  for (const row of rd.lines) {
    if (String(row?.leg ?? '') !== leg || !isRowComplete(row)) continue
    map.set(String(row.path), String(row.blobOid).trim().toLowerCase())
  }
  return { ok: true, reason: null, map }
}

/** 「本 leg 已登记 ∧ 工作树 blob 仍等于登记 oid」的路径 ⇒ 本轮视为已完成。 */
export function landedSkips(paths, { root = ROOT, leg = CROSS_END_LEG } = {}) {
  const rd = landedOidMap({ root, leg })
  if (!rd.ok) return { skip: [], ledger: 'unjudged', reason: rd.reason }
  const skip = []
  for (const p of paths || []) {
    const oid = rd.map.get(p)
    if (oid && worktreeBlobOid(p, root) === oid) skip.push(p)
  }
  return { skip, ledger: null, reason: null }
}

/** 批末申报:写了盘的文件逐枚实测 oid 进账本。写了盘没登记上 ⇒ landingError 点名,不冒成功。 */
export function registerLandings(paths, { root = ROOT, leg = CROSS_END_LEG, at = new Date().toISOString() } = {}) {
  const list = [...new Set(paths || [])]
  if (list.length === 0) return { landing: 0, appended: 0, deduped: 0, rejected: [] }
  const entries = []
  const unhashable = []
  for (const p of list) {
    const oid = worktreeBlobOid(p, root)
    if (!oid) {
      unhashable.push(p)
      continue
    }
    entries.push({ at, leg, path: p, blobOid: oid })
  }
  try {
    const ap = appendLanding(entries, { root })
    const out = {
      landing: ap.appended + ap.deduped,
      appended: ap.appended,
      deduped: ap.deduped,
      rejected: ap.rejected,
    }
    const errs = []
    if (ap.rejected.length)
      errs.push(`账本拒收:${ap.rejected.map((r) => `${r.path}(${r.reason})`).join(' ')}`)
    if (unhashable.length) errs.push(`落点 blob 取不到:${unhashable.join(' ')}`)
    if (errs.length) out.landingError = errs.join(' | ')
    return out
  } catch (e) {
    return {
      landing: 0,
      appended: 0,
      deduped: 0,
      rejected: [],
      landingError: `账本写盘失败:${String(e?.message ?? e).split('\n')[0]}`,
    }
  }
}

/** 豁免台账:本器恒读工作树(与它判的两端壳同面),判序 import lib 单源,不写第二份。 */
function loadWaivers(root = ROOT) {
  const abs = join(root, WAIVER_LEDGER_REL)
  if (!existsSync(abs)) return { ok: true, waivers: [], absent: true }
  return parseWaivers(readFileSync(abs, 'utf8'))
}

/** kebab → Pascal(小程序壳命名口径,与 check-ui-spec-mirror.pascalOf 同形)。 */
export function pascalOf(kebab) {
  return kebab
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
}

/** 归一化:统一换行、逐行去行尾空白、整体去首尾空白。比较只认这个面。 */
export function norm(text) {
  return String(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .trim()
}

/** 源码里所有顶层 import 语句(含多行形态),返回 {text,start,end,source}。 */
export function importsOf(src) {
  const out = []
  const re = /^import\b[\s\S]*?from\s+'([^']+)'\s*;?\s*$/gm
  let m
  while ((m = re.exec(src)) !== null) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length, source: m[1] })
  }
  return out
}

/** 从 import 语句里取被导入的标识符名(去掉 `type ` 前缀;含别名时取本地名)。 */
export function importedNamesOf(importText) {
  const brace = /\{([\s\S]*?)\}/.exec(importText)
  if (!brace) return []
  return brace[1]
    .split(',')
    .map((part) => part.trim().replace(/^type\s+/, ''))
    .filter(Boolean)
    .map((part) => {
      const alias = /\bas\s+([A-Za-z_$][\w$]*)$/.exec(part)
      return alias ? alias[1] : part
    })
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
}

/**
 * 顶层 `const` 声明(含多行对象/多行串联),返回 {name,text,start,end}。
 * 结束判定 = 括号深度归零后的行,且该行以 `}` / `;` / `'` / `"` / `)` 结尾(单行声明立即结束)。
 */
export function topLevelConstsOf(src) {
  const lines = src.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    if (!/^const\s+[A-Za-z_$][\w$]*/.test(lines[i])) {
      i += 1
      continue
    }
    const name = /^const\s+([A-Za-z_$][\w$]*)/.exec(lines[i])[1]
    const startLine = i
    let depth = 0
    let quote = null
    let done = false
    while (i < lines.length) {
      const line = lines[i]
      for (let k = 0; k < line.length; k += 1) {
        const ch = line[k]
        if (quote) {
          if (ch === '\\') k += 1
          else if (ch === quote) quote = null
          continue
        }
        if (ch === "'" || ch === '"' || ch === '`') quote = ch
        else if (ch === '{' || ch === '(' || ch === '[') depth += 1
        else if (ch === '}' || ch === ')' || ch === ']') depth -= 1
      }
      i += 1
      if (depth === 0) {
        // 括号已归零:下一非空行若以成员访问/运算符/逗号起头,说明语句仍在续写。
        // 注释行不算续写(一条 `/** … */` 文档块紧跟声明,不能被吸进声明里)。
        let next = ''
        for (let n = i; n < lines.length; n += 1) {
          const candidate = lines[n].trim()
          if (!candidate || /^(\/\/|\/\*|\*)/.test(candidate)) continue
          next = candidate
          break
        }
        if (!/^[.?:+\-*/&|,]/.test(next)) {
          done = true
          break
        }
      }
      if (depth < 0) {
        done = true
        break
      }
    }
    if (!done) throw new Error(`顶层 const 声明不闭合: ${name}`)
    out.push({ name, text: lines.slice(startLine, i).join('\n'), start: startLine, end: i })
  }
  return out
}

/** 该壳的 spec import(第一个 `@ihui/shared/ui/<slug>-spec`),无则 null。 */
export function specImportOf(src) {
  return (
    importsOf(src).find((stmt) => /^@ihui\/shared\/ui\/[a-z0-9-]+-spec$/.test(stmt.source)) || null
  )
}

/**
 * 把一条映射声明里的**扁平对象字面量**压成可跨端比较的签名:键集合 + 每个键的类名字面量。
 * 只认 `{ 12: 'p-3', md: 'rounded-md' }` 形态;嵌套对象 / 数组 join / 表达式 ⇒ 返回 null,
 * 调用方退回「同名声明逐字比较」(那种形态无法脱离表达式求值,不硬判)。
 */
export function mapSignatureOf(declText) {
  const eq = declText.indexOf('=')
  if (eq < 0) return null
  const open = declText.indexOf('{', eq)
  if (open < 0) return null
  const close = declText.lastIndexOf('}')
  if (close <= open) return null
  const body = declText.slice(open + 1, close)
  const parts = []
  let cur = ''
  let depth = 0
  let quote = null
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (quote) {
      cur += ch
      if (ch === '\\') {
        cur += body[i + 1] || ''
        i += 1
      } else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      cur += ch
    } else if (ch === '{' || ch === '(' || ch === '[') {
      depth += 1
      cur += ch
    } else if (ch === '}' || ch === ')' || ch === ']') {
      depth -= 1
      cur += ch
    } else if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  const pairs = []
  for (const part of parts) {
    const m =
      /^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*(?:'([^']*)'|"([^"]*)")\s*$/.exec(part)
    if (!m) return null
    pairs.push(`${m[1] ?? m[2] ?? m[3]}=${m[4] ?? m[5]}`)
  }
  return pairs.length ? pairs.sort().join('|') : null
}

/** 绑定声明 = 顶层 const 里的「档 → 类」映射与 spec 引用常量。两种命中任一即可:
 *  ① 名字以 CLASS / CLASSES 收尾(两端几何映射的命名口径);
 *  ② 正文真的引用了 spec 导出名(如 `ANIM_DURATION = SHEET_ANIM_DURATION_MS`、类型级键约束)。
 *  注释里提一嘴不算 —— 命中判定前先剥行首注释。 */
export function bindingDeclsOf(src, specNames) {
  return topLevelConstsOf(src).filter((decl) => {
    if (/(CLASS|CLASSES)$/.test(decl.name)) return true
    if (!specNames.length) return false
    const body = decl.text
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n')
    return specNames.some((name) => new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(body))
  })
}

/** 一对壳的比对:返回 {slug, rn, mp, issues[], missing[], drifted[], undetermined?}。 */
export function comparePair(rnSrc, mpSrc, opts = {}) {
  const waivedNames = opts.waivedNames || []
  const rnImport = specImportOf(rnSrc)
  if (!rnImport) return { undetermined: 'RN 壳没有 spec import' }
  const slug = /@ihui\/shared\/ui\/([a-z0-9-]+)-spec$/.exec(rnImport.source)[1]
  const mpImport = importsOf(mpSrc).find((stmt) => stmt.source === rnImport.source) || null
  const issues = []

  const rnNames = importedNamesOf(rnImport.text)
  const mpNames = mpImport ? importedNamesOf(mpImport.text) : []
  const missingAll = rnNames.filter((name) => !mpNames.includes(name))
  const missingImportNames = missingAll.filter((name) => !waivedNames.includes(name))
  if (!mpImport) issues.push('小程序壳没有该 spec 的 import 语句')
  else if (missingImportNames.length)
    issues.push(`小程序壳 import 缺名: ${missingImportNames.join(', ')}`)

  const rnDecls = bindingDeclsOf(rnSrc, rnNames)
  const mpDecls = bindingDeclsOf(mpSrc, rnNames)
  const mpByName = new Map(mpDecls.map((decl) => [decl.name, decl]))
  const missing = []
  const drifted = []
  const renamed = []
  for (const decl of rnDecls) {
    // 两端同一把等值尺:fractional 档与等值裸 rpx 是**同一像素**,不得判成漂移
    // (判序单源 = lib/ui-mirror-waivers.mjs;本端写 fractional 会产不出可挂载规则,见该函数立因)。
    const rnSig = mapSignatureOf(normalizeFractionalSpacing(decl.text))
    const peer = mpByName.get(decl.name)
    if (peer) {
      const mpSig = mapSignatureOf(normalizeFractionalSpacing(peer.text))
      const same =
        rnSig && mpSig
          ? rnSig === mpSig
          : normalizeFractionalSpacing(norm(peer.text)) ===
            normalizeFractionalSpacing(norm(decl.text))
      if (!same) drifted.push(decl.name)
      continue
    }
    if (rnSig && mpDecls.some((item) => mapSignatureOf(normalizeFractionalSpacing(item.text)) === rnSig)) {
      renamed.push(decl.name)
      continue
    }
    missing.push(decl.name)
  }
  if (missing.length) issues.push(`小程序壳缺绑定声明: ${missing.join(', ')}`)
  if (drifted.length) issues.push(`小程序壳绑定声明与 RN 不一致: ${drifted.join(', ')}`)

  return {
    slug,
    rn: rnSrc,
    mp: mpSrc,
    rnImport,
    mpImport,
    rnDecls,
    issues,
    missing,
    drifted,
    renamed,
    missingImportNamesAll: missingAll,
  }
}

/** 派生落盘:只换 spec import + 覆盖/补齐绑定声明,不碰 JSX 体。 */
export function applyPair(rnSrc, mpSrc, opts = {}) {
  const cmp = comparePair(rnSrc, mpSrc, opts)
  if (cmp.undetermined) return { text: mpSrc, changed: false, cmp }
  if (!cmp.issues.length) return { text: mpSrc, changed: false, cmp }

  let text = mpSrc
  const rnNames = importedNamesOf(cmp.rnImport.text)
  const waived = opts.waivedNames || []

  // 1) spec import:整条替换(名字顺序/换行随 RN,防止两端 import 面漂移)。
  //    本对有具名豁免时**不动 import** —— 照抄 RN 的导入会把免掉的名称写成端内未消费导入(lint 红)。
  if (!waived.length) {
    const mpImport = importsOf(text).find((stmt) => stmt.source === cmp.rnImport.source)
    if (mpImport)
      text = text.slice(0, mpImport.start) + cmp.rnImport.text + text.slice(mpImport.end)
    else {
      const imports = importsOf(text)
      const at = imports.length ? imports[imports.length - 1].end : 0
      text = text.slice(0, at) + '\n' + cmp.rnImport.text + text.slice(at)
    }
  }

  // 2) 绑定声明:同名覆盖,缺的插到 import 段之后;每次改动后重扫(行号会漂移)
  for (const decl of cmp.rnDecls) {
    const current = bindingDeclsOf(text, rnNames)
    const peer = current.find((item) => item.name === decl.name)
    const rnSig = mapSignatureOf(decl.text)
    if (peer) {
      const mpSig = mapSignatureOf(peer.text)
      const same = rnSig && mpSig ? rnSig === mpSig : norm(peer.text) === norm(decl.text)
      if (same) continue
      const lines = text.split('\n')
      text = [
        ...lines.slice(0, peer.start),
        ...decl.text.split('\n'),
        ...lines.slice(peer.end),
      ].join('\n')
      continue
    }
    if (rnSig && current.some((item) => mapSignatureOf(item.text) === rnSig)) continue
    const imports = importsOf(text)
    const at = imports.length ? imports[imports.length - 1].end : 0
    text = text.slice(0, at) + '\n\n' + decl.text + text.slice(at)
  }
  return { text, changed: norm(text) !== norm(mpSrc), cmp }
}

// ---------- 主流程 ----------

function readDisk(rel, root = ROOT) {
  const abs = join(root, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

function pairsOf(only, root = ROOT) {
  const specs = existsSync(join(root, SPEC_DIR))
    ? readdirSync(join(root, SPEC_DIR))
        .filter((file) => file.endsWith('-spec.ts'))
        .map((file) => file.replace(/-spec\.ts$/, ''))
    : []
  const rnFiles = existsSync(join(root, RN_DIR)) ? readdirSync(join(root, RN_DIR)) : []
  const mpFiles = existsSync(join(root, MP_DIR)) ? readdirSync(join(root, MP_DIR)) : []
  return specs
    .filter((slug) => !only.length || only.includes(slug))
    .map((slug) => {
      const rnRel = `${RN_DIR}/${slug}.tsx`
      const mpRel = `${MP_DIR}/${pascalOf(slug)}.tsx`
      return {
        slug,
        rnRel,
        mpRel,
        hasRn: rnFiles.includes(`${slug}.tsx`),
        hasMp: mpFiles.includes(`${pascalOf(slug)}.tsx`),
        hasSpec: true,
      }
    })
}

async function main(argv, opts = {}) {
  const root = opts.root ?? ROOT
  const args = new Set(argv)
  const only = (argv.find((a) => a.startsWith('--only=')) || '')
    .slice('--only='.length)
    .split(',')
    .filter(Boolean)
  if (args.has('--self-test')) return selfTest()
  const apply = args.has('--apply')
  const today = process.env.UI_MIRROR_TODAY || todayIso()
  const ledger = loadWaivers(root)
  if (!ledger.ok) {
    console.log(
      `? 豁免台账 ${WAIVER_LEDGER_REL} 解析不了: ${ledger.error}(未判定,不记绿也不冒红)`,
    )
    return 2
  }

  // 轮首读一次落点账本(只读,零写);读不到 ⇒ ledger=unjudged,照旧全量尝试,不退场(§0.3)。
  const landed = landedOidMap({ root })
  const skipLanded = []
  const writtenPaths = []
  // 归属闸(2026-11-03):整轮取一次脏集(只读 git 动作);只挡写盘,不动任何计数与退出码判序。
  const ownership = ownershipGate({ root })
  const held = []

  const rows = pairsOf(only, root)
  let red = 0
  let undetermined = 0
  let green = 0
  for (const row of rows) {
    if (!row.hasRn || !row.hasMp) {
      console.log(`· ${row.slug.padEnd(18)} 两端壳缺一(不在射程)`)
      continue
    }
    const rn = readDisk(row.rnRel, root)
    const mp = readDisk(row.mpRel, root)
    if (rn === null || mp === null) {
      undetermined += 1
      console.log(`? ${row.slug.padEnd(18)} 取不到壳源码(未判定)`)
      continue
    }
    const raw = comparePair(rn, mp)
    if (raw.undetermined) {
      undetermined += 1
      console.log(`? ${row.slug.padEnd(18)} ${raw.undetermined}(未判定)`)
      continue
    }
    const verdict = waiverVerdict(row.slug, raw.missingImportNamesAll, ledger.waivers, today)
    const cmp = comparePair(rn, mp, { waivedNames: verdict.used })
    if (verdict.expired.length) cmp.issues.push(`豁免已到期: ${verdict.expired.join(', ')}`)
    if (verdict.rot.length) cmp.issues.push(`豁免清单腐烂: ${verdict.rot.join(', ')}`)
    if (!cmp.issues.length) {
      green += 1
      const renamed = cmp.renamed.length ? `(命名不同但取值一致: ${cmp.renamed.join(', ')})` : ''
      const waivedNote = verdict.used.length ? `(已验豁免 ${verdict.used.length} 名)` : ''
      console.log(
        `✅ ${row.slug.padEnd(18)} 绑定块一致(${cmp.rnDecls.length} 条映射)${renamed}${waivedNote}`,
      )
      continue
    }
    red += 1
    console.log(`🔴 ${row.slug.padEnd(18)} ${cmp.issues.join(';')}`)
    // 「本 leg 已登记 ∧ 工作树 blob 仍未动」⇒ 这一枚是待收编副本,本轮不再改写它
    // (改写了就把收编侧唯一的凭据换成第二形态,只能判 contested ⇒ 谁也都落不了库)。
    const pendingOid = landed.ok ? landed.map.get(row.mpRel) : null
    if (pendingOid && worktreeBlobOid(row.mpRel, root) === pendingOid) {
      skipLanded.push(row.mpRel)
      console.log(`   ↳ 已登记待收编(工作树 blob 未动)⇒ 本轮不重写 ${row.mpRel}`)
      continue
    }
    // 归属闸:落点在他席手里(或脏集取不到)⇒ 本轮不写,**逐条点名**(只报总数不可,§0.3/§12)。
    const blocked = ownership.blocked(row.mpRel)
    if (blocked) {
      held.push(blocked)
      console.log(`   ↳ 🔒 归属未明(他席在飞/取不到)⇒ 本轮不写 ${blocked}`)
      continue
    }
    if (apply) {
      const out = applyPair(rn, mp, { waivedNames: verdict.used })
      if (out.changed) {
        writeFileSync(join(root, row.mpRel), out.text, 'utf8')
        writtenPaths.push(row.mpRel)
        console.log(`   ↳ 已写回 ${row.mpRel}(仅 import + 绑定声明)`)
      }
    }
  }
  // 批末一次申报:只对**本批真写了盘**的路径(只读档 writtenPaths 恒空 ⇒ 结构上零登记)。
  const landingInfo = registerLandings(writtenPaths, { root })
  console.log('─'.repeat(64))
  console.log(`配对 ${green + red} · ✅一致 ${green} · 🔴漂移 ${red} · ?未判定 ${undetermined}`)
  if (held.length)
    console.log(
      `  🔒 held(归属未明,不猜 ⇒ 本轮不写)${held.length} 枚:${held.slice(0, 6).join(', ')}${held.length > 6 ? ' …' : ''}`,
    )
  console.log(
    `结论 landing=${landingInfo.landing}(新登记 ${landingInfo.appended}/在册去重 ${landingInfo.deduped})` +
      ` skipLanded=${skipLanded.length}` +
      ` held=${held.length}` +
      (ownership.ok ? '' : ' ownership=unjudged') +
      ` 写出=${writtenPaths.length}` +
      (landingInfo.landingError ? ` landingError=${landingInfo.landingError}` : '') +
      (landed.ok ? '' : ' ledger=unjudged') +
      ` landingPath=${ledgerPathFor(root)}`,
  )
  let code = undetermined ? 2 : red ? 1 : 0
  // 写了盘却没登记上 ⇒ 不得按成功交出去(§0.3「没判过」不能写成「判过」的同族禁令)。
  if (landingInfo.landingError && code === 0) code = 1
  return code
}

// ---------- 自检(纯内存夹具,不碰真仓) ----------

function selfTest() {
  const rn = [
    "import { cn } from '@ihui/design-tokens'",
    'import {',
    '  SWITCH_THUMB_SIZE_PX,',
    '  SWITCH_TRACK_H_PX,',
    '  type SwitchSizeTier,',
    "} from '@ihui/shared/ui/switch-spec'",
    '',
    'const TRACK_H_CLASS: Record<number, string> = { 20: "h-5", 24: "h-6" }',
    'const SIZING: Record<SwitchSizeTier, string> = {',
    "  sm: 'p-1',",
    "  md: 'p-2',",
    '}',
    'const LOCAL_ONLY = 3',
    '',
  ].join('\n')
  const mpOk = [
    "import { cn } from '@ihui/design-tokens'",
    'import {',
    '  SWITCH_THUMB_SIZE_PX,',
    '  SWITCH_TRACK_H_PX,',
    '  type SwitchSizeTier,',
    "} from '@ihui/shared/ui/switch-spec'",
    '',
    'const TRACK_H_CLASS: Record<number, string> = { 20: "h-5", 24: "h-6" }',
    'const SIZING: Record<SwitchSizeTier, string> = {',
    "  sm: 'p-1',",
    "  md: 'p-2',",
    '}',
    '',
  ].join('\n')

  const checks = []
  const ok = (name, cond) => checks.push({ name, cond: Boolean(cond) })

  // T1 import 解析
  const imp = specImportOf(rn)
  ok('T1 spec import 定位', imp && imp.source.endsWith('/switch-spec'))
  ok('T1 import 名字面(含 type 前缀剥离)', importedNamesOf(imp.text).includes('SwitchSizeTier'))

  // T2 绑定声明只收真引用 spec 的顶层 const
  const names = importedNamesOf(imp.text)
  const decls = bindingDeclsOf(rn, names)
  ok('T2 绑定声明命中选择性', decls.map((d) => d.name).join(',') === 'TRACK_H_CLASS,SIZING')

  // T3 一致夹具判绿
  ok('T3 一致夹具无 issue', comparePair(rn, mpOk).issues.length === 0)

  // T4 变异:小程序把 24 档抄成 h-7 ⇒ 必须点名叫漂移
  const mutated = mpOk.replace('24: "h-6"', '24: "h-7"')
  const cmpMut = comparePair(rn, mutated)
  ok('T4 取值漂移被判红', cmpMut.drifted.includes('TRACK_H_CLASS'))

  // T4b 像素等值归一:小程序端 fractional 档在产物里产不出可挂载规则(门 C8 死规则族),
  //   本端只能写等值裸 rpx ⇒ 这一型不是漂移。真仓 Badge/VipBadge 的 PADDING_Y_CLASS 即此型。
  const rnFrac = rn.replace("sm: 'p-1'", "sm: 'p-1.5'")
  const mpEquiv = mpOk.replace("sm: 'p-1'", "sm: 'p-[12rpx]'")
  ok('T4b 等值裸 rpx 不判漂移', comparePair(rnFrac, mpEquiv).drifted.length === 0)
  // T4c/T4c2 反向对照:等值尺不是豁免白名单 —— 像素不同必须仍判得出(否则这把尺自身是坏的)
  ok('T4c 像素不同仍判漂移', comparePair(rnFrac, mpOk).drifted.includes('SIZING'))
  ok(
    'T4c2 rpx 写错值仍判漂移',
    comparePair(rnFrac, mpOk.replace("sm: 'p-1'", "sm: 'p-[20rpx]'")).drifted.includes('SIZING'),
  )
  // T4d 算式钉死:(n+0.5) 档 × 4px × TARO_RPX_PER_PX(2) = (8n+4)rpx;非间距尺一律不碰
  ok(
    'T4d fractional→rpx 算式与非尺不碰',
    ['0.5', '1.5', '2.5', '3.5']
      .map((v) => fractionalToRpx(`py-${v}`))
      .join(',') === 'py-[4rpx],py-[12rpx],py-[20rpx],py-[28rpx]' &&
      fractionalToRpx('rounded-0.5') === 'rounded-0.5' &&
      fractionalToRpx('text-0.5') === 'text-0.5',
  )

  // T5 缺声明被判红,且 --apply 可补齐
  const shrunk = mpOk.replace(/const SIZING[\s\S]*?\n}\n/, '')
  const cmpShrunk = comparePair(rn, shrunk)
  ok('T5 缺声明被判红', cmpShrunk.missing.includes('SIZING'))
  const applied = applyPair(rn, shrunk).text
  ok('T5 apply 后归绿', comparePair(rn, applied).issues.length === 0)

  // T6 apply 幂等
  const once = applyPair(rn, mutated).text
  const twice = applyPair(rn, once).text
  ok('T6 apply 幂等', norm(once) === norm(twice))

  // T7 只换绑定块,不动 JSX 体
  const withBody = mpOk + 'export function X() {\n  return null\n}\n'
  const appliedBody = applyPair(rn, withBody.replace('24: "h-6"', '24: "h-7"')).text
  ok('T7 JSX 体原样保留', appliedBody.includes('return null'))

  // T8 注释里提 spec 名不算绑定
  const commentOnly = '// CARD_PADDING_PX 说明\nconst PLAIN = 1\n'
  ok('T8 注释不算绑定', bindingDeclsOf(commentOnly, ['CARD_PADDING_PX']).length === 0)

  // T9 声明后紧跟文档块 ⇒ 注释不得被吸进声明(VipBadge SIZING_CLASS 实测型:
  //   吸进去后两端正文永不相等,派生器把自己造的差异判成漂移)
  const withTrailingDoc = [
    'const SIZING_CLASS: Record<string, string> = {',
    "  sm: 'p-1',",
    '}',
    '',
    '/** 下一段说明 */',
    'const NEXT_CLASS: Record<string, string> = { md: "p-2" }',
    '',
  ].join('\n')
  const scanned = topLevelConstsOf(withTrailingDoc)
  ok(
    'T9 声明吞并后续注释',
    scanned.length === 2 &&
      scanned[0].text === "const SIZING_CLASS: Record<string, string> = {\n  sm: 'p-1',\n}" &&
      scanned[1].name === 'NEXT_CLASS',
  )

  // T10–T13 豁免族:验过才免、会到期、不再命中即腐烂(§0.7)
  const rnBare =
    "import { A_X, B_Y, C_Z } from '@ihui/shared/ui/switch-spec'\nexport function S() {\n  return null\n}\n"
  const mpBare =
    "import { D_W } from '@ihui/shared/ui/switch-spec'\nexport function M() {\n  return null\n}\n"
  const missingAll = comparePair(rnBare, mpBare).missingImportNamesAll
  ok('T10 缺名先要能全量点名', missingAll.join(',') === 'A_X,B_Y,C_Z')
  const waiver = [
    {
      pair: 'switch',
      names: missingAll,
      reason: '本端承载不允许照抄这一消费形,理由写在台账里',
      reviewBy: '2099-01-01',
    },
  ]
  const usedVerdict = waiverVerdict('switch', missingAll, waiver, '2026-10-28')
  ok('T10 未过期豁免全命中', usedVerdict.used.length === 3 && !usedVerdict.rot.length)
  ok(
    'T10 豁免后判绿且 --apply 不动 import',
    comparePair(rnBare, mpBare, { waivedNames: usedVerdict.used }).issues.length === 0 &&
      applyPair(rnBare, mpBare, { waivedNames: usedVerdict.used }).changed === false,
  )
  const expiredVerdict = waiverVerdict('switch', missingAll, waiver, '2099-06-01')
  ok(
    'T11 到期豁免回队列(不免并点名)',
    !expiredVerdict.used.length && expiredVerdict.expired.length === 3,
  )
  const rotVerdict = waiverVerdict('switch', [], waiver, '2026-10-28')
  ok('T12 被审面不再命中 ⇒ 清单腐烂判红', !rotVerdict.used.length && rotVerdict.rot.length === 3)
  const badVerdict = waiverVerdict(
    'switch',
    missingAll,
    [{ pair: 'switch', names: missingAll, reason: '太短', reviewBy: '2099-1-1' }],
    '2026-10-28',
  )
  ok(
    'T13 坏行(日期形态/理由过短)免不了任何东西',
    !badVerdict.used.length && badVerdict.rot.length === 1,
  )

  // T14–T16 写盘申报层(2026-11-03 立):纯内存档,不碰账本、不碰真仓
  ok('T14 leg 名是 kebab 短名(与 parity-auto 的 stage id 同源)', /^[a-z0-9-]+$/.test(CROSS_END_LEG))
  ok(
    'T15 空批(只读档的登记入口)⇒ landing/appended 皆 0,不进账本 IO',
    registerLandings([]).landing === 0 && registerLandings([]).appended === 0,
  )
  ok(
    'T16 账本读不到 ⇒ landedSkips 报 unjudged 且不抛(失效方向=多要一次)',
    (() => {
      const sk = landedSkips(['packages/ui-native/__no_such__.tsx'], {
        root: join(ROOT, '.ihui-agent', 'tmp', 'gen-ui-mirror-selftest-nonexistent'),
      })
      return sk.ledger === 'unjudged' && sk.skip.length === 0 && typeof sk.reason === 'string'
    })(),
  )

  // T17–T18 归属闸(2026-11-03 立,挂守护周期腿的前置条件):判据 import lib 单源,本器零复算
  ok(
    'T17 脏集取不到(根不存在 ⇒ git 问不动)⇒ ok:false 且每条落点都判"未通过"(点名不返回 null)',
    (() => {
      const g = ownershipGate({ root: join(ROOT, '.ihui-agent', 'tmp', '__no_such_root_for_selftest__') })
      return (
        g.ok === false &&
        g.dirty === null &&
        typeof g.reason === 'string' &&
        g.blocked('apps/miniapp-taro/src/components/Switch.tsx') !== null &&
        String(g.blocked('a.tsx')).includes('归属集取不到')
      )
    })(),
  )
  ok(
    'T18 同一把尺:脏集里的路径被挡、不在集里的放行、脏集为 null 时一律未通过',
    // 断言的是 import 进来的生产出口(§22c:测试/import 都用那一份,本器零复算)
    (() => {
      const dirty = new Set(['apps/miniapp-taro/src/components/Dirty.tsx'])
      return (
        isCleanOwned('apps/miniapp-taro/src/components/Dirty.tsx', dirty) === false &&
        isCleanOwned('apps/miniapp-taro/src/components/Clean.tsx', dirty) === true &&
        isCleanOwned('apps/miniapp-taro/src/components/Clean.tsx', null) === false
      )
    })(),
  )

  for (const check of checks) console.log(`${check.cond ? '✅' : '🔴'} ${check.name}`)
  const failed = checks.filter((check) => !check.cond).length
  console.log(`自检 ${checks.length - failed}/${checks.length}`)
  return failed ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code
    })
    .catch((error) => {
      console.error(`❌ 派生器自身异常(未判定): ${error?.message ?? error}`)
      process.exit(2)
    })
}

/**
 * §22c:暴露给镜像测试的核心判据与**整链入口**(main 可注入 root ⇒ 测试用 mkScratch 真夹具
 * 跑「读工作树 → 派生写盘 → 批末申报 → collectiblePaths 判可收编」全链,不碰真实工作树)。
 * 测试不得复制第二份判据(门 191)。
 */
export const __test__ = {
  main,
  worktreeBlobOid,
  landedOidMap,
  landedSkips,
  registerLandings,
  // 归属闸(§22c:测试 import 生产出口,不复制判据)
  ownershipGate,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
