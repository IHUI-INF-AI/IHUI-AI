// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 平台特有:仅在 Tauri 桌面壳里有意义(宿主询问「点关闭按钮怎么办」),浏览器下永不渲染。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@ihui/ui-react'
import { resolveCloseChoice, type DesktopCloseChoice } from '@/lib/desktop-prefs-bridge'

/**
 * CloseChoiceDialog — 「点击关闭按钮时怎么办」的询问弹窗(2026-09-28 立)。
 *
 * 链路上它是 `desktop-close-requested` 的消费端:Rust emit → use-desktop.ts `listen` +
 * 再派发 CustomEvent → 这里 `addEventListener`(三层接线由
 * `scripts/check-desktop-event-wiring.mjs` 对账)。
 *
 * **一次询问恰好一次答复**是这门的存在理由:宿主等答复只等 3 秒,超时就走它自己的兜底
 * 并记一条日志 —— 少答一次等于把用户的意图换成宿主的默认策略,而现象只是"关闭按钮偶尔不听使唤"。
 * 所以:
 * - 同一个询问被投来两次(重复注册 / 重复渲染)时,第二次不起第二轮对话;
 * - 三条出路(隐藏 / 退出 / 取消)与 Esc、遮罩点击、组件卸载**全部**收敛到同一个 `answer()`,
 *   由 `answeredRef` 保证只有第一次真发出去;
 * - 卸载时若还有未答复的询问,补一发 `cancel`,而不是留给 3 秒兜底。
 *
 * 刻意不做的事:不建"待答复队列"、不按 id 去重。这条链是 continuous 实时链(无 id 无队列),
 * 在前端补发/去重只会把"投递失败"伪装成"已处理"(见 use-desktop.ts 顶部同一禁令)。
 *
 * **挂载点 = `src/providers/global-hooks-provider.tsx`(全局),不是设置页那张卡片。**
 * 挂在卡片里时只有人在 `/settings` 才会被问到,在其他页面点 × 会静默走到宿主的 3 秒兜底 ——
 * 用户看到的现象是"设了每次询问却从来不问",而账面没有任何红。由
 * `apps/web/tests/desktop-close-choice-dialog.test.tsx` 的挂载位置锁钉住(反向:卡片里不得再出现它)。
 */
export function CloseChoiceDialog() {
  const t = useTranslations('settings')
  const [open, setOpen] = React.useState(false)
  const [remember, setRemember] = React.useState(false)

  /** 有询问在等答复(决定 answer 是否真的发出去,以及卸载时要不要补 cancel)。 */
  const pendingRef = React.useRef(false)
  /** 这一轮是否已答复:重渲染 / 重复事件 / 卸载兜底都过这道闸。 */
  const answeredRef = React.useRef(false)
  /** 勾选态的 ref 镜像:answer 必须保持稳定身份,否则下面的卸载兜底会随勾选重跑。 */
  const rememberRef = React.useRef(false)

  const answer = React.useCallback((choice: DesktopCloseChoice) => {
    if (!pendingRef.current || answeredRef.current) return
    answeredRef.current = true
    pendingRef.current = false
    setOpen(false)
    void resolveCloseChoice(choice, choice !== 'cancel' && rememberRef.current)
  }, [])

  React.useEffect(() => {
    const onRequested = (): void => {
      if (pendingRef.current) return
      pendingRef.current = true
      answeredRef.current = false
      rememberRef.current = false
      setRemember(false)
      setOpen(true)
    }
    // 事件名与 use-desktop.ts 的 listen / dispatch 三处逐字同形,改名必须同时改完
    window.addEventListener('desktop-close-requested', onRequested)
    return () => window.removeEventListener('desktop-close-requested', onRequested)
  }, [])

  // 卸载兜底:deps 只放那个恒定身份的 answer ⇒ 本 effect 只在真正卸载时跑一次
  React.useEffect(
    () => () => {
      answer('cancel')
    },
    [answer],
  )

  const toggleRemember = (checked: boolean): void => {
    rememberRef.current = checked
    setRemember(checked)
  }

  return (
    <Dialog
      open={open}
      // 关闭动作(遮罩 / Esc)不等于"没发生":一律按 cancel 答复,让宿主立刻拿到结论
      onOpenChange={(next) => {
        if (!next) answer('cancel')
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('desktopAskTitle')}</DialogTitle>
          <DialogDescription>{t('desktopAskBody')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Checkbox
            id="desktop-close-remember"
            checked={remember}
            onCheckedChange={(checked) => toggleRemember(checked === true)}
          />
          <Label htmlFor="desktop-close-remember" className="text-xs font-normal">
            {t('desktopAskRemember')}
          </Label>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="xs" onClick={() => answer('cancel')}>
            {t('desktopAskCancel')}
          </Button>
          <Button variant="outline" size="xs" onClick={() => answer('quit')}>
            {t('desktopAskQuit')}
          </Button>
          <Button size="xs" onClick={() => answer('hide')}>
            {t('desktopAskHide')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
