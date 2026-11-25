// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 结构锁:RN 抽屉的批量动作面与文件夹归属面(与 web 同一份分组 store)。
//
// 读源码文本的理由同小程序侧:要钉的是"动作集合存在与否",类型层看不出来——
// i18n key 是可选字符串,少一枚钮不会报错,只会静默少一个能力。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const DRAWER = resolve(__dirname, '../src/components/Drawer.tsx')
const source = readFileSync(DRAWER, 'utf8')

describe('RN 抽屉 · 批量动作面(与 web ConversationBatchBar 对齐)', () => {
  it('包含全选 / 已选 N / 反选 / 移动到文件夹 / 归档 / 删除 / 取消选择', () => {
    // 2026-11-24 抽屉重构把动作文案收进 `drawerActionKey('<id>')` 单源(键名不再逐字写死);
    // 锁仍按"动作存在"判:静态键或单源键调用任一命中即算,不允许静默少一个能力。
    for (const [key, viaSingleSource] of [
      ['drawer.selectAll', "drawerActionKey('selectAll')"],
      ['drawer.selectedCount', 'drawer.selectedCount'],
      ['drawer.invertSelection', "drawerActionKey('invertSelection')"],
      ['drawer.moveToFolder', "drawerActionKey('moveToFolder')"],
      ['drawer.batchArchive', "drawerActionKey('archive')"],
      ['drawer.batchDelete', "drawerActionKey('delete')"],
      ['drawer.cancelSelection', "drawerActionKey('cancelSelection')"],
    ] as const) {
      expect(source.includes(key) || source.includes(viaSingleSource), `缺动作:${key}`).toBe(true)
    }
  })

  it('批量删除先二次确认(appAlert + destructive)', () => {
    expect(source).toContain('drawer.confirmBatchDelete')
    expect(source).toContain("style: 'destructive'")
  })

  it('长按动作表首项是「重命名」,且走 api-client 的 updateConversation(与 web 同端点)', () => {
    expect(source).toContain('drawer.rename')
    expect(source).toContain('updateConversation(id, { title: next })')
  })
})

describe('RN 抽屉 · 文件夹(服务端分组表同一真相源)', () => {
  it('读的是 shared 的 useOrgServerStore,而不是端内本地元数据', () => {
    expect(source).toContain('useOrgServerStore')
    expect(source).toContain('@ihui/shared/chat/conversation-org-server')
  })

  it('行内文件夹徽章存在(FolderOpen,web 同款)', () => {
    expect(source).toContain('FolderOpen')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
