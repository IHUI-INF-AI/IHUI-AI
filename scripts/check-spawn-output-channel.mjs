// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「派生结论通道对账」—— 拦**反极性**那一型:`stdio` 把 stdout 丢掉/直通终端,
 * 而同一作用域里又去读它 ⇒ 该调用的结论恒为 null。
 *
 * ## 立因(实测,不是预防)
 *
 * 2026-10-04 为治本机派生 EBUSY,上百处 spawn 统一补了 `stdio`。EBUSY 的真判据是"**不写** stdio",
 * 但补法用了标量 `stdio:'ignore'` —— 它对**三个通道同时生效**。用在"靠 stdout 拿结论"的调用上之后,
 * `JSON.parse(r.stdout)` 恒抛 ⇒ 门把尺子读成"输出不可解析",写成「机器态未判定」并 **exit 0**:
 * 账面像"这台机没跑成",实际是**门自己把尺子的输出扔了**。守门 152 因此自接线那天起在提交链上
 * 从未真的判过一次(同一条尺子 standalone 给 `scanned: 1429`,门给 `扫描 0`)—— 出处票 G-1108372,
 * 修复枚 `0604d21605bba58c079ba540107792abb0787533`。
 *
 * ## 与另外两把 stdio 门的分工(方向相反,不得并进)
 *
 *  `check-git-stdio-discipline.mjs` / `check-spawn-stdio.mjs` 判"**缺** stdio / 写 `'pipe'` 也算病";
 *  本门只问"stdout 通道被丢了却还有人读"。并进去会把**正当**的 `stdio:'ignore'`(确实不吃输出的
 *  调用)判红 —— 那是造一台恒红门,唯一结局是各会话 `--no-verify` 连带废掉全部守门(AGENTS §12e)。
 *
 * ## 判据只有一份
 *
 *  唯一实现 = `scripts/lib/spawn-output-channel.mjs` 的 `findBlindOutputSpawns`。本门**不得**再写
 *  一份正则(两处算同一件事必漂移,§22c);守门 152 的镜像测试 T11 也已改为 import 这一份。
 *
 * ## 定级 blocking 的前置(落地当轮现跑)
 *
 *  普查面 `git ls-files scripts` 的 `.mjs/.cjs/.js`,逐条读体后**真缺陷 1 处已修、其余候选全是假阳**
 *  ⇒ HEAD 面命中 0 ⇒ 接线不新增恒红面。数字一律现读,勿照本行派单。
 *  **没有行内豁免通道,也没有台账**:这一型的正解只有"把通道改回管道",没有"标一下跳过"。
 *
 * 用法:node scripts/check-spawn-output-channel.mjs [--staged|--worktree] [--json] [--strict] [--self-test]
 *   缺省判 HEAD blob;`--staged` 判索引 blob(只咬本次改动过的文件);`--worktree` 仅人工取证档。
 *   两面旗同给 ⇒ exit 2。`--strict` 下"有未判定"⇒ exit 2(拒绝出具合格证)。
 * 紧急跳过:HUSKY_SKIP_SPAWN_OUTPUT_CHANNEL=1(跳过即放弃"结论通道必须看得见"这条不变量,须在提交信息写明理由)
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitErrText, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { findBlindOutputSpawns } from './lib/spawn-output-channel.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT_MS = 120_000
const GIT_MAX = 64 << 20
const SCAN_DIRS = ['scripts']
const SRC_EXT = /\.(?:mjs|cjs|js)$/
// 判据自身与它的镜像测试**必须**含违例形态的文本(阳性对照的载体),按文件名前缀自豁免(守门 79 同做法)。
const SELF_EXEMPT = /^scripts[/\\](?:check-spawn-output-channel\.mjs|lib[/\\]spawn-output-channel\.mjs|tests[/\\]check-spawn-output-channel\.test\.mjs)$/

function listFaceFiles(face) {
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCAN_DIRS]
      : face === 'staged'
        ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--', ...SCAN_DIRS]
        : ['ls-files', '--', ...SCAN_DIRS]
  try {
    const out = gitRaw(args, ROOT, { timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX })
    if (out === null) return { error: 'git 没有产出清单' }
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && SRC_EXT.test(s))
  } catch (e) {
    return { error: gitErrText(e) }
  }
}

function readFace(face, files) {
  if (face === 'worktree') return null
  const specs = files.map((p) => (face === 'head' ? `HEAD:${p}` : `:${p}`))
  try {
    const map = catBatch(ROOT, specs, { timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX })
    const out = new Map()
    for (let i = 0; i < files.length; i++) out.set(files[i], map.get(specs[i]) ?? null)
    return out
  } catch (e) {
    return { error: gitErrText(e) }
  }
}

/** 面旗矛盾/枚举失败/空枚举一律判死,不当"没有违规"。 */
export function decide({ files, contents, changedSet, face, strict }) {
  const hits = []
  const undetermined = []
  const skippedSelf = []
  let scanned = 0
  for (const p of files) {
    if (SELF_EXEMPT.test(p)) {
      skippedSelf.push(p)
      continue
    }
    if (face === 'staged' && changedSet && !changedSet.has(p)) continue
    const text = contents === null ? readWorktreeFile(ROOT, p) : contents.get(p)
    if (text === null || text === undefined) {
      undetermined.push(`${p}(${face} 面取不到内容)`)
      continue
    }
    scanned++
    const r = findBlindOutputSpawns(text)
    for (const h of r.hits) hits.push({ file: p, line: h.line, varName: h.varName, channel: h.channel })
    for (const u of r.undetermined) undetermined.push(`${p}:${u.line} ${u.reason}`)
  }
  const rc = hits.length > 0 ? 1 : strict && undetermined.length > 0 ? 2 : 0
  return { rc, scanned, hits, undetermined, skippedSelf }
}

function selfTest() {
  const rows = []
  const t = (name, cond) => rows.push({ name, ok: cond === true, got: String(cond) })
  const A = (ch) => `function f(){\n  const r = spawnSync(py, [s], { ${ch}, encoding: 'utf8' })\n  return JSON.parse(r.stdout)\n}\n`
  t('S1 标量 ignore + 读 r.stdout ⇒ 命中', findBlindOutputSpawns(A("stdio: 'ignore'")).hits.length === 1)
  t('S2 数组第二格 ignore ⇒ 命中', findBlindOutputSpawns(A("stdio: ['ignore', 'ignore', 'pipe']")).hits.length === 1)
  t('S3 inherit 直通终端而读它 ⇒ 命中', findBlindOutputSpawns(A("stdio: ['ignore', 'inherit', 'pipe']")).hits.length === 1)
  t('S4 合规写法(第二格 pipe)不命中', findBlindOutputSpawns(A("stdio: ['ignore', 'pipe', 'pipe']")).hits.length === 0)
  t('S5 丢掉通道但**没人读** ⇒ 正当,不命中', findBlindOutputSpawns(`function g(){\n  const r = spawnSync(py, ['--version'], { stdio: 'ignore' })\n  return r.status\n}\n`).hits.length === 0)
  t('S6 同名变量分处两个函数 ⇒ 不得互顶(整文件找 r.stdout 的假阳型)', findBlindOutputSpawns(`function a(){\n  const r = spawnSync(x, y, { stdio: 'ignore' })\n  return r.status\n}\nfunction b(){\n  const r = spawnSync(x, y, { stdio: ['ignore','pipe','pipe'] })\n  return JSON.parse(r.stdout)\n}\n`).hits.length === 0)
  t('S7 注释里的该形态不得计入(等长遮罩、行号不变)', findBlindOutputSpawns(`function f(){\n  // const r = spawnSync(py, s, { stdio: 'ignore' })\n  const r = spawnSync(py, s, { stdio: ['ignore', 'pipe', 'pipe'] })\n  return JSON.parse(r.stdout)\n}\n`).hits.length === 0)
  t('S8 括号配不平 ⇒ 未判定而非静默', findBlindOutputSpawns('function f(){ const r = spawnSync(a, b, { stdio: \'ignore\' \n return r.stdout }\n').undetermined.length >= 1)
  const s9 = findBlindOutputSpawns("function f(){\n  const stdio = 'ignore'\n  const r = spawnSync(a, b, { stdio })\n  return JSON.parse(r.stdout)\n}\n")
  t(
    'S9 stdio 是简写属性且同文件取得到唯一字面量 ⇒ **判得出命中**(票 G-1111918 档②:能判了就判,不得继续挂未判定)',
    s9.hits.length === 1 && s9.undetermined.length === 0,
  )
  const s9b = findBlindOutputSpawns(
    "function f(){\n  const stdio = ['ignore', 'pipe', 'pipe']\n  const r = spawnSync(a, b, { stdio })\n  return JSON.parse(r.stdout)\n}\n",
  )
  t('S9b 简写属性回溯到合规值 ⇒ 不命中也不是未判定(回溯不得只会定罪)', s9b.hits.length === 0 && s9b.undetermined.length === 0)
  const s9c = findBlindOutputSpawns("function f(){\n  const r = spawnSync(a, b, { stdio })\n  return JSON.parse(r.stdout)\n}\n")
  t('S9c 简写属性而同文件根本没有声明 ⇒ 仍未判定(取不到就报名,不猜)', s9c.hits.length === 0 && s9c.undetermined.length === 1)
  const s9d = findBlindOutputSpawns(
    "function g(){\n  const doc = \"const r = spawnSync(a, b, { stdio: 'ignore' })\"\n  const r2 = spawnSync(a, b, { stdio: ['ignore','pipe','pipe'] })\n  return r2.stdout\n}\n",
  )
  t(
    'S9d 夹具字符串里那半句假调用(含配不平的括号)不得进射程 ⇒ 零命中零未判定(票档①:结构遍走遮字符串那一档)',
    s9d.hits.length === 0 && s9d.undetermined.length === 0,
  )
  const s9e = findBlindOutputSpawns(
    "function f(){\n  const r = spawnSync(a, b, { stdio: q ? ['ignore','ignore','pipe'] : ['ignore','ignore','pipe'] })\n  return JSON.parse(r.stdout)\n}\n",
  )
  t('S9e 三元两支同形(都丢掉 stdout)⇒ 命中不因条件式而逃逸', s9e.hits.length === 1 && s9e.undetermined.length === 0)
  const s9f = findBlindOutputSpawns(
    "function f(){\n  const r = spawnSync(a, b, { stdio: q ? ['pipe','ignore','pipe'] : ['pipe','pipe','pipe'] })\n  return JSON.parse(r.stdout)\n}\n",
  )
  t('S9f 三元两支不同形 ⇒ 未判定(有意开关 ⇒ 既不冒红也不替它担保)', s9f.hits.length === 0 && s9f.undetermined.length === 1)
  const s15a = findBlindOutputSpawns("const r = spawnSync(a, b, { stdio: 'ignore' })\nconsole.log(r.stdout)\n")
  t('S15a 顶层调用 + 活区内有读取点 ⇒ 命中(有右界就判得出,不再一律挂未判定)', s15a.hits.length === 1 && s15a.undetermined.length === 0)
  const s15b = findBlindOutputSpawns("let r = spawnSync(a, b, { stdio: 'ignore' })\nr = execFileSync(c, d, { stdio: ['ignore', 'pipe', 'pipe'] })\nconsole.log(r.stdout)\n")
  t('S15b 顶层同名变量在读取点之前被再赋值 ⇒ 不命中、也不是未判定(活区右界生效)', s15b.hits.length === 0 && s15b.undetermined.length === 0)
  const s15c = findBlindOutputSpawns("const r = spawnSync(a, b, { stdio: 'ignore' })\nfunction f(r){ return JSON.parse(r.stdout) }\n")
  t('S15c 形参位同名 ⇒ 那条读取属于形参,不得借它给顶层那处定罪', s15c.hits.length === 0)
  // ── fd 档(G-1111918 档③,2026-10-11):通道不是字符串字面量的那一族 ──
  const FD = "function f(){\n  const fd = openSync(logPath, 'a')\n  const r = spawnSync(py, [s], { stdio: ['ignore', fd, fd], encoding: 'utf8' })\n  return JSON.parse(r.stdout)\n}\n"
  const s16a = findBlindOutputSpawns(FD)
  t('S16a fd = openSync(…) 而调用方读 r.stdout ⇒ 命中且通道记为 file-handle(句柄与 ignore 同后果)', s16a.hits.length === 1 && s16a.hits[0].channel === 'file-handle' && s16a.undetermined.length === 0)
  const s16b = findBlindOutputSpawns("function f(){\n  const fd = openSync(logPath, 'a')\n  const r = spawnSync(py, [s], { stdio: ['ignore', fd, fd] })\n  return r.status\n}\n")
  t('S16b 同写法但没人读 stdout ⇒ 零命中零未判定(真仓三处 fd 站点就是这个形态,不得留成"读不出")', s16b.hits.length === 0 && s16b.undetermined.length === 0)
  const s16c = findBlindOutputSpawns("function f(){\n  const o = process.stdout\n  const r = spawnSync(py, [s], { stdio: ['ignore', o, o] })\n  return r.stdout\n}\n")
  t('S16c 通道取 process.stdout ⇒ inherit 语义,读它必命中', s16c.hits.length === 1 && s16c.undetermined.length === 0)
  const s16d = findBlindOutputSpawns("function f(){\n  const r = spawnSync(py, [s], { stdio: ['ignore', 1, 2] })\n  return r.stdout\n}\n")
  t('S16d 裸 fd 号 1/2 ⇒ 等价 inherit 并命中(fd 表上真实存在的两个)', s16d.hits.length === 1 && s16d.undetermined.length === 0)
  const s16e = findBlindOutputSpawns("function f(){\n  const r = spawnSync(py, [s], { stdio: ['ignore', 7, 7] })\n  return r.stdout\n}\n")
  t('S16e fd 表之外的数字 ⇒ **未判定**(把没判写成判过了/判红都不许)', s16e.hits.length === 0 && s16e.undetermined.length === 1)
  const s16f = findBlindOutputSpawns("function f(o){\n  const r = spawnSync(py, [s], { stdio: ['ignore', o, o] })\n  return r.stdout\n}\n")
  t('S16f 通道来自形参(同文件无唯一声明)⇒ 仍未判定,不得因"加了 fd 档"就折成通过', s16f.hits.length === 0 && s16f.undetermined.length === 1)
  const s16g = findBlindOutputSpawns("function f(){\n  const r = spawnSync(py, [s], { stdio: ['ignore', 'pipe', 'pipe'] })\n  return r.stdout\n}\n")
  t('S16g 反向对照:合规 pipe 不因新增 fd 档被牵连(未判定/命中都为 0)', s16g.hits.length === 0 && s16g.undetermined.length === 0)
  t('S10 空内容 ⇒ 未判定,不得当通过', findBlindOutputSpawns('').undetermined.length === 1)
  const dec = decide({ files: ['scripts/x.mjs'], contents: new Map([['scripts/x.mjs', A("stdio: 'ignore'")]]), changedSet: null, face: 'head', strict: false })
  t('S11 decide 命中 ⇒ rc=1', dec.rc === 1 && dec.hits.length === 1)
  const dec2 = decide({ files: ['scripts/x.mjs'], contents: new Map([['scripts/x.mjs', A("stdio: ['ignore','pipe','pipe']")]]), changedSet: null, face: 'head', strict: false })
  t('S12 decide 合规 ⇒ rc=0', dec2.rc === 0)
  const dec3 = decide({ files: ['scripts/y.mjs'], contents: new Map([['scripts/y.mjs', null]]), changedSet: null, face: 'head', strict: true })
  t('S13 取不到内容在 --strict 下 rc=2(拒绝出合格证)', dec3.rc === 2 && dec3.undetermined.length === 1)
  const dec4 = decide({ files: ['scripts/tests/check-spawn-output-channel.test.mjs'], contents: new Map([['x', 'whatever']]), changedSet: null, face: 'head', strict: false })
  t('S14 自豁免面参与但不判', dec4.skippedSelf.length === 1 && dec4.hits.length === 0)
  const rows2 = rows.filter((r) => r.ok !== true)
  console.log(`自检 ${rows.length - rows2.length}/${rows.length}${rows2.length ? ' 失败:' + rows2.map((r) => r.name + '(实得 ' + r.got + ')').join(' / ') : ''}`)
  return rows2.length === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const sel = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (sel.error) {
    console.log(`❌ ${sel.error} ⇒ 无法判定,两个面各判各的结论不能混在一个报告里`)
    return 2
  }
  const faceName = sel.face
  const files = listFaceFiles(faceName)
  if (!Array.isArray(files)) {
    console.log(`❌ 无法枚举 ${faceName} 面清单:${files.error}`)
    return 2
  }
  if (files.length === 0) {
    console.log(`❌ 在 ${faceName} 面枚举到 0 个源码脚本 ⇒ 判死(空扫不是"没有违规",是"什么都没看")`)
    return 2
  }
  // `--staged` 的清单本身就是"本次改动过的文件"(diff --cached),所以不再二次收窄;
  // 收窄的意义是"别替别人挡路",而这里清单已经只含改动集。
  let contents = null
  if (faceName !== 'worktree') {
    contents = readFace(faceName, files)
    if (contents && contents.error) {
      console.log(`❌ ${faceName} 面取材失败,无法判定:${contents.error}`)
      return 2
    }
  }
  const d = decide({ files, contents, changedSet: null, face: faceName, strict: argv.includes('--strict') })
  const summary = `spawn-output-channel 对账:面=${faceName} 扫描 ${d.scanned} 文件 / 自豁免 ${d.skippedSelf.length} —— 命中 ${d.hits.length} 处 / 未判定 ${d.undetermined.length} 条`
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ face: faceName, ...d }, null, 2))
  } else {
    console.log(summary)
    for (const h of d.hits) console.log(`  ❌ ${h.file}:${h.line} 结果变量 ${h.varName} 的 stdout 通道是 '${h.channel}',同一作用域里却读了它`)
    for (const u of d.undetermined) console.log(`  ⚠️ 未判定 ${u}`)
    console.log(d.rc === 0 ? '结论:无命中' + (d.undetermined.length ? `(有 ${d.undetermined.length} 条未判定 ⇒ 不出具"全部已判"合格证)` : ',且无未判定') : `结论:命中 ${d.hits.length} 处`)
  }
  return d.rc
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const code = main(process.argv.slice(2))
  if (code !== 0) process.exit(code)
}

export const __test__ = { decide, selfTest, SELF_EXEMPT, SCAN_DIRS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
