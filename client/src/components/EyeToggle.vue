<template>
  <label class="container" @click.stop="handleLabelClick">
    <input type="checkbox" :checked="checked" @change="handleChange" @click.stop>
    <svg class="eye" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor" @click.stop="handleLabelClick"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z" fill="currentColor"></path></svg>
    <svg class="eye-slash" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor" @click.stop="handleLabelClick"><path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z" fill="currentColor"></path></svg>
  </label>
</template>

<script>
export default {
  name: 'EyeToggle',
  props: {
    checked: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    handleLabelClick(event) {
      event.stopPropagation();
      // 手动触发 checkbox 的点击事件
      const checkbox = this.$el.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.click();
      }
    },
    handleChange(event) {
      event.stopPropagation();
      // 不阻止默认行为，让checkbox状态正常更新
      // 获取更新后的checked状态
      const newChecked = event.target.checked;
      this.$emit('change', newChecked);
    }
  }
}
</script>

<style scoped>
  /* stylelint-disable color-no-hex */

  /* 豁免原因：局部 CSS 变量声明（组件内部 token 定义），属于合理硬编码 */

  /* ------ Settings ------ */
  // scoped 提供 [data-v-xxx] 属性选择器，特异性 (0,1,1) 足够覆盖父级
  .container {
    --color: var(--el-text-color-placeholder);
    --size: 18px;

    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    cursor: pointer;
    font-size: var(--size);
    user-select: none;
    width: 18px;
    height: 18px;
    min-width: 18px;
    min-height: 18px;
    max-width: 18px;
    max-height: 18px;
    pointer-events: auto;
    z-index: var(--z-header);
    visibility: visible;
    opacity: 1;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    overflow: visible;
  }

  .container .eye {
    position: absolute;
    width: 18px;
    height: 18px;
    fill: var(--color);
    color: var(--color);
    display: block;
    visibility: visible;
    opacity: 1;
    animation: keyframes-fill .5s;
    pointer-events: none;
    top: 0;
    left: 0;
    margin: 0;
    padding: 0;
  }

  .container .eye-slash {
    position: absolute;
    width: 18px;
    height: 18px;
    fill: var(--color);
    color: var(--color);
    display: none;
    visibility: visible;
    opacity: 1;
    animation: keyframes-fill .5s;
    pointer-events: none;
    top: 0;
    left: 0;
    margin: 0;
    padding: 0;
  }

  /* ------ On check event ------ */
  .container input:checked ~ .eye {
    display: none;
  }

  .container input:checked ~ .eye-slash {
    display: block;
  }

  /* ------ Hide the default checkbox ------ */
  .container input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    z-index: calc(var(--z-base) + 9);
    top: 0;
    left: 0;
  }

  /* ------ Animation ------ */
  @keyframes keyframes-fill {
    0% {
      transform: scale(0);
      opacity: 0;
    }

    50% {
      transform: scale(1.2);
    }
    
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  /* Hover effect */
  .container:hover {
    --color: var(--el-text-color-regular);
  }
</style>
