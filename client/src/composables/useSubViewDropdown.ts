// ============================================
// useSubViewDropdown - 下拉子视图状态机 composable
// ============================================
//
// 适用场景：弹窗/下拉窗内具有「主视图 + 多个子视图」导航的模式。
// 例如：AI 能力选择下拉内的「主菜单 ↔ 提示词模板子视图」。
//
// 提供能力：
//  1. 维护 currentView 响应式状态（主/子视图）
//  2. 父级 visible 关闭时自动回到主视图，避免下次打开时残留子视图
//  3. 进入非主视图时自动聚焦 backButtonRef（无障碍 / a11y）
//  4. handleEsc 智能处理：子视图优先返回主，主视图才关闭父级
//  5. closeAndReset 显式提供"关闭父级 + 重置主视图"以供子视图"完成"按钮使用
//
// 用法（与 AIChat.vue 之前的内联实现完全等价）：
//
//   const showPopover = ref(false)
//   const {
//     currentView,
//     backToMain,
//     goTo,
//     handleEsc,
//     backButtonRef,
//     closeAndReset,
//   } = useSubViewDropdown<'main' | 'prompts'>({ parentVisible: showPopover })
//
//   // 模板：
//   <el-dropdown v-model:visible="showPopover" @keydown.esc="handleEsc">
//     <template #dropdown>
//       <Transition name="view" mode="out-in">
//         <div v-if="currentView === 'prompts'" key="prompts">
//           <button ref="backButtonRef" @click="backToMain">返回</button>
//           ...
//         </div>
//         <div v-else key="main">
//           <button @click="goTo('prompts')">进入子视图</button>
//           ...
//         </div>
//       </Transition>
//     </template>
//   </el-dropdown>
// ============================================

import { ref, watch, type Ref } from 'vue'
import { onScopeDispose } from '@vue/reactivity'

/** 视图 id 通用类型约束 */
export type SubViewId = string

export interface UseSubViewDropdownOptions<TView extends SubViewId> {
  /** 父级容器/弹窗的可见性 ref（通常与 v-model:visible 绑定） */
  parentVisible: Ref<boolean>
  /** 主视图 id，默认 'main' */
  mainView?: TView
  /** 初始视图，默认 = mainView */
  initialView?: TView
}

export interface UseSubViewDropdownReturn<TView extends SubViewId> {
  /** 当前视图（响应式） */
  currentView: Ref<TView>
  /** 主视图常量（方便模板 / 处理器使用） */
  mainView: TView
  /** 切换到指定子视图 */
  goTo: (view: TView) => void
  /** 返回主视图 */
  backToMain: () => void
  /** 智能 Esc：子视图 → 主视图；主视图 → 关闭父级 */
  handleEsc: () => void
  /** 关闭父级并重置到主视图（用于子视图"完成/选择"按钮） */
  closeAndReset: () => void
  /** 子视图返回按钮的模板 ref，模板中 :ref 绑定后由 composable 自动 focus */
  backButtonRef: Ref<HTMLElement | null>
}

/**
 * 通用下拉子视图状态机
 *
 * @example
 *   type View = 'main' | 'prompts'
 *   const { currentView, backButtonRef, handleEsc } = useSubViewDropdown<View>({
 *     parentVisible: showCapabilityDropdown,
 *     mainView: 'main',
 *   })
 */
export function useSubViewDropdown<TView extends SubViewId = 'main'>(
  options: UseSubViewDropdownOptions<TView>,
): UseSubViewDropdownReturn<TView> {
  console.log('[useSubViewDropdown] composable called, parentVisible=', options.parentVisible.value)
  const mainView = (options.mainView ?? 'main') as TView
  const initial = (options.initialView ?? mainView) as TView

  const currentView = ref<TView>(initial) as Ref<TView>
  const backButtonRef = ref<HTMLElement | null>(null)

  // 父级关闭时自动回到主视图（防止下次打开残留子视图）
  watch(
    () => options.parentVisible.value,
    (visible) => {
      if (!visible) {
        currentView.value = mainView
      }
    },
  )

  // 进入非主视图时自动聚焦返回按钮（无障碍 / a11y）
  // 注意：使用轮询 setTimeout 而非 nextTick / 单次 setTimeout(0)：
  //   消费者通常用 <Transition mode="out-in"> 包裹子视图，
  //   mode=out-in 下会先 leave 旧元素再 enter 新元素，
  //   简单 nextTick 等待同步 DOM 更新时新元素尚未挂载，ref 仍为 null；
  //   单次 setTimeout(0) 也可能早于 Vue 的 leave→enter 调度完成。
  //   轮询（每 10ms 一次，≤500ms）确保一定能等到 ref 就绪再 focus。
  watch(
    () => currentView.value,
    (view) => {
      if (view === mainView) return
      const startedAt = Date.now()
      const tryFocus = (): void => {
        if (backButtonRef.value) {
          backButtonRef.value.focus()
          return
        }
        if (Date.now() - startedAt < 500) {
          setTimeout(tryFocus, 10)
        }
      }
      tryFocus()
    },
  )

  /** 切换到指定子视图 */
  const goTo = (view: TView): void => {
    currentView.value = view
  }

  /** 返回主视图 */
  const backToMain = (): void => {
    currentView.value = mainView
  }

  /**
   * 智能 Esc 处理：
   *  - 在子视图：先返回主视图（保留父级打开）
   *  - 在主视图：关闭父级
   */
  const handleEsc = (): void => {
    if (currentView.value !== mainView) {
      currentView.value = mainView
    } else {
      options.parentVisible.value = false
    }
  }

  /**
   * 自动监听 document keydown：仅在父级可见时拦截 Esc。
   * 这样无论焦点在 trigger / popper 内容 / 子元素上，Esc 都能被可靠处理。
   * 父级关闭后自动清理监听，避免泄漏。
   */
  if (typeof document !== 'undefined') {
    const onDocKeydown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (!options.parentVisible.value) return
      console.log('[useSubViewDropdown] Esc intercepted, view=', currentView.value, 'visible=', options.parentVisible.value)
      e.preventDefault()
      e.stopImmediatePropagation()
      handleEsc()
      Promise.resolve().then(() => {
        console.log('[useSubViewDropdown] after handleEsc, view=', currentView.value, 'visible=', options.parentVisible.value)
      })
    }
    document.addEventListener('keydown', onDocKeydown, true)
    onScopeDispose(() => {
      document.removeEventListener('keydown', onDocKeydown, true)
    })
  }

  /** 关闭父级并重置到主视图（用于子视图"完成/选择"按钮） */
  const closeAndReset = (): void => {
    options.parentVisible.value = false
    currentView.value = mainView
  }

  return {
    currentView,
    mainView,
    goTo,
    backToMain,
    handleEsc,
    closeAndReset,
    backButtonRef,
  }
}
