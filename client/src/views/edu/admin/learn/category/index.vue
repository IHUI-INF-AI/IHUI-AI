<template>
  <div class="app-container">
    <el-row>
      <el-col :span="6">
        <category-tree :current-node-key="currentNodeKey" class="tree" @node-click="handleNodeClick"/>
      </el-col>
      <el-col :span="18">
        <el-card class="box-card">
          <template #header>
            <div class="category-head clearfix">
              <span class="category-title">{{cardTitle}}</span>
              <el-button link size="small" class="category-btn" v-if="type !== 'edit' && category.id" @click="addChildren(category.id)">新增子类目</el-button>
              <el-button link size="small" class="category-btn" v-if="type !== 'edit' && category.id" @click="edit(category.pid, category)">编辑</el-button>
              <el-button link size="small" class="category-btn" v-if="type !== 'edit' && category.id" @click="remove(category)">删除</el-button>
              <el-button link size="small" class="category-btn" v-if="type !== 'edit'" @click="add(category.pid)">新增同级类目</el-button>
            </div>
          </template>
          <!-- 详情 -->
          <div class="table-wrapper" v-if="type === 'detail'">
            <table class="fl-table" v-if="!category.id">
              <tbody>
                <tr>
                  <td style="text-align: left; color: #999999;">请选择左边的分类查看详细信息</td>
                </tr>
              </tbody>
            </table>
            <table class="fl-table" v-else>
              <tbody>
                <tr><td width="20%">名称：</td><td>{{category.name}}</td></tr>
                <tr><td>显示/隐藏：</td><td><el-switch v-model="category.isShow" @change="changeIsShow(category)" active-color="#13ce66" :active-value="true" :inactive-value="false"></el-switch></td></tr>
                <tr><td>显示在首页：</td><td><el-switch v-model="category.isShowIndex" @change="changeIsShowIndex(category)" active-color="#13ce66" :active-value="true" :inactive-value="false"></el-switch></td></tr>
                <tr><td>排序：</td><td>{{category.sortOrder}}</td></tr>
                <tr><td>级别：</td><td>{{category.level}}</td></tr>
                <tr><td>图片：</td><td><img :src="category.image" alt=""/></td></tr>
              </tbody>
            </table>
          </div>
          <!-- 编辑 -->
          <div class="table-wrapper" v-else>
            <category-edit :edit-success="editSuccess" :edit-cancel="editCancel" :data="category" :pid="pid"/>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
// @ts-nocheck
  import router from "@/router";
  import CategoryEdit from "@/views/edu/admin/learn/category/edit.vue";
  import CategoryTree from "@/views/edu/admin/learn/category/tree.vue";
  import {ref} from "vue";
  import {useRoute} from "vue-router"
  import { learnApi } from '@/api/edu/admin-api'
const { getCategory, removeCategory } = learnApi;
  import {error, confirm, success, info} from "@/util/tipsUtils";
  export default {
    name: "LearnCategory",
    components: {
      CategoryTree,
      CategoryEdit
    },
    setup() {
      let cardTitle = ref("基础信息")
      const type = ref("detail")
      const pid = ref(0)
      const c = {
        pid: 0,
        name: "",
        image: "",
        sortOrder: 1,
        isShow: true,
        isShowIndex: true
      }
      let category = ref(c)
      const handleNodeClick = (data) => {
        getCategory(data.id, (res) => {
          if (!res) {
            error("没有找到该分类")
            return;
          }
          category.value = res;
          type.value = "detail";
        });
      }
      const route = useRoute();
      const currentNodeKey = ref(0)
      let id = route.query.id;
      if (id) {
        handleNodeClick({id: id});
        currentNodeKey.value = parseInt(id)
      }
      let beforeCategoryId;
      // 新增同级分类
      const add = (id) => {
        type.value = "edit";
        cardTitle.value = "新增同级分类";
        if (category.value.id) {
          beforeCategoryId = category.value.id
        }
        pid.value = id;
        c.pid = id
        category.value = c;
      }
      // 新增子分类
      const addChildren = (id) => {
        type.value = "edit";
        cardTitle.value = "新增子分类";
        if (category.value.id) {
          beforeCategoryId = category.value.id
        }
        pid.value = id;
        c.pid = id
        category.value = c;
      }
      // 编辑
      const edit = (id, item) => {
        type.value = "edit";
        cardTitle.value = "编辑";
        beforeCategoryId = item.id
        pid.value = id;
        category.value = item;
      }
      // 删除
      const remove = (category) => {
        if (category.children) {
          error("该类目下面存在子类目，不允许删除")
          return;
        }
        confirm("确定删除该目录?", "提示", () => {
          removeCategory(category.id, () => {
            success("删除成功")
            router.go(0);
          })
        }, () => {
          info("取消删除")
        });
      }
      const editSuccess = (id) => {
        if (id) {
          currentNodeKey.value = parseInt(id)
          handleNodeClick({id: id});
        }
      }
      const editCancel = () => {
        if (beforeCategoryId) {
          handleNodeClick({id: beforeCategoryId});
        } else {
          type.value = 'detail'
        }
        cardTitle.value = "基础信息";
      }
      return {
        cardTitle,
        type,
        pid,
        category,
        currentNodeKey,
        handleNodeClick,
        add,
        addChildren,
        edit,
        remove,
        editSuccess,
        editCancel
      }
    }
  };
</script>
<style scoped lang="scss">
  .app-container {
    margin: 20px;
    .tree {
      padding: 0 10px 0 0;
    }
    .box-card {
      // 组件特有样式（全局样式已处理 box-shadow、border、border-radius）
      :deep(.el-card) {
        border: 0;
        border-radius: 0;
        .el-card__header {
          padding: 2px 10px;
          font-size: 12px;
          border-bottom: 1px solid #f7f7f7;
          .category-head {
            line-height: 28px;
            .category-btn {
              float: right;
              margin-left: 10px;
              color: #606266;
              font-weight: normal;
              &:hover {
                color: var(--el-color-primary);
              }
            }
          }
        }
        .el-card__body {
          .fl-table {
            border-radius: 5px;
            font-size: 14px;
            font-weight: normal;
            border: none;
            border-collapse: collapse;
            width: 100%;
            background-color: white;
            tr {
              td {
                font-size: 12px;
                padding: 10px;
                img {
                  max-width: 500px;
                  max-height: 500px;
                }
              }
              td:nth-child(1) {
                text-align: right;
                vertical-align: top;
              }
            }
          }
        }
      }
      :deep(.el-form-item) {
        margin-bottom: 10px;
        .el-form-item__label {
          font-size: 12px;
        }
      }
      :deep(.el-input__inner), :deep(.el-input-number) {
        height: 34px;
        line-height: 34px;
        font-size: 12px;
        border-color: #f3f5f8;
        &:focus, &:hover {
          border-color: #f3f5f8;
        }
        .el-input-number__decrease, .el-input-number__increase {
          background: #FFFFFF;
          line-height: 32px;
          border: none;
          &:focus, &:hover {
            border-color: #f3f5f8;
          }
        }
      }
    }
  }
</style>
