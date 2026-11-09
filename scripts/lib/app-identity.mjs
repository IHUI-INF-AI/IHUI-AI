// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Android 对外身份的唯一真源读取层(2026-11-08 立)。
 *
 * 为什么单独成层:`app.json#expo.name`、`res/values/strings.xml#app_name`、商店表单、
 * APKPure 提交函都只是**派生面**;四处各写一个字面量,改名时就必然漂移(上一轮已经发生过
 * app.json 0.0.12 / 产物 0.0.19 的同类事故)。这里只放"读 + 对账",不再抄第二份名称。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const IDENTITY_REL = 'scripts/data/app-identity.json'

export function parseIdentity(text) {
  const j = JSON.parse(text)
  const displayName = String(j?.displayName ?? '').trim()
  const applicationId = String(j?.applicationId ?? '').trim()
  if (!displayName) throw new Error(`${IDENTITY_REL} 缺 displayName`)
  if (!applicationId) throw new Error(`${IDENTITY_REL} 缺 applicationId`)
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(applicationId)) {
    throw new Error(`${IDENTITY_REL} 的 applicationId 不是合法包名: ${applicationId}`)
  }
  return {
    displayName,
    applicationId,
    nameSource: j.nameSource ? String(j.nameSource) : '未在册',
    copyrightName: j.copyrightName ? String(j.copyrightName).trim() : displayName,
    forbiddenLegacyNames: Array.isArray(j.forbiddenLegacyNames) ? j.forbiddenLegacyNames.map(String) : [],
  }
}

export function loadIdentity({ root = REPO_ROOT, readFile = (p) => readFileSync(p, 'utf8') } = {}) {
  const p = join(root, IDENTITY_REL)
  if (!existsSync(p)) throw new Error(`身份真源不存在: ${IDENTITY_REL}`)
  return parseIdentity(readFile(p))
}

/** 派生面与真源逐字对账;任何一处不一致即拒绝继续(改名不许靠"记得同步")。 */
export function checkIdentityConsistency({ identity, appJson, androidLabel, ledger }) {
  const gaps = []
  if (String(appJson?.name ?? '') !== identity.displayName) {
    gaps.push(`app.json#expo.name=${JSON.stringify(appJson?.name ?? null)} ≠ 真源 ${JSON.stringify(identity.displayName)}`)
  }
  if (String(appJson?.android?.package ?? '') !== identity.applicationId) {
    gaps.push(`app.json#android.package=${JSON.stringify(appJson?.android?.package ?? null)} ≠ 真源 ${identity.applicationId}`)
  }
  if (androidLabel !== null && androidLabel !== undefined && String(androidLabel) !== identity.displayName) {
    gaps.push(`strings.xml#app_name=${JSON.stringify(androidLabel)} ≠ 真源 ${JSON.stringify(identity.displayName)}`)
  }
  if (ledger?.appName && String(ledger.appName) !== identity.displayName) {
    gaps.push(`备案台账 appName=${JSON.stringify(ledger.appName)} ≠ 真源 ${JSON.stringify(identity.displayName)}`)
  }
  if (ledger?.packageName && String(ledger.packageName) !== identity.applicationId) {
    gaps.push(`备案台账 packageName=${JSON.stringify(ledger.packageName)} ≠ 真源 ${identity.applicationId}`)
  }
  // 旧名只许出现在版权头注释;作为产品名再出现即判红
  for (const legacy of identity.forbiddenLegacyNames) {
    if (identity.displayName.includes(legacy)) {
      gaps.push(`真源 displayName 仍包含旧名 ${JSON.stringify(legacy)}`)
    }
  }
  return gaps
}

/** 从 Android 资源里读回启动器标签的现读值(读不到返回 null,由调用方决定是"未判定"还是跳过)。 */
export function readAndroidAppLabel({ root = REPO_ROOT, readFile = (p) => readFileSync(p, 'utf8') } = {}) {
  const p = join(root, 'apps/mobile-rn/android/app/src/main/res/values/strings.xml')
  if (!existsSync(p)) return null
  const text = readFile(p)
  const m = text.match(/<string\s+name="app_name">([^<]*)<\/string>/)
  return m ? m[1] : null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
