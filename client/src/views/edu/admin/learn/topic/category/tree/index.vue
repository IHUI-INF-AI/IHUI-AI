<template>
  <div class="category-tree">
    <Input size="small" placeholder="输入关键字进行搜索" v-model="filterText" />
    <div v-if="dataLoading" class="mt-2 text-xs text-muted-foreground">加载中...</div>
    <ul v-else-if="treeFlag" class="mt-2 space-y-0.5 min-h-[102px]">
      <CategoryTreeNode
        v-for="node in treeData"
        :key="node.id"
        :node="node"
        :default-props="defaultProps"
        :current-key="nodeKey"
        :filter-text="filterText"
        @node-click="handleNodeClick"
      />
    </ul>
  </div>
</template>

<script>
// 目录API
import { learnApi } from '@/api/edu/admin-api'
const { findCategoryList } = learnApi
import {ref, watch, nextTick} from "vue";
import { Input } from '@/components/ui/input'
import CategoryTreeNode from '@/components/CategoryTreeNode.vue'
export default {
  name: "LearnTopicCategoryTree",
  components: {
    Input,
    CategoryTreeNode
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
    const handleNodeClick = (data) => {
      context.emit("node-click", data, this);
    }
    return {
      treeFlag,
      nodeKey,
      filterText,
      defaultProps,
      treeData,
      handleNodeClick,
      dataLoading
    }
  }
}
</script>
