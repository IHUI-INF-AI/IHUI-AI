#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 包入口 barrel 漏 re-export 对账(**常驻判据**)。
 * 【接线状态:已接入】注册条目已落在 scripts/guardian-runner.mjs(id 以 runner 现值为准,
 * 勿照抄本行数字):blocking + skipEnv:HUSKY_SKIP_PACKAGE_BARREL_EXPORT,带 stagedTriggers。
 * —— 本段原写「**常驻判据**;注册由主会话统一接线 —— 本票禁 git 写操作,所以本文件**不自称已接
 *   提交链**,守门 89 的 R1/R2 因此不会替一句做不到的话背书」,那是立项时的实况,已过期(门早已装车);
 *   「禁 git 写操作」那条约束仍然成立(本次同样未做任何 git 写操作),但它当初是用来解释"为什么没注册",
 *   而今接线早已由主会话落定,拿它当不注册的成因是拿过期的因果糊弄读者。
 *
 * 在修什么(G-215,2026-09-27 立)
 * ─────────────────────────────────
 * `packages/api-client/src/client.ts` 里 `postToolApprovalResponse` 与 `ToolApprovalEvent` 都已
 * export,而入口 `src/index.ts` 是**显式命名清单**(不是 `export *`),漏列这两条 ⇒ 端内
 * `import { postToolApprovalResponse } from '@ihui/api-client'` 拿到 `undefined`,
 * `apps/web/src/components/ai/tool-approval-dialog.tsx` 点「批准」才抛。
 *
 * 为什么建它之前必须先否证(票面要求),以及否证的实测结论(三条全部不覆盖,命令见交付报告):
 *   ① 守门 98(`check-dangling-local-imports.mjs`)方向相反且**射程不含裸包名** —— 它只判
 *      "仓内相对路径"与"某份 tsconfig paths 真能接住的别名"(`auditFile`:`if (!isRel && !aliasRel) continue`),
 *      而全仓 tsconfig **没有任何 `@ihui/*` 的 paths 映射**(实测 grep 零命中),所以
 *      `import { X } from '@ihui/api-client'` 结构上进不了 98 的判据。
 *   ② `pnpm --filter @ihui/web typecheck` 只在 **dist 恰好是从坏源码构建出来的**那一刻才红:
 *      web 的 tsconfig `paths` 只有 `@/*`,裸包名按 `exports → dist/index.d.ts` 解析,**根本不读
 *      `src/index.ts`**;而 `dist/` 被 `.gitignore:67` 整目录忽略 ⇒ 判据读的是本机产物,
 *      不是仓库内容。实测(私有夹具,`.ihui-agent/tmp` 之外的 DevEnv/Temp/ihui-scratch):
 *      同一份"入口漏递 realThing"的包,src+dist 同步 ⇒ TS2305 红;dist 陈旧(仍带该导出)⇒ **exit 0**。
 *   ③ 提交链那道的 16 项 `check-staged-typecheck.mjs` 按头注第 22 行「只把【错误文件属于 staged
 *      文件】的错误视为失败」—— 摘掉 barrel 那一行的人暂存的是 `packages/x/src/index.ts`,
 *      红点却落在端内消费文件上 ⇒ 被过滤掉。而 101(声明↔lock specifier)、78(声明↔链接↔shim)、
 *      126(shared 可达面 node: 纯度)、4(`check-stale-dist`,src↔dist 名单同步,且对 api-client
 *      报 "skip: wildcard re-export")判的都是**别的维度**,没有一条看"符号存在但入口没递出来"。
 *
 * 判据(唯一一条,红条件很窄)
 * ─────────────────────────
 * 对每个 workspace 包 P、每个**裸包名**导入 `import { N } from 'P'`(子路径 `P/x` 不在射程,只报数):
 *   N 在 P 的入口**实际递出**的名单里没有 ∧ N 在 P 的**某个源文件里作为值导出存在** ⇒ 红。
 * 两个条件都要正向证据,所以判据不会把"我看不见"当成"它没有":
 *   · 入口(含跨包再导出)可达图里出现任何一条**枚举不动**的边(三方 `export * from 'react'`、
 *     解析不到的相对目标、exports 映射落空)⇒ 该包整体降为「未判定」,一条都不判红;
 *   · 名字在包内**只以 type/interface 形态**存在(编译期擦除,运行时不构成 undefined)⇒ 另档
 *     `typeMiss`,只点名不判红;
 *   · 名字在包内哪都找不到 ⇒ `notFound`,只点名不判红(那多半是三方 re-export 或 98 的射程)。
 *
 * 口径同 70/77/83/98/101/103/118:全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree`
 * 仅人工逃生舱、两面旗同给 exit 2、取不到判「无法判定」且不回落、枚举到 0 个候选判死。
 * 取材必须走 `face-reader` 的**读取入口** `catBatch`(守门 118:引了层却自己 `git show`/读盘 = 半接线)。
 *
 * 存量与棘轮
 * ─────────
 * 默认档(HEAD 全量)**只报数不判红** —— 与任何提交都无关的恒红门唯一结局是逼人 `--no-verify`,
 * 一次绕过等于全部守门作废(§12e 同型)。问责跑 `--strict`:存量即判红,且**有未判定就 exit 2**
 * (拒绝出具合格证)。`--staged` 档**不随暂存文件收窄判据面**(理由见 main 里的注释:摘掉一行
 * re-export 的那枚提交,暂存里没有消费者文件),棘轮锚点取**该消费者文件 HEAD 自身的红点数** ⇒
 * 只拦"这次把漏出的依赖面扩大了",不把别人欠的存量算成本次的账。
 *
 * 用法:
 *   node scripts/check-package-barrel-export.mjs              # 全量(HEAD 面,存量只报数)
 *   node scripts/check-package-barrel-export.mjs --strict     # 问责档(存量判红;有未判定 exit 2)
 *   node scripts/check-package-barrel-export.mjs --staged     # 提交链档(索引面 + HEAD 棘轮)
 *   node scripts/check-package-barrel-export.mjs --worktree   # 人工排查(磁盘面)
 *   node scripts/check-package-barrel-export.mjs --json       # 机读结论
 *   node scripts/check-package-barrel-export.mjs --root <dir> # 测试/换仓通道:指定仓根(镜像测试拿临时 git 仓用它)
 *   node scripts/check-package-barrel-export.mjs --self-test  # 逻辑自检(正反成对)
 * 紧急跳过:HUSKY_SKIP_PACKAGE_BARREL_EXPORT=1(注册后由 runner 的 skipEnv 提供)
 */

import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
// 消费侧的 import 解析**复用守门 98 那一份实现**,不另写第二份:两处解析同一件事必漂移,
// 而漂移的表现永远是"某一种写法只有一边看得见"(本仓记过多次)。98 有 §22d isDirectRun 守卫,
// import 它不会触发 CLI 主流程。
import {
  buildAliasIndex,
  parseImports,
  resolveAliasSpec,
} from './check-dangling-local-imports.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolvePath(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_PACKAGE_BARREL_EXPORT'
const GIT_TIMEOUT = 180000
/**
 * 判据只吃**包入口**这一族的模块说明符:`@scope/name`(裸包名)。
 * 子路径(`@ihui/api-client/client`)按票面刻意留在射程外(它由 exports 的另一条键解析,
 * 判定形状不同,误纳会把正当的深导入报成漏出)—— 但**必须报名**,否则"没判"读起来像"判过了"。
 */
const SRC_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const SKIP_DIR = /(^|\/)(node_modules|dist|build|coverage|\.next|\.expo|android|ios)\//
/** 目录 barrel:任何 `<dir>/index.(ts|tsx)`。包入口本身也是这种形态,但两面判的**说明符形状不同**
 *  (包面判裸包名,barrel 面判相对/别名),同一条导入不可能被两面各计一次。 */
const BARREL_RE = /(^|\/)index\.(ts|tsx)$/
/** 别名表来源(与守门 98 同一个形状判据,不另立一份) */
const TS_RE = /(^|\/)tsconfig[\w.-]*\.json$/
/** 包内**不参与"存在性"取证**的文件:测试与夹具里的名字不代表对外能力 */
const NON_UNIVERSE = /(^|\/)(tests?|__tests__|e2e|fixtures|testdata)\//
/** 消费者面**不排除**测试文件:测试里 import 一个没递出的名字,运行到那一行同样是 undefined;
 *  存量由"该文件 HEAD 自身计数"的棘轮兜住,不会把别人的在飞测试钉成红。 */
/** 构建产物目录名:exports 指到这些前缀时要剥掉再回源码树找入口 */
const BUILD_DIRS = ['dist', 'build', 'lib', 'out']

// ───────────────────────────────────────────────────────────── 遮噪(判据面)

/**
 * 遮噪:只遮**注释**、保留字符串字面量 —— 模块说明符与导出名都住在字符串/标识符位置,
 * 连字符串一起抹会让判据直接失明(守门 134 的"两处遮噪方向不同"同一条教训)。
 * 但注释判定本身必须**认字符串**,否则 `const u = 'https://x'` 里的 `//` 会假起一段行注释、
 * 把同一行的真 `export { a } from './x'` 抹掉 ⇒ 少算一条出口边 ⇒ **产假红**。
 * 等长替换,行号与列位不变(报告要给 file:line)。
 */
export function maskComments(src) {
  const out = []
  let i = 0
  const blankTo = (end) => {
    while (i < end) {
      out.push(src[i] === '\n' ? '\n' : ' ')
      i += 1
    }
  }
  while (i < src.length) {
    const ch = src[i]
    if (src.startsWith('//', i)) {
      let e = src.indexOf('\n', i)
      if (e < 0) e = src.length
      blankTo(e)
      continue
    }
    if (src.startsWith('/*', i)) {
      let e = src.indexOf('*/', i + 2)
      e = e < 0 ? src.length : e + 2
      blankTo(e)
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      // 字符串/模板整段原样保留(里面的 `//`、`/*` 不是注释)
      const q = ch
      out.push(ch)
      i += 1
      while (i < src.length) {
        if (src[i] === '\\') {
          out.push(src[i], src[i + 1] ?? '')
          i += 2
          continue
        }
        out.push(src[i])
        if (src[i] === q) {
          i += 1
          break
        }
        i += 1
      }
      continue
    }
    out.push(ch)
    i += 1
  }
  return out.join('')
}

/**
 * 再抹一层:把字符串**内容**抹成空格(保留引号与换行),只用于"这文件里还有没有我没吃到的
 * export"这一条审计。**必须保换行** —— 抹掉换行会让行号漂、并把真 export 吞进"字符串"里,
 * 于是 `keywords > stmts` 这条未判定防线自己失效(由 A17b 钉住)。
 * 单/双引号按词法不得跨行;模板字符串可以跨行,所以那一支按字符走、原样留 `\n`。
 */
export function blankStrings(masked) {
  return masked
    .replace(/'(?:\\[\s\S]|[^'\\\n])*'?/g, (s) => keepNewlines(s, "'"))
    .replace(/"(?:\\[\s\S]|[^"\\\n])*"?/g, (s) => keepNewlines(s, '"'))
    .replace(/`(?:\\[\s\S]|[^`\\])*`?/g, (s) => keepNewlines(s, '`'))
}

/** 内容换成空格、首尾引号保留、换行一个都不吃 */
function keepNewlines(s, quote = "'") {
  const head = s.startsWith(quote) ? quote : ''
  const body = s.slice(head.length)
  const tail = body.endsWith(quote) ? quote : ''
  const inner = tail ? body.slice(0, body.length - tail.length) : body
  const blanked = inner.replace(/[^\n]/g, ' ')
  return head + blanked + tail
}

// ───────────────────────────────────────────────────────── 包清单与入口解析

/** workspace 包清单:任意深度 ≤2 的 package.json(`apps/x/`, `packages/x/`, `sdks/x/`) */
export function manifestPaths(files) {
  return files.filter((f) => f.split('/').length === 3 && f.endsWith('/package.json'))
}

/** 取 `exports` 某一键的候选文件路径(字符串 / 条件对象 / 条件对象数组三种形态都认)。 */
function exportTargetsOf(exportsField, key) {
  if (!exportsField || typeof exportsField !== 'object') return null
  const raw = exportsField[key]
  if (raw === undefined) return undefined
  const out = []
  const walk = (v) => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(raw)
  return out
}

/** 运行时入口(main/module 与 exports['.'])的候选文件 —— 用于判"这包是不是从源码消费"。 */
export function runtimeEntryCandidates(pkg, dir) {
  const art = []
  const fromExports = exportTargetsOf(pkg.exports, '.')
  if (fromExports && fromExports.length) art.push(...fromExports)
  for (const k of ['module', 'main']) if (typeof pkg[k] === 'string') art.push(pkg[k])
  if (typeof pkg.types === 'string') art.push(pkg.types)
  if (typeof pkg.typings === 'string') art.push(pkg.typings)
  return art.map((a) => normJoin(dir, a))
}

/** 把 exports/main 里的相对目标拼成仓内路径。**幂等**:调用方可能已经拼过一层
 *  (`runtimeEntryCandidates` 返回的就是 `packages/pkg/dist/index.js` 这种全路径),
 *  再拼一次会得到 `packages/pkg/packages/pkg/...` ⇒ 永远解析不到 ⇒ 整包"未判定"。
 *  这个双前缀 bug 是第一版自检 A1 全红的真因,而 A15 用裸子路径测它时**恰好看不见**。 */
function normJoin(dir, sub) {
  const s = String(sub).replace(/^\.\//, '')
  if (!dir || s.startsWith(`${dir}/`)) return s
  return dir ? `${dir}/${s}` : s
}

/**
 * 一个 exports 目标(通常是 `./dist/index.js` / `./dist/index.d.ts` / `./src/index.ts`)
 * → **源码**入口的候选路径。
 * 只做机械的"剥构建目录 + 换扩展名",不做猜谜:一个候选都解析不到时调用方必须判「未判定」。
 * `has(path)` 用被审面的路径全集判存在性(不读磁盘),所以清单与内容同面同轮。
 */
export function entrySourceCandidates(target, dir, has) {
  const rel = normJoin(dir, target)
  const noExt = rel.replace(/(\.d\.ts|\.js|\.mjs|\.cjs|\.jsx|\.tsx|\.ts)$/i, '')
  const segs = (noExt.startsWith(`${dir}/`) ? noExt.slice(dir.length + 1) : noExt).split('/')
  if (BUILD_DIRS.includes(segs[0])) segs.shift() // dist/ build/ lib/ out/ 是产物目录,不是源码目录
  const rest = segs.join('/')
  const cands = [
    `${dir}/${rest}.ts`,
    `${dir}/${rest}.tsx`,
    `${dir}/${rest}.js`,
    `${dir}/${rest}.jsx`,
  ]
  // 产物指向 `dist/index.js` 而源码在 `src/index.ts` 是本仓所有 tsc 构建包的形态 ⇒ 补一组 src 候选。
  const srcRest = rest.startsWith('src/') ? rest : `src/${rest}`
  for (const c of [
    `${dir}/${srcRest}.ts`,
    `${dir}/${srcRest}.tsx`,
    `${dir}/${srcRest}.js`,
    `${dir}/${srcRest}.jsx`,
  ])
    if (!cands.includes(c)) cands.push(c)
  const hit = cands.find((c) => has(c))
  return { hit: hit || null, tried: cands }
}

// ───────────────────────────────────────────────────────── 导出/再导出解析

/**
 * 一个文件的导出口径。返回:
 *   value  : 作为**值**递出的名字(运行时真的存在于模块命名空间)
 *   type   : 只作为**类型**递出的名字(编译期擦除,不构成运行时 undefined)
 *   edges  : 需要继续走的再导出边 `{spec, kind:'star'|'names', names?, typeNames?, typeOnly}`
 *   opaque : 有枚举不动的形态 ⇒ 调用方必须放弃"这个包没递出它"的结论
 *
 * 为什么按**列 0 语句**扫而不是全文正则:全文正则会命中字符串/模板里的 `export * from '…'`
 * (生成器与夹具源码),把"其实已递出"读成"未递出" —— **假红比漏报贵**(守门 118 那一课)。
 * 列 0 是 prettier 下真实导出语句的不变形态(与守门 98 的 `^import\b` / `^export[\{*]` 同判据)。
 * 凡代码面出现 `export` 关键字却没被任何一条列 0 语句吃掉 ⇒ 置 opaque 并如实报数,
 * 绝不把"我认不出"写成"它没递出"(本仓最高频失效型就是"把没判写成判过了")。
 */
export function parseModule(text) {
  const masked = maskComments(text)
  const lines = masked.split('\n')
  const value = new Set()
  const type = new Set()
  const edges = []
  let opaque = false

  const stmts = []
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^export\b/.test(lines[i])) continue
    let stmt = lines[i]
    let depth = bracesOf(stmt)
    let j = i
    while (depth > 0) {
      j += 1
      if (j >= lines.length) {
        stmt = ''
        break
      }
      depth += bracesOf(lines[j])
      stmt += '\n' + lines[j]
    }
    if (!stmt) {
      opaque = true // 括号到文件尾都没闭合 ⇒ 这份文件的名单不可枚举
      break
    }
    stmts.push(stmt.replace(/\s+/g, ' ').trim())
    i = j
  }

  for (const t of stmts) {
    let m
    if (/^export\s+default\b/.test(t)) {
      value.add('default')
    } else if (
      (m = /^export\s*\*\s*(?:as\s+([A-Za-z_$][\w$]*))?\s*from\s*['"]([^'"]+)['"]/.exec(t))
    ) {
      if (m[1]) {
        value.add(m[1]) // 命名空间再导出:递出去的就是这一个名字 ⇒ 名单完整,不需要再走这条边
      } else {
        // 整表转发:能不能枚举由 deliveredOf 按**目标**判(包内/是 workspace 包 ⇒ 名单可数;
        // 三方 ⇒ 才真的判不了)。在这一层就置 opaque 会把"转发了一份包内文件"误判成整包未判定。
        edges.push({ spec: m[2], kind: 'star' })
      }
    } else if ((m = /^export\s+(type\s+)?\{([\s\S]*?)\}\s*(?:from\s*['"]([^'"]+)['"])?/.exec(t))) {
      const isType = !!m[1]
      const names = []
      const typeNames = new Set()
      for (const raw of listEntries(m[2])) {
        const parts = raw.split(/\s+as\s+/)
        const origRaw = parts[0].trim()
        /**
         * inline `type` 修饰符必须**先剥前缀再当名字用**。第一版写 `alias = parts[1] || parts[0]`,
         * 而 `type RnThemeTokens` 没有 `as` ⇒ alias 连 `type ` 一起留下 → 过不了标识符校验 →
         * **整条被丢**,于是"入口明明递出了"被读成"没递出"(真仓 design-tokens 的 26 个
         * inline type 全隐身,假红就藏在这一格)。`export { type A as B }` 的对外名字是 B。
         */
        const inlineType = /^type\s+/.test(origRaw)
        const alias = (parts[1] || origRaw.replace(/^type\s+/, '')).trim()
        if (!/^[A-Za-z_$][\w$]*$/.test(alias)) continue
        names.push(alias)
        if (isType || inlineType) {
          type.add(alias)
          typeNames.add(alias)
        } else value.add(alias)
      }
      if (m[3])
        edges.push({
          spec: m[3],
          kind: 'names',
          names,
          typeNames,
          typeOnly: isType,
        })
    } else if (
      (m =
        /^export\s+(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:function\*?|class|const|let|var|enum)\s+([\{\[]|[A-Za-z_$][\w$]*)/.exec(
          t,
        ))
    ) {
      if (m[1] === '{' || m[1] === '[')
        for (const n of listNames(/\[[^\]]*\]|\{[^}]*\}/.exec(t)[0])) value.add(n)
      else value.add(m[1])
    } else if ((m = /^export\s+(?:declare\s+)?(interface|type)\s+([A-Za-z_$][\w$]*)/.exec(t))) {
      type.add(m[2])
    } else opaque = true // 列 0 的 export 但没有一条形态被认出 ⇒ 不猜
  }

  // 代码面(字符串已抹)里剩下的 `export` 关键字数 > 语句数 ⇒ 有没被吃掉的导出形态
  const code = blankStrings(masked)
  const keywords = (code.match(/\bexport\b/g) || []).length
  if (keywords > stmts.length) opaque = true

  return { value, type, edges, opaque, statements: stmts.length, keywords }
}

/** 一行的花括号净深度(先抹字符串,否则 `'}'` 这类字面量会算错) */
function bracesOf(line) {
  const s = blankStrings(line)
  return (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length
}

function listEntries(body) {
  return body
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
function listNames(body) {
  return listEntries(body)
    .map((s) => (s.includes(' as ') ? s.split(/\s+as\s+/)[1].trim() : s))
    .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s))
}

/** 相对 spec → 仓内路径(与守门 98 的候选族同形,但只服务包内文件,不做跨包猜测) */
export function resolveRelative(fromRel, spec) {
  const parts = fromRel.split('/')
  parts.pop()
  for (const seg of spec.replace(/^\.\//, '').split('/')) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

/**
 * `./user.js` 这类**带 .js 扩展名的包内 spec**必须能解到 `user.ts`:本仓所有包按
 * NodeNext/ESM 写法在源码里写 `.js`,tsc 解析顺序是先 `user.ts` 再 `user.js`。
 * 只补后缀(`user.js.ts`)会让每一条 `export * from './endpoints/x.js'` 都"解析不到" ⇒
 * 整包被降成未判定 ⇒ 门对最常见的 barrel 形态全盲却仍报"红 0"(第一版真仓实测 13051 处
 * 导入全落未判定,就是这个形状)。
 */
export const REL_CANDS = (base) => {
  const noJs = base.replace(/\.(js|mjs|cjs|jsx)$/, '')
  const out = [base]
  if (noJs && noJs !== base)
    out.push(
      `${noJs}.ts`,
      `${noJs}.tsx`,
      `${noJs}.js`,
      noJs,
      `${noJs}/index.ts`,
      `${noJs}/index.tsx`,
    )
  out.push(`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`)
  return [...new Set(out)]
}

/**
 * 一个包入口**递出**的名字集合。沿包内相对边与 workspace 跨包边递归(带环保护);
 * 任何一条边枚举不动 ⇒ `opaque=true`,调用方必须放弃对该包下结论(把"看不见"写成"没有"
 * 是本仓最高频的失效型)。
 */
export function deliveredOf(pkgName, entryRel, ctx, seen = new Set()) {
  const acc = { value: new Set(), type: new Set(), opaque: false, reasons: [] }
  const markOpaque = (why) => {
    acc.opaque = true
    if (acc.reasons.length < 6 && !acc.reasons.includes(why)) acc.reasons.push(why)
  }
  const stack = [[pkgName, entryRel]]
  const visited = new Set()
  while (stack.length) {
    const [pn, rel] = stack.pop()
    const key = `${pn}::${rel}`
    if (visited.has(key)) continue
    visited.add(key)
    const mod = ctx.moduleOf(rel)
    if (!mod) {
      markOpaque(`取不到 ${rel}`) // 入口文件本身取不到 ⇒ 无法下结论
      continue
    }
    // 这个文件里有一条"认不出的 export" ⇒ 名单不完整。不完整**不等于**没有:
    // 放弃下结论,而不是把缺的那一格当成"确实没递出"。
    if (mod.opaque)
      markOpaque(
        `${rel} 里有没被吃到的 export 形态(${mod.keywords} 关键字 / ${mod.statements} 语句)`,
      )
    for (const n of mod.value) acc.value.add(n)
    for (const n of mod.type) acc.type.add(n)
    for (const e of mod.edges) {
      if (e.kind === 'star') {
        if (e.spec.startsWith('./') || e.spec.startsWith('../')) {
          const t = ctx.resolveRelIn(pn, rel, e.spec)
          if (t) stack.push([pn, t])
          else markOpaque(`${rel} 的 \`export * from '${e.spec}'\` 在包内解析不到`)
        } else if (ctx.pkgByName(e.spec)) {
          const sub = ctx.entryOf(e.spec)
          if (sub && !seen.has(e.spec)) {
            seen.add(e.spec)
            stack.push([e.spec, sub])
          } else if (!sub)
            markOpaque(`${rel} 的 \`export * from '${e.spec}'\` 的目标包入口解析不到`)
        } else markOpaque(`${rel} 的 \`export * from '${e.spec}'\`(三方整表转发,名单不可枚举)`)
      } else {
        // **具名**再导出:递出去的就是名单里那几个 —— 绝不得把目标文件的全部导出并进名单
        // (那正是"入口只转导一个,却按整表已递出"的假绿;第一版就栽在这里,自检 A1 当场红)。
        // 档位也要按**这一条边**的形状分:整表 `export type { … }` 全走 type 档,
        // 而值导出表里的 `type X` 条目只把 X 记进 type 档 —— 否则 X 会被当成运行时值
        // (真仓 design-tokens 入口即此形状),反过来把整表当值档则会造出假红。
        for (const n of e.names) {
          if (e.typeOnly || (e.typeNames && e.typeNames.has(n))) acc.type.add(n)
          else acc.value.add(n)
        }
      }
    }
  }
  return acc
}

// ───────────────────────────────────────────────────────────────── 取材与判据

function listFacePaths(face, root = ROOT) {
  if (face === 'staged' || face === 'worktree')
    return gitRaw(['ls-files', '-z'], ROOT, { timeout: GIT_TIMEOUT, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
  return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root, {
    timeout: GIT_TIMEOUT,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
}

/**
 * 主判据。`readFace` 给被审面的内容;`files` 是该面的路径全集(存在性也按同一面判)。
 * 返回 { red, typeMiss, notFound, subpath, undetermined, packages, consumers, barrels, barrelStats }
 *
 * **两族入口,一条判据**:
 *   ① 包面 —— 裸包名 `import { N } from '@ihui/pkg'`,universe = 该包整棵子树;
 *   ② 端内/子 barrel 面 —— 相对或 tsconfig 别名解析到某个 `<dir>/index.(ts|tsx)`,
 *      universe = **该 barrel 自己那一层目录**的子树(比包面窄,刻意保守:红点要求
 *      "名字就在这层目录里以值导出存在,而 barrel 没递出来")。
 * 两族判定的形状完全相同(同一个 `deliveredOf`、同一套三态),只是**说明符形状**不同,
 * 所以同一条导入不可能被两族各计一次红。
 *
 * 为什么端内 barrel 也要判(2026-09-28 的可达性实测,数字一律现读):
 *   · 守门 98 判的是"目标文件有没有这个名字",但它**见 `export *` 即整文件放过**
 *     (`parseExports` 置 opaque ⇒ `if (opaque) continue`),而本仓被目录式导入消费的端内
 *     barrel 里有一批正是"star + 具名清单"混血形态 —— 摘掉其中一行具名 re-export,98 全程看不见。
 *   · 98 的 `--staged` 只审**暂存的那几个文件**;一枚只改 barrel(摘一行)的提交,红点落在
 *     未暂存的消费者上 ⇒ 提交链不红。
 *   · `tsc` 看得见这一型(app 内解析到的是源码,不是 gitignored 的 dist —— 那正是包面当初
 *     必须另立一道门的原因),但提交链那两道 typecheck 门都按"报错文件 ∈ 改动范围"过滤
 *     (`check-staged-typecheck` 的 filterTscOutputForStagedFiles / push 门 `shouldDegrade`),
 *     所以只有 CI 会红;CI 红在"本机即部署机"的链路里拦不住任何人。
 *   ⇒ 这一型在提交链上无人看守,与包面同罪,共用本门。
 *
 * **纯函数**:只吃传入的 reader 与清单,自己不派生 git、不碰磁盘 —— 这样"红/绿"与
 * "取的是哪一面"两件事能各自被证(守门 103 T12 那一课:证明取材面行为只能靠纯函数+构造面)。
 * 面基准由 `main()` 侧的 `assertRepoRoot` 与 `makeReader` 负责。
 */
export function analyze({ readFace, files, consumerFilter = null, requireBarrels = false }) {
  const fileSet = new Set(files)
  const has = (p) => fileSet.has(p)
  const cache = new Map()
  const read = (p) => {
    if (!fileSet.has(p)) return null
    if (!cache.has(p)) {
      const t = readFace(p)
      cache.set(p, t === null || t === undefined ? null : t)
    }
    return cache.get(p)
  }
  const moduleOf = (p) => {
    const t = read(p)
    if (t === null) return null
    try {
      return parseModule(t)
    } catch {
      return null
    }
  }

  // 1) workspace 包表
  const pkgByDir = new Map()
  const pkgByName = new Map()
  for (const mp of manifestPaths(files)) {
    const txt = read(mp)
    if (txt === null) throw new Undetermined(`包清单取不到:${mp}`)
    let j
    try {
      j = JSON.parse(txt)
    } catch {
      throw new Undetermined(`包清单不是合法 JSON:${mp}(判据无法继续,不静默跳过)`)
    }
    if (!j || typeof j.name !== 'string') continue
    const dir = mp.replace(/\/package\.json$/, '')
    pkgByDir.set(dir, j)
    pkgByName.set(j.name, dir)
  }
  if (!pkgByName.size) throw new Undetermined('一个 workspace 包清单都没枚举到 ⇒ 空扫不记绿')

  // 2) 每包的入口源码 + 包内源文件全集
  /**
   * 包内相对 spec 的解析基准是**当前那条语句所在文件**,不是入口文件 ——
   * 用入口当基准会让 `endpoints/x.ts` 里的 `export * from './y.js'` 解到别处(实测会静默
   * 落到包根的同名文件上,从而把一条真实的边读成"解析不到")。
   */
  const resolveRelIn = (pkgName, fromRel, spec) => {
    const dir = pkgByName.get(pkgName)
    if (!dir || !fromRel) return null
    const base = resolveRelative(fromRel, spec)
    for (const c of REL_CANDS(base)) if (has(c) && c.startsWith(`${dir}/`)) return c
    return null
  }
  const entryOf = (pkgName) => {
    const dir = pkgByName.get(pkgName)
    if (!dir) return null
    const e = entries.get(pkgName)
    return e ? e.entry : null
  }
  const ctxEntryRel = new Map()
  const entries = new Map()
  for (const [name, dir] of pkgByName) {
    const m = pkgByDir.get(dir)
    const targets = runtimeEntryCandidates(m, dir)
    let entry = null
    const misses = []
    for (const t of targets) {
      const { hit, tried } = entrySourceCandidates(t, dir, has)
      if (hit) {
        entry = hit
        break
      }
      misses.push(...tried)
    }
    entries.set(name, { entry, dir, targets, misses })
    if (entry) ctxEntryRel.set(name, entry)
  }

  const ctx = {
    moduleOf,
    pkgByName: (n) => pkgByName.has(n),
    resolveRelIn,
    entryOf,
  }

  /**
   * 端内 / 子 barrel 面所需的两件东西:
   *  · **别名表** —— 复用守门 98 那一份 `buildAliasIndex`(它与 98 一样只吃
   *    `compilerOptions.paths` 的尾随 `*` 前缀映射),不另写第二份解析器;
   *  · **一条仓库范围的相对解析** —— 端内 barrel 合法地会 `export { x } from '../shared/y'`,
   *    把解析限制在 barrel 自己那层目录会把"已递出"读成"没递出"(假红)。
   *    跨包的 `export *`(如 `export * from '@ihui/shared'`)按包面那两张表继续走,
   *    所以这里交给 `deliveredOf` 的 ctx 与包面共用 `pkgByName` / `entryOf`。
   */
  const tsConfigs = files.filter((f) => TS_RE.test(f) && !SKIP_DIR.test(f))
  const aliasBuilt = buildAliasIndex(read, tsConfigs)
  const aliasIndex = aliasBuilt.index
  const aliasUnparsed = aliasBuilt.unparsed || 0

  const resolveAnywhere = (_pn, fromRel, spec) => {
    const base = resolveRelative(fromRel, spec)
    for (const c of REL_CANDS(base)) if (has(c)) return c
    return null
  }
  const dirCtx = {
    moduleOf,
    pkgByName: (n) => pkgByName.has(n),
    resolveRelIn: resolveAnywhere,
    entryOf,
  }

  // 2b) barrel 全集:任意目录的 index.(ts|tsx);**包入口本身不在这一族**(它由包面判,两面
  // 判的说明符形状不同,不会把同一条导入各计一次)。
  const pkgEntrySet = new Set()
  for (const e of entries.values()) if (e.entry) pkgEntrySet.add(e.entry)
  const barrels = files.filter(
    (f) => BARREL_RE.test(f) && !SKIP_DIR.test(f) && !pkgEntrySet.has(f),
  )
  const barrelSet = new Set(barrels)
  /**
   * 空扫就是本门要防的那一型故障(守门 114/149 同一条):枚举到 0 个 barrel 时"红 0"读起来
   * 像"全覆盖",而它其实是选择器漂了(BARREL_RE / SKIP_DIR / pkgEntrySet 任何一处被改坏都会
   * 让这一族整片隐身)。
   * `requireBarrels` 由 CLI 侧恒真(真仓有 200+ 个端内 barrel,0 个必是判据坏了);
   * 纯函数夹具默认假 —— 那些面本来就只有包入口,不该被这条判死(由镜像测试端到端钉这个方向)。
   */
  if (requireBarrels && !barrelSet.size)
    throw new Undetermined('一个目录 barrel(index.ts/tsx)都没枚举到 ⇒ 判据失明,不记通过')
  const barrelDir = (b) => b.replace(/\/index\.(ts|tsx)$/, '')
  /** barrel → 目录内(不含 barrel 自己)的值/类型导出全集。按目录记忆,一次判据一趟共用。 */
  const universeCache = new Map()
  const universeOfBarrel = (b) => {
    const dir = barrelDir(b)
    if (universeCache.has(dir)) return universeCache.get(dir)
    const u = { value: new Set(), type: new Set() }
    for (const f of files) {
      if (!f.startsWith(`${dir}/`) || BARREL_RE.test(f)) continue
      if (!SRC_RE.test(f) || SKIP_DIR.test(f) || NON_UNIVERSE.test(f)) continue
      const m = moduleOf(f)
      if (!m) continue
      for (const n of m.value) u.value.add(n)
      for (const n of m.type) u.type.add(n)
    }
    universeCache.set(dir, u)
    return u
  }
  const deliveredCache = new Map()
  const deliveredOfBarrel = (b) => {
    if (!deliveredCache.has(b)) deliveredCache.set(b, deliveredOf(barrelDir(b), b, dirCtx))
    return deliveredCache.get(b)
  }
  /** 一条说明符解析到的是不是某个 barrel(相对直接解,别名经 98 的表解;都不中 ⇒ null) */
  const barrelOfSpec = (fromRel, spec) => {
    let base = null
    if (spec.startsWith('./') || spec.startsWith('../')) base = resolveRelative(fromRel, spec)
    else if (aliasIndex && aliasIndex.size) {
      const a = resolveAliasSpec(fromRel, spec, aliasIndex)
      if (a) base = a
    }
    if (!base) return null
    for (const c of REL_CANDS(base)) if (barrelSet.has(c)) return c
    return null
  }

  // 3) 包内"值导出全集"(存在性取证):逐包一次遍历
  const universe = new Map() // pkgName -> {value:Set, type:Set}
  for (const [name, dir] of pkgByName) {
    const u = { value: new Set(), type: new Set() }
    for (const f of files) {
      if (!f.startsWith(`${dir}/`) || !SRC_RE.test(f) || SKIP_DIR.test(f) || NON_UNIVERSE.test(f))
        continue
      const m = moduleOf(f)
      if (!m) continue
      for (const n of m.value) u.value.add(n)
      for (const n of m.type) u.type.add(n)
    }
    universe.set(name, u)
  }

  // 4) 消费者侧:① 裸包名具名导入 ② 相对/别名解析到 barrel 的具名导入
  const red = []
  const typeMiss = []
  const notFound = []
  const subpath = []
  const undetermined = []
  /** 每包"入口递出多少 / 包内值导出多少 / 被消费多少名字"—— 递出数远小于包内规模就是
   *  解析器在某条形态上失明(不是仓库干净)。报告必须印它,否则"红 0"读起来像"全覆盖"。 */
  const stats = new Map()
  let consumerFiles = 0
  const judgedPkgs = new Set()
  const judgedBarrels = new Set()
  for (const f of files) {
    if (!SRC_RE.test(f) || SKIP_DIR.test(f)) continue
    if (consumerFilter && !consumerFilter.has(f)) continue
    const t = read(f)
    if (t === null) continue
    consumerFiles += 1
    for (const imp of parseImports(t)) {
      const spec = imp.spec
      /**
       * 端内 barrel 面。放在裸包名之前判,因为**别名说明符**(apps/web 的 `@/components/common`)
       * 在下一段会走进 `!pkgByName.has(spec)` 那一支被静默丢掉 —— 它既不是包名也不是子路径,
       * 旧版连"报名"都没有,所以那 741 个消费者一条都不进射程。
       */
      if (imp.named.length) {
        const b = barrelOfSpec(f, spec)
        if (b) {
          judgedBarrels.add(b)
          const dl = deliveredOfBarrel(b)
          if (dl.opaque) {
            undetermined.push({
              pkg: `barrel:${b}`,
              why: `barrel 可达图有枚举不动的边 —— ${(dl.reasons || []).join('; ') || '未记录'}`,
            })
            for (const n of imp.named)
              notFound.push({ file: f, line: imp.line, spec, name: n.imported, opaque: true, scope: 'barrel' })
            continue
          }
          const u = universeOfBarrel(b)
          const st = stats.get(b) || {
            consumers: 0,
            deliveredValue: dl.value.size,
            deliveredType: dl.type.size,
            universeValue: u.value.size,
            entry: b,
            scope: 'barrel',
          }
          st.consumers += imp.named.length
          stats.set(b, st)
          for (const n of imp.named) {
            if (dl.value.has(n.imported) || dl.type.has(n.imported)) continue
            if (u.value.has(n.imported))
              red.push({ file: f, line: imp.line, spec, name: n.imported, entry: b, scope: 'barrel' })
            else if (u.type.has(n.imported))
              typeMiss.push({ file: f, line: imp.line, spec, name: n.imported, scope: 'barrel' })
            else notFound.push({ file: f, line: imp.line, spec, name: n.imported, scope: 'barrel' })
          }
          continue
        }
      }
      if (spec.startsWith('./') || spec.startsWith('../')) continue
      /**
       * `pkgByName` 的**值**是包目录,`entries` / `universe` 的键是**包名**。
       * 第一版在这里写了 `const name = pkgByName.get(spec)` 然后把 `name` 当包名去查后两张表
       * ⇒ 永远查不到 ⇒ 每一个裸包名导入都被记成"入口解析不到"，而全量读数看起来只是
       * "红 0 / 未判定 13" —— 判据失明被伪装成"仓是干净的"(本仓最贵的那一型)。
       * 现在的键一律用 `spec`(它本身就是包名),目录只在需要时反查。
       */
      if (!pkgByName.has(spec)) {
        // 子路径形态:`@scope/pkg/...` 或未声明的裸名 —— 只报名,不判
        const owner = [...pkgByName.keys()].find((k) => spec.startsWith(`${k}/`))
        if (owner)
          subpath.push({ file: f, line: imp.line, spec, names: imp.named.map((n) => n.imported) })
        continue
      }
      if (!imp.named.length) continue
      const e = entries.get(spec)
      if (!e || !e.entry) {
        undetermined.push({
          pkg: spec,
          why: `入口解析不到(exports/main 目标 ${(e && e.targets && e.targets.join(' ')) || '空'})`,
        })
        continue
      }
      judgedPkgs.add(spec)
      const dl = deliveredOf(spec, e.entry, ctx)
      if (dl.opaque) {
        undetermined.push({
          pkg: spec,
          why: `入口可达图有枚举不动的边 —— ${(dl.reasons || []).join('; ') || '未记录'}`,
        })
        for (const n of imp.named)
          notFound.push({ file: f, line: imp.line, spec, name: n.imported, opaque: true })
        continue
      }
      const u = universe.get(spec) || { value: new Set(), type: new Set() }
      const st = stats.get(spec) || {
        consumers: 0,
        deliveredValue: dl.value.size,
        deliveredType: dl.type.size,
        universeValue: u.value.size,
        entry: e.entry,
        scope: 'package',
      }
      st.consumers += imp.named.length
      stats.set(spec, st)
      for (const n of imp.named) {
        if (dl.value.has(n.imported) || dl.type.has(n.imported)) continue
        if (u.value.has(n.imported))
          red.push({ file: f, line: imp.line, spec, name: n.imported, entry: e.entry, scope: 'package' })
        else if (u.type.has(n.imported))
          typeMiss.push({ file: f, line: imp.line, spec, name: n.imported, scope: 'package' })
        else notFound.push({ file: f, line: imp.line, spec, name: n.imported, scope: 'package' })
      }
    }
  }
  if (!consumerFiles) throw new Undetermined('一个消费者源文件都没扫到 ⇒ 判据失明,不记通过')
  if (requireBarrels && !judgedBarrels.size && !consumerFilter)
    throw new Undetermined(
      `枚举到 ${barrels.length} 个目录 barrel,却没有一条相对/别名导入落到它们上 ⇒ 解析器失明,不记通过`,
    )
  return {
    red,
    typeMiss,
    notFound,
    subpath,
    undetermined: [...new Map(undetermined.map((u) => [`${u.pkg}::${u.why}`, u])).values()],
    packages: pkgByName.size,
    consumerFiles,
    barrels: barrels.length,
    barrelConsumers: judgedBarrels.size,
    aliasConfigs: tsConfigs.length,
    aliasUnparsed,
    judgedPackages: [...judgedPkgs].sort(),
    perPackage: [...stats.entries()]
      .map(([pkg, s]) => ({ pkg, ...s }))
      .sort((a, b) => b.consumers - a.consumers),
  }
}

/** 按消费者文件聚合红点计数(棘轮锚点的形状) */
export function perFileCounts(red) {
  const m = new Map()
  for (const r of red) m.set(r.file, (m.get(r.file) || 0) + 1)
  return m
}

// ─────────────────────────────────────────────────────────────────────── CLI

function makeReader(face, root = ROOT) {
  let map = null
  const specs = (paths) => paths.map((p) => (face === 'staged' ? `:${p}` : `HEAD:${p}`))
  return {
    prepare(paths) {
      if (face === 'worktree') return
      map = catBatch(root, specs(paths))
    },
    read(p) {
      if (face === 'worktree') return readWorktreeFile(root, p)
      if (!map) throw new Undetermined('内容未经 catBatch 预取就被读取(取材面会自相矛盾)')
      const v = map.get(specs([p])[0])
      return v === undefined ? null : v
    },
  }
}

export function main(argv = process.argv.slice(2)) {
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  if (argv.includes('--self-test')) return selfTest()
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
  })
  const ri = argv.indexOf('--root')
  const root = ri >= 0 && argv[ri + 1] ? resolvePath(argv[ri + 1]) : ROOT
  if (error) {
    console.error(`❌ ${error}`)
    return 2
  }
  let code = 0
  let report
  try {
    assertRepoRoot(root, '包入口 barrel 对账')
    const files = listFacePaths(face, root)
    // 一次把**全部**可能被读的文件喂给 catBatch:清单与内容同面同轮,并行会话推进的瞬间
    // 也不会产出自洽却错位的尺子(守门 121/98 同一条纪律)。
    const reader = makeReader(face, root)
    reader.prepare(
      files.filter(
        (f) =>
          (SRC_RE.test(f) && !SKIP_DIR.test(f)) ||
          f.endsWith('package.json') ||
          TS_RE.test(f),
      ),
    )
    const readFace = (p) => reader.read(p)
    // **不按暂存文件收窄判据面**(与守门 78/126 同取向):两格洞都是收窄造出来的 ——
    //   ① 一枚只改 `packages/x/src/index.ts`(摘掉一行 re-export)的提交,暂存里没有消费者文件,
    //      收窄后本门"无消费者可判" ⇒ 要么假喊无法判定、要么放过整类;
    //   ② 摘线的那枚提交当场不红,红点要等到别人日后碰消费者文件才出现 —— 而那个人会以为是自己的错。
    // 锚点仍按"该消费者文件 HEAD 自身存量"取 ⇒ 别人欠的存量不把本次提交钉红(§12e)。
    const judged = analyze({ readFace, files, requireBarrels: true })
    let anchors = new Map()
    if (face === 'staged') {
      const redFiles = new Set(judged.red.map((r) => r.file))
      if (redFiles.size) {
        const headAll = listFacePaths('head', root)
        // 第二趟只为拿锚点 ⇒ 只喂"包侧文件 + 端内 barrel 侧文件 + 第一趟判红的少数消费者",
        // 避免每次提交跑两遍 9000 文件的全量读取。
        // **两族都必须喂**:barrel 侧漏喂 ⇒ 锚点恒 0 ⇒ 端内的存量债会被算成"本次新增"(假红,
        // 而假红的代价就是逼人 --no-verify)。别名表(tsconfig)也必须同批喂,否则那一趟解不出
        // barrel,又会把同一批红算成 0。
        const headFiles = headAll.filter(
          (f) =>
            f.startsWith('packages/') ||
            f.startsWith('apps/') ||
            f.startsWith('sdks/') ||
            TS_RE.test(f) ||
            redFiles.has(f),
        )
        const hr = makeReader('head', root)
        hr.prepare(
          headFiles.filter(
            (f) =>
              (SRC_RE.test(f) && !SKIP_DIR.test(f)) ||
              f.endsWith('package.json') ||
              TS_RE.test(f),
          ),
        )
        const base = analyze({
          readFace: (p) => hr.read(p),
          files: headFiles,
          consumerFilter: redFiles,
          requireBarrels: true,
        })
        anchors = perFileCounts(base.red)
      }
    }
    const counts = perFileCounts(judged.red)
    const ratchetHits = []
    for (const [file, n] of counts)
      if (n > (anchors.get(file) || 0))
        ratchetHits.push({ file, n, anchor: anchors.get(file) || 0 })
    report = {
      face,
      strict,
      packages: judged.packages,
      consumerFiles: judged.consumerFiles,
      barrels: judged.barrels,
      barrelConsumers: judged.barrelConsumers,
      aliasConfigs: judged.aliasConfigs,
      aliasUnparsed: judged.aliasUnparsed,
      red: judged.red,
      typeMiss: judged.typeMiss,
      notFound: judged.notFound.filter((x) => !x.opaque),
      opaqueLookups: judged.notFound.filter((x) => x.opaque).length,
      subpath: judged.subpath,
      undetermined: judged.undetermined,
      perPackage: judged.perPackage,
      ratchetHits: face === 'staged' ? ratchetHits : null,
    }
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ 无法判定:${e.message}(既不冒红也不记绿)`)
      return 2
    }
    console.error(`❌ ${e && e.message ? e.message : e}`)
    return 2
  }

  const blocking = face === 'staged' ? report.ratchetHits : report.red
  if (json) {
    console.log(
      JSON.stringify({ ...report, blockingCount: blocking.length }, null, json === '2' ? 2 : 0),
    )
  } else {
    console.log(`[barrel-export] 取材面:${face}`)
    console.log(
      `[barrel-export] workspace 包 ${report.packages} 个 / 目录 barrel ${report.barrels} 个(被相对或别名导入消费 ${report.barrelConsumers} 个;别名表 ${report.aliasConfigs} 份 tsconfig,解析失败 ${report.aliasUnparsed})/ 消费者源文件 ${report.consumerFiles} 个`,
    )
    console.log(
      `✅ 真仓判据已跑:` +
        ` ${report.packages} 个包 + ${report.barrelConsumers} 个 barrel、${report.consumerFiles} 个文件,` +
        `红 ${blocking.length} 处(raw red ${report.red.length},其中端内 barrel ${report.red.filter((r) => r.scope === 'barrel').length}),` +
        `类型漏递 ${report.typeMiss.length},` +
        `查无此名 ${report.notFound.length},子路径(不在射程)${report.subpath.length},未判定 ${report.undetermined.length}`,
    )
    for (const r of report.red.slice(0, 40))
      console.log(
        `   · ${r.file}:${r.line} 从 '${r.spec}' 要 '${r.name}' —— ${
          r.scope === 'barrel' ? '该层目录有该值导出' : '包内有该值导出'
        },入口(${r.entry})没递出来`,
      )
    if (report.red.length > 40) console.log(`   … 另有 ${report.red.length - 40} 处(--json 看全量)`)
    for (const r of report.typeMiss.slice(0, 20))
      console.log(
        `   [类型] ${r.file}:${r.line} '${r.name}' ← '${r.spec}' 未递出(编译期擦除,不计红)`,
      )
    for (const r of report.notFound.slice(0, 20))
      console.log(`   [查无] ${r.file}:${r.line} '${r.name}' ← '${r.spec}'(包内哪都没有)`)
    if (report.opaqueLookups)
      console.log(`   [未判定遮蔽] ${report.opaqueLookups} 处导入落在"入口不可枚举"的包上,一律未判`)
    for (const s of report.subpath.slice(0, 10))
      console.log(`   [子路径] ${s.file}:${s.line} '${s.spec}'(${s.names.length} 个具名)`)
    if (report.subpath.length > 10)
      console.log(`   … 另有 ${report.subpath.length - 10} 处子路径导入`)
    for (const u of report.undetermined) console.log(`   ⚠️ 未判定:${u.pkg} —— ${u.why}`)
    // 覆盖面自证:递出名单明显小于包内规模 ⇒ 是本门的解析器失明,不是仓库干净。
    // 没有这一行,"红 0"会被读成"全覆盖",而那正是判据失效最安静的样子。
    // **但这条启发只对包面成立**:包入口按定义该把对外能力几乎全递出来,而端内 barrel
    // 的本意就是"精选一份清单"(`apps/api/src/db/index.ts` 只递 9 条而该层目录有 1166 条值导出,
    // 这是设计不是失明)。把包面那把尺子照搬到 barrel 面,产出的是 16 行假警报
    // —— 假阳比漏报贵(守门 118 那一课:它指使人去"修"没坏的东西)。
    // barrel 面只有一件事确实可疑:**被消费着却一条都没递出**。
    for (const p of report.perPackage) {
      const empty = p.deliveredValue + p.deliveredType === 0
      const flag =
        p.scope === 'barrel'
          ? empty
            ? ' ⚠️ 被消费着却一条都没递出,疑解析失明'
            : ''
          : empty || p.deliveredValue < p.universeValue / 4
            ? ' ⚠️ 递出数远小于包内规模,疑解析失明'
            : ''
      console.log(
        `   [覆盖] ${p.scope === 'barrel' ? 'barrel' : '包'} ${p.pkg}:入口 ${p.entry} 递出 值${p.deliveredValue}/类${p.deliveredType},${
          p.scope === 'barrel' ? '该层目录' : '包内'
        }值导出 ${p.universeValue},被消费 ${p.consumers} 名${flag}`,
      )
    }
    if (face === 'staged') {
      for (const h of report.ratchetHits)
        console.log(
          `❌ 新增:${h.file} 的漏递依赖面从 ${h.anchor} 涨到 ${h.n}(棘轮锚点 = 该文件 HEAD 自身存量)`,
        )
    }
  }

  if (face === 'staged') {
    if (report.ratchetHits.length) {
      console.log(
        `❌ ${report.ratchetHits.length} 个文件的漏递依赖面比 HEAD 更大 —— 补入口 re-export,别削判据`,
      )
      code = 1
    }
  } else if (strict) {
    if (report.red.length) {
      console.log(`❌ --strict:${report.red.length} 处入口漏递(存量问责)`)
      code = 1
    }
    if (report.undetermined.length) {
      console.log(`⚠️ --strict 拒绝出具合格证:${report.undetermined.length} 个包未判定`)
      code = 2
    }
  } else if (report.red.length) {
    console.log(
      `ℹ️ 默认档只报数:${report.red.length} 处存量。问责跑 --strict;提交链走 --staged 棘轮。`,
    )
  }
  if (!code && !json) console.log('✅ 本次判定未把任何"取不到"记成通过')
  return code
}

// ────────────────────────────────────────────────────────────────── 自检

function selfTest() {
  const cases = []
  const t = (name, cond, extra = '') => cases.push({ name, ok: !!cond, extra })

  // ── 构造面:一个包 + 一个消费者,纯内存,不派生 git
  const mk = (over = {}) => {
    const files = {
      'packages/pkg/package.json': JSON.stringify({
        name: '@t/pkg',
        type: 'module',
        main: './dist/index.js',
        exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
      }),
      'packages/pkg/src/thing.ts':
        'export function delivered() { return 1 }\nexport function hidden() { return 2 }\nexport interface OnlyType { a: number }\n',
      'packages/pkg/src/index.ts': "export { delivered } from './thing.js'\n",
      ...over,
    }
    const list = Object.keys(files)
    return {
      files: list,
      readFace: (p) => (Object.prototype.hasOwnProperty.call(files, p) ? files[p] : null),
    }
  }
  const run = (extra) => {
    const f = mk(extra)
    return analyze({ readFace: f.readFace, files: f.files })
  }
  const withConsumer = (src) => run({ 'apps/web/src/a.ts': src })

  const hit = withConsumer("import { hidden } from '@t/pkg'\nexport const z = hidden()")
  t(
    'A1 入口没递出而包内有值导出 ⇒ 必须判红',
    hit.red.length === 1 && hit.red[0].name === 'hidden',
    JSON.stringify(hit.red),
  )
  const ok = withConsumer("import { delivered } from '@t/pkg'\nexport const z = delivered()")
  t('A2 入口已递出 ⇒ 不得判红(同一夹具的对照组)', ok.red.length === 0)
  const ty = withConsumer("import { OnlyType } from '@t/pkg'")
  t('A3 只有类型形态漏递 ⇒ 落 typeMiss 而不是 red', ty.red.length === 0 && ty.typeMiss.length === 1)
  const nf = withConsumer("import { nothingHere } from '@t/pkg'")
  t('A4 包内哪都没有 ⇒ notFound,不判红(不猜)', nf.red.length === 0 && nf.notFound.length === 1)

  // 三方 `export *` ⇒ 该包整体未判定,一条都不许判红
  const op = run({
    'packages/pkg/src/index.ts':
      "export { delivered } from './thing.js'\nexport * from 'some-third-party'\n",
    'apps/web/src/a.ts': "import { hidden } from '@t/pkg'\n",
  })
  t(
    'A5 入口含三方 `export *` ⇒ 未判定且不判红(把"看不见"写成"没有"是本仓最高频失效型)',
    op.red.length === 0 && op.undetermined.length === 1,
  )

  // 命名空间再导出可枚举,不该遮蔽整包
  const ns = run({
    'packages/pkg/src/index.ts':
      "export { delivered } from './thing.js'\nexport * as extra from 'some-third-party'\n",
    'apps/web/src/a.ts': "import { hidden } from '@t/pkg'\n",
  })
  t(
    'A6 `export * as NS` 递出的就是 NS 一个名字 ⇒ 不得因此把整包判未判定',
    ns.red.length === 1 && ns.undetermined.length === 0,
  )

  // 子路径:报名不判
  const sp = run({
    'packages/pkg/package.json': JSON.stringify({
      name: '@t/pkg',
      exports: {
        '.': { types: './dist/index.d.ts', import: './dist/index.js' },
        './thing': { types: './dist/thing.d.ts', import: './dist/thing.js' },
      },
    }),
    'apps/web/src/a.ts': "import { hidden } from '@t/pkg/thing'\n",
  })
  t('A7 子路径导入只报名、不进红条件', sp.red.length === 0 && sp.subpath.length === 1)

  // 注释里的 import 不算真导入
  const cm = run({
    'apps/web/src/a.ts': "// import { hidden } from '@t/pkg'\nexport const q = 1\n",
  })
  t('A8 注释里的该形态不得计入(判据必须吃遮噪后的代码面)', cm.red.length === 0)

  // 跨包入口再导出:`@t/pkg` 的入口从另一个 workspace 包具名转导出 ⇒ 递出名单应包含它
  const xp = run({
    'packages/pkg2/package.json': JSON.stringify({
      name: '@t/pkg2',
      main: './dist/index.js',
      exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
    }),
    'packages/pkg2/src/index.ts': 'export const fromTwo = 1\n',
    'packages/pkg/src/index.ts':
      "export { delivered, fromTwo } from './thing.js'\nexport { fromTwo } from '@t/pkg2'\n",
    'packages/pkg/src/thing.ts': 'export function delivered() { return 1 }\n',
    'apps/web/src/a.ts': "import { fromTwo } from '@t/pkg'\n",
  })
  t('A9 跨包入口具名转导出必须被认作"已递出"', xp.red.length === 0)

  // exports 直接指源码
  const srcOnly = run({
    'packages/pkg/package.json': JSON.stringify({
      name: '@t/pkg',
      exports: { '.': './src/index.ts' },
    }),
    'apps/web/src/a.ts': "import { hidden } from '@t/pkg'\n",
  })
  t('A10 exports 指向 ./src/*.ts 的包(从源码消费)同样在射程内', srcOnly.red.length === 1)

  // 取不到清单必须炸,不能静默少一个包
  try {
    analyze({
      readFace: () => null,
      files: ['packages/pkg/package.json', 'apps/web/src/a.ts'],
    })
    t('A11 包清单取不到 ⇒ 抛 Undetermined 而不是当成"没有包"', false)
  } catch (e) {
    t(
      'A11 包清单取不到 ⇒ 抛 Undetermined 而不是当成"没有包"',
      e instanceof Undetermined,
      String(e && e.message),
    )
  }

  // ── 解析器自身的形状
  const pm = parseModule(
    "export { a, type B, c as d } from './x.js'\nexport * from './y.js'\nexport default 1\n",
  )
  t(
    'A12 名单里 inline `type B` 不得算值导出',
    !pm.value.has('B') && pm.value.has('a') && pm.value.has('d'),
  )
  t(
    'A13 包内 `export * from ./y.js` 不得自行置 opaque(名单可数;opaque 只在目标判不了时置)',
    pm.opaque === false && pm.edges.some((e) => e.kind === 'star' && e.spec === './y.js'),
  )
  t('A14 `export default` 算值导出', pm.value.has('default'))
  const ec = entrySourceCandidates(
    './dist/index.d.ts',
    'packages/pkg',
    (p) => p === 'packages/pkg/src/index.ts',
  )
  t(
    'A15 dist 目标回源码候选必须命中 src/index.ts',
    ec.hit === 'packages/pkg/src/index.ts',
    JSON.stringify(ec),
  )
  const ec2 = entrySourceCandidates(
    './src/index.ts',
    'packages/pkg',
    (p) => p === 'packages/pkg/src/index.ts',
  )
  t('A16 源码直指的入口不得被构建目录逻辑改坏', ec2.hit === 'packages/pkg/src/index.ts')
  // 装车形状对照:A15/A16 喂的是**裸子路径**,而调用点(`runtimeEntryCandidates` 的产物)喂的是
  // **已拼过包目录的全路径**。只测前者 ⇒ "双前缀"这类 bug 完全隐身(本门第一版 A1 全红的真因)。
  const ec3 = entrySourceCandidates(
    'packages/pkg/dist/index.d.ts',
    'packages/pkg',
    (p) => p === 'packages/pkg/src/index.ts',
  )
  t(
    'A15b 调用点实形(已拼 dir 的全路径)必须与裸子路径同解,不得再拼一层目录',
    ec3.hit === 'packages/pkg/src/index.ts',
    JSON.stringify(ec3),
  )
  t(
    'A15c 运行时入口候选同样必须是全路径且不双前缀',
    JSON.stringify(
      runtimeEntryCandidates({ name: 'x', main: './dist/index.js' }, 'packages/pkg'),
    ) === '["packages/pkg/dist/index.js"]',
  )
  t(
    'A17 遮噪必须等行(报告给的 file:line 不能漂)',
    maskComments('a\n//x\nb\n/*\nc\n*/\nd').split('\n').length === 7,
  )
  t(
    'A17b 抹字符串不得吃换行(否则行号漂 + 真 export 被吞成"没那么多关键字"而漏置未判定)',
    blankStrings("x = 'a\ng'\nexport const k = 1\n").split('\n').length === 4,
  )

  // ── 包内 spec 的 `.js` → `.ts` 映射:本仓所有 `export * from './x.js'` 都靠它
  //    (第一版只补后缀 ⇒ 每条边都"解析不到" ⇒ 整包降为未判定,而账面仍是"红 0")
  t(
    'A19 REL_CANDS 必须把 ./user.js 解到 user.ts(ESM 源码写 .js 指 .ts)',
    REL_CANDS('packages/types/src/user.js').includes('packages/types/src/user.ts'),
  )
  const deep = analyze({
    files: [
      'packages/p2/package.json',
      'packages/p2/src/index.ts',
      'packages/p2/src/endpoints/a.ts',
      'packages/p2/src/endpoints/b.ts',
      'apps/web/src/deep.ts',
    ],
    readFace: (p) =>
      ({
        'packages/p2/package.json': JSON.stringify({
          name: '@t/p2',
          main: './dist/index.js',
          exports: { '.': './dist/index.js' },
        }),
        'packages/p2/src/index.ts': "export * from './endpoints/a.js'\n",
        'packages/p2/src/endpoints/a.ts':
          "export { alpha } from './b.js'\nexport function fromA() { return 1 }\n",
        'packages/p2/src/endpoints/b.ts':
          'export function alpha() { return 2 }\nexport function onlyB() { return 3 }\n',
        'apps/web/src/deep.ts': "import { fromA } from '@t/p2'\nimport { onlyB } from '@t/p2'\n",
      })[p] ?? null,
  })
  t(
    'A20 两层 star 边必须按"当前文件"为基准解(不是入口),递出名单才完整',
    deep.red.length === 1 && deep.red[0].name === 'onlyB' && deep.undetermined.length === 0,
    JSON.stringify({ red: deep.red.map((r) => r.name), und: deep.undetermined }),
  )
  t(
    'A21 经 star 边递出的名字不得被误判红(对照组)',
    !deep.red.some((r) => r.name === 'fromA' || r.name === 'alpha'),
  )

  // ── 档位分离:值表里的 inline `type X` 条目只走类型档
  //    (真仓 design-tokens 入口 `export { tokens, type RnThemeTokens } from './rn-tokens.js'`
  //     即此形状;把它记进值档 = 报告印出"入口递出值 N"里混着运行时根本不存在的名字,
  //     覆盖自查就成了自我安慰 —— 本门唯一能看见自己盲区的读数就是那一行。)
  const mixed = parseModule("export { tokens, type RnThemeTokens, type A as B } from './x.js'\n")
  const edge = mixed.edges[0]
  t(
    'A22 名单里 inline `type X`(含 `as` 形式)必须落类型档、不得混进值档',
    edge.typeNames.has('RnThemeTokens') &&
      edge.typeNames.has('B') &&
      !edge.typeNames.has('tokens') &&
      !mixed.value.has('RnThemeTokens') &&
      mixed.type.has('RnThemeTokens') &&
      mixed.type.has('B'),
    JSON.stringify({ v: [...mixed.value], t: [...mixed.type], tn: [...edge.typeNames] }),
  )
  t(
    'A22b 对照组:纯值条目不得被顺手记成类型档(否则值档漏一个,又是一种自证失明)',
    edge.names.length === 3 && edge.names.includes('tokens') && !edge.typeOnly,
  )

  // ── 端内 barrel 族(2026-09-28 扩的第二族):同一判据,只是把"包"换成"目录"
  //    夹具形状逐条对着真仓量出来的形态写:`apps/<端>/src/ui/index.ts` 显式命名清单 +
  //    消费者按目录导入(相对 或 tsconfig 别名),兄弟文件里有那个值导出。
  const mkApp = (over = {}) => {
    const files = {
      'apps/web/package.json': JSON.stringify({ name: '@w/web', version: '0.0.0' }),
      'apps/web/tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '@/*': ['./src/*'] } },
        include: ['src/**/*.ts'],
      }),
      'apps/web/src/common/index.ts':
        "export { Empty } from './Empty.js'\nexport { BackButton, hb } from './BackButton.js'\n",
      'apps/web/src/common/Empty.ts': 'export function Empty() { return 1 }\n',
      'apps/web/src/common/BackButton.tsx':
        'export function BackButton() { return 2 }\nexport const hb = 3\nexport interface BackButtonProps { a: number }\n',
      ...over,
    }
    const list = Object.keys(files)
    return { files: list, readFace: (p) => (Object.prototype.hasOwnProperty.call(files, p) ? files[p] : null) }
  }
  const runApp = (over, consumer) => {
    const f = mkApp({ ...(consumer ? { 'apps/web/src/a.ts': consumer } : {}), ...over })
    return analyze({ readFace: f.readFace, files: f.files, requireBarrels: true })
  }
  // ① 对照组:名单齐备时不得判红(否则这一族一上线就是恒红)
  const appOk = runApp(undefined, "import { BackButton, hb } from './common'\nexport const x = [BackButton, hb]\n")
  t(
    'A23 端内 barrel 对照组:名字确实递着时不得判红(否则新射程=新恒红门)',
    appOk.red.length === 0 && appOk.barrelConsumers === 1,
    `red=${JSON.stringify(appOk.red.map((r) => r.name))} consumers=${appOk.barrelConsumers}`,
  )
  const appMiss = runApp(
    {
      'apps/web/src/common/index.ts': "export { Empty } from './Empty.js'\n",
    },
    "import { BackButton } from './common'\nexport const x = BackButton\n",
  )
  t(
    'A24 端内 barrel:摘掉那一行具名 re-export ⇒ 判红并点名 barrel 与消费者(真事故形状)',
    appMiss.red.length === 1 &&
      appMiss.red[0].name === 'BackButton' &&
      appMiss.red[0].scope === 'barrel' &&
      appMiss.red[0].entry === 'apps/web/src/common/index.ts' &&
      appMiss.red[0].file === 'apps/web/src/a.ts',
    JSON.stringify(appMiss.red),
  )
  // ② 别名(`@/common`)导入同样在射程内 —— 这一族此前**连报名都没有**
  const appAlias = runApp(
    { 'apps/web/src/common/index.ts': "export { Empty } from './Empty.js'\n" },
    "import { BackButton } from '@/common'\nexport const x = BackButton\n",
  )
  t(
    'A25 tsconfig 别名解析到 barrel 也必须判(旧版把别名当"未知裸名"静默丢掉)',
    appAlias.red.length === 1 && appAlias.red[0].scope === 'barrel',
    JSON.stringify({ red: appAlias.red, und: appAlias.undetermined }),
  )
  // ③ 经包内 star 边递出的名字不得判红(判据必须覆盖门自己产出的形态)
  const appStar = runApp(
    {
      'apps/web/src/common/index.ts': "export { Empty } from './Empty.js'\nexport * from './extra.js'\n",
      'apps/web/src/common/extra.ts': 'export function viaStar() { return 1 }\n',
    },
    "import { viaStar } from './common'\nexport const x = viaStar\n",
  )
  t(
    'A26 barrel 的**包内** `export *` 边必须被跟着递出(不得因看见 star 就整族判未判定)',
    appStar.red.length === 0 && appStar.undetermined.length === 0,
    JSON.stringify({ red: appStar.red.map((r) => r.name), und: appStar.undetermined }),
  )
  // ④ 三方 star 边 ⇒ 未判定,且不判红(把"看不见"写成"没有"是本仓最高频失效型)
  const appOpaque = runApp(
    {
      'apps/web/src/common/index.ts':
        "export { Empty } from './Empty.js'\nexport * from 'some-third-party'\n",
    },
    "import { BackButton } from './common'\nexport const x = BackButton\n",
  )
  t(
    'A27 barrel 含不可枚举的 star 边 ⇒ 该 barrel 整体未判定、一条都不判红',
    appOpaque.red.length === 0 &&
      appOpaque.undetermined.length === 1 &&
      String(appOpaque.undetermined[0].pkg).startsWith('barrel:'),
    JSON.stringify({ red: appOpaque.red, und: appOpaque.undetermined }),
  )
  // ⑤ 只有类型形态漏递 ⇒ typeMiss 档
  const appType = runApp(
    { 'apps/web/src/common/index.ts': "export { Empty } from './Empty.js'\n" },
    "import { BackButtonProps } from './common'\nexport type T = BackButtonProps\n",
  )
  t(
    'A28 类型形态漏递落 typeMiss 不判红(编译期擦除,不构成运行时 undefined)',
    appType.red.length === 0 &&
      appType.typeMiss.length === 1 &&
      appType.typeMiss[0].name === 'BackButtonProps',
    JSON.stringify({ red: appType.red, ty: appType.typeMiss }),
  )
  // ⑥ 名字在这层目录以外 ⇒ notFound 档,不判红(存在性取证只认该层目录)
  const appFar = runApp(undefined, "import { loadPlugins } from './common'\nexport const x = loadPlugins\n")
  t(
    'A29 名字不在 barrel 那层目录里 ⇒ 记"查无此名"而不是判红(取证面窄,宁漏不误报)',
    appFar.red.length === 0 &&
      appFar.notFound.some((n) => n.name === 'loadPlugins' && n.scope === 'barrel'),
    JSON.stringify({ red: appFar.red, nf: appFar.notFound.map((n) => n.name) }),
  )
  // ⑦ 空枚举必须判死,不得记绿
  try {
    const list = ['apps/web/package.json', 'apps/web/src/a.ts']
    analyze({
      readFace: (p) => (p === 'apps/web/src/a.ts' ? "export const x = 1\n" : '{"name":"@w/web"}'),
      files: list,
      requireBarrels: true,
    })
    t('A30 枚举到 0 个 barrel ⇒ 判死(空扫不得被记成通过)', false)
  } catch (e) {
    t(
      'A30 枚举到 0 个 barrel ⇒ 判死(空扫不得被记成通过)',
      e instanceof Undetermined,
      String(e && e.message),
    )
  }
  // ⑧ 有 barrel 却没有一条导入落在上面 ⇒ 同样判死(解析器瞎了)
  try {
    const f = mkApp()
    analyze({
      readFace: f.readFace,
      files: f.files,
      requireBarrels: true,
    })
    t('A31 有 barrel 而无一条导入落在其上 ⇒ 判死(解析失明的第二种形态)', false)
  } catch (e) {
    t(
      'A31 有 barrel 而无一条导入落在其上 ⇒ 判死(解析失明的第二种形态)',
      e instanceof Undetermined,
      String(e && e.message),
    )
  }
  // ⑨ 包入口本身不重复进 barrel 族(两面判的说明符形状不同,不得各计一次)
  const dbl = run({
    'apps/web/src/a.ts': "import { delivered } from '@t/pkg'\nimport { delivered as d2 } from '../../../packages/pkg/src/index.js'\n",
  })
  t(
    'A32 包入口被相对路径直导时不得被 barrel 族重复计债(它已在包面射程内)',
    dbl.red.length === 0 && !dbl.red.some((r) => r.scope === 'barrel'),
    JSON.stringify({ red: dbl.red.map((r) => `${r.name}:${r.scope}`) }),
  )

  // ── 真仓 HEAD 阳性对照:看不见存量不算通过
  let realNote = '--strict 未在自检里跑(避免自派生第二遍全量读取)'
  try {
    const files = listFacePaths('head')
    const reader = makeReader('head')
    reader.prepare(
      files.filter(
        (f) =>
          (SRC_RE.test(f) && !SKIP_DIR.test(f)) ||
          f.endsWith('package.json') ||
          TS_RE.test(f),
      ),
    )
    const r = analyze({ readFace: (p) => reader.read(p), files, requireBarrels: true })
    realNote = `真仓 HEAD:红 ${r.red.length}(端内 barrel ${r.red.filter((x) => x.scope === 'barrel').length})/ 类型 ${r.typeMiss.length} / 查无 ${r.notFound.length} / 子路径 ${r.subpath.length} / 未判定 ${r.undetermined.length} / barrel 枚举 ${r.barrels} 被消费 ${r.barrelConsumers}`
    t(
      'A18 真仓 HEAD 必须枚举到 workspace 包与消费者(空扫不算判过)',
      r.packages > 5 && r.consumerFiles > 100,
      realNote,
    )
    // 端内 barrel 族自己的阳性对照:枚举到了、也确实有导入落在上面 —— 两边任一为 0
    // 都说明这一族是"看不见所以没红",不是"仓库干净"。
    t(
      'A18b 真仓 HEAD 必须枚举到目录 barrel **且**有相对/别名导入落在它们上(新射程不得是空转)',
      r.barrels > 50 && r.barrelConsumers > 20,
      `实得 枚举 ${r.barrels} / 被消费 ${r.barrelConsumers}`,
    )
  } catch (e) {
    t('A18 真仓 HEAD 必须枚举到 workspace 包与消费者(空扫不算判过)', false, String(e && e.message))
  }

  let fail = 0
  for (const c of cases) {
    console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.ok ? '' : ` —— ${c.extra}`}`)
    if (!c.ok) fail += 1
  }
  console.log(realNote)
  console.log(fail ? `❌ ${fail} 例失败` : `\n全部 ${cases.length} 例通过`)
  return fail ? 1 : 0
}

export const __test__ = {
  analyze,
  parseModule,
  parseImports,
  maskComments,
  entrySourceCandidates,
  runtimeEntryCandidates,
  deliveredOf,
  resolveRelative,
  REL_CANDS,
  perFileCounts,
  manifestPaths,
  Undetermined,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const code = main()
  if (code) process.exit(code)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
