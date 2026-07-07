<template>
  <div class="content-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="resource"/>
      </el-col>
      <el-col :span="20">
        <div class="resource-box" v-if="resourceList">
          <el-tabs v-model="activeTabName" @tab-click="tabClickHandle">
            <el-tab-pane label="我的知识" name="first" v-loading="resourceLoading">
              <div class="content-list">
                <resource-item :item-list="resourceList" :editable="true" :show-member="false" :callback="callback"></resource-item>
              </div>
              <page style="padding: 20px;" :page-size="params.size" :total="total" :current-change="currentChange" :size-change="sizeChange"></page>
              <resource-edit v-if="dialogVisible" v-model="dialogVisible" :cancel-callback="cancelResourceDialog" :submit-callback="submitResource"/>
            </el-tab-pane>
            <el-tab-pane label="下载记录" name="second" v-loading="downloadLoading">
              <div class="content-list">
                <resource-item :item-list="downloadList" :show-member="false"></resource-item>
              </div>
              <page style="padding: 20px;" :page-size="downloadParams.size" :total="downloadTotal" :current-change="downloadCurrentChange" :size-change="downloadSizeChange"></page>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {inject, ref} from "vue"
import MemberMenu from "@/views/edu/web/member/menu";
import {getMemberResourceList, deleteResource, getMemberDownloadResourceList} from "@/api/edu/web/resource";
import {confirm, success} from "@/util/tipsUtils";
import Page from "@/components/Page";
import router from "@/router";
import ResourceItem from "@/views/edu/web/resource/resourceItem";
import ResourceEdit from "@/views/edu/web/resource/edit";
import {getToken} from "@/util/tokenUtils";
export default {
  name: "MemberResourceIndex",
  components: {
    ResourceEdit,
    ResourceItem,
    Page,
    MemberMenu
  },
  setup() {
    const showLoginFlag = inject("showLogin")
    const showLoginClose = inject("showLoginClose")
    if (!getToken()) {
      showLoginFlag.value = true
      showLoginClose.value = false
      return
    }
    const activeTabName = "first"
    const tabClickHandle = (tab, event) => {
    }
    const params = ref({
      current: 1,
      size: 20,
      orders: ["create_time desc"]
    })
    const resourceLoading = ref(true)
    const resourceList = ref([])
    const total = ref(0)
    const loadResourceList = () => {
      resourceLoading.value = true
      getMemberResourceList(params.value, res => {
        resourceList.value = res.list
        total.value = res.total
        resourceLoading.value = false
      })
    }
    loadResourceList()
    const dialogVisible = ref(false)
    const cancelResourceDialog = () => {
      dialogVisible.value = false
    }
    const submitResource = () => {
      dialogVisible.value = false
      params.value.current = 1
      loadResourceList();
    }
    const selectResource = ref({})
    const edit = (item) => {
      selectResource.value = item
      dialogVisible.value = true
    }
    const removeResource = (item) => {
      confirm("确认删除知识 " + item.title + " 吗？", "提示", () => {
        deleteResource(item.id, () => {
          success("删除成功")
          loadResourceList()
        })
      }, () => {
      })
    }
    const currentChange = (currentPage) => {
      params.value.current = currentPage;
      loadResourceList();
    }
    const sizeChange = (s) => {
      params.value.size = s;
      loadResourceList();
    }

    const downloadParams = ref({
      current: 1,
      size: 20
    })
    const downloadLoading = ref(true)
    const downloadList = ref([])
    const downloadTotal = ref(0)
    const loadDownloadList = () => {
      downloadLoading.value = true
      getMemberDownloadResourceList(downloadParams.value, res => {
        downloadList.value = res.list
        downloadTotal.value = res.total
        downloadLoading.value = false
      })
    }
    loadDownloadList()
    const downloadCurrentChange = (currentPage) => {
      downloadParams.value.current = currentPage;
      loadDownloadList();
    }
    const downloadSizeChange = (s) => {
      downloadParams.value.size = s;
      loadDownloadList();
    }
    const goto = (path, id) => {
      if (id) {
        router.push({ path: path, query: { id: id } })
      } else {
        router.push({ path })
      }
    }
    const callback = () => {
      loadResourceList()
    }
    return {
      resourceList,
      activeTabName,
      params,
      total,
      tabClickHandle,
      resourceLoading,
      dialogVisible,
      cancelResourceDialog,
      submitResource,
      selectResource,
      edit,
      removeResource,
      downloadLoading,
      downloadList,
      currentChange,
      sizeChange,
      downloadCurrentChange,
      downloadSizeChange,
      downloadTotal,
      goto,
      callback,
      downloadParams
    }
  }
}
</script>

<style scoped lang="scss">
.content-container{
  .resource-box {
    background-color: #FFFFFF;
    margin: 20px;
    :deep(.el-tabs__nav-scroll) {
      padding: 0 20px;
    }
    :deep(.el-tabs__nav-wrap:after) {
      height: 0;
    }
    .card {
      background: #fff;
      box-sizing: border-box;
      border-radius: 0;
      overflow: visible;
      overflow: initial;
      position: relative;
      padding: 20px;
      margin-bottom: 0;
      -webkit-box-shadow: none;
      box-shadow: none;
      border-bottom: 1px solid #f0f2f7;
      &:first-child {
        padding-top: 0;
        .time {
          top: 0;
        }
      }
      .title {
        font-size: 18px;
        font-weight: 600;
        line-height: 1.9;
        color: #121212;
        margin-top: -4px;
        margin-bottom: -4px;
        cursor: pointer;
        width: calc(100% - 142px);
        &:hover {
          color: var(--el-color-primary);
        }
      }
      .time {
        position: absolute;
        top: 20px;
        right: 20px;
        color: #999;
      }
      .content {
        cursor: pointer;
        transition: color .14s ease-out;
        line-height: 1.97;
        .cover {
          position: relative;
          width: 190px;
          height: 105px;
          margin-top: -2px;
          margin-right: 18px;
          margin-bottom: 4px;
          float: left;
          overflow: hidden;
          background-position: 50%;
          background-size: cover;
          border-radius: 6px;
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          .cover-inner {
            position: absolute;
            top: 50%;
            left: 0;
            height: 100%;
            width: 100%;
            -webkit-transform: translateY(-50%);
            transform: translateY(-50%);
            overflow: hidden;
            img {
              position: absolute;
              top: 50%;
              left: 50%;
              height: 100%;
              width: 100%;
              -o-object-fit: cover;
              object-fit: cover;
              -webkit-transform: translate3d(-50%,-50%,0);
              transform: translate3d(-50%,-50%,0);
            }
          }
          &:after {
            content: "";
            position: absolute;
            z-index: 1;
            display: block;
            width: 100%;
            height: 100%;
            background: rgba(18,18,18,.02);
          }
        }
        .inner {
          margin-bottom: -4px;
          overflow: hidden;
          max-height: 100px;
          margin-top: 16px;
          .rich-text {
            pointer-events: none;
            line-height: 1.9;
            cursor: pointer;
            display: -webkit-box;
            white-space: normal;
            word-break: break-word;
            -webkit-line-clamp: 4;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .more {
            display: inline-block;
            font-size: 14px;
            text-align: center;
            cursor: pointer;
            margin-left: 4px;
            color: #175199;
            height: auto;
            padding: 0;
            line-height: inherit;
            background-color: transparent;
            border: none;
            border-radius: 0;
          }
          .more {
            float: right;
            margin-top: -26px;
            position: relative;
            background: #fff;
            &::after {
              content: "";
              position: absolute;
              display: block;
              top: 0;
              left: -30px;
              width: 30px;
              height: 100%;
              background: linear-gradient(
                      270deg, #fff, hsla(0, 0%, 100%, .2));
            }
          }
        }
        &:hover {
          .inner {
            .more {
              color: var(--el-color-primary);
            }
          }
        }
      }
      .show-more {
        .inner {
          height: auto;
          max-height: none;
          .rich-text {
            -webkit-line-clamp: inherit;
          }
        }
      }
      .actions {
        align-items: center;
        padding: 10px 20px;
        margin: 0 -20px -10px;
        color: #646464;
        clear: both;
        background: #fff;
        .action {
          margin-left: 24px;
          font-size: 14px;
          color: #646464;
          cursor: text;
          &:first-child {
            margin-left: 0;
          }
        }
        .float-right {
          float: right;
          cursor: pointer;
          &:hover {
            color: var(--el-color-primary);
          }
        }
      }
    }
    .download-item {
      .content {
        .inner {
          max-height: 52px;
          .rich-text {
            -webkit-line-clamp: 2;
          }
        }
      }
    }
  }
}
</style>
