// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 考勤「状态档」的唯一实现(RN 端):徽章档位 + 取词 + 上海业务日。
//
// 立因(2026-11 契约收口):写接口已删 status,出勤状态一律由服务端按该班 `edu_attendance_rule`
// + judgeStatus 现算 ⇒ 端上只做**展示档**,绝不复算阈值、绝不自报状态。
// 此前这三枚出口长在教师屏里,三屏(教师/本人/孩子)从那里 import;补统计区后趋势面板也要用同一把尺,
// 而屏与组件互相 import 会成环 ⇒ 提到本文件,教师屏原样 re-export(实现仍只有一份,AGENTS §0.6)。
//
// 与小程序侧同族:apps/miniapp-taro/src/pkg-user/edu-mgmt-attendance/contract.ts 的 STATUS_TONES
// 与本表逐档同指(present→ok / late→warn / early→warn / absent→danger / leave→muted,
// 词表外→muted),文案同走 `eduAttendance.status.<码>` —— 两端各自持有"平台 adapter"形态的
// 一份表(Taro className ↔ RN tone 枚举),不是第二份取词源。
import type { ConsoleBadgeTone } from '@ihui/rn-app'

/** 本端徽章档位(唯一出口在 packages/app 的 ConsoleBadgeTone,端内不可扩档)。 */
export type AttendanceBadgeTone = ConsoleBadgeTone

/** 状态 → 徽章档位(三屏 + 统计/趋势面板唯一实现)。 */
export const attendanceStatusTone = (s: string): AttendanceBadgeTone =>
  s === 'present'
    ? 'ok'
    : s === 'late' || s === 'early'
      ? 'warn'
      : s === 'absent'
        ? 'danger'
        : 'muted'

/** 状态取词:词表未命中(后端新增协议码)原样回显,不吞数据。 */
export const attendanceStatusLabel = (
  t: (key: string, params?: Record<string, string | number>) => string,
  s: string,
): string => {
  const key = `eduAttendance.status.${s}`
  const v = t(key)
  return v === key ? s : v
}

/**
 * 上海业务日(考勤写接口与取数 query 共用的那一把尺)。
 * 原实现用 toISOString()(UTC)⇒ 北京时间 00:00–07:59 打开本页查到的是「昨天」那一天的考勤。
 * 后端库会话时区实测 Asia/Shanghai(now() 带 +08),各聚合 SQL 也按它截日 ⇒ 前端必须同口径
 * (与 server 侧 bizDayKey 同一形态;中国无夏令时,UTC+8 可直接加偏移后取 UTC 日)。
 */
export const attendanceBizDay = (): string =>
  new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)

// AGENTS §22c:镜像测试直接 import 本出口,不得复制判据。本文件是纯 lib(无 CLI 入口),按 §22d 免守卫。
export const __test__ = { attendanceStatusTone, attendanceStatusLabel, attendanceBizDay }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
