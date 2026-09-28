#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console */
/** check-web-tokens-sync.mjs - 守门 37: web globals.css 必须 @import 设计 token 源头,
 * 且不得在顶层 :root/.dark 重宣 tokens.css 的 @theme 变量(2026-07-23 done).
 * Allow: @media/@layer/@container blocks (high-contrast override etc).
 * Block: top-level :root/.dark re-declaring @theme vars (regression).
 *
 * 取材面(2026-09-28 收口,台账 G-391 第①格;口径同守门 36/93/124/118):
 * 默认判 **HEAD blob**,`--staged` 判**索引 blob**(这次提交会带走的那一份 —— 盘上随后改
 * 对不算修好),`--worktree` 只作人工逃生舱,两面旗同给 = 自相矛盾 ⇒ 判死;任一面取不到
 * ⇒ **exit 2「无法判定」**,既不冒红也不记绿,且**不回落**到另一个面(回落就是把"没判"
 * 写成"判过了")。被审文件的**清单与内容同面同轮**:清单走共用层的 `ls-tree`/`ls-files`
 * 出口在同一档上枚举(旧形态按磁盘拼路径,清单来自盘而内容来自盘,与提交链的索引面无关)。
 * 为什么必须换:共享工作树常年滞后 HEAD,按磁盘判的 blocking 门会在恒红与假绿之间来回跳,
 * 判错方向的那一次会把与改动无关的人钉红 ⇒ 唯一出路是 `--no-verify` ⇒ 整条守门链对该提交
 * 作废(AGENTS §12e/§12f 一天内实测三道同型)。
 *
 * Usage: node scripts/check-web-tokens-sync.mjs [--quiet|--staged|--worktree|--self-test]
 * Exit: 0=ok, 1=regression, 2=无法判定(两面旗同给 / 被审面取不到 / 枚举到 0 个被审文件)
 * Template: check-rn-global-css-sync.mjs */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
// 取材只走这一层:绝对路径 git、safe.directory、quotepath、windowsHide、maxBuffer、
// "输出被截断 ⇒ 无法判定" —— 这几处易错点各门自己写一遍就会各漏一遍(AGENTS §4/守门 118)。
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
/** 被审文件(仓库相对路径):清单按被审判的那一面枚举,不得摸盘 */
const WEB_GLOBALS_REL = 'apps/web/app/globals.css'
const TOKENS_REL = 'packages/design-tokens/src/styles/tokens.css'
const AUDITED = [WEB_GLOBALS_REL, TOKENS_REL]
const args = process.argv.slice(2)
const quiet = args.includes('--quiet')

/**
 * 纯函数:argv → 判定面(默认 **head**)。导出是为了"默认档不再是磁盘"这一格能被构造面证明,
 * 而不是等人跑一次真仓看结论行 —— 结论行会被人改,函数不会。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

/**
 * 在**被审判的那一面**上枚举被审文件(层的清单出口:head ⇒ `ls-tree`,索引/工作树 ⇒ `ls-files`)。
 * 枚举到 0 个 ⇒ 抛 `Undetermined` —— 空扫不是"没问题",是"什么都没判",不得记绿。
 * 工作树档也先问跟踪清单再按磁盘读:否则别人未跟踪的临时副本会被当成本仓内容判红。
 */
export function listAuditedFiles(repoRoot, face) {
  const listed =
    face === 'head'
      ? gitRaw(['ls-tree', '--name-only', 'HEAD', '--', ...AUDITED], repoRoot)
      : gitRaw(['ls-files', '--', ...AUDITED], repoRoot)
  const onFace = listed
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => AUDITED.includes(s.replace(/\\/g, '/')))
  if (onFace.length === 0)
    throw new Undetermined(
      `${FACE_TXT[face]} 在 ${repoRoot} 枚举到 0 个被审文件(${AUDITED.join(' / ')}),判据不扫空气`,
    )
  return onFace
}

/**
 * 按判定面取被审内容:**清单与内容同一轮、同一个面**。
 * 一次 `cat-file --batch` 读完(逐文件派生 git 在真仓是上千次进程创建,属禁止形态);
 * 任一条取不到 ⇒ 抛 `Undetermined`(调用方折成 exit 2),**不回落**到另一个面。
 * root/face 都是入参:镜像测试因此能在临时 git 仓里造"索引≠磁盘"的现场,不依赖真仓瞬时状态。
 */
export function readFaceInputs(repoRoot, face) {
  const rels = listAuditedFiles(repoRoot, face)
  // 两个被审文件缺任何一个都判不了:一份是副本、一份是源头,缺一即"没判"。
  // 必须在这里喊,不许悄悄少扫一个再按"没有违规"记绿,也不许去另一个面借那一份。
  const absent = AUDITED.filter((rel) => !rels.includes(rel))
  if (absent.length > 0)
    throw new Undetermined(
      `${FACE_TXT[face]} 缺被审文件:${absent.join(' / ')} —— 该面上取不到,不回落另一个面`,
    )
  if (face === 'worktree') {
    const out = {}
    for (const rel of rels) {
      const t = readWorktreeFile(repoRoot, rel)
      if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${rel}`)
      out[rel] = t
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
  const out = {}
  for (let i = 0; i < rels.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined)
      throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${rels[i]}`)
    out[rels[i]] = t
  }
  return out
}

function findTopLevelBlocks(css, selectors) {
  const blocks = []
  const stack = []
  let i = 0
  let line = 1
  while (i < css.length) {
    const ch = css[i]
    if (ch === '\n') {
      line++
      i++
      continue
    }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      if (end === -1) break
      for (let k = i; k < end + 2; k++) if (css[k] === '\n') line++
      i = end + 2
      continue
    }
    if (ch === '@') {
      const m = css.slice(i).match(/^@(\w[\w-]*)/)
      if (m) {
        let j = i + m[0].length
        while (j < css.length && css[j] !== '{' && css[j] !== ';') {
          if (css[j] === '\n') line++
          if (css[j] === '/' && css[j + 1] === '*') {
            const end = css.indexOf('*/', j + 2)
            if (end === -1) {
              j = css.length
              break
            }
            for (let k = j; k < end + 2; k++) if (css[k] === '\n') line++
            j = end + 2
            continue
          }
          j++
        }
        if (css[j] === '{') {
          stack.push({ type: 'at-rule', name: m[1] })
          i = j + 1
          continue
        }
        if (css[j] === ';') {
          i = j + 1
          continue
        }
        i = j
        continue
      }
    }
    if (ch === '{') {
      let k = i - 1
      while (k >= 0 && /\s/.test(css[k])) k--
      const selEnd = k + 1
      while (k >= 0) {
        if (css[k] === '}' || css[k] === '{' || css[k] === ';') break
        if (css[k] === '/' && css[k - 1] === '*') {
          k -= 2
          while (k >= 0 && !(css[k] === '/' && css[k + 1] === '*')) k--
          k--
          continue
        }
        k--
      }
      const selector = css.slice(k + 1, selEnd).trim()
      const inAtRule = stack.some((s) => s.type === 'at-rule')
      if (!inAtRule && selectors.includes(selector)) {
        const bs = i + 1
        let bd = 1,
          be = bs
        const bl = line
        while (be < css.length && bd > 0) {
          if (css[be] === '/' && css[be + 1] === '*') {
            const end = css.indexOf('*/', be + 2)
            be = end === -1 ? css.length : end + 2
            continue
          }
          if (css[be] === '{') bd++
          else if (css[be] === '}') bd--
          else if (css[be] === '\n') line++
          be++
        }
        blocks.push({ selector, content: css.slice(bs, be - 1), line: bl })
      }
      stack.push({ type: 'block', selector })
      i++
      continue
    }
    if (ch === '}') {
      stack.pop()
      i++
      continue
    }
    i++
  }
  return blocks
}

function extractVarNames(text) {
  const names = new Set()
  const re = /(--[\w-]+)\s*:/g
  let m
  while ((m = re.exec(text)) !== null) names.add(m[1])
  return [...names]
}

function extractThemeVarNames(css) {
  const tm = css.match(/@theme\s*\{([\s\S]*?)\}/)
  if (!tm) return new Set()
  const names = new Set()
  const re = /(--[\w-]+)\s*:/g
  let m
  while ((m = re.exec(tm[1])) !== null) names.add(m[1])
  return names
}

// --- 判据(与取材面无关的那一半)---

const TOKEN_IMPORT_RE = /@import\s+['"][^'"]*design-tokens\/src\/styles\/tokens\.css['"]/
// base.css 的 @import 由本文件一并守(2026-09-25):原判据在无调度的
// scripts/check-web-tokens-import.mjs 里 —— 那道判据今天没有任何调度器执行它(门 89 分类:
// "有判据但零调用"),而 base.css 一旦不再被 @import,web 端拿不到 base 层样式且不报错。
// 与小程序端对称:apps/miniapp-taro/src/app.css 的 base.css @import 由
// scripts/check-miniapp-taro-design-tokens.mjs:247 判。刻意不另挂一道新门(§3 零冗余,
// 两个漂移源必然各自腐烂)。
const BASE_IMPORT_RE = /@import\s+['"][^'"]*design-tokens\/src\/styles\/base\.css['"]/

/**
 * 纯判据。**判据语义与 2026-09-28 取材面收口之前逐字相同**(什么算违规、WARN 不算红、
 * 退出码 0/1 的含义都没动)—— 本票只换取材来源,所以这一段做成纯函数,三面取证都喂它。
 * @returns {{info:string[],errors:string[],exitCode:number,themeVarCount:number}}
 */
export function judge({ webCss, tokensCss }) {
  const info = []
  const errors = []
  let exitCode = 0

  if (!TOKEN_IMPORT_RE.test(webCss)) {
    errors.push('[check-web-tokens-sync] REGRESSION: globals.css missing @import tokens.css!')
    errors.push('  web must @import single source token, do not remove.')
    exitCode = 1
  } else {
    info.push('[check-web-tokens-sync] @import tokens.css OK')
  }

  if (!BASE_IMPORT_RE.test(webCss)) {
    errors.push('[check-web-tokens-sync] REGRESSION: globals.css missing @import base.css!')
    errors.push('  base layer (shared resets) is not loaded by any other means on web.')
    exitCode = 1
  } else {
    info.push('[check-web-tokens-sync] @import base.css OK')
  }

  const themeVarNames = extractThemeVarNames(tokensCss)
  if (themeVarNames.size === 0) {
    // 与收口前同形:源头 @theme 空是 **WARN 到 stderr**,不改退出码(不是"违规")
    errors.push('[check-web-tokens-sync] WARN: tokens.css @theme has no vars')
  } else {
    info.push('[check-web-tokens-sync] tokens.css @theme: ' + themeVarNames.size + ' vars')
  }

  const topBlocks = findTopLevelBlocks(webCss, [':root', '.dark'])
  if (topBlocks.length === 0) {
    info.push(
      '[check-web-tokens-sync] no top-level :root/.dark blocks OK (high-contrast in @media allowed)',
    )
  } else {
    const regressions = []
    for (const b of topBlocks) {
      const vars = extractVarNames(b.content)
      const dups = vars.filter((v) => themeVarNames.has(v))
      if (dups.length > 0) regressions.push({ selector: b.selector, line: b.line, dups })
    }
    if (regressions.length > 0) {
      errors.push(
        '[check-web-tokens-sync] REGRESSION: top-level :root/.dark hand-copies tokens.css @theme vars!',
      )
      errors.push('  Should use @import, duplicate defs cause 3-end drift.')
      for (const r of regressions) {
        errors.push('  ' + r.selector + ' (line ' + r.line + '): ' + r.dups.join(', '))
      }
      exitCode = 1
    } else {
      info.push('[check-web-tokens-sync] ' + topBlocks.length + ' top-level blocks no dup OK')
    }
  }

  // 通过与否只由 exitCode 表达;末行的"结论行"由调用方带上面名打印
  // (结论行必须写明这句话是关于哪个面的 —— 守门 36/124 同型)。
  return { info, errors, exitCode, themeVarCount: themeVarNames.size }
}

/** 自检:纯内存夹具,成对正反(只证"会红"不证"不该红时不红"的判据等于没有)。 */
function selfTest() {
  const results = []
  const ok = (name, cond, extra = '') =>
    results.push(`${cond ? '✅' : '❌'} ${name}${extra ? ` → ${extra}` : ''}`)

  const TOKENS = '@theme {\n  --color-x: #fff;\n  --color-y: #000;\n}\n'
  const GOOD =
    '@import "../packages/design-tokens/src/styles/tokens.css";\n' +
    '@import "../packages/design-tokens/src/styles/base.css";\n' +
    '@media (prefers-contrast: more) { :root { --color-x: #111; } }\n'

  const clean = judge({ webCss: GOOD, tokensCss: TOKENS })
  ok(
    'S1 合规夹具必须判绿(否则本门是恒红门,唯一结局是逼人 --no-verify)',
    clean.exitCode === 0,
    JSON.stringify(clean.errors),
  )
  ok(
    'S2 @media 内的 :root 不得进射程(高对比覆盖是有意设计)',
    clean.errors.length === 0,
    JSON.stringify(clean.errors),
  )

  const noTokens = judge({
    webCss: GOOD.replace(/@import[^;]*tokens\.css";\n/, ''),
    tokensCss: TOKENS,
  })
  ok(
    'S3 摘掉 @import tokens.css ⇒ 必红(阳性对照)',
    noTokens.exitCode === 1 && noTokens.errors.some((l) => /missing @import tokens\.css/.test(l)),
    JSON.stringify(noTokens.errors),
  )

  const noBase = judge({ webCss: GOOD.replace(/@import[^;]*base\.css";\n/, ''), tokensCss: TOKENS })
  ok(
    'S4 摘掉 @import base.css ⇒ 必红(第二份判据也在位)',
    noBase.exitCode === 1 && noBase.errors.some((l) => /missing @import base\.css/.test(l)),
    JSON.stringify(noBase.errors),
  )

  const dup = judge({ webCss: GOOD + '\n:root { --color-x: #123456; }\n', tokensCss: TOKENS })
  ok(
    'S5 顶层 :root 重宣 @theme 档 ⇒ 必红且点名该档',
    dup.exitCode === 1 && dup.errors.some((l) => /--color-x/.test(l)),
    JSON.stringify(dup.errors),
  )

  const darkDup = judge({ webCss: GOOD + '\n.dark { --color-y: #654321; }\n', tokensCss: TOKENS })
  ok(
    'S6 顶层 .dark 同型(两个选择器都要判)',
    darkDup.exitCode === 1 && darkDup.errors.some((l) => /--color-y/.test(l)),
    JSON.stringify(darkDup.errors),
  )

  const emptyTheme = judge({ webCss: GOOD, tokensCss: ':root { --color-z: #000; }\n' })
  ok(
    'S7 源头 @theme 空 = WARN 不判红(收口前的退出码语义保持)',
    emptyTheme.exitCode === 0 &&
      emptyTheme.errors.some((l) => /^.*WARN: tokens\.css @theme has no vars$/.test(l)),
    JSON.stringify(emptyTheme),
  )

  // 取材面四态:这一组就是"默认档已从磁盘换成 HEAD"的机器证明 —— 结论行会被人改,函数不会。
  ok(
    'S8 默认面必须是 HEAD(旧默认是磁盘,本条是换锚的反向锁)',
    faceFromArgv([]).face === 'head',
    JSON.stringify(faceFromArgv([])),
  )
  ok(
    'S9 --staged ⇒ 索引面',
    faceFromArgv(['--staged']).face === 'staged',
    JSON.stringify(faceFromArgv(['--staged'])),
  )
  ok(
    'S10 --worktree ⇒ 人工逃生舱面',
    faceFromArgv(['--worktree']).face === 'worktree',
    JSON.stringify(faceFromArgv(['--worktree'])),
  )
  ok(
    'S11 两个面旗同给 ⇒ 判死(取哪一面都会让另一面成为假绿)',
    !!faceFromArgv(['--staged', '--worktree']).error,
    JSON.stringify(faceFromArgv(['--staged', '--worktree'])),
  )

  // 清单与内容同面同轮的载体:listAuditedFiles 不得摸盘,空枚举必须抛而不是返回 [] 让下游算成"没违规"
  let threw = null
  try {
    listAuditedFiles(join(root, '..'), 'head')
  } catch (e) {
    threw = e
  }
  ok(
    'S12 非仓库目录取清单 ⇒ 抛错而不是返回空清单(空清单被读成"没违规"那一型)',
    threw !== null,
    String(threw && threw.message),
  )

  for (const r of results) console.log(r)
  const failed = results.filter((r) => r.startsWith('❌')).length
  console.log(failed ? `self-test 失败 ${failed} 条` : `✅ self-test 全通过(${results.length} 条)`)
  process.exit(failed ? 1 : 0)
}

// --- Main ---

function main() {
  if (args.includes('--self-test')) return selfTest()
  const sel = faceFromArgv(args)
  if (sel.error) {
    console.error(`[check-web-tokens-sync] ❌ 无法判定:${sel.error}`)
    process.exit(2)
  }
  const face = sel.face
  if (!quiet)
    console.log(
      `[check-web-tokens-sync] Verifying globals.css @import single source...(取材面:${FACE_TXT[face]})`,
    )
  let inputs
  try {
    inputs = readFaceInputs(root, face)
  } catch (e) {
    // 「无法判定」是预期结论,一句话足够;**其他异常**必须带栈落地 —— 匿名 exit 2 = 不可诊断
    // (守门 36/93 同型教训:一个编码/权限错误不得伪装成"该文件不存在"的业务结论)。
    const known = e instanceof Undetermined
    console.error(
      `[check-web-tokens-sync] 取不到输入(${FACE_TXT[face]})⇒ 无法判定(不记为通过):${
        known ? e.message : (e?.stack ?? e)
      }`,
    )
    process.exit(2)
  }

  const { info, errors, exitCode, themeVarCount } = judge({
    webCss: inputs[WEB_GLOBALS_REL],
    tokensCss: inputs[TOKENS_REL],
  })
  if (!quiet) for (const line of info) console.log(line)
  for (const line of errors) console.error(line)
  if (exitCode === 0) {
    if (!quiet)
      console.log(
        `[check-web-tokens-sync] OK web token single source normal, no regression(取材面:${FACE_TXT[face]})`,
      )
    process.exit(0)
  }
  // 结论行必须落在**末行**:镜像测试按末行断言"这句话是关于哪个取材面的"(守门 36/124 同型)。
  console.error(
    `[check-web-tokens-sync] Found ${errors.filter((l) => /REGRESSION/.test(l)).length} 条 REGRESSION(取材面:${FACE_TXT[face]},源头 @theme ${themeVarCount} 档)`,
  )
  process.exit(exitCode)
}

// §22d:CLI 直接执行才跑主流程;被镜像测试 import 时不得有副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = {
  judge,
  faceFromArgv,
  listAuditedFiles,
  readFaceInputs,
  FACE_TXT,
  AUDITED,
  WEB_GLOBALS_REL,
  TOKENS_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
