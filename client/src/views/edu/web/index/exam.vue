<template>
  <div class="exam-section">
    <div class="module-mod-container">
      <div class="module-header">
        <div class="head">
          <h2 class="head-title">
            <div class="title">
              <span class="title-icon">
                <svg-icon name="exam"/>
              </span>
              <router-link :to="{path: '/edu/exam/list'}">考试</router-link>
            </div>
          </h2>
        </div>
        <a class="module-right-content" title="换一换" @click="loadExamList">
          <el-icon class="el-icon-refresh"><Refresh /></el-icon> 换一换
        </a>
      </div>
      
      <div class="exam-grid-layout" v-loading="dataLoading">
        <el-empty v-if="!(examList && examList.length)" class="empty-state"/>
        
        <div v-else class="exam-card-list">
          <router-link
            class="exam-card"
            v-for="item in examList"
            :key="item.id"
            :to="{path: '/edu/exam/detail', query: {id: item.id}}"
            target="_blank"
          >
            <div class="card-cover">
              <img :src="item.image" :alt="item.title" class="cover-img" v-if="item.image">
              <div class="cover-placeholder" v-else>
                <el-icon><Document /></el-icon>
              </div>
              <div class="card-badge" v-if="item.status === 'ongoing'">进行中</div>
              <div class="card-badge card-badge-upcoming" v-else-if="item.status === 'upcoming'">即将开始</div>
            </div>
            <div class="card-content">
              <h3 class="card-title" :title="item.title">{{ item.title }}</h3>
              <div class="card-meta">
                <span class="meta-item">
                  <el-icon><User /></el-icon>
                  {{ item.signUpNum || 0 }}人报名
                </span>
                <span class="meta-item" v-if="item.startTime">
                  <el-icon><Clock /></el-icon>
                  {{ formatTime(item.startTime) }}
                </span>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import { getExamList, getRecommendExam } from "@/api/edu/web/exam";
import SvgIcon from "@/components/edu/SvgIcon.vue";
import { Refresh, Document, User, Clock } from '@/lib/lucide-fallback';

export default {
  name: "ExamIndex",
  components: { 
    SvgIcon, 
    Refresh, 
    Document, 
    User, 
    Clock 
  },
  setup() {
    const examList = ref([]);
    const dataLoading = ref(true);
    let currentPage = 1;

    const loadExamList = () => {
      dataLoading.value = true;
      getRecommendExam({ size: 5, current: currentPage }, (res) => {
        dataLoading.value = false;
        if (res && res.list && res.list.length) {
          examList.value = res.list;
          currentPage++;
        } else {
          // 如果推荐列表为空，则从普通列表获取
          getExamList({ size: 5, current: 1, status: 'published' }, (listRes) => {
            if (listRes && listRes.list) {
              examList.value = listRes.list;
            }
          }).catch(() => {});
        }
      }).catch(() => {
        dataLoading.value = false;
        // 失败时尝试获取普通列表
        getExamList({ size: 5, current: 1, status: 'published' }, (listRes) => {
          if (listRes && listRes.list) {
            examList.value = listRes.list;
          }
        }).catch(() => {});
      });
    };

    loadExamList();

    const formatTime = (time) => {
      if (!time) return '';
      const date = new Date(time);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${month}-${day}`;
    };

    return {
      examList,
      dataLoading,
      loadExamList,
      formatTime
    };
  }
};
</script>

<style scoped lang="scss">
.exam-section {
  margin-bottom: 24px;
  
  .module-mod-container {
    background: #ffffff;
    border-radius: $border-radius;
    border: 1px solid $border-color;
    overflow: hidden;
    box-shadow: $shadow-sm;
  }
  
  .module-header {
    padding: 0 20px;
    height: 56px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid $border-color;
    
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
          &:hover { color: $primary-color; }
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
  
  .exam-grid-layout {
    padding: 20px;
    min-height: 200px;
    
    .empty-state {
      padding: 40px 0;
    }
  }
  
  .exam-card-list {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;
    
    @media (max-width: 1200px) { grid-template-columns: repeat(4, 1fr); }
    @media (max-width: 992px) { grid-template-columns: repeat(3, 1fr); }
    @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
    @media (max-width: 480px) { grid-template-columns: repeat(1, 1fr); }
  }
  
  .exam-card {
    display: block;
    background: #fff;
    border: 1px solid $border-color;
    border-radius: $border-radius;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
    
    &:hover {
      transform: translateY(-4px);
      box-shadow: $shadow-lg;
      
      .cover-img {
        transform: scale(1.05);
      }
    }
    
    .card-cover {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #f5f5f5;
      overflow: hidden;
      
      .cover-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s;
      }
      
      .cover-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        // 使用固定颜色替代废弃的 lighten() 函数
        // $primary-color (#07c160) 增亮后约为 #4dd889
        background: linear-gradient(135deg, $primary-color 0%, #4dd889 100%);
        color: #fff;
        font-size: 36px;
      }
      
      .card-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        padding: 3px 8px;
        font-size: 12px;
        color: #fff;
        background: $primary-color;
        border-radius: 4px;
        
        &.card-badge-upcoming {
          background: #ff9800;
        }
      }
    }
    
    .card-content {
      padding: 12px;
      
      .card-title {
        font-size: 14px;
        font-weight: 600;
        color: $text-primary;
        line-height: 1.4;
        margin: 0 0 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 12px;
        color: $text-secondary;
        
        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          
          .el-icon {
            font-size: 14px;
          }
        }
      }
    }
  }
}
</style>
