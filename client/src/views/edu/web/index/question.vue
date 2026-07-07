<template>
  <div class="question-section">
    <div class="module-mod-container">
      <div class="module-header">
        <div class="head">
          <h2 class="head-title">
            <div class="title">
              <span class="title-icon">
                <svg-icon name="ask"/>
              </span>
              <router-link :to="{path: 'ask'}">问答</router-link>
            </div>
          </h2>
        </div>
      </div>
      
      <div class="question-grid-layout" v-loading="questionLoading || hotQuestionLoading">
        <el-empty v-if="!isLoading && !hasAnyData" class="empty-state"/>
        
        <div v-show="hasAnyData" class="question-flex-container">
          <!-- 左侧：推荐问答 -->
          <div class="question-recommend-column" v-if="questions && questions.length">
            <div class="recommend-list">
              <div class="recommend-item" v-for="item in questions" :key="item.id">
                <div class="item-title-row">
                  <router-link :to="{path: '/edu/ask/question', query: {id: item.id}}" class="item-title" target="_blank">{{item.title}}</router-link>
                </div>
                <router-link :to="{path: '/edu/ask/question', query: {id: item.id}}" class="item-intro" target="_blank">{{item.content}}</router-link>
                <div class="item-meta">
                  <div class="author-info" v-if="item.member">
                    <el-image :src="item.member.avatar?.trim() || ''" alt="" class="author-avatar">
                      <template #error><div class="image-slot"></div></template>
                    </el-image>
                    <span class="author-name">{{item.member.name || ''}}</span>
                  </div>
                  <span class="create-time">{{item.createTime}}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧：热门问答网格 -->
          <div class="question-hot-column" v-if="(hotTopQuestion && hotTopQuestion.id) || (hotQuestions && hotQuestions.length)">
            <div class="hot-grid">
              <!-- 大卡片 (可选，如果 hotTopQuestion 有效) -->
              <router-link v-if="hotTopQuestion && hotTopQuestion.id" :to="{path: '/edu/ask/question', query: {id: hotTopQuestion.id}}" target="_blank" class="hot-item-big">
                <el-image v-if="hotTopQuestion.image && hotTopQuestion.image.trim()" :src="hotTopQuestion.image.trim()" class="item-img" fit="cover">
                  <template #error><div class="image-slot gradient-bg"></div></template>
                </el-image>
                <div v-else class="item-img gradient-bg"></div>
                <div class="item-overlay">
                  <div class="item-title">{{hotTopQuestion.title}}</div>
                  <div class="item-stats" v-if="hotTopQuestion.member">
                    <img :src="hotTopQuestion.member.avatar || ''" class="mini-avatar" v-if="hotTopQuestion.member.avatar">
                    <span>{{hotTopQuestion.member.name || ''}}</span>
                    <span class="divider"></span>
                    <span>{{hotTopQuestion.answerNum || 0}} 回答</span>
                  </div>
                </div>
              </router-link>

              <!-- 小卡片列表 -->
              <div class="hot-small-grid" v-if="hotQuestions && hotQuestions.length">
                <router-link :to="{path: '/edu/ask/question', query: {id: item.id}}" target="_blank" class="hot-item-small" v-for="item in hotQuestions" :key="item.id">
                  <el-image v-if="item.image && item.image.trim()" class="item-img" :src="item.image.trim()" fit="cover">
                    <template #error><div class="image-slot gradient-bg"></div></template>
                  </el-image>
                  <div v-else class="item-img gradient-bg"></div>
                  <div class="item-overlay">
                    <div class="item-title">{{item.title}}</div>
                    <div class="item-stats">{{item.answerNum || 0}} 回答</div>
                  </div>
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {ref, computed} from "vue";
import {getQuestionList} from "@/api/edu/web/ask";
import SvgIcon from "@/components/edu/SvgIcon.vue";

export default {
  name: "QuestionIndex",
  components: {SvgIcon},
  setup() {
    const questions = ref([])
    const params = ref({
      current: 1,
      size: 20
    })
    const questionLoading = ref(true)
    // 获取问题列表
    const loadQuestionList = () => {
      questionLoading.value = true
      getQuestionList(params.value, res => {
        questions.value = res.list || []
        questionLoading.value = false
      }).catch(() => {
        questionLoading.value = false
      }).finally(() => {
        // 确保无论如何都会结束loading状态
        questionLoading.value = false
      })
    }
    loadQuestionList()

    const hotQuestions = ref([])
    const hotTopQuestion = ref({})
    const hotParams = ref({
      current: 1,
      size: 7  // 获取7条：1条大卡片 + 6条小卡片
    })
    const hotQuestionLoading = ref(true)
    const loadHotQuestionList = () => {
      hotQuestionLoading.value = true
      getQuestionList(hotParams.value, res => {
        const list = res.list || []
        // 第一条作为大卡片显示
        if (list.length > 0) {
          hotTopQuestion.value = list[0]
          // 其余作为小卡片显示（最多6条）
          hotQuestions.value = list.slice(1, 7)
        } else {
          hotTopQuestion.value = {}
          hotQuestions.value = []
        }
        hotQuestionLoading.value = false
      }).catch(() => {
        hotQuestionLoading.value = false
      }).finally(() => {
        // 确保无论如何都会结束loading状态
        hotQuestionLoading.value = false
      })
    }
    loadHotQuestionList()

    // 判断是否正在加载
    const isLoading = computed(() => {
      return questionLoading.value || hotQuestionLoading.value
    })

    // 判断是否有任何数据可显示
    const hasAnyData = computed(() => {
      return (questions.value && questions.value.length > 0) || 
             (hotQuestions.value && hotQuestions.value.length > 0) ||
             (hotTopQuestion.value && hotTopQuestion.value.id)
    })

    return {
      questionLoading,
      questions,
      hotQuestionLoading,
      hotQuestions,
      hotTopQuestion,
      hasAnyData,
      isLoading
    }
  }
}
</script>

<style scoped lang="scss">
.question-section {
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
  }
  
  .question-grid-layout {
    padding: 20px;
    min-height: 200px;
    
    .empty-state {
      padding: 40px 0;
    }
  }
  
  .question-flex-container {
    display: flex;
    gap: 24px;
    position: relative;
    
    @media (max-width: 1024px) {
      flex-direction: column;
    }
  }
  
  .question-recommend-column {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 320px;
    border-right: 1px solid $border-color;
    padding-right: 24px;
    overflow-y: auto;
    
    // 自定义滚动条样式
    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-track {
      background: $bg-page;
      border-radius: 3px;
    }
    &::-webkit-scrollbar-thumb {
      background: #c0c4cc;
      border-radius: 3px;
      &:hover {
        background: #909399;
      }
    }
    
    @media (max-width: 1024px) {
      position: static;
      width: 100%;
      border-right: none;
      padding-right: 0;
      padding-bottom: 24px;
      border-bottom: 1px solid $border-color;
      max-height: 360px;
    }
    
    .recommend-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .recommend-item {
      padding-bottom: 20px;
      border-bottom: 1px solid $bg-page;
      
      &:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
      
      .item-title {
        display: block;
        font-size: 16px;
        font-weight: 600;
        color: $text-primary;
        margin-bottom: 10px;
        &:hover { color: $primary-color; }
      }
      
      .item-intro {
        display: block;
        font-size: 13px;
        color: $text-secondary;
        line-height: 1.6;
        margin-bottom: 12px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      .item-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        
        .author-info {
          display: flex;
          align-items: center;
          gap: 8px;
          
          .author-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
          }
          
          .author-name {
            font-size: 12px;
            color: $text-secondary;
          }
        }
        
        .create-time {
          font-size: 12px;
          color: $text-placeholder;
        }
      }
    }
  }
  
  .question-hot-column {
    flex: 1;
    min-width: 0;
    margin-left: 344px; // 320px宽度 + 24px间距
    
    @media (max-width: 1024px) {
      margin-left: 0;
    }
    
    .hot-grid {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .hot-small-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      
      @media (max-width: 1200px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 480px) { grid-template-columns: repeat(1, 1fr); }
    }
    
    .hot-item-big {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: $border-radius;
      overflow: hidden;
      display: block;
      
      .item-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s;
      }
      
      .item-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 20px 15px 12px;
        background: linear-gradient(transparent, rgba(0,0,0,0.85));
        color: #fff;
        
        .item-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 8px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .item-stats {
          font-size: 12px;
          opacity: 0.9;
          display: flex;
          align-items: center;
          gap: 8px;
          
          .mini-avatar {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            object-fit: cover;
          }
          
          .divider {
            width: 1px;
            height: 12px;
            background: rgba(255,255,255,0.4);
          }
        }
      }
      
      &:hover .item-img { transform: scale(1.05); }
    }
    
    .hot-item-small {
      position: relative;
      aspect-ratio: 4 / 3;
      border-radius: $border-radius;
      overflow: hidden;
      background-color: #f5f5f5;
      
      .item-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s;
      }
      
      .item-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 15px 10px 8px;
        background: linear-gradient(transparent, rgba(0,0,0,0.8));
        color: #fff;
        
        .item-title {
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 4px;
        }
        
        .item-stats {
          font-size: 11px;
          opacity: 0.8;
        }
      }
      
      &:hover .item-img { transform: scale(1.05); }
    }
    
    // 渐变背景占位（无图片时使用）
    .gradient-bg {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
  }
}
</style>
