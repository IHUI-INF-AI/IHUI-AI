#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 溯源水印覆盖守门(blocking, 2026-09-12 升级为**自愈式**)
 *
 * 背景: CI 的 `node scripts/watermark.mjs verify` 要求所有可注入源文件携带**完整可解码**水印。
 * 历史两次翻车:
 *   ① 新增文件未注入水印 -> 本地提交通过、CI 红(Provenance watermark check);
 *   ② 生成器/文本级改写把已跟踪文件的水印横幅或零宽载荷弄丢/弄坏 -> 门禁**恒红**,
 *      而当时工具无法复现自己强制的版式,导致只能靠 `HUSKY_SKIP_WATERMARK_GUARD=1` 绕过提交。
 *
 * 2026-09-12 根治(不再依赖"每个生成器自觉注入"):
 *   门禁自身具备**自愈能力** —— 检出缺口后自动 `clean + inject` 回写, 并同步 `git add` 到暂存区,
 *   使"未加水印的文件进入提交"这一状态在结构上不可能发生; 无论文件是被谁(生成器/脚本/sed)改写出来的。
 *   生成器自带注入(如 scripts/gen-i18n-compressed.mjs)仍保留, 属"更早一步"的优化,
 *   不再是唯一防线。
 *
 * 判定口径(门 118 取材面纪律,2026-10-15 换面):
 *   verdict = `watermark.mjs list-uncovered`(载荷损坏 + 残迹 + 仅隐写 + 未覆盖) ∩ **分母集合**,
 *   而**清单面与内容面必须同面同轮**:
 *     - 全量档(默认 / push-gate)⇒ 判 **HEAD blob**,清单 = `git ls-tree -r --name-only HEAD`;
 *     - `--staged`(pre-commit)⇒ 判**索引 blob**,清单 = 索引;
 *     - `--worktree` ⇒ 磁盘 + 旧清单口径,**仅人工逃生舱**(盘上内容可能属于并行会话的半编辑态)。
 *   那个面取不到 ⇒ 判「无法判定」并 **exit 2**(不回落另一个面、不记绿、不冒红)。
 *   换面史:此前清单取索引(`ls-files`)而内容读磁盘,两把尺子不同面 —— "HEAD blob 缺载荷、
 *   盘上副本已补齐但未提交"的文件对两面各自都"没问题",悬留把红遮住了(2026-10-14 实测三枚即此型);
 *   且"索引有、盘上没有"记 skipped 不进分母,那一格在 HEAD 面本该能判。
 *   分母集合的唯一实现:`scripts/lib/watermark-scope.mjs` 的 `coverageFileSetForFace`。
 *   `.gitignore` 依旧把构建产物与本机临时面挡在分母外(仅 worktree 逃生舱并上未跟踪面);
 *   未跟踪面只属于工作树面 ⇒ head/staged 面下不再出现"未跟踪面上另有 N 个"那一档。
 *
 * 2026-11-10 提交档分母收窄(性能,不改判据):`--staged` 档旧实现让对面解码**整张索引面**
 *   (实测 20,859 个 blob,单次 20~30s),而一次提交往往只带 1~4 个文件。现改为把**本次提交携带**的
 *   路径(`git diff --cached --name-only`,即下面 decideCoverage 用的同一份携带面)落成临时清单,
 *   传给 `list-uncovered --staged --files-from` —— 面**仍是索引 blob**,只是分母取"携带 ∩ 索引"。
 *   单文件判据、自愈规则、退出码三态、归因行一字未动;暂存面为空时本档本来是通过(无可判文件),
 *   故空携带面**不调** list-uncovered(对面把空清单判 exit 2,那是 push 档的语义)。
 *   代价:索引存量欠账不再由本档统计,通过行如实改成"由 --full-face / CI 全量档统计"。
 *
 * 自愈纪律(乙,2026-10-15 立):**只有 `--staged`(本次提交真要带走的那一面)才允许 `git add`**。
 *   全量档 / `--push-gate` 档改为**只写工作区、不碰索引**并如实报「请随下一次提交带上」。
 *   WHY:工作区可回滚,索引不可 —— 在永不 commit 的档位 add,就是把改动悬在共享索引里等别人
 *   背(2026-10-14 悬留「暂存更改几千条没人提交」的直接成因;pre-commit 那轮 inject+add 紧接着
 *   就 commit,语义仍是对的,不许改坏)。
 *
 * 用法(**无面旗=未判定,exit 2**;2026-11-09 起不再隐式退回整张 HEAD 面):
 *   node scripts/check-watermark-coverage.mjs --push-scope # push-gate 收窄档:只判本次 push 涉及文件
 *                                                          (凭据 PUSH_SCOPE_FILES 或 >300 时的 PUSH_SCOPE_MANIFEST)
 *   node scripts/check-watermark-coverage.mjs --staged   # 自愈 + add 回索引(pre-commit 由 runner 下发)
 *   node scripts/check-watermark-coverage.mjs --full-face# **显式整面检查**:判整张 HEAD 面并打印"本次为显式全量面"
 *   node scripts/check-watermark-coverage.mjs --worktree # 人工逃生舱:判磁盘面(不得作提交门禁)
 *   node scripts/check-watermark-coverage.mjs --no-fix   # 纯判定, 不修改(与上面任一面旗同用;CI / 审计)
 *   node scripts/check-watermark-coverage.mjs --self-test# 逻辑自检(零 git 调用、零副作用)
 * 紧急跳过: HUSKY_SKIP_WATERMARK_GUARD=1 git commit ...   (正常流程不再需要)
 *
 * 2026-11-09 事故与口径(实测,非推测):
 *   拿不到 push scope 凭据时,旧实现静默退回整张 HEAD 面并自愈 ⇒ 把水印写进 190 个与本次推送
 *   无关的工作区文件,只能 git restore 丢掉。根因不是"它写盘",而是"拿不到范围时它选择猜"。
 *   现口径:**拿不到范围 = 未判定 = exit 2**,打印缺什么/怎么补;**只有显式 --full-face(或 push 侧
 *   清单头声明 face=full)才允许全量面**;自愈写盘范围 **严格等于判定面**(越界 ⇒ exit 2 且零写盘)。
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

import { readWorktreeFile, catBatch, Undetermined } from './lib/face-reader.mjs'
import { createExclusionPredicate, LedgerUnavailable } from './lib/third-party-roots.mjs'
import { coverageFileSetForFace } from './lib/watermark-scope.mjs'
// G-1018220 口径②:自愈清单行的结构化豁免键从归因层 **import,不抄字面量**(与尺子导入
// FINDING_LINE_RE 同条纪律:两处各写一遍必然漂移)。键只打在"我刚修复"的清单行上 ——
// reportGap 报红块 / 注入失败行一个字不带,归因层因此只豁免自愈动作点名,真失败点名照旧定责。
import { SELF_HEAL_FIXED_MARK } from './lib/commit-gate-attribution.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = join(ROOT)
const NO_FIX = process.argv.includes('--no-fix')
/**
 * G-1018220(2026-10-04 收口):`--staged` 由 `scripts/guardian-runner.mjs` 在提交档统一追加。
 * 此前本门**不认识**这面旗,于是提交档判的是「整张共享索引」—— 别人 `git add` 过、
 * 而我这次提交根本不携带的文件,它的存量水印欠账会算到我头上;更坏的是自愈分支会对它
 * `inject` + `git add`,即**门替别人补的东西,由下一个人负责提交**(污染 + 越权两型),
 * 与归因层「点名即定责」相乘 ⇒ 零风险改动任何人都不提交得动。
 * 现口径与守门 135 / 157 / 70 同形:`--staged` **只收窄"哪些文件算在本次提交头上"这一份文件清单**,
 * 内容判据(缺横幅 / 载荷损坏 / 排除面 / 自愈上限)一字未动;全量档与 `--no-fix` 仍判所有已跟踪文件,
 * 所以仓库存量欠账不会被洗成绿色,只是不再由无关的提交者承担。
 */
const STAGED = process.argv.includes('--staged')
const WORKTREE = process.argv.includes('--worktree')
/**
 * push-gate 的收窄档(2026-11-03):只判**本次 push 涉及的文件**,不跑全量 1.6 万+ 文件。
 * 范围凭据有两个来源,都必须由 `.husky/pre-push` 在调用 `guardian-runner --push-gate` 前导出:
 *   ① `PUSH_SCOPE_FILES`(由 `remote_sha..local_sha` 的 `git diff --name-only` 派生;与
 *      `check-typecheck.mjs` 消费的是同一份,本门不另造第二套推导);
 *   ② `PUSH_SCOPE_MANIFEST`(2026-11-09 补):变更 >300 文件时钩子不再**清空** scope
 *      (清空正是 190 文件事故的直接触发点),改为把清单写进临时文件并导出路径;
 *      清单首行可带 `# ihui-push-scope/v1 face=full` 申明"本次为显式全量面"。
 * 两者都取不到 ⇒ **exit 2(未判定)**,打印缺什么/怎么补。**绝不退回整张 HEAD 面**:
 * 退回的面上自愈会把水印写进本次改动之外的文件(2026-11-09 实测 190 个)。
 */
const PUSH_SCOPE = process.argv.includes('--push-scope')
/** 显式整面检查(2026-11-09):唯一允许判全量 HEAD 面的调用方式;无面旗一律未判定。 */
const FULL_FACE = process.argv.includes('--full-face')
// 安全闸: 一次性自动回写的文件数上限。超过则拒绝自愈并直接报错,
// 避免"某个批量改写脚本把半个仓库打回未水印态"时被静默整体重写。
// 该上限只在**判定面已确定**时才生效;面未判定直接 exit 2(上限不得当兜底)。
const MAX_AUTOFIX = 200

/**
 * 无文件面档的判据(2026-11-04 立,纯 ref 删除被误拦的根因修复)。
 *
 * `.husky/pre-push` 逐条复核本次推送的 ref 后,在「零 blob 变更」(纯删除远端分支 /
 * 把分支推进到同一棵树)时导出 `PUSH_NO_FILE_FACE=1` + `PUSH_NO_FILE_FACE_BASIS`。
 * 此时水印判定面是**真的空集**,不是「取不到面」—— 原实现把两者混为一谈,空 scope 一律
 * 退回 HEAD 全量面,于是与本次推送毫无关系的存量欠账算成了这次的红。
 *
 * 本档只认**带依据**的那一对值:值不是 1 或缺依据 ⇒ 不启用,回到原路径(未取到 push scope
 * ⇒ **exit 2 未判定**,既不退回整张 HEAD 面,也不伪造"无文件")。这一条是防"残留 env 把门变成静默 skip"的结构性闸门;
 * 因此它必须可被 --self-test 直接喂构造面,不能写成 main() 里的内联 if。
 * @returns {{ok:boolean, basis:string, reason?:string} | null} null = 本档未启用(走原路径)
 */
export function noFileFaceVerdict(env = process.env) {
  if (env.PUSH_NO_FILE_FACE !== '1') return null
  const basis = String(env.PUSH_NO_FILE_FACE_BASIS || '').trim()
  if (!basis) return { ok: false, basis: '', reason: 'PUSH_NO_FILE_FACE=1 但缺判定依据' }
  return { ok: true, basis }
}

/**
 * 面意图解析(纯函数,2026-11-09 立)。
 *
 * 旧实现在**没有任何面旗**时默认判整张 HEAD 面 —— 那正是"拿不到范围就猜一个更大的面"的
 * 同一个病:调用方少传一个旗,门就把整仓当成本次该动的面。现口径:
 *   0 个面旗 ⇒ 未判定(exit 2),把选择权交回调用方;
 *   ≥2 个面旗 ⇒ 未判定(两个面混判必错,历史上 --staged/--worktree 同给就是这么收的);
 *   恰好 1 个 ⇒ 按该面判定。
 * @param {{staged?:boolean, worktree?:boolean, pushScope?:boolean, fullFace?:boolean}} f
 * @returns {{face:'head'|'staged'|'worktree'|null, explicitFull:boolean, error:string|null}}
 */
export function resolveFaceIntent(f = {}) {
  const picked = [
    f.staged === true ? 'staged' : null,
    f.worktree === true ? 'worktree' : null,
    f.pushScope === true ? 'push' : null,
    f.fullFace === true ? 'full' : null,
  ].filter(Boolean)
  if (picked.length === 0) {
    return {
      face: null,
      explicitFull: false,
      error:
        '未声明判定面(旧行为会默认整张 HEAD 面,已废止)。请显式给 --staged / --push-scope / --full-face / --worktree',
    }
  }
  if (picked.length > 1) {
    return { face: null, explicitFull: false, error: `面旗互斥,不得同用:${picked.join(' + ')}` }
  }
  const only = picked[0]
  if (only === 'push' || only === 'full') return { face: 'head', explicitFull: only === 'full', error: null }
  return { face: only, explicitFull: false, error: null }
}

/**
 * 解析 push scope 清单文件(纯函数,便于自检直接喂构造面)。
 * 首行 `# ihui-push-scope/v1 face=full` = 调用方**显式申明**"本次为显式全量面";
 * 缺省(老清单/钩子写的 push 清单)= 收窄面。空行与 `#` 注释行不计入路径。
 * @param {string} text
 * @returns {{face:'push'|'full', paths:string[]}}
 */
export function parseScopeManifest(text) {
  let face = 'push'
  const paths = []
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('# ihui-push-scope/v1')) {
      if (/\bface=full\b/.test(line)) face = 'full'
      continue
    }
    if (line.startsWith('#')) continue
    paths.push(line.replaceAll('\\', '/'))
  }
  return { face, paths }
}

/**
 * 取 push scope 范围凭据(纯函数;文件读取由调用方注入,便于自检)。
 *
 * **取不到 = 未判定**,返回 error 由主流程 exit 2 —— 不再退回整张 HEAD 面。
 * 清单文件存在但**路径为 0 条**同样算未判定:空清单不是"全部通过",也不是"可以猜一个面"。
 * @param {{env?:Record<string,string|undefined>, readManifestFile?:(p:string)=>string}} opts
 * @returns {{paths:string[]|null, source:'PUSH_SCOPE_FILES'|'PUSH_SCOPE_MANIFEST'|null, face:'push'|'full'|null, error:string|null}}
 */
export function readPushScope({ env = process.env, readManifestFile } = {}) {
  const raw = env.PUSH_SCOPE_FILES
  if (typeof raw === 'string' && raw.trim() !== '') {
    const paths = [
      ...new Set(
        raw
          .split(/\r?\n/)
          .map((s) => s.trim().replaceAll('\\', '/'))
          .filter(Boolean),
      ),
    ]
    if (paths.length > 0) return { paths, source: 'PUSH_SCOPE_FILES', face: 'push', error: null }
  }
  const manifestPath = String(env.PUSH_SCOPE_MANIFEST || '').trim()
  if (manifestPath) {
    if (typeof readManifestFile !== 'function') {
      return { paths: null, source: 'PUSH_SCOPE_MANIFEST', face: null, error: '内部错误:未注入清单读取器' }
    }
    let text
    try {
      text = readManifestFile(manifestPath)
    } catch (e) {
      return {
        paths: null,
        source: 'PUSH_SCOPE_MANIFEST',
        face: null,
        error: `清单文件不可读:${manifestPath}(${String(e?.message ?? e).split('\n')[0]})`,
      }
    }
    const parsed = parseScopeManifest(text)
    if (parsed.face !== 'full' && parsed.paths.length === 0) {
      return {
        paths: null,
        source: 'PUSH_SCOPE_MANIFEST',
        face: null,
        error: `清单文件里 0 条路径:${manifestPath}(空清单不是"全部通过",也不是"可以猜面")`,
      }
    }
    return { paths: parsed.paths, source: 'PUSH_SCOPE_MANIFEST', face: parsed.face, error: null }
  }
  return {
    paths: null,
    source: null,
    face: null,
    error: 'PUSH_SCOPE_FILES 为空,且 PUSH_SCOPE_MANIFEST 未设置',
  }
}

/**
 * 自愈写盘边界断言(纯函数,2026-11-09 立)。
 * 判定面是 75 文件就只许碰这 75 个;`MAX_AUTOFIX=200` 只在面内生效,不得扩大面。
 * @param {string[]} missing 准备写盘的文件
 * @param {Iterable<string>} face 本轮判定面的文件集合
 * @returns {string[]} 越界文件(空数组 = 合规)
 */
export function autofixOutsideFace(missing, face) {
  const set = face instanceof Set ? face : new Set(face)
  return missing.filter((f) => !set.has(f))
}

/**
 * 逻辑自检(零git 调用、零副作用、零文件写入)。
 *
 * 覆盖的那一格(2026-10-03 补):**派生层失败时必须 fail-closed 判"不可判定",不得读成通过。**
 * 这一格在补自检之前是**洞** —— 主流程里那两条 `process.exit(1)` 没有任何用例钉住,
 * 于是任何一次"把 exit(1) 换成 return [] / 加个 allowFail 静默降级"的顺手重构,
 * 都会让门 47 在 git 不可用(本机 EBUSY 病窗就是天天发生的那一种)时**输出 ✅ 并 exit 0**。
 * 那比恒红更坏:恒红只会逼人查,假绿会让"无横幅文件进仓"这条通道重新打开而无人知情。
 *
 * 所以下面每一条 fail-closed 用例都同时断言两件事:verdict 必须是 'undetermined',
 * 且 missing 必须是空(**不是**"没缺口所以通过"的那种空)。
 */
function selfTest() {
  const cases = []
  /**
   * 用例登记。同时接受函数(求值一次)与布尔值;函数抛错按该条失败计并打印原因,
   * 不让一条坏用例把整轮 self-test 炸成未捕获异常(check-single-branch.mjs 同型约定)。
   */
  const t = (name, ok) => {
    let verdict = false
    try {
      verdict = typeof ok === 'function' ? Boolean(ok()) : Boolean(ok)
    } catch (e) {
      verdict = false
      name = `${name}(用例抛错:${e && e.message ? e.message : e})`
    }
    cases.push([name, verdict])
  }
  const noExclusion = () => false
  const scopeOf = (files) => ({ indexFiles: files, files, untrackedFiles: [] })
  const OK_SCOPE = scopeOf(['a.ts', 'b.ts'])

  // ── 组1:清单层 fail-closed ──
  t('F1 跟踪清单取不到(git 派生失败)⇒ undetermined,不得 pass', () => {
    const r = decideCoverage({
      scope: { indexFiles: [], files: [], error: '取不到 git 跟踪清单:spawnSync git EBUSY' },
      uncovered: [],
      isExcluded: noExclusion,
    })
    return r.verdict === 'undetermined' && /EBUSY/.test(r.reason || '')
  })
  t('F2 跟踪清单为空(在错的目录上跑 / 派生层静默返回空)⇒ undetermined,不得 pass', () => {
    const r = decideCoverage({ scope: scopeOf([]), uncovered: [], isExcluded: noExclusion })
    return r.verdict === 'undetermined' && /判据失明/.test(r.reason || '')
  })
  t('F3 scope 整个缺失(undefined)⇒ undetermined,不得读成通过', () => {
    const r = decideCoverage({ scope: undefined, uncovered: [], isExcluded: noExclusion })
    return r.verdict === 'undetermined'
  })

  // ── 组 2:未覆盖清单层 fail-closed(本机 EBUSY 病窗的正主) ──
  t('F4 list-uncovered 派生失败(EBUSY)⇒ undetermined,不得 pass', () => {
    const r = decideCoverage({
      scope: OK_SCOPE,
      uncovered: null,
      uncoveredError: 'spawnSync node EBUSY',
      isExcluded: noExclusion,
    })
    return r.verdict === 'undetermined' && /EBUSY/.test(r.reason || '')
  })
  t('F5 反向对照:fail-closed 不得被读成"没有缺口" —— missing 必为空且 verdict 不是 pass', () => {
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: null, isExcluded: noExclusion })
    return r.verdict !== 'pass' && r.missing.length === 0
  })
  t('F6 uncovered 不是数组(取材层形状异常)⇒ undetermined', () => {
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: 'a.ts', isExcluded: noExclusion })
    return r.verdict === 'undetermined'
  })
  t('F7 两层同时失败(清单+未覆盖都取不到)⇒ 仍 undetermined,不得有一格被放过', () => {
    const r = decideCoverage({
      scope: { indexFiles: [], files: [], error: 'x' },
      uncovered: null,
      uncoveredError: 'spawnSync node EBUSY',
      isExcluded: noExclusion,
    })
    return r.verdict === 'undetermined'
  })

  // ── 组 3:反向对照(证明上面那批不是"恒红门",真绿路径仍然绿) ──
  t('P1 清单齐 + 无缺口 ⇒ pass(正向对照,防自检把本门写成恒红)', () => {
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: [], isExcluded: noExclusion })
    return r.verdict === 'pass' && r.missing.length === 0
  })
  t('P2 已跟踪文件缺横幅 ⇒ gap 且 missing 命中它', () => {
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: ['b.ts'], isExcluded: noExclusion })
    return r.verdict === 'gap' && r.missing.length === 1 && r.missing[0] === 'b.ts'
  })
  t('P3 未跟踪面缺口 ⇒ 只报数不判红(不得越权判红别人在飞的文件)', () => {
    // 构造面必须照真实的**两层集合**给:未跟踪文件在 `files`(分母)里但不在 `indexFiles` 里。
    // 早先这里把 files 与 indexFiles 填成同一份,于是那条用例测的是"分母外的文件被忽略"
    // (=P7),而不是本条要测的"在分母内但不在索引内" —— 假绿。
    const r = decideCoverage({
      scope: { indexFiles: ['a.ts', 'b.ts'], files: ['a.ts', 'b.ts', 'new.ts'], untrackedFiles: ['new.ts'] },
      uncovered: ['new.ts'],
      isExcluded: noExclusion,
    })
    return r.verdict === 'pass' && r.untrackedGaps.length === 1 && r.missing.length === 0
  })
  t('P4 缺口数超自愈上限 ⇒ gap-too-many(拒绝自动回写)', () => {
    const files = Array.from({ length: 5 }, (_, i) => `f${i}.ts`)
    const r = decideCoverage({
      scope: scopeOf(files),
      uncovered: files,
      isExcluded: noExclusion,
      maxAutofix: 2,
    })
    return r.verdict === 'gap-too-many' && /拒绝自动回写/.test(r.reason || '')
  })
  t('P5 缺口数正好等于上限 ⇒ gap(边界不含糊:超限才拒绝)', () => {
    const files = ['a.ts', 'b.ts']
    const r = decideCoverage({
      scope: scopeOf(files),
      uncovered: files,
      isExcluded: noExclusion,
      maxAutofix: 2,
    })
    return r.verdict === 'gap' && r.missing.length === 2
  })
  t('P6 已登记第三方文件被报成缺口 ⇒ 计入 drift 且不判红(不往MIT/Apache 原文打横幅)', () => {
    const r = decideCoverage({
      scope: scopeOf(['vendor/x.ts', 'a.ts']),
      uncovered: ['vendor/x.ts'],
      isExcluded: (f) => f.startsWith('vendor/'),
    })
    return r.verdict === 'pass' && r.drift.length === 1 && r.missing.length === 0
  })
  t('P7 分母外的文件(list-uncovered 报了但既不跟踪也未跟踪)⇒ 不计缺口', () => {
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: ['ghost.ts'], isExcluded: noExclusion })
    return r.verdict === 'pass' && r.missing.length === 0
  })

  // ── 组 4:提交档收窄(G-1018220)—— 每条都配同输入的全量档对照,证明**判据没被放宽** ──
  t('W1 提交档:本次携带的文件缺横幅 ⇒ 仍判红并点名它(收窄没有放过提交者自己的欠账)', () => {
    const r = decideCoverage({
      scope: OK_SCOPE,
      uncovered: ['b.ts'],
      isExcluded: noExclusion,
      stagedFace: true,
      carried: ['b.ts'],
    })
    return r.verdict === 'gap' && r.missing.join() === 'b.ts' && r.untouchedGaps.length === 0
  })
  t('W2 提交档:同一份缺横幅,但本次不携带它 ⇒ 不判红、不自愈,只报名(恒红的那一格)', () => {
    const r = decideCoverage({
      scope: OK_SCOPE,
      uncovered: ['a.ts'],
      isExcluded: noExclusion,
      stagedFace: true,
      carried: ['b.ts'],
    })
    return (
      r.verdict === 'pass' &&
      r.missing.length === 0 &&
      r.untouchedGaps.length === 1 &&
      r.untouchedGaps[0] === 'a.ts'
    )
  })
  t('W3 反向对照:同一份输入走全量档必须照旧判红(证明收窄只动"算在谁头上",没动判据)', () => {
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: ['a.ts'], isExcluded: noExclusion })
    return r.verdict === 'gap' && r.missing.join() === 'a.ts' && r.untouchedGaps.length === 0
  })
  t('W4 提交档混合面:两类欠账同现 ⇒ 只有携带的那条进自愈清单(门不得 git add 别人的文件)', () => {
    const r = decideCoverage({
      scope: scopeOf(['a.ts', 'b.ts', 'c.ts']),
      uncovered: ['a.ts', 'b.ts', 'c.ts'],
      isExcluded: noExclusion,
      stagedFace: true,
      carried: ['b.ts'],
    })
    return r.verdict === 'gap' && r.missing.join() === 'b.ts' && r.untouchedGaps.join() === 'a.ts,c.ts'
  })
  t('W5 提交档:别人存量欠账不得把自愈上限顶爆(上限按"本次携带"计)', () => {
    const all = ['a.ts', 'b.ts', 'c.ts', 'd.ts']
    const r = decideCoverage({
      scope: scopeOf(all),
      uncovered: all,
      isExcluded: noExclusion,
      maxAutofix: 2,
      stagedFace: true,
      carried: ['c.ts', 'd.ts'],
    })
    return r.verdict === 'gap' && r.missing.join() === 'c.ts,d.ts'
  })
  t('W6 fail-closed:提交档取不到携带面(git 抖动)⇒ 未判定,不得冒充"本次什么都没带"', () => {
    const r = decideCoverage({
      scope: OK_SCOPE,
      uncovered: ['a.ts'],
      isExcluded: noExclusion,
      stagedFace: true,
      carried: null,
      carriedError: 'spawnSync git EBUSY',
    })
    return r.verdict === 'undetermined' && /携带/.test(r.reason || '') && r.missing.length === 0
  })
  t('W7 fail-closed:提交档 carried 不是数组(取材层形状异常)⇒ 未判定', () => {
    const r = decideCoverage({
      scope: OK_SCOPE,
      uncovered: [],
      isExcluded: noExclusion,
      stagedFace: true,
      carried: 'a.ts',
    })
    return r.verdict === 'undetermined'
  })
  t('W8 提交档空携带面(暂存==HEAD)⇒ pass 且 untouched 照旧报名,不静默', () => {
    const r = decideCoverage({
      scope: OK_SCOPE,
      uncovered: ['a.ts'],
      isExcluded: noExclusion,
      stagedFace: true,
      carried: [],
    })
    return r.verdict === 'pass' && r.untouchedGaps.join() === 'a.ts'
  })

  // ── 组 5:无文件面档(2026-11-04)—— 显式判据;缺依据不得启用;判定内核不得被放宽 ──
  t('N1 无文件面档:flag=1 且带依据 ⇒ 启用并原样带回依据', () => {
    const r = noFileFaceVerdict({
      PUSH_NO_FILE_FACE: '1',
      PUSH_NO_FILE_FACE_BASIS: 'push refs=1 条全部为删除引用(local sha 全 0),不携带任何 blob',
    })
    return r.ok === true && r.basis.includes('删除引用')
  })
  t('N2 flag=1 但缺依据 ⇒ 不启用(防残留 env 把门变成静默 skip)', () => {
    const r = noFileFaceVerdict({ PUSH_NO_FILE_FACE: '1' })
    return r !== null && r.ok === false && /缺判定依据/.test(r.reason || '')
  })
  t('N3 flag 不是 1 ⇒ 本档未启用(原路径:凭据缺失 ⇒ 未判定 exit 2,不猜面)', () => noFileFaceVerdict({}) === null)
  t('N4 反向对照:本档不放宽判红内核 —— 同一份欠账在有文件面时仍判红', () => {
    // 无文件面档只影响 main() 的早退分支;decideCoverage 对它一无所知。
    const r = decideCoverage({ scope: OK_SCOPE, uncovered: ['a.ts'], isExcluded: noExclusion })
    return r.verdict === 'gap' && r.missing.join() === 'a.ts'
  })

  // ── 组 6:范围凭据纪律(2026-11-09,190 文件事故的结构性锁)──
  t('Q1 无面旗 ⇒ 未判定(不再默认整张 HEAD 面)', () => {
    const r = resolveFaceIntent({})
    return r.face === null && /未声明判定面/.test(r.error || '')
  })
  t('Q2 两面旗同给 ⇒ 未判定(--push-scope + --staged 混判不成立)', () => {
    const r = resolveFaceIntent({ pushScope: true, staged: true })
    return r.face === null && /互斥/.test(r.error || '')
  })
  t('Q3 单旗逐档解析正确,且只有 --full-face 标 explicitFull', () => {
    const a = resolveFaceIntent({ staged: true })
    const b = resolveFaceIntent({ worktree: true })
    const c = resolveFaceIntent({ fullFace: true })
    const d = resolveFaceIntent({ pushScope: true })
    return (
      a.face === 'staged' && !a.explicitFull &&
      b.face === 'worktree' && !b.explicitFull &&
      c.face === 'head' && c.explicitFull === true &&
      d.face === 'head' && !d.explicitFull
    )
  })
  t('Q4 凭据缺失(env 空、无清单)⇒ 返回 error(调用方据此 exit 2),不返回空面', () => {
    const r = readPushScope({ env: { PUSH_SCOPE_FILES: '' } })
    return r.paths === null && /PUSH_SCOPE_MANIFEST 未设置/.test(r.error || '')
  })
  t('Q5 清单文件可读且非空 ⇒ 取到收窄面;空清单 ⇒ 仍判未判定', () => {
    const ok = readPushScope({
      env: { PUSH_SCOPE_MANIFEST: 'm.txt' },
      readManifestFile: () => 'a.ts\nb.ts\n',
    })
    const empty = readPushScope({ env: { PUSH_SCOPE_MANIFEST: 'm.txt' }, readManifestFile: () => '\n\n' })
    return ok.face === 'push' && ok.paths.join() === 'a.ts,b.ts' && empty.paths === null && /0 条路径/.test(empty.error || '')
  })
  t('Q6 清单头 face=full ⇒ 显式全量面(路径为空也成立)', () => {
    const r = readPushScope({
      env: { PUSH_SCOPE_MANIFEST: 'm.txt' },
      readManifestFile: () => '# ihui-push-scope/v1 face=full\n',
    })
    return r.face === 'full' && r.error === null
  })
  t('Q7 自愈边界:缺失集合越出判定面 ⇒ 必须报越界(190 文件事故的形状)', () => {
    const out = autofixOutsideFace(['a.ts', 'z.ts'], ['a.ts', 'b.ts'])
    return out.length === 1 && out[0] === 'z.ts'
  })
  t('Q8 边界内(含等号)⇒ 无越界,MAX_AUTOFIX 不改变面', () => {
    return autofixOutsideFace(['a.ts', 'b.ts'], new Set(['a.ts', 'b.ts'])).length === 0
  })

  let bad = 0
  for (const [name, ok] of cases) {
    if (!ok) bad++
    console.log(`${ok ? '✅' : '❌'} ${name}`)
  }
  console.log(`self-test: ${cases.length - bad}/${cases.length} 通过`)
  return bad ? 1 : 0
}

/**
 * `run` 返回 stdout;**派生失败原样抛**(带 status),由调用方折成取材结果,
 * 不在取材层直接 process.exit —— 否则 fail-closed 那一格没法被 decideCoverage 看见。
 */
const run = (cmd, args) =>
  execFileSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    // 根治 EBUSY(errno -4082):本机会话里 Node 建子进程 stdin 管道确定性失败,而本门
    // 派生的两条命令(`watermark.mjs list-uncovered` / `inject`)都不吃 stdin ⇒ stdio[0]='ignore'。
    // 不写 stdio 就是默认全管道,门 47 在本会话必报 EBUSY 跑不出判定(2026-10-03 实测)。
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/**
 * watermark.mjs list-uncovered → 载荷损坏 + 仅隐写 + 残迹 + 未覆盖(相对仓库根, / 分隔)。
 * `faceArgs` 把**判定面旗原样传给 watermark.mjs** —— 清单与内容同面同轮的纪律住在对面那份实现里。
 * 对面以 exit 2 报「无法判定」时,这里如实把 error 带上去(不得折成"没有缺口")。
 * @returns {{paths: string[]|null, error: string|null}}
 */
function listUncovered(faceArgs = []) {
  try {
    return {
      paths: run('node', ['scripts/watermark.mjs', 'list-uncovered', ...faceArgs])
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      error: null,
    }
  } catch (e) {
    const why = String(e?.stderr || e?.message || e).split('\n').filter(Boolean)[0] || String(e)
    return { paths: null, error: `${e?.status === 2 ? '对面报无法判定:' : ''}${why}` }
  }
}

/**
 * 把**分母**收窄到 paths 再问 list-uncovered(2026-11-10)。
 * 提交档每次只携带 1~4 个文件,却要对面解码整张索引面(2 万+ blob,实测 31.6s)—— 这里用对面
 * 既有的 `--files-from` 收窄扫描面,不另写文件枚举(路径清单由调用方给,来源是同一份携带面)。
 * paths 为空时**不得**调用:对面把空清单判为「未判定 exit 2」,而空面在本门是"没有文件可判"。
 * @param {string[]} faceFlag 形如 ['--staged']
 * @param {string[]} paths 非空路径清单
 * @returns {{paths: string[]|null, error: string|null}}
 */
function listUncoveredNarrow(faceFlag, paths) {
  let manifest = null
  try {
    manifest = writeFileManifest(paths)
    return listUncovered([...faceFlag, '--files-from', manifest.file])
  } finally {
    if (manifest) manifest.cleanup()
  }
}

/** 判定面清单(与内容同面同轮;唯一实现住在 watermark-scope.mjs,本门不拼第二把尺子)。 */
function trackedFiles(face) {
  return coverageFileSetForFace({ root: REPO_ROOT, face })
}

/**
 * 本次提交**携带**的文件面 = 索引相对 HEAD 有差异的路径(`git diff --cached --name-only`)。
 * G-1018220 的落点:提交档的门只能问"这次进来的文件有没有横幅",不能问"整张共享索引干不干净"。
 * 三条不可漂:① 取不到 ⇒ 带 error 上去,由 `decideCoverage` 判**未判定**,不得当成"没带文件";
 * ② 派生一律带 timeout(守门 80 那一型:无界只读 git 调用把提交挂死几十分钟);
 * ③ 只读动词,不碰工作树、不碰别人的在飞文件。
 * @returns {{paths:string[]|null, error:string|null}}
 */
function carriedFiles() {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 60_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { paths: out.split('\n').map((s) => s.trim()).filter(Boolean), error: null }
  } catch (e) {
    return { paths: null, error: String(e && e.message ? e.message : e).split('\n')[0] }
  }
}

/**
 * 报红块 + 修复出路。出路**必须按判定面给**(G-866,§0.8 文档不得写跑不通的出路):
 * 三面的"写盘"语义不同,混用一条提示会误导 —— 实测有人照 HEAD 面旧提示跑完 inject 就以为修完,
 * 而 HEAD 欠账只有一枚把带水印内容带进 HEAD 的提交才能销;staged 面不 add 回索引,
 * 提交带走的仍是未加水印的旧索引副本。
 * @param {string[]} missing
 * @param {string} reason
 * @param {string} [faceLabel] 已并入主行文案的判定面标注(head 面为空串)
 * @param {'head'|'staged'|'worktree'} [face]
 */
function reportGap(missing, reason, faceLabel = '', face = 'head') {
  console.error(
    `[watermark-coverage] ❌ ${missing.length} 个文件缺失/损坏溯源水印${faceLabel}${reason}:`,
  )
  for (const f of missing.slice(0, 30)) console.error('  - ' + f)
  if (missing.length > 30) console.error(`  ... 其余 ${missing.length - 30} 个`)
  console.error('')
  if (face === 'staged') {
    console.error('  修复(暂存面): node scripts/watermark.mjs inject <file> && git add <file>')
    console.error('            # 提交带走的是索引 blob,inject 只写工作区,必须 add 回索引才真正进提交')
  } else if (face === 'worktree') {
    console.error('  修复(工作树面): node scripts/watermark.mjs inject <file>')
    console.error('            # 写到盘上即达标(人工逃生舱),无 add/提交等后续动作')
  } else {
    console.error('  修复(HEAD 面): node scripts/watermark.mjs inject <file>')
    console.error('            # ⚠️ inject 只写工作区,跑完不等于修好 —— HEAD 面欠账只有一枚')
    console.error('            # 把带水印内容带进 HEAD 的提交才能销;inject 完不提交 = 欠账还在。')
    console.error('            # 出路: git add <file> 后随下一枚提交带上(走 safe-commit 正常提交)。')
  }
  console.error('            node scripts/watermark.mjs list-uncovered   # 列出全部缺口')
  console.error('  紧急跳过: HUSKY_SKIP_WATERMARK_GUARD=1 git commit ...')
}

/**
 * 纯判定内核(零 I/O):把「取材结果」翻译成「门 47 的判定」。
 *
 * 为什么要抽成纯函数:`scopeError` / `uncoveredError` 这两格是本门**唯一**的 fail-closed 出口,
 * 而它们在改前只以 `process.exit(1)` 的形态存在于主流程里 —— 没有可构造的接缝,自检就永远
 * 覆盖不到"派生层失败时必须判不可判定"这一格(历史洞:allowFail 式静默降级会让门 47 在
 * git 不可用时**假装通过**,而报告上写着✅)。抽出后 `--self-test` 直接喂构造面。
 *
 * @param {object} input
 * @param {{indexFiles?:string[], files?:string[], error?:string|null}} input.scope 取不到清单时的 error
 * @param {string[]|null} input.uncovered list-uncovered 的结果;null = 派生层失败
 * @param {string|null} input.scopeError
 * @param {string|null} input.uncoveredError
 * @param {(f:string)=>boolean} input.isExcluded
 * @param {number} [input.maxAutofix]
 * @param {boolean} [input.stagedFace] 提交档:只判本次提交携带的文件(G-1018220)
 * @param {string[]|null} [input.carried] 索引相对 HEAD 有差异的路径(仅 stagedFace 时必需)
 * @param {string|null} [input.carriedError] 取不到携带面的原因 ⇒ 未判定,不得冒充"本次什么都没带"
 * @returns {{verdict:'pass'|'undetermined'|'gap'|'gap-too-many', reason?:string, missing:string[], untrackedGaps:string[], untouchedGaps:string[], drift:string[]}}
 */
export function decideCoverage(input) {
  const { scope, uncovered, isExcluded, maxAutofix = MAX_AUTOFIX } = input
  const stagedFace = input.stagedFace === true
  const carriedError = input.carriedError ?? null
  const scopeError = input.scopeError ?? scope?.error ?? null
  const uncoveredError = input.uncoveredError ?? null
  const empty = { missing: [], untrackedGaps: [], untouchedGaps: [], drift: [] }
  // ── fail-closed 第一格:清单取不到 = 判据失明,**不得**按"没有缺口"放行 ──
  if (scopeError) return { ...empty, verdict: 'undetermined', reason: `取不到清单:${scopeError}` }
  // ── fail-closed 第二格:list-uncovered 派生失败(EBUSY / git 不可用 / 脚本非零退出) ──
  // 这一格就是 2026-10-03 那个洞的形状:改前它 exit 1,但没有自检钉住,任何一次
  // "把 exit 1 换成 return []"的顺手重构都会让门 47 在 git 不可用时变成绿色。
  if (uncoveredError) return { ...empty, verdict: 'undetermined', reason: `取不到未覆盖清单:${uncoveredError}` }
  if (!Array.isArray(uncovered)) return { ...empty, verdict: 'undetermined', reason: '未覆盖清单不是数组(取材层形状异常)' }
  // ── fail-closed 第三格:清单"取到了但是空的" ≠ 没有缺口。空清单同样是判据失明 ──
  // (git 在错的目录上跑 / 派生层静默返回空串,两种都长这样。)
  if (!Array.isArray(scope?.indexFiles) || scope.indexFiles.length === 0) {
    return { ...empty, verdict: 'undetermined', reason: '跟踪清单为空 ⇒ 判据失明,不按"已覆盖"放行' }
  }
  const indexSet = new Set(scope.indexFiles)
  const denominator = new Set(scope.files ?? scope.indexFiles)
  // ── fail-closed 第四格(G-1018220):提交档拿不到"本次携带面"⇒ 未判定 ──
  // 这一格必须存在:否则一次 git 抖动就把「没判」写成「本次没带文件 ⇒ 通过」,
  // 而"无横幅文件进提交"这条通道正是本门立项要堵的那一格(§5c)。
  if (stagedFace && carriedError) {
    return { ...empty, verdict: 'undetermined', reason: `取不到本次提交携带的文件面:${carriedError}` }
  }
  if (stagedFace && !Array.isArray(input.carried)) {
    return { ...empty, verdict: 'undetermined', reason: '本次提交携带的文件面不是数组(取材层形状异常)' }
  }
  // 双保险:排除面已由 watermark.mjs 的 scanCoverage 用同一个谓词移出分母,这里再筛一次 ——
  // 若哪天有人只改了一侧,本门要么把横幅打进第三方内容(自愈侧),要么恒红(判定侧)。
  const inDenominator = uncovered.filter((f) => denominator.has(f) && !isExcluded(f))
  // 只有**索引里**的那批可以判红/自愈:未跟踪面里挂着别人在飞的源文件,
  // 判红 = 与本次提交无关的恒红门(各会话只好 --no-verify,连带全部守门作废),
  // 自动注入 = 往别人的未提交文件里写字并 git add 别人的东西(污染 + 越权两型)。
  const inIndexGaps = inDenominator.filter((f) => indexSet.has(f))
  // G-1018220 的收窄:提交档只把「本次提交真的携带(索引相对 HEAD 有差异)」的文件算成判红/自愈面;
  // 别人 add 过而我这次不带的那些,降到**只报数**那一档(与未跟踪面同一处理方式),
  // 由全量档 / CI 继续问责 —— 既不洗红,也不让门替别人的欠账挡路、更不许 git add 别人的文件。
  const carriedSet = stagedFace ? new Set(input.carried) : null
  const missing = carriedSet ? inIndexGaps.filter((f) => carriedSet.has(f)) : inIndexGaps
  const untouchedGaps = carriedSet ? inIndexGaps.filter((f) => !carriedSet.has(f)) : []
  const untrackedGaps = inDenominator.filter((f) => !indexSet.has(f))
  const drift = uncovered.filter((f) => indexSet.has(f) && isExcluded(f))
  if (missing.length === 0) return { verdict: 'pass', missing, untrackedGaps, untouchedGaps, drift }
  if (missing.length > maxAutofix) {
    return {
      verdict: 'gap-too-many',
      reason: `超过自愈上限 ${maxAutofix}, 拒绝自动回写`,
      missing,
      untrackedGaps,
      untouchedGaps,
      drift,
    }
  }
  return { verdict: 'gap', missing, untrackedGaps, untouchedGaps, drift }
}

/**
 * 双横幅(重复版权头)巡检 —— warn-only,不计入退出码,但**必须与判定同面**。
 * 2026-09-22 实测:injectFile 旧版只在"见到载荷标记"时才清洗 ⇒ 已有裸横幅(无载荷)的文件
 * 被前置一条新横幅,之后恒 skip-done ⇒ 重复头永久冻结,而"有载荷即完好"的判据看不见它。
 * 工具已修(横幅文本存在即先清洗);这里把残留量显式报出来,便于后续下调到 0 再升 blocking。
 * head/staged 面一次 `cat-file --batch` 读完(逐文件派生 = fork 风暴);取不到 blob ⇒ 抛
 * Undetermined(清单同轮枚举到而内容取不到 = 面自相矛盾,那是「没判」,既不记绿也不冒红)。
 */
const CANON_BANNER = /^\/\/ © \d{4} IHUI AI \(智汇AI\) · 版权所有者:/gm
function sweepDupBanners({ face, scope, isExcluded }) {
  const sweepFiles = scope.indexFiles.filter(
    (f) => /\.(ts|tsx|js|mjs|cjs|css)$/.test(f) && !isExcluded(f),
  )
  let dupBanner = 0
  const dupSamples = []
  const bump = (f, text) => {
    const n = (text.match(CANON_BANNER) || []).length
    if (n > 1) {
      dupBanner += 1
      if (dupSamples.length < 5) dupSamples.push(`${f}(×${n})`)
    }
  }
  if (face === 'worktree') {
    for (const f of sweepFiles) {
      let text
      try {
        // 工作树逃生舱:磁盘读;缺文件返 null ⇒ 与旧 ENOENT 同形跳过
        text = readWorktreeFile(REPO_ROOT, f)
      } catch {
        continue
      }
      if (text === null) continue
      bump(f, text)
    }
  } else if (sweepFiles.length > 0) {
    const prefix = face === 'head' ? 'HEAD:' : ':'
    const specs = sweepFiles.map((f) => prefix + f)
    const raw = catBatch(REPO_ROOT, specs)
    sweepFiles.forEach((f, i) => {
      const text = raw.get(specs[i])
      if (text === null || text === undefined) {
        throw new Undetermined(`${face} 面自相矛盾:巡检清单枚举到而 blob 取不到:${f}`)
      }
      bump(f, text)
    })
  }
  return { dupBanner, dupSamples, swept: sweepFiles.length }
}

/** 把收窄后的路径写成 watermark.mjs `--files-from` 能吃的临时清单(>300 文件也不撑命令行)。 */
function writeFileManifest(paths) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-push-scope-'))
  const file = join(dir, 'files.txt')
  writeFileSync(file, paths.join('\n') + '\n', 'utf8')
  return { file, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

// ---------- 主流程(§22d 守卫;判据本体是纯函数 decideCoverage,镜像测试直接 import) ----------
async function main() {
  if (process.argv.includes('--self-test')) return selfTest()

  if (process.env.HUSKY_SKIP_WATERMARK_GUARD === '1') {
    console.log('[skip] HUSKY_SKIP_WATERMARK_GUARD=1, 跳过溯源水印覆盖守门')
    return 0
  }

  // 面意图(2026-11-09):0 个面旗 / ≥2 个面旗 一律未判定。
  // 旧行为在无面旗时默认整张 HEAD 面 —— 与"拿不到范围就猜一个更大的面"是同一个病。
  const intent = resolveFaceIntent({
    staged: STAGED,
    worktree: WORKTREE,
    pushScope: PUSH_SCOPE,
    fullFace: FULL_FACE,
  })
  if (intent.error) {
    console.error(`[watermark-coverage] ❌ 无法判定:${intent.error}`)
    console.error('  本门不再"没给面就猜整张 HEAD 面"—— 那会把自愈写进本次改动之外的文件(2026-11-09 事故 190 个)。')
    return 2
  }
  const face = intent.face
  const faceArgs = face === 'worktree' ? ['--worktree'] : face === 'staged' ? ['--staged'] : []

  /**
   * 第三方排除面与 watermark.mjs 走**同一个出口**(scripts/lib/third-party-roots.mjs)。
   * 本门自己不再拼一份 roots 清单 —— 两处算同一件事各写一份,正是本仓最高频的失守形态。
   * 之所以两处都要判:本门的自愈循环(`inject` + 双横幅巡检)与 list-uncovered 是两条独立路径,
   * 只收窄其一,另一条照样会把横幅打进已登记的第三方内容。
   */
  let exclusion
  try {
    exclusion = createExclusionPredicate(REPO_ROOT)
  } catch (e) {
    const why = e instanceof LedgerUnavailable ? e.message : String(e?.message ?? e)
    console.error('[watermark-coverage] ❌ 第三方排除面无法判定:' + why.split('\n')[0])
    console.error('  算不出"哪些是已登记第三方内容"时**拒绝**自愈 —— 自愈的动作是往文件里写归属横幅,')
    console.error(
      '  把横幅写进 Apache-2.0/MIT 许可原文比"少一个横幅"严重得多。请先修台账或 git 可用性。',
    )
    return 1
  }

  // G-1018220:提交档(`--staged`)把**判红面与自愈面**收到"本次提交携带的文件";
  //   全量档与 `--no-fix` 判据一字未动(只是面从磁盘换成 HEAD blob —— 那才是提交真正带走的东西)。
  //   索引里别人 add 过而我这次不带的缺口 ⇒ 降为**只报数**;既不 git add 别人的文件,
  //   也不让一道与本次提交无关的门替当前提交者挡路(§12e/§12f)。
  //
  // push-gate(2026-11-03):判面仍是 HEAD blob(被推送的提交内容),但分母收窄到
  //   PUSH_SCOPE_FILES ∩ HEAD 树;单文件判据、排除面、自愈策略全部复用下面同一条 decideCoverage。
  let scope
  let uncovered
  let faceInfo
  let sweepScope
  let pushScopeNote = ''
  /** 显式全量面(--full-face 或 push 侧清单头 face=full):唯一允许判整张 HEAD 面的两种调用。 */
  let explicitFull = intent.explicitFull === true
  // 携带面**只量一次**(paths 与 error 必须来自同一轮派生;两次派生 = 两个时刻的索引)。
  // 提交档的 list-uncovered 也要它当分母,故提前到分支之前取。
  const carried = face === 'staged' ? carriedFiles() : { paths: null, error: null }
  if (PUSH_SCOPE) {
    // 范围凭据缺失 = 未判定。**不得**退回整张 HEAD 面:那个面上的自愈会写到本次改动之外。
    const cred = readPushScope({ readManifestFile: (p) => readFileSync(p, 'utf8') })
    if (cred.error) {
      // 无文件面档(2026-11-04):本次推送只增删 ref、零 blob 变更 ⇒ 判定面是**真空集**,
      // 不是「取不到面」。只有钩子逐条 ref 复核过并带上依据时才启用。
      const noFile = noFileFaceVerdict()
      if (noFile && noFile.ok) {
        console.log(`[watermark-coverage] ✅ 无文件面,按通过 —— 判定依据: ${noFile.basis}`)
        console.log(
          '[watermark-coverage] 判据:本次推送 ref 清单已逐条复核为 0 blob 变更 ⇒ 无 HEAD 面文件可判;有文件变更时仍走 push scope 逐级推导(未放宽)。',
        )
        return 0
      }
      console.error(`[watermark-coverage] ❌ 无法判定:push 范围凭据缺失/不可用 —— ${cred.error}`)
      if (noFile && !noFile.ok) console.error(`  另:PUSH_NO_FILE_FACE 档未启用 —— ${noFile.reason}`)
      console.error('  缺的是:本次推送的变更文件清单(作用域凭据):PUSH_SCOPE_FILES 或 PUSH_SCOPE_MANIFEST')
      console.error('  怎么补:')
      console.error('    ① 正常路径:.husky/pre-push 调 `guardian-runner --push-gate` 时导出上述两者之一(勿手动裸跑)')
      console.error('    ② 手动复跑:`PUSH_SCOPE_FILES=<路径逐个换行> node scripts/check-watermark-coverage.mjs --push-scope`')
      console.error('    ③ 确实要整面检查:显式给 --full-face(输出写明"本次为显式全量面")')
      console.error('  本门不再退回整张 HEAD 面 —— 那会把水印写进本次改动之外的文件(2026-11-09 实测 190 个)。')
      return 2
    }
    const headScope = trackedFiles('head')
    if (cred.face === 'full') {
      // push 侧清单头显式申明整面(= 定时任务 / push-receipt worker 的显式全量档)。
      scope = headScope
      uncovered = listUncovered([])
      sweepScope = headScope
      explicitFull = true
      faceInfo = '(本次为显式全量面:push 侧范围清单 head=full)'
      pushScopeNote = '本次为显式全量面(push 侧范围清单申明)'
    } else {
      const pushSet = new Set(cred.paths)
      const narrowed = (headScope.files ?? []).filter((f) => pushSet.has(f))
      let manifest = null
      try {
        if (narrowed.length > 0) {
          manifest = writeFileManifest(narrowed)
          uncovered = listUncovered(['--files-from', manifest.file])
        } else {
          // scope 已取到,只是本次 push 没碰任何 HEAD 面文件(纯删除/非可判类型):这不是"判不了"。
          uncovered = { paths: [], error: null }
        }
      } finally {
        if (manifest) manifest.cleanup()
      }
      // indexFiles 仍取 HEAD 全树:decideCoverage 的"分母为空 ⇒ 未判定"闸门需要它;
      // files 才是本次分母 —— 两者同面(HEAD),只是后者收窄。
      scope = {
        indexFiles: headScope.indexFiles,
        files: narrowed,
        untrackedFiles: [],
        error: headScope.error,
      }
      sweepScope = { indexFiles: narrowed, files: narrowed }
      faceInfo = `(push scope 来源=${cred.source}:本次推送 ${cred.paths.length} 个变更文件 → HEAD 面交集 ${narrowed.length} 个)`
      pushScopeNote = `push scope 面(变更 ${cred.paths.length} 个 → HEAD 交集 ${narrowed.length} 个)`
    }
  } else if (FULL_FACE) {
    // 显式整面检查:唯一的非 push 全量入口。输出必须写明"本次为显式全量面",
    // 免得看日志的人把"整面跑"误读成"本次推送的面"。
    scope = trackedFiles('head')
    uncovered = listUncovered([])
    sweepScope = scope
    faceInfo = '(本次为显式全量面:--full-face)'
  } else if (face === 'staged') {
    // 提交档(2026-11-10 分母收窄):面**仍是索引 blob**,但扫描面收窄到**本次提交真正携带**的文件。
    // 旧实现在这里让对面把整张索引面(2 万+ blob)全部解码一遍,单次 30s 量级,而一次提交往往
    // 只带 1~4 个文件。收窄复用对面既有的 `--files-from`,清单就是下面 decideCoverage 用的同一份
    // 携带面(carriedFiles)—— 本门不拼第二套文件枚举。
    scope = trackedFiles('staged')
    if (carried.error || carried.paths.length === 0) {
      // ① 取不到携带面 ⇒ 交给 decideCoverage 判「未判定」(不在这里猜"本次什么都没带");
      // ② 携带面为空 ⇒ 本档改前就是通过(没有文件可判),而对面把空清单判为「未判定 exit 2」——
      //    两者语义不同,故暂存面为空时**不调** list-uncovered,直接给空缺口集。
      uncovered = { paths: [], error: null }
    } else {
      uncovered = listUncoveredNarrow(['--staged'], carried.paths)
    }
    faceInfo = '(判定面=staged)'
    // 双横幅巡检同样只盘本次携带、且仍在索引里的文件(删除路径取不到 blob,不进巡检面)。
    const stillInIndex = new Set(scope.indexFiles)
    sweepScope = { indexFiles: (carried.paths ?? []).filter((f) => stillInIndex.has(f)), files: [] }
  } else {
    scope = trackedFiles(face)
    uncovered = listUncovered(faceArgs)
    faceInfo = face === 'head' ? '' : `(判定面=${face})`
    sweepScope = scope
  }
  const decision = decideCoverage({
    scope,
    uncovered: uncovered.paths,
    uncoveredError: uncovered.error,
    isExcluded: exclusion.isExcluded,
    stagedFace: face === 'staged',
    carried: carried.paths,
    carriedError: carried.error,
  })
  if (decision.verdict === 'undetermined') {
    console.error(`[watermark-coverage] ❌ 无法判定${faceInfo}:${decision.reason}`)
    console.error('  取不到判定面时**不**按"没有缺口"放行 —— 那等于把"没判"写成"判过了"(§0.3)。')
    console.error('  也**不**回落另一个面去凑结论(§0.4);修复 git/HEAD 可用性后重跑。')
    return 2
  }
  const { missing, untrackedGaps, untouchedGaps, drift } = decision
  const indexSet = new Set(scope.indexFiles)
  // 自愈写盘范围必须**严格等于判定面**(2026-11-09 立):判定面是 75 文件就只碰这 75 个。
  // 这一条是结构性闸门,防未来某次改动把 missing 的来源换成"更大的面"(190 文件事故的形状)。
  // MAX_AUTOFIX 只在已判定的面内生效,绝不因为"缺口数没超上限"就扩大面。
  const judgedFaceSet = new Set(
    PUSH_SCOPE && !explicitFull
      ? (scope.files ?? [])
      : face === 'staged'
        ? (carried.paths ?? [])
        : (scope.indexFiles ?? []),
  )
  const outsideFace = autofixOutsideFace(missing, judgedFaceSet)
  if (outsideFace.length > 0) {
    console.error(
      `[watermark-coverage] ❌ 无法判定:自愈面越界 —— ${outsideFace.length} 个待处理文件不在本轮判定面内`,
    )
    for (const f of outsideFace.slice(0, 30)) console.error('  - ' + f)
    console.error('  判定面之外的文件一个字节都不写(MAX_AUTOFIX 只在已判定的面内生效)。')
    return 2
  }
  if (drift.length > 0) {
    console.warn(
      `[watermark-coverage] ⚠️ 排除面两侧不一致:${drift.length} 个已登记第三方文件被 list-uncovered 报成缺口(watermark.mjs 未走同一谓词?),已跳过不注入。示例: ${drift.slice(0, 5).join(', ')}`,
    )
  }
  console.log(
    `[watermark-coverage] 台账登记的第三方排除面:roots ${exclusion.roots.length} 条 → 真实文件 ${exclusion.paths.size} 个(不计入水印分母,改由 provenance-ledger P8 审计)`,
  )
  if (exclusion.notes.length) {
    for (const n of exclusion.notes) console.warn(`[watermark-coverage] NOTE 排除面: ${n}`)
  }
  if (exclusion.unresolvedRoots.length) {
    console.warn(
      `[watermark-coverage] NOTE 台账登记了而当前清单里没有的 root ${exclusion.unresolvedRoots.length} 条(归 provenance-ledger P1 问责): ${exclusion.unresolvedRoots.join(', ')}`,
    )
  }

  const sweep = sweepDupBanners({ face, scope: sweepScope, isExcluded: exclusion.isExcluded })
  if (sweep.dupBanner > 0) {
    console.log(
      `[watermark-coverage] ⚠️ 双横幅文件 ${sweep.dupBanner} 个(warn,不阻塞;修复:node scripts/watermark.mjs clean <f> && inject <f>)`,
    )
    console.log(`   样例: ${sweep.dupSamples.join(', ')}`)
  }

  if (untrackedGaps.length > 0) {
    // 只报数、不判红、不代写:那批文件属别人在飞的现场(见文件头 G-253 那段)。
    // 但必须**喊出来** —— 否则"分母并上了未跟踪面"这件事与没做只差一行日志。
    console.log(
      `[watermark-coverage] ℹ️ 未跟踪面上另有 ${untrackedGaps.length} 个缺水印的源文件` +
        `(**不计入退出码、不自动往别人未提交的文件里写字**):` +
        untrackedGaps.slice(0, 5).join(', ') +
        (untrackedGaps.length > 5 ? ` … 其余 ${untrackedGaps.length - 5} 个` : ''),
    )
    console.log(
      '   出口:各自作者在被提交/落地前跑 `node scripts/watermark.mjs inject <file>`;' +
        '旁路提交由 scripts/object-space-land.mjs 兜(它拒绝落地无有效横幅的声明路径)。',
    )
  }

  if (untouchedGaps.length > 0) {
    // 只报数、不判红、**不代写也不代 add**:这批文件在索引里,但本次提交不携带它们(别人 add 过)。
    // 判红 = 与本次提交无关的恒红门(§12e/§12f);自愈 = 把别人的欠账连同横幅 git add 进我的提交(§12 污染型)。
    // 问责仍在:全量档与本门的 CI 侧照旧逐条判它们,所以这不是把红洗成绿,是把责任还给持有它的那一枚提交。
    console.log(
      `[watermark-coverage] ℹ️ 索引里另有 ${untouchedGaps.length} 个缺水印文件**不由本次提交携带**` +
        `(**不计入退出码、不 git add 别人的文件**):` +
        untouchedGaps.slice(0, 5).join(', ') +
        (untouchedGaps.length > 5 ? ` … 其余 ${untouchedGaps.length - 5} 个` : ''),
    )
    console.log(
      '   出口:谁提交它谁跑 `node scripts/watermark.mjs inject <file>`(或让全量档/CI 问责);' +
        '本门不得替别人补齐再由下一个人背 —— 见 PROJECT_PLAN G-1018220。',
    )
  }

  if (missing.length === 0) {
    // 措辞必须与**判过的面**一致:提交档只判了本次携带的文件,不能声称"已跟踪文件水印完整"
    // —— 那会把"没判的那一格"写成"判过了"(本仓最高频失效型)。
    // 2026-11-10 分母收窄后,本档不再解码整张索引面 ⇒ 索引存量欠账**这里算不出来**,
    // 于是如实说明"本档只判本次携带、存量由全量档统计",不再打印一个 0 冒充"存量干净"。
    console.log(
      explicitFull
        ? `[watermark-coverage] ✅ ${faceInfo}已判文件水印完整`
        : PUSH_SCOPE
          ? `[watermark-coverage] ✅ ${pushScopeNote},已判文件水印完整`
          : face === 'staged'
            ? `[watermark-coverage] ✅ 本次提交携带的 ${carried.paths ? carried.paths.length : 0} 个文件水印完整` +
                `(本档只判本次携带的索引 blob,未携带的索引存量不在本档分母内 —— 存量欠账由 --full-face / CI 全量档统计)` +
                (carried.paths && carried.paths.length === 0
                  ? ' —— 暂存面为空,本次不携带任何文件'
                  : '')
            : `[watermark-coverage] ✅ ${face === 'head' ? 'HEAD 面' : '工作树面(人工逃生舱)'}已枚举文件水印完整${face === 'worktree' ? '(未跟踪产物另列,不计入)' : ''}`,
    )
    return 0
  }

  // ---------- 纯判定模式(CI / 审计): 不修改任何文件 ----------
  if (NO_FIX) {
    reportGap(missing, '(会导致 CI 红)', faceInfo, face)
    return 1
  }

  // ---------- 自愈模式 ----------
  if (decision.verdict === 'gap-too-many') {
    reportGap(missing, `(超过自愈上限 ${MAX_AUTOFIX}, 拒绝自动回写)`, faceInfo, face)
    console.error('')
    console.error(`  ⚠️ 单次缺口 ${missing.length} 个 > 上限 ${MAX_AUTOFIX}: 疑似批量改写事故。`)
    console.error('     请先排查改写来源(文本级 sed/prettier/生成器), 再整体重注入:')
    console.error('     node scripts/watermark.mjs inject')
    return 1
  }

  console.log(
    `[watermark-coverage] 🔧 检出 ${missing.length} 个文件水印缺失/损坏(判定面=${face}), inject 写工作区...`,
  )
  for (const f of missing) {
    try {
      run('node', ['scripts/watermark.mjs', 'inject', f])
    } catch (e) {
      console.warn(`  ⚠️ ${f} 注入失败: ${String(e.message || e).split('\n')[0]}`)
    }
  }

  if (face === 'staged') {
    // pre-commit 语义:inject 只改工作区,提交带走的是索引 blob ⇒ 必须 add 回索引,
    // 否则提交的仍是"未加水印"的旧索引副本。**这一档 add 是对的(紧接着就 commit),不许改坏。**
    try {
      execFileSync('git', ['add', '--', ...missing], {
        cwd: REPO_ROOT,
        // 原来写的是 `stdio: 'pipe'` —— 那 stdin 仍是管道,正好是 EBUSY 的触发面
        //(`'pipe'` 是三通道全管道,不是"不要 stdin")。`git add` 不吃 stdin ⇒ 必须 'ignore'。
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
    } catch (e) {
      console.error('[watermark-coverage] ⚠️ git add 同步暂存区失败:', String(e.message || e))
      console.error('     注入已写入工作区, 请手动 `git add` 后重试提交。')
      return 1
    }
    // 回读校验打在**索引面**(add 之后),这才等于"本次提交带走的那一份达标了"。
    // 分母同样收窄到刚补齐的这几个文件(2026-11-10):整面回读一次又是 30s 量级,而这里只关心它们。
    const re = listUncoveredNarrow(['--staged'], missing)
    const stillMissing =
      re.paths === null
        ? missing
        : re.paths.filter(
            (f) => indexSet.has(f) && !exclusion.isExcluded(f) && missing.includes(f),
          )
    if (stillMissing.length > 0) {
      reportGap(stillMissing, '(自愈后索引面仍不达标)', faceInfo, face)
      console.error('')
      console.error('  ⚠️ 自动补齐未能达标: 该文件类型可能不可注入, 或载荷被结构性破坏。')
      console.error('     请按上方清单手动排查后重试。')
      return 1
    }
    console.log(
      `[watermark-coverage] ✅ 已自动补齐 ${missing.length} 个文件的水印并加入暂存区(无需再跳过门禁):`,
    )
    // G-1018220 口径②:每条"我刚修复"的清单行带结构化豁免键(SELF_HEAL_FIXED_MARK,从归因层
    // import 的那一份)—— 归因层"点名即定责"的铰链只认这个键豁免自愈动作行;报红块/注入失败行
    // 不带键,真失败点名照旧定责。键是**行级**的:块内其余行(表头/计数)不参与豁免。
    for (const f of missing.slice(0, 30)) console.log(`  - ${f} ${SELF_HEAL_FIXED_MARK}`)
    if (missing.length > 30) console.log(`  ... 其余 ${missing.length - 30} 个`)
    return 0
  }

  // 全量档 / push-gate 档:**只写工作区、不碰索引**。
  // WHY:工作区可回滚,索引不可 —— 在永不 commit 的档位 `git add`,就是把改动悬在共享索引里
  // 等下一个提交者背(2026-10-14「暂存更改悬着没提交」的直接成因)。写盘之后仍判红,
  // 因为判定面(HEAD)只能被一次真正的提交改变 —— 把"没落地"写成"已修好"是假绿,不许。
  const disk = listUncovered(missing) // 显式点名 = 工作树面:量"inject 是否真写到了盘上"
  const stillOnDisk = disk.paths === null ? missing : disk.paths.filter((f) => missing.includes(f))
  if (stillOnDisk.length > 0) {
    reportGap(stillOnDisk, '(自愈后盘上仍不达标 —— 类型不可注入或载荷结构性破坏)', faceInfo, face)
    return 1
  }
  if (face === 'worktree') {
    console.log(
      `[watermark-coverage] ✅ 工作树面(人工逃生舱)已补齐 ${missing.length} 个文件(本档刻意不动索引,请随下一次提交带上):`,
    )
    for (const f of missing.slice(0, 30)) console.log(`  - ${f}`)
    return 0
  }
  console.log(
    `[watermark-coverage] 💧 已 inject 到工作区 ${missing.length} 个(**全部在判定面内**),本档刻意不动索引:` +
      '索引不可回滚,在永不 commit 的档位 add 会把改动悬在共享索引里等别人背。',
  )
  // 同根因提示(2026-11-09):非 --staged 面"只写盘不暂存"本身是对的,但必须把"改了但没暂存"
  // 这件事**显式喊出来**,否则下一次 `git status` 里那批改动会被当成"别人在飞"或干脆被忽略。
  console.log(
    '   ⚠️ 这批文件当前状态 = 已改工作区、**未暂存**。下一步必须自己 `git add` 并随一枚提交带上,' +
      '否则盘上看起来已修好、HEAD 面欠账仍在(门照红,且改动会一直挂在共享工作区)。',
  )
  for (const f of missing.slice(0, 30)) console.log(`  - ${f}`)
  if (missing.length > 30) console.log(`  ... 其余 ${missing.length - 30} 个`)
  reportGap(missing, '(HEAD 面欠账不会因写盘而销 —— 只有一枚把它带进 HEAD 的提交能修)', faceInfo, face)
  return 1
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (isDirectRun) {
  main()
    .then((code) => {
      // 必须显式传播退出码:异步 main() 自然返回时 Node 一律按 0 收工(守门 194 自检抓出的真缺陷)
      process.exitCode = typeof code === 'number' ? code : 0
    })
    .catch((e) => {
      if (e instanceof Undetermined) {
        console.error(`[watermark-coverage] ❌ 无法判定(未判定 ≠ 通过,也不冒红):${e.message}`)
        process.exitCode = 2
      } else {
        console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
        process.exitCode = 2
      }
    })
}

export const __test__ = {
  decideCoverage,
  selfTest,
  sweepDupBanners,
  reportGap,
  NO_FIX,
  STAGED,
  WORKTREE,
  MAX_AUTOFIX,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
