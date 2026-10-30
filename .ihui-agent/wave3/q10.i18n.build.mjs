import { readFileSync, writeFileSync } from 'node:fs'

const LANGS = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko']

/**
 * 本席三张页面级命名空间的取值来源表(key = 本席键名,value = web 语言包里已存在的同义键)。
 * 纪律:值逐字照抄 web 现有文案,不自造译文。
 */
const SPEC = {
  agentPlanPage: {
    title: 'agentPlan.title',
    description: 'agentPlan.description',
    goalLabel: 'agentPlan.goalLabel',
    goalPlaceholder: 'agentPlan.goalPlaceholder',
    sessionLabel: 'agentPlan.sessionLabel',
    sessionPlaceholder: 'agentPlan.sessionPlaceholder',
    modelLabel: 'agentPlan.modelLabel',
    modelPlaceholder: 'agentPlan.modelPlaceholder',
    generate: 'agentPlan.generate',
    generating: 'agentPlan.generating',
    planTitle: 'agentPlan.planTitle',
    edit: 'agentPlan.edit',
    cancel: 'agentPlan.cancel',
    editHint: 'agentPlan.editHint',
    readonlyTools: 'agentPlan.readonlyTools',
    approve: 'agentPlan.approve',
    reject: 'agentPlan.reject',
    executing: 'agentPlan.executing',
    finalResponse: 'agentPlan.finalResponse',
    stopReason: 'agentPlan.stopReason',
    iterations: 'agentPlan.iterations',
    errorLabel: 'agentPlan.error',
    loadFailed: 'common.loadFailed',
    reset: 'agentPlan.reset',
    rejectedTitle: 'agentPlan.rejectedTitle',
    rejectedDesc: 'agentPlan.rejectedDesc',
    statusDraft: 'agentPlan.statusDraft',
    statusApproved: 'agentPlan.statusApproved',
    statusRejected: 'agentPlan.statusRejected',
    statusExecuting: 'agentPlan.statusExecuting',
    statusDone: 'agentPlan.statusDone',
    statusFailed: 'agentPlan.statusFailed',
    loginRequired: 'chat.loginRequired',
    empty: 'common.noData',
  },
  agentPlanProgressPage: {
    title: 'chat.taskProgressOpen',
    planIdLabel: 'agentPlan.planId',
    open: 'common.viewDetail',
    loading: 'common.loading',
    error: 'common.loadFailed',
    loginRequired: 'chat.loginRequired',
    empty: 'common.noData',
    taskProgressTitle: 'chat.taskProgressOpen',
    blockedLabel: 'plan.statusBlocked',
    versionsTitle: 'teamKnowledge.historyTitle',
    versionsEmpty: 'teamKnowledge.emptyHistory',
    createdAt: 'admin.advertise.colCreatedAt',
    updatedAt: 'admin.docs.colUpdatedAt',
    resultTitle: 'agentPlan.resultTitle',
    taskStatusPending: 'agents.kanban.todo',
    taskStatusDone: 'agents.kanban.done',
    taskStatusBlocked: 'agents.kanban.blocked',
    statusPendingApproval: 'ai.pane.subagent.pendingApproval',
    statusDraft: 'agentPlan.statusDraft',
    statusApproved: 'agentPlan.statusApproved',
    statusRejected: 'agentPlan.statusRejected',
    statusExecuting: 'agentPlan.statusExecuting',
    statusDone: 'agentPlan.statusDone',
    statusFailed: 'agentPlan.statusFailed',
  },
  subagentsDispatchPage: {
    title: 'ai.pane.subagent.title',
    loginRequired: 'chat.loginRequired',
    goalLabel: 'dispatchDialog.fields.goal',
    goalPlaceholder: 'dispatchDialog.goalPlaceholder',
    affectedFilesLabel: 'dispatchDialog.fields.affectedFilesPerLine',
    forbiddenLabel: 'dispatchDialog.fields.forbiddenPerLine',
    forbiddenPlaceholder: 'dispatchDialog.defaultForbidden',
    verifyLabel: 'dispatchDialog.fields.verifyCommands',
    constraintsLabel: 'dispatchDialog.fields.constraints',
    constraintsPlaceholder: 'dispatchDialog.constraintsPlaceholder',
    deliverablesLabel: 'dispatchDialog.fields.deliverables',
    deliverablesPlaceholder: 'dispatchDialog.deliverablesPlaceholder',
    agentRoleLabel: 'dispatchDialog.fields.agentRole',
    orchestrationLabel: 'dispatchDialog.fields.orchestration',
    priorityLabel: 'dispatchDialog.fields.priority',
    defaultOption: 'dispatchDialog.formDefaultOption',
    submit: 'dispatchDialog.formSubmit',
    submitting: 'dispatchDialog.formSubmitting',
    retryQuotaTitle: 'dispatchDialog.retryQuotaSummary',
    retryCount: 'dispatchDialog.fields.retryCount',
    retryDelayMs: 'dispatchDialog.fields.retryDelayMs',
    timeoutMs: 'dispatchDialog.fields.timeoutMs',
    tokenQuota: 'dispatchDialog.fields.tokenQuotaForm',
    maxRetries: 'dispatchDialog.fields.maxRetries',
    roleResearcher: 'dispatchDialog.subRoles.researcher',
    roleCoder: 'dispatchDialog.subRoles.coder',
    roleReviewer: 'dispatchDialog.subRoles.reviewer',
    roleArchitect: 'dispatchDialog.roles.architect',
    roleDebugger: 'dispatchDialog.subRoles.debugger',
    orchPipeline: 'dispatchDialog.subOrch.pipeline',
    orchParallel: 'dispatchDialog.orch.parallel',
    orchDebate: 'dispatchDialog.orch.debate',
    orchVote: 'dispatchDialog.orch.vote',
    orchCritique: 'dispatchDialog.subOrch.critique',
    orchDecomposed: 'dispatchDialog.subOrch.decomposed',
    orchWithCommunication: 'dispatchDialog.subOrch.withCommunication',
    priorityLow: 'dispatchDialog.priority.low',
    priorityNormal: 'dispatchDialog.priority.normal',
    priorityHigh: 'dispatchDialog.priority.high',
    priorityUrgent: 'dispatchDialog.priority.urgent',
    dispatchPending: 'dispatchStatus.pending',
    dispatchRunning: 'dispatchStatus.running',
    dispatchCompleted: 'dispatchStatus.completed',
    dispatchFailed: 'dispatchStatus.failed',
    dispatchCancelled: 'dispatchStatus.cancelled',
    resultTitle: 'dispatchDialog.dispatchSuccess',
    empty: 'common.noData',
    errorDefault: 'dispatchDialog.toastDispatchFailed',
    concurrentLimit: 'dispatchDialog.toastConcurrencyLimit',
    dispatchAnother: 'dispatchDialog.dispatchAnother',
  },
}

const out = {}
const missing = []
for (const lang of LANGS) {
  const dict = JSON.parse(
    readFileSync(`packages/i18n/messages/web/${lang}.json`, 'utf8'),
  )
  out[lang] = {}
  for (const [ns, map] of Object.entries(SPEC)) {
    out[lang][ns] = {}
    for (const [key, src] of Object.entries(map)) {
      const value = src.split('.').reduce((node, part) => node && node[part], dict)
      if (typeof value !== 'string' || value.length === 0) {
        missing.push(`${lang} ${ns}.${key} <- ${src}`)
      }
      out[lang][ns][key] = value
    }
  }
}

writeFileSync('.ihui-agent/wave3/q10.i18n.json', `${JSON.stringify(out, null, 2)}\n`)
const counts = LANGS.map(
  (lang) =>
    `${lang}=${Object.values(out[lang]).reduce((sum, ns) => sum + Object.keys(ns).length, 0)}`,
)
console.log('missing:', missing.length)
if (missing.length > 0) console.log(missing.join('\n'))
console.log('counts:', counts.join(' '))
