// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 移动端 release 打包「API 基址是否真被内联」守门(blocking)
 *
 * 立因(2026-10-13 真机实测,非推测):
 *   `apps/mobile-rn/src/lib/config.ts` 的基址取自 `process.env.EXPO_PUBLIC_API_BASE_URL`,
 *   而真正把这个变量**内联进 JS 产物**的时刻,是打包器(安卓 gradle 的
 *   `createBundleReleaseJsAndAssets` / iOS xcodebuild 的 Bundle React Native)跑 metro+babel
 *   的转换期 —— **不是** `expo prebuild` 那一步。变量只挂在 prebuild 步的 `env:` 上时,
 *   打包步看不到它 ⇒ 转换期取到空 ⇒ 源码里的回退值 `http://localhost:8802` 被原样内联。
 *
 *   实测后果(nightly run 38279405459 的 APK,现读):
 *     assets/index.android.bundle 内 `https://api.aizhs.top` 命中 **0** 次、
 *     `http://localhost:8802` 命中 1 次;该包 targetSdk=36 且清单无 `usesCleartextTraffic`
 *     ⇒ 明文到本地回环也被平台拦 ⇒ 线上 App 每个请求都失败,登录页恒「网络连接异常」,
 *     真机走查(区段头折行 / 宫格重叠 / 广场错误态 / 播放器状态栏带)全部无法开验。
 *   iOS 侧 mobile-ios-ipa-build.yml 早已在 xcodebuild 那步自带同款 env ⇒ 只有安卓漏抄,
 *   这正是「两处算同一件事必漂移」的现成教训。
 *
 * 判据(只此一份,门与测试不得抄第二份):
 *   1. 只审**含 release 打包步**的工作流(第二个信号,避免把"提到打包器"读成"在打包"):
 *        - 安卓:非注释行含 `gradlew` 且含 `assembleRelease`
 *        - iOS :非注释行含 `xcodebuild` 且同一步块内出现 `-configuration Release`
 *      `assembleDebug` / `xcodebuild -list` / 注释里的 gradlew 一律不算(误报收窄,见 S6/S8)。
 *   2. 该变量必须对**打包步可见**,三种合法位置任一即可:
 *        ① 工作流顶层 `env:` ② 打包步所属 job 的 `env:` ③ 打包步自己的 `env:`
 *      写在**别的 step**(典型是 prebuild)⇒ 判红,并点名那个 step。
 *   3. 值必须等于 `apps/mobile-rn/eas.json` 的 `build.production.env.EXPO_PUBLIC_API_BASE_URL`
 *      (单一真相在 eas.json;防"变量在但值写错"这一型)。
 *
 * 三态不并桶:
 *   红(exit 1)= 打包步不可见 / 值与 eas.json 不一致 / eas.json 解析失败且已判到打包步
 *   未判定(exit 2)= 取材失败(列不出工作流、取不到文件)、面旗矛盾
 *   绿(exit 0)= 无 release 打包步,或全部合法
 *
 * 报数(不进退出码):`apps/mobile-rn/src/lib/config.ts` 的回退值若是回环地址,提示这里仍是
 *   纵深防御缺口 —— 开发构建用回环是正当形态,故只报数不判红(§12e:不造恒红门)。
 *
 * 用法:
 *   node scripts/check-mobile-api-base-bake.mjs               HEAD 面(缺省)
 *   node scripts/check-mobile-api-base-bake.mjs --staged       索引 blob(本次提交会带走的那一份)
 *   node scripts/check-mobile-api-base-bake.mjs --worktree     盘上内容(人工排查)
 *   node scripts/check-mobile-api-base-bake.mjs --strict       附带逐条点名的存量/报数清单
 *   node scripts/check-mobile-api-base-bake.mjs --json         机读结论
 *   node scripts/check-mobile-api-base-bake.mjs --self-test    门内自检
 * 跳过: HUSKY_SKIP_MOBILE_API_BASE_BAKE=1
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const GATE = 'check-mobile-api-base-bake.mjs'

export const VAR = 'EXPO_PUBLIC_API_BASE_URL'
export const EAS_FILE = 'apps/mobile-rn/eas.json'
export const CONFIG_FILE = 'apps/mobile-rn/src/lib/config.ts'
const WF_DIR = '.github/workflows'

const FACE_TXT = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树' }

export function faceFromArgv(argv) {
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  if (staged && worktree) return { error: '--staged 与 --worktree 互斥(两面旗同给判死)' }
  return selectFace({ staged, worktree, def: 'head' })
}

/** 取某区间内 indent===envIndent 的 `env:` 块,返回 { key: value }。 */
export function envBlockAt(lines, start, end, envIndent) {
  const out = {}
  for (let i = start; i < end; i++) {
    const raw = lines[i]
    if (raw.trim() !== 'env:') continue
    const ind = raw.length - raw.trimStart().length
    if (ind !== envIndent) continue
    for (let j = i + 1; j < end; j++) {
      const l = lines[j]
      if (l.trim() === '' || /^\s*#/.test(l)) continue
      const li = l.length - l.trimStart().length
      if (li <= envIndent) break
      if (li !== envIndent + 2) continue
      const m = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(l.trim())
      if (m) out[m[1]] = m[2].trim()
    }
    break
  }
  return out
}

/** 结构化扫一份工作流文本。返回每个含 release 打包步的 job 的判定材料。 */
export function scanWorkflow(text) {
  const lines = text.split(/\r?\n/)
  const indOf = (l) => l.length - l.trimStart().length
  const wfEnv = envBlockAt(lines, 0, lines.length, 0)

  // job 起点:indent 2 的 `xxx:`(jobs: 下的键)
  const jobStarts = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l.trim() !== 'jobs:' && indOf(l) === 2 && /^([A-Za-z0-9_.-]+):\s*$/.test(l.trim())) jobStarts.push(i)
  }
  const jobs = []
  for (let k = 0; k < jobStarts.length; k++) {
    const js = jobStarts[k]
    const je = k + 1 < jobStarts.length ? jobStarts[k + 1] : lines.length
    const id = lines[js].trim().replace(/:$/, '')
    const jobEnv = envBlockAt(lines, js + 1, je, 4)
    // step 起点:`steps:` 下缩进 +2 的 `- name:` / `- uses:`(真仓实测:job 键 indent 2、
    // `steps:` indent 4、step 项 indent 6、step 内 `env:` indent 8、其值 indent 10)。
    // 不写死 6:按 job 块内首个 step 行的实际缩进推导,免得有人改缩进就整门失明。
    const stepStarts = []
    let stepIndent = -1
    for (let i = js + 1; i < je; i++) {
      const l = lines[i]
      if (indOf(l) === 4 && /^steps:\s*$/.test(l)) continue
      if (/^\s*-\s+(name|uses):/.test(l)) {
        if (stepIndent < 0) stepIndent = indOf(l)
        if (indOf(l) === stepIndent) stepStarts.push(i)
      }
    }
    const steps = []
    for (let b = 0; b < stepStarts.length; b++) {
      const ss = stepStarts[b]
      const se = b + 1 < stepStarts.length ? stepStarts[b + 1] : je
      const head = lines[ss].trim()
      const nm = /^-\s+name:\s*(.*)$/.exec(head)
      const name = nm ? nm[1].trim() : head.replace(/^-\s+uses:\s*/, 'uses ')
      const body = lines.slice(ss, se)
      // 引号内的文本不是命令(`run: echo "# ./gradlew assembleRelease 见上文"` 会被裸子串
      // 误读成打包步 ⇒ 误报),故先去掉单/双引号包裹的片段再拼代码面。
      const code = body
        .filter((l) => l.trim() !== '' && !/^\s*#/.test(l))
        .map((l) => l.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''"))
        .join('\n')
      const isAndroidRelease = /\bgradlew\b/.test(code) && /assemble\s*Release/.test(code)
      const isIosRelease = /\bxcodebuild\b/.test(code) && /-configuration\s+Release/.test(code)
      steps.push({
        name,
        line: ss + 1,
        release: isAndroidRelease || isIosRelease,
        kind: isAndroidRelease ? 'android' : isIosRelease ? 'ios' : null,
        env: envBlockAt(lines, ss + 1, se, stepIndent + 2),
      })
    }
    jobs.push({ id, env: jobEnv, steps })
  }
  return { wfEnv, jobs }
}

/** 判据主体(纯函数,自检直喂合成文本)。 */
export function judgeWorkflow(text, expected) {
  const scanned = scanWorkflow(text)
  const findings = []
  const notes = []
  for (const job of scanned.jobs) {
    const bundle = job.steps.filter((s) => s.release)
    if (bundle.length === 0) continue
    for (const st of bundle) {
      const seen =
        scanned.wfEnv[VAR] !== undefined
          ? { where: '工作流顶层 env', value: scanned.wfEnv[VAR] }
          : job.env[VAR] !== undefined
            ? { where: `job ${job.id} 的 env`, value: job.env[VAR] }
            : st.env[VAR] !== undefined
              ? { where: `打包步「${st.name}」自身的 env`, value: st.env[VAR] }
              : null
      if (!seen) {
        const holders = job.steps.filter((s) => s.env[VAR] !== undefined)
        const holderTxt = holders.length
          ? `;它现在只挂在 ${holders.map((h) => `「${h.name}」(第 ${h.line} 行)`).join('、')} 的 env 上,打包步不在那个作用域里`
          : ';该 job 内未见任何声明'
        findings.push(
          `${st.kind === 'android' ? '安卓' : 'iOS'} release 打包步「${st.name}」(第 ${st.line} 行)看不到 ${VAR}${holderTxt} ⇒ 打包期变量为空,产物会内联 config.ts 的回退值(实测即 http://localhost:8802,线上全量「网络连接异常」)`,
        )
        continue
      }
      if (expected !== undefined && seen.value !== expected) {
        findings.push(
          `${VAR} 在${seen.where}的值是 ${seen.value || '(空)'},与 ${EAS_FILE} 的 build.production.env 值 ${expected} 不一致`,
        )
      } else {
        notes.push(`job ${job.id} 的打包步「${st.name}」:${seen.where} 可见,值一致`)
      }
    }
  }
  return { findings, notes, scanned }
}

/** eas.json 的 production 基址(单一真相)。解析失败 ⇒ 抛 Undetermined。 */
export function expectedBaseFromEas(easText) {
  let j
  try {
    j = JSON.parse(easText)
  } catch (e) {
    throw new Undetermined(`${EAS_FILE} 不是合法 JSON:${String(e?.message || e)}`)
  }
  const v = j?.build?.production?.env?.[VAR]
  if (typeof v !== 'string' || v === '') throw new Undetermined(`${EAS_FILE} 缺 build.production.env.${VAR}`)
  return v
}

/** 回退值报数:开发构建用回环正当,故只报数。 */
export function fallbackNote(configText) {
  const m = new RegExp(`${VAR}\\s*\\|\\|\\s*'([^']+)'`).exec(configText || '')
  if (!m) return null
  return /localhost|127\.0\.0\.1|10\.0\.2\.2/.test(m[1])
    ? `${CONFIG_FILE} 在无 env 时回退到 ${m[1]} —— 打包期一旦漏传就是线上全量断网(P0),纵深防御缺口(开发构建用回环正当,故只报数不判红)`
    : null
}

export function listWorkflowFiles(root, face) {
  if (face === 'worktree') {
    try {
      // 必须回带目录前缀:git 面(ls-files/ls-tree)给出的是仓库相对路径,工作树面只有基名。
      return readdirSync(join(root, WF_DIR))
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
        .map((f) => `${WF_DIR}/${f}`)
    } catch {
      throw new Undetermined(`工作树列不出 ${WF_DIR}`)
    }
  }
  const args =
    face === 'staged'
      ? ['ls-files', '--', WF_DIR]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', WF_DIR]
  const out = gitRaw(args, root, { maxBuffer: 1 << 26 })
  if (out === null || out === undefined) throw new Undetermined(`${FACE_TXT[face]} 列不出 ${WF_DIR}`)
  return String(out)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => p.endsWith('.yml') || p.endsWith('.yaml'))
}

export function readFaceInputs(root, face, files) {
  const out = {}
  if (face === 'worktree') {
    for (const rel of files) {
      const t = readWorktreeFile(root, rel)
      if (t === null || t === undefined) throw new Undetermined(`工作树取不到 ${rel}`)
      out[rel] = t
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = files.map((rel) => prefix + rel)
  const got = catBatch(root, specs, { maxBuffer: 1 << 28 })
  for (let i = 0; i < files.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined) throw new Undetermined(`${FACE_TXT[face]} 取不到 ${files[i]}`)
    out[files[i]] = t
  }
  return out
}

export function selfTest() {
  const rows = []
  const t = (name, cond, got) => rows.push({ name, ok: cond === true, got: String(got) })
  const EXP = 'https://api.aizhs.top'
  const wrap = (body) => `name: w\n${body}`

  // ① 安卓 job 级 env(本仓修复后的形态)⇒ 绿
  t(
    'S1 安卓 job 级 env ⇒ 绿',
    judgeWorkflow(
      wrap(`on: {push: {branches: [main]}}\njobs:\n  apk:\n    runs-on: ubuntu-latest\n    env:\n      ${VAR}: ${EXP}\n    steps:\n      - name: prebuild\n        run: npx expo prebuild\n      - name: Build release APK\n        run: ./gradlew assembleRelease --no-daemon\n`),
      EXP,
    ).findings.length === 0,
  )
  // ② 安卓只在 prebuild 步(本仓原状,P0)⇒ 红
  t(
    'S2 安卓只在 prebuild 步挂变量 ⇒ 红(本仓原状阳性对照)',
    judgeWorkflow(
      wrap(`jobs:\n  apk:\n    runs-on: ubuntu-latest\n    steps:\n      - name: prebuild\n        env:\n          ${VAR}: ${EXP}\n        run: npx expo prebuild\n      - name: Build release APK\n        run: ./gradlew assembleRelease --no-daemon\n`),
      EXP,
    ).findings.length === 1,
  )
  // ③ 完全没有声明 ⇒ 红
  t(
    'S3 打包步无任何可见声明 ⇒ 红',
    judgeWorkflow(
      wrap(`jobs:\n  apk:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Build release APK\n        run: ./gradlew assembleRelease --no-daemon\n`),
      EXP,
    ).findings.length === 1,
  )
  // ④ iOS 打包步自带 env(本仓 iOS 现状)⇒ 绿
  t(
    'S4 iOS 打包步自带 env ⇒ 绿',
    judgeWorkflow(
      wrap(`jobs:\n  ipa:\n    runs-on: macos-latest\n    steps:\n      - name: Build unsigned IPA\n        env:\n          ${VAR}: ${EXP}\n        run: |\n          xcodebuild \\\n            -configuration Release \\\n            build\n`),
      EXP,
    ).findings.length === 0,
  )
  // ⑤ 值不一致 ⇒ 红
  t(
    'S5 值与 eas.json 不一致 ⇒ 红',
    judgeWorkflow(
      wrap(`jobs:\n  apk:\n    runs-on: ubuntu-latest\n    env:\n      ${VAR}: http://localhost:8802\n    steps:\n      - name: Build release APK\n        run: ./gradlew assembleRelease --no-daemon\n`),
      EXP,
    ).findings.length === 1,
  )
  // ⑥ 非 release 形态不判(误报收窄)
  t(
    'S6 assembleDebug / xcodebuild -list 不判(非 release)',
    judgeWorkflow(
      wrap(`jobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - name: debug\n        run: ./gradlew assembleDebug\n      - name: list\n        run: xcodebuild -list\n`),
      EXP,
    ).findings.length === 0,
  )
  // ⑦ 工作流顶层 env ⇒ 绿
  t(
    'S7 工作流顶层 env ⇒ 绿',
    judgeWorkflow(
      `name: w\nenv:\n  ${VAR}: ${EXP}\njobs:\n  apk:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Build release APK\n        run: ./gradlew assembleRelease\n`,
      EXP,
    ).findings.length === 0,
  )
  // ⑧ 注释里提到 gradlew 不算打包步(误报收窄)
  t(
    'S8 注释里的 gradlew 不算打包步',
    judgeWorkflow(
      wrap(`jobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - name: note\n        run: echo "# ./gradlew assembleRelease 见上文"\n`),
      EXP,
    ).findings.length === 0,
  )
  // ⑨ 变量在别的 job ⇒ 红(跨 job 不可见)
  t(
    'S9 变量只挂在另一个 job ⇒ 红',
    judgeWorkflow(
      wrap(`jobs:\n  other:\n    runs-on: ubuntu-latest\n    env:\n      ${VAR}: ${EXP}\n    steps:\n      - name: x\n        run: echo hi\n  apk:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Build release APK\n        run: ./gradlew assembleRelease\n`),
      EXP,
    ).findings.length === 1,
  )
  // ⑩ eas.json 解析失败 ⇒ 未判定(不是绿)
  let und = false
  try {
    expectedBaseFromEas('{ not json')
  } catch (e) {
    und = e instanceof Undetermined
  }
  t('S10 eas.json 非法 ⇒ 抛未判定(不冒绿)', und === true)
  // ⑪ 回退值报数:回环报数、生产域不报
  t(
    'S11 config.ts 回退回环 ⇒ 报数一行',
    (fallbackNote(`const X = process.env.${VAR} || 'http://localhost:8802'`) || '').includes('纵深防御缺口') ===
      true,
  )
  t(
    'S12 config.ts 回退生产域 ⇒ 不报数',
    fallbackNote(`const X = process.env.${VAR} || '${EXP}'`) === null,
  )
  return rows
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    const rows = selfTest()
    for (const r of rows) console.info(`${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : ` — ${r.got}`}`)
    const fail = rows.filter((r) => !r.ok).length
    console.info(`[${GATE}] self-test: pass ${rows.length - fail} / fail ${fail}`)
    return fail === 0 ? 0 : 1
  }
  const FACE_SEL = faceFromArgv(args)
  if (FACE_SEL.error) {
    console.error(`[${GATE}] ❌ 无法判定:${FACE_SEL.error}`)
    return 2
  }
  const face = FACE_SEL.face
  const asJson = args.includes('--json')
  const strict = args.includes('--strict')
  let inputs
  let files
  try {
    files = listWorkflowFiles(ROOT, face)
    inputs = readFaceInputs(ROOT, face, [...files, EAS_FILE, CONFIG_FILE])
  } catch (e) {
    const known = e instanceof Undetermined
    console.error(
      `[${GATE}] 取不到输入(${FACE_TXT[face]})⇒ 无法判定(不记为通过):${known ? e.message : (e?.stack ?? e)}`,
    )
    return 2
  }
  let expected
  let evalError = null
  try {
    expected = expectedBaseFromEas(inputs[EAS_FILE])
  } catch (e) {
    evalError = String(e?.message || e)
  }
  const findings = []
  const notes = []
  let judged = 0
  if (!evalError) {
    for (const rel of files) {
      const r = judgeWorkflow(inputs[rel], expected)
      judged += r.scanned.jobs.filter((j) => j.steps.some((s) => s.release)).length
      for (const f of r.findings) findings.push(`${rel}: ${f}`)
      if (strict) for (const n of r.notes) notes.push(`${rel}: ${n}`)
    }
  }
  const fb = fallbackNote(inputs[CONFIG_FILE])
  const problems = evalError ? [evalError] : findings
  const ok = problems.length === 0
  if (asJson) {
    console.info(JSON.stringify({ gate: GATE, face, ok, judged, problems, fallbackNote: fb }))
    return ok ? 0 : 1
  }
  if (fb) console.info(`  ℹ️ 报数:${fb}`)
  if (strict) for (const n of notes) console.info(`  · ${n}`)
  if (ok) {
    console.info(`[${GATE}] ✅ ${judged} 个 release 打包步的 ${VAR} 均对打包期可见且与 eas.json 一致(取材面:${FACE_TXT[face]})`)
    return 0
  }
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    `  修复(二选一,不得为消红削判据):① 把 ${VAR} 提到 job 级 env(见 .github/workflows/mobile-apk-build.yml 的 jobs.apk.env)或打包步自身的 env,使打包器转换期可见;② 确需换基址时同步改 ${EAS_FILE} 的 build.production.env`,
  )
  console.error(`[${GATE}] Found ${problems.length} 处基址内联缺陷(取材面:${FACE_TXT[face]})`)
  return 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main())

export const __test__ = { judgeWorkflow, scanWorkflow, expectedBaseFromEas, fallbackNote, selfTest, VAR, GATE, EAS_FILE }
