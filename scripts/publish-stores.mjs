#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * publish-stores.mjs — 多商店自动发布编排器(2026-11-08 立,同日晚改为直连)
 *
 * 立因(现读,不是预防):`release-mobile-rn.mjs --leg play-aab|store-*` 只有诊断矩阵,
 * 非 OTA 腿的执行体一律未接线;CI 只出 dev 包且禁发布。本文件把八家收进同一条编排:
 * 能自动的**直连自动**,不能的明说,绝不把"客户端在册"冒充"能发布"。
 *
 * 射线(行为,不是承诺):
 *   google-play  AAB → androidpublisher v3 直连: SA 内存签名 JWT → OAuth → edits → bundle →
 *                track(alpha, 默认 draft) → commit。**不再依赖 EAS/EXPO_TOKEN,私钥不落盘**。
 *                commit 成功 = 包与轨道变更已落 Play;draft **不等于过审/上线**。
 *   huawei       APK → scripts/submit-store-huawei.mjs --phase all(status→upload→app-submit→verify;
 *                app-submit 已核实,但 AGC 论坛口径 Android 是否开放提审以实测 ret.code 为准)。
 *   xiaomi       APK → scripts/submit-store-xiaomi.mjs --phase all(dev/push + 回读;synchroType=1)。
 *   oppo         APK → scripts/submit-store-oppo.mjs --phase all(token+上传+提交发布+回读;
 *                需 OPPO_SUBMIT_JSON 素材,errno=0 且 data.success=true 才算受理)。
 *   vivo         APK → scripts/submit-store-vivo.mjs --phase all(upload + sync.update 提审)。
 *   yyb          APK → scripts/submit-store-yyb.mjs --phase all(get_file_upload_info→PUT→update_app);
 *                官方政策:API 不支持首包,需 YYB_ASSUME_FIRST_PUBLISHED=1 显式声明。
 *   honor        仅 token+get-app-id 已核实;上传/绑定/提审正文在登录墙内 ⇒ 零调用,状态 scaffold。
 *   apkpure      APK → scripts/submit-store-apkpure.mjs --send --execute(官方邮件通道,Resend 回执 id
 *                才算发出;com 网页后台仍可人工,但不再是必经步骤)。
 *
 * 凭据纪律(§5d):一律经各客户端单一出口(rn-release-credentials / submit-store-*)读取;
 * 结论只出 sha8/长度/邮箱,**不打印秘密原文**。Play SA 只在内存里签名,不写工作树。
 * APKPure 发信凭据:RESEND_API_KEY + RESEND_FROM(env 优先,缺省只读密钥库 apps/api/.env)。
 *
 * 默认 dry-run(零出网、零写盘);`--execute` 才发。`--required a,b` 决定退出码:
 * 只有被点名商店判红/判未判定;其余 blocked/manual/scaffold 只进可见清单(不冒充绿)。
 *
 * 用法:
 *   node scripts/publish-stores.mjs                      # 八家全店 dry-run 体检
 *   node scripts/publish-stores.mjs --json               # 同上,机器读(不含秘密)
 *   node scripts/publish-stores.mjs --build --execute --required google-play
 *   node scripts/publish-stores.mjs --execute --required google-play,huawei,apkpure
 *   node scripts/publish-stores.mjs --apk <p> --aab <p> --track alpha --release-status draft
 *   凭据(CI):ORG_GRADLE_PROJECT_IHUI_RELEASE_* 四键 / GOOGLE_PLAY_SERVICE_ACCOUNT_JSON /
 *            HUAWEI_CONNECT_CLIENT_ID+_CLIENT_SECRET(+_APP_ID) / XIAOMI_* / OPPO_* / VIVO_* /
 *            YYB_* / HONOR_* / RESEND_API_KEY+RESEND_FROM(APKPure 邮件通道) /
 *            APKPURE_DOWNLOAD_URL+APKPURE_CONTACT(缺省直链读 scripts/data/mobile-download-leg.json)
 * 退出码:0 被点名商店达成 / 1 被点名商店 blocked|failed|manual|scaffold|uploaded-partial /
 *         2 被点名商店 unjudged,或本器自身取不到输入
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { STATUS, androidSigning } from './lib/rn-release-credentials.mjs'
import { resolveSecretsRoot } from './lib/key-dir.mjs'
import { resolveCredentials as resolveHuaweiCredentials } from './submit-store-huawei.mjs'
import { resolveCredentials as resolveXiaomiCredentials } from './submit-store-xiaomi.mjs'
import { resolveCredentials as resolveOppoCredentials } from './submit-store-oppo.mjs'
import { resolveCredentials as resolveVivoCredentials } from './submit-store-vivo.mjs'
import { resolveCredentials as resolveYybCredentials } from './submit-store-yyb.mjs'
import { resolveCredentials as resolveHonorCredentials } from './submit-store-honor.mjs'
import { mailTransportState } from './submit-store-apkpure.mjs'
import { loadBundle } from './lib/store-uploader-core.mjs'
import {
  loadCredentials as loadPlayCredentials,
  planRelease as planPlayRelease,
  publishBundle as publishPlayBundle,
  readPackageName as readPlayPackageName,
} from './lib/store-uploaders/google-play.mjs'

const ROOT = join(import.meta.dirname, '..')
const RN_DIR = join(ROOT, 'apps', 'mobile-rn')
const OUTPUT_DIR = join(RN_DIR, 'android', 'app', 'build', 'outputs')

/**
 * 八家商店的**静态**射程单源。`mode` 只描述器物形态,不断言能力:
 *   auto    = 有执行体(八家)
 *   manual  = 对方无任何可自动通道(现为 0 家;以后若出现再如实加)
 * `capability` 才是能力判据:只有 `upload-verified` / `mail-verified` 的腿才会进 ready/execute;
 * `unverified` 的腿在 plan 阶段就落 scaffold,执行阶段零调用。
 */
export const STORES = Object.freeze([
  { id: 'google-play', label: 'Google Play', mode: 'auto', artifact: 'aab', capability: 'direct', cli: null },
  { id: 'apkpure', label: 'APKPure', mode: 'auto', artifact: 'apk', capability: 'mail-verified', cli: 'scripts/submit-store-apkpure.mjs', success: 'submitted' },
  { id: 'huawei', label: '华为 AppGallery', mode: 'auto', artifact: 'apk', capability: 'upload-verified', cli: 'scripts/submit-store-huawei.mjs', success: 'submitted' },
  { id: 'xiaomi', label: '小米应用商店', mode: 'auto', artifact: 'apk', capability: 'upload-verified', cli: 'scripts/submit-store-xiaomi.mjs', success: 'submitted' },
  { id: 'oppo', label: 'OPPO 软件商店', mode: 'auto', artifact: 'apk', capability: 'upload-verified', cli: 'scripts/submit-store-oppo.mjs', success: 'submitted' },
  { id: 'vivo', label: 'vivo 应用商店', mode: 'auto', artifact: 'apk', capability: 'upload-verified', cli: 'scripts/submit-store-vivo.mjs', success: 'submitted' },
  { id: 'yyb', label: '腾讯应用宝', mode: 'auto', artifact: 'apk', capability: 'upload-verified', cli: 'scripts/submit-store-yyb.mjs', success: 'submitted' },
  { id: 'honor', label: '荣耀应用市场', mode: 'auto', artifact: 'apk', capability: 'unverified', cli: 'scripts/submit-store-honor.mjs', success: null },
])

export const STORE_IDS = Object.freeze(STORES.map((s) => s.id))

/** 每家执行后**能诚实到达的天花板**(逐条写清,plan 与 execute 共用同一句)。 */
export const CEILING = Object.freeze({
  'google-play': 'androidpublisher commit 成功 = 进 alpha 轨道草稿;draft≠过审/上线',
  huawei: 'status+upload+app-submit 全链已核实;ret.code=0 只代表 AGC 受理(Android 是否开放提审以实测为准),审核/上架仍由 AGC 控制台决定',
  xiaomi: 'dev/push 已核实;synchroType=1 更新包,三种都进审核 ⇒ 提交≠此刻已上架',
  oppo: 'token+上传+提交发布已核实;需先有后台应用与 OPPO_SUBMIT_JSON 素材,errno=0 且 data.success=true 才算受理',
  vivo: 'app.upload.apk.app.64 + app.sync.update.app 已核实;更新即提审,审核通过后发布',
  yyb: '3.3 上传 + 3.4 更新已核实;官方政策:API 不支持首包,且 deploy_type=1 仍需审核 ⇒ 不等于已上架',
  honor: '上传路径/绑定/提交审核正文在登录墙内 ⇒ 零调用;仅 token+get-app-id 可跑',
  apkpure: '官方只提供登录型开发者控制台 developer.apkpure.com(无公开上传 API);support@/business@ 是联系地址,邮件不是官方提交入口。本器可机器直发提交请求函(Resend 回执 id 只证明送达邮箱,不等于受理/上架);收录/上架由 APKPure 侧决定',
})

function sh(file, args, { cwd = ROOT, env = {}, timeout = 300000 } = {}) {
  try {
    const out = execFileSync(file, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
      windowsHide: true,
      env: { ...process.env, ...env },
    })
    return { code: 0, out: String(out ?? '').trim(), err: '' }
  } catch (e) {
    return { code: e?.status ?? 'null', out: String(e?.stdout ?? '').trim(), err: String(e?.stderr ?? '').trim() }
  }
}

const tail = (text, n = 6) =>
  String(text ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-n)
    .join(' | ')

const fmtBytes = (n) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${n} B`)

/** 结论脱敏:任何已知秘密串在文本里一律换成 *** (子进程报错可能回显 env)。 */
export function redact(text, secrets = []) {
  let out = String(text ?? '')
  for (const s of secrets) {
    const v = String(s ?? '')
    if (v.length >= 8) out = out.split(v).join('***')
  }
  return out
}

/** 产物解析(显式覆盖优先;显式给了但不存在 ⇒ 带 missing 标记,不静默回退到默认路径)。 */
export function resolveArtifacts({ dir = OUTPUT_DIR, apk = null, aab = null, exists = existsSync, sizeOf = (p) => statSync(p).size } = {}) {
  const one = (override, rel, kind) => {
    if (override) {
      const p = String(override).replace(/\\/g, '/')
      return exists(p) ? { kind, path: p, bytes: sizeOf(p), source: 'cli' } : { kind, path: p, bytes: 0, source: 'cli', missing: true }
    }
    const p = join(dir, rel).replace(/\\/g, '/')
    return exists(p) ? { kind, path: p, bytes: sizeOf(p), source: 'default' } : null
  }
  return {
    apk: one(apk, 'apk/release/app-release.apk', 'apk'),
    aab: one(aab, 'bundle/release/app-release.aab', 'aab'),
  }
}

/** 版本读数:AGP 的 output-metadata.json 优先(它记的是**产物自己的**版本,不是配置的期望值)。 */
export function readReleaseVersion({ rnDir = RN_DIR, read = readFileSync } = {}) {
  let versionName = null
  let versionCode = null
  for (const rel of ['apk/release/output-metadata.json', 'bundle/release/output-metadata.json']) {
    try {
      const j = JSON.parse(read(join(rnDir, 'android', 'app', 'build', 'outputs', rel), 'utf8'))
      const el = Array.isArray(j?.elements) ? j.elements[0] : null
      if (el) {
        versionName = el.versionName ?? null
        versionCode = el.versionCode === undefined || el.versionCode === null ? null : String(el.versionCode)
        break
      }
    } catch {
      /* 没出过包就没有这份元数据 —— 回落 app.json,不据此判红 */
    }
  }
  if (!versionName) {
    try {
      versionName = JSON.parse(read(join(rnDir, 'app.json'), 'utf8'))?.expo?.version ?? null
    } catch {
      versionName = null
    }
  }
  return { versionName, versionCode }
}

/**
 * 现场采集:凭据三态 + 产物 + 版本。全部只读,不发请求。
 * 各家凭据一律走各自客户端的 resolveCredentials(单一出口),本器不复制解析逻辑。
 */
export function gatherFacts({ env = process.env, root = resolveSecretsRoot(), rnDir = RN_DIR, apk = null, aab = null, read = readFileSync, track = 'alpha', releaseStatus = 'draft' } = {}) {
  const huawei = resolveHuaweiCredentials({ env, root })
  let apkpureDownloadUrl = String(env.APKPURE_DOWNLOAD_URL ?? '').trim() || null
  if (!apkpureDownloadUrl) {
    try {
      const j = JSON.parse(read(join(ROOT, 'scripts', 'data', 'mobile-download-leg.json'), 'utf8'))
      apkpureDownloadUrl = String(j?.downloadUrl ?? '').trim() || null
    } catch {
      apkpureDownloadUrl = null
    }
  }
  const apkpureBundle = loadBundle({ vendor: 'apkpure' })
  // 联系邮箱优先显式 env;缺省回落材料包 listing.contact(与隐私政策同一真源,不另造地址)。
  const apkpureContact =
    String(env.APKPURE_CONTACT ?? '').trim() ||
    String(apkpureBundle?.files?.listing?.contact?.email ?? '').trim() ||
    null
  return {
    signing: androidSigning({ env }),
    play: loadPlayCredentials({ env, root }),
    packageName: readPlayPackageName({ rnDir, read }),
    playTrack: track,
    playReleaseStatus: releaseStatus,
    huawei: { status: huawei.status, detail: huawei.detail, appId: huawei.value?.appId ?? null, clientId: huawei.value?.clientId ?? null },
    vendors: {
      xiaomi: resolveXiaomiCredentials({ env, root }),
      oppo: resolveOppoCredentials({ env, root }),
      vivo: resolveVivoCredentials({ env, root }),
      yyb: resolveYybCredentials({ env, root }),
      honor: resolveHonorCredentials({ env, root }),
    },
    apkpureMail: mailTransportState({ env }),
    apkpureDownloadUrl,
    apkpureContact,
    apkpureNotes: String(env.APKPURE_RELEASE_NOTES ?? '').trim() || null,
    apkpureBundle,
    yybFirstPublished: String(env.YYB_ASSUME_FIRST_PUBLISHED ?? '') === '1',
    artifacts: resolveArtifacts({ dir: join(rnDir, 'android', 'app', 'build', 'outputs'), apk, aab }),
    version: readReleaseVersion({ rnDir, read }),
  }
}

function result(store, status, detail, extra = {}) {
  return { id: store.id, label: store.label, mode: store.mode, status, ok: status === 'submitted', detail, ...extra }
}

const gapsOf = (facts, store) => {
  const gaps = []
  if (facts.signing.status !== STATUS.FOUND) gaps.push(`正式签名件:${facts.signing.detail}`)
  const art = facts.artifacts?.[store.artifact]
  if (!art) gaps.push(`${store.artifact.toUpperCase()} 产物:未找到(先出包或 --${store.artifact} <path>)`)
  else if (art.missing) gaps.push(`${store.artifact.toUpperCase()} 产物:${art.path} 不存在`)
  return gaps
}

function planGooglePlay(store, facts) {
  if (facts.play.status === STATUS.UNJUDGED) return result(store, 'unjudged', `Play 服务账号未判定:${facts.play.detail}`)
  const gaps = gapsOf(facts, store)
  if (facts.play.status !== STATUS.FOUND) gaps.push(`Play 服务账号:${facts.play.detail}`)
  if (!facts.packageName) gaps.push('packageName:app.json expo.android.package 取不到')
  if (gaps.length) return result(store, 'blocked', gaps.join(' | '))
  return result(
    store,
    'ready',
    `AAB ${fmtBytes(facts.artifacts.aab.bytes)} → androidpublisher v3 直连(edits→bundle→track=${facts.playTrack},status=${facts.playReleaseStatus}→commit);私钥仅内存签名、不落盘;${CEILING['google-play']}`,
    { artifact: facts.artifacts.aab.path, credential: facts.play.detail },
  )
}

function planHuawei(store, facts) {
  if (facts.huawei.status === STATUS.UNJUDGED) return result(store, 'unjudged', `AGC 凭据未判定:${facts.huawei.detail}`)
  const gaps = gapsOf(facts, store)
  if (facts.huawei.status !== STATUS.FOUND) gaps.push(`AGC Connect API 凭据:${facts.huawei.detail}`)
  else if (!facts.huawei.appId) gaps.push('AGC appId:缺 HUAWEI_CONNECT_APP_ID(或凭据件里的 应用ID)')
  if (gaps.length) return result(store, 'blocked', gaps.join(' | '))
  return result(store, 'ready', `APK ${fmtBytes(facts.artifacts.apk.bytes)} → AGC status/upload/app-submit/verify;${CEILING.huawei}`, { artifact: facts.artifacts.apk.path, credential: facts.huawei.detail })
}

function planApkpure(store, facts) {
  if (facts.apkpureMail?.status === STATUS.UNJUDGED) return result(store, 'unjudged', `APKPure 发信凭据未判定:${facts.apkpureMail.detail}`)
  const gaps = gapsOf(facts, store)
  if (facts.apkpureMail?.status !== STATUS.FOUND) gaps.push(`APKPure 发信凭据:${facts.apkpureMail?.detail ?? '未探测'}`)
  if (!facts.apkpureDownloadUrl) gaps.push('APK 公网直链:缺 APKPURE_DOWNLOAD_URL,且 mobile-download-leg.json 无 downloadUrl')
  if (!facts.apkpureContact) gaps.push('开发者联系邮箱:缺 APKPURE_CONTACT,且材料包 listing.contact 为空')
  // What's new 官方公开页只写 "may be shown publicly",未列为必填 ⇒ 缺省不阻塞,邮件里省略该行。
  if (facts.apkpureBundle?.status !== STATUS.FOUND) gaps.push(`APKPure 材料包:${facts.apkpureBundle?.detail ?? '未探测'}`)
  if (gaps.length) return result(store, 'blocked', gaps.join(' | '), { credential: facts.apkpureMail?.detail ?? null })
  return result(store, 'ready', `APK ${fmtBytes(facts.artifacts.apk.bytes)} → ${store.cli} --send --execute(提交请求函 url=${facts.apkpureDownloadUrl});${CEILING.apkpure}`, {
    artifact: facts.artifacts.apk.path,
    credential: facts.apkpureMail.detail,
    downloadUrl: facts.apkpureDownloadUrl,
  })
}

/** 五家国内客户端:凭据/签名/产物三关 + capability 档位(未证端点不报 ready)。 */
function planDomestic(store, facts) {
  const cred = facts.vendors?.[store.id]
  if (store.capability === 'unverified') {
    const credText = cred ? `${cred.status}(${cred.detail})` : '未探测'
    return result(store, 'scaffold', `客户端在册但上传端点零调用(正文登录墙);凭据=${credText};${CEILING[store.id]}`)
  }
  if (!cred) return result(store, 'unjudged', `${store.label} 凭据未探测`)
  if (cred.status === STATUS.UNJUDGED) return result(store, 'unjudged', `${store.label} 凭据未判定:${cred.detail}`)
  const gaps = gapsOf(facts, store)
  if (cred.status !== STATUS.FOUND) gaps.push(`${store.label} 凭据:${cred.detail}`)
  if (store.id === 'yyb' && !facts.yybFirstPublished) gaps.push('YYB 首包:未声明已后台上线(设 YYB_ASSUME_FIRST_PUBLISHED=1)')
  if (gaps.length) return result(store, 'blocked', gaps.join(' | '), { credential: cred.detail })
  return result(store, 'ready', `APK ${fmtBytes(facts.artifacts.apk.bytes)} → ${store.cli} --phase all;${CEILING[store.id]}`, { artifact: facts.artifacts.apk.path, credential: cred.detail })
}

/** 纯规划(不发请求、不写盘):八家逐条给状态。 */
export function planStores(facts) {
  return STORES.map((store) => {
    if (store.id === 'google-play') return planGooglePlay(store, facts)
    if (store.id === 'apkpure') return planApkpure(store, facts)
    if (store.id === 'huawei') return planHuawei(store, facts)
    return planDomestic(store, facts)
  })
}

/** 退出码:只有被点名商店判红/判未判定;`unjudged` 压过 `blocked`(2 比 1 更"没判成")。 */
export function foldExit(results, required = [], { execute = false, inputError = null } = {}) {
  if (inputError) return 2
  const req = results.filter((r) => required.includes(r.id))
  if (req.some((r) => r.status === 'unjudged')) return 2
  const pass = execute ? 'submitted' : 'ready'
  if (req.some((r) => r.status !== pass)) return 1
  return 0
}

/** 国内客户端 argv 单源:所有腿同形,只有 huawei/yyb 各多一枚显式声明位。 */
export function buildStoreArgv(store, { file, appId = null } = {}) {
  const args = [store.cli, '--phase', 'all', '--file', file, '--execute']
  if (store.id === 'huawei' && appId) args.push('--app-id', String(appId))
  if (store.id === 'yyb') args.push('--assume-first-published')
  return args
}

/** APKPure 邮件腿 argv:--send 与 --execute 必须同现(缺一即回落 dry-run);直链/联系/说明按 env 缺省。 */
export function buildApkpureArgv({ cli = 'scripts/submit-store-apkpure.mjs', downloadUrl, contact = null, notes = null } = {}) {
  const args = [cli, '--send', '--execute', '--url', String(downloadUrl ?? '')]
  if (contact) args.push('--contact', String(contact))
  if (notes) args.push('--notes', String(notes))
  return args
}

/** Play 直连腿:全内存签名,不落盘;不依赖 EAS/EXPO_TOKEN。 */
async function executeGooglePlay(store, facts, { env: _env = process.env, fetchImpl = fetch } = {}) {
  if (facts.play.status !== STATUS.FOUND) {
    return result(store, facts.play.status === STATUS.MISSING ? 'failed' : 'unjudged', `Play 服务账号:${facts.play.detail}`)
  }
  const planR = planPlayRelease({
    aabPath: facts.artifacts.aab.path,
    packageName: facts.packageName,
    track: facts.playTrack,
    releaseStatus: facts.playReleaseStatus,
  })
  if (planR.status !== STATUS.FOUND) {
    return result(store, planR.status === STATUS.MISSING ? 'failed' : 'unjudged', `申报单未成立:${planR.detail}`)
  }
  const r = await publishPlayBundle({ fetchImpl, creds: facts.play.value, plan: planR.plan })
  const evidence = r.steps.map((s) => `${s.step}=${s.status}`).join(' → ')
  if (r.status === STATUS.FOUND) {
    return result(store, 'submitted', `androidpublisher commit 成功 versionCode=${r.versionCode} track=${facts.playTrack} status=${facts.playReleaseStatus};${CEILING['google-play']}(${evidence})`, { artifact: facts.artifacts.aab.path, versionCode: r.versionCode })
  }
  return result(store, r.status === STATUS.MISSING ? 'failed' : 'unjudged', `Play 直连:${r.detail}(${evidence})`, { artifact: facts.artifacts.aab.path })
}

/** 国内腿:子进程执行客户端;exit 0 也只按该店 ceiling 记(不越级说 submitted)。 */
function executeDomestic(store, facts, { env = process.env, root = ROOT, run = sh } = {}) {
  const r = run(process.execPath, buildStoreArgv(store, { file: facts.artifacts.apk.path, appId: facts.huawei?.appId }), {
    cwd: root,
    env,
    timeout: 900000,
  })
  const evidence = redact(tail(r.err || r.out), [])
  if (r.code === 0) {
    return result(store, store.success, `${store.label} CLI exit=0;${CEILING[store.id]}`, { artifact: facts.artifacts.apk.path, evidence })
  }
  if (r.code === 2) return result(store, 'unjudged', `${store.label} CLI exit=2(未判定):${evidence}`)
  return result(store, 'failed', `${store.label} CLI exit=${r.code}: ${evidence}`)
}

/** APKPure 邮件腿:子进程发提交函;exit 0 只代表 Resend 受理(不越级说已上架);报错里的 key 一律脱敏。 */
function executeApkpure(store, facts, { env = process.env, root = ROOT, run = sh } = {}) {
  const r = run(process.execPath, buildApkpureArgv({ downloadUrl: facts.apkpureDownloadUrl, contact: facts.apkpureContact, notes: facts.apkpureNotes }), {
    cwd: root,
    env,
    timeout: 300000,
  })
  const evidence = redact(tail(r.err || r.out), [String(facts.apkpureMail?.value?.apiKey ?? '')])
  if (r.code === 0) {
    return result(store, 'submitted', `APKPure CLI exit=0(提交请求函已由 Resend 受理;回执见 evidence;不等于 APKPure 受理/上架);${CEILING.apkpure}`, { artifact: facts.artifacts.apk.path, evidence })
  }
  if (r.code === 2) return result(store, 'unjudged', `APKPure CLI exit=2(未判定):${evidence}`)
  return result(store, 'failed', `APKPure CLI exit=${r.code}: ${evidence}`)
}

/** 执行(只对 `ready` 的腿):返回**新**结果数组,失败原样保留其余腿。 */
export async function executeStores(results, facts, { env = process.env, root = ROOT, run = sh, fetchImpl = fetch } = {}) {
  const out = []
  for (const r of results) {
    if (r.status !== 'ready') {
      out.push(r)
      continue
    }
    const store = STORES.find((s) => s.id === r.id)
    if (!store) {
      out.push(r)
      continue
    }
    if (store.id === 'google-play') out.push(await executeGooglePlay(store, facts, { env, fetchImpl }))
    else if (store.capability === 'upload-verified' && store.cli) out.push(executeDomestic(store, facts, { env, root, run }))
    else if (store.capability === 'mail-verified' && store.cli) out.push(executeApkpure(store, facts, { env, root, run }))
    else out.push(r)
  }
  return out
}

/** UTC YYMMDDHH(与 app.config.js / CI 的 `date -u +%y%m%d%H` 同规则;商店要求每次发布必增)。 */
export function utcVersionCode(at = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${p(at.getUTCFullYear() % 100)}${p(at.getUTCMonth() + 1)}${p(at.getUTCDate())}${p(at.getUTCHours())}`
}

/**
 * 本机一条命令兜底:Windows 上先走正式出包链(单 ABI 以对齐体积基线)。
 * versionCode 缺省走 UTC 时间码 —— 出包脚本自己的缺省是"机上已装版本+1",那可能低于商店已收的号。
 */
export function runBuild({ versionCode = null, versionName = null, root = ROOT, run = sh, platform = process.platform } = {}) {
  if (platform !== 'win32') {
    return { ok: false, status: 'unjudged', detail: '--build 只实现在 Windows(本机出包链要求 PowerShell 7);CI 侧由 workflow 的 gradle 步骤出包' }
  }
  const args = [
    '-NoProfile',
    '-File',
    join(root, 'scripts', 'build-mobile-rn-release.ps1'),
    '-NoPublish',
    '-Abi',
    'arm64-v8a',
    '-ApiBaseUrl',
    'https://www.aizhs.top',
    '-WebBaseUrl',
    'https://www.aizhs.top',
    '-WsBaseUrl',
    'https://api.aizhs.top',
  ]
  args.push('-VersionCode', String(versionCode || utcVersionCode()))
  if (versionName) args.push('-VersionName', String(versionName))
  const r = run('pwsh', args, { cwd: root, timeout: 3600000 })
  if (r.code === 0) return { ok: true, status: 'built', detail: '正式签名 APK/AAB 已产出(未发布到官网 latest)' }
  return { ok: false, status: 'failed', detail: `build-mobile-rn-release.ps1 exit=${r.code}: ${tail(r.err || r.out)}` }
}

const STATUS_LABEL = Object.freeze({
  ready: '就绪(dry-run)',
  submitted: '已提交',
  'uploaded-partial': '已上传,待人工提交发布',
  blocked: '缺前置',
  manual: '只能人工',
  scaffold: '客户端在册,端点未证',
  failed: '执行失败',
  unjudged: '未判定',
})

export function renderHuman(results, { execute = false } = {}) {
  const lines = []
  for (const r of results) {
    const ok = r.status === (execute ? 'submitted' : 'ready')
    lines.push(`${ok ? 'ok  ' : 'warn'} ${r.id.padEnd(12)} ${STATUS_LABEL[r.status] ?? r.status}  ${r.detail}`)
  }
  return lines.join('\n')
}

/** GitHub Step Summary:一张表,逐店点名状态与缺项;detail 里的 `|` 与换行压平,不破表格。 */
export function renderStepSummary({ results, required = [], execute = false, version = null, build = null }) {
  const cell = (s) => String(s ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '/')
  const ver = version ? `${version.versionName ?? '?'}${version.versionCode ? ` (${version.versionCode})` : ''}` : '未判定'
  const out = [
    `### Android 商店发布矩阵(${execute ? 'execute' : 'dry-run'})`,
    '',
    `- 版本:\`${cell(ver)}\``,
    `- required:\`${required.length ? required.join(',') : '(未点名 ⇒ 不判红)'}\``,
    build ? `- 出包:${cell(build.status)} ${cell(build.detail)}` : '',
    '',
    '| 商店 | 模式 | 状态 | 说明 |',
    '| --- | --- | --- | --- |',
    ...results.map((r) => `| ${r.label} | ${r.mode} | ${r.status} | ${cell(r.detail)} |`),
  ].filter((l) => l !== '')
  return out.join('\n')
}

function usage() {
  return [
    '用法: node scripts/publish-stores.mjs [--execute] [--required a,b] [--json] [--build]',
    '                              [--apk <path>] [--aab <path>] [--version-code N] [--version-name V]',
    '                              [--track alpha|beta|internal|production] [--release-status draft|completed]',
    `商店: ${STORE_IDS.join(', ')}`,
    '退出码:0 被点名商店达成 / 1 被点名商店未达成 / 2 未判定或输入取不到',
  ].join('\n')
}

/** CLI 参数解析(纯函数,便于镜像测试;拼错开关一律抛错,不静默回落)。 */
export function parseArgv(argv = []) {
  const out = { execute: false, json: false, build: false, required: [], apk: null, aab: null, versionCode: null, versionName: null, track: 'alpha', releaseStatus: 'draft', help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const val = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} 缺参数`)
      return v
    }
    if (a === '--execute') out.execute = true
    else if (a === '--json') out.json = true
    else if (a === '--build') out.build = true
    else if (a === '--help') out.help = true
    else if (a === '--required') out.required.push(...String(val()).split(',').map((s) => s.trim()).filter(Boolean))
    else if (a === '--apk') out.apk = val()
    else if (a === '--aab') out.aab = val()
    else if (a === '--version-code') out.versionCode = val()
    else if (a === '--version-name') out.versionName = val()
    else if (a === '--track') out.track = val()
    else if (a === '--release-status') out.releaseStatus = val()
    else throw new Error(`未知开关 ${a}`)
  }
  const unknown = out.required.filter((id) => !STORE_IDS.includes(id))
  if (unknown.length) throw new Error(`--required 里有无此商店:${unknown.join(',')}(可选:${STORE_IDS.join(',')})`)
  if (!['alpha', 'beta', 'internal', 'production'].includes(out.track)) throw new Error(`--track 只接受 alpha|beta|internal|production,收到 ${out.track}`)
  if (!['draft', 'completed', 'inProgress', 'halted'].includes(out.releaseStatus)) throw new Error(`--release-status 只接受 draft|completed,收到 ${out.releaseStatus}`)
  return out
}

async function main(argv = process.argv.slice(2), { env = process.env, platform = process.platform, run = sh, fetchImpl = fetch } = {}) {
  let opts
  try {
    opts = parseArgv(argv)
  } catch (e) {
    console.log(`❔ 未判定:${e?.message ?? e}`)
    console.log(usage())
    return 2
  }
  if (opts.help) {
    console.log(usage())
    return 0
  }

  let build = null
  if (opts.build) {
    build = runBuild({ versionCode: opts.versionCode, versionName: opts.versionName, root: ROOT, run, platform })
    console.log(`出包: ${build.status} ${build.detail}`)
    if (!build.ok) return build.status === 'unjudged' ? 2 : 1
  }

  const facts = gatherFacts({ env, rnDir: RN_DIR, apk: opts.apk, aab: opts.aab, track: opts.track, releaseStatus: opts.releaseStatus })
  let results = planStores(facts)
  if (opts.execute) results = await executeStores(results, facts, { env, root: ROOT, run, fetchImpl })

  console.log(renderHuman(results, { execute: opts.execute }))
  if (build) console.log(`出包: ${build.status} (${build.detail})`)
  const code = foldExit(results, opts.required, { execute: opts.execute })
  if (opts.required.length && code !== 0) {
    const bad = results.filter((r) => opts.required.includes(r.id) && r.status !== (opts.execute ? 'submitted' : 'ready'))
    console.log(`点名商店未达成: ${bad.map((r) => `${r.id}=${r.status}`).join(', ')}`)
  }

  const summary = renderStepSummary({ results, required: opts.required, execute: opts.execute, version: facts.version, build })
  try {
    if (env.GITHUB_STEP_SUMMARY) writeFileSync(env.GITHUB_STEP_SUMMARY, `${summary}\n`, { flag: 'a' })
  } catch {
    /* Summary 写不进不改结论 */
  }
  if (opts.json) {
    console.log(
      JSON.stringify({
        execute: opts.execute,
        required: opts.required,
        version: facts.version,
        exitCode: code,
        stores: results,
      }),
    )
  }
  return code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.stack ?? e}`)
      process.exit(2)
    })
}

export const __test__ = {
  STATUS,
  STORES,
  STORE_IDS,
  CEILING,
  resolveArtifacts,
  readReleaseVersion,
  gatherFacts,
  planStores,
  foldExit,
  parseArgv,
  buildStoreArgv,
  buildApkpureArgv,
  executeStores,
  renderHuman,
  renderStepSummary,
  runBuild,
  utcVersionCode,
  redact,
  tail,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
