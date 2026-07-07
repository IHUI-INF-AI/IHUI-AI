<template>
  <el-pagination
    :total="total"
    :page-size="pageSize"
    class="page-bar"
    layout="total, prev, pager, next, sizes"
    @size-change="onSizeChange"
    @current-change="onCurrentChange"
  />
</template>

<script>
// @ts-nocheck
export default {
  name: 'PageIndex',
  props: {
    // 数据总条数
    total: {
      type: Number,
      default: 0
    },
    // 每页显示条数（兼容旧 size prop）
    size: {
      type: Number,
      default: 10
    },
    // 每页条数变化回调
    sizeChange: {
      type: Function
    },
    // 当前页码变化回调
    currentChange: {
      type: Function
    },
    pageSize: {
      type: Number,
      default: 20
    }
  },
  methods: {
    onSizeChange(val) {
      this.sizeChange && this.sizeChange(val)
    },
    onCurrentChange(val) {
      this.currentChange && this.currentChange(val)
    }
  }
}
</script>

<style scoped lang="scss">
.page-bar {
  margin-top: 10px;
  display: flex;
  justify-content: center;

  :deep(.el-pagination) {
    justify-content: center;
  }
}
</style>
