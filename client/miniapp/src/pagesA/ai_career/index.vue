<template>
  <view class="container">
    <navigation-bars 
      :viscosity="true" 
      title="AI生涯指导" 
      :image="'https://file.aizhs.top/sys-mini/default/back.svg'"
      @pack="goBack" 
    />
    
    <scroll-view class="scroll-body" scroll-y>
      <view class="form-container">
        <!-- 问题1：孩子目前就读的学校 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>1. 孩子目前就读的学校</text>
          </view>
          <view class="options-container">
            <view 
              class="option-item" 
              :class="{ active: formData.school === '普通公办学校' }"
              @click="selectOption('school', '普通公办学校')"
            >
              <text>普通公办学校</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.school === '普通民办学校' }"
              @click="selectOption('school', '普通民办学校')"
            >
              <text>普通民办学校</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.school === '市重点学校' }"
              @click="selectOption('school', '市重点学校')"
            >
              <text>市重点学校</text>
            </view>
          </view>
        </view>

        <!-- 问题2：孩子班级整体水平 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>2. 孩子班级整体水平大概是什么情况</text>
          </view>
          <view class="options-container">
            <view 
              class="option-item" 
              :class="{ active: formData.classLevel === '普通班' }"
              @click="selectOption('classLevel', '普通班')"
            >
              <text>普通班</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.classLevel === '尖子班' }"
              @click="selectOption('classLevel', '尖子班')"
            >
              <text>尖子班</text>
            </view>
          </view>
        </view>

        <!-- 问题3：语文和英语考试分数范围 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>3. 孩子最近几次语文和英语考试的大概分数范围</text>
          </view>
          <input 
            class="input-field" 
            v-model="formData.scoreRange" 
            placeholder="请输入分数范围，比如：80-90"
            :maxlength="100"
          />
        </view>

        <!-- 问题4：语文和英语学习困难 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>4. 在语文和英语学习上，您觉得孩子目前最大的困难是什么</text>
          </view>
          <view class="options-container">
            <view 
              class="option-item" 
              :class="{ active: formData.languageDifficulty === '阅读速度' }"
              @click="selectOption('languageDifficulty', '阅读速度')"
            >
              <text>阅读速度</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.languageDifficulty === '理解能力' }"
              @click="selectOption('languageDifficulty', '理解能力')"
            >
              <text>理解能力</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.languageDifficulty === '词汇量' }"
              @click="selectOption('languageDifficulty', '词汇量')"
            >
              <text>词汇量</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.languageDifficulty === '作文表达' }"
              @click="selectOption('languageDifficulty', '作文表达')"
            >
              <text>作文表达</text>
            </view>
          </view>
        </view>

        <!-- 问题5：理科方面特点 -->
        <view class="question-item">
          <view class="question-title">
            <text>5. 关于理科方面，您是否观察到孩子在思考与解决问题的表现上有什么特点？</text>
          </view>
          <textarea 
            class="textarea-input" 
            v-model="formData.scienceCharacteristics" 
            placeholder="请输入您的观察..."
            :maxlength="500"
          ></textarea>
        </view>

        <!-- 问题6：影响学习的因素 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>6. 对于孩子在日常学习的过程中，您觉得最影响他学习的因素是什么？</text>
          </view>
          <view class="options-container">
            <view 
              class="option-item" 
              :class="{ active: formData.learningObstacle === '孩子痴迷游戏' }"
              @click="selectOption('learningObstacle', '孩子痴迷游戏')"
            >
              <text>孩子痴迷游戏</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.learningObstacle === '学习时溜号发呆' }"
              @click="selectOption('learningObstacle', '学习时溜号发呆')"
            >
              <text>学习时溜号发呆</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.learningObstacle === '拖延症' }"
              @click="selectOption('learningObstacle', '拖延症')"
            >
              <text>拖延症</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.learningObstacle === '学习效率低' }"
              @click="selectOption('learningObstacle', '学习效率低')"
            >
              <text>学习效率低</text>
            </view>
          </view>
        </view>

        <!-- 问题7：兴趣爱好 -->
        <view class="question-item">
          <view class="question-title">
            <text>7. 平时在没有学习任务的时候，孩子最喜欢做的事是什么？有没有长期坚持的兴趣或特长？</text>
          </view>
          <textarea 
            class="textarea-input" 
            v-model="formData.hobbies" 
            placeholder="比如：音乐，绘画"
            :maxlength="500"
          ></textarea>
        </view>

        <!-- 问题8：人际关系和性格 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>8. 孩子在人际关系和性格方面大致是什么样的？遇到挫折时通常会怎么反应？</text>
          </view>
          <view class="options-container">
            <view 
              class="option-item" 
              :class="{ active: formData.personality === '性格内向' }"
              @click="selectOption('personality', '性格内向')"
            >
              <text>性格内向</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.personality === '性格外向' }"
              @click="selectOption('personality', '性格外向')"
            >
              <text>性格外向</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.personality === '擅长解决问题' }"
              @click="selectOption('personality', '擅长解决问题')"
            >
              <text>擅长解决问题</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.personality === '不擅长面对挫折' }"
              @click="selectOption('personality', '不擅长面对挫折')"
            >
              <text>不擅长面对挫折</text>
            </view>
          </view>
        </view>

        <!-- 问题9：课外学习余力 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>9. 每周除了学校任务之外，您觉得孩子还能有多少余力来用于课外学习或培训班？</text>
          </view>
          <view class="options-container">
            <view 
              class="option-item" 
              :class="{ active: formData.extraTime === '孩子学校学习任务很重' }"
              @click="selectOption('extraTime', '孩子学校学习任务很重')"
            >
              <text>孩子学校学习任务很重</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.extraTime === '孩子有充足的空余时间' }"
              @click="selectOption('extraTime', '孩子有充足的空余时间')"
            >
              <text>孩子有充足的空余时间</text>
            </view>
          </view>
        </view>

        <!-- 问题10：压力承受度 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>10. 在安排学习和培训时，您觉得孩子对压力的承受度如何？</text>
          </view>
          <view class="options-container">
            <view 
              class="option-item" 
              :class="{ active: formData.pressureTolerance === '适合轻松的训练' }"
              @click="selectOption('pressureTolerance', '适合轻松的训练')"
            >
              <text>适合轻松的训练</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.pressureTolerance === '适合有挑战性的训练' }"
              @click="selectOption('pressureTolerance', '适合有挑战性的训练')"
            >
              <text>适合有挑战性的训练</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.pressureTolerance === '适中的训练' }"
              @click="selectOption('pressureTolerance', '适中的训练')"
            >
              <text>适中的训练</text>
            </view>
          </view>
        </view>

        <!-- 问题11：学习目标期待 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>11. 如果用 1-5 分来打分，您对孩子未来三到五年在学习上的目标期待大概是几分？</text>
          </view>
          <view class="options-container score-options">
            <view 
              class="option-item score-item" 
              :class="{ active: formData.learningGoal === '1' }"
              @click="selectOption('learningGoal', '1')"
            >
              <text>1</text>
            </view>
            <view 
              class="option-item score-item" 
              :class="{ active: formData.learningGoal === '2' }"
              @click="selectOption('learningGoal', '2')"
            >
              <text>2</text>
            </view>
            <view 
              class="option-item score-item" 
              :class="{ active: formData.learningGoal === '3' }"
              @click="selectOption('learningGoal', '3')"
            >
              <text>3</text>
            </view>
            <view 
              class="option-item score-item" 
              :class="{ active: formData.learningGoal === '4' }"
              @click="selectOption('learningGoal', '4')"
            >
              <text>4</text>
            </view>
            <view 
              class="option-item score-item" 
              :class="{ active: formData.learningGoal === '5' }"
              @click="selectOption('learningGoal', '5')"
            >
              <text>5</text>
            </view>
          </view>
        </view>

        <!-- 性格测试1 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>【性格测试】您的孩子在学校或同龄人聚会中通常：</text>
          </view>
          <view class="options-container">
            <view 
              class="option-item" 
              :class="{ active: formData.personalityTest1 === '容易主动融入群体，与多个同龄人互动，经常成为话题中心' }"
              @click="selectOption('personalityTest1', '容易主动融入群体，与多个同龄人互动，经常成为话题中心')"
            >
              <text>容易主动融入群体，与多个同龄人互动，经常成为话题中心</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.personalityTest1 === '倾向于和一两个熟悉的朋友一起，或更喜欢自己安静活动' }"
              @click="selectOption('personalityTest1', '倾向于和一两个熟悉的朋友一起，或更喜欢自己安静活动')"
            >
              <text>倾向于和一两个熟悉的朋友一起，或更喜欢自己安静活动</text>
            </view>
          </view>
        </view>

        <!-- 性格测试2 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>【性格测试】您的孩子在学习或思考时更常表现为：</text>
          </view>
          <view class="options-container">
            <view 
              class="option-item" 
              :class="{ active: formData.personalityTest2 === personalityOptions.test2_option1 }"
              @click="selectOption('personalityTest2', personalityOptions.test2_option1)"
            >
              <text>注重事实、步骤、老师的明确要求；喜欢"具体的东西"</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.personalityTest2 === personalityOptions.test2_option2 }"
              @click="selectOption('personalityTest2', personalityOptions.test2_option2)"
            >
              <text>会提出超出课本的问题、跳跃联想、喜欢探索"概念"和可能性</text>
            </view>
          </view>
        </view>

        <!-- 性格测试3 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>【性格测试】您的孩子遇到矛盾或选择时通常：</text>
          </view>
          <view class="options-container">
            <view 
              class="option-item" 
              :class="{ active: formData.personalityTest3 === personalityOptions.test3_option1 }"
              @click="selectOption('personalityTest3', personalityOptions.test3_option1)"
            >
              <text>注重逻辑、公平原则，会表达"理由"和"根据"</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.personalityTest3 === '更看重自己或别人的感受，容易因为情绪影响决定' }"
              @click="selectOption('personalityTest3', '更看重自己或别人的感受，容易因为情绪影响决定')"
            >
              <text>更看重自己或别人的感受，容易因为情绪影响决定</text>
            </view>
          </view>
        </view>

        <!-- 性格测试4 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>【性格测试】在学习安排或日常作息方面，孩子更像：</text>
          </view>
          <view class="options-container">
            <view 
              class="option-item" 
              :class="{ active: formData.personalityTest4 === '喜欢提前规划（如整理书桌、写学习计划），按顺序完成任务' }"
              @click="selectOption('personalityTest4', '喜欢提前规划（如整理书桌、写学习计划），按顺序完成任务')"
            >
              <text>喜欢提前规划（如整理书桌、写学习计划），按顺序完成任务</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.personalityTest4 === '常常挺随性，需要提醒才开始行动，对突发变化不太抗拒' }"
              @click="selectOption('personalityTest4', '常常挺随性，需要提醒才开始行动，对突发变化不太抗拒')"
            >
              <text>常常挺随性，需要提醒才开始行动，对突发变化不太抗拒</text>
            </view>
          </view>
        </view>

        <!-- 性格测试5 -->
        <view class="question-item">
          <view class="question-title">
            <text class="required">*</text>
            <text>【性格测试】当孩子累了或压力大时，他/她更倾向于：</text>
          </view>
          <view class="options-container">
            <view 
              class="option-item" 
              :class="{ active: formData.personalityTest5 === '找朋友聊天、出去活动、参与社交来放松' }"
              @click="selectOption('personalityTest5', '找朋友聊天、出去活动、参与社交来放松')"
            >
              <text>找朋友聊天、出去活动、参与社交来放松</text>
            </view>
            <view 
              class="option-item" 
              :class="{ active: formData.personalityTest5 === '想把自己安静下来，例如听音乐、独处、做个人兴趣爱好' }"
              @click="selectOption('personalityTest5', '想把自己安静下来，例如听音乐、独处、做个人兴趣爱好')"
            >
              <text>想把自己安静下来，例如听音乐、独处、做个人兴趣爱好</text>
            </view>
          </view>
        </view>

        <!-- 提交按钮 -->
        <view class="submit-container">
          <view class="submit-btn" @click="submitForm">
            <text>提交问卷</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { reactive } from 'vue'
import NavigationBars from "@/components/navigation-bars/index.vue"

const personalityOptions = {
  test2_option1: '注重事实、步骤、老师的明确要求；喜欢"具体的东西"',
  test2_option2: '会提出超出课本的问题、跳跃联想、喜欢探索"概念"和可能性',
  test3_option1: '注重逻辑、公平原则，会表达"理由"和"根据"',
  test3_option2: '更看重自己或别人的感受，容易因为情绪影响决定'
}

const formData = reactive({
  school: '',
  classLevel: '',
  scoreRange: '',
  languageDifficulty: '',
  scienceCharacteristics: '',
  learningObstacle: '',
  hobbies: '',
  personality: '',
  extraTime: '',
  pressureTolerance: '',
  learningGoal: '',
  personalityTest1: '',
  personalityTest2: '',
  personalityTest3: '',
  personalityTest4: '',
  personalityTest5: ''
})

function goBack() {
  uni.navigateBack()
}

function selectOption(field, value) {
  formData[field] = value
}

function submitForm() {
  const requiredFields = [
    { field: 'school', name: '孩子目前就读的学校' },
    { field: 'classLevel', name: '孩子班级整体水平' },
    { field: 'scoreRange', name: '语文和英语考试分数范围' },
    { field: 'languageDifficulty', name: '语文和英语学习困难' },
    { field: 'learningObstacle', name: '影响学习的因素' },
    { field: 'personality', name: '人际关系和性格' },
    { field: 'extraTime', name: '课外学习余力' },
    { field: 'pressureTolerance', name: '压力承受度' },
    { field: 'learningGoal', name: '学习目标期待' },
    { field: 'personalityTest1', name: '性格测试1' },
    { field: 'personalityTest2', name: '性格测试2' },
    { field: 'personalityTest3', name: '性格测试3' },
    { field: 'personalityTest4', name: '性格测试4' },
    { field: 'personalityTest5', name: '性格测试5' }
  ]

  for (let item of requiredFields) {
    if (!formData[item.field]) {
      uni.showToast({
        title: `请填写：${item.name}`,
        icon: 'none',
        duration: 2000
      })
      return
    }
  }

  uni.showToast({
    title: '提交成功',
    icon: 'success',
    duration: 2000
  })

  setTimeout(() => {
    uni.navigateBack()
  }, 2000)
}
</script>

<style lang="scss" scoped>
.container {
  width: 100%;
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 0;
}

.scroll-body {
  height: calc(100vh - var(--app-top-bar-height) - var(--app-nav-bar-height));
  padding-top: 20rpx;
}

.form-container {
  padding: 0 30rpx 40rpx;
}

.question-item {
  background-color: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 10rpx rgb(0 0 0 / 0.05);
}

.question-item.personality-test {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.question-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  line-height: 1.6;
  margin-bottom: 30rpx;
  
  .required {
    color: #f00;
    margin-right: 8rpx;
  }
}

.options-container {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.options-container.score-options {
  flex-direction: row;
  justify-content: space-between;
}

.option-item {
  padding: 24rpx 30rpx;
  background-color: #f8f9fa;
  border: 2rpx solid #e9ecef;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #495057;
  transition: all 0.3s;
  text-align: left;
  
  text {
    word-break: break-all;
    line-height: 1.6;
  }
  
  &.active {
    background-color: #007aff;
    border-color: #007aff;
    color: #fff;
  }
}

.question-item.personality-test .option-item {
  text-align: left;
}

.option-item.score-item {
  flex: 1;
  margin: 0 5rpx;
  min-width: 80rpx;
}

.input-field {
  width: 100%;
  height: 80rpx;
  padding: 0 20rpx;
  background-color: #f8f9fa;
  border: 2rpx solid #e9ecef;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #495057;
  box-sizing: border-box;
  line-height: 80rpx;
}

.textarea-input {
  width: 100%;
  min-height: 200rpx;
  padding: 20rpx;
  background-color: #f8f9fa;
  border: 2rpx solid #e9ecef;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #495057;
  box-sizing: border-box;
  line-height: 1.6;
}

.submit-container {
  padding: 40rpx 0;
  display: flex;
  justify-content: center;
}

.submit-btn {
  width: 600rpx;
  height: 88rpx;
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  text-transform: uppercase;
  border-radius: 15rpx;
  border: none;
  background: #000;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
  animation: bouncea 0.5s ease-in-out infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: 48rpx;
    font-weight: bold;
    color: #fff;
  }
  
  &:active {
    opacity: 0.9;
    transform: scale(0.98);
  }
}

@keyframes bouncea {
  0% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }

  50% {
    box-shadow: 6rpx 6rpx 5rpx 0 #d9d9d9;
    transform: translate(0, 0);
  }

  100% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }
}
</style>
