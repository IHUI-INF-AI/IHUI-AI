<template>
  <div class="category-tree">
    <Input size="small" placeholder="输入关键字进行搜索" v-model="filterText" />
    <el-tree v-loading="dataLoading" size="small" ref="treeRef" v-if="treeFlag" :current-node-key="nodeKey" node-key="id" :filter-node-method="filterNode" :highlight-current="true" :data="treeData" :props="defaultProps" :expand-on-click-node="false" @node-click="handleNodeClick" class="el-tree"></el-tree>
  </div>
</template>

<script>
// @ts-nocheck
// 目录API
import { learnApi } from '@/api/edu/admin-api'
const { findCategoryList } = learnApi
import {ref, watch, nextTick} from "vue";
import { Input } from '@/components/ui/input'
export default {
  name: "LearnTopicCategoryTree",
  components: {
    Input
  },
  props: {
    currentNodeKey: Number
  },
  setup(props, context) {
    const filterText = ref("");
    const defaultProps = {
      children: "children",
      label: "name"
    }
    const treeData = ref([])
    let treeRef = ref(null);
    watch([filterText], (nv) => {
      treeRef.value.filter(nv);
    })
    const dataLoading = ref(true)
    const loadCategoryList = () => {
      findCategoryList(0, true, res => {
        // 获取部门列表中的根节点（父节点id为0的）（获取的根节点包含孩子）
        function getRootNodes(nodeList) {
          if (!nodeList || nodeList.length <= 0) {
            return [];
          }
          // 递归获取节点的孩子节点
          const getChildren = function(parent) {
            const children = [];
            for (let i = 0; i < nodeList.length; i++) {
              const item = nodeList[i];
              if (item.pid === parent.id) {
                children.push(item);
              }
            }
            parent.children = children
            if (children.length === 0) {
              return;
            }
            for (let i = 0; i < children.length; i++) {
              getChildren(children[i]);
            }
          }
          const result = [];
          for (let i = 0; i < nodeList.length; i++) {
            const item = nodeList[i];
            if (item.pid === 0 || item.pid === null) {
              result.push(item);
              getChildren(item);
            }
          }
          return result;
        }
        treeData.value = getRootNodes(res);
        treeData.value = getRootNodes(res);
        dataLoading.value = false
      }).catch(() => {
        dataLoading.value = false
      })
    }
    loadCategoryList()
    let nodeKey = ref(props.currentNodeKey)
    const treeFlag = ref(true)
    watch(() => props.currentNodeKey, (nv) => {
      nodeKey.value = nv
      treeFlag.value =false
      nextTick(() => {
        treeFlag.value =true
      })
      loadCategoryList()
    })
    const filterNode = function(value, data, node) {
      if (!value) {
        return true;
      }
      return data.name.indexOf(value) !== -1;
    }
    const handleNodeClick = (data) => {
      context.emit("node-click", data, this);
    }
    return {
      treeFlag,
      nodeKey,
      filterText,
      defaultProps,
      treeData,
      treeRef,
      filterNode,
      handleNodeClick,
      dataLoading
    }
  }
}
</script>
<style scoped lang="scss">
.category-tree {
  :deep(.el-input__inner), :deep(.el-input-number){
    height: 34px;
    line-height: 34px;
    font-size: 12px;
    border: none;
    border-radius: 0;
    border-bottom: 1px solid #f7f7f7;
    &:focus, &:hover {
      border-color: #f3f5f8;
    }
    .el-input-number__decrease, .el-input-number__increase {
      background: #FFFFFF;
      line-height: 32px;
      border: none;
      &:focus, &:hover {
        border-color: #f3f5f8;
      }
    }
  }
  :deep(.el-tree){
    min-height: 102px;
    .el-tree-node {
      &:focus, &:focus > .el-tree-node__content {
        background-color: #FFFFFF;
      }
      .el-tree-node__content {
        height: 30px;
        &:hover {
          background-color: #FFFFFF;
          color: hsl(var(--primary));
        }
        .el-tree-node__expand-icon {
          font-size: 16px;
        }
        .el-tree-node__label {
          font-size: 12px;
        }
      }
    }
  }
  :deep(.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content){
    background-color: #FFFFFF;
    color: hsl(var(--primary));
  }
}
</style>
