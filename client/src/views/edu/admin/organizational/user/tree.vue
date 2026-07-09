<template>
  <div>
    <Input size="small" placeholder="输入关键字进行过滤" v-model="filterText"></Input>
    <el-tree size="small" ref="treeRef" :filter-node-method="filterNode" :highlight-current="true" :data="treeData" :props="defaultProps" :expand-on-click-node="false" @node-click="handleNodeClick" class="el-tree"></el-tree>
  </div>
</template>

<script>
// @ts-nocheck
import {ref, watch} from "vue";
import { organizationalApi } from '@/api/edu/admin-api'
const { findDepartmentList } = organizationalApi
import { Input } from '@/components/ui/input'
export default {
  name: "departmentTree",
  components: { Input },
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
      filterText,
      defaultProps,
      treeData,
      treeRef,
      filterNode,
      handleNodeClick
    }
  }
}
</script>
<style scoped>
  .el-tree {
    margin-top: 10px;
    min-height: 140px;
  }
</style>
