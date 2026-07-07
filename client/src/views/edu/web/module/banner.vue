<template>
  <div>
    <div class="banner" v-if="!showCarousel" :style="'height: ' + imgHeight + 'px'">
      <!--      <img src="@/assets/edu/bg.png" style="height: 100%;">-->
      <el-empty/>
    </div>
    <el-carousel v-if="showCarousel" class="banner" :interval="interval" :height="imgHeight + 'px'">
      <el-carousel-item class="carousel-item" v-for="item in carouselList" :class="{'no-cursor': item.linkType === '0'}" :key="item.imageUrl">
        <div v-if="item.linkType === '0'" class="carousel-img-box">
          <img ref="imageRef" :alt="item.title" :src="item.imageUrl"/>
        </div>
        <a target="_blank" :href="item.link" v-else>
          <img ref="imageRef" :alt="item.title" :src="item.imageUrl"/>
        </a>
      </el-carousel-item>
    </el-carousel>
  </div>
</template>

<script>
  import { ref, nextTick, watch } from "vue"
  export default {
    name: "CustomBanner",
    props: {
      height: {
        type: Number,
        default: 0
      },
      carousel: {
        type: Object
      }
    },
    setup(props) {
      let interval = ref()
      let carouselList = ref([])
      let showCarousel = ref(false)
      const imgHeight = ref(300)
      const imageRef = ref(null)
      const loadCarousel = function () {
        carouselList.value = props.carousel.carouselList;
        interval.value = props.carousel.interval * 1000;
        nextTick(function() {
          if (props.height) {
            imgHeight.value = props.height
          } else {
            // 获取窗口宽度*图片的比例，定义页面初始的轮播图高度
            imgHeight.value = document.body.clientWidth * (1/4)
            // 固定高度
            imgHeight.value = 300
          }
          showCarousel.value = true
        });
        if (!props.height) {
          // 监听窗口变化，使得轮播图高度自适应图片高度
          window.addEventListener("resize", () => {
            imgHeight.value = document.body.clientWidth * (1/4);
            // 固定高度
            imgHeight.value = 300
          });
        }
      }
      loadCarousel()
      watch(() => props.carousel, () => {
        if (props.carousel && props.carousel.interval) {
          loadCarousel()
        }
      })
      return {
        interval,
        carouselList,
        showCarousel,
        imgHeight,
        imageRef
      }
    }
  }
</script>

<style lang="scss" scoped>
  * {
    margin: 0;
    padding: 0;
  }
  .banner-box {
    :deep(.banner) {
      border-radius: 6px;
      overflow: hidden;
    }
  }
  .banner {
    min-height: 300px;
    border-radius: 6px;
    overflow: hidden;
    
    :deep(.el-carousel__container) {
      min-height: 300px;
      border-radius: 6px;
    }
    
    :deep(.el-carousel__indicators) {
      .el-carousel__button {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.5);
        
        &:hover {
          background-color: rgba(255, 255, 255, 0.8);
        }
      }
      
      .is-active .el-carousel__button {
        width: 24px;
        border-radius: 6px;
        background-color: #07c160;
      }
    }
  }
  .banner img {
    width: 100%;
    height: 100%;
    min-height: 300px;
    border-radius: 6px;
    object-fit: cover;
    display: block;
  }
  .carousel-item {
    width: 100%;
    height: 100%;
    background: white;
    cursor: pointer;
    border-radius: 6px;
    overflow: hidden;
    
    .carousel-img-box {
      width: 100%;
      height: 100%;
      border-radius: 6px;
      overflow: hidden;
      
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
    
    a {
      display: block;
      width: 100%;
      height: 100%;
    }
  }
  .no-cursor {
    cursor: default;
  }
</style>
