<template>
  <div style="border: 1px solid #ccc">
    <div class="we-toolbar">富文本编辑器（WangEditor 占位实现，原依赖 @wangeditor 未安装）</div>
    <textarea
      :value="modelValue"
      class="we-textarea"
      placeholder="请输入内容..."
      @input="onInput"
    ></textarea>
  </div>
</template>

<script>
// @ts-nocheck
export default {
  name: 'WangEditorIndex',
  props: {
    modelValue: { type: String, default: '' },
    moduleType: { type: String, default: 'public' },
    onChange: { type: Function, default: function () {} }
  },
  setup(props, context) {
    const onInput = (e) => {
      const html = e.target.value
      context.emit('update:modelValue', html)
      props.onChange && props.onChange(html)
    }
    return { onInput }
  }
}
</script>

<style scoped lang="scss">
.we-toolbar {
  padding: 6px 10px;
  border-bottom: 1px solid #ccc;
  background: #f5f7fa;
  font-size: 12px;
  color: #909399;
}
.we-textarea {
  width: 100%;
  height: 500px;
  resize: vertical;
  padding: 10px;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: 14px;
  box-sizing: border-box;
}
</style>
