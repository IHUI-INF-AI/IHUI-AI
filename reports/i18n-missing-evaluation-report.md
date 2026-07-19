# i18n 缺失 key 三分类评估报告

> 生成时间: 2026-07-19T15-01-07
> 评估对象: 阶段 5 真实缺失 key(共 1050 个)
> 评估依据: 当前仓库 zh-CN.json 实际 key 集 + 模块业务语义
> 数据来源: reports/migration-audit-i18n-2026-07-19T12-24-24.csv

## 1. 三分类统计

| 决策 | 数量 | 占比 |
| --- | --- | --- |
| 补齐(补迁移) | 4 | 0.4% |
| 重写已迁移 | 17 | 1.6% |
| 废弃(不迁移) | 1029 | 98.0% |
| **总计** | **1050** | **100%** |

## 2. Top 10 模块决策明细

| 模块 | 总数 | 补齐 | 重写已迁移 | 废弃 |
| --- | --- | --- | --- | --- |
| examine | 79 | 0 | 0 | 79 |
| agent_withdrawal_detail | 68 | 0 | 0 | 68 |
| job | 62 | 0 | 0 | 62 |
| gen_info | 44 | 0 | 0 | 44 |
| zhs_user | 31 | 0 | 1 | 30 |
| auth_user | 28 | 0 | 0 | 28 |
| information | 28 | 0 | 1 | 27 |
| task_developer | 26 | 0 | 1 | 25 |
| zhs_product | 24 | 0 | 1 | 23 |
| course_video | 23 | 0 | 0 | 23 |

## 3. 补齐清单(可立即补迁移)

共 4 个 key,建议补迁移到当前仓库 common.* 或对应模块下:

```
common.systemTip
common.serialNumber
common.dataItem
common.modifySuccess
```

## 4. 重写已迁移清单(无需补)

共 17 个 key,功能已在当前仓库其他模块下用新 key 实现:

```
loginLog.ip
authVeriCode.ip
userFeedback.id
userAgentImage.id
userAgentContext.id
userAgentAudio.id
information.id
userVip.id
taskDeveloper.id
vipLevel.id
zhs_user.id
us.id
authUserRole.phonenumber
selectUser.phonenumber
zhs_product.id
zhs_activity.id
zhsAgent.id
```

## 5. 废弃清单(无需补)

共 1029 个 key,模块/功能已废弃,新项目无对应实现:

```
headerSearch
unifiedLoginButton
unifiedLoginButton.logoutConfirm
unifiedLoginButton.noPermission
unifiedLoginButton.redirectFail
unifiedLoginButton.parseFail
navbar.logoutConfirm
crontab
crontab.allowedWildcards
crontab.cycleFrom
crontab.startFrom
crontab.executeOnce
crontab.everyMonth
crontab.nearestWorkday
crontab.lastDayOfMonth
crontab.specify
crontab.multipleSelection
table.batchExport
table.cancelSelect
table.goTo
table.pageSize
message.modifySuccess
message.modifyFailed
message.deleteSuccessCount
message.dataProcessing
message.duplicateSubmit
message.tokenRefreshFailed
message.loginExpired
message.reLogin
message.downloadError
tableColumn
tableColumn.id
button.batchExport
button.cancelSelect
query.searchParams
query.searchButton
query.resetButton
query.deleteButton
data.nonMultiple
data.showDialog
validationMessage
validationMessage.lengthBetween
validationMessage.invalidFormat
authUser
authUser.inputNickname
authUser.inputParentId
authUser.uuid
authUser.vipLevel
authUser.addUserCenter
authUser.editUserCenter
authUser.passwordHash
authUser.inputPasswordHash
authUser.passwordSalt
authUser.inputPasswordSalt
authUser.passwordSaltRequired
authUser.inputAvatar
authUser.inputGender
authUser.selectBirthday
authUser.inputInviteCode
authUser.selectIdentityType
authUser.identityCommoner
authUser.identityNoble
authUser.identityRoyal
authUser.identityMinistry
authUser.tokenQuantityRequired
authUser.editIdentity
authUser.assignUser
authUser.assignUserSuccess
authUser.assignUserFailed
authUser.pleaseSelectUser
authUser.confirmDeleteUserCenter
authRole.inputUserId
authRole.inputRoleId
authRole.addAuthRole
authRole.editAuthRole
authRole.confirmDeleteAuthRole
authRole.roleInfo
authRole.roleKey
authRole.authSuccess
authToken
authToken.inputUserUuid
authToken.inputToken
authToken.inputRefreshToken
authToken.tokenType
authToken.selectExpiresAt
authToken.refreshExpiresAt
authToken.selectRefreshExpiresAt
authToken.tokenRequired
authToken.refreshTokenRequired
authToken.expiresAtRequired
authToken.refreshExpiresAtRequired
authToken.addAuthToken
authToken.editAuthToken
authToken.confirmDeleteAuthToken
loginLog.inputUserUuid
loginLog.inputPlatform
loginLog.inputLocation
loginLog.selectLoginTime
loginLog.loginType
loginLog.inputIp
loginLog.inputUserAgent
loginLog.inputMessage
loginLog.loginTypeRequired
loginLog.addLoginLog
loginLog.editLoginLog
loginLog.confirmDeleteLoginLog
userRole
userRole.roleCode
userRole.inputRoleCode
userRole.inputDescription
userRole.deptCode
userRole.inputDeptCode
userRole.parentCode
userRole.inputParentCode
userRole.inputWeight
userRole.roleCodeRequired
userRole.addUserRole
userRole.editUserRole
userRole.confirmDeleteUserRole
userDept
userDept.deptCode
userDept.inputDeptCode
userDept.parentCode
userDept.inputParentCode
userDept.corporateId
userDept.inputCorporateId
userDept.inputWeight
userDept.inputCreator
userDept.deptCodeRequired
userDept.parentCodeRequired
userDept.corporateIdRequired
userDept.creatorRequired
userDept.addUserDept
userDept.editUserDept
userDept.confirmDeleteUserDept
authVipLevel
authVipLevel.inputTitle
authVipLevel.inputLevel
authVipLevel.inputRemark
authVipLevel.inputProgress
authVipLevel.model1
authVipLevel.inputModel1
authVipLevel.model2
authVipLevel.inputModel2
authVipLevel.inputCreator
authVipLevel.addAuthVipLevel
authVipLevel.editAuthVipLevel
authVipLevel.confirmDeleteAuthVipLevel
authVeriCode
authVeriCode.inputUserId
authVeriCode.inputPhone
authVeriCode.inputCode
authVeriCode.inputType
authVeriCode.inputPlatform
authVeriCode.inputIp
authVeriCode.inputUsed
authVeriCode.selectExpiresAt
authVeriCode.selectUsedAt
authVeriCode.expiresAtRequired
authVeriCode.addAuthVeriCode
authVeriCode.editAuthVeriCode
authVeriCode.confirmDeleteAuthVeriCode
authAccount
authAccount.inputUserUuid
authAccount.inputPlatform
authAccount.inputOpenId
authAccount.inputPlatformName
authAccount.inputNickname
authAccount.inputAccessToken
authAccount.inputRefreshToken
authAccount.selectExpiresAt
authAccount.inputAvatar
authAccount.selectBindTime
authAccount.platformRequired
authAccount.openIdRequired
authAccount.addAuthAccount
authAccount.editAuthAccount
authAccount.confirmDeleteAuthAccount
authInfo
authInfo.inputUserUuid
authInfo.inputUsername
authInfo.inputPhone
authInfo.inputCertificate
authInfo.inputEmail
authInfo.country
authInfo.inputCountry
authInfo.province
authInfo.inputProvince
authInfo.inputCity
authInfo.certificateRequired
authInfo.addAuthInfo
authInfo.editAuthInfo
authInfo.confirmDeleteAuthInfo
authFindInfo.inputUserUuid
authFindInfo.inputCard
authFindInfo.inputBelong
authFindInfo.inputTitle
authFindInfo.inputMessage
authFindInfo.cardRequired
authFindInfo.belongRequired
authFindInfo.addAuthFindInfo
authFindInfo.editAuthFindInfo
authFindInfo.confirmDeleteAuthFindInfo
authDept.inputUserId
authDept.inputDeptId
authDept.addAuthDept
authDept.editAuthDept
authDept.confirmDeleteAuthDept
authUserVip.inputUserUuid
authUserVip.vipId
authUserVip.inputVipId
authUserVip.inputProgress
authUserVip.isValid
authUserVip.inputIsValid
authUserVip.inputCreator
authUserVip.vipIdRequired
authUserVip.progressRequired
authUserVip.addAuthUserVip
authUserVip.editAuthUserVip
authUserVip.confirmDeleteAuthUserVip
authSmsTemp
authSmsTemp.tempCode
authSmsTemp.inputTempCode
authSmsTemp.inputSmsCode
authSmsTemp.sourcePlatform
authSmsTemp.inputSourcePlatform
authSmsTemp.signName
authSmsTemp.inputSignName
authSmsTemp.inputRemark
authSmsTemp.field1
authSmsTemp.inputField1
authSmsTemp.field2
authSmsTemp.inputField2
authSmsTemp.inputCreator
authSmsTemp.addAuthSmsTemp
authSmsTemp.editAuthSmsTemp
authSmsTemp.confirmDeleteAuthSmsTemp
authUserMargin
authUserMargin.inputUserUuid
authUserMargin.tokenQuantity
authUserMargin.inputTokenQuantity
authUserMargin.tokenFree
authUserMargin.inputTokenFree
authUserMargin.aument
authUserMargin.inputAument
authUserMargin.field1
authUserMargin.inputField1
authUserMargin.field2
authUserMargin.inputField2
authUserMargin.field3
authUserMargin.inputField3
authUserMargin.addAuthUserMargin
authUserMargin.editAuthUserMargin
authUserMargin.confirmDeleteAuthUserMargin
categoryDictionary
categoryDictionary.inputCode
categoryDictionary.inputName
categoryDictionary.inputPrentId
categoryDictionary.inputTypeId
categoryDictionary.img
categoryDictionary.butImg
categoryDictionary.isInvalidRequired
categoryDictionary.addCategoryDictionary
categoryDictionary.editCategoryDictionary
categoryDictionary.confirmDeleteCategoryDictionary
courseVideo
courseVideo.inputCourseId
courseVideo.videoTitle
courseVideo.inputVideoTitle
courseVideo.inputVideoPath
courseVideo.inputLecturer
courseVideo.inputDuration
courseVideo.inputAdjunctUrl
courseVideo.isPay
courseVideo.inputIsPay
courseVideo.inputAmount
courseVideo.inputAgentIds
courseVideo.inputHot
courseVideo.inputCollect
courseVideo.inputCreator
courseVideo.selectVideoFile
courseVideo.uploadComplete
courseVideo.calculatingHash
courseVideo.videoPathRequired
courseVideo.auditStatusRequired
courseVideo.addCourseVideo
courseVideo.editCourseVideo
courseVideo.confirmDeleteCourseVideo
coursePay
coursePay.inputCourseId
coursePay.inputPayType
coursePay.payTypeFree
coursePay.payTypeLimited
coursePay.payTypePaid
coursePay.inputPayCrowd
coursePay.payCrowdAll
coursePay.payCrowdMember
coursePay.inputAmount
coursePay.addCoursePay
coursePay.editCoursePay
coursePay.confirmDeleteCoursePay
courseAudit
courseAudit.inputOperate
courseAudit.inputSourceId
courseAudit.inputTargetId
courseAudit.inputCreator
courseAudit.addCourseAudit
courseAudit.editCourseAudit
courseAudit.confirmDeleteCourseAudit
courseAudit.inputComment
courseAudit.auditRecordNotFound
courseAudit.auditApproved
courseAudit.auditFailed
courseAudit.rectifyOpinionRequired
courseAudit.rectifySubmitted
coursePayLog
coursePayLog.inputUserUuid
coursePayLog.inputCourseId
coursePayLog.inputVideoId
coursePayLog.outBillOn
coursePayLog.inputOutBillOn
coursePayLog.payWay
coursePayLog.inputPayWay
coursePayLog.inputAmount
coursePayLog.realAmount
coursePayLog.inputRealAmount
coursePayLog.addCoursePayLog
coursePayLog.editCoursePayLog
coursePayLog.confirmDeleteCoursePayLog
coursePlatformLog
coursePlatformLog.inputPlatformId
coursePlatformLog.inputCourseId
coursePlatformLog.inputVideoId
coursePlatformLog.inputCreator
coursePlatformLog.inputSysCreator
coursePlatformLog.addCoursePlatformLog
coursePlatformLog.editCoursePlatformLog
coursePlatformLog.confirmDeleteCoursePlatformLog
userVideoLog
userVideoLog.inputVideoId
userVideoLog.inputUserUuid
userVideoLog.inputPlatformId
userVideoLog.inputCreatedAt
userVideoLog.addUserVideoLog
userVideoLog.editUserVideoLog
userVideoLog.confirmDeleteUserVideoLog
educationPlatform
educationPlatform.inputCode
educationPlatform.inputName
educationPlatform.inputDomain
educationPlatform.inputRemark
educationPlatform.field1
educationPlatform.inputField1
educationPlatform.field2
educationPlatform.inputField2
educationPlatform.addEducationPlatform
educationPlatform.editEducationPlatform
educationPlatform.confirmDeleteEducationPlatform
userCommentLog
userCommentLog.inputUserUuid
userCommentLog.commentId
userCommentLog.inputCommentId
userCommentLog.addUserCommentLog
userCommentLog.editUserCommentLog
userCommentLog.confirmDeleteUserCommentLog
userPlatform
userPlatform.inputUserUuid
userPlatform.inputPlatformId
userPlatform.identityId
userPlatform.inputIdentityId
userPlatform.selectRegisterTime
userPlatform.addUserPlatform
userPlatform.editUserPlatform
userPlatform.confirmDeleteUserPlatform
userVideoComment
userVideoComment.inputVideoId
userVideoComment.inputUserUuid
userVideoComment.inputParentId
userVideoComment.addUserVideoComment
userVideoComment.editUserVideoComment
userVideoComment.confirmDeleteUserVideoComment
zhsIdentity
zhsIdentity.inputName
zhsIdentity.inputPlatformId
zhsIdentity.organizationId
zhsIdentity.inputOrganizationId
zhsIdentity.inputParentId
zhsIdentity.isCross
zhsIdentity.inputIsCross
zhsIdentity.addZhsIdentity
zhsIdentity.editZhsIdentity
zhsIdentity.confirmDeleteZhsIdentity
dictionary
dictionary.inputCode
dictionary.inputName
dictionary.inputPrentId
dictionary.inputTypeId
dictionary.inputIsInvalid
dictionary.parentName
dictionary.typeName
dictionary.createdTime
dictionary.updatedTime
dictionary.addDictionary
dictionary.editDictionary
dictionary.confirmDeleteDictionary
dictionary.isInvalidRequired
agentRuleParam
agentRuleParam.inputContext
agentRuleParam.inputParamName
agentRuleParam.inputType
agentRuleParam.typeSearch
agentRuleParam.typeSort
agentRuleParam.sortord
agentRuleParam.inputSortord
agentRuleParam.sortAsc
agentRuleParam.sortDesc
agentRuleParam.inputRemark
agentRuleParam.ruleIdRequired
agentRuleParam.addAgentRuleParam
agentRuleParam.editAgentRuleParam
agentRuleParam.confirmDeleteAgentRuleParam
agentRuleParam.backToRule
agentRuleParam.modifySuccess
userFeedback
userFeedback.inputTitle
userFeedback.inputContext
userFeedback.statusFeedbacking
userFeedback.statusComingSoon
userFeedback.statusSolutionAnswered
userFeedback.inputFeedback
userFeedback.feedbackPath
userFeedback.inputCreator
userFeedback.selectCreatedAt
userFeedback.isDel
userFeedback.inputIsDel
userFeedback.modifySuccess
userAgentImage.inputUserUuid
userAgentImage.imagePath
userAgentImage.imageName
userAgentImage.inputImageName
userAgentImage.inputPlatform
userAgentImage.inputModelName
userAgentImage.modifySuccess
userAgentContext.inputAgentId
userAgentContext.inputUserUuid
userAgentContext.problem
userAgentContext.inputProblem
userAgentContext.inputAnswer
userAgentContext.userUrl
userAgentContext.inputUserUrl
userAgentContext.agentUrl
userAgentContext.inputAgentUrl
userAgentContext.sendTime
userAgentContext.inputSendTime
userAgentContext.field1
userAgentContext.inputField1
userAgentContext.sendTimeRequired
userAgentContext.modifySuccess
userAgentAudio.uuid
userAgentAudio.inputUuid
userAgentAudio.audioId
userAgentAudio.inputAudioId
userAgentAudio.inputAgentId
userAgentAudio.audioPath
userAgentAudio.inputSource
userAgentAudio.inputPlatform
userAgentAudio.updateAt
userAgentAudio.modifySuccess
information
information.inputTitle
information.inputContent
information.inputType
information.inputUrl
information.sourceName
information.inputSourceName
information.sourceNameRequired
information.sourceUrl
information.inputSourceUrl
information.sourceUrlRequired
information.sourceCreator
information.inputSourceCreator
information.sourceTime
information.selectSourceTime
information.sourceTimeRequired
information.insertTime
information.selectInsertTime
information.browse
information.inputBrowse
information.browseRequired
information.inputCreator
information.creatorRequired
information.crearedTime
information.selectCrearedTime
information.crearedTimeRequired
information.modifySuccess
agentWithdrawalDetail
agentWithdrawalDetail.developerName
agentWithdrawalDetail.inputDeveloperName
agentWithdrawalDetail.withdrawalTimeRange
agentWithdrawalDetail.reviewer
agentWithdrawalDetail.inputReviewer
agentWithdrawalDetail.reviewerTimeRange
agentWithdrawalDetail.reviewStatus
agentWithdrawalDetail.selectWithdrawalStatus
agentWithdrawalDetail.statusWithdrawn
agentWithdrawalDetail.statusReceived
agentWithdrawalDetail.withdrawalCreateTime
agentWithdrawalDetail.withdrawalAmountYuan
agentWithdrawalDetail.withdrawalType
agentWithdrawalDetail.typeWechat
agentWithdrawalDetail.typeAlipay
agentWithdrawalDetail.reviewerTime
agentWithdrawalDetail.review
agentWithdrawalDetail.trace
agentWithdrawalDetail.reviewDialogTitle
agentWithdrawalDetail.userOpenId
agentWithdrawalDetail.initiateTime
agentWithdrawalDetail.applyAmount
agentWithdrawalDetail.notes
agentWithdrawalDetail.inputNotes
agentWithdrawalDetail.withdrawalRecord
agentWithdrawalDetail.return
agentWithdrawalDetail.traceTitle
agentWithdrawalDetail.orderCreateTime
agentWithdrawalDetail.orderSettleTime
agentWithdrawalDetail.agentPrice
agentWithdrawalDetail.orderDuration
agentWithdrawalDetail.orderOriginalPrice
agentWithdrawalDetail.orderRealPrice
agentWithdrawalDetail.buyerName
agentWithdrawalDetail.issueNo
agentWithdrawalDetail.confirmApprove
agentWithdrawalDetail.confirmReject
agentWithdrawalDetail.inputUserId
agentWithdrawalDetail.initiateAt
agentWithdrawalDetail.inputInitiateAt
agentWithdrawalDetail.reviewerId
agentWithdrawalDetail.inputReviewerId
agentWithdrawalDetail.reviewerTimeLabel
agentWithdrawalDetail.inputReviewerTime
agentWithdrawalDetail.outBillNo
agentWithdrawalDetail.inputOutBillNo
agentWithdrawalDetail.inputUserName
agentWithdrawalDetail.inputAmount
agentWithdrawalDetail.wechatMsg
agentWithdrawalDetail.approvalRemark
agentWithdrawalDetail.inputApprovalRemark
agentWithdrawalDetail.approvalPass
agentWithdrawalDetail.approvalReject
agentWithdrawalDetail.approvalPassSuccess
agentWithdrawalDetail.approvalRejectSuccess
agentWithdrawalDetail.orderIds
agentWithdrawalDetail.inputOrderIds
agentWithdrawalDetail.inputOpenId
agentWithdrawalDetail.developerIndex
agentWithdrawalDetail.actualAmount
agentWithdrawalDetail.maxAmount
agentWithdrawalDetail.arrivalTimeRange
agentWithdrawalDetail.isSuccess
agentWithdrawalDetail.statusFailure
agentWithdrawalDetail.statusDash
agentWithdrawalDetail.withdrawalBatchNo
agentWithdrawalDetail.inputWithdrawalBatchNo
userVip
userVip.inputUserId
userVip.inputOpenId
userVip.openIdRequired
userVip.vipId
userVip.inputVipId
userVip.vipIdRequired
userVip.inputProgress
userVip.progressRequired
userVip.inputCreator
userVip.createdTime
userVip.selectCreatedTime
userVip.modifySuccess
batchSms
batchSms.phones
batchSms.inputPhones
batchSms.inputTitle
batchSms.titleMax
batchSms.inputModelName
batchSms.modelNameMax
batchSms.sendSms
batchSms.sendSuccessPrefix
batchSms.sendSuccessSuffix
batchSms.bizId
batchSms.requestId
batchSms.sendTime
batchSms.sendSuccessToast
batchSms.sendSuccessMock
batchSms.sendFailFallback
examine
examine.inputAgentId
examine.inputAgentName
examine.agentAvatar
examine.inputAgentAvatar
examine.categoryId
examine.inputCategoryId
examine.selectStartTime
examine.startUser
examine.inputStartUser
examine.startPhone
examine.inputStartPhone
examine.startName
examine.inputStartName
examine.examineUser
examine.inputExamineUser
examine.examineUserId
examine.inputExamineUserId
examine.selectExamineTime
examine.inputDesc
examine.inputFollow
examine.prologue
examine.inputPrologue
examine.statusPendingSubmit
examine.modifySuccess
examine.agentDesc
examine.inputAgentDesc
examine.agentIcon
examine.inputAgentIcon
examine.agentCategory
examine.inputAgentCategory
examine.agentTags
examine.inputAgentTags
examine.reviewStatus
examine.selectReviewStatus
examine.reviewStatusRequired
examine.reviewOpinion
examine.inputReviewOpinion
examine.reviewOpinionRequired
examine.agentSeqNo
examine.agentImage
examine.agentType
examine.agentCreateTime
examine.agentSaleType
examine.agentPrice
examine.agentFreeTimeEnd
examine.agentDiscount
examine.agentTargetGroup
examine.developerName
examine.pleaseReview
examine.inputRemark
examine.pass
examine.approvalPassSuccess
examine.approvalRejectSuccess
examine.inputContent
examine.agentSaleMethod
examine.inputAgentSaleMethod
examine.agentFaceGroup
examine.reviewer
examine.inputReviewer
examine.demandSeqNo
examine.demandQrCode
examine.demandPublisherName
examine.agentDemandType
examine.demandTitle
examine.demandDesc
examine.demandPublishDate
examine.projectStartTime
examine.projectEndTime
examine.projectCycle
examine.priceRange
examine.projectStatus
examine.pleaseInputAgentName
examine.pleaseInputDeveloperName
examine.requestError
examine.fetchDataError
withdrawalFlow
withdrawalFlow.inputUserId
withdrawalFlow.amountCent
withdrawalFlow.inputAmountCent
withdrawalFlow.outBillNo
withdrawalFlow.inputOutBillNo
withdrawalFlow.inputCreatedAt
withdrawalFlow.inputUpdatedAt
withdrawalFlow.transferDetail
withdrawalFlow.inputTransferDetail
withdrawalFlow.outBillNoRequired
withdrawalFlow.statusRequired
withdrawalFlow.createdAtRequired
withdrawalFlow.updatedAtRequired
taskDeveloper.inputTaskId
taskDeveloper.accept
taskDeveloper.inputAccept
taskDeveloper.acceptAt
taskDeveloper.selectAcceptAt
taskDeveloper.inputAmount
taskDeveloper.inputDiscount
taskDeveloper.realAmount
taskDeveloper.inputRealAmount
taskDeveloper.nodes
taskDeveloper.inputNodes
taskDeveloper.publisher
taskDeveloper.inputPublisher
taskDeveloper.inputCreator
taskDeveloper.inputUpdator
taskDeveloper.taskIdLabel
taskDeveloper.acceptLabel
taskDeveloper.acceptAtLabel
taskDeveloper.discountLabel
taskDeveloper.nodesLabel
taskDeveloper.publisherLabel
taskDeveloper.creatorLabel
taskDeveloper.updatorLabel
taskDeveloper.modifySuccess
taskDeveloper.dataItem
vipLevel
vipLevel.inputTitle
vipLevel.inputLevel
vipLevel.inputProgress
vipLevel.model1
vipLevel.inputModel1
vipLevel.model2
vipLevel.inputModel2
vipLevel.inputRemark
vipLevel.inputCreator
vipLevel.levelRequired
vipLevel.progressRequired
vipLevel.model1Required
vipLevel.model2Required
vipLevel.creatorRequired
job
job.jobName
job.inputJobName
job.jobGroup
job.selectJobGroup
job.jobStatus
job.selectJobStatus
job.jobId
job.invokeTarget
job.inputInvokeTarget
job.cronExpression
job.inputCronExpression
job.log
job.executeOnce
job.jobDetail
job.scheduleLog
job.jobGrouping
job.selectJobGrouping
job.misfirePolicy
job.misfirePolicyDefault
job.misfirePolicyImmediate
job.misfirePolicyOnce
job.misfirePolicyAbandon
job.concurrentAllow
job.concurrentForbid
job.nextExecuteTime
job.invokeMethod
job.statusPause
job.addOrEditJob
job.beanCallExample
job.classCallExample
job.paramDescription
job.generateExpression
job.cronExpressionGenerator
job.taskLogDetail
job.jobNameRequired
job.invokeTargetRequired
job.cronExpressionRequired
job.confirmEnable
job.confirmDisable
job.confirmExecuteOnce
job.executeSuccess
job.addJob
job.editJob
job.modifySuccess
job.confirmDeleteJob
job.jobLog
job.jobLog.jobLogId
job.jobLog.jobName
job.jobLog.inputJobName
job.jobLog.jobGroup
job.jobLog.selectJobGroup
job.jobLog.selectStatus
job.jobLog.executeTime
job.jobLog.invokeTarget
job.jobLog.jobMessage
job.jobLog.logDetail
job.jobLog.logSerial
job.jobLog.taskGroup
job.jobLog.invokeMethod
job.jobLog.executeStatus
job.jobLog.exceptionInfo
dictData
dictData.dictCode
dictData.dictLabel
dictData.inputDictLabel
dictData.dictValue
dictData.inputDictValue
dictData.dictSort
dictData.inputDictSort
dictData.dictType
dictData.dictName
dictData.inputDictName
dictData.cssClass
dictData.inputCssClass
dictData.listClass
dictData.inputListClass
dictData.inputRemark
dictData.addDictData
dictData.editDictData
dictData.dictLabelRequired
dictData.dictValueRequired
dictData.dictSortRequired
dictData.confirmDeleteDictData
dictData.modifySuccess
zhs_user.inputToken
zhs_user.inputOpenId
zhs_user.inputNickname
zhs_user.inputUserName
zhs_user.userPassword
zhs_user.inputUserPassword
zhs_user.inputAvatar
zhs_user.inputCard
zhs_user.inputPhone
zhs_user.inputInviteCode
zhs_user.inputParentId
zhs_user.inputBalance
zhs_user.inputTotalEarnings
zhs_user.inputCreatedAt
zhs_user.inputUpdatedAt
zhs_user.isVip
zhs_user.inputIsVip
zhs_user.identityTypy
zhs_user.inputIdentityTypy
zhs_user.commissionRatio
zhs_user.inputCommissionRatio
zhs_user.tokenQuantity
zhs_user.inputTokenQuantity
zhs_user.addZhsUser
zhs_user.editZhsUser
zhs_user.openIdRequired
zhs_user.inviteCodeRequired
zhs_user.totalEarningsRequired
zhs_user.modifySuccess
zhs_user.confirmDeleteZhsUser
us
us.inputNetwork
us.inputPhone
us.socialMedia
us.inputSocialMedia
us.inputExperience
us.inputDescription
us.addUs
us.editUs
us.modifySuccess
us.dataItem
userAvatar
userAvatar.fileFormatError
userAvatar.modifySuccess
resetPwd.inputOldPassword
resetPwd.oldPasswordRequired
resetPwd.inputNewPassword
resetPwd.newPasswordLength
resetPwd.newPasswordInvalid
resetPwd.inputConfirmPassword
resetPwd.confirmPasswordMismatch
resetPwd.modifySuccess
authUserRole
authUserRole.inputUserName
authUserRole.inputPhonenumber
authUserRole.cancelAuthAll
authUserRole.cancelAuth
authUserRole.confirmCancelAuth
authUserRole.confirmCancelAuthAll
authUserRole.cancelAuthSuccess
selectUser
selectUser.inputUserName
selectUser.inputPhonenumber
selectUser.pleaseSelectUser
gen
gen.tableName
gen.inputTableName
gen.tableComment
gen.inputTableComment
gen.className
gen.serialNumber
gen.generateCode
gen.codePreview
gen.pleaseSelectTable
gen.confirmSync
importTable
importTable.tableName
importTable.inputTableName
importTable.tableComment
importTable.inputTableComment
importTable.pleaseSelectTable
genInfo
genInfo.tplCategory
genInfo.crud
genInfo.tree
genInfo.sub
genInfo.tplWebType
genInfo.elementUi
genInfo.elementPlus
genInfo.packageName
genInfo.packageNameTip
genInfo.moduleName
genInfo.moduleNameTip
genInfo.businessName
genInfo.businessNameTip
genInfo.functionName
genInfo.functionNameTip
genInfo.genType
genInfo.genTypeTip
genInfo.zip
genInfo.customPath
genInfo.parentMenu
genInfo.parentMenuTip
genInfo.pleaseSelectMenu
genInfo.customPathLabel
genInfo.customPathTip
genInfo.recentPath
genInfo.restoreDefaultPath
genInfo.otherInfo
genInfo.treeCode
genInfo.treeCodeTip
genInfo.treeParentCode
genInfo.treeParentCodeTip
genInfo.treeName
genInfo.treeNameTip
genInfo.relationInfo
genInfo.subTableName
genInfo.subTableNameTip
genInfo.subTableFkName
genInfo.subTableFkNameTip
genInfo.pleaseSelectTemplate
genInfo.pleaseInputPackagePath
genInfo.pleaseInputModuleName
genInfo.pleaseInputBusinessName
genInfo.pleaseInputFunctionName
editTable
editTable.columnInfo
editTable.genInfo
editTable.serialNumber
editTable.columnComment
editTable.physicalType
editTable.javaType
editTable.javaProperty
editTable.insert
editTable.queryMode
editTable.displayType
editTable.textInput
editTable.textArea
editTable.dateControl
editTable.imageUpload
editTable.richText
editTable.dictType
editTable.formValidationError
basicInfoForm
basicInfoForm.tableName
basicInfoForm.inputTableName
basicInfoForm.tableComment
basicInfoForm.inputTableComment
basicInfoForm.className
basicInfoForm.inputClassName
basicInfoForm.functionAuthor
basicInfoForm.inputFunctionAuthor
basicInfoForm.tableNameRequired
basicInfoForm.tableCommentRequired
basicInfoForm.classNameRequired
basicInfoForm.functionAuthorRequired
zhs_product
zhs_product.inputName
zhs_product.inputStock
zhs_product.inputSales
zhs_product.inputCategory
zhs_product.inputDesc
zhs_product.inputStatus
zhs_product.inputType
zhs_product.denomination
zhs_product.inputDenomination
zhs_product.denominationVip
zhs_product.inputDenominationVip
zhs_product.denominationOperate
zhs_product.inputDenominationOperate
zhs_product.inputCreatedAt
zhs_product.inputUpdatedAt
zhs_product.addProduct
zhs_product.editProduct
zhs_product.stockRequired
zhs_product.salesRequired
zhs_product.statusRequired
zhs_product.modifySuccess
zhs_product.confirmDeleteProduct
zhs_activity.activityName
zhs_activity.inputActivityName
zhs_activity.activityRule
zhs_activity.inputActivityRule
zhs_activity.activityRecharge
zhs_activity.inputActivityRecharge
zhs_activity.beginAmount
zhs_activity.inputBeginAmount
zhs_activity.multiple
zhs_activity.inputMultiple
zhs_activity.computing
zhs_activity.inputComputing
zhs_activity.selectBeginTime
zhs_activity.inputCreator
zhs_activity.createdTime
zhs_activity.selectCreatedTime
zhs_activity.addActivity
zhs_activity.editActivity
zhs_activity.modifySuccess
zhs_activity.confirmDeleteActivity
zhsAgent.inputName
zhsAgent.inputConsume
zhsAgent.inputUrl
zhsAgent.inputInfo
zhsAgent.inputRemark
zhsAgent.seqencing
zhsAgent.inputSeqencing
zhsAgent.typeName
zhsAgent.isHiddenName
zhsAgent.isOpenName
zhsAgent.heat
zhsAgent.inputHeat
zhsAgent.field1
zhsAgent.inputField1
zhsAgent.inputCreator
zhsAgent.createdTime
zhsAgent.selectCreatedTime
zhsAgent.modifySuccess
zhsAgent.confirmDeleteAgent
examine.saleType
examine.inputSaleType
examine.agentSequence
message.confirmDeleteItem
```

## 6. 评估规则

| 优先级 | 规则 | 决策 |
| --- | --- | --- |
| 1 | 单段命名空间根标识(如 "common"、"navbar") | 废弃 |
| 2 | 模块 ∈ DEPRECATED_MODULES(unified_login_button / header_search / right_toolbar / crontab / image_upload / table_column / validation_message / query / data) | 废弃 |
| 3 | 原 common.* 命名空间 + leaf 在当前仓库不存在 | 补齐 |
| 3' | 原 common.* 命名空间 + leaf 在当前仓库已存在 | 重写已迁移 |
| 4 | leaf 在当前仓库存在(后缀匹配) | 重写已迁移 |
| 5 | 兜底(模块为旧项目特有功能,新项目无对应实现) | 废弃 |

## 7. 全模块决策明细(共 82 个模块)

| 模块 | 总数 | 补齐 | 重写已迁移 | 废弃 |
| --- | --- | --- | --- | --- |
| examine | 79 | 0 | 0 | 79 |
| agent_withdrawal_detail | 68 | 0 | 0 | 68 |
| job | 62 | 0 | 0 | 62 |
| gen_info | 44 | 0 | 0 | 44 |
| zhs_user | 31 | 0 | 1 | 30 |
| auth_user | 28 | 0 | 0 | 28 |
| information | 28 | 0 | 1 | 27 |
| task_developer | 26 | 0 | 1 | 25 |
| zhs_product | 24 | 0 | 1 | 23 |
| course_video | 23 | 0 | 0 | 23 |
| dict_data | 23 | 0 | 0 | 23 |
| zhs_activity | 21 | 0 | 1 | 20 |
| zhs_agent | 20 | 0 | 1 | 19 |
| edit_table | 18 | 0 | 0 | 18 |
| auth_sms_temp | 17 | 0 | 0 | 17 |
| auth_user_margin | 17 | 0 | 0 | 17 |
| agent_rule_param | 17 | 0 | 0 | 17 |
| user_dept | 16 | 0 | 0 | 16 |
| auth_account | 16 | 0 | 0 | 16 |
| user_agent_context | 16 | 0 | 1 | 15 |
| batch_sms | 16 | 0 | 0 | 16 |
| vip_level | 16 | 0 | 1 | 15 |
| auth_token | 15 | 0 | 0 | 15 |
| auth_veri_code | 15 | 0 | 1 | 14 |
| auth_info | 15 | 0 | 0 | 15 |
| course_audit | 14 | 0 | 0 | 14 |
| course_pay_log | 14 | 0 | 0 | 14 |
| dictionary | 14 | 0 | 0 | 14 |
| user_feedback | 14 | 0 | 1 | 13 |
| user_vip | 14 | 0 | 1 | 13 |
| withdrawal_flow | 14 | 0 | 0 | 14 |
| login_log | 13 | 0 | 1 | 12 |
| user_role | 13 | 0 | 0 | 13 |
| auth_vip_level | 13 | 0 | 0 | 13 |
| course_pay | 13 | 0 | 0 | 13 |
| basic_info_form | 13 | 0 | 0 | 13 |
| auth_user_vip | 12 | 0 | 0 | 12 |
| education_platform | 12 | 0 | 0 | 12 |
| us | 12 | 0 | 1 | 11 |
| category_dictionary | 11 | 0 | 0 | 11 |
| zhs_identity | 11 | 0 | 0 | 11 |
| user_agent_audio | 11 | 0 | 1 | 10 |
| gen | 11 | 0 | 0 | 11 |
| crontab | 10 | 0 | 0 | 10 |
| auth_find_info | 10 | 0 | 0 | 10 |
| course_platform_log | 9 | 0 | 0 | 9 |
| user_platform | 9 | 0 | 0 | 9 |
| auth_user_role | 9 | 0 | 1 | 8 |
| auth_role | 8 | 0 | 0 | 8 |
| user_video_log | 8 | 0 | 0 | 8 |
| user_agent_image | 8 | 0 | 1 | 7 |
| reset_pwd | 8 | 0 | 0 | 8 |
| user_comment_log | 7 | 0 | 0 | 7 |
| user_video_comment | 7 | 0 | 0 | 7 |
| import_table | 6 | 0 | 0 | 6 |
| unified_login_button | 5 | 0 | 0 | 5 |
| auth_dept | 5 | 0 | 0 | 5 |
| select_user | 5 | 0 | 1 | 4 |
| query | 4 | 0 | 0 | 4 |
| validation_message | 3 | 0 | 0 | 3 |
| user_avatar | 3 | 0 | 0 | 3 |
| modify_success | 2 | 1 | 0 | 1 |
| batch_export | 2 | 0 | 0 | 2 |
| cancel_select | 2 | 0 | 0 | 2 |
| table_column | 2 | 0 | 0 | 2 |
| data | 2 | 0 | 0 | 2 |
| system_tip | 1 | 1 | 0 | 0 |
| serial_number | 1 | 1 | 0 | 0 |
| data_item | 1 | 1 | 0 | 0 |
| header_search | 1 | 0 | 0 | 1 |
| logout_confirm | 1 | 0 | 0 | 1 |
| go_to | 1 | 0 | 0 | 1 |
| page_size | 1 | 0 | 0 | 1 |
| modify_failed | 1 | 0 | 0 | 1 |
| delete_success_count | 1 | 0 | 0 | 1 |
| data_processing | 1 | 0 | 0 | 1 |
| duplicate_submit | 1 | 0 | 0 | 1 |
| token_refresh_failed | 1 | 0 | 0 | 1 |
| login_expired | 1 | 0 | 0 | 1 |
| re_login | 1 | 0 | 0 | 1 |
| download_error | 1 | 0 | 0 | 1 |
| confirm_delete_item | 1 | 0 | 0 | 1 |
