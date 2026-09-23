// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 助手消息权限档盖章(G-165)断言。
//
// 这里守的是两条"静默错"的入口:
// ① 把"不知道档位"伪装成 'default'(用户以为当时是默认档,实际是没绑定工作区);
// ② 采信客户端自报的档位(等于允许调用方给审计记录贴金)。
import { describe, expect, it } from 'vitest'

import {
  CONVERSATION_WORKSPACE_META_KEY,
  MESSAGE_PERMISSION_META_KEY,
  permissionStamp,
  workspacePathOfConversationMeta,
} from '../src/services/message-permission-stamp.js'

describe('permissionStamp', () => {
  it('wire 与 camel 与历史别名都盖章,且盖章值统一为 wire', () => {
    expect(permissionStamp('accept-edits')).toEqual({
      [MESSAGE_PERMISSION_META_KEY]: 'accept-edits',
    })
    expect(permissionStamp('acceptEdits')).toEqual({
      [MESSAGE_PERMISSION_META_KEY]: 'accept-edits',
    })
    expect(permissionStamp('auto')).toEqual({ [MESSAGE_PERMISSION_META_KEY]: 'accept-edits' })
    expect(permissionStamp('bypass-permissions')).toEqual({
      [MESSAGE_PERMISSION_META_KEY]: 'bypass-permissions',
    })
    expect(permissionStamp('plan')).toEqual({ [MESSAGE_PERMISSION_META_KEY]: 'plan' })
  })

  it('无记录 / 不可识别 → 不写 key(绝不伪造 default)', () => {
    expect(permissionStamp(undefined)).toEqual({})
    expect(permissionStamp(null)).toEqual({})
    expect(permissionStamp('')).toEqual({})
    expect(permissionStamp('   ')).toEqual({})
    expect(permissionStamp('yolo-mode')).toEqual({})
    // manual 无落库语义:盖上去会让前端显示一个 DB 里不可能存在的档
    expect(permissionStamp('manual')).toEqual({})
  })

  it('非字符串输入不抛异常(权限行来自 DB jsonb/varchar,类型不可信)', () => {
    expect(permissionStamp(42)).toEqual({})
    expect(permissionStamp({ mode: 'plan' })).toEqual({})
  })
})

describe('G-165③ 回退定论:不回退到用户全局默认档(结构性防回潮)', () => {
  it('函数只接受一个参数(工作区权限行)—— 给"用户全局默认档"留兜底参数前必须先推翻定论', () => {
    // 定论见 message-permission-stamp.ts 头部:用户全局默认档是"偏好"不是"历史事实",
    // 拿它兜底盖章 = 伪造"这条回答当时生效的档"。此断言钉死函数形状:
    // 有人加第二个 userDefault 参数 → arity 变 2 → 这里红,逼其先读定论再显式翻案。
    expect(permissionStamp.length).toBe(1)
  })

  it('无工作区行时输出为空对象——调用方拿不到任何可盖章的键,即"结构上无法回退"', () => {
    // 结构性证明:输出只有 workspace 行一个输入决定,不存在第二条取值路径。
    expect(permissionStamp(undefined)).toEqual({})
    expect(permissionStamp(null)).toEqual({})
  })
})

describe('workspacePathOfConversationMeta', () => {
  it('取到非空字符串才算绑定', () => {
    expect(
      workspacePathOfConversationMeta({ [CONVERSATION_WORKSPACE_META_KEY]: 'D:/proj/a' }),
    ).toBe('D:/proj/a')
    expect(
      workspacePathOfConversationMeta({ [CONVERSATION_WORKSPACE_META_KEY]: '  /srv/x  ' }),
    ).toBe('/srv/x')
  })

  it('缺失 / 空串 / 非字符串 / null metadata 一律视为未绑定', () => {
    expect(workspacePathOfConversationMeta(null)).toBeNull()
    expect(workspacePathOfConversationMeta(undefined)).toBeNull()
    expect(workspacePathOfConversationMeta({})).toBeNull()
    expect(workspacePathOfConversationMeta({ workspacePath: '' })).toBeNull()
    expect(workspacePathOfConversationMeta({ workspacePath: '   ' })).toBeNull()
    expect(workspacePathOfConversationMeta({ workspacePath: 7 })).toBeNull()
    expect(workspacePathOfConversationMeta('D:/x')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
