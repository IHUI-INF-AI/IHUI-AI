<template>
  <div>
    <div class="container">
      <div class="header">
        <el-form :inline="true" :model="params" class="demo-form-inline">
          <el-form-item label="">
            <el-input size="small" class="search-input" v-model="params.keyword" placeholder="请输入关键字"></el-input>
            <el-button size="small" class="search-btn" type="primary" @click="search">搜索</el-button>
          </el-form-item>
          <el-form-item label="类型" class="status">
            <el-select size="small" v-model="params.type" @change="search">
              <el-option label="全部" value=""></el-option>
              <el-option :label="key" :value="value" v-for="(key, value) in paperTypeMap" :key="value"></el-option>
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <div class="content">
        <el-table ref="multipleTable" :data="list" style="width: 100%;">
          <el-table-column type="expand">
            <template #default="scope">
              <el-card class="box-card">
                <template #header>
                  <div class="clearfix">
                    <span>基础信息</span>
                  </div>
                </template>
                <div class="table-wrapper">
                  <table class="fl-table" style="width: 100%;" v-if="scope.row.paper">
                    <tr><td>试卷名称：</td><td>{{scope.row.paper.title}}</td></tr>
                    <tr><td>难度：</td><td><el-rate :disabled="true" v-model="scope.row.paper.difficulty" :colors="colors"></el-rate></td></tr>
                    <tr><td width="120">答题开始时间：</td><td>{{scope.row.startTime}}</td></tr>
                    <tr><td width="120">答题结束时间：</td><td>{{scope.row.endTime}}</td></tr>
                    <tr><td>状态：</td><td>{{statusMap[scope.row.status]}}</td></tr>
                  </table>
                </div>
              </el-card>
            </template>
          </el-table-column>
          <el-table-column prop="examTitle" label="考试名称"></el-table-column>
          <el-table-column prop="paper.title" label="试卷名称"></el-table-column>
          <el-table-column label="试卷类型" width="80">
            <template #default="scope">
              {{paperTypeMap[scope.row.paper.type]}}
            </template>
          </el-table-column>
          <el-table-column prop="paper.score" label="总分" width="80"></el-table-column>
          <el-table-column prop="paper.passScore" label="合格分数" width="80"></el-table-column>
          <el-table-column prop="score" label="已得分数" width="80"></el-table-column>
          <el-table-column prop="endTime" label="提交时间" width="160"></el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="scope">
              <el-button class="right-btn" link @click="showMarkDialog(scope.row)" size="small">批改</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <page :total="total" :page-size="params.size" :current-change="pageChange" :size-change="sizeChange"></page>
    </div>
    <el-dialog title="批改试卷" v-model="showMarkDialogModel" :before-close="hideMarkDialog" width="90%">
      <div class="paper-question-list">
        <div class="paper-question" v-for="(item, index) in paperRecord.paper.questionList" :key="index">
          <div class="title">
            {{index + 1}}. {{formatTitle(item)}}
          </div>
          <div class="question-body">
            <div v-if="item.type === 'subjective'">
              <el-input :readonly="true" type="textarea" :rows="10" v-model="paperRecord.answer[item.type + '_' + item.id]"/>
            </div>
            <div v-if="item.type === 'fill_blank'">
              <div v-for="i in item.blankCount" :key="i" style="display: flex;margin: 10px 0;">
                <div style="width: 20px;padding: 0 10px;">{{i}}.</div>
                <el-input :readonly="true" size="small" v-model="paperRecord.answer[item.type + '_' + item.id + '_' + i]"/>
              </div>
            </div>
            <div v-else-if="item.options">
              <el-checkbox-group v-if="item.type === 'multi_choice'" v-model="paperRecord.answer[item.type + '_' + item.id]">
                <el-checkbox :disabled="true" :label="o.key" v-for="o in JSON.parse(item.options)" :key="o.key">{{o.key}}. {{o.value}}</el-checkbox>
              </el-checkbox-group>
              <div v-else v-for="o in JSON.parse(item.options)" :key="o.key">
                <el-radio :disabled="true" v-model="paperRecord.answer[item.type + '_' + item.id]" :label="o.key">{{o.key}}. {{o.value}}</el-radio>
              </div>
            </div>
            <div class="answer-box">
              <div class="answer-item">
                <div class="answer-info-label">结果：</div>
                <div class="answer-info-value">
                  <el-button style="padding: 3px 10px;" v-if="item.result" size="small" type="success">对</el-button>
                  <el-button style="padding: 3px 10px;" v-else size="small" type="danger">错</el-button>
                </div>
              </div>
              <div class="answer-item">
                <div class="answer-info-label">分数：</div>
                <div class="answer-info-value">{{item.score}}</div>
              </div>
              <div class="answer-item">
                <div class="answer-info-label">难度：</div>
                <div class="answer-info-value">
                  <el-rate :disabled="true" v-model="item.difficulty" :colors="colors"></el-rate>
                </div>
              </div>
              <div class="answer-item">
                <div class="answer-info-label">解析：</div>
                <div class="answer-info-value">
                  {{item.referenceAnswerNote}}
                </div>
              </div>
              <div class="answer-item">
                <div class="answer-info-label" style="vertical-align: top;">正确答案：</div>
                <div class="answer-info-value">
                  <div v-if="item.type === 'fill_blank'">
                    <div v-for="(blank, i) in item.referenceAnswer.split('[_]')" :key="i">
                      填空 {{i + 1}}. {{blank}}
                    </div>
                  </div>
                  <div v-else>
                    {{item.referenceAnswer}}
                  </div>
                </div>
              </div>
              <div class="answer-item" v-if="item.type !== 'subjective'">
                <div class="answer-info-label">得分：</div>
                <div class="answer-info-value" style="color: green;font-size: 20px;font-weight: 500;">{{item.scored || 0}}</div>
              </div>
              <div class="answer-item" v-else>
                <div class="answer-info-label" style="color: #e6a23c;">评分：</div>
                <div class="answer-info-value">
                  <el-input-number :precision="1" :step="1" :min="0" :max="item.score" size="small" v-model="answerMap[item.type + '_' + item.id]"/>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="main-bottom">
        <el-button size="small" type="primary" @click="submitMark">提交</el-button>
        <el-button size="small" @click="hideMarkDialog">取消</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
// @ts-nocheck
import {ref} from "vue"
import { examApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree } = examApi
const { manualMarkRecord, getMarkRecordList } = examApi
import Page from "@/components/Page/index.vue"
import {confirm, success} from "@/util/tipsUtils";

export default {
  name: "MarkList",
  components: {
    Page
  },
  setup() {
    const selectCidList = ref([])
    const commodityIdList = ref([])
    const categoryOptions = ref([])
    const list = ref([])
    const total = ref(0)
    const params = ref({
      keyword: "",
      cid: "",
      type: "",
      size: 20,
      current: 1
    })
    const colors = ["#99A9BF", "#F7BA2A", "#FF9900"]
    const paperTypeMap = {
      "normal": "静态试卷",
      "random": "随机试卷",
      "mock": "模拟试卷",
    }
    const statusMap = {
      "draft": "草稿",
      "submitted": "待批改",
      "passed": "已通过",
      "failed": "未通过",
      "deleted": "已删除"
    }
    // 加载分类
    const loadCategory = () => {
      findCategoryList(0, true, (res) => {
        if (res) {
          categoryOptions.value = toTree(res);
        }
      })
    }
    loadCategory()
    // 加载列表
    const answerMap = ref({})
    const loadList = () => {
      getMarkRecordList(params.value, (res) => {
        if (!res) {return;}
        for (const record of res.list) {
          record.paper = JSON.parse(record.paper)
          record.answer = JSON.parse(record.answer)
          if (record.paper.questionList && record.paper.questionList.length) {
            for (const question of record.paper.questionList) {
              if (question.type === "fill_blank") {
                let thisCount = 0;
                question.title.replace(/\[_\]/g, function () {
                  thisCount++;
                  return "[_]"
                });
                question.blankCount = thisCount
              } else if (question.type === "subjective") {
                answerMap[question.type + "_" + question.id] = 0
              }
            }
          }
        }
        list.value = res.list;
        total.value = res.total;
      })
    }
    loadList()
    // 搜索
    const search = () => {
      if (selectCidList.value && selectCidList.value.length) {
        params.value.cid = selectCidList.value[selectCidList.value.length - 1];
      }
      loadList();
    }
    const pageChange = (c) => {
      params.value.current = c;
      loadList();
    }
    const sizeChange =function(size){
      params.value.size = size;
      loadList();
    }
    const expandChange = (row, expandedRows) => {
      // 展开
      if(expandedRows.length>0) {
      }
    }
    const showMarkDialogModel = ref(false)
    const hideMarkDialog = () => {
      showMarkDialogModel.value = false
    }
    const paperRecord = ref()
    const showMarkDialog = (item) => {
      paperRecord.value = item
      showMarkDialogModel.value = true
    }
    const formatTitle = (item) => {
      if (item.type === "fill_blank") {
        let title = item.title
        for (let i = 0; i < item.blankCount; i++) {
          title = title.replace("[_]", "[__" + (i + 1) + "__]");
        }
        return title
      } else {
        return item.title
      }
    }
    const submitMark = () => {
      confirm("确认提交评分?", "提示", () => {
        manualMarkRecord({id: paperRecord.value.id, mark: JSON.stringify(answerMap.value)}, () => {
          success("评分成功")
          loadList()
          hideMarkDialog()
        })
      })
    }
    return {
      colors,
      paperTypeMap,
      statusMap,
      selectCidList,
      commodityIdList,
      categoryOptions,
      list,
      total,
      params,
      search,
      pageChange,
      sizeChange,
      expandChange,
      showMarkDialogModel,
      hideMarkDialog,
      showMarkDialog,
      paperRecord,
      formatTitle,
      answerMap,
      submitMark
    }
  }
};
</script>

<style  scoped lang="scss">
  .container {
    margin: 20px;
  }
  .image {
    height: 60px;
    display: inline-block;
  }
  .right-btn{
    margin: 5px 10px 5px 0;
  }
  .search-input {
    width: 242px;
  }
  :deep(.el-table-column--selection .cell){
    padding-left: 14px;
    padding-right: 14px;
  }
  :deep(.el-table tbody tr:hover > td){
    background-color: transparent;
  }
  .fl-table {
    tr:last-child, :deep(tr:last-child){
      td {
        border: 0;
      }
    }
  }
  .dialog-footer {
    text-align: center;
    margin-top: 40px;
  }
  .paper-question-list {
    .paper-question {
      padding: 20px 0;
      line-height: 36px;
      .question-body {
        :deep(.el-checkbox__input.is-disabled.is-checked .el-checkbox__inner){
          background-color: var(--el-color-primary);
        }
        :deep(.el-radio__input.is-disabled.is-checked .el-radio__inner){
          background-color: var(--el-color-primary);
        }
        :deep(.el-checkbox-group){
          .el-checkbox__label {
            color: #333;
          }
        }
        :deep(.el-radio__label){
          color: #333;
        }
      }
      .answer-box {
        margin-top: 20px;
        .answer-item {
          .answer-info-label {
            display: inline-block;
          }
          .answer-info-value {
            display: inline-block;
            :deep(.el-rate){
              line-height: 16px;
            }
          }
        }
      }
    }
  }
  .main-bottom {
    text-align: center;
    margin: 20px;
  }
</style>
