// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * store-uploader-core.mjs — 国内商店上传器的**共用骨架层**(2026-11-09 立)
 *
 * 立因(不是预防):`scripts/submit-store-huawei.mjs` 已把"凭据三态 + 默认 dry-run + 上传后回读"
 * 那一套跑通,但其余各家(小米/OPPO/vivo/荣耀/应用宝)若各写一份,漂移点必然落在三处最要动的地方:
 *   ① 提交物与材料包取材(都该走 `prepare-store-bundle.mjs` 的产物,不是各自拼路径);
 *   ② 退出码语义(§0.3:取不到输入 ⇒ 2 未判定,绝不记绿也不冒红);
 *   ③ 端点形态出处(必须回 `probe-store-channel.mjs` 的 CHANNELS 单源,§0.6)。
 * 本层只承担这三件事,**不含任何厂商专属的签名算法** —— 那是各 `submit-store-<id>.mjs` 的正文。
 *
 * 红线:
 *   - 本层默认零网络、零写盘(全部 IO 由调用方注入)。
 *   - 秘密值一律不出现在返回值摘要里:只出 sha8 / 长度 / 字段名(§5d)。
 *   - 端点未核实的段 ⇒ 结构上拿不到可调用形态(`unverifiedCall()` 恒返回零调用),
 *     不做"先打个猜的 URL 看看"那类事(§0.8)。
 *
 * 用法(调用方形态,不单独跑):见任一 `scripts/submit-store-<id>.mjs`。
 * 自检:`node scripts/lib/store-uploader-core.mjs --self-test`
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { STATUS, androidArtifacts, fp } from './rn-release-credentials.mjs'
import { CHANNELS } from '../probe-store-channel.mjs'

const ROOT = join(import.meta.dirname, '..', '..')

/** prepare-store-bundle 的产物落点(§15 临时物纪律;上传器只读它,不重写它)。 */
export const BUNDLE_DIR_REL = join('.ihui-agent', 'tmp', 'store-bundle')
export const BUNDLE_FILES = Object.freeze(['listing.json', 'privacy-compliance.json', 'manifest.json'])

/** 端点形态单源:调用方不得再抄一份 URL 字符串(§0.6/§22c)。 */
export function channelOf(vendorId) {
  const ch = CHANNELS[vendorId]
  if (!ch) return { status: STATUS.UNJUDGED, channel: null, detail: `probe-store-channel.CHANNELS 无「${vendorId}」条目 ⇒ 端点形态未在册,不判"没有通道"` }
  return { status: STATUS.FOUND, channel: ch, detail: ch.label }
}

/**
 * 材料包取材:三件齐且可解析才算 FOUND。
 * MISSING = 目录在而件缺(要先跑 prepare-store-bundle --write);UNJUDGED = 连目录/解析都拿不到。
 */
export function loadBundle({ vendor, root = ROOT, read = readFileSync, exists = existsSync } = {}) {
  const dir = join(root, BUNDLE_DIR_REL, vendor)
  if (!exists(dir)) return { status: STATUS.MISSING, dir, files: null, detail: `材料包目录不存在:${join(BUNDLE_DIR_REL, vendor).replace(/\\/g, '/')} ⇒ 先跑 node scripts/prepare-store-bundle.mjs --vendor ${vendor} --write` }
  const out = {}
  const gaps = []
  const digests = []
  for (const name of BUNDLE_FILES) {
    const p = join(dir, name)
    if (!exists(p)) {
      gaps.push(name)
      continue
    }
    try {
      const text = read(p, 'utf8')
      out[name.replace(/\.json$/, '')] = JSON.parse(text)
      digests.push(`${name}:${fp(text)}`)
    } catch (e) {
      gaps.push(`${name}(解析失败 ${e?.name ?? ''})`)
    }
  }
  if (gaps.length) return { status: STATUS.MISSING, dir, files: out, detail: `材料包不齐:${gaps.join(', ')}` }
  return { status: STATUS.FOUND, dir, files: out, detail: `三件齐备 ${digests.join(' ')}` }
}

/** 从 androidArtifacts() 的清单里按档位取;取不到 ⇒ MISSING 点名"需要一次 assembleRelease",不回落另一档。 */
export function pickArtifact(list, preferKind) {
  if (!Array.isArray(list)) return { status: STATUS.UNJUDGED, picked: null, detail: '产物清单取不到 ⇒ 不判"没有产物"' }
  if (!preferKind) return { status: STATUS.FOUND, picked: list[0], detail: `未点名档位,取第一条 ${list[0]?.kind}` }
  const p = list.find((x) => x.kind === preferKind)
  if (!p) return { status: STATUS.MISSING, picked: null, detail: `产物面有 ${list.map((x) => x.kind).join(',')} 但无 ${preferKind} ⇒ 需一次 gradle assembleRelease` }
  return { status: STATUS.FOUND, picked: p, detail: `${p.kind}=${p.bytes}B` }
}

/**
 * 提交物取材:显式 --file 优先;否则走 androidArtifacts() 出口(不自拼路径)。
 * 0 字节算 MISSING(产物存在但空 = 真缺),读不到 stat 算 UNJUDGED(不冒充"没有产物")。
 * preferKind:国内各家商店基本只收 APK(华为两家都收)⇒ 让调用方点名要哪一档,
 * 而不是拿到 androidArtifacts() 的第一条(现读该出口 aab 在前)就默认传 aab。
 */
export function resolveArtifact({ file = null, artifactsDir, preferKind = null, read = readFileSync, stat = statSync } = {}) {
  if (file) {
    let st = null
    try {
      st = stat(file)
    } catch (e) {
      return { status: STATUS.UNJUDGED, detail: `显式产物取不到(${e?.code ?? e?.name}):${file}`, value: null }
    }
    if (!st.size) return { status: STATUS.MISSING, detail: `产物 0 字节:${file}`, value: null }
    const buf = read(file)
    return { status: STATUS.FOUND, detail: `${file.split('/').pop()} ${st.size}B md5=${createHash('md5').update(buf).digest('hex')} sha256=${createHash('sha256').update(buf).digest('hex').slice(0, 16)}`, value: { path: file.replace(/\\/g, '/'), bytes: st.size, md5: createHash('md5').update(buf).digest('hex') } }
  }
  const a = androidArtifacts(artifactsDir ? { dir: artifactsDir } : {})
  if (a.status !== STATUS.FOUND) return { ...a, value: null }
  const pk = pickArtifact(a.value, preferKind)
  if (pk.status !== STATUS.FOUND) return { status: pk.status, detail: pk.detail, value: null }
  return { status: STATUS.FOUND, detail: `${pk.picked.kind}=${pk.picked.path} ${pk.picked.bytes}B`, value: { path: pk.picked.path, bytes: pk.picked.bytes, kind: pk.picked.kind } }
}

/**
 * 未核实端点的**唯一出口**:返回零调用记录,绝不给可执行 URL。
 * 返回形状与"调用过了"保持一致,便于折叠退出码。
 */
export function unverifiedCall({ phase, reason, doc }) {
  return { phase, status: STATUS.UNJUDGED, verdict: 'endpoint-unverified-zero-call', detail: `端点形态未核实 ⇒ 本段一次请求都不发(${reason})${doc ? ` — 出处待补:${doc}` : ''}`, calls: [] }
}

/** dry-run 计划:把"凭据到位后真要打的那几条"摆出来,但默认不发一条请求。 */
export function buildDryRun({ vendorId, creds, artifact, bundle, calls, manualOnly = false, whyManual = null }) {
  const rows = calls.map((c) => (c.verified === false ? `[零调用·端点未核实] ${c.intent}` : `[计划] ${c.method ?? 'GET'} ${c.url}`))
  return {
    vendor: vendorId,
    verdict: manualOnly ? 'manual-channel' : 'dry-run',
    detail: manualOnly ? `官方无自动上传通路 ⇒ 不伪造 API:${whyManual ?? ''}` : '未发任何请求(加 --execute 才出网)',
    credential: creds?.detail ?? null,
    artifact: artifact?.detail ?? null,
    bundle: bundle?.detail ?? null,
    calls: rows,
  }
}

/**
 * 退出码折叠(§0.3 铁律的顺序):未判定 2 > 缺件 1 > 全绿 0。
 * 未判定必须赢过缺件 —— 把"我取不到输入"报成"你缺凭据"是推责,不是判据。
 */
export function foldExit(states = []) {
  if (!states.length) return 2
  if (states.includes(STATUS.UNJUDGED)) return 2
  if (states.includes(STATUS.MISSING)) return 1
  return 0
}

export function describeStates(states = []) {
  const c = { found: 0, missing: 0, unjudged: 0 }
  for (const s of states) c[s === STATUS.FOUND ? 'found' : s === STATUS.MISSING ? 'missing' : 'unjudged']++
  return c
}

/**
 * 各 submit-store-* 共用的离线自检台:用例 = {名称, 断言()=>true|false|Promise}。
 * 只判返回值,绝不发真实请求、绝不写盘 ⇒ 任何机器上都能跑。
 * **异步用例必须被 await**:直接把 Promise 当"truthy ⇒ 通过"会让失败静默变绿
 * (本仓反复要防的"判据安静失效"型),这里显式 await 并拒绝非布尔结论。
 */
export async function runSelfTest(cases) {
  let bad = 0
  for (const { name, fn } of cases) {
    try {
      const raw = await fn()
      if (raw === true || typeof raw === 'string') {
        console.log(`  ✅ ${name}${typeof raw === 'string' ? ` — ${raw}` : ''}`)
      } else {
        bad++
        console.log(`  ❌ ${name}${raw === false ? '' : ` — 结论非布尔(收到 ${String(raw)})⇒ 按失败算,不当绿`}`)
      }
    } catch (e) {
      bad++
      console.log(`  ❌ ${name} — ${String(e?.message).slice(0, 120)}`)
    }
  }
  console.log(`SELF-TEST cases=${cases.length} pass=${cases.length - bad} fail=${bad}`)
  return bad === 0 ? 0 : 1
}

/** 脱敏:任何 id/secret 出 stdout 前都过这里(env 形态的那一枚也必须遮)。 */
export function mask(v) {
  const s = String(v ?? '')
  if (!s) return '<空>'
  return `${s.slice(0, 4)}***${s.slice(-2)}(len=${s.length})`
}

/** 法定前置台账(唯一判据出口,§0.6):与 prepare-store-bundle.buildPlan 同一折叠顺序。 */
export const LEGAL_LEDGER_REL = 'scripts/data/app-store-credentials.json'

/** 每格 found 还必须带的证据字段(编号或证据件);缺 ⇒ 未判定,不记绿。 */
export const LEGAL_EVIDENCE_FIELD = Object.freeze({
  appIcpFiling: 'appFilingNumber',
  softwareCopyright: 'certificateNumber',
  securityAssessment: 'files',
})

/**
 * 折出某店的法定前置三态。是否对本店生效,由台账每格自己的 requiredByStores 决定 ——
 * 不在这里另抄一份"哪些店要软著"的表(抄一次就多一份真相)。
 * - 台账读不到/解析失败/缺 legalPrereqs ⇒ 未判定(不判"没有资质")
 * - statusNow=found 但证据字段空 ⇒ 未判定(账面 found 不等于在册)
 * - missing / missing-evidence / missing-credential ⇒ 缺件
 * - 该店不在任何格的 requiredByStores ⇒ 全绿且明说"本店无适用法定前置"
 */
export function resolveStoreLegalPrereqs({ store, root = ROOT, read = readFileSync, exists = existsSync } = {}) {
  const p = join(root, LEGAL_LEDGER_REL)
  if (!exists(p)) return { status: STATUS.UNJUDGED, detail: `${LEGAL_LEDGER_REL} 不存在 ⇒ 法定前置未判定`, cells: [] }
  let j
  try {
    j = JSON.parse(read(p, 'utf8'))
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `${LEGAL_LEDGER_REL} 解析失败(${e?.name ?? 'Error'})⇒ 未判定`, cells: [] }
  }
  const lp = j?.legalPrereqs
  if (!lp || typeof lp !== 'object') return { status: STATUS.UNJUDGED, detail: `${LEGAL_LEDGER_REL} 无 legalPrereqs ⇒ 未判定`, cells: [] }
  const rows = []
  for (const [key, evidenceField] of Object.entries(LEGAL_EVIDENCE_FIELD)) {
    const cell = lp[key]
    if (!cell) {
      rows.push({ key, status: STATUS.UNJUDGED, detail: `台账缺 legalPrereqs.${key} ⇒ 未判定` })
      continue
    }
    if (!(Array.isArray(cell.requiredByStores) && cell.requiredByStores.includes(store))) continue
    const now = String(cell.statusNow ?? '').trim()
    const evidence = cell[evidenceField]
    const hasEvidence = Array.isArray(evidence) ? evidence.length > 0 : String(evidence ?? '').trim().length > 0
    if (now === 'found' && hasEvidence) rows.push({ key, status: STATUS.FOUND, detail: '在册' })
    else if (now === 'found') rows.push({ key, status: STATUS.UNJUDGED, detail: `statusNow=found 但缺 ${evidenceField} ⇒ 未判定` })
    else if (now === 'missing' || now === 'missing-evidence' || now === 'missing-credential') rows.push({ key, status: STATUS.MISSING, detail: `statusNow=${now} ⇒ 缺件` })
    else rows.push({ key, status: STATUS.UNJUDGED, detail: `statusNow=${now || '(空)'} ⇒ 未判定` })
  }
  if (!rows.length) return { status: STATUS.FOUND, detail: `台账无任何一格把「${store}」列为 requiredByStores ⇒ 本店无适用法定前置`, cells: [] }
  const exit = foldExit(rows.map((r) => r.status))
  return { status: exit === 2 ? STATUS.UNJUDGED : exit === 1 ? STATUS.MISSING : STATUS.FOUND, detail: rows.map((r) => `${r.key}=${r.status}(${r.detail})`).join('; '), cells: rows }
}

/** 供各上传器共用:把"凭据/产物/材料包/通道"四格收成一行读数打印,并给退出码。法定前置有值时追加第五格。 */
export function gateStates({ creds, artifact, bundle, channel, legal = null }) {
  const rows = [
    { k: '开发者凭据', ...creds },
    { k: '提交物', ...artifact },
    { k: '材料包(prepare-store-bundle 产物)', ...bundle },
    { k: '通道端点形态', ...channel },
    ...(legal ? [{ k: '法定前置', status: legal.status, detail: legal.detail }] : []),
  ]
  return { rows, exit: foldExit(rows.map((r) => r.status)) }
}

export const __test__ = { STATUS, BUNDLE_DIR_REL, BUNDLE_FILES, channelOf, pickArtifact, loadBundle, resolveArtifact, unverifiedCall, buildDryRun, foldExit, describeStates, runSelfTest, mask, gateStates, resolveStoreLegalPrereqs, LEGAL_LEDGER_REL, LEGAL_EVIDENCE_FIELD, fp }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  if (!process.argv.includes('--self-test')) {
    console.info('本层是共用骨架,不单独执行。请跑 scripts/submit-store-<id>.mjs;或加 --self-test 自检本层判据。')
    process.exit(2)
  }
  // runSelfTest 现在是 async:必须等它跑完再取退出码
  // (直接 process.exit(promise) 会被 Node 当 0 立即退出 = 假绿,§0.3)。
  runSelfTest([
      { name: 'foldExit 未判定压过缺件(§0.3)', fn: () => foldExit([STATUS.MISSING, STATUS.UNJUDGED]) === 2 },
      { name: 'foldExit 全绿=0 / 缺件=1 / 空集=2', fn: () => foldExit([STATUS.FOUND]) === 0 && foldExit([STATUS.FOUND, STATUS.MISSING]) === 1 && foldExit([]) === 2 },
      { name: 'channelOf 在册厂商给 FOUND 且带 label', fn: () => channelOf('xiaomi').status === STATUS.FOUND && !!channelOf('xiaomi').channel.label },
      { name: 'channelOf 不在册 ⇒ 未判定,不判"无通道"', fn: () => channelOf('apkpure').status === STATUS.UNJUDGED },
      { name: 'unverifiedCall 恒零调用', fn: () => { const r = unverifiedCall({ phase: 'upload', reason: 'x', doc: 'y' }); return r.calls.length === 0 && r.verdict === 'endpoint-unverified-zero-call' && r.status === STATUS.UNJUDGED } },
      { name: 'mask 不返回原文,只出前4+后2+长度', fn: () => { const m = mask('SECRET-VALUE-12345'); return m === 'SECR***45(len=18)' } },
      { name: 'loadBundle 目录不存在 ⇒ MISSING 且给出 prepare-store-bundle 出路', fn: () => { const r = loadBundle({ vendor: 'nope-not-here', exists: () => false }); return r.status === STATUS.MISSING && r.detail.includes('prepare-store-bundle') } },
      { name: 'loadBundle 三件齐 ⇒ FOUND(注入假 IO,不碰磁盘)', fn: () => { const j = JSON.stringify({ ok: 1 }); const r = loadBundle({ vendor: 'v', exists: () => true, read: () => j }); return r.status === STATUS.FOUND && r.files.listing.ok === 1 } },
      { name: 'loadBundle 解析失败 ⇒ MISSING 并点名坏件', fn: () => { const r = loadBundle({ vendor: 'v', exists: () => true, read: () => '{坏 json' }); return r.status === STATUS.MISSING && r.detail.includes('listing.json') } },
      { name: 'resolveArtifact 0 字节 ⇒ MISSING(不冒充有产物)', fn: () => resolveArtifact({ file: '/x.apk', stat: () => ({ size: 0 }), read: () => Buffer.alloc(0) }).status === STATUS.MISSING },
      { name: 'pickArtifact 点名 apk 而面只有 aab ⇒ MISSING 并给 assembleRelease 出路(不回落 aab)', fn: () => { const r = pickArtifact([{ kind: 'aab', path: 'a', bytes: 1 }], 'apk'); return r.status === STATUS.MISSING && r.detail.includes('assembleRelease') } },
      { name: 'pickArtifact 命中档位 ⇒ FOUND;清单非数组 ⇒ 未判定不判"没产物"', fn: () => pickArtifact([{ kind: 'apk', path: 'a', bytes: 2 }], 'apk').status === STATUS.FOUND && pickArtifact(null, 'apk').status === STATUS.UNJUDGED },
      { name: 'resolveArtifact stat 取不到 ⇒ UNJUDGED', fn: () => resolveArtifact({ file: '/x.apk', stat: () => { throw Object.assign(new Error('enoent'), { code: 'ENOENT' }) } }).status === STATUS.UNJUDGED },
      { name: 'buildDryRun 未核实段只出"零调用"字样,不出可执行 URL', fn: () => { const d = buildDryRun({ vendorId: 'x', calls: [{ intent: '上传', verified: false }] }); return d.calls.length === 1 && d.calls[0].includes('零调用') && !d.calls[0].includes('http') } },
      { name: 'gateStates 四格齐绿才 0,任一格未判定即 2', fn: () => { const cell = (status) => ({ status, detail: '' }); const ok = gateStates({ creds: cell(STATUS.FOUND), artifact: cell(STATUS.FOUND), bundle: cell(STATUS.FOUND), channel: cell(STATUS.FOUND) }).exit; const bad = gateStates({ creds: cell(STATUS.UNJUDGED), artifact: cell(STATUS.FOUND), bundle: cell(STATUS.FOUND), channel: cell(STATUS.FOUND) }).exit; return ok === 0 && bad === 2 } },
      { name: 'gateStates legal 格参与折叠:缺件 ⇒ 1,未判定 ⇒ 2,缺省不添第五格', fn: () => { const cell = (status) => ({ status, detail: '' }); const base = { creds: cell(STATUS.FOUND), artifact: cell(STATUS.FOUND), bundle: cell(STATUS.FOUND), channel: cell(STATUS.FOUND) }; return gateStates({ ...base, legal: cell(STATUS.MISSING) }).exit === 1 && gateStates({ ...base, legal: cell(STATUS.UNJUDGED) }).exit === 2 && gateStates(base).rows.length === 4 && gateStates({ ...base, legal: cell(STATUS.FOUND) }).rows.some((r) => r.k === '法定前置') } },
      { name: 'resolveStoreLegalPrereqs:三格齐 found ⇒ FOUND;安评缺 ⇒ MISSING;台账读不到 ⇒ 未判定', fn: () => {
        const mk = (over = {}) => JSON.stringify({ legalPrereqs: {
          appIcpFiling: { statusNow: 'found', appFilingNumber: '吉ICP备2025027274号-7A', requiredByStores: ['vivo'] },
          softwareCopyright: { statusNow: 'found', certificateNumber: '2025SR1904590', requiredByStores: ['vivo'] },
          securityAssessment: { statusNow: 'found', files: ['a.png'], requiredByStores: ['vivo'] },
          ...over,
        } })
        const ok = resolveStoreLegalPrereqs({ store: 'vivo', read: () => mk() })
        const noAssess = resolveStoreLegalPrereqs({ store: 'vivo', read: () => mk({ securityAssessment: { statusNow: 'missing-evidence', requiredByStores: ['vivo'] } }) })
        const unread = resolveStoreLegalPrereqs({ store: 'vivo', read: () => { throw Object.assign(new Error('x'), { name: 'ENOENT' }) } })
        return ok.status === STATUS.FOUND && noAssess.status === STATUS.MISSING && /securityAssessment/.test(noAssess.detail) && unread.status === STATUS.UNJUDGED
      } },
    ]).then((code) => process.exit(code))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
