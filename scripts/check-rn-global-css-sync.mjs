// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-rn-global-css-sync.mjs — 守门:`apps/mobile-rn/global.css` 的 --color-* 必须与
 * `packages/design-tokens/src/styles/tokens.css` 逐位同值且**不得缺档**。
 *
 * 2026-09-25 的两处收紧(都由实测逼出,不是顺手加严):
 * 1. **取值改与生成器共用一份实现**(`scripts/lib/design-token-blocks.mjs`)。旧版本门剥不出注释,
 *    而小程序那道 `check-miniapp-tokens-sync.mjs:55-57` 剥了 —— 同一判据两处不同形;且旧版只看
 *    副本里**已有**的键(subset),所以 `global.css` 只有 32 个 :root 档而源头有 103 个,门一路报绿。
 *    这正是"副本比源头少一整批档"能长期存活的机制。
 * 2. **判缺档(missing)**:源头受管档在副本里不存在即红。生成器已能自动补入,所以这条不会恒红;
 *    它拦的是"没人跑生成器"与"有人手删了受管行"这两种形态。
 *
 * 与生成器的分工:本门只判、只报差异;`node scripts/sync-rn-global-css.mjs` 才是写回的一侧。
 * 提交链里两者是同一枚提交的两步 —— `scripts/lib/pre-commit-hook.js` 的 `TOKEN_SYNC_TARGETS`
 * 会先跑生成器再让本门复核,所以按规矩改源头不会被本门拦。
 *
 * 取材面(2026-09-26 收口,与守门 36/124/93 同口径):默认判 **HEAD blob**,`--staged` 判
 * **索引 blob**(这次提交会带走的那一份 —— 盘上随后改对不算修好),`--worktree` 只作人工逃生舱,
 * 两个面旗同给 = 自相矛盾 ⇒ 判死;任一面取不到 ⇒ **exit 2「无法判定」**,既不冒红也不记绿,
 * 且**不回落**到另一个面。为什么这不是洁癖(一行):共享工作树常年滞后 HEAD,按磁盘判的门会在
 * "恒红 / 假绿"之间来回跳,并把错数写回棘轮基线(门 83 的 R3 登记一天内被整文件回退三次即此型);
 * 而本门是 `TOKEN_SYNC_TARGETS` mobile-rn 那一行的复核者(自动写回之后唯一那道闸),它判错面
 * 等于给一个没人再看的形态背书。旧形态两个缺陷叠在一起:① 默认判磁盘;② `--staged` 索引取不到
 * 时悄悄回落 HEAD —— 回落就是把"没判"写成"判过了"(自洽而错位的假绿)。
 *
 * 用法:
 *   node scripts/check-rn-global-css-sync.mjs             全量(HEAD blob)
 *   node scripts/check-rn-global-css-sync.mjs --staged    索引面(这次提交会带走的那一份)
 *   node scripts/check-rn-global-css-sync.mjs --worktree  人工排查(盘上内容,提交链不走这档)
 *   node scripts/check-rn-global-css-sync.mjs --quiet     只出错才说话
 * 退出码:0 = 一致;1 = 漂移/缺档;2 = 无法判定(两个面旗同给 / 任一面取不到,绝不冒绿也绝不冒红)
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
// 取材只走这一层:绝对路径 git、safe.directory、quotepath、windowsHide、maxBuffer、
// "输出被截断 ⇒ 无法判定" —— 这五处易错点各门自己写一遍就会各漏一遍(AGENTS §4/守门 118)。
// 旧版在这里散写 `git show` 取内容与磁盘直读,两个缺陷叠在一起(默认判磁盘 + 索引取不到
// 悄悄回落 HEAD —— 其形状锁由镜像测试 F5 按源码模式串看守,本注释因此不复现那个形状),
// 2026-09-26 收口时整段换成共用层的三面取材。
import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { collectVars } from './lib/design-token-blocks.mjs'
import { deriveRnDecls, TOKENS_SOURCE_REL, GLOBAL_CSS_REL } from './sync-rn-global-css.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const quiet = args.includes('--quiet')

/**
 * 纯函数:argv → 判定面(默认 **head**)。导出是为了"默认不再是磁盘"这一格能被构造面证明,
 * 而不是等人跑一次真仓看结论行 —— 结论行会被人改,函数不会。口径与守门 36/124/93 逐字同形。
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
 * 按判定面取**两份**(源 + 副本),一次 `cat-file --batch` 同面同轮读完。
 * 源与副本混面会在并发会话的瞬间产出假红/假绿;取不到一律抛 `Undetermined`
 * (调用方折成 exit 2),**不回落**到另一个面 —— 回落就是把"没判"写成"判过了"。
 * root/face 都是入参:镜像测试因此能在临时 git 仓里造"索引≠磁盘"的现场,不依赖真仓瞬时状态。
 */
export function readFaceInputs(repoRoot, face) {
  const rels = [TOKENS_SOURCE_REL, GLOBAL_CSS_REL]
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

export function compare({ tokensCss, globalCss }) {
  const mismatches = []
  const missing = []
  for (const kind of ['light', 'dark']) {
    const block = kind === 'dark' ? '.dark' : ':root'
    const have = collectVars(globalCss, [block])
    for (const d of deriveRnDecls(tokensCss, kind)) {
      const got = have.get(d.name)
      if (got === undefined) missing.push({ block, name: d.name, want: d.value })
      else if (got.value !== d.value)
        mismatches.push({ block, name: d.name, rn: got.value, tok: d.value })
    }
  }
  // 副本里有、源头没有的 --color-* 档:属端内自立档,生成器无权删,本门只报数不判红
  const extras = [
    ...collectVars(globalCss, [':root']).keys(),
    ...collectVars(globalCss, ['.dark']).keys(),
  ].filter((n) => !deriveRnDecls(tokensCss, 'light').some((d) => d.name === n))
    .filter((n) => !deriveRnDecls(tokensCss, 'dark').some((d) => d.name === n)).length
  return { mismatches, missing, extras }
}

function main() {
  if (FACE_SEL.error) {
    console.error(`[check-rn-global-css-sync] ❌ 无法判定:${FACE_SEL.error}`)
    process.exit(2)
  }
  const face = FACE_SEL.face
  if (!quiet)
    console.log(
      `[check-rn-global-css-sync] Checking mobile-rn/global.css vs design-tokens/tokens.css(取材面:${FACE_TXT[face]})...`
    )
  let inputs
  try {
    inputs = readFaceInputs(root, face)
  } catch (e) {
    // 「无法判定」是预期结论,一句话足够;**其他异常**必须带栈落地 —— 匿名 exit 2 = 不可诊断
    // (守门 36/93 同型教训:一个编码/权限错误不得伪装成"该文件不存在"的业务结论)。
    const known = e instanceof Undetermined
    console.error(
      `[check-rn-global-css-sync] 取不到输入(${FACE_TXT[face]})⇒ 无法判定(不记为通过):${
        known ? e.message : (e?.stack ?? e)
      }`
    )
    process.exit(2)
  }
  const tokensCss = inputs[TOKENS_SOURCE_REL]
  const globalCss = inputs[GLOBAL_CSS_REL]

  const { mismatches, missing, extras } = compare({ tokensCss, globalCss })
  if (mismatches.length === 0 && missing.length === 0) {
    if (!quiet)
      console.log(
        `[check-rn-global-css-sync] All ${
          deriveRnDecls(tokensCss, 'light').length + deriveRnDecls(tokensCss, 'dark').length
        } 个受管档逐位同值且无缺档(另有 ${extras} 个端内自立 --color-* 档,只报数不判红)(取材面:${FACE_TXT[face]})`
      )
    process.exit(0)
  }
  for (const m of mismatches)
    console.error(
      `  ${m.block} ${m.name}: mobile-rn='${m.rn}' vs tokens='${m.tok}' —— 值漂移`
    )
  for (const m of missing)
    console.error(`  ${m.block} ${m.name}: 副本里没有(源头值 '${m.want}')—— 缺档`)
  console.error('  修复:node scripts/sync-rn-global-css.mjs(原位写回,幂等,不动 --rn-* 端内档)')
  // 结论行必须落在**末行**:镜像测试按末行断言"这句话是关于哪个取材面的"(守门 36 同型)。
  console.error(
    `[check-rn-global-css-sync] Found ${mismatches.length} 处值漂移 / ${missing.length} 处缺档(取材面:${FACE_TXT[face]})`
  )
  process.exit(1)
}

// §22d
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = { compare, faceFromArgv, readFaceInputs, FACE_TXT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
