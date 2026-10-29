// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子,需 console 输出结论 */
/**
 * check-cross-end-parity-drift.mjs — 跨端对齐"是否正在倒退"的只读漂移尺(不进提交链)
 *
 * 立因:本仓三条对齐链(web→RN 功能映射 / RN→小程序镜像 / 样式 token 派生)各有对账器,
 * 但**没有任何一处回答"这一轮比上一轮好了还是坏了"**。登记数只能靠人想起来去跑,
 * 于是 2026-10-24→25 一天里镜像从 26 涨到 84 这件事,只有翻提交才看得见。
 * 本尺把"涨/跌"变成机读结论 + 一份快照台账,供 git-guardian 巡检轮派发;
 * 倒退(镜像减少 / 登记表腐烂 / 账本文档与现读脱节)才报警,涨不报。
 *
 * 判据零复算(§0.6):数字全部**取自现成对账器的 --json 输出**,本文件不重算任何一条判据,
 * 只做"上一轮快照 ↔ 本轮现读"的比较(四道)
 *   · scripts/check-cross-end-screen-coverage.mjs --json  → 共享屏/已镜像/登记表条目/判红数
 *   · scripts/check-web-rn-screen-parity.mjs --json       → web 路由/aligned/unmapped/腐烂数
 *   · scripts/check-miniapp-mirror-fidelity.mjs --json    → 承载对数/手写对数/未还原键数/断链/声明不符
 *     (2026-10-27 接:还原度这条链此前只有 CI 与"人想起来才跑"的尺,守护轮的倒退⇒到人不认识它,
 *      于是"承载页被改回头抄""文案键被删掉""壳断链"三类都在账面上无声)
 *   · docs/engineering/rn-miniapp-parity-matrix.md        → 缺口账本文档自述的三个数
 *
 * 三态(§0.3):任一子对账器取不到结论 ⇒ state=undetermined(不记绿也不冒红);
 * 取到且有倒退维 ⇒ state=regressed;否则 ok。文档数字与现读不等 ⇒ 单列 docStale(可整改:重跑生成命令)。
 *
 * Usage:
 *   node scripts/check-cross-end-parity-drift.mjs            # 现读并打印
 *   node scripts/check-cross-end-parity-drift.mjs --json     # 机读
 *   node scripts/check-cross-end-parity-drift.mjs --record   # 同时把本轮写进快照台账(守护轮用)
 *   node scripts/check-cross-end-parity-drift.mjs --self-test
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const STATE_FILE = join(ROOT, '.ihui-agent', 'state', 'cross-end-parity-last.json')
const DOC_PATH = 'docs/engineering/rn-miniapp-parity-matrix.md'

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const recordMode = argv.includes('--record')
const selfTest = argv.includes('--self-test')

/** 跑一道对账器取 JSON;非零退出也可能带完整结论(判红档),故 stdout 优先、状态另报 */
function runRuler(script, args = ['--json']) {
  const cmd = join(HERE, script)
  if (!existsSync(cmd)) return { ok: false, why: `尺子不在位:${script}` }
  try {
    const out = execFileSync(process.execPath, [cmd, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10 * 60 * 1000,
      maxBuffer: 1 << 24,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      return { ok: true, json: JSON.parse(out) }
    } catch {
      return { ok: false, why: `${script} 输出不是 JSON` }
    }
  } catch (e) {
    const out = String(e?.stdout ?? '')
    if (out.trim()) {
      try {
        return { ok: true, json: JSON.parse(out), status: e?.status ?? null }
      } catch {
        /* 落到下面 */
      }
    }
    return { ok: false, why: `${script} 跑不动:${String(e?.message ?? e).slice(0, 120)}` }
  }
}

/** 从缺口账本文档自述行抽三个数(生成器写的是 `- 共享屏(真相源): **218**` 这种形) */
function docNumbers(md) {
  const pick = (label) => {
    // 标签里的括号是**字面量**(共享屏(真相源)),不转义会被当成分组 ⇒ 永远抽不到数。
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = new RegExp(`-\\s*${esc}:\\s*\\*\\*(\\d+)\\*\\*`).exec(md || '')
    return m ? Number(m[1]) : null
  }
  // 缺口行标签以**生产方**(report-rn-miniapp-gaps.mjs 第 137 行)现写为准:它发的是
  // `缺口合计`,而本解析曾读 `缺口(未判定镜像)` —— 消费方读一个生产者从不发射的标签,
  // 结果是 gaps 恒 null、C9 阳性对照恒红(2026-10-26 实测)。旧标签保留为兜底,防历史文档。
  return {
    sharedTotal: pick('共享屏(真相源)'),
    mirrored: pick('已被小程序显式镜像'),
    gaps: pick('缺口合计') ?? pick('缺口(未判定镜像)'),
  }
}

/**
 * 比较纯函数:上一轮快照 ↔ 本轮现读。
 * 倒退维只有这些族,逐条给"能整改的下一步"(§5e-1 可整改性准入):
 *   mirrored-decrease —— 镜像声明被撤 ⇒ 查是哪条标记/登记被删(门 128 R3 同判据)
 *   web-aligned-decrease / web-unmapped-increase —— RN 承载被拆 / 新 web 页无人判过(与上一轮快照比)
 *   registry-rot      —— 登记表条目腐烂/判红 ⇒ 修登记或补标记(门 128 R1)
 *   map-rot           —— web↔RN 登记表腐烂 ⇒ 修 aligned 指向或补 reason(门 check-web-rn-screen-parity)
 *   doc-stale         —— 账本文档数字≠现读 ⇒ 重跑 report-rn-miniapp-gaps --write
 *   mirror-hosted-decrease / mirror-missing-increase —— 承载对数减少 / 未还原键增加(与上一轮快照比)
 *   mirror-chain-broken / mirror-declaration-mismatch —— 引壳而链断 / 声明与承载不是同一屏(绝对值出声:
 *       这两维现读存量都是 0,出现即"新增的产物级缺陷",不是把存量判成人人红(§12e))
 *   conversion-available —— 落地器预演读到手写页可转壳承载(机会窗,不是倒退;带齐两步命令)
 * 涨跌只比"本轮有没有变坏",不比绝对值大小,免得把正常增长判成异常。
 */
function judge({ coverage, webParity, fidelity, conversion, doc, prev }) {
  const cur = {
    mirrored: coverage?.json?.stats?.mirroredShared ?? null,
    registryEntries: coverage?.json?.stats?.registryEntries ?? null,
    coverageRed: coverage?.json?.red?.length ?? null,
    mapRot: webParity?.json?.rot?.length ?? null,
    aligned: webParity?.json?.aligned ?? null,
    unmapped: webParity?.json?.unmapped ?? null,
    sharedTotal: coverage?.json?.stats?.sharedTotal ?? null,
    // 还原度维(2026-10-27 接):镜像页**真还原**了多少,而不是"声明"了多少。
    // 立因:此前这条链只有 CI 与人工跑的两把尺,守护轮的"倒退⇒到人"完全不认识它 ⇒
    // 承载页被改回手写、文案被删、壳承载断链,都没人自动知道。
    fidelityHosted: fidelity?.json?.hosted ?? null,
    fidelityHand: fidelity?.json?.hand ?? null,
    fidelityMissing: fidelity?.json?.totalMissing ?? null,
    fidelityBroken: fidelity?.json?.broken ?? null,
    fidelityOther: fidelity?.json?.other ?? null,
    // 转换机会维(2026-10-27 接):落地器**只读预演**的结论 —— 有页可自动转壳承载时必须被机器看见。
    // 为什么不直接把 apply 挂守护轮:转换还要同批改 `rn-shell-types` 声明件(门 251 C9 判它),
    // 只落页不落声明件会把那道 blocking 门打红(§12e 恒红门),而那一步需要一个按 HEAD 面重生成的
    // 检出档 —— 现无该形态的器物,所以这一维先"喊得响 + 给全两条命令",不自作主张改 99 枚源文件。
    conversionUpgradable: conversion?.json?.upgradable ?? null,
    conversionRefused: conversion?.json?.refused ?? null,
  }
  const reasons = []
  const missing = []
  for (const [k, v] of Object.entries(cur)) if (v === null || v === undefined) missing.push(k)
  if (!coverage.ok) missing.push('coverage')
  if (!webParity.ok) missing.push('webParity')
  if (fidelity && !fidelity.ok) missing.push('fidelity')
  // 转换预演器**发现可转页时退出码就是 1**(preview 语义:有活可干 ⇒ 非零)。
  // 若按 ok=false 处理,这一维会在"最该喊"的那一刻判成未判定 —— 结论只认 stdout 的 JSON,
  // JSON 取不到时上面的 null 扫描已经把 conversionUpgradable 记进 missing(不猜、不冒绿)。
  if (coverage.ok && webParity.ok && (cur.mirrored === null || cur.coverageRed === null)) {
    missing.push('coverage 字段名对不上(汇总行取不到数)')
  }
  if (missing.length > 0)
    return {
      state: 'undetermined',
      cur,
      reasons,
      missing,
      why: `取不到输入:${missing.join(',')}(不记绿也不冒红)`,
    }

  if (cur.coverageRed > 0)
    reasons.push({ dim: 'registry-rot', detail: `门 128 判红 ${cur.coverageRed} 处` })
  if (cur.mapRot > 0) reasons.push({ dim: 'map-rot', detail: `web↔RN 登记表腐烂 ${cur.mapRot} 行` })
  // 断链/声明不符:现读存量都是 0 ⇒ 这一维一旦出现就是"新增的产物级缺陷",按绝对值出声不算恒红门。
  // 点名(§5e-1 可整改性准入):这两维的 detail 此前只给"另一把尺子在哪",收信人还得再跑一趟才知道
  // 是哪一屏。fidelity 自己已经算了逐屏 rows,这里只把它现成的 route 抄进正文 —— 取不到就整段不附
  // (§0.3:宁可不点名,不编点名)。到人身份只按 dim 拼(guardian 的 dedupKey),明细抖动不换身份。
  const named = (form) => {
    const rows = fidelity?.json?.rows
    if (!Array.isArray(rows)) return ''
    const hit = rows.filter((r) => r && r.form === form).slice(0, 3)
    if (hit.length === 0) return ''
    return ` ⇒ 点名:${hit.map((r) => `${r.route}${r.why ? `(${String(r.why).slice(0, 60)})` : `(${r.spec})`}`).join(' ｜ ')}`
  }
  if (cur.fidelityBroken > 0)
    reasons.push({
      dim: 'mirror-chain-broken',
      detail: `${cur.fidelityBroken} 对镜像页引了 @rn-shells 而链不成立(壳不在面/壳未消费本屏/取用形态与壳导出对不上 ⇒ 页面渲染不出) ⇒ 出路:node scripts/check-miniapp-mirror-fidelity.mjs 看点名行,再按 repair-cross-end-mirror.mjs 补声明或直接改回同名壳${named('broken')}`,
    })
  if (cur.fidelityOther > 0)
    reasons.push({
      dim: 'mirror-declaration-mismatch',
      detail: `${cur.fidelityOther} 对声明镜像 A 而承载的壳是 B ⇒ 账面"已镜像"而 A 那一屏并没渲染 ⇒ 出路:改标记为真承载的那一屏,或把壳指向声明的那一屏${named('other')}`,
    })
  // 转换机会:"有页可转"不是倒退,但它是"少养一份端内实现"的窗口,现读到 >0 就出声
  // (身份按维去重 ⇒ 同一批机会不会每 60 分钟刷一封;明细抖动不换身份)。
  if (cur.conversionUpgradable > 0)
    reasons.push({
      dim: 'conversion-available',
      detail:
        `${cur.conversionUpgradable} 枚手写镜像页已可转壳承载(转完这一页就自动跟随共享屏,拒 ${cur.conversionRefused} 枚)⇒ 出路:` +
        '① node scripts/upgrade-miniapp-shell-pages.mjs --apply --cap=5 ② 提交页面后 node scripts/gen-rn-shell-types.mjs --write 再提交声明件' +
        '(两步同批:声明件按 HEAD 面派生,只落页会把门 251 C9 打成红)',
    })

  if (prev && Number.isFinite(prev.mirrored) && cur.mirrored < prev.mirrored)
    reasons.push({
      dim: 'mirrored-decrease',
      detail: `镜像声明 ${prev.mirrored} → ${cur.mirrored}(净减 ${prev.mirrored - cur.mirrored})`,
    })

  // web→RN 那一侧的同一格(此前只有小程序侧有涨跌维):aligned 是"web 有这屏、RN 也有承载"的对数,
  // 它掉了 = 有人把 RN 承载拆了而账面无声;unmapped 涨了 = 新增 web 页没人判过 RN 侧。
  if (
    prev &&
    Number.isFinite(prev.aligned) &&
    Number.isFinite(cur.aligned) &&
    cur.aligned < prev.aligned
  )
    reasons.push({
      dim: 'web-aligned-decrease',
      detail: `web→RN 已对齐 ${prev.aligned} → ${cur.aligned}(净减 ${prev.aligned - cur.aligned})⇒ 出路:node scripts/check-web-rn-screen-parity.mjs 看是哪条路由的承载体没了,再按 scripts/data/web-rn-screen-map.jsonl 恢复 aligned 指向`,
    })
  if (
    prev &&
    Number.isFinite(prev.unmapped) &&
    Number.isFinite(cur.unmapped) &&
    cur.unmapped > prev.unmapped
  )
    reasons.push({
      dim: 'web-unmapped-increase',
      detail: `web 路由未判定 ${prev.unmapped} → ${cur.unmapped}(净增 ${cur.unmapped - prev.unmapped})⇒ 新增页面没人判过 RN 侧承载 ⇒ 出路:node scripts/check-web-rn-screen-parity.mjs 按分组清单逐屏登记(aligned / gap / excluded 三态之一,不许留空)`,
    })

  // 还原度两维只在"上一轮真读到过"时比较(没有基线 = 本轮先记快照,不造倒退也不冒绿)
  if (
    prev &&
    Number.isFinite(prev.fidelityHosted) &&
    Number.isFinite(cur.fidelityHosted) &&
    cur.fidelityHosted < prev.fidelityHosted
  )
    reasons.push({
      dim: 'mirror-hosted-decrease',
      detail: `壳承载对数 ${prev.fidelityHosted} → ${cur.fidelityHosted}(净减 ${prev.fidelityHosted - cur.fidelityHosted})⇒ 有页面从"渲染共享源本体"退回头抄,源头再改它不会跟随 ⇒ 出路:node scripts/check-miniapp-mirror-fidelity.mjs 看是哪几页,恢复 @rn-shells 承载`,
    })
  if (
    prev &&
    Number.isFinite(prev.fidelityMissing) &&
    Number.isFinite(cur.fidelityMissing) &&
    cur.fidelityMissing > prev.fidelityMissing
  )
    reasons.push({
      dim: 'mirror-missing-increase',
      detail: `镜像页未还原的业务文案键 ${prev.fidelityMissing} → ${cur.fidelityMissing}(净增 ${cur.fidelityMissing - prev.fidelityMissing})⇒ 用户在小程序端看不到的条目变多 ⇒ 出路:node scripts/check-miniapp-mirror-fidelity.mjs --top=20 按页点名,补回文案或改回壳承载`,
    })

  const docCur = docNumbers(doc)
  const docMismatch =
    docCur.mirrored !== null && cur.mirrored !== null ? docCur.mirrored !== cur.mirrored : null
  if (docMismatch)
    reasons.push({
      dim: 'doc-stale',
      detail: `账本文档自述 ${docCur.mirrored},现读 ${cur.mirrored} ⇒ 重跑 node scripts/report-rn-miniapp-gaps.mjs --write ${DOC_PATH}`,
    })

  return {
    state: reasons.length > 0 ? 'regressed' : 'ok',
    cur,
    prev: prev ?? null,
    reasons,
    doc: docCur,
  }
}

function readPrev() {
  try {
    const o = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    return {
      mirrored: o?.cur?.mirrored ?? o?.mirrored ?? null,
      aligned: o?.cur?.aligned ?? null,
      unmapped: o?.cur?.unmapped ?? null,
      fidelityHosted: o?.cur?.fidelityHosted ?? null,
      fidelityMissing: o?.cur?.fidelityMissing ?? null,
      at: o?.at ?? null,
    }
  } catch {
    return null
  }
}

function selfTestMain() {
  const cases = []
  const mk = (mirrored, reds, rot, aligned = 150, unmapped = 270) => ({
    ok: true,
    json: {
      stats: { mirroredShared: mirrored, registryEntries: 90, sharedTotal: 218 },
      red: new Array(reds).fill({ rule: 'R1' }),
      rot: new Array(rot).fill({ line: 1, why: 'x' }),
      aligned,
      unmapped,
    },
  })
  /** 还原度尺的结论夹具(字段名与 check-miniapp-mirror-fidelity --json 逐字同形) */
  const mkFid = ({
    hosted = 114,
    hand = 99,
    missing = 646,
    broken = 0,
    other = 0,
    rows = [],
  } = {}) => ({
    ok: true,
    json: { hosted, hand, totalMissing: missing, broken, other, rows },
  })
  /** 转换机会预演夹具(与 upgrade-miniapp-shell-pages 的机读档同形;默认"没机会"= 现读真实状态) */
  const mkConv = ({ upgradable = 0, refused = 12 } = {}) => ({
    ok: true,
    json: { upgradable, refused },
  })
  cases.push({
    name: 'T1 持平无腐烂 ⇒ ok',
    pass:
      judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '- 已被小程序显式镜像: **91**',
        prev: { mirrored: 91 },
      }).state === 'ok',
  })
  cases.push({
    name: 'T2 镜像净减 ⇒ regressed/mirrored-decrease',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(89, 0, 0),
        webParity: mk(89, 0, 0),
        doc: '',
        prev: { mirrored: 91 },
      })
      return j.state === 'regressed' && j.reasons.some((r) => r.dim === 'mirrored-decrease')
    })(),
  })
  cases.push({
    name: 'T3 门判红 ⇒ regressed/registry-rot(涨了也照样报红)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(120, 3, 0),
        webParity: mk(120, 0, 0),
        doc: '',
        prev: { mirrored: 91 },
      })
      return j.state === 'regressed' && j.reasons.some((r) => r.dim === 'registry-rot')
    })(),
  })
  cases.push({
    name: 'T4 文档数字与现读不等 ⇒ doc-stale(可整改,给出重跑命令)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '- 已被小程序显式镜像: **79**',
        prev: { mirrored: 91 },
      })
      return j.reasons.some((r) => r.dim === 'doc-stale' && /report-rn-miniapp-gaps/.test(r.detail))
    })(),
  })
  cases.push({
    name: 'T5 子对账器跑不动 ⇒ undetermined,不记绿',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: { ok: false, why: 'x' },
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      return j.state === 'undetermined' && j.missing.includes('coverage')
    })(),
  })
  cases.push({
    name: 'T6 无上一轮快照 ⇒ 不比涨跌,只判当场腐烂(拿 prev 缺失当"没倒退"是错的)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      return j.state === 'ok' && j.prev === null
    })(),
  })
  cases.push({
    name: 'T7 承载对数净减 ⇒ mirror-hosted-decrease(有人把页改回头抄)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ hosted: 110 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: { mirrored: 91, fidelityHosted: 114, fidelityMissing: 646 },
      })
      return j.state === 'regressed' && j.reasons.some((r) => r.dim === 'mirror-hosted-decrease')
    })(),
  })
  cases.push({
    name: 'T8 未还原文案键净增 ⇒ mirror-missing-increase',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ missing: 700 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: { mirrored: 91, fidelityHosted: 114, fidelityMissing: 646 },
      })
      return j.reasons.some(
        (r) =>
          r.dim === 'mirror-missing-increase' && /check-miniapp-mirror-fidelity/.test(r.detail),
      )
    })(),
  })
  cases.push({
    name: 'T9 壳承载断链 ⇒ 无需 prev 也出声(产物级缺陷,现读存量为 0 不是恒红门)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ broken: 2 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      return j.reasons.some((r) => r.dim === 'mirror-chain-broken')
    })(),
  })
  cases.push({
    name: 'T10 声明镜像 A 而承载是 B ⇒ mirror-declaration-mismatch',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ other: 1 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      return j.reasons.some((r) => r.dim === 'mirror-declaration-mismatch')
    })(),
  })
  cases.push({
    name: 'T18 产物级缺陷正文自带 route 点名(§5e-1:不能让人再跑一趟尺子才知道是哪屏)',
    pass: (() => {
      const rows = [
        {
          form: 'other',
          route: 'pages/member/integral',
          spec: 'vip/VipScreen.tsx',
          why: '声明 VipScreen 而承载 PointHistoryScreen',
        },
        {
          form: 'broken',
          route: 'pkg-user/x/index',
          spec: 'aigc/AigcScreen.tsx',
          why: '壳在本面不存在',
        },
      ]
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ other: 1, broken: 1, rows }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      const pick = (dim) => j.reasons.find((r) => r.dim === dim)?.detail ?? ''
      return (
        pick('mirror-declaration-mismatch').includes('pages/member/integral') &&
        pick('mirror-chain-broken').includes('pkg-user/x/index')
      )
    })(),
  })
  cases.push({
    name: 'T19 取不到逐屏 rows ⇒ 正文不附点名(宁缺毋造,§0.3)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ other: 1 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      const d = j.reasons.find((r) => r.dim === 'mirror-declaration-mismatch')?.detail ?? ''
      return d.length > 0 && !d.includes('点名:')
    })(),
  })
  cases.push({
    name: 'T11 还原度尺跑不动 ⇒ undetermined 且点名 fidelity(不记绿)',
    pass: (() => {
      const j = judge({
        fidelity: { ok: false, why: 'x' },
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: null,
      })
      return j.state === 'undetermined' && j.missing.includes('fidelity')
    })(),
  })
  cases.push({
    name: 'T12 上一轮没有还原度快照 ⇒ 不拿它造倒退(第一轮的存量不是"变坏")',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid({ missing: 99999 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        doc: '',
        prev: { mirrored: 91 },
      })
      return !j.reasons.some((r) => r.dim.startsWith('mirror-')) && j.state === 'ok'
    })(),
  })
  cases.push({
    name: 'T13 预演读到手写页可转 ⇒ conversion-available(机会窗要出声,且给齐两步命令)',
    pass: (() => {
      const j = judge({
        conversion: mkConv({ upgradable: 3 }),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        fidelity: mkFid(),
        doc: '',
        prev: null,
      })
      const r = j.reasons.find((x) => x.dim === 'conversion-available')
      return (
        j.state === 'regressed' &&
        !!r &&
        /upgrade-miniapp-shell-pages/.test(r.detail) &&
        /gen-rn-shell-types/.test(r.detail)
      )
    })(),
  })
  cases.push({
    name: 'T14 转换预演跑不动 ⇒ 不得当成"没机会"(取不到输入就是未判定)',
    pass: (() => {
      const j = judge({
        conversion: { ok: false, why: 'x' },
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        fidelity: mkFid(),
        doc: '',
        prev: null,
      })
      return j.state === 'undetermined' && j.missing.some((m) => m.startsWith('conversion'))
    })(),
  })
  cases.push({
    name: 'T17 预演"发现可转页"时退出码就是 1 —— 结论仍须照判(否则最该喊的那一刻哑掉)',
    pass: (() => {
      const j = judge({
        conversion: { ok: false, why: 'exit 1', json: { upgradable: 5, refused: 2 } },
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0),
        fidelity: mkFid(),
        doc: '',
        prev: null,
      })
      return (
        j.state === 'regressed' &&
        j.reasons.some((r) => r.dim === 'conversion-available' && /5 枚/.test(r.detail))
      )
    })(),
  })
  cases.push({
    name: 'T15 RN 承载被拆 ⇒ web-aligned-decrease(小程序侧有涨跌维而 web→RN 侧没有,是半边瞎)',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0, 150, 270),
        doc: '',
        prev: { mirrored: 91, aligned: 160, unmapped: 270 },
      })
      return (
        j.state === 'regressed' &&
        j.reasons.some(
          (r) => r.dim === 'web-aligned-decrease' && /web-rn-screen-map/.test(r.detail),
        )
      )
    })(),
  })
  cases.push({
    name: 'T16 新 web 页无人判过 ⇒ web-unmapped-increase(留空不是"没缺口")',
    pass: (() => {
      const j = judge({
        conversion: mkConv(),
        fidelity: mkFid(),
        coverage: mk(91, 0, 0),
        webParity: mk(91, 0, 0, 275, 291),
        doc: '',
        prev: { mirrored: 91, aligned: 275, unmapped: 270 },
      })
      return j.reasons.some(
        (r) => r.dim === 'web-unmapped-increase' && /aligned \/ gap \/ excluded/.test(r.detail),
      )
    })(),
  })
  let bad = 0
  for (const c of cases) {
    if (!c.pass) bad++
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}`)
  }
  console.log(
    bad === 0
      ? `SELF-TEST PASS ${cases.length}/${cases.length}`
      : `SELF-TEST FAIL ${bad}/${cases.length}`,
  )
  process.exit(bad === 0 ? 0 : 1)
}

function main() {
  const coverage = runRuler('check-cross-end-screen-coverage.mjs')
  const webParity = runRuler('check-web-rn-screen-parity.mjs', ['--json', '--full'])
  const fidelity = runRuler('check-miniapp-mirror-fidelity.mjs')
  // 转换机会只跑**预演**(不带 --apply):器物自己说"落地还要同批改声明件",那一形态未装车,
  // 所以这里只把机会喊出来并给全两条命令,不自作主张改端内源文件。
  const conversion = runRuler('upgrade-miniapp-shell-pages.mjs')
  const doc = (() => {
    try {
      return execFileSync('git', ['show', `HEAD:${DOC_PATH}`], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        maxBuffer: 1 << 22,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch {
      return ''
    }
  })()
  const prev = readPrev()
  const result = judge({ coverage, webParity, fidelity, conversion, doc, prev })
  result.at = new Date().toISOString()
  if (recordMode) {
    mkdirSync(dirname(STATE_FILE), { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(result, null, 2) + '\n', 'utf8')
    result.recorded = true
  }
  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`STATE=${result.state}`)
    console.log(
      `现读:镜像 ${result.cur?.mirrored ?? '?'} / 登记 ${result.cur?.registryEntries ?? '?'} / web aligned ${result.cur?.aligned ?? '?'} / unmapped ${result.cur?.unmapped ?? '?'} / 还原度: 承载 ${result.cur?.fidelityHosted ?? '?'} 手写 ${result.cur?.fidelityHand ?? '?'} 未还原键 ${result.cur?.fidelityMissing ?? '?'} 断链 ${result.cur?.fidelityBroken ?? '?'} 声明不符 ${result.cur?.fidelityOther ?? '?'}`,
    )
    if (result.why) console.log(`未判定原因:${result.why}`)
    for (const r of result.reasons || []) console.log(`· ${r.dim} —— ${r.detail}`)
  }
  process.exit(result.state === 'regressed' ? 1 : result.state === 'undetermined' ? 2 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (selfTest) selfTestMain()
  else main()
}

export const __test__ = { judge, docNumbers, DOC_PATH }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
