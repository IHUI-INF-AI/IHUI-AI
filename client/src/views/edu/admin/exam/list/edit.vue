<template>
  <div class="app-container">
    <div class="flex flex-wrap gap-5">
      <div class="w-5/6" style="border-right: 1px solid #dddddd;margin-top: 10px;">
        <div v-if="showStep === 'base'">
          <form ref="examRef" @submit.prevent>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-28 shrink-0 text-sm font-medium text-foreground">名称：</label>
              <div class="flex-1">
                <Input size="small" v-model="exam.name" placeholder="请输入标题"></Input>
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-28 shrink-0 text-sm font-medium text-foreground">开始时间：</label>
              <div class="flex-1">
                <Input
                  type="datetime-local"
                  v-model="exam.startTime"
                  placeholder="选择开始时间"
                  class="input-text"
                  size="small"
                  @change="changeStartTime"
                  style="width: 100%;" />
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-28 shrink-0 text-sm font-medium text-foreground">结束时间：</label>
              <div class="flex-1">
                <Input
                  type="datetime-local"
                  v-model="exam.endTime"
                  placeholder="选择结束时间"
                  class="input-text"
                  size="small"
                  @change="changeEndTime"
                  style="width: 100%;" />
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-28 shrink-0 text-sm font-medium text-foreground">分类：</label>
              <div class="flex-1">
                <Select style="width: 100%;"
                        size="small"
                        multiple
                        v-model="selectCidList"
                        @change="changeCategory">
                  <SelectOption v-for="item in flatCategoryOptions" :key="item.value" :label="item.label" :value="item.value" />
                </Select>
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-28 shrink-0 text-sm font-medium text-foreground">简介：</label>
              <div class="flex-1">
                <Input size="small" v-model="exam.phrase" placeholder="请输入简介"></Input>
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-28 shrink-0 text-sm font-medium text-foreground">海报：</label>
              <div class="flex-1">
                <upload
                  :on-upload-success="onUploadImageSuccess"
                  :on-upload-remove="onUploadImageRemove"
                  :files="uploadData.files"
                  :upload-url="uploadData.url"
                  :limit="1"
                  accept="image/jpeg,image/gif,image/png">
                </upload>
                <span class="upload-image-tips">图片建议：尺寸 1920 x 1200 像素，大小7M以下</span>
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-28 shrink-0 text-sm font-medium text-foreground">详情描述：</label>
              <div class="flex-1">
                <wang-editor v-if="loadWangEditorFlag" v-model="exam.introduction"></wang-editor>
              </div>
            </div>
            <div style="margin:50px auto;text-align: center;">
              <Button size="sm" variant="outline" @click="stepClick('content')" v-if="exam.id">下一步</Button>
              <Button size="sm" variant="outline" @click="submitBaseInfo">提交</Button>
            </div>
          </form>
        </div>
        <div v-if="showStep === 'content'" class="content">
          <div class="content-header">
            <Button size="sm" variant="outline" @click="stepClick('base')">上一步</Button>
            <Button size="sm" variant="outline" @click="stepClick('publish')">下一步</Button>
            <Button size="sm" variant="outline" @click="showChapter">新增章节</Button>
          </div>
          <div style="margin-top: 20px;">
            <Table class="w-full">
              <TableBody>
                <template v-for="(row, index) in contentList" :key="row.id ?? index">
                  <TableRow>
                    <TableCell>
                      <button @click="toggleExpand(index)">{{ expandedRows.has(index) ? '▼' : '▶' }}</button>
                    </TableCell>
                    <TableCell>{{ row.title }}</TableCell>
                    <TableCell>
                      <span style="float: right;">
                        <Button variant="link" @click="showChapterSection(row.id)" size="sm">新增章节内容</Button>
                        <Button variant="link" @click="showChapter(row)" size="sm">修改</Button>
                        <Button variant="link" @click="deleteChapter(row.id)" size="sm">删除</Button>
                      </span>
                    </TableCell>
                  </TableRow>
                  <tr v-if="expandedRows.has(index)">
                    <td colspan="99">
                      <div class="tips">{{row.phrase}}</div>
                      <Card class="box-card" v-for="section in row.chapterSectionList" :key="section.title" style="margin-top: 20px;">
                        <CardHeader>
                          <div class="clearfix" style="line-height: 28px;">
                            <span>{{section.title}}</span>
                            <span style="float: right;">
                              <Button variant="link" size="sm" @click="showChapterSection(row.id, section)">修改</Button>
                              <Button variant="link" size="sm" @click="deleteChapterSection(row.id)">删除</Button>
                            </span>
                          </div>
                        </CardHeader>
                  <CardContent>
                        <div class="table-wrapper">
                          <div class="tips">{{section.phrase}}</div>
                          <div>{{section.question ? section.question.title : ""}}</div>
                        </div>
                      </CardContent>
                      </Card>
                    </td>
                  </tr>
                </template>
              </TableBody>
            </Table>
          </div>
        </div>
        <div v-if="showStep === 'publish'" class="publish">
          <div class="publish-box">
            <div class="current-status">
              <Alert :title="statusMap[exam.status]" variant="success" :closable="false" show-icon v-if="exam.status === 'published'"></Alert>
              <Alert :title="statusMap[exam.status]" variant="warning" :closable="false" show-icon v-else-if="exam.status === 'unpublished'"> </Alert>
<!--              <Alert :title="statusMap[exam.status]" variant="destructive" :closable="false" show-icon v-else> </Alert>-->
            </div>
            <div class="btn-list">
              <Button size="sm" variant="outline" @click="stepClick('content')">上一步</Button>
              <Button size="sm" variant="default" @click="publish" v-if="exam.status === 'unpublished'">马上发布</Button>
              <Button size="sm" variant="destructive" @click="unPublish" v-if="exam.status === 'published'">移入草稿</Button>
            </div>
          </div>
        </div>
      </div>
      <div class="w-1/6" style="position: relative;">
        <div class="affix" style="position: sticky; top: 160px; z-index: 10">
          <div class="step-list">
            <div class="title">
              步骤导航
            </div>
            <div class="steps flex flex-col">
              <template v-for="(step, i) in steps" :key="step.key">
                <div @click="stepClick(step.key)" :class="['flex items-center cursor-pointer', {'step-active': showStep === step.key}]">
                  <div :class="['flex h-8 w-8 items-center justify-center rounded-full text-sm flex-shrink-0', i <= stepActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground']">{{ i + 1 }}</div>
                  <span class="ml-2 text-sm">{{ step.name }}</span>
                </div>
                <div v-if="i < steps.length - 1" class="ml-4 h-4 w-px bg-border"></div>
              </template>
            </div>
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
        </div>
      </div>
    </div>
    <Dialog v-model="showChapterDialog" @close="hideChapter">
      <DialogHeader>
        <DialogTitle>编辑章节</DialogTitle>
      </DialogHeader>
      <form ref="examChapterRef" @submit.prevent>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">标题：</label>
          <div class="flex-1">
            <Input size="small" v-model="examChapter.title" placeholder="请输入标题"></Input>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">简介：</label>
          <div class="flex-1">
            <Textarea size="small" v-model="examChapter.phrase" :rows="4" placeholder="请输入简介"></Textarea>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="dialog-footer">
          <Button size="sm" variant="outline" @click="hideChapter">取 消</Button>
          <Button size="sm" variant="default" @click="submitChapter">确 定</Button>
        </div>
      </template>
    </Dialog>
    <Dialog v-model="showChapterSectionDialog" @close="hideChapterSection">
      <DialogHeader>
        <DialogTitle>编辑章节内容</DialogTitle>
      </DialogHeader>
      <form ref="examChapterSectionRef" @submit.prevent>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">标题：</label>
          <div class="flex-1">
            <Input size="small" v-model="examChapterSection.title" placeholder="请输入标题" autocomplete="off"></Input>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">试卷：</label>
          <div class="flex-1">
            <div>{{paper.title}}</div>
            <Button size="sm" variant="outline" @click="showPaper">选择试卷</Button>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">简介：</label>
          <div class="flex-1">
            <Textarea size="small" v-model="examChapterSection.phrase" :rows="4" placeholder="请输入简介"></Textarea>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="dialog-footer">
          <Button size="sm" variant="outline" @click="hideChapterSection">取 消</Button>
          <Button size="sm" variant="default" @click="submitChapterSection">确 定</Button>
        </div>
      </template>
    </Dialog>
    <Dialog v-model="showPaperDialog" :width="'90%'" @close="hidePaper">
      <DialogHeader>
        <DialogTitle>选择试卷</DialogTitle>
      </DialogHeader>
      <paper-list :is-component="true" :hide-component="hidePaper" :selection-change-callback="paperSelectionChange"/>
    </Dialog>
  </div>
</template>
<script>
  import { useFormRef } from '@/composables/useFormRef'
  import {ref, computed} from "vue"
  import {useRoute} from "vue-router"
  import router from "@/router"
  import { examApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree, getAllParent } = examApi
  const { saveBaseInfo, updateBaseInfo, getBaseInfo, publishExam, unPublishExam, saveExamChapter, updateExamChapter, deleteExamChapter, getExamChapterList, saveExamChapterSection, updateExamChapterSection, deleteExamChapterSection, updateSortOrder } = examApi
  import Upload from "@/components/Uplaod/index.vue"
  import WangEditor from "@/components/WangEditor/index.vue"
  import {success, confirm, error} from "@/util/tipsUtils";
  import { examApi as paperApi } from '@/api/edu/admin-api';
  import PaperList from "@/views/edu/admin/exam/paper/index.vue";
  import { VueDraggableNext} from "vue-draggable-next";

  import { Card, CardHeader, CardContent } from '@/components/ui/card'
  import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import Button from '@/components/ui/Button.vue'
  import { Alert } from '@/components/ui/alert'
  import { Input } from '@/components/ui/input'
  import { Textarea } from '@/components/ui/textarea'
  import { Select, SelectOption } from '@/components/ui/select'
export default {
    name: "ExamListEditIndex",
    components:{
    Alert,
    Card,
    CardHeader,
    CardContent,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    Button,
    Input,
    Textarea,
    Select,
    SelectOption,
      draggable: VueDraggableNext,
      PaperList,
      Upload,
      WangEditor
    },
    setup() {
      const expandedRows = ref(new Set())
      const toggleExpand = (key) => {
        if (expandedRows.value.has(key)) {
          expandedRows.value.delete(key)
        } else {
          expandedRows.value.add(key)
        }
      }
      const loadWangEditorFlag = ref(false)
      const route = useRoute()
      const showPaperDialog = ref(false)
      const paper = ref({})
      let isUpdate = !!route.query.id
      let showStep = ref("")
      // 基本信息
      const uploadData = ref({
        url: '/api/v1/edu' + "/oss/exam/image",
        files: []
      })
      const categoryOptions = ref([])
      const selectCidList = ref([])
      const flatCategoryOptions = computed(() => {
        const result = []
        const flatten = (nodes, parentPath = '') => {
          for (const node of nodes) {
            const label = parentPath ? `${parentPath} / ${node.label || node.name}` : (node.label || node.name)
            result.push({ label, value: node.value || node.id })
            if (node.children && node.children.length) { flatten(node.children, label) }
          }
        }
        flatten(categoryOptions.value || [])
        return result
      })
      const exam = ref({
        id: "",
        name: "",
        startTime: "",
        endTime: "",
        image: "",
        cidList: [],
        phrase: "",
        introduction: "",
        status: "published"
      })
      const examRules = {
        name: [{ required: true, message: "请输入标题", trigger: "blur" }],
        startTime: [{ required: true, message: "请选择时间", trigger: "change" }],
        endTime: [{ required: true, message: "请选择时间", trigger: "change" }],
        phrase: [{ required: true, message: "请输入简介", trigger: "blur" }],
        cidList: [{ required: true, message: "请选择分类", trigger: "change" }],
        introduction: [{ required: true, message: "请输入描述", trigger: "blur" }],
        image: [{ required: true, message: "请选择海报", trigger: "change" }],
      }
      // 加载基本信息
      const loadBaseInfo = () => {
        let id = route.query.id;
        if (!id) {
          loadWangEditorFlag.value = true;
          return;
        }
        getBaseInfo(id, function (res) {
          exam.value = res;
          selectCidList.value = res.cidList || []
          uploadData.value.files = [{name: "海报", url: exam.value.image}]
          loadWangEditorFlag.value = true;
        })
      }
      // 获取分类
      const loadCategory = () => {
        findCategoryList(0, true, (res) => {
          if (res && res.length) {
            categoryOptions.value = toTree(res);
            categoryOptions.value.splice(0, 1);
            loadBaseInfo();
          }
        })
      }
      // 选择分类
      const changeCategory = (val) => {
        exam.value.cidList = val || []
      }
      // 选择时间
      const changeStartTime = (val) => {
        exam.value.startTime = val
      }
      // 选择时间
      const changeEndTime = (val) => {
        exam.value.endTime = val
      }
      // 上传图片成功
      const onUploadImageSuccess = (res) => {
        exam.value.image = res.data
      }
      // 删除图片
      const onUploadImageRemove = () => {
        exam.value.image = ""
        uploadData.value.files = []
      }
      // 提交基本信息
      const examRef = useFormRef()
      const submitBaseInfo = () => {
        examRef.value.validate((valid) => {
          if (!valid) { return false }
          if (isUpdate) {
            if (typeof exam.value.startTime === "string") {
              exam.value.startTime = new Date(exam.value.startTime)
            }
            if (typeof exam.value.endTime === "string") {
              exam.value.endTime = new Date(exam.value.endTime)
            }
            updateBaseInfo(exam.value, function (res) {
              if (res && res.id) {
                exam.value.id = res.id;
                success("编辑成功")
                showStep.value = "content";
                loadStepActiveArray()
                let path = route.fullPath;
                router.push({path, query: {id: exam.value.id, step: "content"} });
              }
            })
          } else {
            if (typeof exam.value.startTime === "string") {
              exam.value.startTime = new Date(exam.value.startTime)
            }
            if (typeof exam.value.endTime === "string") {
              exam.value.endTime = new Date(exam.value.endTime)
            }
            saveBaseInfo(exam.value, function (res) {
              if (res && res.id) {
                exam.value.id = res.id;
                success("新增成功")
                showStep.value = "content";
                loadStepActiveArray()
                let path = route.fullPath;
                router.push({path, query: {id: exam.value.id, step: "content"} });
              }
            })
          }
        })
      }

      // 内容
      const contentList = ref([])
      const loadContent = () => {
        if (!(exam.value && exam.value.id)) {
          return;
        }
        getExamChapterList({examId: exam.value.id}, (res) => {
          if (res && res.list && res.list.length) {
            for (const chapter of res.list) {
              if (chapter.chapterSectionList && chapter.chapterSectionList.length) {
                for (const section of chapter.chapterSectionList) {
                  paperApi.getBaseInfo(section.paperId, (result) => {
                    section.question = result
                  });
                }
              }
            }
            contentList.value = res.list;
            expandedRows.value = new Set(res.list.map((_, i) => i))
          }
        })
      }
      const showChapterDialog = ref(false)
      const examChapter = ref({
        id: "",
        examId: "",
        title: "",
        phrase: ""
      })
      const examChapterRules = ref({
        title: [{ required: true, message: "请输入标题", trigger: "blur" }],
        // phrase: [{ required: true, message: "请输入简介", trigger: "blur" }]
      })
      const showChapter = (chapter) => {
        if (chapter && chapter.id) {
          examChapter.value = chapter;
        } else {
          examChapter.value.examId = exam.value.id;
        }
        showChapterDialog.value = true;
      }
      const hideChapter = () => {
        showChapterDialog.value = false;
        examChapter.value.title = ""
        examChapter.value.phrase = ""
      }
      const deleteChapter = (id) => {
        confirm("确认删除吗？", "提示", () => {
          deleteExamChapter({id: id}, () => {
            success("删除成功")
            loadContent()
          })
        })
      }
      const examChapterRef = useFormRef()
      const submitChapter = () => {
        examChapterRef.value.validate((valid) => {
          if (!valid) { return false }
          if (examChapter.value.id) {
            updateExamChapter(examChapter.value, function () {
              success("编辑成功")
              hideChapter()
              loadContent()
            })
          } else {
            saveExamChapter(examChapter.value, function () {
              success("新增成功")
              hideChapter()
              loadContent()
              stepActive.value = steps.length;
              isUpdate = true;
            })
          }
        })
      }
      const showChapterSectionDialog = ref(false)
      const examChapterSectionJson = {
        id: "",
        examChapterId: "",
        title: "",
        paperId: "",
        phrase: ""
      }
      const examChapterSection = ref(examChapterSectionJson)
      const examChapterSectionRules = ref({
        title: [{ required: true, message: "请输入标题", trigger: "blur" }],
        paperId: [{ required: true, message: "请选择试卷", trigger: "blur" }],
        // phrase: [{ required: true, message: "请输入简介", trigger: "blur" }]
      })
      const showChapterSection = (examChapterId, chapterSection) => {
        showChapterSectionDialog.value = true;
        if (chapterSection) {
          examChapterSection.value = chapterSection;
          paper.value = chapterSection.question;
        } else {
          examChapterSection.value.examChapterId = examChapterId
        }
      }
      const hideChapterSection = () => {
        showChapterSectionDialog.value = false;
        paper.value = {}
        examChapterSection.value = {id: "", examChapterId: "", title: "", paperId: "", phrase: "", totalTime: 0}
      }
      const deleteChapterSection = (id) => {
        confirm("确认删除吗？", "提示", () => {
          deleteExamChapterSection({id: id}, () => {
            success("删除成功")
            loadContent()
          })
        })
      }
      const examChapterSectionRef = useFormRef()
      const submitChapterSection = () => {
        examChapterSection.value.paperId = paper.value.id || examChapterSection.value.paperId;
        examChapterSectionRef.value.validate((valid) => {
          if (!valid) { return false }
          if (examChapterSection.value.id) {
            updateExamChapterSection(examChapterSection.value, function () {
              success("编辑成功")
              hideChapterSection()
              loadContent()
            })
          } else {
            saveExamChapterSection(examChapterSection.value, function () {
              success("新增成功")
              hideChapterSection()
              loadContent()
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
        publishExam({id: exam.value.id}, () => {
          success("发布成功")
          exam.value.status = "published"
        })
      }
      const unPublish = () => {
        unPublishExam({id: exam.value.id}, () => {
          success("取消发布成功")
          exam.value.status = "unpublished"
        })
      }
      // 步骤条
      const steps = [
        {key: "base", name: "基础信息"},
        {key: "content", name: "考试内容"},
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
      const init = () => {
        // 初始化加载
        if (route.query.step) {
          showStep.value = route.query.step;
        } else {
          showStep.value = "base"
        }
        exam.value.id = route.query.id || ""
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
        router.push({path, query: {id: exam.value.id, step: key} });
      }
      loadStepActiveArray();
      const showPaper = () => {
        showPaperDialog.value = true;
      }
      const hidePaper = () => {
        showPaperDialog.value = false;
      }
      const paperSelectionChange = (paperIdList) => {
        if(!paperIdList || !paperIdList.length) {
          error("请选择试卷");
          return;
        }
        paperApi.getBaseInfo(paperIdList[0], (res) => {
          paper.value = res
        })
        hidePaper()
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
        const params = {id: exam.value.id, list: chapterList}
        updateSortOrder(params, () => {
          success("排序更新成功")
        })
      }
      // 返回参数与方法
      return {
        // 基本信息
        uploadData,
        categoryOptions,
        flatCategoryOptions,
        exam,
        selectCidList,
        examRules,
        examRef,
        changeCategory,
        changeStartTime,
        changeEndTime,
        onUploadImageSuccess,
        onUploadImageRemove,
        submitBaseInfo,
        // 内容列表
        contentList,
        showChapterDialog,
        examChapter,
        examChapterRules,
        showChapterSectionDialog,
        examChapterSection,
        examChapterSectionRules,
        examChapterRef,
        examChapterSectionRef,
        showChapter,
        hideChapter,
        showChapterSection,
        hideChapterSection,
        deleteChapter,
        deleteChapterSection,
        submitChapter,
        submitChapterSection,
        // 发布页面
        statusMap,
        publish,
        unPublish,
        // 步骤条
        steps,
        stepActive,
        showStep,
        stepClick,
        showPaperDialog,
        showPaper,
        hidePaper,
        paper,
        paperSelectionChange,
        loadWangEditorFlag,
        onDraggableChange,
        expandedRows,
        toggleExpand
      };
    }
  }
</script>
<style scoped lang="scss">
  .app-container {
    margin: 20px;
  }
  .upload-image-tips {
    font-size: 12px;
    color: #999999;
  }
  .tips {
    font-size: 12px;
    color: #999999;
  }
  .base {
    .upload-image-tips {
      font-size: 12px;
      color: #999999;
    }
    .no-plus {
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
  .box-card {
    padding: 0 30px 10px;
  }
  .affix {
    .step-list {
      padding: 10px 20px;
      .title {
        padding: 0 0 20px 0;
        font-size: 12px;
      }
      .steps {
        height: 120px;
        padding-left: 10px;
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
</style>
