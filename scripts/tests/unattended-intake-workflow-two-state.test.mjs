// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「CI 失败 → 无人值守修复」信源投递 job 的**两态退出语义**回归(2026-09-27 立)。
 *
 * 为什么必须有这把尺子:该 job 原来的语义是"一态"—— 缺配置即 `::error::` + exit 1。
 * 而"这台机还没开通"与"投递真失败"是两类事:前者不可行动,却会造出一台与任何提交都无关的
 * 恒红门(§12e 那条老规矩:恒红门的唯一结局是逼人 `--no-verify`,连带废掉全部守门)。
 * 于是改成两态。**但"改成绿"是极易做过头的方向** —— 放宽时把真失败一起放掉,账面表现是
 * "这个 job 再没红过"。所以本测试不锁措辞,锁**行为**:把 workflow 里那段 `run: |` 的
 * 块标量原样抽出来,用 bash 真跑三态,断言退出码与 stdout/stderr 的形态。
 *
 * 三条正向 + 一条反向对照:
 *  A 两个配置都缺        ⇒ exit 0 且打 `::notice::`,**不得**出现 `::error::`
 *  B 只缺 api 基址        ⇒ exit 0 且点名缺的是 `vars.IHUI_UNATTENDED_INTAKE_API_URL`
 *  C 两项都配了而投递失败 ⇒ **exit 1**(这才是需要无人值守去修的那一类,绝不允许一并降绿)
 *  D 形状锁:超时分支在位、且"200 但未入队"只打 warning 不改退出码(否则态③会爬成真失败)
 *
 * 取材面:`.github/workflows/**` 与被测体一起从 **HEAD blob** 取(口径同守门 70/77/83/98/118)。
 * 本文件是镜像测试,不在提交链里被别的门调用,所以刻意**同时**支持 `--worktree`(仅人工排查 /
 * 本枚提交尚未入库时自验),但默认档必须是 HEAD —— 按磁盘判会让"别人工作树里那份"决定结论。
 * 若 HEAD 里还没有这个 workflow(首次入库前的自测),会显式报"无法判定"而不是静默跳过。
 *
 * 跑法:`node --test scripts/tests/unattended-intake-workflow-two-state.test.mjs`
 *      走磁盘面(仅人工,例:本枚提交尚未入库时自验):
 *      `INTAKE_TEST_FACE=worktree node --test scripts/tests/...`
 *
 * 变异自证(2026-09-27,不是设想):同一份测试在两面上跑 ——
 *  · worktree 面(两态已改)⇒ 7/7 绿;
 *  · **HEAD 面(改前的一态版)⇒ A/B/D/E 四红、C/F/G 三绿**。
 *  红的那四条正是"未开通被当成失败"与"缺超时/缺态③点名",绿的那三条与本笔改动无关 ——
 *  这一红一绿的**分布**就是判据有牙的证明:它只随语义变,不随文件变。
 */

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, describe, it } from 'node:test'

import { gitRaw } from '../lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const WORKFLOW = '.github/workflows/unattended-fix-intake.yml'
const STEP_NAME = 'Sign and POST to existing HMAC webhook route'

// 面旗标走 **env 而不是 argv**:`node --test <file> --worktree` 里那第三个参数不会稳定地进到
// 测试工作进程的 process.argv(node 自己先吞一道),于是"以为在判磁盘、其实判的是 HEAD" ——
// 这种失效的表现恰恰是"用例红了但报告读起来像判据没牙"。argv 仍兼容,但真跑通的是 env 这条路。
const useWorktree = process.env.INTAKE_TEST_FACE === 'worktree' || process.argv.includes('--worktree')

/** 取被审面内容;取不到 ⇒ 抛错(不静默返回空串 —— 空串会让所有断言"没匹配到"看起来像通过)。 */
function readFace(relPath) {
  if (useWorktree) return readFileSync(resolve(ROOT, relPath), 'utf8').replace(/\r\n/g, '\n')
  try {
    return gitRaw(['show', `HEAD:${relPath}`], ROOT, { timeout: 30_000 })
  } catch (e) {
    throw new Error(
      `HEAD 面取不到 ${relPath}(${String(e && e.message ? e.message : e)})⇒ 无法判定。` +
        `首次入库前请用 --worktree 自验。`,
    )
  }
}

/**
 * 抽出 `- name: <STEP_NAME>` 之后那段 `run: |` 块标量的正文(去掉公共缩进)。
 * 刻意不用 YAML 解析器(本机无 js-yaml / pyyaml —— 为一条测试引依赖不值,且引了会在别的机器上漂)。
 * 规则就三条,且每条都有失败出口:找不到步骤名 / 找不到 `run: |` / 正文为空 ⇒ 抛错。
 */
function extractRunBlock(yamlText) {
  const lines = yamlText.replace(/\r\n/g, '\n').split('\n')
  const nameIdx = lines.findIndex((l) => l.trim() === `- name: ${STEP_NAME}`)
  if (nameIdx < 0) throw new Error(`找不到步骤 ${STEP_NAME} ⇒ 判据失效,报错而不是放行`)
  let runIdx = -1
  for (let i = nameIdx + 1; i < lines.length; i++) {
    const l = lines[i]
    if (l.trim() === '') continue
    const indent = l.length - l.trimStart().length
    if (indent <= 4) break // 出了这个 step 的作用域
    if (/^\s*run:\s*\|\s*$/.test(l)) {
      runIdx = i
      break
    }
  }
  if (runIdx < 0) throw new Error(`步骤 ${STEP_NAME} 下找不到 \`run: |\` ⇒ 判据失效`)
  const runIndent = lines[runIdx].length - lines[runIdx].trimStart().length
  const bodyIndent = runIndent + 2
  const body = []
  for (let i = runIdx + 1; i < lines.length; i++) {
    const l = lines[i]
    if (l.trim() === '') {
      body.push('')
      continue
    }
    const indent = l.length - l.trimStart().length
    if (indent < bodyIndent) break
    body.push(l.slice(bodyIndent))
  }
  while (body.length > 0 && body[body.length - 1].trim() === '') body.pop()
  if (body.length === 0) throw new Error('抽出的 run 正文为空 ⇒ 判据失效')
  return body.join('\n') + '\n'
}

/** 真跑抽出来的 shell,返回 {code, out}。env 只给必要项,其余留空以复现"未开通"。 */
function runShell(script, env) {
  const r = spawnSync('bash', ['-c', script], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 90_000,
    windowsHide: true,
    env: {
      ...process.env,
      // 断网兜底:真失败那一态走 127.0.0.1 的拒绝连接,不该被代理改写(有代理时会绕到别处)
      no_proxy: '*',
      NO_PROXY: '*',
      ...env,
    },
  })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, err: r.error }
}

describe(`unattended-fix-intake 两态退出语义(${useWorktree ? 'worktree 面' : 'HEAD 面'})`, () => {
  let shell = ''
  let yaml = ''

  before(() => {
    yaml = readFace(WORKFLOW)
    shell = extractRunBlock(yaml)
  })

  it('A 两个配置都缺 ⇒ exit 0 + ::notice::,且不得出现 ::error::', () => {
    const { code, out } = runShell(shell, { IHUI_INTAKE_SECRET: '', IHUI_INTAKE_BASE_URL: '' })
    if (code !== 0) throw new Error(`未开通应当 exit 0,实得 exit=${String(code)}\n${out}`)
    if (!out.includes('::notice::')) throw new Error(`未开通必须"喊出来"(notice 点名缺哪个键),实得:\n${out}`)
    if (out.includes('::error::')) throw new Error(`"还没开通"不得记成真失败(::error::):\n${out}`)
    if (!out.includes('secrets.IHUI_UNATTENDED_INTAKE_WEBHOOK_SECRET'))
      throw new Error(`notice 没点名缺的是哪一个 secret ⇒ 下一个人无从处置:\n${out}`)
  })

  it('B 只缺 api 基址 ⇒ exit 0 并点名 vars.IHUI_UNATTENDED_INTAKE_API_URL', () => {
    const { code, out } = runShell(shell, {
      IHUI_INTAKE_SECRET: 'a-secret-for-this-test-only',
      IHUI_INTAKE_BASE_URL: '',
    })
    if (code !== 0) throw new Error(`只缺 vars 也属未开通,应 exit 0,实得 exit=${String(code)}\n${out}`)
    if (!out.includes('vars.IHUI_UNATTENDED_INTAKE_API_URL'))
      throw new Error(`未点名缺的是哪个 var ⇒ 报告不可行动:\n${out}`)
  })

  it('C 两项都配了而投递真失败 ⇒ 仍然红(这条是整个两态设计的存在理由)', () => {
    // 127.0.0.1:9 (discard) 上没有监听 ⇒ ECONNREFUSED,快速失败、不等超时
    const { code, out, err } = runShell(shell, {
      IHUI_INTAKE_SECRET: 'a-secret-for-this-test-only',
      IHUI_INTAKE_BASE_URL: 'http://127.0.0.1:9',
      INTAKE_KIND: 'ci_failed',
      INTAKE_REPO: 'IHUI-INF-AI/IHUI-AI',
    })
    if (err) throw new Error(`bash/node 派生失败,这一态无法判定(不是通过):${String(err.message)}`)
    if (code !== 1) throw new Error(`已配置而投递失败必须 exit 1,实得 exit=${String(code)}\n${out}`)
    if (!out.includes('intake delivery failed')) throw new Error(`真失败必须留可诊断痕迹:\n${out}`)
  })

  it('D 形状锁:超时分支在位;"已送达但未入队"只打 warning,不改退出码', () => {
    if (!/AbortSignal\.timeout\(/.test(shell))
      throw new Error('缺 AbortSignal.timeout ⇒ 挂住的连接会被拖到 GitHub 的 6h 上限,账面表现为"再没红过"')
    if (!/accepted\s*!==\s*true/.test(shell))
      throw new Error('缺"200 但未入队"的点名分支 ⇒ 态③(github-webhook.ts 的 no_matching_trigger)会静默')
    // 态③ 的分支里只许 console.log(::warning::),不许出现 process.exit(1)
    const warnBlock = shell.slice(shell.indexOf('accepted !== true'))
    const firstBranch = warnBlock.slice(0, warnBlock.indexOf('} catch'))
    if (/process\.exit\(/.test(firstBranch))
      throw new Error('态③ 被写成了改退出码 ⇒ "没入队"会爬成真失败,与 §5e 的边界混起来')
    if (!/::warning::/.test(firstBranch)) throw new Error('态③ 不打 ::warning:: ⇒ 静默')
  })

  it('E 反向对照:C 的判据不是恒红 —— 把真失败换成"未开通"必须立刻变绿', () => {
    // 与 A 同一函数、同一 env 面,只是缺配置 ⇒ 若本门把未开通也判红,说明两态没分开
    const { code } = runShell(shell, { IHUI_INTAKE_SECRET: '', IHUI_INTAKE_BASE_URL: '' })
    if (code !== 0) throw new Error(`A/C 用了不同判据 ⇒ 两态没有真正分开(未开通又被打红了)`)
  })

  it('F workflow 与 shell 都还带着溯源横幅(新写/改写的跟踪文件不得裸奔)', () => {
    if (!yaml.includes('Provenance-watermarked.')) throw new Error('workflow 缺 L1 横幅')
    if (!yaml.includes('[IHUI-AI-PROVENANCE]:')) throw new Error('workflow 缺 L2 载荷')
  })

  it('G 抽取器自身有牙:找不到步骤名/找不到 run 块时必须抛错而不是交出空串', () => {
    let threwA = false
    try {
      extractRunBlock('name: x\njobs:\n  y:\n    steps:\n      - name: 别的步骤\n        run: echo hi\n')
    } catch {
      threwA = true
    }
    if (!threwA) throw new Error('抽取器在"找不到被测步骤"时静默 ⇒ 整门会拿空 body 断言,恒真即恒绿')
    let threwB = false
    try {
      extractRunBlock(`name: x\njobs:\n  y:\n    steps:\n      - name: ${STEP_NAME}\n        env:\n          A: b\n      - name: next\n`)
    } catch {
      threwB = true
    }
    if (!threwB) throw new Error('抽取器在"该步骤没有 run: |"时静默 ⇒ 同上')
  })
})

after(() => {
  // 只在 HEAD 面档下提醒一次:本文件读的是提交树,新写的 workflow 改动必须先入库才被判到
  if (!useWorktree) return
  console.info('[note] 本次跑的是磁盘面(仅人工);提交链与 CI 判的是 HEAD 面。')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
