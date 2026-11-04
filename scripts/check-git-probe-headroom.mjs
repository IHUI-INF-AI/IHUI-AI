#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-git-probe-headroom.mjs —— git status 到应用探测预算之间的余量尺
 *
 * 立因(2026-11-04 实测):Qoder Desktop 的 GitRepository 探测以硬超时 5000ms 跑
 * `git status`,本机退化到 5104~6467ms ⇒ 连续 12 次 failureKind=timeout;超时后强杀子进程
 * 的清理又失败(GIT_PROCESS_CLEANUP_FAILED / cleanupBlockedScope=cwd),此后该工作区每次
 * git 读都以 durationMs=0 直接失败,用户侧表现为「git 状态总是获取不到」。上游真因是
 * promtail 给 2.6 万个轮转日志副本各挂一个常驻 tailer(files_active=4531、goroutines=22722,
 * 单进程 390.9% CPU ≈ 4/20 核)把 CPU 顶穿。修完采集面后 status 回到 1468~2226ms。
 *
 * 这道尺子的职责不是再抓一次 promtail,而是**量余量本身**:任何把 status 拖到预算线附近的
 * 东西(采集面、构建、备份、别的席位)都该在"用户看见坏"之前先响。
 *
 * 档位:判**机器状态** ⇒ **刻意不进提交链**(§12e 恒红门禁令:提交者结构上满足不了"这台机
 * 此刻的 CPU 有余量";补 README 撞门 173 活性声明开放集合、补 AGENTS 撞门 207 体积预算,
 * 挂 blocking 只会把上一席的负载定责给下一席)。
 * 调度 = `git-guardian.mjs` 的 `sweepGitProbeHeadroom()`(main 单轮 + daemon tick 双挂点)。
 * 退出码:0=ok / 1=drift / 2=unjudged(取不到输入 ⇒ 不记绿也不冒红,§0.3)。
 *
 * 阈值一律标出处,不自拍:
 *   - 预算线 5000ms 来自应用侧观测(timeoutMs:5000),不是本尺的判据;
 *   - 报警线 3500ms = 健康档实测上界(2226)与病害档下界(5104)之间,并对 5000 留 30% 余量;
 *   - tailer 线 = 活日志文件数 × 2(实测健康 40/40、病害 4531/40=113 倍,×2 两者都够远)。
 *
 * 第三维 monitor-trust 是给本机 2026-11-04 开的两档加速兜底的:
 *   `core.fsmonitor=true` + `core.untrackedCache=true`(写在活 gitdir 的 config 里,不入仓、
 *   换机即丢)。实测效果:`index;preload` 的 lstat 从 19064 掉到 2333、阶段自身耗时 2130ms→101ms,
 *   `git status` 墙钟 1284ms。省下的每一次 lstat 都是"少看一眼磁盘",而**漏报比慢更糟** ——
 *   真漏一次,面板与门 281(全工作树口径)就一起拿着假净账跑,且没有任何判据会响。
 *   所以本维不看速度,只看同一时刻"带缓存的面"与"关掉缓存全量扫描的面"是否逐字相同。
 *   启用前后已验:新建单文件/新建目录/删除 各 5 轮全部立刻可见;linked worktree
 *   add→remove --force→prune 未被 daemon 句柄挡住(注册表 4→3 回落)。
 *
 * 用法:node scripts/check-git-probe-headroom.mjs [--json] [--self-test] [--samples N]
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { devEnvArtifactRoot } from './seal-c-root-stray.mjs'
import { gitBinary } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const BUDGET_MS = 5000
export const WARN_MS = 3500
export const DEFAULT_SAMPLES = 3
export const PRIME_CMD = 'git update-index --untracked-cache'
export const PROMTAIL_METRICS_URL = 'http://127.0.0.1:9080/metrics'
/** 活日志目录:本机是半搬迁态,落点一律问共用出口(与 prune-rotated-nssm-logs 同一条路,§22c) */
export const LOG_DIR = join(devEnvArtifactRoot('logs'), 'logs')
/** 轮转副本形态:组件名后紧跟 nssm 时间戳(活文件名里没有这一段) */
export const ROTATION_RE = /-nssm(-err)?-20\d{6}T[\d.]+\.log$/
/** 活文件形态:svc-<组件>-nssm.log / svc-<组件>-nssm-err.log */
export const LIVE_RE = /^svc-[A-Za-z0-9_.-]+-nssm(-err)?\.log$/

/** 与消费者(Qoder)同形态的命令;返回每次墙钟毫秒,跑不成返回 null */
export function sampleStatusMs(repoRoot, n = DEFAULT_SAMPLES, opts = {}, spawn = spawnSync) {
  const args = opts.uno
    ? ['status', '--porcelain=v1', '-z', '--untracked-files=no']
    : ['status', '--porcelain=v1', '-z', '--untracked-files=all']
  const out = []
  for (let i = 0; i < n; i++) {
    const t = Date.now()
    const r = spawn(gitBinary(), args, {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (r.error || r.status !== 0)
      return {
        samples: out,
        failed: true,
        why: r.error ? String(r.error.message) : `git status rc=${r.status}`,
      }
    out.push(Date.now() - t)
  }
  return { samples: out, failed: false, why: '' }
}

/**
 * 取一份 status 的输出面;disableMonitor=true 时把两档缓存一起关掉,得到"全量扫描"的真相面。
 * 两侧同命令同参数,只差缓存 —— 否则对账就是在比两件不同的事。
 */
export function statusFace(repoRoot, disableMonitor, spawn = spawnSync) {
  const pre = disableMonitor
    ? ['-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false']
    : []
  const r = spawn(gitBinary(), [...pre, 'status', '--porcelain=v1', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.error || r.status !== 0)
    return {
      failed: true,
      why: r.error ? String(r.error.message) : `git status rc=${r.status}`,
      out: null,
    }
  return { failed: false, why: '', out: r.stdout || '' }
}

/**
 * 索引实际落点(本仓 `.git` 是 gitfile、活 gitdir 在工作树外 ⇒ 绝不能拼 `<repo>/.git/index`)。
 * 一律问 `git rev-parse --git-path index`,取不到就是未判定。
 */
export function gitIndexPath(repoRoot, spawn = spawnSync) {
  const r = spawn(gitBinary(), ['rev-parse', '--git-path', 'index'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const p = String(r.stdout || '').trim()
  if (r.status !== 0 || !p) return null
  return resolve(repoRoot, p)
}

/** 布尔型 config 读取:未设置/取不到一律 false 或由调用方按 null 处理,不猜 */
export function cfgFlag(name, repoRoot, spawn = spawnSync) {
  const r = spawn(gitBinary(), ['config', '--get', name], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const v = String(r.stdout || '').trim()
  return v === 'true' ? true : v === 'false' ? false : null
}

/** 配置读取:取不到一律按"未启用"处理,不当成错误(本维据此不判) */
export function isMonitorEnabled(repoRoot, spawn = spawnSync) {
  const r = spawn(gitBinary(), ['config', '--get', 'core.fsmonitor'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return (r.stdout || '').trim() === 'true'
}

export function judgeLatency({ samples, failed, why, warnMs = WARN_MS, budgetMs = BUDGET_MS }) {
  if (failed || !Array.isArray(samples) || samples.length === 0)
    return {
      dim: 'status-latency',
      state: 'unjudged',
      readout: `取不到 status 耗时(${why || '样本为空'})`,
      next: '先确认 git 可执行与仓库根可达;不记绿也不冒红',
    }
  const max = Math.max(...samples)
  const med = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)]
  const headroom = budgetMs - max
  const readout = `样本 ${samples.join('/')}ms · 中位 ${med} · 最大 ${max} · 距预算 ${budgetMs} 还剩 ${headroom}ms`
  if (max >= warnMs)
    return {
      dim: 'status-latency',
      state: 'drift',
      readout: readout + ` —— 报警线 ${warnMs} 已到,再涨就撞消费者的 ${budgetMs}ms 硬超时`,
      next: `按本次另一维点名嫌疑:采集面看 promtail tailer 数;整机在等看同时段 CPU 大户与构建/备份窗口`,
    }
  return { dim: 'status-latency', state: 'ok', readout, next: '' }
}

/** 从 promtail /metrics 文本里取一个标量 gauge(取不到返回 null,不猜 0) */
export function parseGauge(text, name) {
  if (!text) return null
  const m = String(text).match(new RegExp('^' + name.replace(/[.]/g, '\\.') + '\\s+(\\d+)$', 'm'))
  return m ? Number(m[1]) : null
}

/** 数活日志文件与轮转副本(枚举到 0 由调用方判未判定,不当"没有") */
export function countLogFaces(dir, liveRe = LIVE_RE, rotRe = ROTATION_RE) {
  let names
  try {
    names = readdirSync(dir)
  } catch (e) {
    return { ok: false, why: `读不到日志目录 ${dir}:${e.message}`, live: 0, rotations: 0 }
  }
  const live = names.filter((n) => liveRe.test(n)).length
  const rotations = names.filter((n) => rotRe.test(n)).length
  return { ok: true, why: '', live, rotations, total: names.length }
}

export function judgeCollectors({ metricsText, faces, tailers = null, goroutines = null }) {
  if (!faces.ok)
    return {
      dim: 'collector-tailers',
      state: 'unjudged',
      readout: `活文件基线取不到(${faces.why})`,
      next: '核对本机日志目录落点;取不到不判',
    }
  if (faces.live === 0)
    return {
      dim: 'collector-tailers',
      state: 'unjudged',
      readout: '活日志文件枚举到 0 个 ⇒ 判死,不记绿(§0.3)',
      next: '服务是否在写日志?先修可观测面再谈阈值',
    }
  const line = faces.live * 2
  const m = metricsText === null || metricsText === undefined
  if (m || tailers === null)
    return {
      dim: 'collector-tailers',
      state: 'unjudged',
      readout: `promtail 指标取不到(url 不可达或未导出 files_active_total),活文件基线 = ${faces.live}`,
      next: '服务停了本身就是一种病害,但本尺不把"读不到"说成"没问题"',
    }
  const rot = faces.rotations
  const readout = `tailers=${tailers} 活文件=${faces.live} 报警线=${line} 轮转副本积压=${rot}${goroutines === null ? '' : ` goroutines=${goroutines}`}`
  if (tailers > line)
    return {
      dim: 'collector-tailers',
      state: 'drift',
      readout: readout + ` —— 采集面把历史副本挂成了常驻 tailer 空转轮询`,
      next: `收窄 __path__ 或加 __path_exclude__ 只排轮转副本(形态名里必带年份、活文件名不带);副本本身仍在磁盘,本尺不删`,
    }
  return { dim: 'collector-tailers', state: 'ok', readout, next: '' }
}

/**
 * 监控面可信度:fsmonitor / untracked cache 每省下一次 lstat,代价就是"少看一眼磁盘"。
 * 漏报比慢更糟 —— 所以本维不看速度,只看**同一时刻**监控面与全量扫描面是否逐字一致。
 * 不一致 ⇒ 缓存在对着一份已经不存在的事实说话(事件丢失/token 腐烂),当场 drift 并给关回出口。
 * 未启用 fsmonitor 时本维不判(report):"慢"已由 status-latency 兜住,不该为配置选择再造一枚红。
 */
export function judgeMonitorTrust({ enabled, monitorOut, fullOut, failed, why }) {
  if (!enabled)
    return {
      dim: 'monitor-trust',
      state: 'report',
      readout: 'core.fsmonitor 未启用 ⇒ 本维无从判(慢由 status-latency 兜)',
      next: '',
    }
  if (failed || monitorOut === null || fullOut === null)
    return {
      dim: 'monitor-trust',
      state: 'unjudged',
      readout: `两侧取不到(${why || '未知'})`,
      next: '先确认 git 可执行与仓库根可达;取不到不判',
    }
  const a = String(monitorOut).split('\0').filter(Boolean)
  const b = String(fullOut).split('\0').filter(Boolean)
  const same = a.length === b.length && a.every((l, i) => l === b[i])
  if (same)
    return {
      dim: 'monitor-trust',
      state: 'ok',
      readout: `监控面与全量扫描面逐字一致(${a.length} 条)`,
      next: '',
    }
  const missing = b.filter((l) => !a.includes(l))
  const extra = a.filter((l) => !b.includes(l))
  return {
    dim: 'monitor-trust',
    state: 'drift',
    readout: `监控面比全量少 ${missing.length} 条 / 多 ${extra.length} 条 —— 缓存正对着一份已不成立的账面`,
    next:
      '第一步做 token 重建(不是关档):`git fsmonitor--daemon stop` 后跑一次 `git status` —— 本机 2026-11-04 实测面等值当场恢复(少 1 条 `?? scripts/tests/check-dead-script-refs.test.mjs` → 少 0 多 0)。' +
      '仍不一致才关回:`git config --unset core.fsmonitor` + `git config --unset core.untrackedCache`。' +
      '**关之前先量**:本机三臂对照实测只关 fsmonitor 时 status 墙钟 5.7~6.2s,已超消费者 5000ms 预算 ⇒ 会复活「git 状态总是取不到」这一原始故障;漏报要治,但把加速整个关掉是把病换成死。',
    missing: missing.slice(0, 6),
    extra: extra.slice(0, 6),
  }
}

/**
 * 读索引扩展块名(**倒着按块走,不按窗口扫子串**)。
 * 立因(2026-11-04 自伤实测):本机索引 2,397,366 字节,UNTR 块负载约 131KB 且写在 FSMN **之前**,
 * 旧实现只看文件末 64KB ⇒ 扫不到 UNTR ⇒ 把"其实生效"喊成 drift。天天假红 = 把真红一起废掉(§12e)。
 * 块格式:`签名(4) + 长度(4) + 负载(长度)`,最后一个块尾对齐 = 文件末 - 20(末 20 字节是索引校验和);
 * 靠这个等式倒着剥,剥不动就停(落在条目区),绝不靠"文件里出现过这四个字节"来判存在。
 */
export function readIndexExtensions(indexPath) {
  try {
    const b = readFileSync(indexPath)
    if (b.length < 32 || b.subarray(0, 4).toString('latin1') !== 'DIRC')
      return { ok: false, why: `索引头不是 DIRC(${indexPath})`, names: [], hasFSMN: false, hasUNTR: false }
    const names = []
    let end = b.length - 20
    for (let hop = 0; hop < 16; hop++) {
      let found = -1
      for (let off = 8; off <= Math.min(end - 8, 262_144); off++) {
        const o = end - 8 - off
        if (o < 12) break
        const size = b.readUInt32BE(o + 4)
        if (size !== off || o + 8 + size !== end) continue
        const sig = b.subarray(o, o + 4).toString('latin1')
        // 结构等式会被**负载里的数字串**偶然满足(本机实测 '973\0' 在 off=388 撞等式)
        // ⇒ 签名不是四个字母就继续往前找,不能在此 break(那样会把"扩展明明在"读成"剥不动")
        if (!/^[A-Za-z]{4}$/.test(sig)) continue
        found = o
        names.push(sig)
        break
      }
      if (found < 0) break
      end = found
    }
    return {
      ok: names.length > 0,
      why: names.length ? '' : '倒着剥不出任何扩展块(该索引没写扩展,或结构不是已知形态)',
      names,
      hasFSMN: names.includes('FSMN'),
      hasUNTR: names.includes('UNTR'),
      entries: b.readUInt32BE(8),
      bytes: b.length,
    }
  } catch (e) {
    return { ok: false, why: `读不到索引(${e.message.slice(0, 60)})`, names: [], hasFSMN: false, hasUNTR: false }
  }
}

/**
 * 第二路读数:直接问 git 自己 —— `git update-index --test-untracked-cache` 退 0 才算缓存真可用。
 * 它要拿 `index.lock`,本机多席位常态争用 ⇒ 拿不到锁 rc≠0 **不是**缓存坏了,一律记「取不到」不记「掉」(§0.3)。
 */
export function untrackedCacheSelfTest(repoRoot, spawn = spawnSync) {
  const r = spawn(gitBinary(), ['update-index', '--test-untracked-cache'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.error) return { ok: false, inUse: null, why: String(r.error.message).slice(0, 70) }
  const err = String(r.stderr || '')
  if (/unable to lock index|index\.lock/i.test(err)) return { ok: false, inUse: null, why: '拿不到 index.lock(多席位争用)' }
  if (r.signal) return { ok: false, inUse: null, why: `被信号 ${r.signal} 打断` }
  if (typeof r.status !== 'number') return { ok: false, inUse: null, why: '取不到退出码' }
  return { ok: true, inUse: r.status === 0, why: r.status === 0 ? '' : `rc=${r.status}` }
}

/**
 * 第四维:加速档是否**真的还在生效**。 * 立因(2026-11-04 实测):本机多席位会整份替换索引(isolated-git / object-space-land /
 * read-tree 那几条通道写出来的临时索引不带这两枚扩展),把 FSMN/UNTR 抹掉;
 * 而 git 只在"索引内容有变"时才写回 ⇒ `git status` 连跑 5 次也**不会自愈**,
 * `preload/sum_lstat` 直接回到全量 19033(生效时是 2333)。
 * 静默退化比不装更坏:账面写着"已启用 fsmonitor",实际每次都在全量扫。
 * 两路读数(块面 + git 自测)互相不一致时判「未判定」而不是挑一个信。
 */
export function judgeExtensions({ monitorEnabled, untrackedEnabled, index, selfTest = null, primeCmd = PRIME_CMD }) {
  if (!monitorEnabled && !untrackedEnabled)
    return { dim: 'accel-live', state: 'report', readout: '两档加速均未启用 ⇒ 无需核(全量扫描由 status-latency 量)', next: '' }
  if (!index.ok) return { dim: 'accel-live', state: 'unjudged', readout: `索引扩展读不到:${index.why}`, next: '先确认 gitdir 可达;取不到不判' }
  const at = `FSMN=${index.hasFSMN ? '在' : '掉'} UNTR=${index.hasUNTR ? '在' : '掉'}`
  const selfTxt = selfTest && selfTest.ok ? `git 自测=${selfTest.inUse ? '通过' : '不通过'}` : 'git 自测未取到'
  const blockTxt = (Array.isArray(index.names) ? index.names : []).join('/') || '无'
  if (untrackedEnabled && index.hasUNTR && selfTest && selfTest.ok && !selfTest.inUse)
    return {
      dim: 'accel-live',
      state: 'drift',
      readout: `${at}(${selfTxt}:缓存块在而 git 自己说它不成立;块 ${blockTxt},条目 ${index.entries})⇒ 每次 status 仍走全量扫目录`,
      next: `重新 prime:${primeCmd}(会被别席整份换索引再抹一次;反复掉就说明该在这台机关掉这两档,而不是反复补)`,
    }
  const want = []
  if (monitorEnabled && !index.hasFSMN) want.push('FSMN(fsmonitor token)')
  if (untrackedEnabled && !index.hasUNTR) want.push('UNTR(untracked cache)')
  if (want.length) {
    if (untrackedEnabled && !index.hasUNTR && selfTest && selfTest.ok && selfTest.inUse)
      return {
        dim: 'accel-live',
        state: 'unjudged',
        readout: `两路读数不一致:块面说缺 ${want.join(' 与 ')}(${at}),而 git 自测说缓存在用(${selfTxt})⇒ 不挑一个信`,
        next: '先复核读法(块面按扩展块倒剥 / 自测按退出码),再谈改判据',
      }
    return {
      dim: 'accel-live',
      state: 'drift',
      readout: `config 说开着,索引里却缺 ${want.join(' 与 ')}(${at};块 ${blockTxt};${selfTxt};条目 ${index.entries})⇒ 每次 status 仍在 ${index.hasFSMN ? '全量 stat + ' : ''}全量扫目录,加速已失效`,
      next: `重新 prime:${primeCmd}(会被别席整份换索引再抹一次;反复掉就说明该在这台机关掉这两档,而不是反复补)`,
    }
  }
  return { dim: 'accel-live', state: 'ok', readout: `${at} 与 config 同事实存(${selfTxt};块 ${blockTxt})⇒ 加速在生效`, next: '' }
}

/**
 * 报告维:把"扫描面变宽"与"整机在等"分开 —— -uno 与默认档同批采样。
 * 刻意不参与定级:比值高低都不是"谁该动手"的判据,只做归因证据。
 */
export function judgeWalkShare({ oneNo, full }) {
  if (
    !oneNo ||
    oneNo.failed ||
    !full ||
    full.failed ||
    !oneNo.samples.length ||
    !full.samples.length
  )
    return { dim: 'untracked-walk-share', state: 'report', readout: '未采到(不参与定级)', next: '' }
  const a = Math.max(...oneNo.samples)
  const b = Math.max(...full.samples)
  const share = b > 0 ? Math.round((100 * (b - a)) / b) : 0
  return {
    dim: 'untracked-walk-share',
    state: 'report',
    readout: `-uno 最大 ${a}ms / 默认最大 ${b}ms ⇒ 未跟踪扫描占 ${share}%(报告维,不定级)`,
    next: '',
  }
}

/** 稳定身份:只取类别+各维态+计数,绝不掺时刻/sha/明细(§5e-3、门 224 同族) */
export function alertIdentity(dims) {
  const st = (n) => (dims.find((d) => d.dim === n) || { state: 'missing' }).state
  const s = aggregate(dims).state
  return `git-probe-headroom:${s}:latency=${st('status-latency')}:collectors=${st('collector-tailers')}:trust=${st('monitor-trust')}:accel=${st('accel-live')}`
}

export function aggregate(dims) {
  const breach = dims.filter((d) => d.state === 'drift')
  const unjudged = dims.filter((d) => d.state === 'unjudged')
  const state = breach.length ? 'drift' : unjudged.length ? 'unjudged' : 'ok'
  const summary = `breach=${breach.length} unjudged=${unjudged.length} 判定维=${dims.filter((d) => d.state !== 'report').length}`
  return { state, summary, breach, unjudged }
}

// ── 自检:每档成对夹具 + 摘掉新字段即翻红的反向锁 ─────────────────────────
async function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, fn) => {
    try {
      fn()
      pass++
      console.log(`  ✓ ${name}`)
    } catch (e) {
      fail++
      console.log(`  ✗ ${name} :: ${e.message}`)
    }
  }
  const eq = (got, want, what) => {
    if (got !== want) throw new Error(`${what}: 期望 ${want},实得 ${got}`)
  }

  t('S1 健康档判绿(实测 1468~2226ms)', () => {
    eq(judgeLatency({ samples: [1468, 2226, 1575], failed: false, why: '' }).state, 'ok', 'state')
  })
  t('S2 报警线以上判 drift(实测 5104~6467ms)', () => {
    eq(
      judgeLatency({ samples: [5104, 6467, 5385], failed: false, why: '' }).state,
      'drift',
      'state',
    )
  })
  t('S3 卡在两条线之间判 drift(3500 是线)', () => {
    eq(
      judgeLatency({ samples: [3000, 3501, 3499], failed: false, why: '' }).state,
      'drift',
      'state',
    )
    eq(
      judgeLatency({ samples: [3499, 3498, 3000], failed: false, why: '' }).state,
      'ok',
      '边界以下仍绿',
    )
  })
  t('S4 git 跑不成 ⇒ unjudged,不记绿也不冒红', () => {
    eq(judgeLatency({ samples: [], failed: true, why: 'rc=128' }).state, 'unjudged', 'state')
    eq(judgeLatency({ samples: [10], failed: false, why: '' }).state, 'ok', '有样本才判')
  })
  t('S5 tailer 成对:修好 40/40 判绿,坏时 4531/40 判红', () => {
    const faces = { ok: true, why: '', live: 40, rotations: 26066 }
    eq(
      judgeCollectors({ metricsText: 'x', tailers: 40, goroutines: 272, faces }).state,
      'ok',
      'healthy',
    )
    eq(
      judgeCollectors({ metricsText: 'x', tailers: 4531, goroutines: 22722, faces }).state,
      'drift',
      'broken',
    )
  })
  t('S6 指标取不到/活文件为 0 都判未判定(不用 0 冒充没有)', () => {
    const faces = { ok: true, why: '', live: 40, rotations: 0 }
    eq(judgeCollectors({ metricsText: null, faces }).state, 'unjudged', 'metrics 不可达')
    eq(judgeCollectors({ metricsText: 'x', tailers: null, faces }).state, 'unjudged', 'gauge 缺失')
    eq(
      judgeCollectors({
        metricsText: 'x',
        tailers: 1,
        faces: { ok: true, why: '', live: 0, rotations: 0 },
      }).state,
      'unjudged',
      '活文件枚举 0',
    )
    eq(
      judgeCollectors({
        metricsText: 'x',
        tailers: 1,
        faces: { ok: false, why: '目录读不到', live: 0, rotations: 0 },
      }).state,
      'unjudged',
      '目录不可读',
    )
  })
  t('S7 活文件与轮转副本形态可分(阈值的地基)', () => {
    eq(LIVE_RE.test('svc-api-nssm.log'), true, 'stdout 活')
    eq(LIVE_RE.test('svc-api-nssm-err.log'), true, 'stderr 活')
    eq(LIVE_RE.test('svc-api-nssm-20261030T101634.145.log'), false, '轮转不算活')
    eq(ROTATION_RE.test('svc-api-nssm-20261030T101634.145.log'), true, 'stdout 轮转')
    eq(ROTATION_RE.test('svc-web-nssm-err-20261103T004612.300.log'), true, 'stderr 轮转')
    eq(ROTATION_RE.test('svc-web-nssm-err.log'), false, '活 err 不误判成轮转')
  })
  t('S8 gauge 解析取不到就是 null(不回落 0)', () => {
    eq(parseGauge('promtail_files_active_total 4531', 'promtail_files_active_total'), 4531, '命中')
    eq(parseGauge('# 注释\n别的 1', 'promtail_files_active_total'), null, '缺失 ⇒ null')
    eq(parseGauge(null, 'x'), null, 'null 文本')
  })
  t('S9 报告维永不判红(哪怕比值离谱)', () => {
    eq(
      judgeWalkShare({
        oneNo: { samples: [2051], failed: false },
        full: { samples: [4910], failed: false },
      }).state,
      'report',
      '正常',
    )
    eq(
      judgeWalkShare({
        oneNo: { samples: [], failed: true },
        full: { samples: [1], failed: false },
      }).state,
      'report',
      '缺样',
    )
  })
  t('S10 定级并桶禁令:drift 优先于 unjudged,二者都不并成 ok', () => {
    const dims = [
      { dim: 'status-latency', state: 'unjudged' },
      { dim: 'collector-tailers', state: 'drift' },
    ]
    eq(aggregate(dims).state, 'drift', '有红先红')
    eq(
      aggregate([
        { dim: 'status-latency', state: 'unjudged' },
        { dim: 'collector-tailers', state: 'ok' },
      ]).state,
      'unjudged',
      '没红但有未判定',
    )
  })
  t('S11 稳定身份不含时刻/明细(同状态必同身份)', () => {
    const mk = () => [
      { dim: 'status-latency', state: 'drift' },
      { dim: 'collector-tailers', state: 'ok' },
    ]
    eq(alertIdentity(mk()) === alertIdentity(mk()), true, '两次一致')
    eq(/[0-9a-f]{8,}|\d{10}/.test(alertIdentity(mk())), false, '不掺 sha/时间戳')
  })
  t('S12 反向锁:摘掉报警线即翻红(证明这一维真在判)', () => {
    const s = { samples: [3400], failed: false, why: '' }
    eq(judgeLatency(s).state, 'ok', '默认线不红')
    eq(judgeLatency({ ...s, warnMs: 3300 }).state, 'drift', '线挪低即红 ⇒ 判据连着而不是摆设')
  })
  t('S13 反向锁:tailer 阈值确实挂在活文件数上', () => {
    eq(
      judgeCollectors({
        metricsText: 'x',
        tailers: 90,
        faces: { ok: true, why: '', live: 40, rotations: 0 },
      }).state,
      'drift',
      '40×2=80 < 90',
    )
    eq(
      judgeCollectors({
        metricsText: 'x',
        tailers: 90,
        faces: { ok: true, why: '', live: 60, rotations: 0 },
      }).state,
      'ok',
      '60×2=120 > 90 ⇒ 基线跟着日志面走',
    )
  })
  t('S14 monitor-trust 四态成对:一致绿 / 少一条红 / 关着不判 / 取不到未判定', () => {
    const A = 'A\x00B\x00'
    const B = 'A\x00'
    eq(
      judgeMonitorTrust({ enabled: true, monitorOut: A, fullOut: A, failed: false }).state,
      'ok',
      '逐字一致 ⇒ 绿',
    )
    eq(
      judgeMonitorTrust({ enabled: true, monitorOut: B, fullOut: A, failed: false }).state,
      'drift',
      '监控面少一条 ⇒ 红',
    )
    eq(
      judgeMonitorTrust({ enabled: true, monitorOut: A, fullOut: B, failed: false }).state,
      'drift',
      '监控面多一条(已删的还在报)⇒ 红',
    )
    eq(
      judgeMonitorTrust({ enabled: false, monitorOut: A, fullOut: A, failed: false }).state,
      'report',
      '没启用 ⇒ 不判,不为配置选择造红',
    )
    eq(
      judgeMonitorTrust({
        enabled: true,
        monitorOut: null,
        fullOut: A,
        failed: true,
        why: 'rc=128',
      }).state,
      'unjudged',
      '取不到 ⇒ 未判定',
    )
  })
  t('S16 accel-live 四态:齐全绿 / config 开着但扩展掉了判红 / 都没开不判 / 索引读不到未判定', () => {
    const both = { ok: true, why: '', names: ['TREE', 'UNTR', 'FSMN'], hasFSMN: true, hasUNTR: true, entries: 19033 }
    eq(judgeExtensions({ monitorEnabled: true, untrackedEnabled: true, index: both }).state, 'ok', '两枚都在 ⇒ 绿')
    eq(
      judgeExtensions({
        monitorEnabled: true,
        untrackedEnabled: true,
        index: { ...both, names: ['TREE', 'FSMN'], hasUNTR: false },
      }).state,
      'drift',
      'UNTR 掉 ⇒ 红(账面说开着)',
    )
    eq(
      judgeExtensions({
        monitorEnabled: true,
        untrackedEnabled: true,
        index: { ...both, names: [], hasFSMN: false, hasUNTR: false },
      }).state,
      'drift',
      '两枚都掉 ⇒ 红',
    )
    eq(judgeExtensions({ monitorEnabled: false, untrackedEnabled: false, index: both }).state, 'report', '没启用 ⇒ 不判')
    eq(
      judgeExtensions({ monitorEnabled: true, untrackedEnabled: false, index: { ok: false, why: '读不到' } }).state,
      'unjudged',
      '索引取不到 ⇒ 未判定',
    )
  })
  t('S18 两路读数之二:块在而 git 自测不通过 ⇒ drift(不能因为"块在"就记绿)', () => {
    const idx = { ok: true, why: '', names: ['TREE', 'UNTR', 'FSMN'], hasFSMN: true, hasUNTR: true, entries: 19033 }
    const d = judgeExtensions({
      monitorEnabled: true,
      untrackedEnabled: true,
      index: idx,
      selfTest: { ok: true, inUse: false, why: 'rc=1' },
    })
    eq(d.state, 'drift', '自测不通过即红')
    eq(d.readout.includes('缓存块在而 git 自己说它不成立'), true, 'readout 必须点名是哪一路说的')
  })
  t('S19 两路读数不一致 ⇒ 未判定(不挑一个信;§0.3)', () => {
    const d = judgeExtensions({
      monitorEnabled: true,
      untrackedEnabled: true,
      index: { ok: true, why: '', names: ['TREE', 'FSMN'], hasFSMN: true, hasUNTR: false, entries: 19033 },
      selfTest: { ok: true, inUse: true, why: '' },
    })
    eq(d.state, 'unjudged', '块面说掉、自测说在 ⇒ 不判')
    eq(d.readout.includes('不挑一个信'), true, '必须把"为什么不判"写出来')
    const g = judgeExtensions({
      monitorEnabled: true,
      untrackedEnabled: true,
      index: { ok: true, why: '', names: ['TREE', 'UNTR', 'FSMN'], hasFSMN: true, hasUNTR: true, entries: 1 },
      selfTest: { ok: false, inUse: null, why: '拿不到 index.lock(多席位争用)' },
    })
    eq(g.state, 'ok', '自测取不到不拖后腿(块面两枚都在)')
    eq(g.readout.includes('git 自测未取到'), true, 'readout 必须说清这一路没量到')
  })
  t('S20 回归锁:大 UNTR 块(本机实测 ~131KB)写在 FSMN 之前,按块倒剥仍要认出来(旧 64KB 尾窗把生效读成掉档)', () => {
    const mkBlock = (sig, payload) => {
      const head = Buffer.alloc(8)
      head.write(sig, 0, 'latin1')
      head.writeUInt32BE(payload.length, 4)
      return Buffer.concat([head, payload])
    }
    const header = Buffer.alloc(12)
    header.write('DIRC', 0, 'latin1')
    header.writeUInt32BE(3, 4)
    header.writeUInt32BE(19021, 8)
    const entries = Buffer.alloc(4096, 0x41)
    const untr = mkBlock('UNTR', Buffer.alloc(131_072, 0x33))
    const fsmn = mkBlock('FSMN', Buffer.from('0'.repeat(64), 'latin1'))
    const buf = Buffer.concat([header, entries, untr, fsmn, Buffer.alloc(20, 7)])
    // 故意在 FSMN 负载里造一次「结构等式偶然成立」(本机实测:'973\0' 撞 off=388):
    // 旧实现在这里 break ⇒ 把"扩展明明在"读成"剥不动"⇒ 天天假 drift
    const collide = buf.length - 20 - 8 - 12
    buf.write('973', collide, 'latin1')
    buf.writeUInt32BE(12, collide + 4)
    const dir = mkScratch('accel-block')
    const file = join(dir, 'index')
    writeFileSync(file, buf)
    const r = readIndexExtensions(file)
    rmScratch(dir)
    eq(r.ok, true, `结构可判:${r.why}`)
    eq(r.hasUNTR, true, '131KB 的 UNTR 块必须认出来')
    eq(r.hasFSMN, true, 'FSMN 块必须认出来')
    eq(r.names.join(','), 'FSMN,UNTR', '块名按倒剥顺序')
    const junk = Buffer.concat([header, entries, Buffer.alloc(20, 7)])
    const dir2 = mkScratch('accel-block2')
    const file2 = join(dir2, 'index')
    writeFileSync(file2, junk)
    const r2 = readIndexExtensions(file2)
    rmScratch(dir2)
    eq(r2.ok, false, '剥不出块 ⇒ 未判定,不猜"两枚都掉"')
    eq(
      judgeExtensions({ monitorEnabled: true, untrackedEnabled: true, index: r2 }).state,
      'unjudged',
      '读不出结构时判未判定(绝不判 drift)',
    )
  })
  t('S17 反向锁:判红必须给可执行 prime 命令,并写明"反复掉就该关而不是反复补"', () => {
    const d = judgeExtensions({
      monitorEnabled: true,
      untrackedEnabled: true,
      index: { ok: true, why: '', hasFSMN: true, hasUNTR: false, entries: 19033 },
    })
    eq(d.next.includes('git update-index --untracked-cache'), true, '出路必须是能直接执行的那一条')
    eq(d.next.includes('反复'), true, '必须把"这不是补一次的事"写进出路')
    eq(judgeExtensions({ monitorEnabled: true, untrackedEnabled: true, index: { ok: true, why: '', hasFSMN: true, hasUNTR: true, entries: 1 } }).next, '', '绿档不充数')
  })
  t('S15 反向锁:漏报必须点名少/多几条并给出关回出口', () => {
    const d = judgeMonitorTrust({
      enabled: true,
      monitorOut: 'A\x00',
      fullOut: 'A\x00B\x00C\x00',
      failed: false,
    })
    eq(d.missing.length, 2, '少报条数点名')
    eq(d.next.includes('core.fsmonitor'), true, '出路必须是能直接执行的关回命令')
    eq(
      d.next.includes('fsmonitor--daemon stop') && d.next.indexOf('token 重建') < d.next.indexOf('config --unset'),
      true,
      '第一步必须是 token 重建(stop + 跑一次 status),关回只能排在后面',
    )
    eq(d.next.includes('5000'), true, '必须写明关档会撞消费者预算(本机实测 5.7~6.2s)—— 不许劝人随手关掉加速')
    eq(
      judgeMonitorTrust({ enabled: true, monitorOut: 'A\x00', fullOut: 'A\x00', failed: false })
        .next,
      '',
      '绿档不许带出路充数',
    )
  })

  console.log(
    `\n[git-probe-headroom --self-test] ${pass}/${pass + fail} 例${fail ? ' 有失败' : ' 全绿'}`,
  )
  return fail === 0 ? 0 : 1
}

async function fetchText(url, ms = 6000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function main(argv) {
  if (argv.includes('--self-test')) {
    process.exitCode = await selfTest()
    return
  }
  const nIdx = argv.indexOf('--samples')
  const samplesN =
    nIdx >= 0 ? Math.max(1, Number(argv[nIdx + 1]) || DEFAULT_SAMPLES) : DEFAULT_SAMPLES
  const asJson = argv.includes('--json')

  const full = sampleStatusMs(ROOT, samplesN)
  const oneNo = sampleStatusMs(ROOT, 1, { uno: true })
  const metricsText = await fetchText(PROMTAIL_METRICS_URL)
  const faces = countLogFaces(LOG_DIR)
  const enabled = isMonitorEnabled(ROOT)
  const utrace = cfgFlag('core.untrackedCache', ROOT) === true
  const idxPath = gitIndexPath(ROOT)
  const idxExt = idxPath
    ? readIndexExtensions(idxPath)
    : { ok: false, why: '取不到 git-path index', names: [], hasFSMN: false, hasUNTR: false }
  const utSelf = utrace ? untrackedCacheSelfTest(ROOT) : { ok: false, inUse: null, why: '未启用,不测' }
  const monFace = statusFace(ROOT, false)
  const scanFace = statusFace(ROOT, true)
  const dims = [
    judgeLatency({ ...full, warnMs: WARN_MS, budgetMs: BUDGET_MS }),
    judgeCollectors({
      metricsText,
      faces,
      tailers: parseGauge(metricsText, 'promtail_files_active_total'),
      goroutines: parseGauge(metricsText, 'go_goroutines'),
    }),
    judgeMonitorTrust({
      enabled,
      monitorOut: monFace.out,
      fullOut: scanFace.out,
      failed: monFace.failed || scanFace.failed,
      why: monFace.why || scanFace.why,
    }),
    judgeExtensions({ monitorEnabled: enabled === true, untrackedEnabled: utrace, index: idxExt, selfTest: utSelf }),
    judgeWalkShare({ oneNo, full }),
  ]
  const agg = aggregate(dims)
  const identity = alertIdentity(dims)
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          verdict: agg.state,
          summary: agg.summary,
          identity,
          dims,
          samplesMs: full.samples,
          budgetMs: BUDGET_MS,
          warnMs: WARN_MS,
        },
        null,
        1,
      ),
    )
  } else {
    console.log(
      `判定面=本机现读(采样 ${samplesN} 次 · 报警线 ${WARN_MS}ms · 消费者预算 ${BUDGET_MS}ms)`,
    )
    for (const d of dims)
      console.log(
        `  [${d.state.toUpperCase()}] ${d.dim} :: ${d.readout}${d.next ? `\n        ↳ ${d.next}` : ''}`,
      )
    console.log(`GIT-PROBE-HEADROOM state=${agg.state} ${agg.summary} identity=${identity}`)
  }
  process.exitCode = agg.state === 'ok' ? 0 : agg.state === 'drift' ? 1 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main(process.argv.slice(2))

export const __test__ = {
  sampleStatusMs,
  statusFace,
  isMonitorEnabled,
  cfgFlag,
  gitIndexPath,
  readIndexExtensions,
  untrackedCacheSelfTest,
  judgeExtensions,
  judgeLatency,
  judgeCollectors,
  judgeMonitorTrust,
  judgeWalkShare,
  aggregate,
  alertIdentity,
  parseGauge,
  countLogFaces,
  WARN_MS,
  BUDGET_MS,
  LIVE_RE,
  ROTATION_RE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
