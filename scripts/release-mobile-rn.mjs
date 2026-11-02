#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * release-mobile-rn.mjs — mobile-rn 发布链路唯一出口(2026-11-02 立)
 *
 * 为什么要有这一层:"发布"此前散在四条互不知情的路上 —— 出包靠 build-mobile-rn-release.ps1、
 * 下发靠 publish-mobile-apk.mjs、OTA/构建/提交只能人工敲 eas(仓库里零接线)、Play 轨道口径只写在
 * docs/RELEASE.md:409。结果是**账面绿而链路断**:eas.json 的 submit.production 曾是空对象,
 * production 渠道从未创建,而 runtimeVersion 跟着每次自动涨的显示版本走 ⇒ 10-27 那条 OTA 落在
 * runtime `0.0.8`,线上最新包却是 `0.0.9`,对任何已装用户永久不可达(2026-11-02 `eas channel:list` 实测)。
 * 本文件把「有哪几条腿 / 每腿要什么前置 / 跑什么命令 / 怎么算真落地」收成一处,并且每次都现读
 * 凭据在不在位:取不到落 unjudged 并点名原因,绝不冒绿(§0.3),也不写跑不通的出路(§0.8)。
 *
 * 签名一致性是 Play 腿的命脉:EAS 云端 2026-10-19 那枚 production AAB 用的是 EAS 自动生成的
 * keystore(证书 SHA256 `62:0C:C9:58…`),官网包用的是 `ihui-release.keystore`(`62:B0:FF:0E…`)
 * ⇒ 两条渠道互斥。故 AAB 一律**本机以正式 keystore 出**、EAS 只负责提交。
 *
 * 用法:
 *   node scripts/release-mobile-rn.mjs                        # 体检所有腿(只读,不发包)
 *   node scripts/release-mobile-rn.mjs --json                 # 同上,机器读
 *   node scripts/release-mobile-rn.mjs --ensure-channels      # 建缺失的 EAS 渠道(可逆的打通动作)
 *   node scripts/release-mobile-rn.mjs --stage-credentials    # SA key 落进 gitignored 槽位(先证被忽略才落)
 *   node scripts/release-mobile-rn.mjs --leg ota-preview --execute -m "<本次说明>"
 *   node scripts/release-mobile-rn.mjs --diagnose-play        # 经本地代理探 Play 侧应用/授权(发外网请求)
 *
 * 退出码:0 全部 ready / 1 存在 blocked(已知缺前置,点名)/ 2 存在 unjudged 或本脚本自身取不到输入
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import Module from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { STATUS, fp, expoToken, playServiceKey, androidSigning, easEntry, storeCredential, androidArtifacts, STORE_VENDORS } from './lib/rn-release-credentials.mjs'
import { resolveSecretsRoot } from './lib/key-dir.mjs'
import { siteLegPlan } from './publish-mobile-apk.mjs'

const ROOT = join(import.meta.dirname, '..')
const RN_DIR = join(ROOT, 'apps', 'mobile-rn')
const CONFIG_JS = join(RN_DIR, 'app.config.js')
const PLAY_PACKAGE = 'zh.ai.sq'
const CHANNELS = ['preview', 'production']
const SA_SLOT_REL = 'credentials/google-play-service-account.json'

// ── 执行器(§12g:派生进程必须显式接管 stdio;禁 shell:true) ──
function sh(file, args, { cwd = RN_DIR, env = {}, timeout = 240000 } = {}) {
  try {
    const out = execFileSync(file, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout, windowsHide: true, env: { ...process.env, ...env } })
    return { code: 0, out: String(out ?? '').trim(), err: '' }
  } catch (e) {
    return { code: e?.status ?? 'null', out: String(e?.stdout ?? '').trim(), err: String(e?.stderr ?? '').trim() }
  }
}
const mkEas = (entry, token) => (args, opts = {}) => sh(process.execPath, [entry, ...args], { env: { EXPO_TOKEN: token || '', EAS_NON_INTERACTIVE: '1' }, ...opts })

// ── 纯判据(镜像测试直接 import,不在测试里复抄) ──
/** 三态归并:unjudged > blocked > ready。失效方向恒为"多要一次说明"。 */
export function foldStatus(states) {
  if (!states.length) return 'unjudged'
  if (states.includes(STATUS.UNJUDGED)) return 'unjudged'
  if (states.includes(STATUS.MISSING)) return 'blocked'
  return 'ready'
}

/**
 * eas.json submit 段完整性。
 * 键名合法性是被**逼出来**的:先写了 `packageName`,结果 eas-cli 的 schema 当场拒
 * (`"submit.production.android.packageName" is not allowed`),而它一拒就顶掉**所有** eas 命令
 * (连 channel:list 都退 1)⇒ 包名只能从 app.json 的 android.package 读,这里只做核对(2026-11-02 实测)。
 */
export function checkSubmitProfile(easJson, { packageName } = {}) {
  const p = easJson?.submit?.production?.android
  if (!p) return { status: STATUS.MISSING, detail: 'eas.json 无 submit.production.android 段' }
  const absent = ['track', 'serviceAccountKeyPath'].filter((k) => !p[k])
  if (absent.length) return { status: STATUS.MISSING, detail: `submit.production.android 缺 ${absent.join(',')}` }
  // docs/RELEASE.md:409 实测口径:个人开发者号"12 人×14 天"门槛只认闭测,API 轨道名是 alpha
  if (!['alpha', 'beta'].includes(p.track)) return { status: STATUS.MISSING, detail: `track="${p.track}" 进不了闭测门槛(internal 永远不满足 12 人×14 天)` }
  if (packageName && packageName !== PLAY_PACKAGE) return { status: STATUS.MISSING, detail: `app.json android.package="${packageName}" ≠ 在册包名 ${PLAY_PACKAGE}` }
  return { status: STATUS.FOUND, detail: `track=${p.track} serviceAccountKeyPath=${p.serviceAccountKeyPath} packageName=${packageName ?? '(未取到)'}`, serviceKeyPath: p.serviceAccountKeyPath }
}

export function findChannel(jsonBody, name) {
  let parsed
  try {
    parsed = JSON.parse(jsonBody)
  } catch {
    return { status: STATUS.UNJUDGED, detail: 'channel:list 输出不是 JSON' }
  }
  const rows = parsed?.currentPage
  if (!Array.isArray(rows)) return { status: STATUS.UNJUDGED, detail: 'channel:list 输出缺 currentPage 数组' }
  const hit = rows.find((c) => c?.name === name)
  return hit
    ? { status: STATUS.FOUND, detail: `渠道 ${name} 在位(paused=${hit.isPaused},已发 update ${(hit.updateBranches || []).reduce((n, b) => n + (b.updateGroups || []).length, 0)} 条)` }
    : { status: STATUS.MISSING, detail: `渠道 ${name} 不存在(现枚举 ${rows.length} 条:${rows.map((r) => r?.name).join(',') || '无'})` }
}

/**
 * runtimeVersion 桶稳定性判据:同一份 app.config 在两个显示版本下,桶必须同值而显示版本必须不同。
 * 按 CJS 求值(app.config.js 写的是 require/module.exports,而 package.json 是 type:module,
 * 原生 require() 会把它当 ESM 而报 `require is not defined`;Expo 自己的加载器不受影响 ——
 * 2026-11-02 已用 `expo config --type public` 复量过同一条结论)。
 */
export function probeRuntimeVersion(readText, { a = '0.0.5.20261101', b = '0.0.5.20991231' } = {}) {
  const evaluate = (displayVersion) => {
    const m = new Module(CONFIG_JS, undefined)
    m.filename = CONFIG_JS
    m.paths = Module._nodeModulePaths(join(RN_DIR))
    const prev = process.env.IHUI_MOBILE_VERSION
    process.env.IHUI_MOBILE_VERSION = displayVersion // app.config.js 从 env 读显示版本,不注入两臂就是同一个值
    try {
      m._compile(readText, CONFIG_JS)
      const exported = m.exports
      if (typeof exported !== 'function') throw new Error(`app.config.js 导出 ${typeof exported},不是函数`)
      const base = createRequire(CONFIG_JS)(join(RN_DIR, 'app.json')).expo
      // 必须在 env 生效期间完成调用:app.config 的导出是闭包,process.env 在**调用时**才读
      return exported({ config: structuredClone(base) })
    } finally {
      if (prev === undefined) delete process.env.IHUI_MOBILE_VERSION
      else process.env.IHUI_MOBILE_VERSION = prev
    }
  }
  let A, B
  try {
    A = evaluate(a)
    B = evaluate(b)
  } catch (e) {
    return { status: STATUS.UNJUDGED, detail: `app.config 求值失败:${String(e?.message ?? e).slice(0, 160)}` }
  }
  const stable = Boolean(A.runtimeVersion) && A.runtimeVersion === B.runtimeVersion && A.version !== B.version
  return {
    status: stable ? STATUS.FOUND : STATUS.MISSING,
    detail: `桶=${A.runtimeVersion} 显示版本=${A.version}→${B.version}(桶${stable ? '不随显示版本漂移' : '仍随显示版本漂移 ⇒ OTA 发出去没人收得到'})`,
    bucket: A.runtimeVersion,
    displayVersion: A.version,
  }
}

export function firstMeaningfulLine(text) {
  return String(text ?? '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^[-—»]*$/.test(l))[0] ?? ''
}

/** 本地 HTTP CONNECT 代理探测:Google 域本机直连不通(实测 oauth2 timeout),口不写死、逐个现试。 */
export async function probeLocalProxy({ host = 'www.googleapis.com:443', timeoutMs = 1500, ports } = {}) {
  let list = ports
  if (!list) {
    let raw = ''
    try {
      raw = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, windowsHide: true })
    } catch {
      return { status: STATUS.UNJUDGED, detail: 'netstat 取不到 ⇒ 代理腿无法判定', port: null }
    }
    list = [...new Set([...raw.matchAll(/(?:127\.0\.0\.1|\[::1\]|0\.0\.0\.0):(\d+)\s+\S+\s+LISTENING/gi)].map((m) => Number(m[1])))].slice(0, 24)
  }
  const test = (port) =>
    new Promise((res) => {
      const req = http.request({ host: '127.0.0.1', port, method: 'CONNECT', path: host, agent: false, timeout: timeoutMs })
      req.on('connect', (r, sock) => {
        sock.destroy()
        res(r.statusCode === 200 ? port : null)
      })
      req.on('error', () => res(null))
      req.on('timeout', () => {
        req.destroy()
        res(null)
      })
      req.end()
    })
  const hit = (await Promise.all(list.map(test))).find(Boolean)
  return hit
    ? { status: STATUS.FOUND, detail: `127.0.0.1:${hit} 可 CONNECT ${host}`, port: hit }
    : { status: STATUS.MISSING, detail: `${list.length} 个本机监听口无一能转发到 ${host}`, port: null }
}

// ── 只读取证 ──
function takeEvidence({ withEas = true, withConfig = true }) {
  const tok = expoToken()
  const entry = easEntry({ dir: RN_DIR })
  const eas = mkEas(entry.value ?? '', tok.value)
  const canEas = withEas && tok.status === STATUS.FOUND && entry.status === STATUS.FOUND

  let whoami = { status: canEas ? STATUS.FOUND : tok.status === STATUS.UNJUDGED || entry.status === STATUS.UNJUDGED ? STATUS.UNJUDGED : STATUS.MISSING, detail: canEas ? '' : tok.status !== STATUS.FOUND ? `token:${tok.detail}` : `入口:${entry.detail}` }
  let channels = { status: STATUS.UNJUDGED, detail: '未取(EAS 身份不通)' }
  if (canEas) {
    const w = eas(['whoami'])
    whoami = w.code === 0 && w.out ? { status: STATUS.FOUND, detail: firstMeaningfulLine(w.out) } : { status: STATUS.MISSING, detail: `${firstMeaningfulLine(w.err || w.out) || 'whoami 无输出'}(token fp=${fp(tok.value)})` }
    if (whoami.status === STATUS.FOUND) {
      const c = eas(['channel:list', '--json'])
      channels = { status: c.code === 0 ? STATUS.FOUND : STATUS.UNJUDGED, detail: c.code === 0 ? '' : firstMeaningfulLine(c.err || c.out) || 'channel:list 非零退出', raw: c.out }
    }
  }

  let runtime = { status: STATUS.UNJUDGED, detail: '未取' }
  if (withConfig) {
    try {
      runtime = probeRuntimeVersion(readFileSync(CONFIG_JS, 'utf8'))
    } catch (e) {
      runtime = { status: STATUS.UNJUDGED, detail: `app.config 求值失败:${String(e?.message).slice(0, 140)}` }
    }
  }

  const signing = androidSigning()
  const saKey = playServiceKey()
  const appJson = JSON.parse(readFileSync(join(RN_DIR, 'app.json'), 'utf8')).expo ?? {}
  const easJson = JSON.parse(readFileSync(join(RN_DIR, 'eas.json'), 'utf8'))
  const submit = checkSubmitProfile(easJson, { packageName: appJson?.android?.package })

  const ign = sh('git', ['check-ignore', '-v', join(RN_DIR, SA_SLOT_REL).replace(/\\/g, '/')], { cwd: ROOT })
  const slot = {
    status: ign.code === 0 ? STATUS.FOUND : STATUS.MISSING,
    detail: ign.code === 0 ? `${SA_SLOT_REL} 被 ${firstMeaningfulLine(ign.out).split('\t')[0]} 忽略` : `${SA_SLOT_REL} 未被 gitignore 忽略 ⇒ 拒绝落凭据`,
  }

  // 站点腿落点必须问 publish-mobile-apk.mjs 的 siteLegPlan(单源,§0.6)。自己拼 join 会把主仓
  // 影子目录当成线上落点——它真实存在却不是线上 cdn-server 的 --root,判成 found 就是假绿。
  const plan = siteLegPlan({})
  const site = plan.chosen
    ? { status: STATUS.FOUND, detail: plan.chosen.dir.replace(/\\/g, '/') }
    : {
        status: plan.candidates.some((c) => c.source === 'prod-checkout') ? STATUS.MISSING : STATUS.UNJUDGED,
        detail: `线上落点未命中。已试:${plan.candidates.map((c) => `${c.source}=${c.dir.replace(/\\/g, '/')}`).join(' | ')}(主仓影子目录按设计不参与选择;IHUI_SITE_CDN_DIR=${plan.envOverride ?? '未设'})`,
      }

  const latest = {}
  for (const platform of ['android', 'ios']) {
    let r = null
    let row = null
    let parsed = false
    for (let attempt = 0; attempt < 2; attempt++) {
      r = sh('curl', ['-s', '-L', '--connect-timeout', '15', '--max-time', '40', `https://www.aizhs.top/api/app-version/latest?platform=${platform}`], { cwd: ROOT, timeout: 60000 })
      try {
        const data = JSON.parse(r.out)?.data
        // 真实结构是 data.latest.{…}(2026-11-02 实测;先按 data.{…} 取会把在线的行读成"没有")
        row = data?.latest ?? data
        parsed = true
        break
      } catch {
        parsed = false
      }
    }
    latest[platform] = !parsed
      ? { status: STATUS.UNJUDGED, detail: `${platform} latest 端点两次取回不可解析输出(curl exit=${r?.code})` }
      : row?.version
        ? { status: STATUS.FOUND, detail: `${platform} latest=${row.version}/${row.buildNumber} → ${row.downloadUrl}` }
        : { status: STATUS.MISSING, detail: `${platform} 无 status=latest 行 ⇒ 端内更新卡取不到包` }
  }

  const apple = (() => {
    const root = resolveSecretsRoot()
    if (!root) return { status: STATUS.UNJUDGED, detail: '密钥根解析不出 ⇒ 不能判"Apple 凭据无效"' }
    const hits = []
    const walk = (dir, depth) => {
      if (depth > 2) return
      let names = []
      try {
        names = readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const d of names) {
        const p = join(dir, d.name)
        if (d.isDirectory()) walk(p, depth + 1)
        else if (/\.(p8|mobileprovision|provisionprofile)$/i.test(d.name) || /apple|app.?store|asc|team.?id/i.test(d.name)) hits.push(d.name)
      }
    }
    walk(root, 0)
    return hits.length ? { status: STATUS.FOUND, detail: `命中 ${hits.length} 枚候选:${hits.slice(0, 5).join(',')}` } : { status: STATUS.MISSING, detail: `${root}(深 2 层)无 .p8/.mobileprovision/Apple 说明件 ⇒ ASC 提交无凭据` }
  })()

  const xcode = (() => {
    const r = sh('xcodebuild', ['-version'], { timeout: 15000 })
    return r.code === 0 ? { status: STATUS.FOUND, detail: firstMeaningfulLine(r.out) } : { status: STATUS.MISSING, detail: '本机无 Xcode ⇒ iOS 只能走 EAS 云端构建(记录形态,不阻塞)' }
  })()

  // 生产承载面(2026-11-02 现读:本机 Get-Service IHUI-* 零命中、无 IHUI-DEPLOYLOOP 计划任务,
  // 8801/8806/8807 是 dev 栈端口)⇒ 站点腿"落不了地"的根因不是目录被误删,而是这台机不承载生产。
  // 报告必须把这两件事分开,否则会把"去恢复一个本来就不该在这台机上的目录"当成出路推给人。
  const prodHost = (() => {
    const r = sh(
      'pwsh.exe',
      ['-NoProfile', '-Command', "(Get-Service -Name 'IHUI-*' -ErrorAction SilentlyContinue).Name -join ','"],
      { cwd: ROOT, timeout: 60000 },
    )
    if (r.code !== 0 && !r.out) return { status: STATUS.UNJUDGED, detail: `pwsh 取服务面失败(exit=${r.code})⇒ 不判承载面` }
    const names = r.out.trim()
    return names
      ? { status: STATUS.FOUND, detail: `本机承载 IHUI 服务:${names}` }
      : { status: STATUS.MISSING, detail: '本机零 IHUI-* 服务 ⇒ 不承载生产;站点腿落点在别处,需生产侧通道而非在本机造目录' }
  })()

  const artifacts = androidArtifacts({ dir: join(RN_DIR, 'android', 'app', 'build', 'outputs') })
  const stores = STORE_VENDORS.map((vendor) => ({ vendor, cred: storeCredential(vendor) }))

  return { tok, entry, eas, canEas, whoami, channels, runtime, signing, saKey, submit, appJson, slot, site, prodHost, latest, apple, xcode, artifacts, stores }
}

/**
 * 国内商店 + 鸿蒙矩阵腿(2026-11-02 加)。
 * 这一族此前**整仓零接线**(实读:appgallery/hms/小米/OPPO/vivo/应用宝 的命中全是 i18n 术语表、
 * 品牌图标或上游中转适配器,没有一处是上传器),所以先把"每家缺什么"做成可重跑的读数,
 * 而不是先写一个只能对着空凭据报错的脚本。出路一律指向同一个形态:
 * 复用 scripts/upload-miniapp.mjs 那一套(单出口 + 凭据三态 + 默认 dry-run + 登记腿)。
 */
export function buildStoreLegs(ev) {
  const channelGap = {
    k: '渠道登记面',
    status: STATUS.MISSING,
    detail: 'app_versions.platform 枚举 = ios/android/web/harmony/cli,无 store 维度 ⇒ 多家商店各自一条 latest 与下载地址在数据面上表达不出来(需一次加列迁移,属数据面不在发布器射程)',
  }
  return ev.stores.map(({ vendor, cred }) => ({
    id: `store-${vendor.id}`,
    title: `${vendor.label} 上架`,
    checks: [
      { k: '提交物(AAB/APK)', ...ev.artifacts },
      { k: '正式签名件', ...ev.signing },
      { k: '开发者凭据', ...cred },
      {
        k: '上传通道器物',
        status: STATUS.MISSING,
        detail: vendor.id === 'harmony' ? '本仓当前无 RN 鸿蒙产物能力(零 .ets / oh-package.json5 / react-native-harmony)⇒ 先解决产物,发布腿才有意义' : `仓内无面向 ${vendor.label} 的上传器;凭据到位后新增 scripts/submit-store-${vendor.id}.mjs`,
      },
      channelGap,
    ],
    command: vendor.id === 'harmony' ? '先做鸿蒙产物适配(独立工程票),再回到本腿' : `凭据补进密钥目录后:node scripts/release-mobile-rn.mjs --leg store-${vendor.id} --execute`,
    note: vendor.note,
  }))
}


export function buildLegs(ev) {
  const ch = (name) => (ev.channels.raw ? findChannel(ev.channels.raw, name) : ev.channels)
  const ota = (name) => ({
    id: `ota-${name}`,
    title: `OTA → EAS Update(${name} 渠道)`,
    checks: [
      { k: 'Expo 身份', ...ev.whoami },
      { k: 'runtimeVersion 桶', ...ev.runtime },
      { k: `渠道 ${name}`, ...ch(name) },
      { k: 'updates.url', status: ev.appJson?.updates?.url ? STATUS.FOUND : STATUS.MISSING, detail: ev.appJson?.updates?.url ?? 'app.json 未配 expo.updates.url' },
    ],
    command: `eas update --channel ${name} --environment ${name} --platform android --message "<本次说明>" --non-interactive`,
  })
  return [
    {
      id: 'site-apk',
      title: 'Android → 官网固定地址 + 端内更新卡',
      checks: [{ k: '正式签名件', ...ev.signing }, { k: '站点落点', ...ev.site }, { k: '本机生产承载面', ...ev.prodHost }, { k: '线上 latest 登记(android)', ...ev.latest.android }],
      command: 'pwsh -File scripts/build-mobile-rn-release.ps1   # 出包链尾自动走 publish-mobile-apk.mjs(含 app_versions 登记)',
    },
    {
      id: 'play-aab',
      title: 'Android AAB → Google Play(alpha 闭测轨)',
      checks: [
        { k: '正式签名件', ...ev.signing },
        { k: 'eas.json submit 段', ...ev.submit },
        { k: 'Play 服务账号', ...ev.saKey },
        { k: '凭据槽位被忽略', ...ev.slot },
        { k: 'Expo 身份', ...ev.whoami },
        {
          k: '签名一致性',
          status: STATUS.UNJUDGED,
          detail:
            '官网包=ihui-release.keystore(证书 SHA256 62:B0:FF:0E…),EAS 云端那枚 production AAB=EAS 自动 keystore(62:0C:C9:58…),二者不同源;Play 现网签名身份未取到(appSigningInfo 在本应用形态下回 HTML 404)⇒ 以本机 key 提交会不会被拒未判定,提交前必须先量一次',
        },
        { k: 'Play 应用/授权', status: STATUS.UNJUDGED, detail: '默认体检不发外网请求 ⇒ 跑 --diagnose-play(实测已授权:alpha 轨挂着 0.0.6/26101921)' },
      ],
      command: 'cd apps/mobile-rn/android && ./gradlew bundleRelease -PreactNativeArchitectures=arm64-v8a && eas submit -p android -e production --path apps/mobile-rn/android/app/build/outputs/bundle/release/app-release.aab --non-interactive',
    },
    {
      id: 'app-store',
      title: 'iOS → TestFlight / App Store(EAS 云端构建)',
      checks: [
        { k: 'Expo 身份', ...ev.whoami },
        { k: 'bundleIdentifier', status: ev.appJson?.ios?.bundleIdentifier ? STATUS.FOUND : STATUS.MISSING, detail: ev.appJson?.ios?.bundleIdentifier ?? '未配' },
        { k: 'Apple 凭据', ...ev.apple },
        { k: '本机 Xcode', ...ev.xcode },
        { k: '线上 latest 登记(ios)', ...ev.latest.ios },
      ],
      command: 'eas build -p ios --profile production --non-interactive && eas submit -p ios -e production --auto-testflight-setup --non-interactive',
    },
    ota('preview'),
    ota('production'),
    ...buildStoreLegs(ev),
  ]
}

export function render(report, { json } = {}) {
  if (json) return JSON.stringify({ legs: report, generatedAt: new Date().toISOString() }, null, 2)
  const ICON = { ready: 'PASS', blocked: 'BLOCKED', unjudged: 'UNKNOWN' }
  let out = ''
  for (const leg of report) {
    out += `\n[${ICON[leg.status]}] ${leg.id.padEnd(13)} ${leg.title}\n`
    for (const c of leg.checks) out += `      ${c.status === STATUS.FOUND ? '-' : '!'} ${c.k}: ${c.detail}\n`
    if (leg.status !== 'ready') out += `      出路: ${leg.command}\n`
  }
  const t = report.reduce((a, l) => ({ ...a, [l.status]: (a[l.status] || 0) + 1 }), {})
  out += `\nSUMMARY legs=${report.length} ready=${t.ready || 0} blocked=${t.blocked || 0} unjudged=${t.unjudged || 0}`
  return out
}

export function exitCode(report) {
  if (report.some((l) => l.status === 'unjudged')) return 2
  if (report.some((l) => l.status === 'blocked')) return 1
  return 0
}

async function main() {
  const argv = process.argv.slice(2)
  const flags = new Set(argv.filter((a) => a.startsWith('--')))
  const opt = (name, dflt) => {
    const i = argv.findIndex((a) => a === `--${name}`)
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt
  }
  if (flags.has('--self-test')) return selfTest()

  const ev = takeEvidence({})
  const report = buildLegs(ev).map((leg) => ({
    id: leg.id,
    title: leg.title,
    status: foldStatus(leg.checks.map((c) => c.status)),
    blockers: leg.checks.filter((c) => c.status !== STATUS.FOUND).map((c) => `${c.k}: ${c.detail}`),
    checks: leg.checks,
    command: leg.command,
  }))
  console.log(render(report, { json: flags.has('--json') }))

  if (flags.has('--ensure-channels')) {
    if (!ev.canEas || ev.whoami.status !== STATUS.FOUND) {
      console.log(`拒动:EAS 身份未通(${ev.whoami.detail})⇒ 创建渠道无法验证,不试`);
      return 2
    }
    for (const name of CHANNELS) {
      const c = findChannel(ev.channels.raw, name)
      if (c.status === STATUS.FOUND) console.log(`channel ${name}: 已在位,不动`)
      else if (c.status === STATUS.MISSING) {
        const r = ev.eas(['channel:create', name, '--json', '--non-interactive'], { timeout: 180000 })
        const back = findChannel(ev.eas(['channel:list', '--json']).out, name)
        console.log(`channel ${name}: create exit=${r.code} → 回读 ${back.status}(${back.detail})`)
      } else console.log(`channel ${name}: ${c.status}(${c.detail})⇒ 不动`);
    }
  }

  if (flags.has('--stage-credentials')) {
    if (ev.saKey.status !== STATUS.FOUND) {
      console.log(`拒落:SA key ${ev.saKey.status}(${ev.saKey.detail})`);
      return 1
    }
    if (ev.slot.status !== STATUS.FOUND) {
      console.log(`拒落:${ev.slot.detail} —— 落进去等于把私钥交给提交链(§5d)`);
      return 1
    }
    const dest = join(RN_DIR, SA_SLOT_REL)
    mkdirSync(join(dest, '..'), { recursive: true })
    copyFileSync(ev.saKey.value.path, dest)
    const st = sh('git', ['status', '--porcelain', '--', dest.replace(/\\/g, '/')], { cwd: ROOT })
    console.log(st.out.trim() ? `异常:落件后 git status 仍显示 ${st.out.trim()} ⇒ 核查 .gitignore` : `已落 SA key → ${SA_SLOT_REL}(clientEmail=${ev.saKey.value.clientEmail},fp=${fp(ev.saKey.value.path)},git status 不显示)`)
  }

  if (flags.has('--diagnose-play')) {
    const proxy = await probeLocalProxy({})
    console.log(`代理探测:${proxy.status} ${proxy.detail}`)
    const env = proxy.port ? { NODE_USE_ENV_PROXY: '1', HTTPS_PROXY: `http://127.0.0.1:${proxy.port}`, HTTP_PROXY: `http://127.0.0.1:${proxy.port}` } : {}
    const r = sh(process.execPath, [join(ROOT, 'scripts', 'probe-play-status.mjs'), ...(flags.has('--json') ? ['--json'] : [])], { cwd: ROOT, env, timeout: 180000 })
    console.log(r.code === 0 ? r.out : `exit=${r.code}\n${(r.out + r.err).slice(0, 900)}`)
  }

  if (flags.has('--execute')) {
    const id = opt('leg')
    const leg = report.find((l) => l.id === id)
    if (!leg) {
      console.log(`--leg 必须取 ${report.map((l) => l.id).join('/')}`);
      return 2
    }
    if (leg.status !== 'ready') {
      console.log(`拒跑:${leg.id} 判 ${leg.status},卡点 ${leg.blockers.length} 条:\n  ${leg.blockers.join('\n  ')}`);
      return 1
    }
    if (!id.startsWith('ota-')) {
      console.log(`本腿执行体尚未接线,命令:${leg.command}`);
      return 2
    }
    const channel = id.replace('ota-', '')
    const message = opt('m') ?? opt('message') ?? `release ${id} @ ${new Date().toISOString().slice(0, 16)}Z`
    const r = ev.eas(['update', '--channel', channel, '--environment', channel, '--platform', 'android', '--message', message, '--non-interactive'], { timeout: 900000 })
    console.log(`eas update(${channel}) exit=${r.code} ${firstMeaningfulLine(r.out) || firstMeaningfulLine(r.err)}`)
    const back = findChannel(ev.eas(['channel:list', '--json']).out, channel)
    console.log(`回读渠道:${back.status} ${back.detail}`)
    return r.code === 0 && back.status === STATUS.FOUND ? 0 : 1
  }

  return exitCode(report)
}

function selfTest() {
  const cases = []
  const eq = (name, got, want) => cases.push({ name, pass: JSON.stringify(got) === JSON.stringify(want), got, want })
  eq('fold:空集 ⇒ unjudged(不冒绿)', foldStatus([]), 'unjudged')
  eq('fold:unjudged 压过 blocked', foldStatus([STATUS.FOUND, STATUS.MISSING, STATUS.UNJUDGED]), 'unjudged')
  eq('fold:blocked 压过 ready', foldStatus([STATUS.FOUND, STATUS.MISSING]), 'blocked')
  eq('fold:全 found ⇒ ready', foldStatus([STATUS.FOUND, STATUS.FOUND]), 'ready')
  const goodSubmit = { submit: { production: { android: { track: 'alpha', serviceAccountKeyPath: './credentials/x.json' } } } }
  eq('submit:alpha 齐备 ⇒ found(阳性对照)', checkSubmitProfile(goodSubmit, { packageName: PLAY_PACKAGE }).status, STATUS.FOUND)
  eq('submit:空对象 ⇒ missing', checkSubmitProfile({ submit: { production: {} } }).status, STATUS.MISSING)
  eq('submit:internal ⇒ missing(闭测门槛进不去)', checkSubmitProfile({ submit: { production: { android: { ...goodSubmit.submit.production.android, track: 'internal' } } } }).status, STATUS.MISSING)
  eq('submit:包名与在册不符 ⇒ missing', checkSubmitProfile(goodSubmit, { packageName: 'other.pkg' }).status, STATUS.MISSING)
  eq('submit:写了 eas.json 不认的 packageName ⇒ 仍按缺项处理不了,应缺席(回归锁)', checkSubmitProfile({ submit: { production: { android: { track: 'alpha', serviceAccountKeyPath: './x', packageName: PLAY_PACKAGE } } } }).status, STATUS.FOUND)
  eq('真件:eas.json 里不得出现 packageName(eas-cli schema 拒该键并顶掉全部 eas 命令)', 'packageName' in (JSON.parse(readFileSync(join(RN_DIR, 'eas.json'), 'utf8'))?.submit?.production?.android ?? {}), false)
  eq('channel:命中 ⇒ found(阳性对照)', findChannel(JSON.stringify({ currentPage: [{ name: 'preview', isPaused: false, updateBranches: [{ updateGroups: [{}] }] }] }), 'preview').status, STATUS.FOUND)
  eq('channel:缺失时点名枚举集', findChannel(JSON.stringify({ currentPage: [{ name: 'preview' }] }), 'production').detail.includes('preview'), true)
  eq('channel:坏 JSON ⇒ unjudged', findChannel('not json', 'preview').status, STATUS.UNJUDGED)
  eq('channel:缺 currentPage ⇒ unjudged', findChannel('{}', 'preview').status, STATUS.UNJUDGED)
  eq('ANSI 剥除', firstMeaningfulLine('\x1b[32m  ✓ done \x1b[0m'), '✓ done')
  eq('exitCode:有 unjudged ⇒ 2', exitCode([{ status: 'ready' }, { status: 'unjudged' }]), 2)
  eq('exitCode:仅 blocked ⇒ 1', exitCode([{ status: 'ready' }, { status: 'blocked' }]), 1)
  eq('exitCode:全 ready ⇒ 0', exitCode([{ status: 'ready' }]), 0)
  let runtimeReal = null
  try {
    runtimeReal = probeRuntimeVersion(readFileSync(CONFIG_JS, 'utf8'))
  } catch (e) {
    runtimeReal = { status: STATUS.UNJUDGED, detail: String(e?.message).slice(0, 120) }
  }
  eq('真件:runtimeVersion 桶不随显示版本漂移', runtimeReal.status, STATUS.FOUND)
  eq('真件:桶等于基座版本(与线上显示版本解耦)', /^[0-9]+\.[0-9]+\.[0-9]+$/.test(runtimeReal.bucket ?? ''), true)
  // 反向对照:复刻 2026-11-02 之前的缺陷形态(桶=显示版本),同一判据必须翻红——否则这把尺子永远绿
  const defectShape = `module.exports = ({ config }) => ({ version: process.env.IHUI_MOBILE_VERSION, runtimeVersion: process.env.IHUI_MOBILE_VERSION })`
  eq('反例:桶随显示版本漂移 ⇒ 判 missing', probeRuntimeVersion(defectShape).status, STATUS.MISSING)
  eq('反例:桶恒缺 ⇒ 判 missing', probeRuntimeVersion('module.exports = () => ({ version: process.env.IHUI_MOBILE_VERSION })').status, STATUS.MISSING)
  // 出路可跑性锁:`eas update --non-interactive` 缺 --environment 会当场报 "The --environment flag must be set"
  // (2026-11-02 冒烟实测)⇒ 命令形态一旦被改回去,这枚锁必须翻红,而不是等到真要发布那天才发现
  const self = readFileSync(join(ROOT, 'scripts', 'release-mobile-rn.mjs'), 'utf8')
  eq('OTA 执行参数带 --environment', self.includes(" '--environment', channel"), true)
  eq('OTA 展示命令带 --environment', /eas update --channel \$\{name\} --environment \$\{name\}/.test(self), true)
  const fail = cases.filter((c) => !c.pass).length
  for (const c of cases) console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.name}${c.pass ? '' : ` got=${JSON.stringify(c.got)} want=${JSON.stringify(c.want)}`}`)
  console.log(`SELF-TEST cases=${cases.length} fail=${fail}`)
  return fail ? 1 : 0
}

export const __test__ = { foldStatus, checkSubmitProfile, findChannel, firstMeaningfulLine, probeRuntimeVersion, buildLegs, buildStoreLegs, render, exitCode, PLAY_PACKAGE, SA_SLOT_REL, STATUS }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
