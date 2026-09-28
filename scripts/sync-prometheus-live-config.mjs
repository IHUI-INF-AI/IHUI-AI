#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 把仓库里的 prometheus 抓取配置派生到部署机的运行副本,并让运行副本的 rule_files
 * 直接指回仓库那份 alerts.yml —— 于是**告警规则只剩一份**,抓取目标也只剩一份真相。
 *
 * 立因(2026-09-27 运维覆盖缺口审计 + 本次现量):
 *   部署机读 D:\DevEnv\monitor\prometheus\ 下一份手抄副本(那个盘符是**部署机当次实测值**,
 *   本机落点一律由下面的共用出口推导,不得照抄),而那份副本
 *   ① 少了 alertmanager / alertbridge 两个 job ⇒ `AlertmanagerDown` / `AlertBridgeDown`
 *      这两条"检测运维告警链是否断裂"的规则里 up{job=...} 序列**根本不存在**,
 *      `== 0` 恒不成立 ⇒ 邮件链路死了也不会响,一条永远不会响的告警比没有告警更危险;
 *   ② 仓库那份 alerts.yml 带着两条 Prometheus 3.x 不认的 `disabled:` 字段,
 *      promtool 拒绝整份文件 ⇒ 一旦有人把线上指到仓库这份,12 条规则一起不加载。
 *   两侧因此"各自能跑、合起来从没跑过",而账面(promtool 单测一份 / 线上有 12 条规则)看着全绿。
 *
 * 规矩:运行副本一律是**派生态**,禁止手改。要改抓取目标/规则,改仓库那份再跑本脚本。
 * 幂等:内容已一致时不改字节、不产生写入。
 *
 * 用法:
 *   node scripts/sync-prometheus-live-config.mjs            # 检查并写回(默认动作)
 *   node scripts/sync-prometheus-live-config.mjs --check     # 零副作用,只报会改什么
 *   node scripts/sync-prometheus-live-config.mjs --live-dir <目录>
 *   node scripts/sync-prometheus-live-config.mjs --reload    # 写回后 POST /-/reload 让线上生效
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
// DevEnv 根的唯一出口(§15b;`re-home-junctions.mjs` / `check-c-drive-pollution.mjs` /
// `pg-restore-drill.mjs` 复用同一份)。**不再**由本文件自取工作树盘符首字符拼 `X:\DevEnv`:
// 那是同一件事的第三份独立实现 —— 它碰巧与工作树深度无关,但"碰巧对"不等于"按同一个出口推"。
// 未设 `IHUI_DEVENV_ROOT` 时两者逐字同值(本机同为 `G:\DevEnv\monitor\prometheus`)。
import { devEnvRoot } from './seal-c-root-stray.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_DIR = join(ROOT, 'monitoring', 'prometheus')
const RULES_IN_REPO = join(REPO_DIR, 'alerts.yml')
const CONFIG_SRC = join(REPO_DIR, 'prometheus.yml')

// 部署机运行副本的候选落点:盘符按当次实测取(§5b/§15b 不得把另一台机的现状当本机事实),
// 而推导只许有一份 —— 走上面的共用出口。
const CANDIDATE_LIVE_DIRS = [join(devEnvRoot(), 'monitor', 'prometheus')]
const DEFAULT_RELOAD_URL = 'http://127.0.0.1:8815/-/reload'

function parseArgs(argv) {
  const out = { check: false, reload: false, liveDir: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--check') out.check = true
    else if (a === '--reload') out.reload = true
    else if (a === '--live-dir') out.liveDir = argv[++i]
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

/**
 * 把仓库配置改写成运行副本形态:
 * 只替换 rule_files 列表为仓库 alerts.yml 的绝对路径,其余逐字保留。
 * 导出为纯函数,使"改写是否只动了那一处"可被构造面证明,而不必真去改生产文件。
 */
export function deriveLiveConfig(srcYaml, repoRulesPath) {
  const abs = repoRulesPath.replace(/\\/g, '\\')
  // 占位符守卫:本派生器"逐字搬",曾经把仓库里一行 `password: __REPLACE_WITH_DEPLOY_SECRET__`
  // 原样烘进线上抓取配置 ⇒ 带占位符当口令去访问启用 basic_auth 的 exporter ⇒ 恒 401,
  // 而主机磁盘/内存告警长期哑、账面全绿。派生器只搬不看内容,就是这一型的成因。
  // 口令的正确写法只有一种:password_file 指仓库外那份 secret(文件里是凭据,不是路径,不入库)。
  // ⚠ 扫描面必须先剥掉整行注释 —— 本文件头注里就**引用**了那句占位符来讲这段历史,
  //   不剥注释的话守卫会把"描述缺陷的散文"判成缺陷本身(守门 131/70 同型自咬,本会话实测踩到一次)。
  const scannable = srcYaml
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')
  const placeholder = scannable.match(/(?:password|passwd|secret|token|api_?key)\s*:\s*['"]?(__[A-Z0-9_]+__|CHANGEME|REPLACE[_A-Z]*|TBD|your[-_][A-Za-z0-9_-]*)/i)
  if (placeholder) {
    throw new Error(
      `拒绝派生:配置里有占位符凭据 —— ${placeholder[0].trim()}\n` +
        '  派生器会把它逐字送进线上配置(2026-09-27 实测这样把 windows_exporter 抓成恒 401)。' +
        '  改成 password_file: <仓库外 secret 文件路径>,该文件里放真凭据、不入仓。',
    )
  }
  const lines = srcYaml.split(/\r?\n/)
  const out = []
  let inBlock = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^rule_files:\s*$/.test(line)) {
      inBlock = true
      out.push(line, `  - '${abs}'`)
      continue
    }
    if (inBlock) {
      if (/^\s*-\s/.test(line)) continue // 吃掉原列表项
      inBlock = false
    }
    out.push(line)
  }
  if (!out.some((l) => l.includes(abs))) throw new Error('prometheus.yml 里找不到 rule_files: 段 —— 拒绝产出一份没有规则的文件')
  return out.join('\n') + (srcYaml.endsWith('\n') ? '\n' : '')
}

function findLiveDir(override) {
  const cands = override ? [override] : CANDIDATE_LIVE_DIRS
  for (const c of cands) if (existsSync(join(c, 'prometheus.yml'))) return c
  return null
}

export const __test__ = { parseArgs, findLiveDir, deriveLiveConfig, ROOT, REPO_DIR, CONFIG_SRC, RULES_IN_REPO, CANDIDATE_LIVE_DIRS }

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.info('用法: node scripts/sync-prometheus-live-config.mjs [--check|--reload|--live-dir <目录>]')
    return 0
  }
  if (!existsSync(CONFIG_SRC)) {
    console.error('❌ 仓库源不在位:' + CONFIG_SRC)
    return 2
  }
  const liveDir = findLiveDir(args.liveDir)
  if (!liveDir) {
    // 取不到 = 无法判定,绝不静默"通过"(本仓口径:把没判写成判过了是最高频失效型)
    console.error('⚠️ 未判定:找不到部署机的 prometheus 运行副本目录(试过:' + CANDIDATE_LIVE_DIRS.join(', ') + ')')
    console.error('   本机若不是部署机,这一格按设计不适用;若确实是部署机,先确认 D:\\DevEnv\\monitor\\prometheus 在位')
    return 2
  }
  const liveConfig = join(liveDir, 'prometheus.yml')
  const want = deriveLiveConfig(readFileSync(CONFIG_SRC, 'utf8'), RULES_IN_REPO)
  const have = existsSync(liveConfig) ? readFileSync(liveConfig, 'utf8') : ''

  if (have.replace(/\r\n/g, '\n') === want.replace(/\r\n/g, '\n')) {
    console.info('✅ 运行副本已与仓库源同值(未写盘)  ' + liveConfig)
  } else if (args.check) {
    console.info('⚠️ 运行副本落后于仓库源(--check 模式不写盘):' + liveConfig)
    const jobsOf = (t) => [...t.matchAll(/job_name:\s*'?([A-Za-z0-9_-]+)'?/g)].map((m) => m[1])
    const missing = [...new Set(jobsOf(want))].filter((j) => !jobsOf(have).includes(j))
    const extra = [...new Set(jobsOf(have))].filter((j) => !jobsOf(want).includes(j))
    if (missing.length) console.info('   线上缺的抓取 job:' + missing.join(', ') + '  ⇒ 依赖这些 job 的 Down 类告警恒不成立')
    if (extra.length) console.info('   线上多出的抓取 job:' + extra.join(', '))
    return 1
  } else {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    if (have) {
      mkdirSync(join(liveDir, 'pre-sync-backups'), { recursive: true })
      renameSync(liveConfig, join(liveDir, 'pre-sync-backups', `prometheus.yml.${stamp}`))
    }
    writeFileSync(liveConfig, want, 'utf8')
    console.info('✅ 已按仓库源重写运行副本(旧副本存于 pre-sync-backups/prometheus.yml.' + stamp + ')')
  }

  if (args.reload) {
    // 热加载而非重启服务:失败时 prometheus 保留上一份好配置继续跑,不会把监控打断
    try {
      const code = execFileSync(
        'curl.exe',
        [
          '-s',
          '-o',
          process.platform === 'win32' ? 'NUL' : '/dev/null',
          '-w',
          '%{http_code}',
          '--max-time',
          '10',
          '-X',
          'POST',
          DEFAULT_RELOAD_URL,
        ],
        { windowsHide: true, encoding: 'utf8', timeout: 20000 },
      )
        .toString()
        .trim()
      if (code === '200') console.info('✅ 已通知线上热加载(POST /-/reload = 200)')
      else console.warn(`⚠️ 热加载返回 ${code || '空'} —— 复跑 --check 核配置,必要时人工重启该服务`)
    } catch (e) {
      console.error('⚠️ 热加载调用失败(不影响配置文件已写回):' + String(e && e.message ? e.message : e).slice(0, 160))
    }
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // 判据拒绝(占位符/缺 rule_files)必须是**一条结论 + 退出码 1**,不是一段栈 ——
  // 栈会被调用方读成"脚本坏了",而它其实是"拦下了一次会把占位符送进生产的派生"。
  try {
    process.exitCode = main()
  } catch (e) {
    console.error('❌ ' + String((e && e.message) || e))
    process.exitCode = 1
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
