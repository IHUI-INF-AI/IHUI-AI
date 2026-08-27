import type { AiCareerFieldKey, AiCareerQuestion } from '../../types'

/**
 * AI 生涯指导 — 孩子学业问卷题目数据。
 * 文案/选项值/field 名照搬原 Uniapp 页 `pagesA/ai_career/index.vue`,保持语义一致:
 * - label 与 value 相同(原项目 selectOption(field, value) 以选项文案作为 value 存储)
 * - 必填项与原项目 submitForm 的 requiredFields 一致
 */
export const AI_CAREER_QUESTIONS: AiCareerQuestion[] = [
  {
    key: 'school',
    title: '1. 孩子目前就读的学校',
    required: true,
    type: 'choice',
    section: 'basic',
    options: [
      { label: '普通公办学校', value: '普通公办学校' },
      { label: '普通民办学校', value: '普通民办学校' },
      { label: '市重点学校', value: '市重点学校' },
    ],
  },
  {
    key: 'classLevel',
    title: '2. 孩子班级整体水平大概是什么情况',
    required: true,
    type: 'choice',
    section: 'basic',
    options: [
      { label: '普通班', value: '普通班' },
      { label: '尖子班', value: '尖子班' },
    ],
  },
  {
    key: 'scoreRange',
    title: '3. 孩子最近几次语文和英语考试的大概分数范围',
    required: true,
    type: 'input',
    section: 'basic',
    placeholder: '请输入分数范围，比如：80-90',
    maxLength: 100,
  },
  {
    key: 'languageDifficulty',
    title: '4. 在语文和英语学习上，您觉得孩子目前最大的困难是什么',
    required: true,
    type: 'choice',
    section: 'basic',
    options: [
      { label: '阅读速度', value: '阅读速度' },
      { label: '理解能力', value: '理解能力' },
      { label: '词汇量', value: '词汇量' },
      { label: '作文表达', value: '作文表达' },
    ],
  },
  {
    key: 'scienceCharacteristics',
    title: '5. 关于理科方面，您是否观察到孩子在思考与解决问题的表现上有什么特点？',
    required: false,
    type: 'textarea',
    section: 'basic',
    placeholder: '请输入您的观察...',
    maxLength: 500,
  },
  {
    key: 'learningObstacle',
    title: '6. 对于孩子在日常学习的过程中，您觉得最影响他学习的因素是什么？',
    required: true,
    type: 'choice',
    section: 'basic',
    options: [
      { label: '孩子痴迷游戏', value: '孩子痴迷游戏' },
      { label: '学习时溜号发呆', value: '学习时溜号发呆' },
      { label: '拖延症', value: '拖延症' },
      { label: '学习效率低', value: '学习效率低' },
    ],
  },
  {
    key: 'hobbies',
    title: '7. 平时在没有学习任务的时候，孩子最喜欢做的事是什么？有没有长期坚持的兴趣或特长？',
    required: false,
    type: 'textarea',
    section: 'basic',
    placeholder: '比如：音乐，绘画',
    maxLength: 500,
  },
  {
    key: 'personality',
    title: '8. 孩子在人际关系和性格方面大致是什么样的？遇到挫折时通常会怎么反应？',
    required: true,
    type: 'choice',
    section: 'basic',
    options: [
      { label: '性格内向', value: '性格内向' },
      { label: '性格外向', value: '性格外向' },
      { label: '擅长解决问题', value: '擅长解决问题' },
      { label: '不擅长面对挫折', value: '不擅长面对挫折' },
    ],
  },
  {
    key: 'extraTime',
    title: '9. 每周除了学校任务之外，您觉得孩子还能有多少余力来用于课外学习或培训班？',
    required: true,
    type: 'choice',
    section: 'basic',
    options: [
      { label: '孩子学校学习任务很重', value: '孩子学校学习任务很重' },
      { label: '孩子有充足的空余时间', value: '孩子有充足的空余时间' },
    ],
  },
  {
    key: 'pressureTolerance',
    title: '10. 在安排学习和培训时，您觉得孩子对压力的承受度如何？',
    required: true,
    type: 'choice',
    section: 'basic',
    options: [
      { label: '适合轻松的训练', value: '适合轻松的训练' },
      { label: '适合有挑战性的训练', value: '适合有挑战性的训练' },
      { label: '适中的训练', value: '适中的训练' },
    ],
  },
  {
    key: 'learningGoal',
    title: '11. 如果用 1-5 分来打分，您对孩子未来三到五年在学习上的目标期待大概是几分？',
    required: true,
    type: 'score',
    section: 'basic',
    options: [
      { label: '1', value: '1' },
      { label: '2', value: '2' },
      { label: '3', value: '3' },
      { label: '4', value: '4' },
      { label: '5', value: '5' },
    ],
  },
  {
    key: 'personalityTest1',
    title: '【性格测试】您的孩子在学校或同龄人聚会中通常：',
    required: true,
    type: 'choice',
    section: 'personality',
    options: [
      {
        label: '容易主动融入群体，与多个同龄人互动，经常成为话题中心',
        value: '容易主动融入群体，与多个同龄人互动，经常成为话题中心',
      },
      {
        label: '倾向于和一两个熟悉的朋友一起，或更喜欢自己安静活动',
        value: '倾向于和一两个熟悉的朋友一起，或更喜欢自己安静活动',
      },
    ],
  },
  {
    key: 'personalityTest2',
    title: '【性格测试】您的孩子在学习或思考时更常表现为：',
    required: true,
    type: 'choice',
    section: 'personality',
    options: [
      {
        label: '注重事实、步骤、老师的明确要求；喜欢"具体的东西"',
        value: '注重事实、步骤、老师的明确要求；喜欢"具体的东西"',
      },
      {
        label: '会提出超出课本的问题、跳跃联想、喜欢探索"概念"和可能性',
        value: '会提出超出课本的问题、跳跃联想、喜欢探索"概念"和可能性',
      },
    ],
  },
  {
    key: 'personalityTest3',
    title: '【性格测试】您的孩子遇到矛盾或选择时通常：',
    required: true,
    type: 'choice',
    section: 'personality',
    options: [
      {
        label: '注重逻辑、公平原则，会表达"理由"和"根据"',
        value: '注重逻辑、公平原则，会表达"理由"和"根据"',
      },
      {
        label: '更看重自己或别人的感受，容易因为情绪影响决定',
        value: '更看重自己或别人的感受，容易因为情绪影响决定',
      },
    ],
  },
  {
    key: 'personalityTest4',
    title: '【性格测试】在学习安排或日常作息方面，孩子更像：',
    required: true,
    type: 'choice',
    section: 'personality',
    options: [
      {
        label: '喜欢提前规划（如整理书桌、写学习计划），按顺序完成任务',
        value: '喜欢提前规划（如整理书桌、写学习计划），按顺序完成任务',
      },
      {
        label: '常常挺随性，需要提醒才开始行动，对突发变化不太抗拒',
        value: '常常挺随性，需要提醒才开始行动，对突发变化不太抗拒',
      },
    ],
  },
  {
    key: 'personalityTest5',
    title: '【性格测试】当孩子累了或压力大时，他/她更倾向于：',
    required: true,
    type: 'choice',
    section: 'personality',
    options: [
      {
        label: '找朋友聊天、出去活动、参与社交来放松',
        value: '找朋友聊天、出去活动、参与社交来放松',
      },
      {
        label: '想把自己安静下来，例如听音乐、独处、做个人兴趣爱好',
        value: '想把自己安静下来，例如听音乐、独处、做个人兴趣爱好',
      },
    ],
  },
]

/** 必填字段校验清单(对齐原项目 submitForm 的 requiredFields,含提示名) */
export const AI_CAREER_REQUIRED_FIELDS: Array<{ field: AiCareerFieldKey; name: string }> = [
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
  { field: 'personalityTest5', name: '性格测试5' },
]
