<template>
  <!--
    LiveRegion - 全局 aria-live 区域
    polite   区：状态变化、非关键通知（普通 toast、信息）
    assertive 区：关键告警（余额不足、支付失败、错误）
    视觉上 .sr-only 隐藏（见 _a11y.scss），但屏幕阅读器可朗读
  -->
  <div
    id="a11y-live-polite"
    class="sr-only"
    aria-live="polite"
    aria-atomic="true"
    role="status"
  />
  <div
    id="a11y-live-assertive"
    class="sr-only"
    aria-live="assertive"
    aria-atomic="true"
    role="alert"
  />
</template>

<script setup lang="ts">
// 该组件无需 props，作为 App 全局挂载点
// 屏幕阅读器播报通过 useA11y().announce() 写入对应 DOM
</script>
