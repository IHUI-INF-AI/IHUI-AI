<template>
  <div>
    <div class="content">
      <div class="interval-box">
        <span>轮播间隔({{interval}}S)</span>
        <el-slider v-model="interval" :min="2" :max="10"/>
      </div>
      <!--      <draggable v-model="carouselList" tag="ul" class="image-list" :animation="200" group="people" @start="drag = true" @end="drag = false">-->
      <ul class="image-list">
        <li v-for="(item, index) in carouselList" :key="index">
          <div class="image-list-header-box">
            <span>轮播图片 {{index + 1}}</span>
            <span v-if="isDeleteItem" @click="deleteItem(index)">删除</span>
          </div>
          <div class="choice-image">
            <choice-image :index="index" :item="item" @on-success="uploadCallback" @on-remove="uploadCallback"/>
          </div>
          <div class="choice-title">
            <el-input placeholder="请输入标题" v-model="item.title"/>
          </div>
          <div class="choice-link">
            <choice-link :index="index" :item="item" @change-link-type="changeLinkType" @change-link="changeLink"/>
          </div>
        </li>
      </ul>
      <!--      </draggable>-->
      <el-button class="add-btn" @click="addItem">添加图片</el-button>
      <div class="submit-btn">
        <el-button type="primary" @click="save">保存</el-button>
      </div>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
import {ref, reactive} from "vue";
import ChoiceImage from "./choiceImage.vue";
import ChoiceLink from "./choiceLink.vue";
import { settingApi } from '@/api/edu/admin-api'
const { saveCarousel, getCarousel } = settingApi;
import {success, error} from "@/util/tipsUtils";
import { ossApi } from '@/api/edu/admin-api'
const { deleteFile } = ossApi;
export default {
  name: "CarouselIndex",
  components: {
    ChoiceImage,
    ChoiceLink
  },
  setup() {
    const isDeleteItem = ref(true)
    // 轮播图Item
    const carouselItem = reactive({
      // 链接的标题
      title: "",
      // 图片地址
      imageUrl: "",
      // 链接类型
      linkType: "0",
      // 链接
      link: ""
    })
    // 轮播秒数间隔
    const interval = ref(3);
    // 轮播图列表
    const carouselList = ref([]);
    const load = () => {
      getCarousel({}, (res) => {
        const carouselJsonStr = res.carouselJson;
        if (carouselJsonStr) {
          const carousel = JSON.parse(carouselJsonStr);
          interval.value = carousel.interval;
          carouselList.value = carousel.carouselList;
        } else {
          carouselList.value.push(carouselItem)
        }
      })
    }
    load();
    // 添加图片
    const addItem = () => {
      isDeleteItem.value = true
      carouselList.value.push(carouselItem)
    }
    const deletedItem = [];
    // 删除图片
    const deleteItem = (index) => {
      deletedItem.push(carouselList.value[index])
      carouselList.value.splice(index, 1)
      isDeleteItem.value = carouselList.value.length > 1
    }
    // 图片回传
    const uploadCallback = (val) => {
      carouselList.value[val.index].imageUrl = val.link
    }
    // 链接
    const changeLink = (index, val) => {
      carouselList.value[index].link = val
    }
    // 链接类型
    const changeLinkType = (index, val) => {
      carouselList.value[index].linkType = val
    }
    // 保存
    const save = () => {
      for (let i = 0; i < carouselList.value.length; i++) {
        const item = carouselList.value[i]
        if (!item.imageUrl) {
          error("请添加图片"+ (i + 1) +"的图片")
          return
        }
        if (item.linkType !== "0") {
          if (item.link === "") {
            error("请输入图片"+ (i + 1) +"的链接")
            return
          }
        } else {
          item.link = ""
        }
      }
      const param = {}
      param.interval = interval.value
      param.carouselList = carouselList.value
      saveCarousel({ carouselJson: JSON.stringify(param) }, () => {
        success("保存成功")
        // 删除被删除的图片
        for (let i = 0; i < deletedItem.length; i++) {
          const item = deletedItem[i];
          if (item.link && item.link.indexOf("http://") > -1) {
            deleteFile(item.link);
          }
        }
        setTimeout(() => {location.reload()}, 500)
      })
    }
    return {
      isDeleteItem,
      // 轮播图Item
      carouselItem,
      // 轮播秒数间隔
      interval,
      // 轮播图列表
      carouselList,
      load,
      addItem,
      deleteItem,
      uploadCallback,
      changeLink,
      changeLinkType,
      save
    }
  }
}
</script>

<style lang="scss" scoped>
.content {
  padding: 0 50px;
  .interval-box {
    height: 40px;
    align-items: center;
    font-size: 14px;
    margin-top: 20px;
    display: flex;
    span {
      margin-right: 20px;
    }
    .el-slider {
      width: calc(100% - 108px);
    }
  }
  .add-btn {
    width: 100%;
  }
  .image-list {
    width: 100%;
    margin-top: 20px;
    margin-bottom: 20px;
    li {
      width: 100%;
      min-height: 195px;
      border: 1px solid #dcdfe6;
      border-radius: 8px;
      margin-bottom: 20px;
      .image-list-header-box {
        height: 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        padding: 0 20px;
        box-sizing: border-box;
        border-bottom: 1px solid #dcdfe6;
        span:last-child {
          font-size: 13px;
          color: #409eff;
          cursor: pointer;
        }
      }
      .choice-image {
        height: 100%;
      }
      .choice-title {
        margin: 0 20px 20px;
      }
    }
  }
  .submit-btn {
    text-align: center;
    margin: 20px 0;
  }
}
.choice-link {
  margin-bottom: 10px;
}
.el-dialog__wrapper :deep(.el-dialog__body){
  padding: 10px 20px;
}
</style>
