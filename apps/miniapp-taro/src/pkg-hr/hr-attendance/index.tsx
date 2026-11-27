// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 镜像 packages/app/src/features/hr-attendance/HrAttendanceScreen.tsx
//
// 2026-11-26 跨端页面对齐:原页走 edu-child 的 ChildRecordsView,只渲染「考勤记录」只读表,
// 没有签到表单;RN 端同一屏(HrAttendanceScreen)是「签到表单(工号/部门 + 提交)+ 记录列表」。
// 同一条路由、同一个业务对象,一端能签到、一端只能看 ⇒ 页面级不一致。
// 改由 @rn-shells/HrAttendanceScreen 承载后,取数端点(GET /hr-attendance/attendance/records、
// POST /hr-attendance/attendance/check-in)、上海业务日口径、状态词条与空态全部与 RN 同源。
// 鉴权就绪由 AuthReadyGate 承接(壳挂载即取数,等冷启动鉴权落定再放行)。
import AuthReadyGate from '@/components/AuthReadyGate'
import RnShellPage from '@/components/RnShellPage'
import HrAttendanceScreenShell from '@rn-shells/HrAttendanceScreen'

// RN 壳自带页内 header(BackChevron + 标题)⇒ 页面必须 custom nav,否则原生导航栏 +
// 页内 header 会出双头;RnShellPage 只补状态栏顶距,不替代 RN 的安全区。
export default function Page() {
  return (
    <RnShellPage>
      <AuthReadyGate>
        <HrAttendanceScreenShell />
      </AuthReadyGate>
    </RnShellPage>
  )
}
