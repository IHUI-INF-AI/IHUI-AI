<template>
  <div class="module-mod">
    <div class="module-mod-container">
      <div class="module-header">
        <div class="head">
          <h2 class="head-title">
            <div class="title">
              <span v-if="icon" class="title-icon">
                <svg-icon :name="icon"/>
              </span>
              <router-link :to="{path: type}">{{hotItem.name}}</router-link>
            </div>
          </h2>
        </div>
        <div class="module-sub-title" v-if="hotItem.moduleLinkList && hotItem.moduleLinkList.length">
          <div class="module-link-wrap" v-for="item in hotItem.moduleLinkList" :key="item.id">
            <a :href="item.href" target="_self" :title="item.name">{{item.name}}</a>
          </div>
        </div>
        <a class="module-right-content" title="换一换" @click="change">
          <el-icon class="el-icon-refresh"><Refresh /></el-icon> 换一换
        </a>
      </div>
      
      <div class="hot-content-grid" v-loading="dataLoading">
        <el-empty v-if="!(contentList && contentList.length)" class="empty-state"/>
        <rectangle
            v-else v-for="item in contentList"
            :link="type ? '/' + type + '/detail' : undefined"
            :item="item"
            :key="item.id"
            class="hot-item-card"
        ></rectangle>
      </div>
    </div>
  </div>
</template>

<script>
  import rectangle from "./component/rectangle.vue";
  import { ref, watch, onMounted } from "vue";
  import SvgIcon from "@/components/edu/SvgIcon.vue";
  import { Refresh } from '@/lib/lucide-fallback';
  export default {
    name: "HotIndex",
    components: {
      SvgIcon,
      rectangle,
      Refresh
    },
    props: {
      hotItem: {
        type: Object,
        default: () => {
          return {
            moduleLinkList: [],
            contentList: []
          }
        }
      },
      type: {
        type: String,
        default: "learn"
      },
      icon: {
        type: String,
        default: null
      },
    },
    setup(props) {
      // 默认每行显示 5 个（针对大屏）
      const rowItemNum = ref(5)
      const showRowNum = 2
      const contentList = ref([])
      let pageNum = 0;
      const dataLoading = ref(true)

      const change = () => {
        dataLoading.value = true
        if (props.hotItem && props.hotItem.contentList && props.hotItem.contentList.length) {
          const pageSize = rowItemNum.value * showRowNum;
          const start = pageNum * pageSize;
          let end = (pageNum + 1) * pageSize;
          if (end >= props.hotItem.contentList.length) {
            end = props.hotItem.contentList.length;
            pageNum = 0
          } else {
            pageNum++;
          }
          contentList.value = props.hotItem.contentList.slice(start, end);
        }
        dataLoading.value = false
      }

      onMounted(() => {
        // 根据容器宽度动态调整 rowItemNum 以配合 change 分页逻辑
        const updateRowItemNum = () => {
          const width = window.innerWidth;
          if (width >= 1200) rowItemNum.value = 5;
          else if (width >= 992) rowItemNum.value = 4;
          else if (width >= 768) rowItemNum.value = 3;
          else if (width >= 480) rowItemNum.value = 2;
          else rowItemNum.value = 1;
        };
        
        updateRowItemNum();
        window.addEventListener('resize', updateRowItemNum);
        change();
      });

      watch(() => rowItemNum.value, () => {
        change()
      });
      
      watch(() => props.hotItem.contentList, () => {
        change()
      });

      return {
        rowItemNum,
        change,
        contentList,
        dataLoading
      }
    }
  }
</script>

<style lang="scss" scoped>
  .module-mod {
    margin-bottom: 24px;
    
    .module-mod-container {
      background: #ffffff;
      border-radius: $border-radius;
      border: 1px solid $border-color;
      overflow: hidden;
      box-shadow: $shadow-sm;
    }
    
    .module-header {
      display: flex;
      align-items: center;
      padding: 0 20px;
      height: 56px;
      border-bottom: 1px solid $border-color;
      position: relative;
      
      .head {
        display: flex;
        align-items: center;
        
        .head-title {
          font-size: 18px;
          margin: 0;
          
          .title {
            display: flex;
            align-items: center;
            gap: 8px;
            
            .title-icon {
              display: flex;
              align-items: center;
              font-size: 20px;
              color: $primary-color;
            }
            
            a {
              color: $text-primary;
              font-weight: 600;
              &:hover {
                color: $primary-color;
              }
            }
          }
        }
      }
      
      .module-sub-title {
        display: flex;
        margin-left: 20px;
        gap: 10px;
        
        .module-link-wrap a {
          font-size: 14px;
          color: $text-secondary;
          &:hover {
            color: $primary-color;
          }
        }
      }
      
      .module-right-content {
        margin-left: auto;
        font-size: 14px;
        color: $text-secondary;
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        
        &:hover {
          color: $primary-color;
        }
      }
    }
    
    .hot-content-grid {
      padding: 20px;
      display: grid;
      // 使用 CSS Grid 布局，自动填充列，每列最小 200px
      grid-template-columns: repeat(5, 1fr);
      gap: 20px;
      
      @media (max-width: 1200px) { grid-template-columns: repeat(4, 1fr); }
      @media (max-width: 992px) { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 480px) { grid-template-columns: repeat(1, 1fr); }

      .empty-state {
        grid-column: 1 / -1;
        padding: 40px 0;
      }
      
      .hot-item-card {
        width: 100%; // 覆盖子组件内部可能存在的固定宽度
        margin: 0;
      }
    }
  }
</style>
