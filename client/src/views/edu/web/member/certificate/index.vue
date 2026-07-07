<template>
  <div class="cert-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="certificate"/>
      </el-col>
      <el-col :span="20">
        <div class="cert-wrap">
          <div class="cert-header">
            <el-form :inline="true" :model="params" class="form-inline">
              <el-form-item label="证书名称">
                <el-input size="small" @keydown.enter="search" class="search-input" v-model="params.name" placeholder="请输入证书名称"></el-input>
              </el-form-item>
              <el-form-item label="证书编号">
                <el-input size="small" @keydown.enter="search" class="search-input" v-model="params.code" placeholder="请输入证书编号"></el-input>
              </el-form-item>
              <el-form-item label="状态" class="select">
                <el-select size="small" v-model="params.status" @change="search">
                  <el-option label="全部" value=""></el-option>
                  <el-option label="有效" value="valid"></el-option>
                  <el-option label="暂停" value="suspended"></el-option>
                  <el-option label="撤销" value="revoked"></el-option>
                  <el-option label="注销" value="cancelled"></el-option>
                  <el-option label="失效" value="expired"></el-option>
                  <el-option label="删除" value="deleted"></el-option>
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button size="small" @click="search()">
                  <span style="vertical-align: middle">搜索</span>
                </el-button>
              </el-form-item>
            </el-form>
          </div>
          <div class="cert-main" v-loading="dataLoading">
            <el-table :data="certificateList">
              <el-table-column label="序号" type="index"></el-table-column>
              <el-table-column label="证书编码" prop="code"></el-table-column>
              <el-table-column label="会员名称" prop="member.name"></el-table-column>
              <el-table-column label="关联课程" prop="lesson.name"></el-table-column>
              <el-table-column label="证书名称" prop="name"></el-table-column>
      <!--        <el-table-column label="证书描述" prop="description"></el-table-column>-->
              <el-table-column label="颁发机构" prop="awardingOrganization"></el-table-column>
              <el-table-column label="颁发日期" prop="awardDate"></el-table-column>
      <!--        <el-table-column label="颁发人员" prop="awarderName"></el-table-column>-->
      <!--        <el-table-column label="颁发条件" prop="awardConditions"></el-table-column>-->
      <!--        <el-table-column label="到期策略" prop="validityPolicy"></el-table-column>-->
              <el-table-column label="状态" prop="statusName"></el-table-column>
              <el-table-column label="操作">
                <template #default="scope">
                  <div class="opt-btn-wrap">
                    <div class="opt-btn-item">
                      <el-button size="small" @click="showPreview(scope.row)">预览</el-button>
                    </div>
                    <div class="opt-btn-item">
                      <el-button size="small" @click="download(scope.row)">下载</el-button>
                    </div>
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <page :total="total" :size-change="sizeChange" :current-change="currentChange" :page-size="params.size"/>
          </div>
          <el-dialog style="min-width: 1163px; min-height: 854px;" title="证书预览" v-model="showPreviewViewFlag" :before-close="hidePreview">
            <div>
              <certificate-preview v-if="showPreviewViewFlag" :download="false" :certificate="previewCertificate" />
            </div>
            <template #footer>
              <div class="dialog-footer">
                <el-button size="small" @click="hidePreview">关闭</el-button>
              </div>
            </template>
          </el-dialog>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {ref} from "vue"
import Page from "@/components/Page";
import {
  findCertificateList
} from "@/api/edu/web/certificate";
import CertificatePreview from "@/views/edu/web/learn/certificate/index.vue";
import MemberMenu from "@/views/edu/web/member/menu/index.vue";
// import router from "@/router";
export default {
  name: "CertificateIndex",
  components: {MemberMenu, CertificatePreview, Page},
  setup() {
    const dataLoading = ref(true)
    const certificateList = ref([])
    const params = ref({
      current: 1,
      size: 20,
      neqStatusList: ["deleted"]
    })
    const loadList = () => {
      findCertificateList(params.value, res => {
        if (res) {
          total.value = res.total;
          certificateList.value = res.list;
        }
        dataLoading.value = false
      }).catch(() => {
        dataLoading.value = false
      })
    }
    loadList()
    const total = ref(0)
    const currentChange = (c) => {
      params.value.current = c;
      loadList();
    }
    const sizeChange = (s) => {
      params.value.size = s;
      loadList();
    }
    const search = () => {
      loadList();
    }

    const previewCertificate = ref({})
    const showPreviewViewFlag = ref(false);
    const showPreview = (item) => {
      showPreviewViewFlag.value = true;
      previewCertificate.value = item
    }
    const hidePreview = () => {
      showPreviewViewFlag.value = false;
    }

    const download = (item) => {
      // router.push({path: "/certificate/download", query: {id: item.id}})
      window.open("/edu/learn/certificate/download?id=" + item.id, '_blank');
    }

    return {
      download,
      previewCertificate,
      showPreviewViewFlag,
      showPreview,
      hidePreview,
      dataLoading,
      search,
      params,
      total,
      currentChange,
      sizeChange,
      certificateList,
    };
  }
};
</script>

<style scoped lang="scss">
  .cert-wrap {
    margin: 20px;
    font-size: 12px;
    .cert-main {
      :deep(.el-table) {
        font-size: 12px;
        .el-table__empty-block {
          line-height: 400px;
          .el-table__empty-text {
            line-height: 400px;
          }
        }
        th, td {
          padding: 6px 0;
        }
      }
    }
  }
  .opt-btn-wrap {
    //display: flex;
  }
  .opt-btn-item {
    width: 50%;
    display: inline-block;
    margin: 2px 0;
  }
</style>
