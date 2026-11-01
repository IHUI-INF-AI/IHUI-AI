// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 消息中心「数据钩子补齐」接线锁(2026-11-01,静态读取证型 —— 端内 vitest 无 jsdom,
// 渲染级测不到 @tarojs/components;同型先例 t64-message-flags-miniapp.test.ts:归一文本断言)。
//
// 钉死的事:
//  A 假成功不回潮:页面里不得再出现"onMarkRead/onPin/onDelete → 只弹 toast"的三枚别名键
//    (message.markedRead/pinned/deleted)作为反馈出口;
//  A2 弹窗不冒充删除:确认层未给 content 兜占位关键(端无现成共享键,新键须与词包批同票,
//    §19+scope 门 R2)⇒ content 必须是行名回落,绝不引用不存在的键;
//  B 真出口在位且分轨:公告/系统走 PUT /messages/:id/read 与 DELETE /messages/:id,
//    私信走 /messages/private/:pid[/read](api/index.ts 的薄封装为证);
//  C spec 键消费在位:searchPh / markRead / deleteConv / loadMore 全部由页面或子模块取词,
//    并且删除/已读通过 aria-label 传给操作区(还原度门 17→0 的凭据不得靠回落措辞冒充);
//  D 操作位门控:MessageActions 按钮只在给了 handler 时渲染(不给"点了没反应"的假按钮);
//  E 分页防重入与不假全:loadMore 期间不并触、按 id 去重、hasMore 只在 total 已知且未满时成立;
//  F 词包五语言同批(§19):本票消费的既有键在端包/共享包齐。
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// ROOT = __dirname(src/pkg-user/message/__tests__)上跳 6 段到仓库根
// (message→pkg-user→src→apps/miniapp-taro→apps→ROOT;本行以 node path.resolve 实测校准,
//  2026-11-01 连错两段就是没跑实测把层级当心算 —— 留此注防再被"顺手少跳一段")
const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', '..')
const norm = (s: string) => s.replace(/\s+/g, '')
// __dirname = .../pkg-user/message/__tests__ ⇒ 页面在上一级(路径逐段现推,不硬编码绝对路径)
const pageSrc = norm(readFileSync(path.resolve(__dirname, '..', 'index.tsx'), 'utf8'))
const paneSrc = norm(readFileSync(path.resolve(__dirname, '..', 'in-site-messages.tsx'), 'utf8'))
const actionsSrc = norm(
  readFileSync(path.resolve(ROOT, 'apps/miniapp-taro/src/components/MessageActions.tsx'), 'utf8'),
)
const apiSrc = readFileSync(path.resolve(ROOT, 'apps/miniapp-taro/src/api/index.ts'), 'utf8')

describe('消息中心数据钩子接线锁', () => {
  it('A 假成功出口已摘净:页面不再用 message.markedRead/pinned/deleted 冒充操作结果', () => {
    for (const key of ["'message.markedRead'", "'message.pinned'", "'message.deleted'"]) {
      expect(pageSrc).not.toContain(norm(key))
    }
  })
  it('A2 删除确认层不引用不存在键:content=行名回落,deleteConfirm 不得被消费', () => {
    expect(pageSrc).toContain(norm("content: room.name || t('messageCenter.conversations')"))
    expect(pageSrc).not.toContain(norm('messageCenter.deleteConfirm'))
    // 端包此刻必须仍无 deleteConfirm(键与词包批解耦,由 batch-two 决定何时加)
    const zh = JSON.parse(
      readFileSync(path.resolve(ROOT, 'packages/i18n/messages/miniapp-taro/zh-CN.json'), 'utf8'),
    )
    expect(zh.messageCenter?.deleteConfirm).toBeUndefined()
  })
  it('B 真端点在 api 薄封装上齐(与 apps/api message.ts 现读路由逐条对应)', () => {
    expect(apiSrc).toMatch(/markMessageRead[\s\S]*`\/messages\/\$\{id\}\/read`/)
    expect(apiSrc).toMatch(/deleteMessage[\s\S]*`\/messages\/\$\{id\}`/)
    expect(apiSrc).toMatch(/markPrivateRead[\s\S]*`\/messages\/private\/\$\{pid\}\/read`/)
    expect(apiSrc).toMatch(/deletePrivateMessage[\s\S]*`\/messages\/private\/\$\{pid\}`/)
    expect(apiSrc).toMatch(/getMessages[\s\S]*'\/messages'/)
  })
  it('B2 页面按行来源分轨调用(公告/系统 vs 私信不混出口)', () => {
    expect(pageSrc).toContain(norm('room.kind ==='))
    expect(pageSrc).toContain('markPrivateRead(room.id)')
    expect(pageSrc).toContain('markMessageRead(room.id)')
    expect(pageSrc).toContain('deletePrivateMessage(room.id)')
    expect(pageSrc).toContain('deleteMessage(room.id)')
  })
  it('C spec 四键由端内消费并带无障碍标签', () => {
    expect(pageSrc).toContain(norm("t('messageCenter.searchPh')"))
    expect(pageSrc).toContain(norm("markReadLabel={t('messageCenter.markRead')}"))
    expect(pageSrc).toContain(norm("deleteLabel={t('messageCenter.deleteConv')}"))
    expect(paneSrc).toContain(norm("t('messageCenter.loadMore')"))
    expect(actionsSrc).toContain(norm('aria-label={markReadLabel'))
    expect(actionsSrc).toContain(norm('aria-label={deleteLabel'))
  })
  it('D 操作位门控:未给 handler 的按钮整块不渲染', () => {
    expect(actionsSrc).toContain(norm('{onMarkRead?('))
    expect(actionsSrc).toContain(norm('{onPin?('))
    expect(actionsSrc).toContain(norm('{onDelete?('))
  })
  it('E 分页:重入闸 ∧ id 去重 ∧ hasMore 只在 total 已知时成立', () => {
    expect(paneSrc).toContain(norm('if(loadingMore)return'))
    expect(paneSrc).toMatch(/constseen=newSet\(prev\.map\(\(r\)=>r\.id\)\)/)
    expect(paneSrc).toContain(norm('consthasMore=total>0&&rows.length<total'))
  })
  it('F 本票消费的既有键在五语言运行时面齐(shared 并入端包后 t() 可解析,悬空引用防线)', () => {
    for (const lang of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']) {
      const shared = JSON.parse(
        readFileSync(path.resolve(ROOT, `packages/i18n/messages/shared/${lang}.json`), 'utf8'),
      )
      const app = JSON.parse(
        readFileSync(
          path.resolve(ROOT, `packages/i18n/messages/miniapp-taro/${lang}.json`),
          'utf8',
        ),
      )
      const mergedMc = { ...(shared.messageCenter || {}), ...(app.messageCenter || {}) }
      for (const k of ['searchPh', 'deleteConv', 'markRead', 'loadMore']) {
        expect(typeof mergedMc[k], `${lang}.messageCenter.${k}`).toBe('string')
        expect(mergedMc[k].length).toBeGreaterThan(1)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
