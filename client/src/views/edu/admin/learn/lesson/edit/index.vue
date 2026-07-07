<template>
  <div class="app-container">
    <el-row>
      <el-col :span="20">
        <div v-if="showStep === 'base'" class="base">
          <el-form :model="lesson" :rules="lessonRules" ref="lessonRef" label-width="120px">
            <el-form-item label="名称：" prop="name">
              <el-input size="small" v-model="lesson.name" placeholder="请输入标题" class="custom-input" style="background-color: rgba(206, 203, 241, 0.25);"></el-input>
            </el-form-item>
            <el-form-item label="有效期：" prop="timeType">
              <el-radio-group v-model="lesson.timeType">
                <el-radio label="infinite" style="--el-color-primary: #8481eb; color: #413838;">永久有效</el-radio>
                <el-radio label="customize"  style="--el-color-primary: #8481eb; color: #413838;">自定义</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="开始时间：" prop="startTime" v-if="lesson.timeType !== 'infinite'">
              <el-date-picker
                v-if="showdatepicker"
                v-model="lesson.startTime"
                type="datetime"
                placeholder="选择开始时间"
                class="input-text"
                :default-time="new Date(2000, 0, 1, 0, 0, 0)"
                size="small"
                @change="changeStartTime"
                style="width: 100%;"></el-date-picker>
            </el-form-item>
            <el-form-item label="结束时间：" prop="endTime" v-if="lesson.timeType !== 'infinite'">
              <el-date-picker
                v-if="showdatepicker"
                v-model="lesson.endTime"
                type="datetime"
                placeholder="选择结束时间"
                class="input-text"
                :default-time="new Date(2000, 0, 1, 22, 0, 0)"
                size="small"
                @change="changeEndTime"
                style="width: 100%;"></el-date-picker>
            </el-form-item>
            <el-form-item label="分类：" prop="cidList">
              <el-cascader style="width: 100%;"
                           size="small"
                           v-model="selectCidList"
                           :props="{ multiple: true, checkStrictly: true }"
                           :options="categoryOptions"
                           @change="changeCategory">
              </el-cascader>
            </el-form-item>
            <el-form-item label="简介：" prop="phrase">
              <el-input size="small" v-model="lesson.phrase" placeholder="请输入简介"></el-input>
            </el-form-item>
            <el-form-item label="价格：" prop="price">
              <el-input-number class="input-number" v-model="lesson.price" placeholder="请输入价格" :precision="2" :step="1" :min="0"></el-input-number>
              <el-input-number class="input-number" v-model="lesson.originalPrice" placeholder="请输入原价" :precision="2" :step="1" :min="0"></el-input-number>
            </el-form-item>
            <el-form-item label="海报：" prop="image">
              <upload
                :class="{'no-plus': lesson.image}"
                :on-upload-success="onUploadImageSuccess"
                :on-upload-remove="onUploadImageRemove"
                :files="uploadData.files"
                :upload-url="uploadData.url"
                :limit="1"
                accept="image/jpeg,image/gif,image/png">
              </upload>
              <span class="upload-image-tips">图片建议：尺寸 1920 x 1200 像素，大小7M以下</span>
            </el-form-item>
            <el-form-item label="详情描述：" prop="introduction">
              <wang-editor v-if="loadWangEditorFlag" v-model="lesson.introduction"></wang-editor>
            </el-form-item>
            <div style="margin:50px auto;text-align: center;">
              <el-button size="small" @click="stepClick('content')" v-if="lesson.id">下一步</el-button>
              <el-button class="ql_bu" size="small" @click="submitBaseInfo">提交</el-button>
            </div>
          </el-form>
        </div>
        <div v-if="showStep === 'content'" class="content">
          <div class="content-header">
            <el-button size="small" @click="stepClick('base')">上一步</el-button>
            <el-button size="small" @click="stepClick('homework')">下一步</el-button>
            <el-button size="small" @click="showChapter">新增章节</el-button>
          </div>
          <div style="margin-top: 20px;">
            <el-table ref="table" @expand-change="handleExpandChange" :default-expand-all="false" :data="contentList" :show-header="false" :highlight-current-row="true" style="width: 100%">
              <el-table-column type="expand">
                <template #default="props">
                  <div v-if="props.row.phrase" class="tips">{{props.row.phrase}}</div>
                  <el-card class="box-card" v-for="section in props.row.chapterSectionList" :key="section.title">
                    <template #header>
                      <div class="clearfix" style="line-height: 28px;">
                        <span>{{section.title}}</span>
                        <span class="opt-btn">
                          <el-button link size="small" @click="section.isPreview = !section.isPreview">预览</el-button>
                          <el-button link size="small" @click="showChapterSection(props.row.id, section)">修改</el-button>
                          <el-button link size="small" @click="deleteChapterSection(section.id)">删除</el-button>
                        </span>
                      </div>
                    </template>
                    <div class="table-wrapper" :class="{'show': section.isPreview}">
                      <div v-if="section.phrase" class="tips">{{section.phrase}}</div>
                      <div class="video-box">
                        <video :src="section.url" controls="controls" :style="{'margin-top:20px;': !!section.phrase}"></video>
                      </div>
                    </div>
                  </el-card>
                </template>
              </el-table-column>
              <el-table-column prop="title" label="标题">
                <template #default="{ row }">
                  <div
                    class="expandable-cell"
                    @click="toggleRowExpansion(row)"
                  >
                    {{ row.title }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="240">
                <template #default="r">
                  <span class="opt-btn">
                    <el-button link @click="showChapterSection(r.row.id)" size="small">新增章节内容</el-button>
                    <el-button link @click="showChapter(r.row)" size="small">修改</el-button>
                    <el-button link @click="deleteChapter(r.row.id)" size="small">删除</el-button>
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
        <div v-if="showStep === 'homework'" class="homework">
          <el-form :model="homework" :rules="homeworkRules" ref="homeworkRef" label-width="120px">
            <el-form-item label="作业内容：" prop="content">
              <el-input size="small" type="textarea" v-model="homework.content" :rows="20" placeholder="请输入作业内容"></el-input>
            </el-form-item>
            <el-form-item label="作业附件：">
              <upload
                list-link
                :on-upload-success="onUploadHomeworkAttachmentSuccess"
                :on-upload-remove="onUploadHomeworkAttachmentRemove"
                :files="uploadHomeworkData.files"
                :upload-url="uploadHomeworkData.url"
                :limit="1"
                accept="image/*,video/*,audio/*,application/*">
              </upload>
            </el-form-item>
            <div style="margin:50px auto;text-align: center;">
              <el-button size="small" @click="stepClick('content')">上一步</el-button>
              <el-button size="small" @click="stepClick('exam')">下一步</el-button>
              <el-button size="small" @click="submitHomework">提交</el-button>
            </div>
          </el-form>
        </div>
        <div v-if="showStep === 'exam'" class="exam">
          <div class="exam-select">
            <div class="exam-select-main">
              <div class="exam-select-label">选择试卷：</div>
              <div class="exam-select-value" v-loading="baseLoading">{{examPaper && examPaper.id ? examPaper.title : '未选择'}}</div>
              <div class="exam-select-btn">
                <div>
                <el-button size="small" @click="showExamPaper">选择</el-button>
                </div>
                <div>
<!--                  <el-button size="small" @click="showPreview">预览</el-button>-->
                </div>
              </div>
            </div>
<!--            <el-dialog style="min-width: 840px" title="证书预览" v-model="showPreviewViewFlag" :before-close="hidePreview">-->
<!--              <div>-->
<!--                <certificate-preview v-if="showPreviewViewFlag" :download="false" :certificate="certificateTemplate" />-->
<!--              </div>-->
<!--              <template #footer>-->
<!--                <div class="dialog-footer">-->
<!--                  <el-button size="small" @click="hidePreview">取 消</el-button>-->
<!--                </div>-->
<!--              </template>-->
<!--            </el-dialog>-->
          </div>
          <div style="margin:50px auto;text-align: center;">
            <el-button size="small" @click="stepClick('homework')">上一步</el-button>
            <el-button size="small" @click="stepClick('certificate')">下一步</el-button>
            <el-button size="small" @click="submitExamPaper">提交</el-button>
          </div>
        </div>
        <div v-if="showStep === 'certificate'" class="certificate">
          <div class="certificate-select">
            <div class="certificate-select-main">
              <div class="certificate-select-label">选择证书：</div>
              <div class="certificate-select-value" v-loading="baseLoading">{{certificateTemplate && certificateTemplate.id ? certificateTemplate.name : '未选择'}}</div>
              <div class="certificate-select-btn">
                <div>
                  <el-button size="small" @click="showCertificateTemplate">选择</el-button>
                </div>
                <div>
                  <el-button size="small" @click="showPreview">预览</el-button>
                </div>
              </div>
            </div>
            <el-dialog style="min-width: 840px" title="证书预览" v-model="showPreviewViewFlag" :before-close="hidePreview">
              <div>
                <certificate-preview v-if="showPreviewViewFlag" :download="false" :certificate="certificateTemplate" />
              </div>
              <template #footer>
                <div class="dialog-footer">
                  <el-button size="small" @click="hidePreview">取 消</el-button>
                </div>
              </template>
            </el-dialog>
          </div>
          <div style="margin:50px auto;text-align: center;">
            <el-button size="small" @click="stepClick('exam')">上一步</el-button>
            <el-button size="small" @click="stepClick('publish')">下一步</el-button>
            <el-button size="small" @click="submitCertificateTemplate">提交</el-button>
          </div>
        </div>
        <div v-if="showStep === 'publish'" class="publish">
          <div class="publish-box">
            <div class="current-status" v-if="lesson.status">
              <el-alert :title="statusMap[lesson.status]" effect="dark" type="success" :closable="false" show-icon v-if="lesson.status === 'published'"></el-alert>
              <el-alert :title="statusMap[lesson.status]" effect="dark" type="warning" :closable="false" show-icon v-else-if="lesson.status === 'unpublished'"> </el-alert>
              <el-alert :title="statusMap[lesson.status]" effect="dark" type="error" :closable="false" show-icon v-else> </el-alert>
            </div>
            <div class="btn-list">
              <el-button size="small" @click="stepClick('certificate')">上一步</el-button>
              <el-button size="small" @click="publish" v-if="lesson.status === 'unpublished'">马上发布</el-button>
              <el-button size="small" @click="unPublish" v-if="lesson.status === 'published'">移入草稿</el-button>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="4" style="position: relative;">
        <el-affix :offset="60" class="affix">
          <div class="step-list">
            <div class="title">
              步骤导航
            </div>
              <el-steps class="steps" finish-status="success" direction="vertical" :active="stepActive">
                <el-step v-for="(step) in steps" :key="step.key" @click="stepClick(step.key)" :class="{'step-active': showStep === step.key}" :title="step.name"></el-step>
              </el-steps>
          </div>
          <div class="draggable" v-if="showStep === 'content'">
            <div class="title">
              章节目录（拖动排序）
            </div>
            <draggable class="item-list" v-model="contentList" chosen-class="chosen" force-fallback="true" group="item" animation="1000" @change="onDraggableChange">
              <transition-group>
                <div class="item" v-for="item in contentList" :key="item.id">
                  <div class="item-title">{{item.title}}</div>
                  <div class="sub-item-list" v-if="item.chapterSectionList && item.chapterSectionList.length">
                    <draggable v-model="item.chapterSectionList" chosen-class="chosen" force-fallback="true" group="sub-item" animation="1000" @change="onDraggableChange">
                      <div class="sub-item" v-for="subItem in item.chapterSectionList" :key="subItem.id">{{subItem.title}}</div>
                    </draggable>
                  </div>
                </div>
              </transition-group>
            </draggable>
          </div>
        </el-affix>
      </el-col>
    </el-row>
    <el-dialog title="编辑章节" v-model="showChapterDialog" :before-close="hideChapter">
      <el-form :model="lessonChapter" :rules="lessonChapterRules" ref="lessonChapterRef">
        <el-form-item label="标题：" label-width="120px" prop="title">
          <el-input size="small" v-model="lessonChapter.title" placeholder="请输入标题" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="简介：" label-width="120px" prop="phrase">
          <el-input size="small" v-model="lessonChapter.phrase" type="textarea" :rows="4" placeholder="请输入简介"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="hideChapter">取 消</el-button>
          <el-button size="small" type="primary" @click="submitChapter">确 定</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog title="编辑章节内容" v-model="showChapterSectionDialog" :before-close="hideChapterSection">
      <el-form :model="lessonChapterSection" :rules="lessonChapterSectionRules" ref="lessonChapterSectionRef">
        <el-form-item label="标题：" label-width="120px" prop="title">
          <el-input size="small" v-model="lessonChapterSection.title" placeholder="请输入标题" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="视频方式：" label-width="120px" prop="type">
          <el-radio v-model="lessonChapterSection.type" label="link">视频链接</el-radio>
          <el-radio v-model="lessonChapterSection.type" label="upload">视频上传</el-radio>
        </el-form-item>
        <el-form-item label="视频链接：" label-width="120px" prop="url" v-if="lessonChapterSection.type === 'link'">
          <el-input size="small" @blur="urlBlur" v-model="lessonChapterSection.url" placeholder="请输入视频地址" autocomplete="off"></el-input>
          <video ref="linkVideo" style="display: none;" :src="lessonChapterSection.url"></video>
        </el-form-item>
        <el-form-item label="视频上传：" label-width="120px" prop="url" v-else>
          <upload
            :on-before-upload="onBeforeUploadVideo"
            :on-upload-success="onUploadVideoSuccess"
            :on-upload-remove="onUploadVideoRemove"
            :files="uploadVideoData.files"
            :upload-url="uploadVideoData.url"
            :limit="1"
            listlink
            accept="audio/mp4,video/mp4">
          </upload>
        </el-form-item>
        <el-form-item label="视频时长：" label-width="120px" prop="totalTime">
          <el-input size="small" v-model="lessonChapterSection.totalTime" placeholder="请输入时长" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="简介：" label-width="120px" prop="phrase">
          <el-input size="small" v-model="lessonChapterSection.phrase" type="textarea" :rows="4" placeholder="请输入简介"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="hideChapterSection">取 消</el-button>
          <el-button size="small" type="primary" @click="submitChapterSection">确 定</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog class="custom-dialog" title="选择证书" v-model="showCertificateTemplateFlag" :before-close="hideCertificateTemplate" width="80%">
      <certificate-template-list :cancel-callback="hideCertificateTemplate" :select-callback="selectCertificateTemplate" :is-component="true"/>
    </el-dialog>
    <el-dialog class="custom-dialog" title="选择证书" v-model="showExamPaperFlag" :before-close="hideExamPaper" width="80%">
      <paper-list :is-component="true" :hide-component="hideExamPaper" :selection-change-callback="selectExamPaper"/>
    </el-dialog>
  </div>
</template>
<script>
// @ts-nocheck
import router from "@/router"
import WangEditor from "@/components/WangEditor/index.vue"
import Upload from "@/components/Uplaod/index.vue"
import {ref} from "vue"
import {useRoute} from "vue-router"
import {VueDraggableNext} from "vue-draggable-next"
import {success, confirm, error} from "@/util/tipsUtils"
import { learnApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree, getAllParent } = learnApi
import PaperList from "@/views/edu/admin/exam/paper/index.vue";
const { saveBaseInfo, updateBaseInfo, getBaseInfo, publishLesson, unPublishLesson, saveLessonChapter, updateLessonChapter, deleteLessonChapter, getLessonChapterList, updateSortOrder, saveLessonChapterSection, updateLessonChapterSection, deleteLessonChapterSection, saveHomework, updateHomework, getHomework, getLearnExamPaper, updateLearnExamPaper, updateLearnCertificate } = learnApi
import CertificateTemplateList from "@/views/edu/admin/certificate/template/index.vue";
import CertificatePreview from "@/views/edu/admin/certificate/preview/index.vue";

  export default {
  name: "LearnLessonEdit",
    components:{
      CertificatePreview,
      CertificateTemplateList,
      Upload,
      WangEditor,
      draggable: VueDraggableNext,
      PaperList
    },
    data() {
      return {
        expandedFlag: false,
        expandedRows: [], // 用于存储已展开的行
      };
    },
    methods: {
      // 自定义切换行展开
      toggleRowExpansion(row) {
        this.expandedFlag = true;
        const index = this.expandedRows.indexOf(row);
        if (index === -1) {
          this.expandedRows.push(row);
          this.$refs.table.toggleRowExpansion(row, true);
        } else {
          this.expandedRows.splice(index, 1);
          this.$refs.table.toggleRowExpansion(row, false);
        }
        this.expandedFlag = false;
      },
      handleExpandChange(row, expanded) {
        if (!this.expandedFlag) {
          if (expanded && expanded.length) {
            const index = this.expandedRows.indexOf(row);
            if (index === -1) {
              this.expandedRows.push(row);
            }
          } else {
            const index = this.expandedRows.indexOf(row);
            if (index !== -1) {
              this.expandedRows.splice(index, 1)
            }
          }
        }
        this.expandedFlag = false;
      }
    },
    setup() {
      const loadWangEditorFlag = ref(false)
      const route = useRoute()
      let isUpdate = !!route.query.id
      let showStep = ref("")
      const steps = [
        {key: "base", name: "基础信息"},
        {key: "content", name: "章节内容"},
        {key: "homework", name: "课后作业"},
        {key: "exam", name: "课程测评"},
        {key: "certificate", name: "关联证书"},
        {key: "publish", name: "发布状态"},
      ]
      const stepActive = ref(0)
      const loadStepActiveArray = () => {
        const stepActiveArray = [];
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          stepActiveArray.push(step.key);
          if (step.key === showStep.value) {
            stepActive.value = i;
            break;
          }
        }
        if (isUpdate) {
          stepActive.value = steps.length;
        }
        return stepActiveArray;
      }
      // 基本信息
      const uploadData = ref({
        url: '/api/v1/edu' + "/oss/learn/lesson/image",
        files: []
      })
      function getCurrentHour() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        return `${year}-${month}-${date} ${hour}:00:00`;
      }
      const infiniteDate = "2037-12-31 23:59:59";
      const categoryOptions = ref([])
      const selectCidList = ref([])
      const lesson = ref({
        id: "",
        name: "",
        startTime: getCurrentHour(),
        endTime: infiniteDate,
        price: 0,
        originalPrice: 0,
        image: "",
        cidList: [],
        phrase: "",
        introduction: "",
        timeType: "infinite"
      })
      const lessonRules = {
        name: [{ required: true, message: "请输入标题", trigger: "blur" }],
        startTime: [{ required: true, message: "请选择时间", trigger: "change" }],
        endTime: [{ required: true, message: "请选择时间", trigger: "change" }],
        phrase: [{ required: true, message: "请输入简介", trigger: "blur" }],
        price: [{ required: true, message: "请输入价格", trigger: "blur" }],
        cidList: [{ required: true, message: "请选择分类", trigger: "change" }],
        introduction: [{ required: true, message: "请输入描述", trigger: "blur" }],
        image: [{ required: true, message: "请选择海报", trigger: "change" }],
      }
      const baseLoading = ref(true)
      // 加载基本信息
      const loadBaseInfo = () => {
        let id = route.query.id;
        if (!id) {
          loadWangEditorFlag.value = true;
          return;
        }
        getBaseInfo(id, function (res) {
          baseLoading.value = false
          lesson.value = res;
          if (res && res.endTime) {
            if (res.endTime === infiniteDate) {
              lesson.value.timeType = 'infinite'
            } else {
              lesson.value.timeType = 'customize'
            }
          }
          selectCidList.value = getAllParent(categoryOptions.value, res.cidList);
          lesson.value.cidList = []
          uploadData.value.files = [
            {
              name: "海报",
              url: lesson.value.image
            }
          ]
          for (const valElement of selectCidList.value) {
            lesson.value.cidList.push(valElement[valElement.length - 1])
          }
          loadWangEditorFlag.value = true;

          // 获取证书
          certificateTemplate.value = lesson.value.certificate

          // 获取
          if (lesson.value && lesson.value.examPaperId) {
            loadLearnExamPaper(lesson.value.examPaperId);
          }
        })
      }
      const examPaper = ref(null)
      const loadLearnExamPaper = (paperId) => {
        if (!paperId) {
          return;
        }
        getLearnExamPaper({id: paperId}, res => {
          examPaper.value = res
        })
      }
      // 获取分类
      const loadCategory = () => {
        findCategoryList(0, true, (res) => {
          if (res && res.length) {
            categoryOptions.value = toTree(res);
            loadBaseInfo();
          }
        })
      }
      // 选择分类
      const changeCategory = (val) => {
        lesson.value.cidList = []
        for (const valElement of val) {
          lesson.value.cidList.push(valElement[valElement.length - 1])
        }
      }
      // 选择时间
      const changeStartTime = (val) => {
        lesson.value.startTime = val
      }
      // 选择时间
      const changeEndTime = (val) => {
        lesson.value.endTime = val
      }
      // 上传图片成功
      const onUploadImageSuccess = (res) => {
        lesson.value.image = res.data
      }
      // 删除图片
      const onUploadImageRemove = () => {
        lesson.value.image = ""
        uploadData.value.files = []
      }
      const parseDate = (dateStr) => {
        const str = dateStr.replace(' ', 'T');
        const safeDate = new Date(str);
        return safeDate
      }
      function toShanghaiISOString(date) {
        // 获取上海时区的偏移（东八区，偏移为 +480 分钟）
        const offset = 8 * 60;  // 上海时区是 UTC+8，转换为分钟（8 * 60）

        // 调整时间为上海时区
        const localDate = new Date(date.getTime() + offset * 60000);

        // 转换为 ISO 格式字符串
        return localDate.toISOString();
      }
      const showdatepicker = ref(true)
      // 提交基本信息
      const lessonRef = ref(null)
      const submitBaseInfo = () => {
        lessonRef.value.validate((valid) => {
          if (!valid) { return false }

          if (lesson.value.timeType === 'infinite') {
            lesson.value.startTime = parseDate(getCurrentHour());
            lesson.value.endTime = parseDate(infiniteDate);
          }

          if (isUpdate) {
            if(typeof lesson.value.startTime == "string") {
              lesson.value.startTime = parseDate(lesson.value.startTime);
            }
            if(typeof lesson.value.endTime == "string") {
              lesson.value.endTime = parseDate(lesson.value.endTime);
            }

            updateBaseInfo({...lesson.value,
              startTime: toShanghaiISOString(lesson.value.startTime),
              endTime: toShanghaiISOString(lesson.value.endTime)}, function (res) {
              showdatepicker.value = false
              showdatepicker.value = true
              if (res && res.id) {
                // lesson.value = res;
                getBaseInfo(res.id)
                success("编辑成功")
                showStep.value = "content";
                loadStepActiveArray()
                let path = route.fullPath;
                router.push({path, query: {id: lesson.value.id, step: "content"} });
              }
            })
          } else {
            saveBaseInfo(lesson.value, function (res) {
              if (res && res.id) {
                lesson.value = res;
                success("新增成功")
                showStep.value = "content";
                loadStepActiveArray()
                let path = route.fullPath;
                router.push({path, query: {id: lesson.value.id, step: "content"} });
              }
            })
          }
        })
      }

      // 内容
      const contentList = ref([])
      const showChapterDialog = ref(false)
      const lessonChapter = ref({
        id: "",
        lessonId: "",
        title: "",
        phrase: ""
      })
      const lessonChapterRules = {
        title: [{ required: true, message: "请输入标题", trigger: "blur" }],
      }
      const showChapterSectionDialog = ref(false)
      const lessonChapterSection = ref({
        id: "",
        lessonChapterId: "",
        type: "link",
        title: "",
        url: "",
        phrase: "",
        totalTime: ""
      })
      const lessonChapterSectionRules = ref({
        title: [{ required: true, message: "请输入标题", trigger: "blur" }],
        url: [{ required: true, message: "请输入视频地址", trigger: "blur" }],
        type: [{ required: true, message: "请选择类型", trigger: "change" }],
        totalTime: [{ required: true, message: "请输入时长", trigger: "blur" }]
      })
      const homework = ref({
        lessonId: "",
        content: "",
        attachment: "",
      })
      const uploadHomeworkData = ref({
        url: '/api/v1/edu' + "/oss/learn/homework/file",
        files: []
      })
      const loadContent = () => {
        let id = route.query.id;
        if (!id) { return; }
        getLessonChapterList({lessonId: id}, (res) => {
          if (res && res.list) {
            contentList.value = res.list;
          }
        })
        getHomework({lessonId: route.query.id}, (res) => {
          homework.value = res
          if (homework.value.url) {
            uploadHomeworkData.value.files = [
              {
                name: "作业附件",
                url: homework.value.url
              }
            ]
          }
        })
      }
      const showChapter = (chapter) => {
        showChapterDialog.value = true;
        if (chapter && chapter.id) {
          lessonChapter.value = chapter;
        } else {
          lessonChapter.value = {
            lessonId: lesson.value.id,
            id: "",
            title: "",
            phrase: ""
          }
        }
      }
      const hideChapter = () => {
        showChapterDialog.value = false;
        lessonChapter.value = {id: "", lessonId: "", title: "", phrase: ""}
      }
      const uploadVideoData = ref({
        url: '/api/v1/edu' + "/oss/learn/lesson/video",
        files: []
      })
      let videoLoaded = false;
      const showChapterSection = (lessonChapterId, chapterSection) => {
        showChapterSectionDialog.value = true;
        if (chapterSection && chapterSection.id) {
          lessonChapterSection.value = chapterSection;
          uploadVideoData.value.files = [
            {
              name: lessonChapterSection.value.title + ".mp4",
              url: lessonChapterSection.value.url
            }
          ]
        } else {
          videoLoaded = false
          lessonChapterSection.value = {
            lessonChapterId: lessonChapterId,
            id: "",
            title: "",
            url: "",
            phrase: "",
            type: "link",
            totalTime: ""
          }
        }
      }
      const hideChapterSection = () => {
        videoLoaded = false
        showChapterSectionDialog.value = false;
        lessonChapterSection.value = {
          id: "",
          lessonChapterId: "",
          title: "",
          url: "",
          phrase: "",
          type: "link",
          totalTime: ""
        }
      }
      const deleteChapter = (id) => {
        confirm("确认删除吗？", "提示", () => {
          deleteLessonChapter({id: id}, () => {
            success("删除成功")
            loadContent()
          })
        })
      }
      const deleteChapterSection = (id) => {
        confirm("确认删除吗？", "提示", () => {
          deleteLessonChapterSection({id: id}, () => {
            success("删除成功")
            loadContent()
          })
        })
      }
      const lessonChapterRef = ref(null)
      const submitChapter = () => {
        lessonChapterRef.value.validate((valid) => {
          if (!valid) { return false }
          if (lessonChapter.value.id) {
            updateLessonChapter(lessonChapter.value, function () {
              success("编辑成功")
              hideChapter()
              loadContent()
            })
          } else {
            saveLessonChapter(lessonChapter.value, function () {
              success("新增成功")
              hideChapter()
              loadContent()
              stepActive.value = steps.length;
              isUpdate = true;
            })
          }
        })
      }
      const linkVideo = ref(null)
      const urlBlur = () => {
        if (lessonChapterSection.value.type === "link") {
          linkVideo.value.addEventListener("loadedmetadata", () => {
            //时长为秒，小数，182.36
            lessonChapterSection.value.totalTime = linkVideo.value.duration;
            videoLoaded = true
          });
        }
      }
      const lessonChapterSectionRef = ref(null)
      const submitChapterSection = () => {
        if (lessonChapterSection.value.type === "link") {
          if (!lessonChapterSection.value.id && !videoLoaded) {
            error("正在计算视频时长，请稍后再试");
          }
        }
        lessonChapterSectionRef.value.validate((valid) => {
          if (!valid) { return false }
          if (lessonChapterSection.value.id) {
            updateLessonChapterSection(lessonChapterSection.value, function () {
              success("编辑成功")
              hideChapterSection()
              loadContent()
            })
          } else {
            saveLessonChapterSection(lessonChapterSection.value, function () {
              success("新增成功")
              hideChapterSection()
              loadContent()
            })
          }
        })
      }
      // 上传视频成功
      const onUploadVideoSuccess = (res) => {
        lessonChapterSection.value.url = res.data
        uploadVideoData.value.files = [
            {
              name: lessonChapterSection.value.title + ".mp4",
              url: res.data
            }
        ]
      }
      // 删除视频
      const onUploadVideoRemove = () => {
        lessonChapterSection.value.url = ""
        uploadVideoData.value.files = []
      }
      const onBeforeUploadVideo = (file) => {
        let videoUrl = URL.createObjectURL(file);
        let audioElement = new Audio(videoUrl);
        audioElement.addEventListener("loadedmetadata", () => {
          //时长为秒，小数，182.36
          lessonChapterSection.value.totalTime = audioElement.duration;
        });
      }
      // 拖拽事件
      const onDraggableChange = () => {
        const chapterList = []
        for (const content of contentList.value) {
          const subData = []
          if (content.chapterSectionList && content.chapterSectionList.length) {
            for (const sub of content.chapterSectionList) {
              subData.push({id: sub.id, list: []})
            }
          }
          chapterList.push({id: content.id, list: subData});
        }
        const params = {id: lesson.value.id, list: chapterList}
        updateSortOrder(params, () => {
          success("排序更新成功")
        })
      }
      // 作业
      const homeworkRef = ref(null)
      const homeworkRules = ref({
        content: [{ required: true, message: "请输入作业内容", trigger: "blur" }],
      })
      // 上传附件成功
      const onUploadHomeworkAttachmentSuccess = (res) => {
        homework.value.attachment = res.data
      }
      // 删除附件成功
      const onUploadHomeworkAttachmentRemove = () => {
        homework.value.attachment = ""
        uploadHomeworkData.value.files = []
      }
      const submitHomework = () => {
        homework.value.lessonId = route.query.id || lesson.value.id
        homeworkRef.value.validate((valid) => {
          if (!valid) {return false}
          if (homework.value.id) {
            updateHomework(homework.value, () => {
              success("编辑成功")
              showStep.value = "publish";
              let path = route.fullPath;
              router.push({path, query: {id: lesson.value.id, step: "publish"} });
            })
          } else {
            saveHomework(homework.value, (res) => {
              homework.value = res
              success("编辑成功")
              showStep.value = "publish";
              let path = route.fullPath;
              router.push({path, query: {id: lesson.value.id, step: "publish"} });
            })
          }
        })
      }
      // 发布页面
      const statusMap = {
        unpublished: "草稿箱",
        published: "已发布",
        deleted: "已删除"
      }
      const publish = () => {
        publishLesson({id: lesson.value.id}, () => {
          success("发布成功")
          lesson.value.status = "published"
        })
      }
      const unPublish = () => {
        unPublishLesson({id: lesson.value.id}, () => {
          success("取消发布成功")
          lesson.value.status = "unpublished"
        })
      }
      // 步骤条
      const init = () => {
        // 初始化加载
        if (route.query.step) {
          showStep.value = route.query.step;
        } else {
          showStep.value = "base"
        }
        lesson.value.id = route.query.id || ""
        loadCategory();
        loadContent();
      }
      init()
      // 步骤条点击切换
      const stepClick = (key) => {
        if (!isUpdate && loadStepActiveArray().indexOf(key) < 0) {
          return;
        }
        showStep.value = key;
        let path = route.fullPath;
        router.push({path, query: {id: lesson.value.id, step: key} });
      }
      loadStepActiveArray();

      // 证书
      const certificateTemplate = ref({})
      const showCertificateTemplateFlag = ref(false)
      const showCertificateTemplate = () => {
        showCertificateTemplateFlag.value = true
      }
      const hideCertificateTemplate = () => {
        showCertificateTemplateFlag.value = false
      }
      const selectCertificateTemplate = (val) => {
        if (val.length > 1) {
          error("只能选择一个证书");
          return
        }
        if (val.length > 0) {
          certificateTemplate.value = val[0]
          if (certificateTemplate.value) {
            lesson.value.certificateId = certificateTemplate.value.id
          }
        }
        hideCertificateTemplate()
      }
      const showPreviewViewFlag = ref(false);
      const showPreview = () => {
        if (!certificateTemplate.value || !certificateTemplate.value.id) {
          error("请先选择证书")
          return
        }
        showPreviewViewFlag.value = true;
      }
      const hidePreview = () => {
        showPreviewViewFlag.value = false;
      }
      const submitCertificateTemplate = () => {
        if (!certificateTemplate.value.id) {
          error("请先选择证书")
          return;
        }
        lesson.value.certificateId = certificateTemplate.value.id;
        updateLearnCertificate({id: lesson.value.id, certificateId: lesson.value.certificateId}, function (res) {
          if (res && res.id) {
            lesson.value = res;
            loadBaseInfo();
            success("关联证书成功")
          }
        })
      }

      // 考试
      const showExamPaperFlag = ref(false)
      const showExamPaper = () => {
        showExamPaperFlag.value = true
      }
      const hideExamPaper = () => {
        showExamPaperFlag.value = false
      }
      const selectExamPaper = (val) => {
        if (val.length > 1) {
          error("只能选择一个考试");
          return
        }
        if (val.length > 0) {
          lesson.value.examPaperId = val[0]
        }
        loadLearnExamPaper(lesson.value.examPaperId)
        hideExamPaper()
      }
      // const showPreviewViewFlag = ref(false);
      // const showPreview = () => {
      //   if (!ExamPaper.value || !ExamPaper.value.id) {
      //     error("请先选择证书")
      //     return
      //   }
      //   showPreviewViewFlag.value = true;
      // }
      // const hidePreview = () => {
      //   showPreviewViewFlag.value = false;
      // }
      const submitExamPaper = () => {
        if (!examPaper.value.id) {
          error("请先选择试卷")
          return;
        }
        lesson.value.examPaperId = examPaper.value.id;
        updateLearnExamPaper({id: lesson.value.id, examPaperId: lesson.value.examPaperId}, function (res) {
          if (res && res.id) {
            lesson.value = res;
            loadBaseInfo();
            success("关联试卷成功")
          }
        })
      }

      // 返回参数与方法
      return {
        examPaper,
        showExamPaperFlag,
        showExamPaper,
        hideExamPaper,
        selectExamPaper,
        submitExamPaper,
        showdatepicker,
        // 证书
        baseLoading,
        hidePreview,
        showPreview,
        showPreviewViewFlag,
        certificateTemplate,
        showCertificateTemplateFlag,
        showCertificateTemplate,
        hideCertificateTemplate,
        selectCertificateTemplate,
        submitCertificateTemplate,
        // 基本信息
        uploadData,
        categoryOptions,
        lesson,
        selectCidList,
        lessonRules,
        lessonRef,
        changeCategory,
        changeStartTime,
        changeEndTime,
        onUploadImageSuccess,
        onUploadImageRemove,
        submitBaseInfo,
        // 内容列表
        contentList,
        showChapterDialog,
        lessonChapter,
        lessonChapterRules,
        showChapterSectionDialog,
        lessonChapterSection,
        lessonChapterSectionRules,
        lessonChapterRef,
        lessonChapterSectionRef,
        showChapter,
        hideChapter,
        showChapterSection,
        hideChapterSection,
        deleteChapter,
        deleteChapterSection,
        submitChapter,
        submitChapterSection,
        uploadVideoData,
        linkVideo,
        urlBlur,
        onBeforeUploadVideo,
        onUploadVideoSuccess,
        onUploadVideoRemove,
        onDraggableChange,
        // 作业
        homework,
        homeworkRef,
        homeworkRules,
        uploadHomeworkData,
        submitHomework,
        onUploadHomeworkAttachmentSuccess,
        onUploadHomeworkAttachmentRemove,
        // 发布页面
        statusMap,
        publish,
        unPublish,
        // 步骤条
        steps,
        stepActive,
        showStep,
        stepClick,
        loadWangEditorFlag
      };
    }
  }
</script>
<style scoped lang="scss">
/* 使用 :deep() 穿透组件作用域 */
:deep(.custom-input .el-input__inner){
  background-color: rgba(206, 203, 241, 0.25);
  border-radius: 4px;
}
  .app-container {
    background-image: linear-gradient(to top right, #fdfdff, rgba(245, 240, 255, 0.99), #fdfdff);
    margin: 20px;
    .base {
      .upload-image-tips {
        font-size: 12px;
        color: #999999;
      }
      :deep(.el-upload--picture-card),
      :deep(.el-upload-list--picture-card .el-upload-list__item){
        //width: 100%;
        height: 62.5%;
        border: none;
        display: flex;
        margin: 0;
        min-height: 146px;
        justify-content: center;
        flex-direction: column;
        max-height: 400px;
        background-color: #ffffff;
      }
      .no-plus {
        :deep(.el-upload--picture-card){
          min-height: inherit;
          justify-content: inherit;
          flex-direction: inherit;
          display: none;
        }
        img {
          max-height: 460px;
        }
      }
      .input-number {
        margin-right: 20px;
      }
    }
    .content {
      position: relative;
      min-height: 500px;
      .content-header {
        text-align: right;
        :deep(.el-button){
          border-color: #f3f5f8;
        }
      }
      .tips {
        font-size: 12px;
        color: #999999;
        padding: 15px 20px;
      }
    }
    .publish {
      .publish-box {
        margin: 50px auto;
        text-align: center;
        .current-status {
          margin: 0 auto 20px;
          width: 180px;
        }
        .btn-list{
          margin: 0 auto;
          width: 180px;
          text-align: center;
        }
      }
    }
  }
  :deep(.el-input__inner), :deep(.el-input-number){
    height: 34px;
    line-height: 34px;
    font-size: 12px;
    border-color: #f3f5f8;
    //border: none;
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
  :deep(.el-textarea__inner){
    border-color: #f3f5f8;
    &:focus, &:hover {
      border-color: #f3f5f8;
    }
  }
  :deep(.el-cascader .el-input .el-input__inner:focus){
    border-color: #f3f5f8;
  }
  :deep(.el-input__icon){
    line-height: 34px;
    cursor: pointer;
    &:hover {
      color: var(--el-color-primary);
    }
  }
  :deep(.el-form-item__label){
    font-size: 12px;
  }
  :deep(.el-table th),
  :deep(.el-table td){
    padding: 5px 0;
    font-size: 12px;
    color: #000000;
  }
  :deep(.el-table--enable-row-hover .el-table__body tr:hover > td){
    background-color: #FFFFFF;
  }
  :deep(.el-table__body tr.current-row > td){
    background-color: #FFFFFF;
  }
  :deep(.el-button--text){
    color: #999999;
    font-size: 12px;
    &:hover {
      color: var(--el-color-primary);
    }
  }
  :deep(.el-cascader:not(.is-disabled):hover .el-input__inner){
    cursor: pointer;
    border-color: #f3f5f8;
  }
  .box-card {
    padding: 0 30px 10px;
    .el-card {
      box-shadow: none;
    }
    :deep(.el-card__header){
      padding: 5px 20px;
      font-size: 12px;
      border: 0;
    }
    :deep(.el-card__body){
      padding: 0;
      .table-wrapper {
        display: none;
        .video-box {
          padding: 0 20px 15px;
          display: flex;
          justify-content: center;
          video {
            background: #000;
            width: 320px;
            height: 240px;
          }
        }
      }
      .show {
        display: block;
      }
    }
  }
  .opt-btn {
    float: right;
    :deep(.el-button){
      margin: 0;
      padding: 5px;
    }
  }
  .affix {
    min-width: 140px;
    min-height: 720px;
    .step-list {
      padding: 10px 20px;
      .title {
        padding: 0 0 20px 0;
        font-size: 12px;
      }
      .steps {
        min-height: 160px;
        padding-left: 10px;
        :deep(.el-step__title){
          font-size: 14px;
        }
        :deep(.el-step__icon){
          width: 20px;
          height: 20px;
        }
        :deep(.el-step.is-vertical .el-step__head){
          width: 20px;
        }
        :deep(.el-step.is-vertical .el-step__title){
          cursor:pointer;
        }
        :deep(.el-step.is-vertical .el-step__line){
          width: 1px;
          left: 10px;
          top: 2px;
        }
        :deep(.el-step__icon.is-text){
          border-width: 1px;
          cursor:pointer;
        }
        :deep(.step-active .el-step__head.is-finish){
          color: red;
        }
      }
    }
    .draggable {
      padding: 10px 0 10px 10px;
      .title {
        padding: 10px 0 10px;
        font-size: 12px;
      }
      .item-list {
        padding: 0 0 0 10px;
        .item {
          font-size: 12px;
          line-height: 20px;
          padding: 5px 0;
          .sub-item-list {
            background: #ffffff;
            padding: 0 10px;
            border-radius: 4px;
            margin-top: 5px;
            .sub-item {
              line-height: 20px;
              padding: 5px 0;
              color: #666666;
              &:first-child {
                padding-top: 10px;
              }
              &:last-child {
                padding-bottom: 10px;
              }
            }
          }
        }
      }
    }
  }
  :deep(.el-upload--text){
    font-size: 12px;
  }
  :deep(.el-affix--fixed){
    z-index: 98;
  }
  :deep(.el-table__empty-block){
    line-height: 400px;
    .el-table__empty-text {
      line-height: 400px;
    }
  }
  .certificate {
    .certificate-select {
      margin: 40px 0 20px;
      .certificate-select-main {
        display: flex;
        align-items: center;
        justify-content: center;
        .certificate-select-label {

        }
        .certificate-select-value {

        }
        .certificate-select-btn {
          display: flex;
          margin-left: 20px;
        }
      }
    }
  }

  .exam {
    .exam-select {
      margin: 40px 0 20px;
      .exam-select-main {
        display: flex;
        align-items: center;
        justify-content: center;
        .exam-select-label {

        }
        .exam-select-value {

        }
        .exam-select-btn {
          display: flex;
          margin-left: 20px;
        }
      }
    }
  }

//穿透改颜色
:deep(.el-input__wrapper) {
  //background-color: #f2e9fb;
  background: rgba(255, 255, 255, 0.283);
  box-shadow: inset 6.64px -6.64px 6.64px 0px rgba(214, 214, 214, 0.326),inset -6.64px 6.64px 6.64px 0px rgba(255, 255, 255, 0.326);
}
//el-upload--picture-card
:deep(.el-upload) {
  //background-color: #f2e9fb;
  background: rgba(206, 203, 241, 0.25);
  border: 1px solid #B7B5CA;
}
.ql_bu{
  width: 130px;
  height: 45px;
  border-radius: 8px;
  background: linear-gradient(268deg, rgba(217, 219, 254, 0.65) -210%, rgba(217, 219, 254, 0.65) -150%, rgba(217, 219, 255, 0.65) -124%, rgba(217, 219, 254, 0.65) -34%, rgba(217, 219, 255, 0.65) -18%, rgba(144, 125, 255, 0.65) 218%, rgba(224, 225, 252, 0.65) 304%);
  border: 2px dashed #cbcdd3;
  color: #716d9e;
  box-sizing: border-box;
  border-width: 2px 2px 0px 2px;
  border-style: solid;
  border-color: #E0E1FC;

  backdrop-filter: blur(10px);
  box-shadow: inset 0px -6px 20px 0px rgba(255, 255, 255, 0.8);
}

//+-颜色
:deep(.el-input-number__increase) {
  background: rgba(206, 203, 241, 0.25);
}
:deep(.el-input-number__decrease) {
  //background-color: #f2e9fb;
  background: rgba(206, 203, 241, 0.25);
}

//右侧完成文字颜色
:deep(.is-process) {
  color: #8B91FF;
  .el-step__icon {
    color: #8B91FF;
    border: 1px solid #948cff;
    box-shadow:0 0 10px rgba(143, 135, 250, 0.5);
  }
}


</style>
