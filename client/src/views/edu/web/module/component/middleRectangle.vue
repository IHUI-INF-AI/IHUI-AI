<template>
  <router-link class="g-col" :style="'width: ' + width" :to="{path:'/learn/detail', query: {id: item.id}}" :title="item.name">
    <img :src="item.image">
    <div class="g-pack-bg"></div>
    <!--          <span class="g-pack-rt">-->
    <!--            <span class="g-pack-tag g-pack-tag-red">热门</span>-->
    <!--          </span>-->
    <!--          <span class="g-pack-rb">-->
    <!--            <span>更新至第8</span>-->
    <!--          </span>-->
    <p class="g-pack-title">
      {{item.name}}
    </p>
    <div class="bottom clearfix">
      <span class="price">{{formatPrice(item.price) || "免费"}}</span>
      <span class="learn">{{item.learnNum || 0}}人报表</span>
    </div>
  </router-link>
</template>

<script>
  export default {
    name: "middleRectangle",
    props: {
      item: {
        type: Object
      },
      width: {
        type: String,
        default: "200px"
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
      return {
        formatPrice
      }
    }
  }
</script>

<style scoped lang="scss">
  .g-col {
    position: relative;
    background: #FFFFFF;
    box-shadow: 0 1px 1px 0 rgb(95 101 105 / 15%);
    border-radius: 8px;
    float: left;
    margin: 10px;
    display: inline-table;
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 2px 0 rgb(95 101 105 / 15%);
    }
    img {
      display: block;
      width: 100%;
      margin-bottom: 8px;
      border-radius: 8px 8px 0 0;
    }
    .g-pack-title {
      word-break: break-all;
      color: #545C63;
      line-height: 20px;
      height: 40px;
      margin-bottom: 8px;
      padding: 0 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow-wrap: break-word;
    }
    .bottom {
      font-size: 12px;
      color: #9199A1;
      line-height: 18px;
      padding: 0 8px;
      margin-bottom: 18px;
      .price {
        line-height: 20px;
        margin-right: 2px;
        color: var(--el-color-primary);
        float: left;
        font-weight: 700;
      }
      .learn {
        float: right;
      }
    }
    .clearfix:after {
      content: '\0020';
      display: block;
      height: 0;
      clear: both;
      visibility: hidden;
    }
  }
</style>
