<template>
  <el-cascader
    v-model="localModel"
    :options="options"
    :props="propsOption"
    :collapse-tags="collapseTags"
    :clearable="clearable"
    ref="myCascade"
    @change="change"></el-cascader>
</template>

<script>
import { ref, watch } from "vue"
export default {
  name: "CascaderSelector",
  emits: ["son-data", "update:model"],
  props: {
    model: {
      type: Array,
      default: () => []
    },
    options: { // 数据库      type: Array,
      default: () => []
    },
    collapseTags: { // 多选模式下是否折叠Tag
      type: Boolean,
      default: false
    },
    expandTrigger: { // 展开方式
      type: String,
      default: "click"
    },
    clearable: { // 是否显示删除按钮
      type: Boolean,
      default: false
    },
    propsOption: {
      type: Object,
      default: function () {
        return {
          expandTrigger: "click",
          multiple: false,
          checkStrictly: false,
          value: "value",
          label: "label",
          children: "children",
          disabled: "disabled"
        }
      }
    }
  },
  setup(props, { emit }) {
    const myCascade = ref(null)
    const localModel = ref(props.model || [])
    
    // 监听props.model变化，同步到本地
    watch(() => props.model, (newVal) => {
      localModel.value = newVal || []
    })
    
    // 监听本地变化，通知父组件
    watch(localModel, (newVal) => {
      emit("update:model", newVal)
    })
    
    const change = data => {
      const ids = []
      data.forEach(item => {
        ids.push(item[0])
      })
      emit("son-data", ids)
    }
    // 清楚选中
    const clearSelected = () => {
      let obj = {}
      obj.stopPropagation = () => {}
      try{
        myCascade.value.clearValue(obj)
      }catch(err){
        myCascade.value.handleClear(obj)
      }
    }
    return {
      change,
      clearSelected,
      myCascade,
      localModel
    }
  }
}
</script>

<style scoped>

</style>
