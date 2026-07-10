<template>
  <div class="tree-wrap">
    <Input v-model="searchName" placeholder="输入关键字进行过滤" />
    <ul class="mt-2 space-y-0.5">
      <CategoryTreeNode
        v-for="node in dataList"
        :key="node.id"
        :node="node"
        :default-props="defaultProps"
        :filter-text="searchName"
        count-key="courseCount"
        :default-expanded="true"
        @node-click="handleNodeClick"
      />
    </ul>
  </div>
</template>

<script>
import { ref } from "vue"
import { learnApi } from '@/api/edu/admin-api'
import { Input } from '@/components/ui/input'
import CategoryTreeNode from '@/components/CategoryTreeNode.vue'
const { findCategoryList, toTree } = learnApi

export default {
  name: "LearnCategoryTree",
  components: {
    Input,
    CategoryTreeNode
  },
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

    const handleNodeClick = (data) => {
      props.onNodeClick && props.onNodeClick(data)
    }

    return {
      searchName,
      dataList,
      defaultProps,
      handleNodeClick,
      loadData
    }
  }
}
</script>
