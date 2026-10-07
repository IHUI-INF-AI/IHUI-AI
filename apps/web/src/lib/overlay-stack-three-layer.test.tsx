// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// 真 Radix Dialog(happy-dom 下 Radix Content/Portal 可正常挂载),验证
// ui-react Dialog 家族内建注册与自绘层的互斥 —— 不 mock @ihui/ui-react。
import { Dialog, DialogContent, DialogTitle } from '@ihui/ui-react'

import { __resetOverlayStack, getOverlayStack } from './overlay-stack'
import { isTopOverlay, popOverlay, pushOverlay } from './overlay-stack'

/**
 * 三层集成用例:遮罩(自绘) + 弹层(ui-react Dialog / Radix) + pane(自绘)。
 *
 * 断言协议核心语义:三层叠开后按一次 Esc 只有最上层关闭,底层保持打开,
 * 逐层退出。自绘层走"push/pop + isTopOverlay 守卫"标准写法;Dialog 层由
 * ui-react 内建注册(Content 挂载 push / 卸载 pop / onEscapeKeyDown 守卫)。
 */

const MASK_ID = 'test-mask-layer'
const PANE_ID = 'test-pane-layer'

/** 自绘浮层通用写法(与 web 端接入规范一致的范式)。 */
function useSelfDrawnEscLayer(open: boolean, id: string, onEsc: () => void) {
  const onEscRef = React.useRef(onEsc)
  onEscRef.current = onEsc
  // push/pop 走 layout effect:与 commit 同步,与 Radix Content 的 ref 注册
  // (mergeEscStackRef)处于同一阶段 —— 栈序 = 开层顺序,确定性断言的前提。
  // (passive effect 注册在 fireEvent 连发窗口会晚于 ref 注册,真实用户操作
  // 间隔下两者等价,此处是为消除测试时序抖动。)
  React.useLayoutEffect(() => {
    if (!open) return
    pushOverlay(id)
    return () => popOverlay(id)
  }, [open, id])
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (!isTopOverlay(id)) return
      onEscRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, id])
}

interface LayerProps {
  open: boolean
  log: (layer: string) => void
  onClose: () => void
}

function MaskLayer({ open, log, onClose }: LayerProps) {
  const onEsc = React.useCallback(() => {
    log('mask')
    onClose()
  }, [log, onClose])
  useSelfDrawnEscLayer(open, MASK_ID, onEsc)
  return open ? <div data-testid="mask-layer" /> : null
}

function PaneLayer({ open, log, onClose }: LayerProps) {
  const onEsc = React.useCallback(() => {
    log('pane')
    onClose()
  }, [log, onClose])
  useSelfDrawnEscLayer(open, PANE_ID, onEsc)
  return open ? <div data-testid="pane-layer" /> : null
}

function DialogLayer({ open, log, onClose }: LayerProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          log('dialog')
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogTitle>esc-stack-dialog</DialogTitle>
        <div data-testid="dialog-layer" />
      </DialogContent>
    </Dialog>
  )
}

function ThreeLayerHost(props: { log: (layer: string) => void }) {
  const [maskOpen, setMaskOpen] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [paneOpen, setPaneOpen] = React.useState(false)
  return (
    <div>
      <button type="button" onClick={() => setMaskOpen(true)}>
        open-mask
      </button>
      <button type="button" onClick={() => setDialogOpen(true)}>
        open-dialog
      </button>
      <button type="button" onClick={() => setPaneOpen(true)}>
        open-pane
      </button>
      <MaskLayer open={maskOpen} log={props.log} onClose={() => setMaskOpen(false)} />
      <DialogLayer open={dialogOpen} log={props.log} onClose={() => setDialogOpen(false)} />
      <PaneLayer open={paneOpen} log={props.log} onClose={() => setPaneOpen(false)} />
    </div>
  )
}

describe('Esc 无层栈协议:三层叠开集成', () => {
  // vitest 未开 globals 时 RTL 不自动 cleanup,残留 DOM 会让下个用例 getByText 撞重
  afterEach(cleanup)
  beforeEach(() => {
    __resetOverlayStack()
  })

  it('遮罩 + 弹层 + pane 三层叠开,按一次 Esc 只有最上层关闭,逐层退出', async () => {
    const events: string[] = []
    const logFn = (layer: string) => {
      events.push(layer)
    }
    const { getByText, queryByTestId } = render(<ThreeLayerHost log={logFn} />)

    // 1. 依次打开三层
    fireEvent.click(getByText('open-mask'))
    fireEvent.click(getByText('open-dialog'))
    fireEvent.click(getByText('open-pane'))
    await waitFor(() => {
      expect(queryByTestId('mask-layer')).not.toBeNull()
      expect(queryByTestId('dialog-layer')).not.toBeNull()
      expect(queryByTestId('pane-layer')).not.toBeNull()
    })
    // Dialog Content 挂载后完成栈注册:栈序 = [mask, dialog-id, pane]
    await waitFor(() => {
      expect(getOverlayStack()).toHaveLength(3)
    })
    expect(isTopOverlay(PANE_ID)).toBe(true)
    expect(isTopOverlay(MASK_ID)).toBe(false)

    // 2. 第一次 Esc:只有最上层 pane 关闭,遮罩与 Dialog 保持
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(queryByTestId('pane-layer')).toBeNull()
    })
    expect(events).toEqual(['pane'])
    expect(queryByTestId('mask-layer')).not.toBeNull()
    expect(queryByTestId('dialog-layer')).not.toBeNull()
    await waitFor(() => {
      expect(getOverlayStack()).toHaveLength(2)
    })

    // 3. 第二次 Esc:Dialog 关闭(ui-react 内建注册放行 Radix dismiss),遮罩保持
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(queryByTestId('dialog-layer')).toBeNull()
    })
    expect(events).toEqual(['pane', 'dialog'])
    expect(queryByTestId('mask-layer')).not.toBeNull()
    // Dialog 卸载后栈只剩遮罩
    expect(getOverlayStack()).toEqual([MASK_ID])

    // 4. 第三次 Esc:最底层遮罩关闭,栈清空
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(queryByTestId('mask-layer')).toBeNull()
    })
    expect(events).toEqual(['pane', 'dialog', 'mask'])
    expect(getOverlayStack()).toEqual([])
  })

  it('pane 先开、Dialog 后叠:自绘层与 Radix 层互斥方向可逆', async () => {
    const events: string[] = []
    const logFn = (layer: string) => {
      events.push(layer)
    }
    const { getByText, queryByTestId } = render(<ThreeLayerHost log={logFn} />)

    // pane 先开,Dialog 后叠(与上一用例相反的注册顺序)
    fireEvent.click(getByText('open-pane'))
    fireEvent.click(getByText('open-mask'))
    fireEvent.click(getByText('open-dialog'))
    await waitFor(() => {
      expect(getOverlayStack()).toHaveLength(3)
    })
    // 最后挂载的 Dialog 是栈顶;两个自绘层都被挡住
    expect(isTopOverlay(MASK_ID)).toBe(false)
    expect(isTopOverlay(PANE_ID)).toBe(false)

    // 一次 Esc 只让 Dialog 关闭(内建守卫放行 Radix dismiss)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(queryByTestId('dialog-layer')).toBeNull()
    })
    expect(events).toEqual(['dialog'])
    // 两个自绘层都还开着
    expect(queryByTestId('mask-layer')).not.toBeNull()
    expect(queryByTestId('pane-layer')).not.toBeNull()
    await waitFor(() => {
      expect(getOverlayStack()).toEqual([PANE_ID, MASK_ID])
    })
    // 栈顶回到 mask:再 Esc 关 mask,pane 保持
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(events).toEqual(['dialog', 'mask'])
    })
    expect(queryByTestId('pane-layer')).not.toBeNull()
  })
})

/** 双 Dialog 宿主:两个独立 Root 的受控 Dialog,后开者后挂载 → 后注册 → 栈顶。 */
function TwoDialogHost(props: { log: (layer: string) => void }) {
  const [outerOpen, setOuterOpen] = React.useState(false)
  const [innerOpen, setInnerOpen] = React.useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOuterOpen(true)}>
        open-outer
      </button>
      <button type="button" onClick={() => setInnerOpen(true)}>
        open-inner
      </button>
      <Dialog
        open={outerOpen}
        onOpenChange={(o) => {
          if (!o) {
            props.log('outer')
            setOuterOpen(false)
          }
        }}
      >
        <DialogContent>
          <DialogTitle>outer-dialog-title</DialogTitle>
          <div data-testid="outer-dialog" />
        </DialogContent>
      </Dialog>
      <Dialog
        open={innerOpen}
        onOpenChange={(o) => {
          if (!o) {
            props.log('inner')
            setInnerOpen(false)
          }
        }}
      >
        <DialogContent>
          <DialogTitle>inner-dialog-title</DialogTitle>
          <div data-testid="inner-dialog" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 卸载清理探针宿主:底层自绘遮罩 + 可经按钮(非 Esc 路径)开关的 Dialog。 */
function UnmountProbeHost(props: { log: (layer: string) => void }) {
  const [maskOpen, setMaskOpen] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  return (
    <div>
      <button type="button" onClick={() => setMaskOpen(true)}>
        open-mask
      </button>
      <button type="button" onClick={() => setDialogOpen(true)}>
        open-dialog
      </button>
      <button type="button" onClick={() => setDialogOpen(false)}>
        close-dialog
      </button>
      <MaskLayer open={maskOpen} log={props.log} onClose={() => setMaskOpen(false)} />
      <DialogLayer open={dialogOpen} log={props.log} onClose={() => setDialogOpen(false)} />
    </div>
  )
}

/** 幂等探针宿主:无关状态更新迫使 Dialog 重渲染;open/close 按钮驱动复开循环。 */
function RerenderProbeHost(props: { log: (layer: string) => void }) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [, setBump] = React.useState(0)
  return (
    <div>
      <button type="button" onClick={() => setDialogOpen(true)}>
        open-dialog
      </button>
      <button type="button" onClick={() => setDialogOpen(false)}>
        close-dialog
      </button>
      <button type="button" onClick={() => setBump((n) => n + 1)}>bump</button>
      <DialogLayer open={dialogOpen} log={props.log} onClose={() => setDialogOpen(false)} />
    </div>
  )
}

/**
 * Dialog 家族组件级判据(2026-10-07 立,Esc 无层栈协议 L12219 第一格)。
 *
 * 票面要求的"三层叠开真机 aria-expanded 断言"需要真机环境,留持有人;此处以
 * 组件级 jsdom 断言替代,对 ui-react Dialog 内建注册(mergeEscStackRef +
 * guardEscKeyDown)的语义逐条验收:双 Dialog 叠开互斥 / 单 Dialog Esc 关闭 /
 * 卸载 pop 清理 / 注册幂等。栈内 id 均为 useId 生成,断言只看条目数与自绘 id。
 */
describe('Esc 无层栈协议:Dialog 家族组件级判据(真机 aria 断言的 jsdom 替代)', () => {
  afterEach(cleanup)
  beforeEach(() => {
    __resetOverlayStack()
  })

  it('① 两个 Dialog 叠开:一次 Esc 只关最上层,下层仍 open', async () => {
    const events: string[] = []
    const { getByText, queryByTestId } = render(<TwoDialogHost log={(l) => events.push(l)} />)
    fireEvent.click(getByText('open-outer'))
    await waitFor(() => {
      expect(queryByTestId('outer-dialog')).not.toBeNull()
    })
    fireEvent.click(getByText('open-inner'))
    await waitFor(() => {
      expect(queryByTestId('inner-dialog')).not.toBeNull()
    })
    await waitFor(() => {
      expect(getOverlayStack()).toHaveLength(2)
    })

    // 第一次 Esc:内层(后挂载 = 栈顶)关闭;外层被 guardEscKeyDown preventDefault 拦下
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(queryByTestId('inner-dialog')).toBeNull()
    })
    expect(events).toEqual(['inner'])
    expect(queryByTestId('outer-dialog')).not.toBeNull()
    await waitFor(() => {
      expect(getOverlayStack()).toHaveLength(1)
    })

    // 第二次 Esc:外层成为栈顶,正常关闭
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(queryByTestId('outer-dialog')).toBeNull()
    })
    expect(events).toEqual(['inner', 'outer'])
    expect(getOverlayStack()).toEqual([])
  })

  it('② 单 Dialog:Esc 正常关闭,栈清空', async () => {
    const events: string[] = []
    const { getByText, queryByTestId } = render(<ThreeLayerHost log={(l) => events.push(l)} />)
    fireEvent.click(getByText('open-dialog'))
    await waitFor(() => {
      expect(queryByTestId('dialog-layer')).not.toBeNull()
    })
    await waitFor(() => {
      expect(getOverlayStack()).toHaveLength(1)
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(queryByTestId('dialog-layer')).toBeNull()
    })
    expect(events).toEqual(['dialog'])
    expect(getOverlayStack()).toEqual([])
  })

  it('③ Dialog 卸载即 pop:被压住的底层恢复消费 Esc', async () => {
    const events: string[] = []
    const { getByText, queryByTestId } = render(<UnmountProbeHost log={(l) => events.push(l)} />)
    fireEvent.click(getByText('open-mask'))
    await waitFor(() => {
      expect(getOverlayStack()).toEqual([MASK_ID])
    })
    fireEvent.click(getByText('open-dialog'))
    await waitFor(() => {
      expect(getOverlayStack()).toHaveLength(2)
    })
    expect(isTopOverlay(MASK_ID)).toBe(false)

    // 非 Esc 路径直接卸载 Dialog Content(程序化关闭)→ ref(null) → pop
    fireEvent.click(getByText('close-dialog'))
    await waitFor(() => {
      expect(getOverlayStack()).toEqual([MASK_ID])
    })
    expect(events).toEqual([])
    expect(isTopOverlay(MASK_ID)).toBe(true)

    // 底层恢复栈顶身份:Esc 能关它了
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(queryByTestId('mask-layer')).toBeNull()
    })
    expect(events).toEqual(['mask'])
    expect(getOverlayStack()).toEqual([])
  })

  it('④ 注册幂等:重渲染与复开均不产生重复栈条目', async () => {
    const events: string[] = []
    const { getByText } = render(<RerenderProbeHost log={(l) => events.push(l)} />)
    fireEvent.click(getByText('open-dialog'))
    await waitFor(() => {
      expect(getOverlayStack()).toHaveLength(1)
    })
    // 宿主无关状态更新迫使 Dialog 重渲染:ref callback 不重跑,栈条目不翻倍
    fireEvent.click(getByText('bump'))
    fireEvent.click(getByText('bump'))
    expect(getOverlayStack()).toHaveLength(1)
    // 关闭再复开:pop 后重新 push,仍是单条目(useId 稳定,不残留旧 id)
    fireEvent.click(getByText('close-dialog'))
    await waitFor(() => {
      expect(getOverlayStack()).toEqual([])
    })
    fireEvent.click(getByText('open-dialog'))
    await waitFor(() => {
      expect(getOverlayStack()).toHaveLength(1)
    })
    expect(events).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
