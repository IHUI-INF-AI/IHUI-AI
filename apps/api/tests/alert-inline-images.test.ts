// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回归测试:告警邮件(alert-notification-service.pushEmail / notify-deploy-failure)用的
 * 是 renderSystemAlertEmail 模板,该模板以 `src="cid:..."` 引用品牌图。
 *
 * 2026-10-15 踩过的坑:模板层改成了 cid 引用,但 alert-notification-service 自建 nodemailer
 * transport 那一支出路**漏挂附件** ⇒ 告警邮件里出现"引用了 cid 却没有附件"的死图。
 * 同时 ops-watch-reader 的「图片 CDN 无应答」告警正是走这条出路(来源 ops-watch-reader)。
 *
 * 本测试在「模板契约」层钉死这一缺口:凡是模板渲染出来的 html 里引用的 cid,都必须能被
 * finalizeEmailHtml 解析到对应内嵌附件(资产存在 ⇒ 不降级)。这样无论哪个发送出口忘了挂附件,
 * 都会在契约层先红,而不是等收件端出现死图才发现。
 */
import { describe, it, expect } from 'vitest'
import {
  renderSystemAlertEmail,
  EMAIL_LOGO_CID,
  EMAIL_QR_CID,
} from '../src/services/email-templates.js'
import { finalizeEmailHtml } from '../src/services/email-assets.js'

describe('告警邮件内嵌图(根因修复:模板 cid 必须能挂上附件)', () => {
  it('renderSystemAlertEmail 的 html 同时引用 logo 与 qr 两个 cid', () => {
    const r = renderSystemAlertEmail({
      severity: 'critical',
      source: 'ops-watch-reader',
      time: '2026-10-15 00:00:00',
      title: '图片 CDN 无应答',
      message: '探针连续失败',
    })
    expect(r.html).toContain(`cid:${EMAIL_LOGO_CID}`)
    expect(r.html).toContain(`cid:${EMAIL_QR_CID}`)
  })

  it('finalizeEmailHtml 把两个 cid 解析成对应附件(资产存在 ⇒ 不降级)', () => {
    const r = renderSystemAlertEmail({
      severity: 'warning',
      source: 'x',
      time: 't',
      title: 't',
      message: 'm',
    })
    const { html, attachments, downgraded } = finalizeEmailHtml(r.html)
    expect(downgraded).toEqual([])
    const cids = attachments.map((a) => a.cid)
    expect(cids).toContain(EMAIL_LOGO_CID)
    expect(cids).toContain(EMAIL_QR_CID)
    // 引用仍在 html 中(只是从"裸 cid 引用"变成"随信附件附着的 cid")
    expect(html).toContain(`cid:${EMAIL_LOGO_CID}`)
    expect(html).toContain(`cid:${EMAIL_QR_CID}`)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
