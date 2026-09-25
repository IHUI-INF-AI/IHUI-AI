#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-miniapp-tokens-sync.mjs — 守门 36(blocking):
 * `apps/miniapp-taro/src/app.css` 的受管 CSS 变量必须与
 * `packages/design-tokens/src/styles/tokens.css` **逐位同值且不得缺档**。
 *
 * 为什么小程序端要有一份副本:Taro 4 + Tailwind v3 不认 v4 的 `@theme` 语法,无法 `@import tokens.css`。
 * 写回的一侧是 `scripts/sync-miniapp-tokens.mjs`(2026-09-25 由端内 `apps/miniapp-taro/scripts/sync-design-tokens.mjs`
 * 搬来 —— 搬的原因见该文件头注:守门与本生成器必须共用一份取源,而取源住在工具层);
 * 本门只判、只报差异,不改文件。
 * 提交链里两者是同一枚提交的两步 —— `scripts/lib/pre-commit-hook.js` 的 `TOKEN_SYNC_TARGETS`
 * 会先跑生成器再让本门复核,所以按规矩改源头不会被本门拦。
 *
 * 2026-09-25 的两处收紧(都由实测逼出,与 `scripts/check-rn-global-css-sync.mjs` 同形):
 * 1. **取值改与生成器共用一份实现**:旧版本门自己写了 `extractAllBlocks` / `stripComments` /
 *    `extractColorVars` 三件套,而生成器另写一套按行解析的 —— 同一判据两处不同形正是本仓反复记录的
 *    成因(AGENTS §4)。现「源头有哪些档归本端管」直接 import 生成器的 `deriveMiniappManaged`,
 *    跳过表(`MINIAPP_SKIP_PREFIXES`)也只有那一份:生成器按政策不搬的档,门不得判它缺。
 * 2. **判缺档(missing)**:旧判据只遍历**副本已有的键**做值比对 ⇒ 结构上看不见
 *    「源头有、副本缺」。实测同型的 RN 那道门对「缺 124 档」一路报绿;小程序端一旦有人在受管块里
 *    少写/删掉一档,旧门就是瞎的。现缺档即红 —— 生成器会自动补入,所以这条不会恒红,
 *    它拦的是「没人跑生成器」与「有人手删了受管行」这两种形态。
 *
 * 取材面(2026-09-25 收口,同守门 93/77/83/91/103 口径):默认判 **HEAD blob**,`--staged` 判
 * **索引 blob**(这次提交会带走的那一份 —— 盘上随后改对不算修好),`--worktree` 只作人工逃生舱,
 * 两个面旗同给 = 自相矛盾 ⇒ 判死;任一面取不到 ⇒ **exit 2「无法判定」**,既不冒红也不记绿。
 * 为什么不再是"默认判磁盘":共享工作树常年滞后 HEAD,按磁盘判会在恒红与假绿之间来回跳,
 * 并把错数写回棘轮基线(旧写法 `--staged` 取不到索引还悄悄回落 HEAD,那是自洽而错位的假绿)。
 *
 * 用法:
 *   node scripts/check-miniapp-tokens-sync.mjs             全量(HEAD blob)
 *   node scripts/check-miniapp-tokens-sync.mjs --staged    索引面
 *   node scripts/check-miniapp-tokens-sync.mjs --worktree  人工排查(盘上内容,提交链不走这档)
 *   node scripts/check-miniapp-tokens-sync.mjs --quiet     只出错才说话
 *   node scripts/check-miniapp-tokens-sync.mjs --self-test 判据自检(纯内存夹具,不碰真仓)
 * 退出码:0 = 一致;1 = 值漂移 / 缺档;2 = 无法判定(含两个面旗同给)
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
// 取材只走这一层:绝对路径 git、safe.directory、quotepath、windowsHide、maxBuffer、
// "输出被截断 ⇒ 无法判定" —— 这五处易错点各门自己写一遍就会各漏一遍(AGENTS §4/守门 118)。
import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { collectVars } from './lib/design-token-blocks.mjs'
import {
  deriveMiniappManaged,
  TOKENS_SOURCE_REL,
  APP_CSS_REL,
} from './sync-miniapp-tokens.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const quiet = args.includes('--quiet')

/**
 * 纯函数:argv → 判定面(默认 head)。导出是为了让"默认已不再是磁盘"这一格能被构造面证明,
 * 而不是等人跑一次真仓看一眼结论行 —— 结论行会被人改,函数不会。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

const FACE_SEL = faceFromArgv(args)
const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

/**
 * 按判定面取**两份**输入(源 + 副本),一次 `cat-file --batch` 同面同轮读完。
 * 混面会在并发会话的瞬间产出假红/假绿;取不到一律抛 `Undetermined`(调用方折成 exit 2),
 * **不回落**到另一个面 —— 回落就是把"没判"写成"判过了"。
 * root/face 都是入参:镜像测试因此能在临时 git 仓里造"索引≠磁盘"的现场,不依赖真仓瞬时状态。
 */
export function readFaceInputs(repoRoot, face) {
  const rels = [TOKENS_SOURCE_REL, APP_CSS_REL]
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

/**
 * 纯判据:源头受管档在副本里必须**存在**且**等值**。
 * @returns {{mismatches:Array,missing:Array,extras:number}} extras = 端内自有档,只报数不判红
 */
export function compare({ tokensCss, appCss }) {
  const want = {
    ':root': deriveMiniappManaged(tokensCss, 'light'),
    '.dark': deriveMiniappManaged(tokensCss, 'dark'),
  }
  const have = { ':root': collectVars(appCss, [':root']), '.dark': collectVars(appCss, ['.dark']) }
  const mismatches = []
  const missing = []
  let extras = 0
  for (const block of [':root', '.dark']) {
    for (const d of want[block]) {
      const got = have[block].get(d.name)
      if (got === undefined) missing.push({ block, name: d.name, want: d.value })
      else if (got.value !== d.value) mismatches.push({ block, name: d.name, app: got.value, tok: d.value })
    }
    // 副本里有、源头不该管到本端的档:端内自立档(或整端独有档位),生成器无权删,本门只报数不判红
    const managedNames = new Set(want[block].map((d) => d.name))
    extras += [...have[block].keys()].filter((n) => !managedNames.has(n)).length
  }
  return { mismatches, missing, extras }
}

/** 自检:全部纯内存夹具,成对正反 —— 只证"会红"不证"不该红时不红"的判据等于没有。 */
function selfTest() {
  const results = []
  const ok = (name, cond, extra = '') =>
    results.push(`${cond ? '✅' : '❌'} ${name}${extra ? ` → ${extra}` : ''}`)

  const tokens = `@theme {
  /* 说明里也写着 --color-bait: 这是散文不是声明; */
  --color-bg: white;
  --color-primary: black;
  --color-sidebar: #123456;
}
:root {
  --color-late-root: #111111;
  --color-gradient-card: linear-gradient(
    112deg,
    rgba(1, 2, 3, 0.7) 0%
  );
}
.dark {
  --color-bg: black;
}
.dark { --color-late-dark: #222222; }`

  const full = `:root {
  /* ===== 语义色 ===== */
  --color-bg: white;
  --color-primary: black;
  --color-late-root: #111111;
}
.dark {
  --color-bg: black;
  --color-late-dark: #222222;
}`
  const base = compare({ tokensCss: tokens, appCss: full })
  ok('M1 反向对照:副本齐全时必须判绿(否则本例是无牙断言)', base.missing.length === 0 && base.mismatches.length === 0, JSON.stringify(base))
  ok('M2 后续 :root/.dark 块必须进判定面(旧版首个非贪婪块看不见)', base.extras === 0)
  ok('M3 跳过表内的档(sidebar)与注释散文(bait)都不得进受管集', ![...deriveMiniappManaged(tokens, 'light')].some((d) => /sidebar|bait/.test(d.name)))
  ok('M4 跨行渐变按政策不搬 ⇒ 不得判缺', !compare({ tokensCss: tokens, appCss: full }).missing.some((m) => m.name.includes('gradient')))

  // 缺档必红:从齐全副本里删掉一条受管档
  const crippled = full.replace('  --color-late-root: #111111;\n', '')
  ok('M4a 夹具必须真删了一行', crippled !== full)
  const r1 = compare({ tokensCss: tokens, appCss: crippled })
  ok('M4b 删掉一条受管档必须判缺档(旧 subset 判据的核心盲区)', r1.missing.length === 1 && r1.missing[0].name === '--color-late-root', JSON.stringify(r1))
  // 暗档同理
  const r2 = compare({ tokensCss: tokens, appCss: full.replace('  --color-late-dark: #222222;\n', '') })
  ok('M4c .dark 缺档也必须判红且点名块', r2.missing.length === 1 && r2.missing[0].block === '.dark', JSON.stringify(r2))

  // 值漂移
  const r3 = compare({ tokensCss: tokens, appCss: full.replace('--color-bg: white;', '--color-bg: #eee;') })
  ok('M5 值漂移必红且带两侧读数', r3.mismatches.length === 1 && r3.mismatches[0].app === '#eee' && r3.mismatches[0].tok === 'white', JSON.stringify(r3.mismatches))

  // 端内自有档只报数
  const r4 = compare({ tokensCss: tokens, appCss: full.replace('--color-bg: black;', '--color-bg: black;\n  --miniapp-local-track: #eeeeee;') })
  ok('M6 端内自有档只报数不判红(否则没人敢在 app.css 加端内档)', r4.missing.length === 0 && r4.mismatches.length === 0 && r4.extras === 1, JSON.stringify(r4))

  // 注释里的 --color-x: 散文不得把等值档判成漂移
  const r5 = compare({ tokensCss: tokens, appCss: full.replace('/* ===== 语义色 ===== */', '/* 手工维护说明: --color-bg: 不要动 */') })
  ok('M7 注释里的 --color-x: 散文不得被当声明(两侧都必须剥注释)', r5.missing.length === 0 && r5.mismatches.length === 0, JSON.stringify(r5))

  // 取不到输入:空 app.css
  const r6 = compare({ tokensCss: tokens, appCss: '/* 一个受管档都没有 */' })
  ok('M8 副本整块为空必须报满缺档而非"无档可判"(空扫不记绿)', r6.missing.length === 5, `实得 ${r6.missing.length}`)

  // 取材面四态(2026-09-25 收口):这一组就是"默认档已从磁盘换成 HEAD"的机器证明 ——
  // 结论行会被人改,函数不会;只靠跑一次真仓看末行的取证等于没取证。
  ok('M9 默认面必须是 HEAD(旧默认是磁盘,本条是换锚的反向锁)', faceFromArgv([]).face === 'head', JSON.stringify(faceFromArgv([])))
  ok('M10 --staged ⇒ 索引面', faceFromArgv(['--staged']).face === 'staged', JSON.stringify(faceFromArgv(['--staged'])))
  ok('M11 --worktree ⇒ 人工逃生舱面', faceFromArgv(['--worktree']).face === 'worktree', JSON.stringify(faceFromArgv(['--worktree'])))
  ok('M12 两个面旗同给 ⇒ 判死(取哪一面都会让另一面成为假绿)', !!faceFromArgv(['--staged', '--worktree']).error, JSON.stringify(faceFromArgv(['--staged', '--worktree'])))

  for (const r of results) console.log(r)
  const failed = results.filter((r) => r.startsWith('❌')).length
  console.log(failed ? `self-test 失败 ${failed} 条` : `✅ self-test 全通过(${results.length} 条)`)
  process.exit(failed ? 1 : 0)
}

function main() {
  if (args.includes('--self-test')) return selfTest()
  if (FACE_SEL.error) {
    console.error(`[check-miniapp-tokens-sync] ❌ 无法判定:${FACE_SEL.error}`)
    process.exit(2)
  }
  const face = FACE_SEL.face
  if (!quiet)
    console.log(
      `[check-miniapp-tokens-sync] Checking ${APP_CSS_REL} vs ${TOKENS_SOURCE_REL}(取材面:${FACE_TXT[face]})...`
    )
  let inputs
  try {
    inputs = readFaceInputs(root, face)
  } catch (e) {
    // 「无法判定」是预期结论,一句话足够;**其他异常**必须带栈落地 —— 匿名 exit 2 = 不可诊断
    // (守门 93 同型教训:一个编码/权限错误不得伪装成"该文件不存在"的业务结论)。
    const known = e instanceof Undetermined
    console.error(
      `[check-miniapp-tokens-sync] 取不到输入(${FACE_TXT[face]})⇒ 无法判定(不记为通过):${known ? e.message : (e?.stack ?? e)}`
    )
    process.exit(2)
  }
  const tokensCss = inputs[TOKENS_SOURCE_REL]
  const appCss = inputs[APP_CSS_REL]

  const { mismatches, missing, extras } = compare({ tokensCss, appCss })
  const managed =
    deriveMiniappManaged(tokensCss, 'light').length + deriveMiniappManaged(tokensCss, 'dark').length
  if (managed === 0) {
    console.error(
      `[check-miniapp-tokens-sync] 源头受管档为 0(${FACE_TXT[face]})⇒ 无法判定(不记为通过)`
    )
    process.exit(2)
  }
  if (mismatches.length === 0 && missing.length === 0) {
    if (!quiet)
      console.log(
        `[check-miniapp-tokens-sync] All ${managed} 个受管档逐位同值且无缺档(另有 ${extras} 个端内自有档,只报数不判红)(取材面:${FACE_TXT[face]})`
      )
    process.exit(0)
  }
  for (const m of mismatches)
    console.error(`  ${m.block} ${m.name}: miniapp-taro='${m.app}' vs tokens='${m.tok}' —— 值漂移`)
  for (const m of missing)
    console.error(`  ${m.block} ${m.name}: 副本里没有(源头值 '${m.want}')—— 缺档`)
  console.error(
    `[check-miniapp-tokens-sync] Found ${mismatches.length} 处值漂移 / ${missing.length} 处缺档(取材面:${FACE_TXT[face]})`
  )
  console.error(
    '  修复:pnpm --filter @ihui/miniapp-taro sync-tokens(原位写回,幂等,不动端内自有档与注释)'
  )
  process.exit(1)
}

// §22d:CLI 直接执行才跑主流程;被镜像测试 import 时不得有副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = { compare, faceFromArgv, readFaceInputs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
