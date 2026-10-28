// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * net-doctor 的纯判据层(无 IO、无副作用;搬出理由见 scripts/net-doctor.mjs 顶部与其拆分说明)。
 *
 * 为什么单独成文件:一是新增文件有 800 行守门,而"为过门删判据/减用例"是错误的出路;二更要紧的是
 * 判据必须**只有一份实现** —— 镜像测试与守门 89 都记过同一课:测试里再抄一份判据,它就会跟着实现一起
 * 漂绿,从防线变成复读机(§22c)。所以本层由工具 import 后原样再导出,别处不得抄第二份。
 */
import fs from 'node:fs'
import path from 'node:path'

/** 控制器测延迟用的探针:Google 的 204 端点是该族工具的通用选择,因为它必定回 204 且无正文。 */
export const PROBE_URL = 'http://www.gstatic.com/generate_204'

/** 订阅里混在成员表里的"账户信息条目"不是线路,不能进延迟表也不能进"失联清单"。 */
export const PSEUDO_MEMBER_RE = /(剩余流量|套餐到期|到期|剩余|流量\s*[:：]|expire|traffic|quota)/i
export const BUILTIN_POLICIES = new Set(['direct', 'reject', 'pass', 'compatible', 'reject-drop'])

/** 解析 `reg query` 的输出。三态:reg 里根本没有该键 → enable 保持 null(没量到),不等于"关"。 */
export function parseRegQuery(text) {
  const out = { enable: null, server: null, bypass: null, sawKey: false }
  if (typeof text !== 'string' || !text.trim()) return out
  out.sawKey = true
  const en = text.match(/ProxyEnable\s+REG_DWORD\s+0x([0-9a-fA-F]+)/)
  if (en) out.enable = parseInt(en[1], 16) !== 0
  const sv = text.match(/ProxyServer\s+REG_SZ\s+(\S+)/)
  if (sv) out.server = sv[1].trim()
  const by = text.match(/ProxyOverride\s+REG_SZ\s+(.+)/)
  if (by) out.bypass = by[1].trim()
  return out
}

/** 取 YAML 顶层 `key: value`(本仓两份配置里我们要看的键全在顶层,不做完整 YAML 解析)。 */
export function pickYaml(text, key) {
  if (typeof text !== 'string') return null
  const m = text.match(new RegExp(`^${key}:[ \\t]*([^\\r\\n]*)$`, 'm'))
  if (!m) return null
  return m[1].trim().replace(/^['"]|['"]$/g, '')
}

/**
 * 分流规则给了"国内流量到底去哪"的答案,而这是判断"系统代理开着会不会拖慢国内"的唯一依据。
 * 只认三件事实:mode、有没有把 CN 判成 DIRECT 的收尾规则、兜底 MATCH 指向哪个策略。
 */
export function ruleFacts(text) {
  const out = { mode: null, cnDirect: false, cnEvidence: [], matchTarget: null }
  if (typeof text !== 'string' || !text.trim()) return out
  out.mode = pickYaml(text, 'mode')
  for (const re of [/GEOIP\s*,\s*CN\s*,\s*DIRECT/i, /DOMAIN-SUFFIX\s*,\s*cn\s*,\s*DIRECT/i]) {
    if (re.test(text)) out.cnDirect = true
  }
  if (out.cnDirect) {
    out.cnEvidence = text
      .split(/\r?\n/)
      .filter(
        (l) =>
          /GEOIP\s*,\s*CN\s*,\s*DIRECT/i.test(l) || /DOMAIN-SUFFIX\s*,\s*cn\s*,\s*DIRECT/i.test(l),
      )
      .slice(0, 3)
  }
  // 真配置里规则行是 `- MATCH,策略名`（前置两格缩进 + 短横），所以短横必须可选，否则兜底策略整条读不出来。
  const all = [...text.matchAll(/^[ \t]*(?:-\s*)?MATCH\s*,\s*([^\s,]+)/gim)]
  if (all.length) out.matchTarget = all[all.length - 1][1].trim()
  return out
}

/** 把订阅成员分成"线路"与"账户信息条目"。分错的代价是:把"剩余流量 132GB"当成一条失联线路报给用户。 */
export function classifyMembers(list) {
  const real = []
  const pseudo = []
  for (const rawName of Array.isArray(list) ? list : []) {
    const name = String(rawName || '').trim()
    if (!name) continue
    if (BUILTIN_POLICIES.has(name.toLowerCase())) continue
    if (PSEUDO_MEMBER_RE.test(name)) pseudo.push(name)
    else real.push(name)
  }
  return { real, pseudo }
}

/** 取一条线路最近 k 次成功延迟（旧→新）。顶层 `delay` 是旧版单值形态，当作长度 1 的窗口。 */
export function recentDelays(payload, probeUrl = PROBE_URL, k = 5) {
  if (!payload || typeof payload !== 'object') return []
  if (typeof payload.delay === 'number' && payload.delay > 0) return [payload.delay]
  const extra = payload.extra && payload.extra[probeUrl]
  const hist = extra && Array.isArray(extra.history) ? extra.history : []
  const nums = hist
    .filter((h) => h && typeof h.delay === 'number' && h.delay > 0)
    .map((h) => h.delay)
  return nums.slice(-Math.max(1, k))
}

/**
 * 线路延迟的正确读法。数值住在 `extra[探针URL].history` 里而不是顶层 `delay` ——
 * 只读顶层会得到"全部失联"的假结论,这就是把尺子错当成故障的那一型。
 */
export function latestDelay(payload, probeUrl = PROBE_URL) {
  const w = recentDelays(payload, probeUrl, 1)
  return w.length ? w[0] : null
}

export function median(nums) {
  const a = (Array.isArray(nums) ? nums : []).filter(
    (n) => typeof n === 'number' && Number.isFinite(n),
  )
  if (!a.length) return null
  a.sort((x, y) => x - y)
  const mid = Math.floor(a.length / 2)
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2)
}

/**
 * 从 /proxies 结果里走到"真正测延迟"的那一组:策略是 Selector 且它选中的成员本身是 URLTest 时,
 * 要下沉到那一组去量(否则报的是"自动选择"这个名字,而不是它当下挑中的线路)。
 */
export function resolveTestGroup(proxies, startName, maxHops = 4) {
  const hops = []
  let cur = startName
  let node = proxies && proxies[cur]
  if (!node) return { name: null, members: [], now: null, hops, reason: '组不存在于控制器输出' }
  for (let i = 0; i < maxHops && node; i++) {
    hops.push(`${cur}[${node.type}]`)
    if (node.type === 'URLTest')
      return { name: cur, members: node.all || [], now: node.now, hops, reason: null }
    const next = node.now && proxies[node.now]
    if (!next || next.type !== 'URLTest') {
      return { name: cur, members: node.all || [], now: node.now, hops, reason: null }
    }
    cur = node.now
    node = next
  }
  return {
    name: cur,
    members: node ? node.all || [] : [],
    now: node ? node.now : null,
    hops,
    reason: '跳数超限',
  }
}

/**
 * 结论器:输入各维度读数,输出给用户看的动作行。它是纯函数 —— 因为"该开还是该关系统代理"这类
 * 判断绝不能依赖机器瞬时状态才能被测到(镜像测试只能在构造面上证明它有牙)。
 * 返回 [{level, text}];level='bad' 会参与退出码。
 */
export function buildAdvice(s) {
  const a = []
  const push = (level, text) => a.push({ level, text })

  if (s.proxy && s.proxy.sawKey) {
    if (s.proxy.enable === false) {
      push('bad', 'Windows 系统代理当前是关的：凡是走海外的请求都会变成干等数秒再失败。')
      if (s.overseasDirectFail > 0) {
        push(
          'note',
          `实测佐证：直连侧有 ${s.overseasDirectFail} 个国外站点没能完成。打开方式二选一 —— ` +
            '代理客户端里的「系统代理」开关，或在命令行执行 reg add 把 ProxyEnable 设为 1。',
        )
      }
    } else if (s.proxy.enable === true) {
      push('ok', `Windows 系统代理当前是开的(${s.proxy.server || '地址未量到'})。`)
    } else {
      push('note', '读到了 Internet Settings 键，但里面没有 ProxyEnable 值 —— 这一格按未判定处理。')
    }
  } else if (s.proxy) {
    push('note', '系统代理：未判定（reg query 没有产出，可能不是 Windows 或注册表路径不可读）。')
  }

  if (s.rules && s.rules.mode) {
    if (s.rules.mode !== 'rule') {
      push('bad', `客户端模式是 ${s.rules.mode}：这会让国内网站也走节点，是"全局变慢"的直接成因。`)
    } else if (!s.rules.cnDirect) {
      push(
        'bad',
        '客户端是 rule 模式，但规则里找不到把国内判成直连的那几条（GEOIP,CN,DIRECT 等）。',
      )
    } else {
      push('ok', '客户端规则正确：mode=rule，且国内走直连，兜底才走节点。')
    }
  }

  if (s.client && s.client.desiredSystemProxy === true && s.proxy && s.proxy.enable === false) {
    push('note', '注意：客户端自己的设置认为系统代理应当是开的，而注册表里是关的 —— 两处不一致。')
  }

  if (s.groups && s.groups.readable) {
    if (s.groups.alive === 0 && s.groups.measurable > 0) {
      push(
        'bad',
        `所有可测线路都失联（${s.groups.measurable} 条无一给回延迟）：出口坏了，不只是设置问题。`,
      )
    } else if (
      s.groups.current &&
      s.groups.fastest &&
      s.groups.current.name !== s.groups.fastest.name
    ) {
      const gap = s.groups.current.delay - s.groups.fastest.delay
      if (gap > 50) {
        push(
          'note',
          `自动选线当下不是最快的一条（各按最近 ${s.groups.current.window || '?'}/${s.groups.fastest.window || '?'} 次的中位数比）：` +
            `在用「${s.groups.current.name}」${s.groups.current.delay}ms，` +
            `最快「${s.groups.fastest.name}」${s.groups.fastest.delay}ms（差 ${gap}ms）。` +
            '选线会周期性重测，一般自己会切；持续不切就手动在客户端里选最快那条。',
        )
      }
    } else if (
      s.groups.current &&
      s.groups.fastest &&
      s.groups.current.name === s.groups.fastest.name
    ) {
      push(
        'ok',
        `自动选线用的就是当前最快的一条（${s.groups.fastest.name} ${s.groups.fastest.delay}ms，最近 ${s.groups.fastest.window || '?'} 次中位数）。`,
      )
    }
    if (s.groups.dead && s.groups.dead.length) {
      push(
        'note',
        `套餐里有 ${s.groups.dead.length} 条线路给不出延迟读数（含：${s.groups.dead.slice(0, 6).join('、')}` +
          (s.groups.dead.length > 6 ? ' …' : '') +
          '）。控制器不区分「线路不通」与「这条从未被测过」，所以这一格只能当线索、不能当判决；' +
          '拿去问客服时按清单问，别按结论问。',
      )
    }
  } else if (s.groups) {
    push(
      'note',
      `线路延迟：未判定（${s.groups.reason || '控制器不可达'}）—— 没有读数不等于线路都活着。`,
    )
  }

  if (s.samplesRan) {
    if (typeof s.domesticMedian === 'number' && typeof s.domesticProxiedMedian === 'number') {
      const worse = s.domesticProxiedMedian > s.domesticMedian * 3 && s.domesticProxiedMedian > 300
      push(
        worse ? 'note' : 'ok',
        worse
          ? `国内站点经客户端后 ${s.domesticProxiedMedian}ms，直连 ${s.domesticMedian}ms —— 客户端这侧有额外开销。`
          : `国内站点直连 ${s.domesticMedian}ms / 经客户端 ${s.domesticProxiedMedian}ms：走不走几乎一样。`,
      )
    }
    if (s.overseasDirectFail > 0 && s.overseasProxiedOk > 0) {
      push(
        'note',
        `国外站点：直连失败 ${s.overseasDirectFail} 个、走节点成功 ${s.overseasProxiedOk} 个。`,
      )
    }
  } else {
    push('note', '站点抽样：未判定（curl 不可用或一次请求都没发出去）—— 这一格没量到，别当成正证。')
  }

  if (typeof s.dnsMs === 'number')
    push(
      s.dnsMs > 500 ? 'bad' : 'ok',
      `本机 DNS 解析 ${s.dnsMs}ms${s.dnsMs > 500 ? '（偏慢）' : ''}。`,
    )
  else push('note', 'DNS：未判定。')

  if (s.origin === true)
    push('ok', 'git 到 origin 可达（走的是仓库里写明的显式代理，与系统代理开关无关）。')
  else if (s.origin === false)
    push('bad', 'git 到 origin 不可达：自动推送与部署环会一起卡住，先看线路再看代理。')
  else push('note', 'git 到 origin：未判定。')

  if (s.ports && s.ports.readable) {
    push(
      'note',
      `本机服务端口：注册表 ${s.ports.total} 个，此刻在听 ${s.ports.listening} 个（信息项，不参与红判）。`,
    )
  }
  return a
}

export function exitCodeFrom(advice, undeterminedCount) {
  if (advice.some((x) => x.level === 'bad')) return 1
  // 一条红都没有、但关键维度全部没量到 —— 那不能算"一切正常"，按脚本层面的无效结论处理。
  if (
    undeterminedCount > 0 &&
    advice.every((x) => x.level === 'note' || x.level === 'ok') &&
    undeterminedCount >= 5
  ) {
    return 2
  }
  return 0
}

// ────────────────────────── IO 侧(全部只读；每个派生都带 windowsHide + timeout) ──────────────────────────

/** 找一个可用的 PowerShell：优先 7（AGENTS §27），回落到系统 5.1，两条都试不到就返回 null。 */
export function resolvePowerShell(fsImpl = fs) {
  const cands = [
    'C:/Program Files/PowerShell/7/pwsh.exe',
    'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
  ]
  for (const c of cands) {
    try {
      if (fsImpl.existsSync(c)) return c
    } catch {
      /* 探不到就当这一档不存在 */
    }
  }
  return null
}

/** 客户端配置目录：允许环境变量覆盖（换机/CI），否则按 APPDATA 下的实际包名找。 */
export function resolveConfigDir(env = process.env, fsImpl = fs) {
  if (env.NET_DOCTOR_VERGE_DIR) {
    try {
      if (fsImpl.existsSync(path.join(env.NET_DOCTOR_VERGE_DIR, 'clash-verge.yaml')))
        return env.NET_DOCTOR_VERGE_DIR
    } catch {
      return null
    }
    return null
  }
  const base = env.APPDATA
  if (!base) return null
  for (const name of [
    'io.github.clash-verge-rev.clash-verge-rev',
    'io.github.clash-verge.clash-verge',
  ]) {
    const p = path.join(base, name)
    try {
      if (fsImpl.existsSync(path.join(p, 'clash-verge.yaml'))) return p
    } catch {
      /* ignore */
    }
  }
  return null
}

/** 从进程命令行里取命名管道名：本机把 mihomo 的 HTTP 控制器关掉了，只剩这条管道。 */
export function pipeNameFromCommandLine(cmd) {
  if (typeof cmd !== 'string') return null
  const m = cmd.match(/(verge-mihomo-sidecar-[A-Za-z0-9-]+)/)
  return m ? m[1] : null
}

/**
 * 找代理核进程的那句 PowerShell。写成一条被导出的常量而不是就地字符串,是因为它在本工具里
 * **崩过一次且症状是"安静地少一格结论"**:旧写法 `-Filter "ProcessId=" + $_.Id` 里,双引号在
 * `=` 前就把 -Filter 的值结束掉了,`+` 被 PowerShell 当成位置参数 ⇒ 报「A positional parameter
 * cannot be found that accepts argument '+'」⇒ 进程表读不到 ⇒ 整个"线路延迟"维度掉进未判定,
 * 而报告其余各项照常绿。教训是**字符串拼接在跨解释器传参时是陷阱,只能用插值**,由自检逐字锁形。
 */
export const PS_FIND_CORE =
  '$p = Get-Process verge-mihomo -ErrorAction SilentlyContinue | Select-Object -First 1; ' +
  'if (-not $p) { exit 0 }; ' +
  '$cl = ""; ' +
  'try { $cl = (Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)" -ErrorAction Stop).CommandLine } catch { }; ' +
  'Write-Output ("{0}|{1}" -f $p.Id, $cl)'

export function jsonFromRaw(raw) {
  if (typeof raw !== 'string') return null
  const i = raw.indexOf('{', raw.indexOf('\r\n\r\n'))
  const j = raw.lastIndexOf('}')
  if (i < 0 || j <= i) return null
  try {
    return JSON.parse(raw.slice(i, j + 1))
  } catch {
    return null
  }
}

export function summarizeSamples(rows) {
  const done = rows.filter((r) => r && r.ok && typeof r.ms === 'number')
  return {
    median: median(done.map((r) => r.ms)),
    okCount: done.length,
    failCount: rows.length - done.length,
    // 「一次都没发出请求」与「发出了但全失败」必须在数据层就分开 —— 否则报告会把它显示成同一句
    // "未量到",而这两件事的处置动作完全不同(前者是工具坏了,后者才是真正的网络故障)。
    attempts: rows.length,
  }
}

// ────────────────────────── 编排 ──────────────────────────

export function renderText(meta) {
  const L = []
  L.push(`网络体检 · ${meta.at} · ${meta.platform}`)
  L.push('')
  for (const x of meta.advice) {
    const mark =
      x.level === 'bad' ? '❌' : x.level === 'warn' ? '⚠️' : x.level === 'ok' ? '✅' : '·'
    L.push(`${mark} ${x.text}`)
  }
  if (meta.undetermined.length) {
    L.push('')
    L.push(`未判定 ${meta.undetermined.length} 项（没量到 ≠ 没问题）：`)
    for (const u of meta.undetermined) L.push(`  - ${u.dim}：${u.reason || '原因未给出'}`)
  } else {
    L.push('')
    L.push('未判定 0 项。')
  }
  if (meta.groups && meta.groups.readable && meta.groups.sorted) {
    L.push('')
    L.push(
      `线路延迟（组 ${meta.groups.groupName}${meta.groups.via ? ' · ' + meta.groups.via : ''}，活着 ${meta.groups.alive}/${meta.groups.measurable}${meta.groups.pseudoSkipped ? `，已剔除账户条目 ${meta.groups.pseudoSkipped}` : ''}）`,
    )
    for (const m of meta.groups.sorted.slice(0, 10)) {
      L.push(
        `  ${String(m.delay).padStart(5)}ms  ${m.name}` +
          `  (最近 ${m.window || '?'} 次中位数，末次 ${m.last}ms)` +
          `${meta.groups.currentName === m.name ? '   ← 当前在用' : ''}`,
      )
    }
  }
  if (meta.samples && meta.samples.length) {
    // 三态:量到中位数 / 发了请求但全失败 / 一次都没发出去。后两态的处置动作完全不同,不得并桶。
    const fmt = (sum) => {
      if (!sum || !sum.attempts) return '未尝试'
      if (typeof sum.median === 'number') return `${sum.median}ms/${sum.failCount}败`
      return `全部失败(${sum.failCount})`
    }
    L.push('')
    L.push('站点抽样（中位数；「全部失败」是量到的结论，「未尝试」才是没量到）')
    for (const r of meta.samples) {
      const d = fmt(r.directSum)
      const p = r.proxiedSum ? fmt(r.proxiedSum) : '无代理可测'
      L.push(
        `  ${(r.domestic ? '[国内] ' : '[国外] ') + r.host.padEnd(30)} 直连 ${d.padEnd(16)} 走代理 ${p}`,
      )
    }
  }
  return L.join('\n')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
