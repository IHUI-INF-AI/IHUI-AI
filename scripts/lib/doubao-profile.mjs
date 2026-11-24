// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包 Chromium profile 单一解析器(2026-11-24 立)。
 *
 * 立因:豆包桌面端每个登录号各占一个 Chromium profile(`Default` / `Profile 2` …),
 * 活跃号由 `User Data\Local State` 的 `profile.last_used` 决定。此前的导出/写回腿
 * 一律硬编码 `Default`,在“当前活跃号在 Profile N”的机器上会读错号、写错号:
 * 导出拿到的是另一个号的对话,切号也切不到用户眼前那个号。
 *
 * 本模块只做**路径与 profile 名判定**,不读 cookie、不解密、不写盘:
 *  - `Default` / `Profile N` 是唯一合法 profile 名(与 Chromium 目录名同字面);
 *  - `active` 是别名,解析为 `Local State.profile.last_used`;
 *  - 缺省(未给 profile)保持旧口径 `Default`,绝不静默改切当前号 —— 是否切当前号
 *    必须由调用方显式说 `active` 或 `Profile N`,防止把宿主会话(本机 AI 助手所在 profile)
 *    误切走。
 *
 * 纪律:解析失败一律 `ok:false` + `code`,不回落另一个 profile 冒充成功;
 * 候选目录跨用户扫描复用 `doubao-auth-extract.candidateUserDataDirs`,不造第二份。
 */
import fs from 'node:fs'
import path from 'node:path'

import { candidateUserDataDirs, listDoubaoProfiles } from './doubao-auth-extract.mjs'

export const DOUBAO_PROFILE_RE = /^(Default|Profile \d+)$/
/** 显式“当前活跃号”别名:大小写不敏感 */
export const DOUBAO_ACTIVE_PROFILE_ALIASES = Object.freeze(['active', 'current', 'last-used'])

/** profile 名是否合法(只认 Chromium 目录名,不认路径) */
export function isDoubaoProfileName(value) {
  return typeof value === 'string' && DOUBAO_PROFILE_RE.test(value)
}

/** 读 `Local State` 的 profile 元信息(只读;坏文件如实报 code) */
export function readDoubaoProfileState(userDataDir) {
  const file = path.join(userDataDir, 'Local State')
  if (!fs.existsSync(file)) {
    return { ok: false, code: 'local-state-missing', file, lastUsed: '', names: [], message: `Local State 不存在:${file}` }
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    const profile = parsed && typeof parsed === 'object' ? parsed.profile : null
    const lastUsed = typeof profile?.last_used === 'string' ? profile.last_used : ''
    const infoCache = profile?.info_cache && typeof profile.info_cache === 'object' ? profile.info_cache : {}
    const names = Object.keys(infoCache).filter(isDoubaoProfileName)
    return { ok: true, code: 'ok', file, lastUsed, names }
  } catch (e) {
    return {
      ok: false,
      code: 'local-state-unreadable',
      file,
      lastUsed: '',
      names: [],
      message: `Local State 读不了:${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra }
}

function profileLabel(profile, source) {
  if (source === 'active') return `${profile}(当前活跃)`
  if (source === 'default') return `${profile}(默认)`
  if (source === 'default-first') return `${profile}(无 Default,取首个)`
  if (source === 'explicit') return profile
  return profile
}

/**
 * 解析一个可用的豆包 profile。
 *
 * @param {object} [opts]
 * @param {string} [opts.userDataDir] 指定 `...\Doubao\User Data`;缺省跨用户候选
 * @param {string} [opts.profile] `Default` / `Profile N` / `active|current|last-used`;缺省 Default
 * @param {NodeJS.ProcessEnv} [opts.env] 测试注入
 * @returns {{ok:true,userDataDir:string,profile:string,profileDir:string,source:string,
 *   lastUsed:string,profiles:string[],label:string,notes:string[],candidates:object[]}
 *   | {ok:false,code:string,message:string,candidates?:object[]}}
 */
export function resolveDoubaoProfile(opts = {}) {
  const env = opts.env ?? process.env
  const requestedRaw = typeof opts.profile === 'string' ? opts.profile.trim() : ''
  const requestedLower = requestedRaw.toLowerCase()
  const explicitName = isDoubaoProfileName(requestedRaw) ? requestedRaw : ''
  const wantActive = explicitName === '' && DOUBAO_ACTIVE_PROFILE_ALIASES.includes(requestedLower)
  if (requestedRaw !== '' && explicitName === '' && !wantActive) {
    return fail(
      'profile-name-invalid',
      `profile 名只认 Default / Profile N / active，收到 ${JSON.stringify(requestedRaw)}`,
    )
  }

  const dirs = (opts.userDataDir ? [opts.userDataDir] : candidateUserDataDirs(env)).filter((d) =>
    fs.existsSync(d),
  )
  if (dirs.length === 0) {
    return fail(
      'no-user-data',
      '本机找不到豆包数据目录(%LOCALAPPDATA%\\Doubao\\User Data 及各用户等价目录均无)⇒ 未装/未登录/路径变了',
    )
  }

  const candidates = []
  let firstUsable = null
  for (const userDataDir of dirs) {
    const profiles = listDoubaoProfiles(userDataDir)
    const state = readDoubaoProfileState(userDataDir)
    candidates.push({
      userDataDir,
      profiles,
      lastUsed: state.lastUsed,
      localState: state.ok ? 'ok' : state.code,
    })
    if (profiles.length > 0 && !firstUsable) firstUsable = { userDataDir, profiles, state }
  }
  if (!firstUsable) {
    return fail(
      'no-profile',
      `找到豆包数据目录但没有任何带 Cookies 库的 Default/Profile N:${dirs.join(' | ')}`,
      { candidates },
    )
  }

  const { userDataDir, profiles, state } = firstUsable
  const notes = []
  let profile
  let source

  if (explicitName) {
    if (!profiles.includes(explicitName)) {
      return fail(
        'profile-missing',
        `${userDataDir} 下没有可用 profile ${explicitName}(可选:${profiles.join(' / ')})`,
        { candidates },
      )
    }
    profile = explicitName
    source = 'explicit'
  } else if (wantActive) {
    const lastUsed = state.lastUsed
    if (lastUsed && profiles.includes(lastUsed)) {
      profile = lastUsed
      source = 'active'
    } else {
      profile = profiles.includes('Default') ? 'Default' : profiles[0]
      source = profiles.includes('Default') ? 'default' : 'default-first'
      notes.push(
        `Local State.last_used=${lastUsed || '(空)'} 不在可用 profile 内 ⇒ 回落 ${profile}(不静默冒充 active)`,
      )
    }
  } else if (profiles.includes('Default')) {
    profile = 'Default'
    source = 'default'
  } else {
    profile = profiles[0]
    source = 'default-first'
    notes.push(`没有 Default,按首个可用 profile ${profile} 解析(要别的号请显式 --profile)`)
  }

  return {
    ok: true,
    userDataDir,
    profile,
    profileDir: path.join(userDataDir, profile),
    source,
    lastUsed: state.lastUsed,
    profiles,
    label: profileLabel(profile, source),
    notes,
    candidates,
  }
}

/** 解析失败抛错版(给必须拿到目录的老调用方;错误码保留在 message 里) */
export function requireDoubaoProfile(opts = {}) {
  const r = resolveDoubaoProfile(opts)
  if (r.ok) return r
  throw Object.assign(new Error(r.message), { code: r.code })
}

/** 给定 `...\Profile N` 目录时反推 userDataDir/profile(只认目录名合法且有 Cookies) */
export function describeDoubaoProfileDir(profileDir) {
  const dir = path.resolve(String(profileDir ?? ''))
  const name = path.basename(dir)
  if (!isDoubaoProfileName(name)) {
    return { ok: false, code: 'profile-dir-shape', message: `不是合法豆包 profile 目录:${dir}`, profileDir: dir }
  }
  if (!fs.existsSync(path.join(dir, 'Network', 'Cookies'))) {
    return { ok: false, code: 'cookie-missing', message: `profile 目录里没有 Cookies 库:${dir}`, profileDir: dir }
  }
  return {
    ok: true,
    code: 'ok',
    userDataDir: path.dirname(dir),
    profile: name,
    profileDir: dir,
    source: 'explicit-dir',
    label: name,
    lastUsed: '',
    profiles: [],
    notes: [],
    candidates: [],
  }
}

export const __test__ = {
  isDoubaoProfileName,
  readDoubaoProfileState,
  resolveDoubaoProfile,
  requireDoubaoProfile,
  describeDoubaoProfileDir,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
