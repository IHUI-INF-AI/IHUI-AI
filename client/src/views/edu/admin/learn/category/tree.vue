<template>
  <div class="tree-wrap">
    <el-input v-model="searchName" placeholder="输入关键字进行过滤" />
    <el-tree
      ref="treeRef"
      :data="dataList"
      node-key="id"
      :props="defaultProps"
      :filter-node-method="filterNode"
      :expand-on-click-node="false"
      default-expand-all
      :highlight-current="true"
      @node-click="handleNodeClick"
    >
      <template #default="{ node, data }">
        <span class="custom-tree-node">
          <span class="node-label">{{ node.label }}</span>
          <span class="node-count" v-if="data.courseCount !== undefined">({{ data.courseCount }})</span>
        </span>
      </template>
    </el-tree>
  </div>
</template>

<script>
// @ts-nocheck
import { ref, watch } from "vue"
import { learnApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree } = learnApi

export default {
  name: "LearnCategoryTree",
  props: {
    pid: {
      type: Number,
      default: 0
    },
    onNodeClick: {
      type: Function
    }
  },
  setup(props) {
    const treeRef = ref(null)
    const searchName = ref("")
    const dataList = ref([])
    const defaultProps = {
      children: "children",
      label: "name"
    }

    const loadData = () => {
      findCategoryList(props.pid || 0, true).then(response => {
        if (response) {
          dataList.value = toTree(response)
        }
      })
    }

    loadData()

    const filterNode = (value, data) => {
      if (!value) return true
      return data.name.indexOf(value) !== -1
    }

    watch(searchName, (val) => {
      treeRef.value && treeRef.value.filter(val)
    })

    const handleNodeClick = (data) => {
      props.onNodeClick && props.onNodeClick(data)
    }

    return {
      treeRef,
      searchName,
      dataList,
      defaultProps,
      filterNode,
      handleNodeClick,
      loadData
    }
  }
}
</script>

<style scoped lang="scss">
.tree-wrap {
  .custom-tree-node {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-right: 8px;
    font-size: 14px;

    .node-label {
      flex: 1;
    }

    .node-count {
      color: var(--el-color-primary);
      margin-left: 8px;
      font-size: 12px;
    }
  }

  :deep(.el-tree-node__content) {
    height: 36px;
  }

  :deep(.el-tree-node__content:hover) {
    background-color: rgba(144, 125, 255, 0.08);
  }

  :deep(.el-tree-node.is-current > .el-tree-node__content) {
    background-color: rgba(144, 125, 255, 0.12);
    color: var(--el-color-primary);
  }
}
</style>
