<!--
  TabSwitcher - 登录方式分段控件
  2026-07-04 重构: 用 indicator div 元素代替 ::before 伪元素, 解决
    (1) Vue scoped + :where(html.dark) 父选择器链问题, 导致暗色模式反相失效
    (2) updateIndicator 时机问题, 用 onMounted 之后 + nextTick + ResizeObserver 多重保险
-->
<template>
  <div class="tab-switcher">
    <!-- 登录/注册模式切换 -->
    <div class="mode-switcher">
      <h2 class="form-title">
        {{ isRegisterMode ? t('login.mode.userRegister') : t('login.mode.userLogin') }}
      </h2>
      <!-- 2026-07-06 重构: 从 el-button type="primary" link 改为 <span> + 自定义 class.
        原实现 el-button--primary + is-link 组合在 _element-plus-overrides.scss unlayered 上下文中
        background 简写被 el-button--primary 的 background-color 覆盖, 仍显示蓝色背景 + 白字.
        改用项目已有的 .switch-to-sso-link 极简模式 (color + font-weight + transition, 无背景),
        与 AccountLoginForm.vue 中"忘记密码"/"手机登录"链接样式统一, 视觉一致性更好. -->
      <span class="mode-toggle-link" role="button" tabindex="0" @click="toggleMode" @keydown.enter="toggleMode" @keydown.space.prevent="toggleMode">
        {{ isRegisterMode ? t('login.mode.hasAccount') : t('login.mode.noAccount') }}
      </span>
    </div>

    <!-- 分段控件 (B&W 极简 + 滑动指示器) -->
    <div ref="segmentRef" class="segment-tabs" role="tablist">
      <!-- 滑动指示器 (DOM 元素, 跟随 active tab 位置平滑过渡) -->
      <div
        ref="indicatorRef"
        class="segment-indicator"
        :class="{ 'is-dark': isDark }"
        style="transform: translateX(0);"
      ></div>
      <button
        v-for="tab in tabsList"
        :key="tab.value"
        :ref="(el: HTMLElement | null) => setTabRef(el, tab.value)"
        type="button"
        :class="['segment-tab', { 'is-active': activeTab === tab.value }]"
        role="tab"
        :aria-selected="activeTab === tab.value"
        @click="selectTab(tab.value)"
      >
        <component :is="tab.icon" class="segment-tab-icon" />
        <span>{{ tab.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { UserTabIcon, PhoneTabIcon, EmailTabIcon } from '@/components/login/icons/login-icons'

const { t } = useI18n()

interface TabSwitcherProps {
  activeTab: 'account' | 'phone' | 'email'
  isRegisterMode: boolean
}

interface TabSwitcherEmits {
  'update:activeTab': [tab: 'account' | 'phone' | 'email']
  'update:registerMode': [mode: boolean]
}

interface TabItem {
  value: 'account' | 'phone' | 'email'
  label: string
  icon: Component
}

const props = defineProps<TabSwitcherProps>()
const emit = defineEmits<TabSwitcherEmits>()

// 2026-07-06 v5 调整: 账号登录 / 邮箱登录 位置互换, 手机登录保持中间
// 顺序: 邮箱登录 (默认) → 手机登录 → 账号登录
const tabsList = computed<TabItem[]>(() => [
  {
    value: 'email',
    label: props.isRegisterMode ? t('login.tabs.emailRegister') : t('login.tabs.email'),
    icon: EmailTabIcon,
  },
  {
    value: 'phone',
    label: props.isRegisterMode ? t('login.tabs.phoneRegister') : t('login.tabs.phone'),
    icon: PhoneTabIcon,
  },
  {
    value: 'account',
    label: props.isRegisterMode ? t('login.tabs.accountRegister') : t('login.tabs.account'),
    icon: UserTabIcon,
  },
])

const selectTab = (value: 'account' | 'phone' | 'email'): void => {
  emit('update:activeTab', value)
}

const toggleMode = (): void => {
  emit('update:registerMode', !props.isRegisterMode)
}

// ============ 暗色模式检测 (2026-07-04 立, 用 MutationObserver 实时响应) ============
const isDark = ref(false)
const checkDark = (): void => {
  isDark.value = document.documentElement.classList.contains('dark')
}

let darkObserver: MutationObserver | null = null
onMounted(() => {
  checkDark()
  darkObserver = new MutationObserver(() => {
    checkDark()
  })
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})
onBeforeUnmount(() => {
  darkObserver?.disconnect()
  darkObserver = null
})

// ============ 滑动指示器 (DOM 元素, 用 inline style 直接控制位置) ============
const segmentRef = ref<HTMLDivElement | null>(null)
const indicatorRef = ref<HTMLDivElement | null>(null)
const tabRefs = ref<Record<'account' | 'phone' | 'email', HTMLElement | null>>({
  account: null,
  phone: null,
  email: null,
})

const setTabRef = (el: HTMLElement | null, value: 'account' | 'phone' | 'email'): void => {
  tabRefs.value[value] = el
}

// 2026-07-04 三次修复: 缓存 tab 宽度, 避免切换时 DOM 测量抖动
// 根因: flex:1 等宽 tab, 三个 tab width 始终相同 (124px),
//   但 is-active class 切换瞬间 + login 弹窗打开动画期间,
//   DOM 测量的 width 在 117.5-124 之间 subpixel 抖动
//   → indicator 跟随 transition → 视觉上"拉长再缩回"
// 修复: 首次 updateIndicator 时计算并缓存, 后续切换直接复用
const cachedTabWidth = ref<number | null>(null)

const updateIndicator = (): void => {
  const container = segmentRef.value
  const activeEl: HTMLElement | null = tabRefs.value[props.activeTab as 'account' | 'phone' | 'email']
  const indicator = indicatorRef.value
  if (!container || !activeEl || !indicator) return
  const containerRect = container.getBoundingClientRect()
  const activeRect = activeEl.getBoundingClientRect()
  // 2026-07-04 三次修复: width 改用 CSS calc 固定, 只更新 transform
  // 根因: 之前从 activeRect.width 读取 + inline style 设置,
  //   flex:1 等宽 tab 在 is-active class 切换 + 弹窗打开动画期间 width 抖动
  //   (117.5 / 120.109 / 122.125 / 123.844), 缓存机制被 ResizeObserver / DOM 更新干扰
  // 修复: 删掉 width inline style 设置, 改用 CSS calc((100% - 16px) / 3) 固定
  //   + 主动 removeProperty('width') 清除 Vite HMR / 老代码残留的旧 inline style
  //   (新代码不设 width, 但 Vite HMR 不清空 inline style, 必须显式删除)
  const left = activeRect.left - containerRect.left
  indicator.style.transform = `translateX(${left}px)`
  indicator.style.removeProperty('width')
}

let resizeObserver: ResizeObserver | null = null
let rafId: number | null = null

const scheduleUpdate = (): void => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    updateIndicator()
    rafId = null
  })
}

onMounted(() => {
  // 2026-07-04 三次修复: 延迟 250ms 等 login 弹窗打开动画结束后再初始化
  // 根因: login-shell-in 0.22s 动画期间 .universal-login 宽度从 0 增长到 460,
  //   flex 子项 width 跟着 subpixel 抖动 (122.125 → 124), 此时读取 activeEl.width
  //   会得到抖动值缓存, 后续 indicator 永远比 tab 短 1.875px
  // 修复: 延迟到弹窗动画结束后 (250ms) 才调用 scheduleUpdate, 此时 layout 稳定
  setTimeout(() => {
    nextTick(() => {
      scheduleUpdate()
    })
  }, 250)

  // 2026-07-04 二次修复: ResizeObserver 只观察容器, 不观察 tab
  // 根因: is-active 类切换时 color/border-color 变化可能触发 tab 内部 reflow,
  // ResizeObserver 反复调用 updateIndicator, 重置 transform/width
  // 修复: 只观察 .segment-tabs 容器, tab 自身大小变化由 flex 容器自适应
  // 2026-07-04 三次修复: ResizeObserver 触发时同步失效缓存, 强制下次 updateIndicator 重新测量
  // 根因: cachedTabWidth 缓存后, 如果容器尺寸变化 (如响应式布局/弹窗 resize), tab width 会变,
  //   但缓存值不变 → indicator 错位
  // 修复: ResizeObserver 触发时设 cachedTabWidth = null, 下次 updateIndicator 重新测量
  if (segmentRef.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      cachedTabWidth.value = null
      scheduleUpdate()
    })
    resizeObserver.observe(segmentRef.value)
  }
  // 监听 window resize (外部视口变化)
  window.addEventListener('resize', scheduleUpdate)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  window.removeEventListener('resize', scheduleUpdate)
})

watch(
  () => props.activeTab,
  () => {
    nextTick(() => {
      scheduleUpdate()
    })
  },
)

watch(
  () => props.isRegisterMode,
  () => {
    nextTick(() => {
      scheduleUpdate()
    })
  },
)

watch(isDark, () => {
  nextTick(() => {
    scheduleUpdate()
  })
})
</script>

<style scoped lang="scss">
@use '../_login-tokens.scss' as lt;

.tab-switcher {
  // 2026-07-06: 移除 margin-bottom, 间距由 .form-area 的 gap: 16px 统一控制
  // 之前 margin-bottom: 12px 与 gap: 16px 双重间距 = 28px 过大
}

.mode-switcher {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;

  .form-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  // 2026-07-06 重构: 极简链接样式 (与 AccountLoginForm.vue .switch-to-sso-link 模式一致)
  // 颜色: 默认次要色 (暗色下 #cfd3dc 浅灰), hover 主色 (与标题同色)
  // 无背景, 无边框, 无下划线, 仅靠 color transition 提供视觉反馈
  .mode-toggle-link {
    color: var(--el-text-color-secondary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: color 0.2s ease;

    &:hover,
    &:focus-visible {
      color: var(--el-text-color-primary);
      outline: none;
    }

    // 键盘焦点可见性 (a11y): 1px 描边 + 2px offset
    &:focus-visible {
      outline: 1px solid var(--border-unified-color-hover);
      outline-offset: 2px;
      border-radius: 2px;
    }
  }
}

/* ============ 分段控件 (B&W 反相 + 滑动指示器) ============ */
/* 2026-07-07 设计还原: 用户的原始要求是
   "这几个背景容器左右移动时要跟着描边框一起移动, 而且这个描边框 请你变成灰色".
   关键词: "背景容器" + "描边框" + "一起移动" + "灰色".
   → 1) 保留 background 容器 (浅色=#000 黑底 / 暗色=#fff 白底, B&W 反相)
     2) 描边改为灰色 1px solid #6b7280
     3) 描边与 background 容器都在 .segment-indicator 上,
        通过 transform: translateX 一起左右滑动, 永远同步. */
.segment-tabs {
  position: relative;
  display: flex;
  gap: 4px;
  padding: 3px;
  background-color: transparent;
  border-radius: var(--global-border-radius);
}

/* 滑动指示器 (DOM 元素, 跟随 active tab 平滑过渡)
   2026-07-04 三次修复: width 用 CSS calc 计算, 不通过 inline style 设置
   根因: 之前从 activeEl.getBoundingClientRect().width 读取 + inline style 设置,
     flex:1 等宽 tab 在 is-active class 切换 + 弹窗打开动画期间 width 抖动
     (117.5 → 122.125 → 124), 缓存机制仍被 ResizeObserver / 动画期间 DOM 更新失效
   修复: 用 CSS calc 固定计算, updateIndicator 只更新 transform, 不再触碰 width

   2026-07-07 修复: width/height 公式重新计算, 让 indicator 与 tab 尺寸完全一致
   根因: 之前 (100% - 24px) / 3 是基于旧容器布局 (padding 4 + gap 8 各 2), 但当前容器
     实际是 padding: 3px (各 2 = 6px) + gap: 4px (各 2 = 8px) = 14px, 用 24px 算出来
     比 tab 实际宽度窄 3.34px (412 容器: (412-24)/3=129.33, 实际 tab 132.67), 视觉上
     灰色描边框比 tab 文本还小, 两侧各留 ~1.7px 空隙, 看起来"indicator 是个小框"而不是
     "tab 的边框"
   修复: width = (100% - 14px) / 3 (padding 6 + 2 gaps 8) = 132.67px 与 tab 等宽
         height = 100% - 6px (padding 上下各 3) = 41.5px 与 tab 等高
         top/left 由 updateIndicator 动态计算 (active tab 的 getBoundingClientRect),
         默认 top: 3px 兜底避免初始 transform 延迟时 indicator 跑到 padding 外

   2026-07-07 终版: 恢复 background 容器 + 保留灰色描边, 两者一起移动
     用户原始要求 "背景容器左右移动时要跟着描边框一起移动, 描边框请变成灰色"
     → 浅色模式 background = #000 (黑底) + border = 1px solid #6b7280 (灰)
     → 暗色模式 background = #fff (白底) + border = 1px solid #6b7280 (灰, 不变)
     → background + border + 内部 active tab 文字反相, 三者都在 .segment-indicator
       容器内, 通过 transform: translateX 一起左右滑动, 永远同步. */
.segment-indicator {
  position: absolute;
  top: 3px;
  left: 0;
  height: calc(100% - 6px);
  width: calc((100% - 14px) / 3);
  background-color: lt.$login-tab-active-bg-light;   // 浅色 = #000 黑底
  border-radius: var(--global-border-radius);
  transition: transform 0.32s lt.$login-ease-out,
              background-color 0.32s lt.$login-ease-out,
              border-color 0.32s lt.$login-ease-out;
  z-index: 0;
  pointer-events: none;
  box-sizing: border-box;
  // 2026-07-07: 灰色描边 (1px #6b7280) 跟随滑动指示器移动.
  //   #6b7280 (gray-500) 中性中等灰, 在 #000 黑底 和 #fff 白底 上都清晰可见,
  //   不抢戏, 与弹窗整体灰阶风格统一. box-sizing: border-box 让宽度不变.
  border: 1px solid #6b7280;
}

// 暗色模式: indicator 背景反相为白底 (#fff)
:where(html.dark) .segment-indicator {
  background-color: lt.$login-tab-active-bg-dark;  // 暗色 = #fff 白底
}

/* 2026-07-04 三次修复: color 快速切换 (0.18s) + transform 慢速滑动 (0.32s) 错开
   根因: 之前两者都是 0.32s 同步, 但实际 DOM 更新时机导致 color 落后于 transform,
   T+30ms 时 transform 已走 29.6% 但 color 才走 20%, indicator 滑过 phone tab 时
   phone 文字色还是浅灰, 呈"白底+浅灰字" (用户反馈"图标看不清").
   修复: color 用 0.18s (快速切换, 比 transform 提前完成) + 0.04s delay 等待
   is-active class 应用; transform 保持 0.32s 慢速滑动, 让 indicator 平滑移动.
   视觉效果: 切换瞬间文字色先稳定 (深/浅), 然后 indicator 滑动到位. */
.segment-tab {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: lt.$login-tab-padding;
  border-radius: var(--global-border-radius);
  background: transparent;
  color: var(--el-text-color-primary);
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
  // 2026-07-05 v3 简化: 去掉 0.04s delay, color/transform 统一 0.28s 范围内基本同步
  transition: background-color 0.28s lt.$login-ease-out,
              color 0.28s lt.$login-ease-out,
              border-color 0.28s lt.$login-ease-out;

  > * {
    color: inherit;
  }

  // 2026-07-07: 暗色模式活跃 tab 图标视觉"显灰"修复
  //   canvas 像素采样确认: 之前 14px 图标 + 2.4 stroke 在小尺寸下抗锯齿产生
  //   (76,76,76) / (128,128,128) 灰边像素, 视觉上不够"黑".
  //   修复:
  //     1) 放大到 18px (相对 14px 抗锯齿相对影响减小约 22%, 灰边像素占比下降)
  //     2) shape-rendering: geometricPrecision 高质量抗锯齿
  //   不需要 color: currentColor !important — .segment-tab.is-active { color: #000 }
  //   已是本组件 scoped 最高特异性规则, color 通过 currentColor 正常继承即可.
  .segment-tab-icon {
    width: 18px;
    height: 18px;
    color: currentColor;
    shape-rendering: geometricPrecision;
  }

  // 2026-07-07: 去掉 hover 时的描边反馈 (用户原话: "这几个按钮hover时不应该有背景色跟描边")
  // background 保持 transparent 不变, 颜色由 color transition 自然过渡, 无任何容器变化

  /* 2026-07-07 终版: 选中态文字反相 (浅色=#fff 白字, 配合 indicator #000 黑底;
     暗色=#1a1a1a 深字, 配合 indicator #fff 白底). 反相文字 + 灰色描边 = 视觉焦点最强,
     三个"移动单元" (background / border / text color) 都在 .segment-indicator
     容器内同步滑动, 永远是一体的. */
  &.is-active {
    background: transparent;
    color: lt.$login-tab-active-color-light;  // #fff
    border-color: transparent;
  }
}

/* 2026-07-04 二次修复: 暗色模式未选中 tab 颜色提亮 (#e5eaf3 → #ffffff)
   配合更深的 segment-tabs 背景 (#1a1a1a) 让"白字+深底"对比度更醒目 */
:where(html.dark) .segment-tab {
  color: lt.$login-tab-inactive-color-dark;
}

/* 2026-07-07 终版: 暗色模式选中态文字反相为深色 (#1a1a1a),
   配合 indicator 白底 (#fff) 形成强反相焦点. */
:where(html.dark) .segment-tab.is-active {
  color: lt.$login-tab-active-color-dark;  // #1a1a1a
}

@media (width <= 768px) {
  .mode-switcher {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .form-title {
      font-size: 20px;
    }
  }

  .segment-tab {
    font-size: 13px;
    padding: 4px 12px;
  }
}
</style>
