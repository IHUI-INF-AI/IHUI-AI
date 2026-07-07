<template>
  <div class="category-content-wrapper">
    <el-empty v-if="!(contentList && contentList.length) && !bigItem" class="empty-state"/>
    <div v-else class="big-content-layout">
      <!-- 左侧大卡片 -->
      <div class="big-card-wrapper" v-if="bigItem && bigItem.name">
        <big-rectangle :link="'/' + type + '/detail'" :item="bigItem"/>
      </div>
      <!-- 右侧小卡片网格 -->
      <div class="small-cards-grid">
        <rectangle 
          v-for="item in contentList" 
          :link="'/' + type + '/detail'" 
          :item="item" 
          :key="item.id"
          class="grid-item"
        />
      </div>
    </div>
  </div>
</template>

<script>
  import bigRectangle from "./bigRectangle.vue";
  import rectangle from "./rectangle.vue";
  import {ref, watch, onMounted, onUnmounted} from "vue";
  export default {
    name: "tabsContent",
    components: {
      rectangle,
      bigRectangle
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
      const bigItem = ref(null)
      const contentList = ref([])
      
      // 每行显示数量（不含大卡片）
      const rowItemNum = ref(4)
      // 显示行数
      const showRowNum = 2
      let pageNum = 0;
      
      // 根据屏幕宽度更新每行显示数量
      const updateRowItemNum = () => {
        const width = window.innerWidth;
        if (width >= 1200) rowItemNum.value = 4;
        else if (width >= 992) rowItemNum.value = 3;
        else if (width >= 768) rowItemNum.value = 2;
        else rowItemNum.value = 2;
      }
      
      const change = () => {
        if (props.itemList && props.itemList.length) {
          // 第一个作为大卡片
          bigItem.value = props.itemList[0]
          
          // 剩余的作为小卡片
          const pageSize = rowItemNum.value * showRowNum;
          const start = pageNum * pageSize + 1;
          let end = (pageNum + 1) * pageSize + 1;
          if (end >= props.itemList.length) {
            end = props.itemList.length;
            pageNum = 0
          } else {
            pageNum++;
          }
          contentList.value = props.itemList.slice(start, end);
        } else {
          bigItem.value = null
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
        bigItem,
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
  
  .big-content-layout {
    display: flex;
    gap: 20px;
    
    @media (max-width: 768px) {
      flex-direction: column;
    }
    
    .big-card-wrapper {
      flex: 0 0 280px;
      
      @media (max-width: 992px) {
        flex: 0 0 240px;
      }
      
      @media (max-width: 768px) {
        flex: none;
        width: 100%;
      }
    }
    
    .small-cards-grid {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      
      @media (max-width: 1200px) { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 992px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 480px) { grid-template-columns: repeat(1, 1fr); }
      
      .grid-item {
        width: 100%;
        margin: 0;
      }
    }
  }
}
</style>
