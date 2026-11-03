#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * probe-play-status.mjs — Google Play 侧现状只读探测器(2026-11-02 立)
 *
 * 立因:发布链路里"应用到底存不存在、SA 有没有权限、各轨道现在挂着哪枚 release"这三件事,
 * 此前只能靠人工登录 Play Console 网页看 ⇒ 台账与仓库里读不到,链路是否在跑全靠记忆。
 * 本脚本用 androidpublisher v3 把它变成一条可重跑的只读读数。
 *
 * 路径形态**照 discovery 抄**,不是猜的(拉 `/$discovery/rest?version=v3` 现读):
 *   POST applications/{pkg}/edits → GET .../edits/{id}/tracks → DELETE .../edits/{id}
 * 为什么强调这条:先前两版探针分别用了 `applications/{pkg}/tracks`(不在 edit 下)与
 * `applications/{pkg}:getAppMetadata`(v3 根本没这方法),两者都返 404 —— 那 404 是**我路径错**,
 * 却被读成"应用没创建/SA 没授权",差点据此把 Play 腿登记成机主资质阻塞。
 * 判别力靠对照:同一端点问别人的包得 403 PERMISSION_DENIED、问不存在的包得 404
 * `Package not found`,问本包得 200 ⇒ 三种形态可分,读数才算成立。
 *
 * 活跃 edit 纪律:一枚应用只允许一枚活跃 edit,留着会顶掉别人正在用的那枚 ⇒ 本脚本
 * **无论中途成败都在 finally 里 DELETE**(204),绝不 commit、绝不写任何变更端点。
 *
 * 出网:Google 域本机直连不通(实测 oauth2 timeout),必须带代理。Node 的 env 代理开关
 * 在**进程启动时**读取(实测:进程内改 process.env.HTTPS_PROXY 对已建的全局 dispatcher 无效),
 * 所以代理由调用方在 spawn 时注入 —— release-mobile-rn.mjs --diagnose-play 就是那个调用方。
 *
 * 用法:
 *   NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:7897 node scripts/probe-play-status.mjs [--json]
 *   --sa <path> 指定服务账号 JSON(缺省走 §5d 密钥目录按内容识别)
 * 退出码:0 读到全貌 / 1 应用或权限不成立 / 2 未判定(密钥根取不到、网络不可达、edit 建不起来)
 */
import fs from 'node:fs'
import { readFileSync } from 'node:fs'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { playServiceKey, STATUS } from './lib/rn-release-credentials.mjs'

const V3 = 'https://androidpublisher.googleapis.com/androidpublisher/v3'
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher'

export const __test__ = { V3, SCOPE, buildPaths, classifyInsertFailure }

/** 端点路径单源:全部从 discovery 抄来,禁止在调用方再拼一份字符串(§22c) */
function buildPaths(pkg) {
  return {
    beginEdit: `${V3}/applications/${pkg}/edits`,
    edit: (id) => `${V3}/applications/${pkg}/edits/${id}`,
    tracks: (id) => `${V3}/applications/${pkg}/edits/${id}/tracks`,
    listings: (id) => `${V3}/applications/${pkg}/edits/${id}/listings`,
    details: (id) => `${V3}/applications/${pkg}/edits/${id}/details`,
    testers: (id, track) => `${V3}/applications/${pkg}/edits/${id}/testers/${track}`,
    signing: `${V3}/applications/${pkg}/appSigningInfo?packageName=${pkg}`,
  }
}

/** 判别力分类:200=有权限且应用存在;403=应用存在但本 SA 无权;404+Package not found=包未创建 */
function classifyInsertFailure(status, body) {
  if (status === 200 || status === 201) return { verdict: 'authorized', status: STATUS.FOUND }
  const msg = String(body?.error?.message ?? '')
  if (status === 403) return { verdict: 'exists-but-sa-unauthorized', status: STATUS.MISSING, msg }
  if (status === 404 && /Package not found/i.test(msg)) return { verdict: 'package-not-created', status: STATUS.MISSING, msg }
  if (status === 404) return { verdict: 'endpoint-unreachable-or-wrong-path', status: STATUS.UNJUDGED, msg: `${msg || '非 JSON 响应(多半是路径形态不对,不是权限问题)'}` }
  return { verdict: 'unknown', status: STATUS.UNJUDGED, msg }
}

function loadSa(explicit) {
  if (explicit) return { path: explicit, json: JSON.parse(readFileSync(explicit, 'utf8')) }
  const r = playServiceKey()
  if (r.status !== STATUS.FOUND) return { error: r }
  return { path: r.value.path, json: JSON.parse(fs.readFileSync(r.value.path, 'utf8')), clientEmail: r.value.clientEmail }
}

async function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const saPath = argv[argv.indexOf('--sa') + 1]
  const pkgArgIdx = argv.indexOf('--package')
  const PKG = pkgArgIdx >= 0 ? argv[pkgArgIdx + 1] : JSON.parse(readFileSync(new URL('../apps/mobile-rn/app.json', import.meta.url), 'utf8')).expo.android.package

  const loaded = loadSa(saPath)
  if (loaded.error) {
    console.log(`未判定:${loaded.error.status} ${loaded.error.detail}`)
    return 2
  }
  const sa = loaded.json
  const P = buildPaths(PKG)
  const out = { package: PKG, saFile: loaded.path, clientEmail: sa.client_email }

  const now = Math.floor(Date.now() / 1000)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const si = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, exp: now + 1800, iat: now - 60 })}`
  const assertion = `${si}.${crypto.createSign('RSA-SHA256').update(si).sign(sa.private_key).toString('base64url')}`

  let token
  try {
    token = await (await fetch(sa.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) })).json()
  } catch (e) {
    console.log(`未判定:OAuth 端点不可达(${e?.cause?.code ?? e?.name})——Google 域需代理,由调用方在 spawn 时注入 NODE_USE_ENV_PROXY + HTTPS_PROXY`)
    return 2
  }
  if (!token.access_token) {
    console.log(`未判定:换 token 失败 ${JSON.stringify(token).slice(0, 200)}`)
    return 2
  }
  const AUTH = { authorization: `Bearer ${token.access_token}` }
  out.token = 'ok'

  const GET = async (u) => {
    try {
      const r = await fetch(u, { headers: AUTH })
      let j = null
      try {
        j = JSON.parse(await r.text())
      } catch {}
      return { status: r.status, j }
    } catch (e) {
      return { status: 'fetch-error', j: { error: { message: e?.cause?.code ?? e?.name } } }
    }
  }

  const ins = await (async () => {
    try {
      const r = await fetch(P.beginEdit, { method: 'POST', headers: { ...AUTH, 'content-type': 'application/json', 'content-length': '0' }, body: '' })
      let j = null
      try {
        j = JSON.parse(await r.text())
      } catch {}
      return { status: r.status, j }
    } catch (e) {
      return { status: 'fetch-error', j: { error: { message: e?.cause?.code ?? e?.name } } }
    }
  })()
  const cls = classifyInsertFailure(ins.status, ins.j)
  out.appAccess = { http: ins.status, ...cls }
  if (!ins.j?.id) {
    console.log(json ? JSON.stringify(out, null, 2) : `Play 应用访问:${cls.verdict} http=${ins.status} ${cls.msg ?? ''}`)
    return cls.status === STATUS.MISSING ? 1 : 2
  }

  const id = ins.j.id
  try {
    const tr = await GET(P.tracks(id))
    out.tracks = (tr.j?.tracks ?? []).map((t) => ({ track: t.track, releases: (t.releases ?? []).map((r) => ({ name: r.name, status: r.status, versionCodes: r.versionCodes })) }))
    const dl = await GET(P.listings(id))
    out.listings = (dl.j?.listings ?? []).map((l) => ({ language: l.language, title: l.title, shortLen: (l.shortDescription || '').length, fullLen: (l.fullDescription || '').length }))
    const dt = await GET(P.details(id))
    out.details = { contactEmail: dt.j?.contactEmail, contactWebsite: dt.j?.contactWebsite, defaultLanguage: dt.j?.defaultLanguage }
    const tg = await GET(P.testers(id, 'alpha'))
    out.alphaTesters = { http: tg.status, count: Array.isArray(tg.j?.googleGroups) ? tg.j.googleGroups.length : undefined, raw: tg.j?.userCounts ?? undefined }
    const sg = await GET(P.signing)
    out.signing = sg.status === 200 ? { uploadCertSha1: sg.j?.uploadKeyCertificate?.sha1Fingerprint, appSigningCertSha1: sg.j?.appSigningKeyCertificate?.sha1Fingerprint } : { http: sg.status }
  } finally {
    try {
      const del = await fetch(P.edit(id), { method: 'DELETE', headers: AUTH })
      out.cleanup = { deleteEdit: del.status }
      if (del.status !== 204 && del.status !== 200) console.error(`⚠ 活跃 edit 未被摘除(http=${del.status})——它会顶掉别人正在用的编辑,请手工 DELETE ${P.edit(id)}`)
    } catch (e) {
      console.error(`⚠ DELETE edit 抛错(${e?.name}),必须手工清理:${P.edit(id)}`)
    }
  }

  if (json) console.log(JSON.stringify(out, null, 2))
  else {
    console.log(`包名=${out.package} SA=${out.clientEmail}`)
    console.log(`应用访问: http=${out.appAccess.http} ⇒ ${out.appAccess.verdict}`)
    console.log(`轨道 ${out.tracks.length} 条:`)
    for (const t of out.tracks) console.log(`  ${t.track}: ${t.releases.length ? t.releases.map((r) => `${r.name ?? '?'}(${(r.versionCodes || []).join('/')})[${r.status ?? '?'}]`).join(', ') : 'EMPTY'}`)
    console.log(`listing ${out.listings.length} 种语言: ${out.listings.map((l) => `${l.language}:"${l.title}"(${l.shortLen}/${l.fullLen}B)`).join(' | ') || '(空)'}`)
    console.log(`详情: defaultLanguage=${out.details.defaultLanguage} contact=${out.details.contactEmail} site=${out.details.contactWebsite}`)
    console.log(`alpha 测试员: http=${out.alphaTesters.http}${out.alphaTesters.raw ? ' 计数=' + JSON.stringify(out.alphaTesters.raw) : ''}`)
    console.log(`签名: ${JSON.stringify(out.signing)}`)
    console.log(`cleanup: DELETE edit http=${out.cleanup.deleteEdit}`)
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((c) => process.exit(c ?? 0))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
