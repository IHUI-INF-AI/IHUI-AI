#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 运维尺子,结论必须走 stdout(与 check-asset-path-health / check-sms-channel-health 同档) */

/**
 * check-aasa-public-health.mjs —— AASA(apple-app-site-association)公网可达 + 内容一致性**只读哨兵**(2026-10-28 立)
 *
 * 立因:台账 G-100 那一族票写着「剩"微信开放平台 UniversalLink 填写"归机主面」,但其中
 * **AASA / file.aizhs.top 的公网复核这一格 agent 侧本来就能做** —— 此前只有"人肉 curl 一次",
 * 没有器物,下次还得再靠人。本器把这格变成可重复跑、三态分明的尺子:
 *   ① 靶清单不硬编码,由 App 自己的声明面推出(`apps/mobile-rn/app.json` 的 `ios.associatedDomains`,
 *      与 `scripts/data/public-path-legs.json` 同一条纪律:靶必须有仓内出处,不许凭记忆钉)。
 *   ② 期望形状不复抄第二份:动态导入唯一真相源
 *      `packages/shared/src/constants/apple-app-site-association.ts`(它的 components / 占位 Team /
 *      Content-Type 直接来自源函数的产出);导入不了 ⇒ 该维**未判定**,不回落成代码里另写一份期望。
 *   ③ 内容一致性判到:JSON 可解析 ∧ `applinks.details` 非空 ∧ components **序列逐项等值**(源文件注
 *      「顺序即匹配优先级」)∧ appIDs 形态 `<Team>.<Bundle>` ∧ Bundle 段 == app.json 的
 *      `bundleIdentifier` ∧ 体积 < 128KB(Apple 上限,docs/IOS_UNIVERSAL_LINK_DEPLOY.md §3)∧
 *      Content-Type 以 application/json 起头 ∧ **各腿彼此逐字节同形**(某腿发占位、某腿发真值即红)。
 *   ④ Team ID 只判**形态**不判真伪:`^[A-Z0-9]{10}` = 真值形态(记 ok,不担保它是对的 Team)、
 *      等于单源占位符 = warn 并点名「归机主面」。**微信开放平台 UniversalLink 的填写、真实
 *      APPLE_TEAM_ID 本身**这两格是机主专有,本器结构上判不了,也不冒充判了。
 *
 * 三态硬要求(§0.3「没判绝不写成判过」):
 *   breach   对端可归因且不整改就是 Apple 校验不过:终页 404/410(路径没服务)、非 JSON MIME、
 *            体不是 JSON、形状/序列/Bundle 段与单源不符、超 128KB、跨注册域重定向、重定向掉到 http、
 *            5xx、TCP 拒连/复位、腿间内容分叉、associatedDomains 枚举为 0、WX_UNIVERSAL_LINK 三处不一致。
 *   unjudged 取不到输入即此档:本机读不到声明文件 / 单源导入不了(需 Node ≥22.18 的类型剥离)、
 *            DNS 解析失败、TLS 握手失败、连接或响应超时(§5d「网络不可达 ≠ 无效」同一条禁令)、
 *            同域 3xx 跟不完、其余 4xx(边缘或路由语义都能答,不证明回源)、尺子自己失明、
 *            **没跑到那一腿(样本为 null)**。绝不记绿也不冒红。
 *   ok       以上皆无(占位 Team 只降 warn,不改判"能不能访问")。
 * 禁止用「HTTP 0」「没测到」冒充「正常」;枚举到 0 个候选判死,不记绿。
 *
 * 定级:**warn / 纯只读**。刻意**不接提交链、不接 CI**(§12e:判公网与本机出口此刻的可达性,
 * 提交者结构上满足不了,挂 blocking 就是人人 `--no-verify` 连带废掉全部守门)。唯一派发点应是
 * `scripts/git-guardian.mjs` 巡检轮(照 `auditAssetPathHealth` 那一档接线),本器自身
 * **零写入、不发信、不自拼 SMTP**(守门 81)。
 *
 * 用法:
 *   node scripts/check-aasa-public-health.mjs              # 人读(真跑一次公网探测)
 *   node scripts/check-aasa-public-health.mjs --json       # 机读三态(git-guardian / 看板用)
 *   node scripts/check-aasa-public-health.mjs --url <url>  # 追加一枚探测靶(https;值被吞 ⇒ 用法错 exit 2)
 *   node scripts/check-aasa-public-health.mjs --skip-probe # 只判本机声明面:公网维如实落 unjudged,**永不冒绿**
 *   node scripts/check-aasa-public-health.mjs --timeout-ms <n> / --max-hops <n>
 *   node scripts/check-aasa-public-health.mjs --self-test  # 构造面正反对照(唯一不触网的一档)
 * 退出码:0 = ok/warn(已判定) / 1 = breach / 2 = 未判定或用法错。
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { requireFlagValue } from './lib/flag-value.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

/** Apple 强制路径:无扩展名、只在 .well-known/ 下(docs/IOS_UNIVERSAL_LINK_DEPLOY.md §2)。 */
export const AASA_PATH = '/.well-known/apple-app-site-association'
/** Apple 上限 128KB(同一份文档 §3 服务器要求表)。 */
export const AASA_MAX_BYTES = 128 * 1024
/** 真值形态:10 位大写字母数字。**只判形态,不担保这个 Team 归属正确**(那格归机主面)。 */
export const REAL_TEAM_ID_RE = /^[A-Z0-9]{10}$/
export const APP_JSON_FILE = join(ROOT, 'apps', 'mobile-rn', 'app.json')
export const RN_STATIC_AASA_FILE = join(
  ROOT,
  'apps',
  'mobile-rn',
  'public',
  '.well-known',
  'apple-app-site-association',
)
export const SHARED_AASA_SOURCE = join(
  ROOT,
  'packages',
  'shared',
  'src',
  'constants',
  'apple-app-site-association.ts',
)
export const LEG_MAX_HOPS_DEFAULT = 3
export const TIMEOUT_MS_DEFAULT = 15000

/* ---------- 纯判据层(零 IO、零网络;自检与镜像测试直接喂构造数据) ---------- */

/** Content-Type 必须是 application/json(带 charset/大小写混排都算过;Fastify 默认推断会退成 text/plain)。 */
export function judgeContentType(value) {
  const v = String(value ?? '')
    .trim()
    .toLowerCase()
  if (!v)
    return {
      state: 'breach',
      code: 'content-type-missing',
      detail: '响应没有 Content-Type 头 ⇒ Apple 按非 JSON 拒收',
    }
  if (!v.startsWith('application/json'))
    return {
      state: 'breach',
      code: 'content-type',
      detail: `Content-Type 实得 "${v}"(须以 application/json 起头)`,
    }
  return { state: 'ok' }
}

/** appIDs 元素形态:`<Team>.<Bundle>`;Team 段分真值形态/占位/坏形态三档。 */
export function classifyAppId(raw, placeholderTeamId) {
  const s = String(raw ?? '').trim()
  const dot = s.indexOf('.')
  if (dot <= 0 || dot === s.length - 1)
    return {
      state: 'breach',
      code: 'appid-form',
      detail: `appID "${s || '(空)'}" 不是 <TeamID>.<BundleID> 形态`,
    }
  const team = s.slice(0, dot)
  const bundle = s.slice(dot + 1)
  if (team === String(placeholderTeamId))
    return {
      state: 'warn',
      code: 'team-placeholder',
      detail: `appID "${s}" 的 Team 段是单源占位符 ⇒ UniversalLink 真机校验会被 iOS 拒;该格归机主面(真实 APPLE_TEAM_ID),本器只报形态不代判`,
      team,
      bundle,
    }
  if (REAL_TEAM_ID_RE.test(team)) return { state: 'ok', team, bundle }
  return {
    state: 'breach',
    code: 'appid-team-form',
    detail: `appID "${s}" 的 Team 段 "${team}" 既非占位符也非 10 位大写形态`,
    team,
    bundle,
  }
}

/**
 * 一份 AASA 响应体的内容一致性判定。期望形状必须来自单源(§0.6);取不到期望 ⇒ 未判定,
 * **不得**因为"能解析成 JSON"就记绿。
 * @param {{text:string, expected:?{components:string[],placeholderTeamId:string,defaultBundleId:string}, maxBytes?:number, bundleId?:string}} p
 */
export function judgeAasaBody({ text, expected, maxBytes = AASA_MAX_BYTES, bundleId = null }) {
  const bytes = Buffer.byteLength(String(text ?? ''), 'utf8')
  if (!expected || !Array.isArray(expected.components)) {
    return {
      state: 'unjudged',
      why: `期望形状(共享单源)未取到 ⇒ 内容一致性维未判定(不回落成代码里另抄一份期望)`,
      facts: { bytes },
    }
  }
  const faults = []
  const placeholderIds = []
  const facts = { bytes, appIds: [], components: [], teamForms: [] }
  if (bytes > maxBytes)
    faults.push({ code: 'oversize', detail: `响应体 ${bytes}B > Apple 上限 ${maxBytes}B` })
  let doc = null
  try {
    doc = JSON.parse(String(text))
  } catch (e) {
    faults.push({
      code: 'not-json',
      detail: `响应体不是合法 JSON:${String(e && e.message).slice(0, 120)}`,
    })
  }
  if (doc) {
    const details =
      doc && doc.applinks && Array.isArray(doc.applinks.details) ? doc.applinks.details : null
    if (!details)
      faults.push({
        code: 'missing-applinks',
        detail: '缺 applinks.details 数组(Apple 校验的第一步就是它)',
      })
    else if (details.length === 0)
      faults.push({
        code: 'empty-details',
        detail: 'applinks.details 枚举为 0 ⇒ 判死,不得记绿(§0.3)',
      })
    else {
      for (const d of details) {
        const comps = Array.isArray(d && d.components)
          ? d.components.map((c) =>
              c && typeof c === 'object' && typeof c['/'] === 'string'
                ? c['/']
                : `(${JSON.stringify(c)})`,
            )
          : null
        if (!comps)
          faults.push({ code: 'components-missing', detail: 'details[].components 不是数组' })
        else {
          facts.components.push(comps.join(','))
          if (JSON.stringify(comps) !== JSON.stringify(expected.components)) {
            faults.push({
              code: 'components-mismatch',
              detail: `components 序列实得 [${comps.join(', ')}] ≠ 单源 [${expected.components.join(', ')}](顺序即匹配优先级)`,
            })
          }
        }
        const ids = Array.isArray(d && d.appIDs) ? d.appIDs : null
        if (!ids || ids.length === 0)
          faults.push({
            code: 'appids-missing',
            detail: 'details[].appIDs 缺失或为空数组 ⇒ 没有可校验的 App',
          })
        else {
          for (const id of ids) {
            const c = classifyAppId(id, expected.placeholderTeamId)
            facts.appIds.push(String(id))
            facts.teamForms.push(
              c.state === 'ok' ? 'real-form' : c.state === 'warn' ? 'placeholder' : 'malformed',
            )
            if (c.state === 'breach') faults.push({ code: c.code, detail: c.detail })
            else if (c.state === 'warn') {
              facts.placeholder = true
              placeholderIds.push(String(id))
            }
            if (bundleId && c.bundle && c.bundle !== bundleId)
              faults.push({
                code: 'appid-bundle-mismatch',
                detail: `appID 的 Bundle 段 "${c.bundle}" ≠ app.json 声明的 "${bundleId}"`,
              })
          }
        }
      }
    }
  }
  if (faults.length > 0) return { state: 'breach', faults, facts }
  if (facts.placeholder) {
    return {
      state: 'warn',
      faults: [
        {
          code: 'team-placeholder',
          detail: `appID [${placeholderIds.join(', ')}] 的 Team 段是单源占位符 ⇒ UniversalLink 真机校验会被 iOS 拒;该格归机主面(真实 APPLE_TEAM_ID),本器只报形态不代判真伪`,
        },
      ],
      facts,
    }
  }
  return { state: 'ok', facts }
}

/** 粗粒度注册域(取末两段):本器只用它判"重定向有没有离开 Apple 允许的同一域",不做 PSL 精确匹配。 */
export function registrableDomain(host) {
  const h = String(host ?? '')
    .toLowerCase()
    .replace(/\.$/, '')
  const parts = h.split('.')
  return parts.length <= 2 ? h : parts.slice(-2).join('.')
}

/** 一次传输层样本(由 probeAasaUrl 产出;null = 尺子没跑到这一腿)。 */
export function judgeLegOutcome({ leg, outcome, expected, bundleId }) {
  const url = leg && leg.url
  if (!outcome)
    return {
      state: 'unjudged',
      code: 'no-sample',
      detail: `该腿没有任何探测样本(${url})⇒ 未判定(绝不读成 200,也不读成坏了)`,
      leg,
    }
  if (outcome.kind !== 'status') {
    const stageMap = {
      dns: {
        state: 'unjudged',
        code: 'egress-dns',
        detail: 'DNS 解析失败(本机出口/解析器问题,不证明对端坏)',
      },
      tls: {
        state: 'unjudged',
        code: 'egress-tls',
        detail: `TLS 握手失败(${outcome.detail || outcome.code || '原因未名'})`,
      },
      stall: {
        state: 'unjudged',
        code: 'egress-stall',
        detail: '连接/响应阶段超时或网络不可达(§5d:网络不可达 ≠ 无效)',
      },
      probeBlind: {
        state: 'unjudged',
        code: 'probe-blind',
        detail: `尺子自身失明:${outcome.detail || '(无原因)'}`,
      },
      conn: {
        state: 'breach',
        code: 'conn-refused',
        detail: `TCP 到对端被拒/复位(${outcome.code || 'ECONNREFUSED'})⇒ 源站或隧道腿不在听`,
      },
      insecureRedirect: {
        state: 'breach',
        code: 'insecure-redirect',
        detail: '重定向链掉到非 https ⇒ Apple 直接拒收该 AASA',
      },
      offDomainRedirect: {
        state: 'breach',
        code: 'redirect-off-domain',
        detail: `重定向离开注册域(${outcome.from} → ${outcome.to})⇒ 跨域重定向不在 Apple 允许范围`,
      },
      redirectUnresolved: {
        state: 'unjudged',
        code: 'redirect-unresolved',
        detail: `同域 3xx 在 ${outcome.hops ?? 0} 跳上限内没跟到终页 ⇒ 无法出具"200 + JSON"的证`,
      },
      status: { state: 'unjudged', code: 'no-sample', detail: '样本形状不可解 ⇒ 未判定' },
    }
    const m = stageMap[outcome.kind] || stageMap.probeBlind
    return { ...m, leg, detail: `${m.detail}(靶 ${url})` }
  }
  const status = Number(outcome.status)
  if (status === 404 || status === 410)
    return {
      state: 'breach',
      code: 'path-not-served',
      detail: `终页 ${status} ⇒ ${AASA_PATH} 未在该域提供服务(Apple 要 200)(靶 ${url})`,
      leg,
      status,
    }
  if (status >= 400 && status < 500)
    return {
      state: 'unjudged',
      code: 'unverified-answer',
      detail: `终页 ${status}:边缘/路由语义都能答,不证明回源拿到了 AASA(靶 ${url})`,
      leg,
      status,
    }
  if (status >= 500)
    return {
      state: 'breach',
      code: 'origin-5xx',
      detail: `终页 ${status} ⇒ 源站或隧道腿报错(靶 ${url})`,
      leg,
      status,
    }
  if (status >= 300)
    return {
      state: 'unjudged',
      code: 'redirect-unresolved',
      detail: `终页仍是 ${status}(靶 ${url})⇒ 未判定`,
      leg,
      status,
    }
  const ct = judgeContentType(outcome.contentType)
  if (ct.state === 'breach') return { ...ct, leg, status, detail: `${ct.detail}(靶 ${url})` }
  const body = judgeAasaBody({ text: outcome.body, expected, bundleId })
  if (body.state === 'breach')
    return {
      state: 'breach',
      code: 'content',
      faults: body.faults,
      facts: body.facts,
      raw: outcome.body,
      leg,
      status,
      detail: body.faults.map((f) => `${f.code}:${f.detail}`).join(' / ') + `(靶 ${url})`,
    }
  if (body.state === 'unjudged')
    return {
      state: 'unjudged',
      code: 'content-unjudged',
      detail: `${body.why}(靶 ${url})`,
      raw: outcome.body,
      leg,
      status,
    }
  if (body.state === 'warn')
    return {
      state: 'warn',
      code: 'team-placeholder',
      facts: body.facts,
      faults: body.faults,
      raw: outcome.body,
      leg,
      status,
      detail: `${body.faults[0].detail}(靶 ${url})`,
    }
  return {
    state: 'ok',
    facts: body.facts,
    raw: outcome.body,
    leg,
    status,
    hops: outcome.hops,
    detail: `200 + application/json + 与单源同构(${body.facts.bytes}B,重定向 ${outcome.hops ?? 0} 跳)`,
  }
}

/** 各腿内容必须逐字节同形:一份内容两个宿主,发占位/发真值分叉就是缺陷。 */
export function judgeLegConsistency(results) {
  // 只比"内容判过"的腿:5xx/坏体那一腿已由自己的维度点名(breach),再拉进来就是把一个故障记成两笔。
  const judged = results.filter(
    (r) => r && (r.state === 'ok' || r.state === 'warn') && typeof r.raw === 'string',
  )
  if (judged.length === 0)
    return { state: 'unjudged', detail: '没有任何一腿产出可比对的响应体 ⇒ 腿间一致性未判定' }
  if (judged.length === 1)
    return {
      state: 'unjudged',
      detail: `只有 ${judged.length} 腿产出可比对内容 ⇒ 一致性维缺对照面,未判定(不冒充判过)`,
    }
  const norm = judged.map((r) => ({
    host: r.leg && r.leg.host,
    text: String(r.raw).replace(/\r\n/g, '\n').trim(),
  }))
  const first = norm[0]
  const drift = norm.filter((n) => n.text !== first.text)
  if (drift.length > 0) {
    return {
      state: 'breach',
      code: 'leg-divergence',
      detail: `各腿 AASA 内容分叉:${[first.host, ...drift.map((d) => d.host)].join(' vs ')} 响应体不一致 ⇒ 至少一腿发的是陈旧/占位副本`,
    }
  }
  return { state: 'ok', detail: `${norm.length} 腿响应体逐字一致` }
}

/**
 * 本机声明面(零网络,applicable 判据):associatedDomains 推靶 + WX_UNIVERSAL_LINK 三处一致
 * + 部署副本(RN public/) 与单源同构。文本全部由调用方喂进来(镜像测试直接构造)。
 */
export function judgeLocalDeclarations({
  appJsonText,
  appJsonError,
  staticText,
  staticError,
  expected,
}) {
  const faults = []
  const facts = { hosts: [], bundleId: null, universalLink: null, staticFile: null }
  if (appJsonError)
    faults.push({
      state: 'unjudged',
      code: 'app-json-unreadable',
      detail: `app.json 读不到:${appJsonError}`,
    })
  let doc = null
  if (!appJsonError) {
    try {
      doc = JSON.parse(String(appJsonText))
    } catch (e) {
      faults.push({
        state: 'breach',
        code: 'app-json-not-json',
        detail: `app.json 不是合法 JSON:${String(e && e.message).slice(0, 100)}`,
      })
    }
  }
  const ios = doc && doc.expo && doc.expo.ios
  const extra = doc && doc.expo && doc.expo.extra
  if (doc && !ios)
    faults.push({
      state: 'unjudged',
      code: 'app-json-shape',
      detail: 'app.json 里没有 expo.ios 段 ⇒ 声明面未判定(不得读成"没有域名要判"就放过)',
    })
  if (ios) {
    facts.bundleId = typeof ios.bundleIdentifier === 'string' ? ios.bundleIdentifier : null
    if (!facts.bundleId)
      faults.push({
        state: 'breach',
        code: 'bundle-id-missing',
        detail: 'expo.ios.bundleIdentifier 缺失 ⇒ AASA 的 appID 后半段无人可对账',
      })
    const domains = Array.isArray(ios.associatedDomains) ? ios.associatedDomains : null
    if (!domains)
      faults.push({
        state: 'unjudged',
        code: 'associated-domains-missing',
        detail: 'expo.ios.associatedDomains 不是数组 ⇒ 靶清单未判定',
      })
    else if (domains.length === 0)
      faults.push({
        state: 'breach',
        code: 'associated-domains-empty',
        detail: 'associatedDomains 枚举为 0 而 App 仍带 UniversalLink 配置 ⇒ 判死(§0.3)',
      })
    else {
      for (const d of domains) {
        const m = /^applinks:([A-Za-z0-9._-]+)$/.exec(String(d).trim())
        if (!m)
          faults.push({
            state: 'breach',
            code: 'associated-domain-form',
            detail: `associatedDomains 条目 "${d}" 不是 applinks:<host> 形态`,
          })
        else facts.hosts.push(m[1])
      }
    }
    const ul = typeof extra === 'object' && extra ? extra.WX_UNIVERSAL_LINK : null
    facts.universalLink = ul || null
    if (!ul)
      faults.push({
        state: 'breach',
        code: 'wx-universal-link-missing',
        detail: 'expo.extra.WX_UNIVERSAL_LINK 缺失 ⇒ 微信 SDK 初始化无 UniversalLink(docs §7)',
      })
    else {
      let u = null
      try {
        u = new URL(String(ul))
      } catch {
        faults.push({
          state: 'breach',
          code: 'wx-universal-link-form',
          detail: `WX_UNIVERSAL_LINK "${ul}" 不是合法 URL`,
        })
      }
      if (u) {
        if (u.protocol !== 'https:')
          faults.push({
            state: 'breach',
            code: 'wx-universal-link-insecure',
            detail: `WX_UNIVERSAL_LINK "${ul}" 必须 https`,
          })
        if (!String(ul).endsWith('/'))
          faults.push({
            state: 'breach',
            code: 'wx-universal-link-slash',
            detail: `WX_UNIVERSAL_LINK "${ul}" 必须以 / 结尾(docs §7 明文)`,
          })
        if (facts.hosts.length > 0 && !facts.hosts.includes(u.hostname))
          faults.push({
            state: 'breach',
            code: 'wx-universal-link-domain',
            detail: `WX_UNIVERSAL_LINK 的域 "${u.hostname}" 不在 associatedDomains [${facts.hosts.join(', ')}] 里 ⇒ 三处不一致(docs §7)`,
          })
      }
    }
  }
  if (staticError) {
    faults.push({
      state: 'unjudged',
      code: 'static-copy-absent',
      detail: `部署副本读不到(${staticError})⇒ 该维未判定;副本已改由宿主动态提供时属正常,但不能当成已核对`,
    })
  } else if (typeof staticText === 'string') {
    facts.staticFile = 'present'
    if (expected) {
      const r = judgeAasaBody({ text: staticText, expected, bundleId: facts.bundleId })
      if (r.state === 'breach')
        faults.push(
          ...r.faults.map((f) => ({
            state: 'breach',
            code: `static-${f.code}`,
            detail: `部署副本与单源不符 —— ${f.detail}`,
          })),
        )
      else if (r.state === 'unjudged')
        faults.push({ state: 'unjudged', code: 'static-unjudged', detail: r.why })
      else if (r.state === 'warn')
        faults.push({
          state: 'warn',
          code: 'static-team-placeholder',
          detail: '部署副本的 Team 段仍是占位符 ⇒ 真机校验会被 iOS 拒(归机主面)',
        })
      else facts.staticFile = 'consistent'
    }
  }
  const state = faults.some((f) => f.state === 'breach')
    ? 'breach'
    : faults.some((f) => f.state === 'unjudged')
      ? 'unjudged'
      : faults.some((f) => f.state === 'warn')
        ? 'warn'
        : 'ok'
  return {
    state,
    faults,
    facts,
    detail: faults.map((f) => `${f.code}:${f.detail}`).join(' / ') || '声明面自洽',
  }
}

/** 汇总优先级:breach > unjudged > warn > ok(红了必须被看见,未判定不得被 warn/ok 洗掉)。 */
export function aggregate(dimensions) {
  const list = Object.entries(dimensions || {}).map(([k, v]) => ({
    dim: k,
    state: (v && v.state) || 'unjudged',
  }))
  const breach = list.filter((d) => d.state === 'breach')
  const unjudged = list.filter((d) => d.state === 'unjudged')
  const warn = list.filter((d) => d.state === 'warn')
  if (breach.length > 0)
    return {
      verdict: 'breach',
      breach: breach.map((d) => d.dim),
      unjudged: unjudged.map((d) => d.dim),
      warn: warn.map((d) => d.dim),
    }
  if (unjudged.length > 0)
    return {
      verdict: 'unjudged',
      breach: [],
      unjudged: unjudged.map((d) => d.dim),
      warn: warn.map((d) => d.dim),
    }
  if (warn.length > 0)
    return { verdict: 'warn', breach: [], unjudged: [], warn: warn.map((d) => d.dim) }
  return { verdict: 'ok', breach: [], unjudged: [], warn: [] }
}

export function exitCodeFor(verdict) {
  if (verdict === 'breach') return 1
  if (verdict === 'ok' || verdict === 'warn') return 0
  // 其余形态(含 undefined/未识别)一律按"未判定"处理:拿不到结论时落到 0 就是"没判"冒充"判过"(§0.3)。
  return 2
}

/* ---------- 取材层(只读) ---------- */

/** 动态导入共享单源(§0.6:期望形状只此一份)。导入不了 ⇒ 未判定,不回落第二份。 */
export async function loadExpectedBaseline({
  modulePath = SHARED_AASA_SOURCE,
  importer = null,
} = {}) {
  if (!existsSync(modulePath))
    return { state: 'unjudged', why: `单源不在位:${modulePath} ⇒ 期望形状未判定(不回落第二份)` }
  let mod = null
  try {
    mod = importer ? await importer() : await import(pathToFileURL(modulePath).href)
  } catch (e) {
    return {
      state: 'unjudged',
      why: `单源无法按权威面(src/*.ts)导入 ⇒ 未判定(需 Node ≥22.18 的类型剥离;实得 ${process.version}):${String(
        (e && e.message) || e,
      )
        .split(/\r?\n/)[0]
        .slice(0, 140)}`,
    }
  }
  const build = mod && mod.buildAppleAppSiteAssociation
  const placeholder = mod && mod.APPLE_AASA_PLACEHOLDER_TEAM_ID
  const defaultBundle = mod && mod.DEFAULT_APPLE_APP_BUNDLE_ID
  if (typeof build !== 'function' || !placeholder || !defaultBundle) {
    return {
      state: 'unjudged',
      why: '单源未导出 buildAppleAppSiteAssociation / APPLE_AASA_PLACEHOLDER_TEAM_ID / DEFAULT_APPLE_APP_BUNDLE_ID ⇒ 期望形状未判定(判据不在这把尺子里复抄)',
    }
  }
  const probe = build(`${placeholder}.${defaultBundle}`)
  const details = probe && probe.applinks && probe.applinks.details
  if (!Array.isArray(details) || details.length !== 1 || !Array.isArray(details[0].components)) {
    return {
      state: 'unjudged',
      why: '单源产出的 details 形状与"恰一枚 + components 数组"不符 ⇒ 期望形状未判定',
    }
  }
  return {
    state: 'ok',
    expected: {
      components: details[0].components.map((c) => c['/']),
      placeholderTeamId: placeholder,
      defaultBundleId: defaultBundle,
      contentType: mod.APPLE_AASA_CONTENT_TYPE || 'application/json',
      cacheControl: mod.APPLE_AASA_CACHE_CONTROL || '',
    },
  }
}

/** 本机声明面取材:读不到的部分交上层判未判定(不抛、不回落)。 */
export function readLocalFace({
  appJsonFile = APP_JSON_FILE,
  staticFile = RN_STATIC_AASA_FILE,
  reader = readFileSync,
} = {}) {
  const out = { appJsonText: null, appJsonError: null, staticText: null, staticError: null }
  try {
    out.appJsonText = String(reader(appJsonFile, 'utf8'))
  } catch (e) {
    out.appJsonError = `${appJsonFile}(${(e && e.code) || String((e && e.message) || e).slice(0, 60)})`
  }
  try {
    out.staticText = String(reader(staticFile, 'utf8'))
  } catch (e) {
    out.staticError = `${staticFile}(${(e && e.code) || String((e && e.message) || e).slice(0, 60)})`
  }
  return out
}

/** 错误形态归桶:DNS/TLS/超时/失明 ⇒ 未判定;拒连/复位 ⇒ 对端可归因(与 check-public-path-probe 同一方向)。 */
export function classifyFetchError(err, url) {
  const name = String((err && err.name) || '')
  const code = String((err && err.code) || (err && err.cause && err.cause.code) || '')
  const msg = String((err && err.message) || err || '')
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || /getaddrinfo/i.test(msg))
    return { kind: 'dns', code, detail: `DNS 解析失败(${code || name || 'ENOTFOUND'})`, url }
  if (
    /CERT|TLS|SSL|UNABLE_TO_VERIFY|HOST_VERIFICATION|ALTNAME/i.test(code + ' ' + name + ' ' + msg)
  )
    return { kind: 'tls', code, detail: `TLS/证书(${code || name})`, url }
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'EPERM' ||
    code === 'EPIPE' ||
    /ECONNREFUSED|ECONNRESET/i.test(msg)
  )
    return { kind: 'conn', code, detail: code || name, url }
  if (
    name === 'TimeoutError' ||
    /UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT|ETIMEDOUT|ESOCKETTIMEDOUT/.test(
      code + ' ' + name,
    )
  )
    return { kind: 'stall', code: code || name, detail: `连接/响应阶段超时(${code || name})`, url }
  return { kind: 'probeBlind', code, detail: `${name || 'Error'}:${msg.slice(0, 120)}`, url }
}

/**
 * 探一腿:手工跟跳(上限 maxHops)以便如实报"止步于重定向"而不是冒认 200。
 * 只 GET、只读响应体,不写任何文件、不改任何服务。
 */
export async function probeAasaUrl(
  url,
  { timeoutMs = TIMEOUT_MS_DEFAULT, maxHops = LEG_MAX_HOPS_DEFAULT, fetchImpl = null } = {},
) {
  const f =
    typeof fetchImpl === 'function'
      ? fetchImpl
      : typeof globalThis.fetch === 'function'
        ? globalThis.fetch
        : null
  if (!f) return { kind: 'probeBlind', detail: '运行时无 fetch(Node ≥18 才有全局 fetch)', url }
  let current = String(url)
  let hops = 0
  const chain = []
  for (;;) {
    let target
    try {
      target = new URL(current)
    } catch {
      return { kind: 'probeBlind', detail: `靶 URL 不可解析:"${current}"`, url }
    }
    if (target.protocol !== 'https:')
      return { kind: 'insecureRedirect', detail: `靶不是 https:${current}`, url: current }
    let res
    try {
      res = await f(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: 'application/json',
          'user-agent': 'ihui-aasa-health-ruler/1 (read-only)',
        },
      })
    } catch (e) {
      return classifyFetchError(e, current)
    }
    const status = Number(res && res.status)
    const location =
      res && res.headers && typeof res.headers.get === 'function'
        ? res.headers.get('location')
        : null
    chain.push({ url: current, status, location: location || null })
    if (status >= 300 && status < 400) {
      if (!location)
        return {
          kind: 'redirectUnresolved',
          hops,
          detail: `${status} 无 Location ⇒ 跟不下去`,
          url: current,
        }
      let next
      try {
        next = new URL(location, current)
      } catch {
        return {
          kind: 'redirectUnresolved',
          hops,
          detail: `${status} 的 Location "${location}" 不可解析`,
          url: current,
        }
      }
      if (next.protocol !== 'https:')
        return { kind: 'insecureRedirect', from: current, to: next.href, url }
      if (registrableDomain(next.hostname) !== registrableDomain(target.hostname))
        return { kind: 'offDomainRedirect', from: target.hostname, to: next.hostname, url }
      if (hops >= maxHops)
        return { kind: 'redirectUnresolved', hops, detail: `${maxHops} 跳上限内未到终页`, url }
      hops += 1
      current = next.href
      continue
    }
    let body = ''
    try {
      body = String(await res.text())
    } catch (e) {
      return {
        kind: 'probeBlind',
        detail: `状态行拿到了(${status})但响应体读不出:${String((e && e.message) || e).slice(0, 100)}`,
        url,
      }
    }
    return {
      kind: 'status',
      status,
      contentType:
        (res.headers && typeof res.headers.get === 'function' && res.headers.get('content-type')) ||
        '',
      body,
      hops,
      chain,
      url: current,
    }
  }
}

/* ---------- 编排 ---------- */

export async function evaluate(opt = {}) {
  const argv = opt.argv || []
  const skipProbe = argv.includes('--skip-probe')
  const baseline =
    opt.baseline ||
    (await (opt.loadExpected || loadExpectedBaseline)({ modulePath: SHARED_AASA_SOURCE }))
  const expected = baseline.expected || null
  const face = opt.face || readLocalFace(opt)
  const local = judgeLocalDeclarations({
    appJsonText: face.appJsonText,
    appJsonError: face.appJsonError,
    staticText: face.staticText,
    staticError: face.staticError,
    expected,
  })
  const dimensions = {
    baseline: {
      state: baseline.state,
      detail:
        baseline.why ||
        `期望形状来自单源 ${SHARED_AASA_SOURCE}(components=[${(expected && expected.components) || '—'}])`,
    },
    local: { state: local.state, detail: local.detail, facts: local.facts },
  }
  const legs = []
  if (local.state !== 'unjudged' && local.facts.hosts.length > 0)
    for (const host of local.facts.hosts)
      legs.push({
        id: `aasa:${host}`,
        host,
        url: `https://${host}${AASA_PATH}`,
        source: 'app.json associatedDomains',
      })
  if (opt.extraUrl)
    legs.push({
      id: `aasa:url`,
      host: (() => {
        try {
          return new URL(opt.extraUrl).hostname
        } catch {
          return opt.extraUrl
        }
      })(),
      url: opt.extraUrl,
      source: '--url',
    })
  if (legs.length === 0) {
    dimensions.legs = {
      state: 'unjudged',
      detail: '一枚靶都推不出来(声明面未判定或 associatedDomains 空)⇒ 公网维未判定,不记绿',
    }
  }
  const results = []
  if (skipProbe) {
    dimensions.probe = {
      state: 'unjudged',
      detail:
        '--skip-probe 显式跳过公网维 ⇒ 公网可达性未判定(本机声明面单独成立不代表公网能访问,不得据此出合格证)',
    }
    if (legs.length > 1)
      dimensions.consistency = { state: 'unjudged', detail: '无公网样本可比对 ⇒ 腿间一致性未判定' }
  } else {
    const probeImpl = opt.probe || probeAasaUrl
    for (const leg of legs) {
      let outcome = null
      try {
        outcome = await probeImpl(leg.url, {
          timeoutMs: opt.timeoutMs || TIMEOUT_MS_DEFAULT,
          maxHops: opt.maxHops || LEG_MAX_HOPS_DEFAULT,
          ...(opt.fetchImpl ? { fetchImpl: opt.fetchImpl } : {}),
        })
      } catch (e) {
        // 编排侧自己抛的异常也必须点名(交 judgeLegOutcome 落 unjudged),不得洗成"没有样本"了事。
        outcome = {
          kind: 'probeBlind',
          detail: `探针抛出异常(结论无效,不判对端):${String((e && e.message) || e).slice(0, 140)}`,
        }
      }
      results.push(judgeLegOutcome({ leg, outcome, expected, bundleId: local.facts.bundleId }))
    }
    for (const r of results) {
      let key = `public:${r.leg.host}`
      if (dimensions[key]) key += '#dup' // --url 与声明面同宿主时两条读数都要留痕,不得后写覆盖前写
      dimensions[key] = { state: r.state, detail: r.detail, code: r.code || null }
    }
    if (legs.length > 1) {
      const c = judgeLegConsistency(results)
      dimensions.consistency = { state: c.state, detail: c.detail }
    }
  }
  const agg = aggregate(dimensions)
  return {
    verdict: agg.verdict,
    at: new Date().toISOString(),
    breach: agg.breach,
    unjudged: agg.unjudged,
    warn: agg.warn,
    dimensions,
    legs,
    expected,
    localFacts: local.facts,
    ...(skipProbe ? { skippedProbe: true } : {}),
    ownerSideNote:
      '微信开放平台 UniversalLink 的填写 + 真实 APPLE_TEAM_ID 归机主面;本器只判可达性/形状/形态,不代判这两格。',
  }
}

/* ---------- 自检(构造面正反对照;唯一不触网的一档) ---------- */

function selfTest() {
  const expected = {
    components: ['/wechat/*', '/*'],
    placeholderTeamId: 'TEAMID',
    defaultBundleId: 'ai.ihui.mobile',
    contentType: 'application/json; charset=utf-8',
    cacheControl: '',
  }
  const goodBody = JSON.stringify({
    applinks: {
      details: [
        {
          appIDs: ['TKF3V7GG6T.ai.ihui.mobile'],
          components: [{ '/': '/wechat/*' }, { '/': '/*' }],
        },
      ],
    },
  })
  const status = (body, contentType = 'application/json; charset=utf-8') => ({
    kind: 'status',
    status: 200,
    contentType,
    body,
    hops: 0,
    url: 'https://file.aizhs.top/.well-known/apple-app-site-association',
  })
  const leg = {
    id: 'aasa:file.aizhs.top',
    host: 'file.aizhs.top',
    url: 'https://file.aizhs.top/.well-known/apple-app-site-association',
  }
  const cases = [
    {
      name: '200 + JSON + 与单源同构 ⇒ ok',
      run: () =>
        judgeLegOutcome({ leg, outcome: status(goodBody), expected, bundleId: 'ai.ihui.mobile' })
          .state,
      want: 'ok',
    },
    {
      name: '终页 404 ⇒ breach(path-not-served)',
      run: () =>
        judgeLegOutcome({
          leg,
          outcome: {
            kind: 'status',
            status: 404,
            contentType: 'text/html',
            body: '<html>404</html>',
            hops: 0,
          },
          expected,
        }).state,
      want: 'breach',
    },
    {
      name: '200 但 Content-Type 是 text/html ⇒ breach',
      run: () =>
        judgeLegOutcome({ leg, outcome: status(goodBody, 'text/html; charset=UTF-8'), expected })
          .state,
      want: 'breach',
    },
    {
      name: '200 + JSON MIME 但体不是 JSON ⇒ breach',
      run: () => judgeLegOutcome({ leg, outcome: status('<not json>'), expected }).state,
      want: 'breach',
    },
    {
      name: 'applinks.details 空数组 ⇒ breach(枚举 0 判死不记绿)',
      run: () =>
        judgeAasaBody({ text: JSON.stringify({ applinks: { details: [] } }), expected }).state,
      want: 'breach',
    },
    {
      name: 'components 缺 /wechat/* ⇒ breach(顺序即优先级)',
      run: () =>
        judgeAasaBody({
          text: JSON.stringify({
            applinks: {
              details: [{ appIDs: ['TKF3V7GG6T.ai.ihui.mobile'], components: [{ '/': '/*' }] }],
            },
          }),
          expected,
        }).state,
      want: 'breach',
    },
    {
      name: 'appID Bundle 段与 app.json 不符 ⇒ breach',
      run: () =>
        judgeAasaBody({
          text: JSON.stringify({
            applinks: {
              details: [
                {
                  appIDs: ['TKF3V7GG6T.wrong.bundle'],
                  components: [{ '/': '/wechat/*' }, { '/': '/*' }],
                },
              ],
            },
          }),
          expected,
          bundleId: 'ai.ihui.mobile',
        }).state,
      want: 'breach',
    },
    {
      name: 'Team 段是占位符 ⇒ warn(机主面,不冒红也不冒充判过真伪)',
      run: () =>
        judgeAasaBody({
          text: JSON.stringify({
            applinks: {
              details: [
                {
                  appIDs: ['TEAMID.ai.ihui.mobile'],
                  components: [{ '/': '/wechat/*' }, { '/': '/*' }],
                },
              ],
            },
          }),
          expected,
        }).state,
      want: 'warn',
    },
    {
      name: '超过 128KB ⇒ breach',
      run: () =>
        judgeAasaBody({
          text:
            JSON.stringify({
              applinks: {
                details: [
                  {
                    appIDs: ['TKF3V7GG6T.ai.ihui.mobile'],
                    components: [{ '/': '/wechat/*' }, { '/': '/*' }],
                  },
                ],
              },
            }) + ' '.repeat(AASA_MAX_BYTES),
          expected,
        }).state,
      want: 'breach',
    },
    {
      name: '期望形状(单源)取不到 ⇒ unjudged(绝不因"能解析"记绿)',
      run: () => judgeAasaBody({ text: goodBody, expected: null }).state,
      want: 'unjudged',
    },
    {
      name: 'DNS 解析失败 ⇒ unjudged(网络不可达 ≠ 无效)',
      run: () =>
        judgeLegOutcome({ leg, outcome: { kind: 'dns', code: 'ENOTFOUND' }, expected }).state,
      want: 'unjudged',
    },
    {
      name: 'TCP 拒连 ⇒ breach(对端可归因)',
      run: () =>
        judgeLegOutcome({ leg, outcome: { kind: 'conn', code: 'ECONNREFUSED' }, expected }).state,
      want: 'breach',
    },
    {
      name: '同域 301 跟到 200 ⇒ ok(hops=1 如实记录)',
      run: () => {
        const r = judgeLegOutcome({
          leg: {
            ...leg,
            host: 'aizhs.top',
            url: 'https://aizhs.top/.well-known/apple-app-site-association',
          },
          outcome: { ...status(goodBody), hops: 1 },
          expected,
          bundleId: 'ai.ihui.mobile',
        })
        return `${r.state}:${r.hops}`
      },
      want: 'ok:1',
    },
    {
      name: '跨注册域重定向 ⇒ breach',
      run: () =>
        judgeLegOutcome({
          leg,
          outcome: { kind: 'offDomainRedirect', from: 'file.aizhs.top', to: 'evil.example.com' },
          expected,
        }).state,
      want: 'breach',
    },
    {
      name: '其余 4xx ⇒ unjudged(边缘能答,不证明回源)',
      run: () =>
        judgeLegOutcome({
          leg,
          outcome: { kind: 'status', status: 403, contentType: 'text/html', body: '', hops: 0 },
          expected,
        }).state,
      want: 'unjudged',
    },
    {
      /** 反向夹具:拿一枚注定拿不到的输入 —— 尺子压根没跑到这一腿。 */
      name: '【反向夹具】outcome=null(取不到输入)⇒ 必须 unjudged,不得冒绿',
      run: () => judgeLegOutcome({ leg, outcome: null, expected }).state,
      want: 'unjudged',
    },
    {
      /** 反向夹具:声明文件注定读不到(app.json 不存在)。 */
      name: '【反向夹具】app.json 读不到 ⇒ 声明面 unjudged(不记绿)',
      run: () =>
        judgeLocalDeclarations({
          appJsonText: null,
          appJsonError: 'no such file or directory',
          staticText: goodBody,
          staticError: null,
          expected,
        }).state,
      want: 'unjudged',
    },
    {
      name: 'WX_UNIVERSAL_LINK 不在 associatedDomains 里 ⇒ breach(三处一致)',
      run: () =>
        judgeLocalDeclarations({
          appJsonText: JSON.stringify({
            expo: {
              ios: {
                bundleIdentifier: 'ai.ihui.mobile',
                associatedDomains: ['applinks:file.aizhs.top'],
              },
              extra: { WX_UNIVERSAL_LINK: 'https://other.example/' },
            },
          }),
          staticText: goodBody,
          expected,
        }).state,
      want: 'breach',
    },
    {
      name: '部署副本 Team 占位 ⇒ 声明面 warn(不冒红)',
      run: () =>
        judgeLocalDeclarations({
          appJsonText: JSON.stringify({
            expo: {
              ios: {
                bundleIdentifier: 'ai.ihui.mobile',
                associatedDomains: ['applinks:aizhs.top', 'applinks:file.aizhs.top'],
              },
              extra: { WX_UNIVERSAL_LINK: 'https://aizhs.top/' },
            },
          }),
          staticText: JSON.stringify({
            applinks: {
              details: [
                {
                  appIDs: ['TEAMID.ai.ihui.mobile'],
                  components: [{ '/': '/wechat/*' }, { '/': '/*' }],
                },
              ],
            },
          }),
          expected,
        }).state,
      want: 'warn',
    },
    {
      name: '两腿内容分叉 ⇒ breach(leg-divergence)',
      run: () =>
        judgeLegConsistency([
          { state: 'ok', leg: { host: 'a' }, raw: goodBody },
          { state: 'ok', leg: { host: 'b' }, raw: goodBody.replace('TKF3V7GG6T', 'TEAMID') },
        ]).state,
      want: 'breach',
    },
    {
      name: '只一腿有可比对内容 ⇒ unjudged(缺对照面不冒充判过)',
      run: () =>
        judgeLegConsistency([
          { state: 'ok', leg: { host: 'a' }, raw: goodBody },
          { state: 'breach', code: 'origin-5xx', leg: { host: 'b' } },
        ]).state,
      want: 'unjudged',
    },
    {
      name: 'warn 文案必须点名**实得** appID(不许用合成串糊过去)',
      run: () => {
        const r = judgeAasaBody({
          text: JSON.stringify({
            applinks: {
              details: [
                {
                  appIDs: ['TEAMID.ai.ihui.mobile'],
                  components: [{ '/': '/wechat/*' }, { '/': '/*' }],
                },
              ],
            },
          }),
          expected,
        })
        return `${r.state}|${r.faults[0].detail.includes('TEAMID.ai.ihui.mobile')}`
      },
      want: 'warn|true',
    },
    {
      name: '汇总优先级:1 breach + 2 unjudged ⇒ breach(红不被洗掉)',
      run: () =>
        aggregate({
          a: { state: 'breach' },
          b: { state: 'unjudged' },
          c: { state: 'unjudged' },
          d: { state: 'ok' },
        }).verdict,
      want: 'breach',
    },
    {
      name: '汇总:无 breach 有 unjudged ⇒ unjudged(退出码 2)',
      run: () => exitCodeFor(aggregate({ a: { state: 'ok' }, b: { state: 'unjudged' } }).verdict),
      want: 2,
    },
    {
      name: '汇总:全 ok ⇒ ok(退出码 0)',
      run: () => exitCodeFor(aggregate({ a: { state: 'ok' }, b: { state: 'ok' } }).verdict),
      want: 0,
    },
    {
      name: '错误归桶:证书类落 tls(未判定族)',
      run: () =>
        classifyFetchError(
          {
            message: 'unable to verify the first certificate',
            name: 'Error',
            cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' },
          },
          'https://x',
        ).kind,
      want: 'tls',
    },
    {
      name: '错误归桶:undici 连接超时落 stall(未判定族)',
      run: () =>
        classifyFetchError(
          {
            message: 'fetch failed',
            name: 'TypeError',
            cause: { code: 'UND_ERR_CONNECT_TIMEOUT' },
          },
          'https://x',
        ).kind,
      want: 'stall',
    },
    {
      name: '注册域:www.aizhs.top 与 aizhs.top 同域 ⇒ 允许跟跳',
      run: () => `${registrableDomain('www.aizhs.top')}|${registrableDomain('file.aizhs.top')}`,
      want: 'aizhs.top|aizhs.top',
    },
  ]
  let failed = 0
  for (const c of cases) {
    let got
    try {
      got = c.run()
    } catch (e) {
      got = `threw:${String((e && e.message) || e).slice(0, 80)}`
    }
    const ok = got === c.want
    if (!ok) failed += 1
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name} —— want=${c.want} got=${got}`)
  }
  console.log(`\nself-test: pass ${cases.length - failed} / fail ${failed} (共 ${cases.length} 例)`)
  return failed === 0
}

/* ---------- 入口 ---------- */

/**
 * 本器认识的旗标全集(带值那三个的值由 `requireFlagValue` 单源校验,只认空格分隔形态)。
 * 为什么要有这张表:`parseFlags` 此前只校验它认识的三个带值旗标,**未知旗标一律静默掉进默认分支**
 * —— 实测打 `--base-url https://no-such-host.invalid` 器照报 `ok:2 腿全部 200`,把"换了个靶"读成
 * "原靶健康"。这类静默吞参数是本仓登记过的失效型(plan-tasks.mjs 头注原话:「未知/残缺开关静默
 * 掉进默认分支,是本仓登记过的失效型」),对一台判"机主面待办"的哨兵尤其致命:它绿的含义是"我查过了",
 * 而它其实什么都没查。失效方向因此必须是**多问一次**(用法错 exit 2),不得是多放一次默认值。
 */
export const KNOWN_FLAGS = Object.freeze([
  '--self-test',
  '--json',
  '--skip-probe',
  '--url',
  '--timeout-ms',
  '--max-hops',
  '--help',
])
const VALUED_FLAGS = new Set(['--url', '--timeout-ms', '--max-hops'])

/** 未认识的 token(含裸参数与 `--x=v` 形态——本器的取值单源只认空格分隔,等号形态确实不被支持)。 */
export function unknownTokensOf(argv = []) {
  const out = []
  for (let i = 0; i < argv.length; i++) {
    const a = String(argv[i])
    if (!a.startsWith('-')) {
      out.push({ token: a, why: '裸参数不被接受(本器只认具名旗标)' })
      continue
    }
    if (VALUED_FLAGS.has(a)) {
      i += 1 // 它的值交给 requireFlagValue 判,这里不重复判形态
      continue
    }
    if (a.startsWith('--') && a.includes('=') && VALUED_FLAGS.has(a.slice(0, a.indexOf('='))))
      continue
    if (!KNOWN_FLAGS.includes(a)) out.push({ token: a, why: '不认识这个旗标' })
  }
  return out
}

function parseFlags(argv) {
  const url = requireFlagValue(argv, '--url', {
    noun: 'https 靶地址(如 https://file.aizhs.top/.well-known/apple-app-site-association)',
  })
  const timeoutMs = requireFlagValue(argv, '--timeout-ms', { noun: '毫秒数(整数)' })
  const maxHops = requireFlagValue(argv, '--max-hops', { noun: '重定向跳数上限(整数)' })
  const errors = []
  for (const f of [url, timeoutMs, maxHops]) if (f.error) errors.push(f.error)
  // 未知旗标在这里就拦,不等默认值把"没查"洗成"查过且健康"。
  for (const u of unknownTokensOf(argv))
    errors.push(`未知/不可用的参数 "${u.token}"(${u.why})—— 本器只认 ${KNOWN_FLAGS.join(' / ')}`)
  let parsedTimeout = TIMEOUT_MS_DEFAULT
  let parsedHops = LEG_MAX_HOPS_DEFAULT
  if (timeoutMs.present && !timeoutMs.error) {
    parsedTimeout = Number(timeoutMs.value)
    if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0)
      errors.push(`--timeout-ms 需要正整数毫秒数,实得 "${timeoutMs.value}"`)
  }
  if (maxHops.present && !maxHops.error) {
    parsedHops = Number(maxHops.value)
    if (!Number.isInteger(parsedHops) || parsedHops < 0)
      errors.push(`--max-hops 需要非负整数,实得 "${maxHops.value}"`)
  }
  if (url.present && !url.error) {
    try {
      const u = new URL(url.value)
      if (u.protocol !== 'https:') errors.push(`--url 只接受 https 靶,实得 "${url.value}"`)
    } catch {
      errors.push(`--url 不是合法 URL,实得 "${url.value}"`)
    }
  }
  return { url: url.value, timeoutMs: parsedTimeout, maxHops: parsedHops, errors }
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) {
    console.log(
      `用法: node scripts/check-aasa-public-health.mjs [--url <https 靶>] [--timeout-ms <整数>] [--max-hops <非负整数>] [--json] [--skip-probe]\n` +
        `      node scripts/check-aasa-public-health.mjs --self-test\n` +
        `职责: 只读复核 AASA 公网可达性与同构性(三态 ok / breach / unjudged;取不到输入一律未判定)。\n` +
        `档位: 判机器状态 ⇒ 刻意不进提交链、不进 CI(§12e),调度归 git-guardian 巡检轮。\n` +
        `旗标纪律: 未认识的旗标一律用法错 exit 2,不静默掉进默认分支 —— 那会把"什么都没查"打成"查过且健康"。`,
    )
    return 0
  }
  if (argv.includes('--self-test')) return selfTest() ? 0 : 1
  const flags = parseFlags(argv)
  if (flags.errors.length > 0) {
    console.error(`❌ 用法错(未判定,不产出结论):\n${flags.errors.map((e) => `   ${e}`).join('\n')}`)
    return 2
  }
  const result = await evaluate({
    argv,
    extraUrl: flags.url || null,
    timeoutMs: flags.timeoutMs,
    maxHops: flags.maxHops,
  })
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } else {
    console.log(
      `· 单源期望形状:${result.dimensions.baseline.state} —— ${result.dimensions.baseline.detail}`,
    )
    console.log(
      `· 本机声明面:${result.dimensions.local.state} —— ${result.dimensions.local.detail}`,
    )
    if (result.localFacts.hosts.length)
      console.log(
        `  靶清单(由 associatedDomains 推出):${result.legs.map((l) => l.url).join(' , ')}`,
      )
    for (const [k, v] of Object.entries(result.dimensions)) {
      if (!k.startsWith('public:') && k !== 'consistency' && k !== 'probe') continue
      console.log(`· ${k}:${v.state}${v.detail ? ` —— ${v.detail}` : ''}`)
    }
    if (result.verdict === 'breach')
      console.log(`❌ AASA 公网健康 breach:${result.breach.join(', ')}`)
    else if (result.verdict === 'unjudged')
      console.log(
        `ℹ️ 未判定(未判定 ≠ 通过):${result.unjudged.join(', ')} —— 先修靶/出口链路或补输入,再复跑`,
      )
    else if (result.verdict === 'warn')
      console.log(
        `⚠️ 可达且同构,但有机主面待办:${result.warn.join(', ')} —— ${result.ownerSideNote}`,
      )
    else
      console.log(
        `✅ AASA 公网健康 ok:${result.legs.length} 腿全部 200 + application/json + 与单源同构且逐字一致`,
      )
  }
  return exitCodeFor(result.verdict)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(
        `❌ check-aasa-public-health 自身异常(结论无效,不得当成通过):${e?.message ?? e}\n${e?.stack ?? ''}`,
      )
      process.exitCode = 2
    })
}

export const __test__ = {
  judgeContentType,
  classifyAppId,
  judgeAasaBody,
  registrableDomain,
  judgeLegOutcome,
  judgeLegConsistency,
  judgeLocalDeclarations,
  aggregate,
  exitCodeFor,
  classifyFetchError,
  unknownTokensOf,
  KNOWN_FLAGS,
  readLocalFace,
  loadExpectedBaseline,
  AASA_PATH,
  AASA_MAX_BYTES,
  REAL_TEAM_ID_RE,
  SHARED_AASA_SOURCE,
  APP_JSON_FILE,
  RN_STATIC_AASA_FILE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
