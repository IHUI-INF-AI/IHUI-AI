<template>
  <div>
    <Input size="small" placeholder="输入关键字进行过滤" v-model="filterText"></Input>
    <ul class="mt-2.5 space-y-0.5 min-h-[140px]">
      <CategoryTreeNode
        v-for="node in treeData"
        :key="node.id"
        :node="node"
        :default-props="defaultProps"
        :filter-text="filterText"
        @node-click="handleNodeClick"
      />
    </ul>
  </div>
</template>

<script>
import {ref} from "vue";
import { organizationalApi } from '@/api/edu/admin-api'
const { findDepartmentList } = organizationalApi
import { Input } from '@/components/ui/input'
import CategoryTreeNode from '@/components/CategoryTreeNode.vue'
export default {
  name: "departmentTree",
  components: { Input, CategoryTreeNode },
  setup(props, context) {
    const filterText = ref("");
    const defaultProps = {
      children: "children",
      label: "name"
    }
    const treeData = ref([])
    findDepartmentList(0, true, res => {
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
    })
    const handleNodeClick = (data) => {
      context.emit("node-click", data, this);
    }
    return {
      filterText,
      defaultProps,
      treeData,
      handleNodeClick
    }
  }
}
</script>
