<template>
  <div class="category-content-wrapper">
    <el-empty v-if="!(contentList && contentList.length)" class="empty-state"/>
    <div v-else class="content-grid">
      <rectangle 
        v-for="item in contentList" 
        :link="'/' + type + '/detail'" 
        :item="item" 
        :key="item.id"
        class="grid-item"
      ></rectangle>
    </div>
  </div>
</template>

<script>
  import rectangle from "./rectangle.vue";
  import {ref, watch, onMounted, onUnmounted} from "vue";
export default {
  name: "rowTabsContent",
  components: {
    rectangle
  },
  props: {
    itemList: {
      type: Array,
      required: true
    },
    type: {
      type: String,
      default: "learn"
    }
  },
  setup(props) {
    // 每行显示数量
    const rowItemNum = ref(5)
    // 显示行数
    const showRowNum = 2
    // 内容列表
    const contentList = ref([])
    let pageNum = 0;
    
    // 根据屏幕宽度更新每行显示数量
    const updateRowItemNum = () => {
      const width = window.innerWidth;
      if (width >= 1200) rowItemNum.value = 5;
      else if (width >= 992) rowItemNum.value = 4;
      else if (width >= 768) rowItemNum.value = 3;
      else if (width >= 480) rowItemNum.value = 2;
      else rowItemNum.value = 1;
    }
    
    const change = () => {
      if (props.itemList && props.itemList.length) {
        const pageSize = rowItemNum.value * showRowNum;
        const start = pageNum * pageSize;
        let end = (pageNum + 1) * pageSize;
        if (end >= props.itemList.length) {
          end = props.itemList.length;
          pageNum = 0
        } else {
          pageNum++;
        }
        contentList.value = props.itemList.slice(start, end);
      } else {
        contentList.value = []
      }
    }
    
    onMounted(() => {
      updateRowItemNum()
      window.addEventListener("resize", updateRowItemNum)
      change()
    })
    
    onUnmounted(() => {
      window.removeEventListener("resize", updateRowItemNum)
    })
    
    watch(() => rowItemNum.value, () => {
      change()
    });
    
    watch(() => props.itemList, () => {
      pageNum = 0
      change()
    }, { immediate: true });
    
    return {
      contentList,
      rowItemNum
    }
  }
}
</script>

<style lang="scss" scoped>
.category-content-wrapper {
  width: 100%;
  min-height: 240px;
  
  .empty-state {
    padding: 40px 0;
  }
  
  .content-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 20px;
    
    @media (max-width: 1200px) { grid-template-columns: repeat(4, 1fr); }
    @media (max-width: 992px) { grid-template-columns: repeat(3, 1fr); }
    @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
    @media (max-width: 480px) { grid-template-columns: repeat(1, 1fr); }
    
    .grid-item {
      width: 100%;
      margin: 0;
    }
  }
}
</style>
