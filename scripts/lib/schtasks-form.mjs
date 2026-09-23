// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 计划任务 XML → 形态判定(纯函数,便于脱机测试)
 *
 * 存在理由(2026-09-23 实测的两起事故都在这条判据上):
 *  1) git-guardian 的"活任务是否漂移"自检原先用 pwsh 的 Get-ScheduledTask 读 LogonType,
 *     而本机 pwsh **没有 ScheduledTasks cmdlet** ⇒ 拿不到值却被当成"漂移",于是每 2 分钟
 *     重注册一次自己的守护任务(而它要求的 S4U 形态在本机永远注册不成功)。反复删除重建
 *     最关键的那层 `.git` 存续守护,就是这种"自检把自己打坏"的形态。
 *  2) 只认 S4U 会把**合法的回退形态**判成漂移:InteractiveToken + `wscript.exe` + ASCII `.vbs`
 *     包装同样不会弹控制台窗(§5b 的隐藏启动约定),必须承认它。
 * 真正该报警的只有:InteractiveToken 且**直跑 node.exe**(必闪黑窗),或任务不见了我自己判
 * (missing 由调用方用任务列表判,不在本函数职责内)。
 *
 * 一律接受带 NUL 的 UTF-16(schtasks /XML 的输出形态),调用方负责先去 NUL。
 */
export const TASK_XML_MARK = '<Task'

/**
 * @param {string} xml schtasks /Query /TN <name> /XML 的文本(已去 NUL)
 * @param {object} [opt]
 * @param {string} [opt.wrapperFile] 隐藏启动包装的文件名(默认 git-guardian-hidden.vbs)
 * @returns {'ok'|'ok-vbs'|'drift'|'unknown'}
 */
export function judgeTaskForm(xml, { wrapperFile = 'git-guardian-hidden.vbs' } = {}) {
  const t = String(xml || '')
  if (!t.includes(TASK_XML_MARK)) return 'unknown' // 拿不到 XML ⇒ 信息不足,绝不误改任务
  if (t.includes('S4U')) return 'ok' // session 0,结构上开不出窗口
  if (t.includes('InteractiveToken')) {
    const hidden = /wscript/i.test(t) && t.includes(wrapperFile)
    return hidden ? 'ok-vbs' : 'drift'
  }
  return 'unknown'
}

/** 形态可接受吗?`unknown` 按可接受处理:信息不足时不动任务(§5b 宁可不动也不误动)。 */
export function taskFormAcceptable(form) {
  return form === 'ok' || form === 'ok-vbs' || form === 'unknown'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
