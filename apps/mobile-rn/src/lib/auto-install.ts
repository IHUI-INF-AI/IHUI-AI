// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 免点击安装的 JS 侧编排(2026-11-05 立,机主:「都不行」但仍要「完全自动」)。
 *
 * 分工:
 *   · lib/apk-update.ts 仍是唯一下载/安装状态机,本文件不复制任何下载逻辑;
 *   · 本文件只回答两个问题:① 这一轮该不该"不等人点"就自动开始;② 怎么把用户送到
 *     无障碍服务的启用页(那是整条链唯一需要人做一次的动作)。
 *
 * 为什么默认自动而不是让用户选:机主要的就是"代码更新后什么都不点"。但整包 ~80MB,
 * 所以加了 12 小时节流 —— 同一份更新反复自动拉起安装器只会让人以为 App 在抽风
 * (装完后版本号已变,正常情况下不会再命中;节流防的是"用户取消安装后每次进前台都再来一遍")。
 *
 * 与 OTA 的关系:OTA 就绪(ready)时跳过 APK 自动安装 —— 那一轮 JS 已经在下次冷启动生效,
 * 再去下 80MB 属于白耗流量(见 UpdatePrompt 的调用点)。
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as IntentLauncher from 'expo-intent-launcher'
import { Platform } from 'react-native'
import { applyApkUpdate, apkSnapshot } from './apk-update'
import { otaSnapshot } from './ota-update'

const LAST_AUTO_APPLY_KEY = 'ihui:apk:auto-apply-at'
/** 同一份更新 12 小时内只自动拉起一次安装器(用户取消后不反复打扰)。 */
const AUTO_APPLY_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000

/**
 * 若当前有可用更新且不在节流窗口内,直接开始"下载 → 拉起安装器"。
 *
 * 不抛异常:自动路径失败只落回状态机(卡片会显示 error),绝不因为自动化把更新检查本身搞崩。
 * @returns 是否真的发起了自动安装。
 */
export async function tryAutoApplyApk(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  const apk = apkSnapshot()
  if (apk.state !== 'available') return false
  // OTA 已就绪时不必再整包(那一份 JS 下次冷启动就生效)
  if (otaSnapshot().state === 'ready') return false

  try {
    const raw = await AsyncStorage.getItem(LAST_AUTO_APPLY_KEY)
    const last = raw ? Number(raw) : 0
    if (Number.isFinite(last) && Date.now() - last < AUTO_APPLY_MIN_INTERVAL_MS) return false
    await AsyncStorage.setItem(LAST_AUTO_APPLY_KEY, String(Date.now()))
  } catch {
    // 存储不可用时不阻塞更新(宁可多试一次,也不要让自动安装永远不触发)
  }

  await applyApkUpdate()
  return true
}

/** 打开系统的无障碍服务列表,让用户为本应用一次性启用「IHUI 自动安装」。 */
export async function openAutoInstallSettings(): Promise<void> {
  if (Platform.OS !== 'android') return
  try {
    await IntentLauncher.startActivityAsync('android.settings.ACCESSIBILITY_SETTINGS')
  } catch {
    /* 个别 ROM 没有该入口时静默失败,由设置页文案兜底(手动到「设置 → 无障碍」) */
  }
}
