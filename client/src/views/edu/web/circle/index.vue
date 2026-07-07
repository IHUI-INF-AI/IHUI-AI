<template>
  <div class="circle-box">
    <el-breadcrumb style="margin: 0 0 20px 0;" :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/edu/circle' }">社区</el-breadcrumb-item>
    </el-breadcrumb>
    <el-row :gutter="20">
      <el-col :span="4" class="nav-item-list">
        <a class="nav-item-warp">
          <div class="nav-item" :class="{'active': params.cid === 0 || !params.cid}" @click="changeMenu({id: 0})">
            <el-icon class="nav-item-icon"><House /></el-icon>
            <span class="nav-item-text">全部社区</span>
          </div>
          <div class="nav-item" :class="{'active': params.cid === item.id}" @click="changeMenu(item)" v-for="item in circleCategoryList" :key="item.id">
            <span class="nav-item-icon" :style="{ backgroundColor: getCategoryStyle(item.name).color }">
              <el-icon><component :is="getCategoryStyle(item.name).icon" /></el-icon>
            </span>
            <span class="nav-item-text">{{item.name}}</span>
          </div>
        </a>
      </el-col>
      <el-col :span="14">
        <div class="circle-content">
          <el-empty v-if="!(circleList && circleList.length)" style="background: #ffffff;border-radius: 6px;"/>
          <ul class="circle-list" v-else>
            <li v-for="item in circleList" :key="item.id" class="circle-item">
              <div class="card-container">
                <div class="outer">
                  <div class="container">
                    <div class="thumbnail">
                      <img :src="item.image || '/images/common/ai_default.svg'" 
                           @error="(e) => e.target.src='/images/common/ai_default.svg'" 
                           style="width: 100%;height: 100%;object-fit: cover;"/>
                    </div>
                    <div class="mask"></div>
                    <div class="content" @click="gotoDetail(item.id)">
                      <div class="content-header">
                        <div></div>
                        <div>
                          <el-icon class="icon" @click.stop="edit(item)" title="设置"><Setting /></el-icon>
                        </div>
                      </div>
                      <div class="content-desc">
                        {{item.introduction}}
                      </div>
                      <div class="content-footer">
                        <div class="name">{{item.name}}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          </ul>
          <div v-if="circleList && circleList.length">
            <page style="text-align: center;" :total="total" :size-change="sizeChange" :page-size="params.size" :current-change="currentChange"/>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="add-circle" @click="showCreateDialogVisible">
          <p><el-icon><Plus /></el-icon> 创建社区</p>
        </div>
        <div class="circle-hot" v-if="hotCircleList && hotCircleList.length">
          <p>热门社区</p>
          <ul v-loading="hotLoading" class="circle-hot-list">
            <li v-for="item in hotCircleList" :key="item.id" @click="gotoDetail(item.id)">
              <el-image :src="item.image">
                <template #error>
                  <svg t="1616121214661" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2652" width="60" height="60"><path d="M512 966.206061c-61.155556 0-120.50101-12.024242-176.355556-35.684849-53.915152-22.884848-102.4-55.466667-144.032323-97.09899S117.268687 743.434343 94.513131 689.519192c-23.660606-55.854545-35.684848-115.2-35.684848-176.355556s12.024242-120.50101 35.684848-176.355555C117.268687 282.763636 149.979798 234.278788 191.612121 192.646465c41.632323-41.632323 90.117172-74.343434 144.032323-97.09899 55.854545-23.660606 115.2-35.684848 176.355556-35.684849 61.155556 0 120.50101 12.024242 176.355556 35.684849 53.915152 22.884848 102.4 55.466667 144.032323 97.09899 41.632323 41.632323 74.343434 90.117172 97.09899 144.032323 23.660606 55.854545 35.684848 115.2 35.684848 176.355555s-12.024242 120.50101-35.684848 176.355556c-22.884848 53.915152-55.466667 102.4-97.09899 144.032323s-90.117172 74.343434-144.032323 97.09899c-55.854545 23.789899-115.2 35.684848-176.355556 35.684849z m0-859.79798C287.806061 106.408081 105.373737 288.840404 105.373737 513.034343S287.806061 919.660606 512 919.660606s406.626263-182.432323 406.626263-406.626263S736.193939 106.408081 512 106.408081z" fill="" p-id="2653"></path><path d="M512 813.252525c-78.092929 0-151.40202-30.383838-206.610101-85.591919C250.181818 672.581818 219.79798 599.143434 219.79798 521.050505c0-77.963636 30.383838-151.272727 85.462626-206.480808 55.078788-55.208081 128.258586-85.591919 206.222222-85.721212 12.8 0 23.272727 10.343434 23.272728 23.272727 0 12.8-10.343434 23.272727-23.272728 23.272727-135.111111 0.258586-245.139394 110.545455-245.139394 245.656566 0 135.49899 110.157576 245.656566 245.656566 245.656566s245.656566-110.157576 245.656566-245.656566v-0.517172c0-12.8 10.472727-23.272727 23.272727-23.272727s23.272727 10.472727 23.272727 23.272727v0.517172c0 78.092929-30.383838 151.40202-85.591919 206.610101C663.40202 782.868687 590.092929 813.252525 512 813.252525z" fill="" p-id="2654"></path><path d="M512 640.129293h-0.387879c-12.8-0.129293-23.143434-10.472727-23.143434-23.272727s10.472727-23.272727 23.272727-23.272728h0.258586c43.70101 0 79.256566-35.684848 79.256566-79.385858 0-43.830303-35.555556-79.385859-79.385859-79.385859s-79.385859 35.555556-79.385859 79.385859c0 1.939394 0.129293 3.878788 0.258586 5.818182 0.905051 12.8-8.662626 23.919192-21.591919 24.953535-12.8 0.905051-23.919192-8.662626-24.953535-21.591919-0.258586-3.10303-0.387879-6.206061-0.387879-9.179798 0-69.430303 56.50101-125.931313 125.931313-125.931313s125.931313 56.50101 125.931313 125.931313-56.242424 125.931313-125.672727 125.931313z m-0.129293 0z" fill="" p-id="2655"></path></svg>
                </template>
              </el-image>
              <div class="info-wrapper">
                <div class="published-dom title">{{item.name}}</div>
                <div class="published-dom desc">{{item.introduction}}</div>
              </div>
            </li>
          </ul>
        </div>
      </el-col>
    </el-row>
    <circle-edit :item="selectCircle" v-if="createDialogVisible" v-model="createDialogVisible" :cancel-callback="hideCreateDialogVisible" :submit-callback="submitCircle"/>
  </div>
</template>

<script>
import { useRouter, useRoute } from "vue-router"
import {ref, reactive, inject, markRaw} from "vue"
import { 
  ArrowRight, House, Setting, Plus,
  EditPen, Trophy, Tools, PictureFilled, 
  Cpu, DataLine, Connection, Reading
} from '@/lib/lucide-fallback'
import { getCircleList, getHotCircleList, getCircleCategoryList } from "@/api/edu/web/circle/index"
import Page from "@/components/Page/index";
import CircleEdit from "@/views/edu/web/circle/edit";
import {getToken} from "@/util/tokenUtils";
export default {
  name: "CircleIndex",
  components: {
    CircleEdit,
    Page,
    House,
    Setting,
    Plus,
    EditPen,
    Trophy,
    Tools,
    PictureFilled,
    Cpu,
    DataLine,
    Connection,
    Reading
  },
  setup() {
    const ArrowRightIcon = markRaw(ArrowRight)
    const router = useRouter()
    const route = useRoute()
    const loadingFlag = ref(false)
    const params = reactive({
      current: 1,
      size: 20,
      cid: 0,
      keyword: "",
      status: "published"
    })
    const cid = route.query.cid;
    if (cid) {
      params.cid = parseInt(cid);
    }
    const circleList = ref([])
    const total = ref(0)
    const loadList = () => {
      loadingFlag.value = true
      // 构建请求参数，cid 为 0 时不传该参数（表示查询全部）
      const requestParams = { ...params }
      if (requestParams.cid === 0 || !requestParams.cid) {
        delete requestParams.cid
      }
      getCircleList(requestParams, res => {
        loadingFlag.value = false
        circleList.value = res.list
        total.value = res.total
      }).catch(() => {
        loadingFlag.value = false
      })
    }
    loadList()
    const currentChange = (currentPage) => {
      params.current = currentPage;
      loadList();
    }
    const sizeChange = (s) => {
      params.size = s;
      loadList();
    }
    // 加载分类
    const circleCategoryList = ref([])
    getCircleCategoryList({fetchAll: true, id: 0}, res => {
      circleCategoryList.value = res
    })
    const createDialogVisible = ref(false)
    const showLoginFlag = inject("showLogin")
    // 显示添加社区的弹出层
    const showCreateDialogVisible = () => {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      createDialogVisible.value = true
    }
    const hideCreateDialogVisible = () => {
      createDialogVisible.value = false
    }
    const submitCircle = () => {
      hideCreateDialogVisible()
      loadList()
    }
    const selectCircle = ref()
    const edit = (item) => {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      selectCircle.value = item
      createDialogVisible.value = true
    }
    // 热门社区
    const hotCircleList = ref([])
    const hotLoading = ref(true)
    const hotParams = {
      current: 1,
      size: 5
    }
    getHotCircleList(hotParams, res => {
      hotLoading.value = false
      hotCircleList.value.push(...res.list);
    }).catch(() => {
      hotLoading.value = false
    })
    const gotoDetail = id => {
      router.push({path: "/edu/circle/detail", query: {id}})
    }
    const changeMenu = (item) => {
      params.cid = item.id;
      loadList()
    }
    // 根据分类名称返回对应的图标和颜色
    const getCategoryStyle = (name) => {
      const categoryMap = {
        'AIGC创作': { icon: 'EditPen', color: '#67c23a' },
        'AI认证考试': { icon: 'Trophy', color: '#e6a23c' },
        'AI开发工具': { icon: 'Tools', color: '#409eff' },
        'AI绘画与创作': { icon: 'PictureFilled', color: '#f56c6c' },
        '大模型应用': { icon: 'Cpu', color: '#9b59b6' },
        '深度学习': { icon: 'DataLine', color: '#00bcd4' },
        '机器学习': { icon: 'Connection', color: '#ff9800' },
        'AI基础入门': { icon: 'Reading', color: '#52c41a' }
      }
      return categoryMap[name] || { icon: 'Reading', color: '#909399' }
    }
    return {
      ArrowRight: ArrowRightIcon,
      circleList,
      currentChange,
      sizeChange,
      params,
      total,
      circleCategoryList,
      loadingFlag,
      submitCircle,
      showCreateDialogVisible,
      hotCircleList,
      gotoDetail,
      createDialogVisible,
      hotLoading,
      edit,
      hideCreateDialogVisible,
      changeMenu,
      selectCircle,
      getCategoryStyle
    }
  }
}
</script>

<style scoped lang="scss">
.circle-box {
  margin: 0 10px;
  box-sizing: border-box;
  position: relative;
  min-height: 500px;
  padding: 20px 0;
  border-radius: 10px;
  .nav-item-list {
    overflow-y: auto;
    border-radius: 6px 6px 0 0;
    -webkit-box-sizing: border-box;
    box-sizing: border-box;
    height: 100%;
    padding: 0 4px 40px;
    border-left: 1px solid #f9f9f9;
  }
  .nav-item-warp {
    .nav-item {
      position: relative;
      padding: 10px 16px;
      border-radius: 2px;
      cursor: pointer;
      color: #333;
      font-weight: 500;
      align-items: center;
      -webkit-box-align: center;
      display: flex;
      .nav-item-icon {
        width: 22px;
        height: 22px;
        min-width: 22px;
        margin-right: 12px;
        overflow: hidden;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        .el-icon {
          color: #fff;
          font-size: 14px;
        }
      }
      .nav-item-text {
        line-height: 20px;
        font-size: 14px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      &:hover {
        background-color: rgba(65,95,255, .1);
      }
    }
    .nav-item.active {
      .nav-item-icon {
        font-size: 20px;
        color: var(--el-color-primary);
      }
      .nav-item-text {
        font-size: 16px;
        color: var(--el-color-primary);
      }
    }
  }
  .circle-content {
    min-height: 500px;
    .circle-list {
      display: flex;
      flex-wrap: wrap;
      margin-left: -10px;
      min-height: 236px;
      .circle-item {
        width: 50%;
      }
      .card-container {
        width: calc(100% - 20px);
        padding: 10px;
        position: relative;
        .outer {
          position: relative;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          .container {
            height: 0;
            padding-bottom: 62.71186440677966%;
            position: relative;
            overflow: hidden;
            .thumbnail {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              pointer-events: none;
              background-color: #f7f7f7;
              background-position: bottom;
              background-repeat: no-repeat;
              background-size: 100% auto;
              bottom: 44px;
            }
            .mask {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              pointer-events: none;
              transition: all 0.3s cubic-bezier(0.44,0.9,0.6,0.94);
              transition-property: opacity,background-color;
              opacity: 1;
              background-color: rgba(0,0,0,0.1);
            }
            .content {
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              pointer-events: auto;
              .content-header {
                padding: 16px;
                display: flex;
                justify-content: space-between;
                pointer-events: all;
                .icon {
                  opacity: 0;
                  font-size: 24px;
                  margin-left: 12px;
                  color: #fff;
                  cursor: pointer;
                  transition: opacity 0.3s cubic-bezier(0.44,0.9,0.6,0.94);
                  display: inline-block;
                  line-height: 0;
                  text-align: center;
                  vertical-align: -0.25em;
                  &:hover {
                    opacity: 1;
                  }
                }
              }
              .content-desc {
                bottom: 44px;
                position: absolute;
                padding: 5px 16px;
                color: #fff;
                overflow: hidden;
                text-overflow: ellipsis;
                -webkit-box-orient: vertical;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                width: calc(100% - 32px);
                line-height: 24px;
                opacity: 0;
                &:hover {
                  opacity: 1;
                }
              }
              .content-footer {
                background-color: #fff;
                padding: 12px 16px;
                transition: height 0.3s cubic-bezier(0.44,0.9,0.6,0.94);
                .name {
                  font-size: 14px;
                  color: #373737;
                  font-weight: 600;
                  line-height: 20px;
                  max-height: 48px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
              }
            }
            &:not(.skeleton) {
              cursor: pointer;
              border-radius: 12px;
              box-shadow: 0 1px 1px rgb(38 38 38 / 10%);
              transition: all 0.5s cubic-bezier(0.44,0.9,0.6,0.94);
              transition-property: transform,box-shadow,background,border-color;
            }
          }
          &:hover {
            //box-shadow: 0 1px 1px rgb(38 38 38 / 14%);
            -webkit-backface-visibility: hidden;
            -moz-backface-visibility: hidden;
            -webkit-transform: translateZ(0) translateY(-4px);
            -moz-transform: translateZ(0) translateY(-4px);
            border-radius: 12px;
            .mask {
              background-color: rgba(38,38,38,0.7);
            }
            .content {
              .content-header {
                .icon {
                  opacity: 0.8;
                  &:hover {
                    opacity: 1;
                  }
                }
              }
              .content-desc {
                opacity: 1;
              }
            }
          }
        }
      }
    }
    .btn-wrap {
      margin-top: 30px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }
  .add-circle {
    border-radius: 6px;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    width: 100%;
    height: 40px;
    margin: 0 0 10px 0;
    background: #fff;
    cursor: pointer;
    background: var(--el-color-primary);
    border-color: var(--el-color-primary);
    p {
      color: #fff;
    }
    &:hover {
      background: var(--el-color-primary);
      border-color: var(--el-color-primary);
      p {
        color: #fff;
      }
    }
  }
  .circle-hot {
    min-height: 300px;
    .circle-hot-list {
      min-height: 198px;
      background: #ffffff;
      border-radius: 6px;
    }
    p {
      line-height: 46px;
      font-size: 16px;
      font-weight: 600;
      box-sizing: border-box;
      color: #333;
    }
    ul {
      box-sizing: border-box;
      li {
        margin-top: 10px;
        transition: all 0.3s;
        border: 1px solid rgba(0, 0, 0, .1);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 10px;
        box-sizing: border-box;
        min-height: 82px;
        background: #fff;
        &:hover {
          box-shadow: 0 0 5px #e5e7eb;
          transform: scale(1.05);
          .title {
            color: var(--el-color-primary);
          }
        }
        .el-image {
          width: 60px;
          height: 60px;
          min-width: 60px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .info-wrapper {
          flex: 1;
          margin-left: 10px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .published-dom {
          font-size: 14px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          line-height: 20px;
          color: #999999;
        }
        .title {
          font-size: 16px;
          color: #000000;
          -webkit-line-clamp: 1;
          line-clamp: 1;
          margin-bottom: 4px;
          font-weight: 500;
        }
        .desc {
          -webkit-line-clamp: 2;
          line-clamp: 2;
          font-size: 13px;
        }
      }
    }
  }
  :deep(.el-dialog-box) {
    .box-flex:nth-child(2) {
      max-height: 100px;
      overflow: hidden;
    }
    .box-flex {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      .el-input {
        flex: 1;
        margin-left: 6px;
      }
      .el-textarea {
        flex: 1;
        margin-left: 6px;
      }
      :deep(.el-upload) {
        border: 1px dashed #d9d9d9;
        border-radius: 6px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
      }
      .span-title {
        span {
          color: red;
        }
      }
    }
  }
}
.box-flex :deep(.el-upload) {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  width: 80px;
  height: 80px;
  .el-icon-plus {
    line-height: 80px;
    vertical-align: top;
  }
}
.box-flex :deep(.el-upload-list) {
  margin-left: 6px;
}
.box-flex :deep(.is-success),
.box-flex :deep(.is-uploading),
.box-flex :deep(.el-progress),
.box-flex :deep(.el-progress-circle) {
  width: 80px;
  height: 80px;
  overflow: hidden;
}
.box-flex :deep(.el-upload:hover) {
  border-color: var(--el-color-primary);
}
.box-flex-icon {
  font-size: 28px;
  color: #8c939d;
  width: 80px;
  height: 80px;
  line-height: 80px;
  text-align: center;
}
.avatar {
  width: 80px;
  height: 80px;
  display: block;
}
.box-flex :deep(.el-cascader__tags) {
  left: 10px;
}
.box-flex :deep(.is-success) {
  margin: 0;
}
:deep(.el-cascader) {
  width: 100%;
}
</style>
