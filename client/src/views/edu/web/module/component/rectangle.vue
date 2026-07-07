<template>
  <router-link class="course-card" :to="{path: link, query: {id: item.id}}">
    <div class="card-image">
      <img :src="item.image" :alt="item.name"/>
      <span class="live-badge" v-if="item.status === 'active'">
        <i class="icon-live"></i>直播中
      </span>
      <!-- 考试难度/类型标签 -->
      <span class="exam-tag" v-if="item.phrase && link && link.includes('exam')">
        {{ extractTag(item.phrase) }}
      </span>
    </div>
    <div class="card-content">
      <h3 class="card-title">{{item.name}}</h3>
      <!-- 显示简介 -->
      <p class="card-phrase" v-if="item.phrase">{{ extractPhrase(item.phrase) }}</p>
      <div class="card-footer">
        <span class="price">{{formatPrice(item.price) || "免费"}}</span>
        <span class="learn-count">{{item.learnNum || item.signUpNum || item.subscribeNum || 0}}人报名</span>
      </div>
    </div>
  </router-link>
</template>

<script>
  export default {
    name: "RectangleIndex",
    props: {
      item: {
        type: Object
      },
      isBoxBottom: {
        type: Boolean,
        default: false
      },
      width: {
        type: String,
        default: "200px"
      },
      rowFirstItem: {
        type: Boolean,
        default: false
      },
      link: {
        type: String,
        default: "/learn/detail"
      }
    },
    setup() {
      const formatPrice = (p) => {
        if (!p) {
          p = 0
        }
        if (p === 0) {
          return "免费"
        }
        return p.toFixed(2);
      }
      
      // 从phrase中提取标签（如：软考高级、NCRE二级等）
      const extractTag = (phrase) => {
        if (!phrase) return ''
        // 取第一个 | 之前的部分
        const parts = phrase.split('|')
        if (parts.length > 0) {
          return parts[0].trim()
        }
        return phrase.substring(0, 8)
      }
      
      // 从phrase中提取简介（| 后面的部分）
      const extractPhrase = (phrase) => {
        if (!phrase) return ''
        const parts = phrase.split('|')
        if (parts.length > 1) {
          return parts[1].trim()
        }
        return ''
      }
      
      return {
        formatPrice,
        extractTag,
        extractPhrase
      }
    }
  }
</script>

<style scoped lang="scss">
.course-card {
  display: block;
  background: #ffffff;
  border-radius: $border-radius;
  border: 1px solid $border-color;
  overflow: hidden;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    border-color: transparent;
    
    .card-title {
      color: $primary-color;
    }
    
    .card-image img {
      transform: scale(1.05);
    }
  }
  
  .card-image {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    background-color: #f5f5f5;
    
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
    
    .live-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      background-color: rgba(0, 0, 0, 0.6);
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      gap: 4px;
      
      .icon-live {
        display: inline-block;
        width: 16px;
        height: 16px;
        background: url("@/assets/edu/live.gif") center / contain no-repeat;
      }
    }
    
    .exam-tag {
      position: absolute;
      top: 10px;
      left: 10px;
      background: linear-gradient(135deg, $primary-color, #05a54d);
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      backdrop-filter: blur(4px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
  }
  
  .card-content {
    padding: 12px;
    
    .card-title {
      font-size: 14px;
      font-weight: 500;
      color: $text-primary;
      line-height: 1.5;
      height: 42px;
      margin: 0 0 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      transition: color 0.2s ease;
    }
    
    .card-phrase {
      font-size: 12px;
      color: $text-secondary;
      margin: 0 0 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.4;
    }
    
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .price {
        font-size: 14px;
        font-weight: 600;
        color: $primary-color;
      }
      
      .learn-count {
        font-size: 12px;
        color: $text-placeholder;
      }
    }
  }
}
</style>
