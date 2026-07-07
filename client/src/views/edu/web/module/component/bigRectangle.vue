<template>
  <router-link class="big-course-card" :to="{path: (link || '/learn/detail'), query: {id: item.id}}">
    <div class="card-image">
      <img :src="item.image" :alt="item.name"/>
    </div>
    <div class="card-content">
      <h3 class="card-title">{{item.name}}</h3>
      <div class="card-footer">
        <span class="price">{{formatPrice(item.price) || "免费"}}</span>
        <span class="learn-count">{{item.learnNum || 0}}人报名</span>
      </div>
    </div>
  </router-link>
</template>

<script>
  export default {
    name: "bigRectangle",
    props: {
      item: {
        type: Object
      },
      width: {
        type: String,
        default: "400px"
      },
      link: {
        type: String,
        default: ""
      }
    },
    setup () {
      const formatPrice = (p) => {
        if (!p) {
          p = 0
        }
        if (p === 0) {
          return "免费"
        }
        return p.toFixed(2);
      }
      return {
        formatPrice
      }
    }
  }
</script>

<style scoped lang="scss">
.big-course-card {
  display: block;
  width: 100%;
  height: 100%;
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
    aspect-ratio: 3 / 4;
    overflow: hidden;
    background-color: #f5f5f5;
    
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
  }
  
  .card-content {
    padding: 12px;
    
    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: $text-primary;
      line-height: 1.5;
      height: 45px;
      margin: 0 0 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      transition: color 0.2s ease;
    }
    
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .price {
        font-size: 16px;
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
