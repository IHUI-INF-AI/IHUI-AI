# 后端静态审计报告

扫描文件数: 782

## P0-SyncIO (0 个)


## P0-MissingAuth (0 个)


## P0-MixedPK (0 个)


## P1-MissingSoftDelete (1257 个)

- **[app\api\admin_migration.py:424]** P1-MissingSoftDelete: 查询 Message 缺少软删除过滤
  ```
  db.query(Message)
  ```
- **[app\api\admin_migration.py:435]** P1-MissingSoftDelete: 查询 Message 缺少软删除过滤
  ```
  db.query(Message)
  ```
- **[app\api\admin_migration.py:544]** P1-MissingSoftDelete: 查询 Message 缺少软删除过滤
  ```
  db.query(Message)
  ```
- **[app\api\admin_migration.py:556]** P1-MissingSoftDelete: 查询 Message 缺少软删除过滤
  ```
  db.query(Message)
  ```
- **[app\api\admin_migration.py:577]** P1-MissingSoftDelete: 查询 Message 缺少软删除过滤
  ```
  db.query(Message)
  ```
- **[app\api\admin_migration.py:595]** P1-MissingSoftDelete: 查询 Message 缺少软删除过滤
  ```
  db.query(Message)
  ```
- **[app\api\v1\admin_panel.py:746]** P1-MissingSoftDelete: 查询 SysPost 缺少软删除过滤
  ```
  n = db.query(SysPost).filter(SysPost.post_id.in_(ids)).update(
  ```
- **[app\api\v1\admin_panel.py:907]** P1-MissingSoftDelete: 查询 SysConfig 缺少软删除过滤
  ```
  n = db.query(SysConfig).filter(SysConfig.config_id.in_(ids)).update(
  ```
- **[app\api\v1\admin_panel.py:1015]** P1-MissingSoftDelete: 查询 SysDictType 缺少软删除过滤
  ```
  n = db.query(SysDictType).filter(SysDictType.dict_id.in_(ids)).update(
  ```
- **[app\api\v1\admin_panel.py:1183]** P1-MissingSoftDelete: 查询 SysDictData 缺少软删除过滤
  ```
  n = db.query(SysDictData).filter(SysDictData.dict_code.in_(ids)).update(
  ```
- **[app\api\v1\admin_panel.py:1374]** P1-MissingSoftDelete: 查询 SysNotice 缺少软删除过滤
  ```
  n = db.query(SysNotice).filter(SysNotice.notice_id.in_(ids)).update(
  ```
- **[app\api\v1\admin_panel.py:1565]** P1-MissingSoftDelete: 查询 SysSmsTemplate 缺少软删除过滤
  ```
  db.query(SysSmsTemplate)
  ```
- **[app\api\v1\admin_panel.py:1956]** P1-MissingSoftDelete: 查询 SysJob 缺少软删除过滤
  ```
  deleted = db.query(SysJob).filter(SysJob.job_id.in_(ids)).update(
  ```
- **[app\api\v1\ai_bot_sites.py:28]** P1-MissingSoftDelete: 查询 AiBotSites 缺少软删除过滤
  ```
  q = db.query(AiBotSites).filter(AiBotSites.is_use == 1)
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:229]** P1-MissingSoftDelete: 查询 InvoiceApplication 缺少软删除过滤
  ```
  inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:250]** P1-MissingSoftDelete: 查询 InvoiceApplication 缺少软删除过滤
  ```
  inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:271]** P1-MissingSoftDelete: 查询 InvoiceApplication 缺少软删除过滤
  ```
  inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:286]** P1-MissingSoftDelete: 查询 InvoiceApplication 缺少软删除过滤
  ```
  q = db.query(InvoiceApplication)
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:310]** P1-MissingSoftDelete: 查询 InvoiceApplication 缺少软删除过滤
  ```
  inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:320]** P1-MissingSoftDelete: 查询 InvoiceApplication 缺少软删除过滤
  ```
  inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:330]** P1-MissingSoftDelete: 查询 InvoiceApplication 缺少软删除过滤
  ```
  inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:344]** P1-MissingSoftDelete: 查询 InvoiceApplication 缺少软删除过滤
  ```
  inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:358]** P1-MissingSoftDelete: 查询 InvoiceApplication 缺少软删除过滤
  ```
  inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:370]** P1-MissingSoftDelete: 查询 InvoiceApplication 缺少软删除过滤
  ```
  inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:383]** P1-MissingSoftDelete: 查询 InvoiceApplication 缺少软删除过滤
  ```
  inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:416]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  a = db.query(Article).filter(Article.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:435]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  a = db.query(Article).filter(Article.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:452]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  q = db.query(Article)
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:471]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  q = db.query(Article).filter(Article.status == 1)  # published
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:485]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  items = db.query(Article).filter(Article.id.in_(id_list)).all()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:492]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  a = db.query(Article).filter(Article.id == id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:502]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  a = db.query(Article).filter(Article.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:512]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  a = db.query(Article).filter(Article.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:525]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  q = db.query(Article).filter(Article.is_recommend == True, Article.status == 1)  # noqa: E712
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:534]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  a = db.query(Article).filter(Article.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:544]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  a = db.query(Article).filter(Article.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:554]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  items = db.query(Article).filter(Article.is_top == True, Article.status == 1).order_by(Article.id.desc()).all()  # noqa:
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:564]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  count = db.query(Article).filter(Article.member_id == member_id).count()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:604]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  e = db.query(Exam).filter(Exam.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:632]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  q = db.query(Exam).filter(Exam.type == type)
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:652]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  q = db.query(Exam).filter(Exam.type == type, Exam.status == 1)
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:663]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  e = db.query(Exam).filter(Exam.id == id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:672]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  e = db.query(Exam).filter(Exam.id == id, Exam.status == 1).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:681]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  e = db.query(Exam).filter(Exam.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:691]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  e = db.query(Exam).filter(Exam.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:701]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  e = db.query(Exam).filter(Exam.id == req.id).first()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:711]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  items = db.query(Exam).filter(Exam.status == 1).order_by(Exam.id.desc()).limit(10).all()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:722]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  q = db.query(Exam).filter(Exam.status == 1)
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:735]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  items = db.query(Exam).filter(Exam.id.in_(id_list), Exam.status == 1).all()
  ```
- **[app\api\v1\article_invoice_exam_legacy.py:751]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  q = db.query(Exam).join(ExamSignUp, ExamSignUp.exam_id == Exam.id).filter(ExamSignUp.member_id == member_id)
  ```
- **[app\api\v1\legacy_supplement.py:75]** P1-MissingSoftDelete: 查询 ZhsActivity 缺少软删除过滤
  ```
  item = db.query(ZhsActivity).filter(ZhsActivity.id == activity_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:87]** P1-MissingSoftDelete: 查询 ZhsActivity 缺少软删除过滤
  ```
  item = db.query(ZhsActivity).filter(ZhsActivity.id == activity_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:97]** P1-MissingSoftDelete: 查询 ZhsActivity 缺少软删除过滤
  ```
  items = db.query(ZhsActivity).order_by(ZhsActivity.id.desc()).limit(1000).all()
  ```
- **[app\api\v1\legacy_supplement.py:104]** P1-MissingSoftDelete: 查询 ZhsActivity 缺少软删除过滤
  ```
  total = db.query(ZhsActivity).count()
  ```
- **[app\api\v1\legacy_supplement.py:105]** P1-MissingSoftDelete: 查询 ZhsActivity 缺少软删除过滤
  ```
  active = db.query(ZhsActivity).filter(ZhsActivity.status == 1).count()
  ```
- **[app\api\v1\legacy_supplement.py:116]** P1-MissingSoftDelete: 查询 ZhsAgentSettlement 缺少软删除过滤
  ```
  item = db.query(ZhsAgentSettlement).filter(ZhsAgentSettlement.id == settlement_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:128]** P1-MissingSoftDelete: 查询 ZhsAgentSettlement 缺少软删除过滤
  ```
  q = db.query(ZhsAgentSettlement)
  ```
- **[app\api\v1\legacy_supplement.py:145]** P1-MissingSoftDelete: 查询 ZhsAgentUsedetail 缺少软删除过滤
  ```
  q = db.query(ZhsAgentUsedetail)
  ```
- **[app\api\v1\legacy_supplement.py:165]** P1-MissingSoftDelete: 查询 ZhsInformation 缺少软删除过滤
  ```
  item = db.query(ZhsInformation).filter(ZhsInformation.id == info_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:177]** P1-MissingSoftDelete: 查询 ZhsInformation 缺少软删除过滤
  ```
  item = db.query(ZhsInformation).filter(ZhsInformation.id == info_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:187]** P1-MissingSoftDelete: 查询 ZhsInformation 缺少软删除过滤
  ```
  item = db.query(ZhsInformation).filter(ZhsInformation.id == info_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:205]** P1-MissingSoftDelete: 查询 ZhsUserAgentImage 缺少软删除过滤
  ```
  item = db.query(ZhsUserAgentImage).filter(ZhsUserAgentImage.id == image_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:222]** P1-MissingSoftDelete: 查询 ZhsUserAgentImage 缺少软删除过滤
  ```
  items = db.query(ZhsUserAgentImage).filter(ZhsUserAgentImage.id.in_(req.ids)).all()
  ```
- **[app\api\v1\legacy_supplement.py:242]** P1-MissingSoftDelete: 查询 UserThirdPartyAccount 缺少软删除过滤
  ```
  existing = db.query(UserThirdPartyAccount).filter(
  ```
- **[app\api\v1\legacy_supplement.py:262]** P1-MissingSoftDelete: 查询 UserThirdPartyAccount 缺少软删除过滤
  ```
  item = db.query(UserThirdPartyAccount).filter(
  ```
- **[app\api\v1\legacy_supplement.py:278]** P1-MissingSoftDelete: 查询 UserThirdPartyAccount 缺少软删除过滤
  ```
  q = db.query(UserThirdPartyAccount)
  ```
- **[app\api\v1\legacy_supplement.py:291]** P1-MissingSoftDelete: 查询 UserThirdPartyAccount 缺少软删除过滤
  ```
  items = db.query(UserThirdPartyAccount).filter(UserThirdPartyAccount.user_uuid == user_uuid).all()
  ```
- **[app\api\v1\legacy_supplement.py:307]** P1-MissingSoftDelete: 查询 AiFileStorage 缺少软删除过滤
  ```
  item = db.query(AiFileStorage).filter(AiFileStorage.file_id == file_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:316]** P1-MissingSoftDelete: 查询 AiFileStorage 缺少软删除过滤
  ```
  item = db.query(AiFileStorage).filter(AiFileStorage.file_id == file_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:329]** P1-MissingSoftDelete: 查询 AiFileStorage 缺少软删除过滤
  ```
  items = db.query(AiFileStorage).filter(AiFileStorage.file_id.in_(req.ids)).all()
  ```
- **[app\api\v1\legacy_supplement.py:338]** P1-MissingSoftDelete: 查询 AiFileStorage 缺少软删除过滤
  ```
  total = db.query(AiFileStorage).count()
  ```
- **[app\api\v1\legacy_supplement.py:339]** P1-MissingSoftDelete: 查询 AiFileStorage 缺少软删除过滤
  ```
  active = db.query(AiFileStorage).filter(AiFileStorage.status == 0).count()
  ```
- **[app\api\v1\legacy_supplement.py:350]** P1-MissingSoftDelete: 查询 UserAuthInfo 缺少软删除过滤
  ```
  item = db.query(UserAuthInfo).filter(UserAuthInfo.id == identity_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:363]** P1-MissingSoftDelete: 查询 UserAuthInfo 缺少软删除过滤
  ```
  q = db.query(UserAuthInfo)
  ```
- **[app\api\v1\legacy_supplement.py:377]** P1-MissingSoftDelete: 查询 ZhsUserCommentLog 缺少软删除过滤
  ```
  item = db.query(ZhsUserCommentLog).filter(ZhsUserCommentLog.id == log_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:386]** P1-MissingSoftDelete: 查询 ZhsUserCommentLog 缺少软删除过滤
  ```
  item = db.query(ZhsUserCommentLog).filter(ZhsUserCommentLog.id == log_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:396]** P1-MissingSoftDelete: 查询 ZhsUserCommentLog 缺少软删除过滤
  ```
  items = db.query(ZhsUserCommentLog).order_by(ZhsUserCommentLog.id.desc()).limit(1000).all()
  ```
- **[app\api\v1\legacy_supplement.py:410]** P1-MissingSoftDelete: 查询 ZhsUserVideoComment 缺少软删除过滤
  ```
  q = db.query(ZhsUserVideoComment)
  ```
- **[app\api\v1\legacy_supplement.py:429]** P1-MissingSoftDelete: 查询 Lecturer 缺少软删除过滤
  ```
  q = db.query(Lecturer)
  ```
- **[app\api\v1\legacy_supplement.py:440]** P1-MissingSoftDelete: 查询 Lecturer 缺少软删除过滤
  ```
  item = db.query(Lecturer).filter(Lecturer.id == lecturer_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:449]** P1-MissingSoftDelete: 查询 Lecturer 缺少软删除过滤
  ```
  item = db.query(Lecturer).filter(Lecturer.id == lecturer_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:463]** P1-MissingSoftDelete: 查询 Department 缺少软删除过滤
  ```
  items = db.query(Department).order_by(Department.sort_order.asc()).all()
  ```
- **[app\api\v1\legacy_supplement.py:489]** P1-MissingSoftDelete: 查询 Company 缺少软删除过滤
  ```
  item = db.query(Company).filter(Company.id == company_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:498]** P1-MissingSoftDelete: 查询 Company 缺少软删除过滤
  ```
  item = db.query(Company).filter(Company.id == company_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:636]** P1-MissingSoftDelete: 查询 ZhsOperateTokenFlow 缺少软删除过滤
  ```
  item = db.query(ZhsOperateTokenFlow).filter(ZhsOperateTokenFlow.id == flow_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:649]** P1-MissingSoftDelete: 查询 ZhsOperateTokenFlow 缺少软删除过滤
  ```
  item = db.query(ZhsOperateTokenFlow).filter(ZhsOperateTokenFlow.id == flow_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:662]** P1-MissingSoftDelete: 查询 ZhsOperateTokenFlow 缺少软删除过滤
  ```
  q = db.query(ZhsOperateTokenFlow)
  ```
- **[app\api\v1\legacy_supplement.py:682]** P1-MissingSoftDelete: 查询 ZhsCoursePayLog 缺少软删除过滤
  ```
  q = db.query(ZhsCoursePayLog)
  ```
- **[app\api\v1\legacy_supplement.py:695]** P1-MissingSoftDelete: 查询 ZhsCoursePayLog 缺少软删除过滤
  ```
  item = db.query(ZhsCoursePayLog).filter(ZhsCoursePayLog.id == pay_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:709]** P1-MissingSoftDelete: 查询 ZhsCoursePayLog 缺少软删除过滤
  ```
  item = db.query(ZhsCoursePayLog).filter(ZhsCoursePayLog.id == req.pay_id).first()
  ```
- **[app\api\v1\legacy_supplement.py:723]** P1-MissingSoftDelete: 查询 ZhsCoursePayLog 缺少软删除过滤
  ```
  q = db.query(ZhsCoursePayLog)
  ```
- **[app\api\v1\orders.py:176]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  order = db.query(Order).filter(
  ```
- **[app\api\v1\orders.py:245]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  q = db.query(Order)
  ```
- **[app\api\v1\orders.py:277]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  q = db.query(Order).filter(Order.user_id == user_id)
  ```
- **[app\api\v1\orders.py:310]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  order = db.query(Order).filter(
  ```
- **[app\api\v1\orders.py:334]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  order = db.query(Order).filter(Order.id == order_id).first()
  ```
- **[app\api\v1\orders.py:367]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  order = db.query(Order).filter(Order.id == order_id).first()
  ```
- **[app\api\v1\orders.py:396]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  order = db.query(Order).filter(
  ```
- **[app\api\v1\orders.py:422]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  order = db.query(Order).filter(Order.id == order_id).first()
  ```
- **[app\api\v1\remote.py:102]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  q = db.query(User).filter(User.parent_id == uuid, User.status == 1)
  ```
- **[app\api\v1\remote.py:152]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == uuid).first()
  ```
- **[app\api\v1\remote.py:208]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == body.id).first()
  ```
- **[app\api\v1\remote.py:224]** P1-MissingSoftDelete: 查询 ProductIdentity 缺少软删除过滤
  ```
  items = db.query(ProductIdentity).filter(ProductIdentity.status == 1).order_by(ProductIdentity.sort.asc()).all()
  ```
- **[app\api\v1\remote.py:253]** P1-MissingSoftDelete: 查询 AgentCategory 缺少软删除过滤
  ```
  q = db.query(AgentCategory)
  ```
- **[app\api\v1\remote.py:297]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  q = db.query(Agent)
  ```
- **[app\api\v1\remote.py:351]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  q = db.query(Agent).filter(Agent.agent_id.in_(collected_ids))
  ```
- **[app\api\v1\remote.py:392]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  db.query(Agent)
  ```
- **[app\api\v1\remote.py:486]** P1-MissingSoftDelete: 查询 WithdrawalFlow 缺少软删除过滤
  ```
  flow = db.query(WithdrawalFlow).filter(WithdrawalFlow.id == 1).first()
  ```
- **[app\api\v1\admin\exam\routes.py:25]** P1-MissingSoftDelete: 查询 ExamCategory 缺少软删除过滤
  ```
  q = db.query(ExamCategory)
  ```
- **[app\api\v1\admin\exam\routes.py:50]** P1-MissingSoftDelete: 查询 ExamCategory 缺少软删除过滤
  ```
  c = db.query(ExamCategory).filter(ExamCategory.id == cid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:68]** P1-MissingSoftDelete: 查询 ExamCategory 缺少软删除过滤
  ```
  c = db.query(ExamCategory).filter(ExamCategory.id == cid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:80]** P1-MissingSoftDelete: 查询 ExamCategory 缺少软删除过滤
  ```
  db.query(ExamCategory).filter(ExamCategory.id.in_(id_list)).delete(synchronize_session=False)
  ```
- **[app\api\v1\admin\exam\routes.py:91]** P1-MissingSoftDelete: 查询 ExamCategory 缺少软删除过滤
  ```
  q = db.query(ExamCategory)
  ```
- **[app\api\v1\admin\exam\routes.py:111]** P1-MissingSoftDelete: 查询 ExamCategory 缺少软删除过滤
  ```
  c = db.query(ExamCategory).filter(ExamCategory.id == cid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:129]** P1-MissingSoftDelete: 查询 ExamCategory 缺少软删除过滤
  ```
  c = db.query(ExamCategory).filter(ExamCategory.id == cid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:141]** P1-MissingSoftDelete: 查询 ExamCategory 缺少软删除过滤
  ```
  db.query(ExamCategory).filter(ExamCategory.id.in_(id_list)).delete(synchronize_session=False)
  ```
- **[app\api\v1\admin\exam\routes.py:185]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  q = db.query(ExamPaper)
  ```
- **[app\api\v1\admin\exam\routes.py:202]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  q = db.query(ExamPaper).filter(ExamPaper.type == 3)
  ```
- **[app\api\v1\admin\exam\routes.py:212]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  q = db.query(ExamPaper).filter(ExamPaper.type == 1)
  ```
- **[app\api\v1\admin\exam\routes.py:222]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  q = db.query(ExamPaper).filter(ExamPaper.type == 2)
  ```
- **[app\api\v1\admin\exam\routes.py:232]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  p = db.query(ExamPaper).filter(ExamPaper.id == pid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:250]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  p = db.query(ExamPaper).filter(ExamPaper.id == pid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:288]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  p = db.query(ExamPaper).filter(ExamPaper.id == pid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:292]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  db.query(ExamQuestion).filter(ExamQuestion.paper_id == pid).delete(synchronize_session=False)
  ```
- **[app\api\v1\admin\exam\routes.py:302]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  db.query(ExamQuestion).filter(ExamQuestion.paper_id.in_(paper_ids)).delete(synchronize_session=False)
  ```
- **[app\api\v1\admin\exam\routes.py:303]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  db.query(ExamPaper).filter(ExamPaper.id.in_(id_list)).delete(synchronize_session=False)
  ```
- **[app\api\v1\admin\exam\routes.py:333]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  q = db.query(ExamQuestion)
  ```
- **[app\api\v1\admin\exam\routes.py:348]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  q = db.query(ExamQuestion).filter(ExamQuestion.id == qid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:360]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  db.query(ExamPaper).filter(ExamPaper.id == paper_id).update({ExamPaper.question_num: ExamPaper.question_num + 1})
  ```
- **[app\api\v1\admin\exam\routes.py:392]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  q = db.query(ExamQuestion).filter(ExamQuestion.id == qid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:397]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  db.query(ExamPaper).filter(ExamPaper.id == paper_id).update({ExamPaper.question_num: ExamPaper.question_num - 1})
  ```
- **[app\api\v1\admin\exam\routes.py:407]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  db.query(ExamQuestion).filter(ExamQuestion.id.in_(id_list)).delete(synchronize_session=False)
  ```
- **[app\api\v1\admin\exam\routes.py:409]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  db.query(ExamPaper).filter(ExamPaper.id.in_(paper_ids)).update(
  ```
- **[app\api\v1\admin\exam\routes.py:444]** P1-MissingSoftDelete: 查询 ExamRecord 缺少软删除过滤
  ```
  q = db.query(ExamRecord)
  ```
- **[app\api\v1\admin\exam\routes.py:459]** P1-MissingSoftDelete: 查询 ExamRecord 缺少软删除过滤
  ```
  r = db.query(ExamRecord).filter(ExamRecord.id == rid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:468]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  question_rows = db.query(ExamQuestion).filter(ExamQuestion.paper_id == r.paper_id).all()
  ```
- **[app\api\v1\admin\exam\routes.py:489]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  p = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
  ```
- **[app\api\v1\admin\exam\routes.py:501]** P1-MissingSoftDelete: 查询 ExamRecord 缺少软删除过滤
  ```
  r = db.query(ExamRecord).filter(ExamRecord.id == rid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:520]** P1-MissingSoftDelete: 查询 ExamRecord 缺少软删除过滤
  ```
  r = db.query(ExamRecord).filter(ExamRecord.id == rid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:532]** P1-MissingSoftDelete: 查询 ExamRecord 缺少软删除过滤
  ```
  db.query(ExamRecord).filter(ExamRecord.id.in_(id_list)).delete(synchronize_session=False)
  ```
- **[app\api\v1\admin\exam\routes.py:543]** P1-MissingSoftDelete: 查询 ExamWrongQuestion 缺少软删除过滤
  ```
  q = db.query(ExamWrongQuestion)
  ```
- **[app\api\v1\admin\exam\routes.py:590]** P1-MissingSoftDelete: 查询 ExamChapter 缺少软删除过滤
  ```
  q = db.query(ExamChapter)
  ```
- **[app\api\v1\admin\exam\routes.py:610]** P1-MissingSoftDelete: 查询 ExamChapter 缺少软删除过滤
  ```
  chapter = db.query(ExamChapter).filter(ExamChapter.id == cid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:628]** P1-MissingSoftDelete: 查询 ExamChapter 缺少软删除过滤
  ```
  chapter = db.query(ExamChapter).filter(ExamChapter.id == cid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:652]** P1-MissingSoftDelete: 查询 ExamChapter 缺少软删除过滤
  ```
  chapter = db.query(ExamChapter).filter(ExamChapter.id == cid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:656]** P1-MissingSoftDelete: 查询 ExamChapterSection 缺少软删除过滤
  ```
  db.query(ExamChapterSection).filter(ExamChapterSection.chapter_id == cid).delete(synchronize_session=False)
  ```
- **[app\api\v1\admin\exam\routes.py:665]** P1-MissingSoftDelete: 查询 ExamChapterSection 缺少软删除过滤
  ```
  db.query(ExamChapterSection).filter(ExamChapterSection.chapter_id.in_(id_list)).delete(synchronize_session=False)
  ```
- **[app\api\v1\admin\exam\routes.py:666]** P1-MissingSoftDelete: 查询 ExamChapter 缺少软删除过滤
  ```
  db.query(ExamChapter).filter(ExamChapter.id.in_(id_list)).delete(synchronize_session=False)
  ```
- **[app\api\v1\admin\exam\routes.py:695]** P1-MissingSoftDelete: 查询 ExamChapterSection 缺少软删除过滤
  ```
  q = db.query(ExamChapterSection)
  ```
- **[app\api\v1\admin\exam\routes.py:717]** P1-MissingSoftDelete: 查询 ExamChapterSection 缺少软删除过滤
  ```
  section = db.query(ExamChapterSection).filter(ExamChapterSection.id == sid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:735]** P1-MissingSoftDelete: 查询 ExamChapterSection 缺少软删除过滤
  ```
  section = db.query(ExamChapterSection).filter(ExamChapterSection.id == sid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:765]** P1-MissingSoftDelete: 查询 ExamChapterSection 缺少软删除过滤
  ```
  section = db.query(ExamChapterSection).filter(ExamChapterSection.id == sid).first()
  ```
- **[app\api\v1\admin\exam\routes.py:777]** P1-MissingSoftDelete: 查询 ExamChapterSection 缺少软删除过滤
  ```
  db.query(ExamChapterSection).filter(ExamChapterSection.id.in_(id_list)).delete(synchronize_session=False)
  ```
- **[app\api\v1\advertise\advertise.py:58]** P1-MissingSoftDelete: 查询 AdvertisePosition 缺少软删除过滤
  ```
  items = db.query(AdvertisePosition).filter(AdvertisePosition.status == 1).all()
  ```
- **[app\api\v1\advertise\advertise.py:101]** P1-MissingSoftDelete: 查询 Advertise 缺少软删除过滤
  ```
  q = db.query(Advertise)
  ```
- **[app\api\v1\advertise\advertise.py:144]** P1-MissingSoftDelete: 查询 Advertise 缺少软删除过滤
  ```
  a = db.query(Advertise).filter(Advertise.id == aid).first()
  ```
- **[app\api\v1\advertise\advertise.py:212]** P1-MissingSoftDelete: 查询 Advertise 缺少软删除过滤
  ```
  a = db.query(Advertise).filter(Advertise.id == aid).first()
  ```
- **[app\api\v1\advertise\advertise.py:235]** P1-MissingSoftDelete: 查询 Advertise 缺少软删除过滤
  ```
  a = db.query(Advertise).filter(Advertise.id == aid).first()
  ```
- **[app\api\v1\advertise\advertise.py:249]** P1-MissingSoftDelete: 查询 Advertise 缺少软删除过滤
  ```
  a = db.query(Advertise).filter(Advertise.id == aid).first()
  ```
- **[app\api\v1\agents\buy.py:48]** P1-MissingSoftDelete: 查询 AgentBuy 缺少软删除过滤
  ```
  q = db.query(AgentBuy).filter(AgentBuy.bug_uuid == user_uuid)
  ```
- **[app\api\v1\agents\buy.py:63]** P1-MissingSoftDelete: 查询 AgentBuy 缺少软删除过滤
  ```
  record = db.query(AgentBuy).filter(AgentBuy.id == record_id).first()
  ```
- **[app\api\v1\agents\buy.py:81]** P1-MissingSoftDelete: 查询 AgentBuy 缺少软删除过滤
  ```
  q = db.query(AgentBuy).filter(and_(AgentBuy.bug_uuid == user_uuid, AgentBuy.agent_id == agent_id))
  ```
- **[app\api\v1\agents\buy.py:96]** P1-MissingSoftDelete: 查询 AgentBuy 缺少软删除过滤
  ```
  record = db.query(AgentBuy).filter(AgentBuy.order_no == order_no).first()
  ```
- **[app\api\v1\agents\buy.py:112]** P1-MissingSoftDelete: 查询 AgentBuy 缺少软删除过滤
  ```
  q = db.query(AgentBuy).filter(AgentBuy.status == "1")
  ```
- **[app\api\v1\agents\buy.py:127]** P1-MissingSoftDelete: 查询 AgentBuy 缺少软删除过滤
  ```
  record = db.query(AgentBuy).filter(AgentBuy.id == record_id).first()
  ```
- **[app\api\v1\agents\cache.py:32]** P1-MissingSoftDelete: 查询 AgentCategory 缺少软删除过滤
  ```
  items = db.query(AgentCategory).limit(1000).all()
  ```
- **[app\api\v1\agents\categories.py:101]** P1-MissingSoftDelete: 查询 AgentCategory 缺少软删除过滤
  ```
  cat = db.query(AgentCategory).filter(AgentCategory.id == category_id).first()
  ```
- **[app\api\v1\agents\categories.py:120]** P1-MissingSoftDelete: 查询 AgentCategory 缺少软删除过滤
  ```
  cat = db.query(AgentCategory).filter(AgentCategory.id == category_id).first()
  ```
- **[app\api\v1\agents\categories.py:145]** P1-MissingSoftDelete: 查询 AgentCategory 缺少软删除过滤
  ```
  cat = db.query(AgentCategory).filter(AgentCategory.id == category_id).first()
  ```
- **[app\api\v1\agents\category_link.py:43]** P1-MissingSoftDelete: 查询 AgentCategoryLink 缺少软删除过滤
  ```
  q = db.query(AgentCategoryLink)
  ```
- **[app\api\v1\agents\category_link.py:57]** P1-MissingSoftDelete: 查询 AgentCategoryLink 缺少软删除过滤
  ```
  existing = db.query(AgentCategoryLink).filter(
  ```
- **[app\api\v1\agents\category_link.py:73]** P1-MissingSoftDelete: 查询 AgentCategoryLink 缺少软删除过滤
  ```
  item = db.query(AgentCategoryLink).filter(AgentCategoryLink.id == link_id).first()
  ```
- **[app\api\v1\agents\category_link.py:84]** P1-MissingSoftDelete: 查询 AgentCategoryLink 缺少软删除过滤
  ```
  items = db.query(AgentCategoryLink).filter(AgentCategoryLink.agent_id == agent_id).order_by(AgentCategoryLink.sort_order
  ```
- **[app\api\v1\agents\category_link.py:92]** P1-MissingSoftDelete: 查询 AgentCategoryLink 缺少软删除过滤
  ```
  items = db.query(AgentCategoryLink).filter(AgentCategoryLink.category_id == category_id).order_by(AgentCategoryLink.sort
  ```
- **[app\api\v1\agents\category_link.py:103]** P1-MissingSoftDelete: 查询 AgentCategoryLink 缺少软删除过滤
  ```
  item = db.query(AgentCategoryLink).filter(AgentCategoryLink.id == link_id).first()
  ```
- **[app\api\v1\agents\creation.py:129]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  q = db.query(UserAgentContext).filter(
  ```
- **[app\api\v1\agents\creation.py:160]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  creation = db.query(UserAgentContext).filter(UserAgentContext.gc_id == gc_id).first()
  ```
- **[app\api\v1\agents\creation.py:166]** P1-MissingSoftDelete: 查询 CreationShare 缺少软删除过滤
  ```
  db.query(CreationShare)
  ```
- **[app\api\v1\agents\creation.py:180]** P1-MissingSoftDelete: 查询 CreationShare 缺少软删除过滤
  ```
  while db.query(CreationShare).filter(CreationShare.share_code == share_code).first():
  ```
- **[app\api\v1\agents\creation.py:222]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  creation = db.query(UserAgentContext).filter(UserAgentContext.gc_id == gc_id).first()
  ```
- **[app\api\v1\agents\creation.py:228]** P1-MissingSoftDelete: 查询 CreationOperate 缺少软删除过滤
  ```
  db.query(CreationOperate)
  ```
- **[app\api\v1\agents\creation.py:280]** P1-MissingSoftDelete: 查询 CreationShare 缺少软删除过滤
  ```
  share = db.query(CreationShare).filter(CreationShare.share_code == code).first()
  ```
- **[app\api\v1\agents\creation.py:288]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  creation = db.query(UserAgentContext).filter(UserAgentContext.gc_id == share.gc_id).first()
  ```
- **[app\api\v1\agents\creation.py:319]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  creation = db.query(UserAgentContext).filter(UserAgentContext.gc_id == gc_id).first()
  ```
- **[app\api\v1\agents\creation.py:324]** P1-MissingSoftDelete: 查询 CreationShare 缺少软删除过滤
  ```
  db.query(CreationShare)
  ```
- **[app\api\v1\agents\creation.py:342]** P1-MissingSoftDelete: 查询 CreationShare 缺少软删除过滤
  ```
  while db.query(CreationShare).filter(CreationShare.share_code == share_code).first():
  ```
- **[app\api\v1\agents\creation.py:380]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  creation = db.query(UserAgentContext).filter(UserAgentContext.gc_id == gc_id).first()
  ```
- **[app\api\v1\agents\developer.py:30]** P1-MissingSoftDelete: 查询 AgentDeveloper 缺少软删除过滤
  ```
  db.query(AgentDeveloper)
  ```
- **[app\api\v1\agents\developer.py:64]** P1-MissingSoftDelete: 查询 AgentDeveloper 缺少软删除过滤
  ```
  q = db.query(AgentDeveloper)
  ```
- **[app\api\v1\agents\developer.py:88]** P1-MissingSoftDelete: 查询 AgentDeveloper 缺少软删除过滤
  ```
  items = db.query(AgentDeveloper).filter(AgentDeveloper.user_id == user_uuid).all()
  ```
- **[app\api\v1\agents\developer.py:109]** P1-MissingSoftDelete: 查询 AgentDeveloper 缺少软删除过滤
  ```
  d = db.query(AgentDeveloper).filter(AgentDeveloper.id == record_id).first()
  ```
- **[app\api\v1\agents\developer.py:138]** P1-MissingSoftDelete: 查询 AgentDeveloper 缺少软删除过滤
  ```
  db.query(AgentDeveloper)
  ```
- **[app\api\v1\agents\developer.py:174]** P1-MissingSoftDelete: 查询 AgentDeveloper 缺少软删除过滤
  ```
  db.query(AgentDeveloper)
  ```
- **[app\api\v1\agents\developer.py:196]** P1-MissingSoftDelete: 查询 DeveloperLink 缺少软删除过滤
  ```
  link = db.query(DeveloperLink).filter(DeveloperLink.user_id == user_uuid).first()
  ```
- **[app\api\v1\agents\developer.py:219]** P1-MissingSoftDelete: 查询 DeveloperLink 缺少软删除过滤
  ```
  link = db.query(DeveloperLink).filter(DeveloperLink.user_id == user_uuid).first()
  ```
- **[app\api\v1\agents\developer_link.py:44]** P1-MissingSoftDelete: 查询 DeveloperLink 缺少软删除过滤
  ```
  q = db.query(DeveloperLink)
  ```
- **[app\api\v1\agents\developer_link.py:71]** P1-MissingSoftDelete: 查询 DeveloperLink 缺少软删除过滤
  ```
  item = db.query(DeveloperLink).filter(DeveloperLink.id == item_id).first()
  ```
- **[app\api\v1\agents\developer_link.py:112]** P1-MissingSoftDelete: 查询 DeveloperLink 缺少软删除过滤
  ```
  item = db.query(DeveloperLink).filter(DeveloperLink.id == body.id).first()
  ```
- **[app\api\v1\agents\developer_link.py:137]** P1-MissingSoftDelete: 查询 DeveloperLink 缺少软删除过滤
  ```
  db.query(DeveloperLink).filter(DeveloperLink.id.in_(ids)).delete(synchronize_session=False)
  ```
- **[app\api\v1\agents\developer_link.py:156]** P1-MissingSoftDelete: 查询 DeveloperLink 缺少软删除过滤
  ```
  item = db.query(DeveloperLink).filter(DeveloperLink.id == int(body.id)).first()
  ```
- **[app\api\v1\agents\examine.py:25]** P1-MissingSoftDelete: 查询 AgentExamine 缺少软删除过滤
  ```
  q = db.query(AgentExamine)
  ```
- **[app\api\v1\agents\examine.py:66]** P1-MissingSoftDelete: 查询 AgentExamine 缺少软删除过滤
  ```
  ex = db.query(AgentExamine).filter(AgentExamine.id == record_id).first()
  ```
- **[app\api\v1\agents\examine.py:92]** P1-MissingSoftDelete: 查询 AgentExamine 缺少软删除过滤
  ```
  ex = db.query(AgentExamine).filter(AgentExamine.id == record_id).first()
  ```
- **[app\api\v1\agents\examine.py:105]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  agent = db.query(Agent).filter(Agent.agent_id == ex.agent_id).first()
  ```
- **[app\api\v1\agents\examine.py:126]** P1-MissingSoftDelete: 查询 AgentExamine 缺少软删除过滤
  ```
  ex = db.query(AgentExamine).filter(AgentExamine.id == record_id).first()
  ```
- **[app\api\v1\agents\heat.py:22]** P1-MissingSoftDelete: 查询 AgentHeatStats 缺少软删除过滤
  ```
  db.query(AgentHeatStats)
  ```
- **[app\api\v1\agents\heat.py:53]** P1-MissingSoftDelete: 查询 AgentHeatStats 缺少软删除过滤
  ```
  db.query(AgentHeatStats)
  ```
- **[app\api\v1\agents\identity.py:29]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  q = db.query(Order).filter(Order.user_id == user_uuid)
  ```
- **[app\api\v1\agents\identity.py:40]** P1-MissingSoftDelete: 查询 ProductIdentity 缺少软删除过滤
  ```
  identity = db.query(ProductIdentity).filter(ProductIdentity.id == o.product_identity_id).first()
  ```
- **[app\api\v1\agents\identity.py:67]** P1-MissingSoftDelete: 查询 ProductIdentity 缺少软删除过滤
  ```
  identity = db.query(ProductIdentity).filter(ProductIdentity.id == identity_id).first()
  ```
- **[app\api\v1\agents\identity.py:95]** P1-MissingSoftDelete: 查询 ProductIdentity 缺少软删除过滤
  ```
  identity = db.query(ProductIdentity).filter(ProductIdentity.id == identity_id).first()
  ```
- **[app\api\v1\agents\identity.py:192]** P1-MissingSoftDelete: 查询 IdentityProportion 缺少软删除过滤
  ```
  q = db.query(IdentityProportion)
  ```
- **[app\api\v1\agents\identity.py:252]** P1-MissingSoftDelete: 查询 IdentityProportion 缺少软删除过滤
  ```
  p = db.query(IdentityProportion).filter(IdentityProportion.id == proportion_id).first()
  ```
- **[app\api\v1\agents\rules.py:24]** P1-MissingSoftDelete: 查询 AgentRule 缺少软删除过滤
  ```
  q = db.query(AgentRule)
  ```
- **[app\api\v1\agents\rules.py:82]** P1-MissingSoftDelete: 查询 AgentRule 缺少软删除过滤
  ```
  rule = db.query(AgentRule).filter(AgentRule.id == rule_id).first()
  ```
- **[app\api\v1\agents\rules.py:96]** P1-MissingSoftDelete: 查询 AgentRule 缺少软删除过滤
  ```
  q = db.query(AgentRule).filter(AgentRule.agent_id == agent_id)
  ```
- **[app\api\v1\agents\rules.py:113]** P1-MissingSoftDelete: 查询 AgentNeedTask 缺少软删除过滤
  ```
  q = db.query(AgentNeedTask).filter(AgentNeedTask.user_id == user_uuid)
  ```
- **[app\api\v1\agents\rules.py:175]** P1-MissingSoftDelete: 查询 AgentNeedTask 缺少软删除过滤
  ```
  task = db.query(AgentNeedTask).filter(AgentNeedTask.id == task_id).first()
  ```
- **[app\api\v1\agents\rules.py:196]** P1-MissingSoftDelete: 查询 AgentNeedTask 缺少软删除过滤
  ```
  task = db.query(AgentNeedTask).filter(AgentNeedTask.id == task_id).first()
  ```
- **[app\api\v1\agents\rule_params.py:38]** P1-MissingSoftDelete: 查询 AgentRuleParam 缺少软删除过滤
  ```
  q = db.query(AgentRuleParam)
  ```
- **[app\api\v1\agents\rule_params.py:63]** P1-MissingSoftDelete: 查询 AgentRuleParam 缺少软删除过滤
  ```
  item = db.query(AgentRuleParam).filter(AgentRuleParam.id == item_id).first()
  ```
- **[app\api\v1\agents\rule_params.py:105]** P1-MissingSoftDelete: 查询 AgentRuleParam 缺少软删除过滤
  ```
  item = db.query(AgentRuleParam).filter(AgentRuleParam.id == body.id).first()
  ```
- **[app\api\v1\agents\rule_params.py:130]** P1-MissingSoftDelete: 查询 AgentRuleParam 缺少软删除过滤
  ```
  db.query(AgentRuleParam).filter(AgentRuleParam.id.in_(ids)).delete(synchronize_session=False)
  ```
- **[app\api\v1\agents\settlement.py:25]** P1-MissingSoftDelete: 查询 AgentSettlement 缺少软删除过滤
  ```
  q = db.query(AgentSettlement).filter(AgentSettlement.uuid == user_uuid)
  ```
- **[app\api\v1\agents\settlement.py:76]** P1-MissingSoftDelete: 查询 AgentSettlement 缺少软删除过滤
  ```
  db.query(AgentSettlement)
  ```
- **[app\api\v1\agents\settlement.py:101]** P1-MissingSoftDelete: 查询 AgentSettlement 缺少软删除过滤
  ```
  db.query(AgentSettlement)
  ```
- **[app\api\v1\agents\upload.py:29]** P1-MissingSoftDelete: 查询 AgentUpload 缺少软删除过滤
  ```
  return db.query(AgentUpload).filter(AgentUpload.agent_id == agent_id).first()
  ```
- **[app\api\v1\agents\upload.py:43]** P1-MissingSoftDelete: 查询 AgentUpload 缺少软删除过滤
  ```
  record = db.query(AgentUpload).filter(AgentUpload.agent_id == agent_id).first()
  ```
- **[app\api\v1\agents\upload.py:69]** P1-MissingSoftDelete: 查询 AgentUpload 缺少软删除过滤
  ```
  record = db.query(AgentUpload).filter(AgentUpload.agent_id == agent_id).first()
  ```
- **[app\api\v1\agents\withdrawal.py:27]** P1-MissingSoftDelete: 查询 AgentWithdrawalDetail 缺少软删除过滤
  ```
  q = db.query(AgentWithdrawalDetail).filter(AgentWithdrawalDetail.user_id == user_uuid)
  ```
- **[app\api\v1\agents\withdrawal.py:57]** P1-MissingSoftDelete: 查询 AgentWithdrawalDetail 缺少软删除过滤
  ```
  db.query(AgentWithdrawalDetail)
  ```
- **[app\api\v1\agent_need_task\agent_need_task.py:114]** P1-MissingSoftDelete: 查询 AgentNeedTask 缺少软删除过滤
  ```
  q = db.query(AgentNeedTask)
  ```
- **[app\api\v1\agent_need_task\agent_need_task.py:167]** P1-MissingSoftDelete: 查询 AgentNeedTask 缺少软删除过滤
  ```
  t = db.query(AgentNeedTask).filter(AgentNeedTask.id == tid).first()
  ```
- **[app\api\v1\agent_need_task\agent_need_task.py:208]** P1-MissingSoftDelete: 查询 AgentNeedTask 缺少软删除过滤
  ```
  t = db.query(AgentNeedTask).filter(AgentNeedTask.id == tid).first()
  ```
- **[app\api\v1\agent_need_task\agent_need_task.py:237]** P1-MissingSoftDelete: 查询 AgentNeedTask 缺少软删除过滤
  ```
  t = db.query(AgentNeedTask).filter(AgentNeedTask.id == tid).first()
  ```
- **[app\api\v1\agent_need_task\agent_need_task.py:241]** P1-MissingSoftDelete: 查询 AgentTaskDeveloper 缺少软删除过滤
  ```
  db.query(AgentTaskDeveloper).filter(AgentTaskDeveloper.task_id == tid).delete()
  ```
- **[app\api\v1\agent_need_task\agent_need_task.py:252]** P1-MissingSoftDelete: 查询 AgentNeedTask 缺少软删除过滤
  ```
  t = db.query(AgentNeedTask).filter(AgentNeedTask.id == tid).first()
  ```
- **[app\api\v1\agent_need_task\agent_need_task.py:271]** P1-MissingSoftDelete: 查询 AgentNeedTask 缺少软删除过滤
  ```
  t = db.query(AgentNeedTask).filter(AgentNeedTask.id == tid).first()
  ```
- **[app\api\v1\agent_need_task\agent_need_task.py:276]** P1-MissingSoftDelete: 查询 AgentTaskDeveloper 缺少软删除过滤
  ```
  db.query(AgentTaskDeveloper)
  ```
- **[app\api\v1\agent_need_task\agent_need_task.py:304]** P1-MissingSoftDelete: 查询 AgentTaskDeveloper 缺少软删除过滤
  ```
  items = db.query(AgentTaskDeveloper).filter(AgentTaskDeveloper.task_id == tid).all()
  ```
- **[app\api\v1\agent_upload\agent_upload.py:71]** P1-MissingSoftDelete: 查询 AgentUpload 缺少软删除过滤
  ```
  q = db.query(AgentUpload).filter(AgentUpload.user_id == _uid(), AgentUpload.status == 1)
  ```
- **[app\api\v1\agent_upload\agent_upload.py:96]** P1-MissingSoftDelete: 查询 AgentUpload 缺少软删除过滤
  ```
  u = db.query(AgentUpload).filter(AgentUpload.id == uid, AgentUpload.user_id == _uid()).first()
  ```
- **[app\api\v1\agent_usedetail\agent_usedetail.py:96]** P1-MissingSoftDelete: 查询 AgentStatDaily 缺少软删除过滤
  ```
  db.query(AgentStatDaily)
  ```
- **[app\api\v1\agent_usedetail\agent_usedetail.py:139]** P1-MissingSoftDelete: 查询 AgentUsedetail 缺少软删除过滤
  ```
  q = db.query(AgentUsedetail)
  ```
- **[app\api\v1\agent_usedetail\agent_usedetail.py:183]** P1-MissingSoftDelete: 查询 AgentStatDaily 缺少软删除过滤
  ```
  q = db.query(AgentStatDaily)
  ```
- **[app\api\v1\agent_usedetail\agent_usedetail.py:217]** P1-MissingSoftDelete: 查询 AgentUsedetail 缺少软删除过滤
  ```
  q = db.query(AgentUsedetail)
  ```
- **[app\api\v1\ai\model_info.py:25]** P1-MissingSoftDelete: 查询 AiModelInfo 缺少软删除过滤
  ```
  q = db.query(AiModelInfo).filter(AiModelInfo.status == status)
  ```
- **[app\api\v1\ai\model_info.py:80]** P1-MissingSoftDelete: 查询 AiModelInfo 缺少软删除过滤
  ```
  m = db.query(AiModelInfo).filter(AiModelInfo.id == model_id).first()
  ```
- **[app\api\v1\ai\model_info.py:101]** P1-MissingSoftDelete: 查询 AiModelInfo 缺少软删除过滤
  ```
  m = db.query(AiModelInfo).filter(AiModelInfo.id == model_id).first()
  ```
- **[app\api\v1\ai\model_info.py:192]** P1-MissingSoftDelete: 查询 AiModelInfo 缺少软删除过滤
  ```
  m = db.query(AiModelInfo).filter(AiModelInfo.id == model_id).first()
  ```
- **[app\api\v1\ai\model_info.py:226]** P1-MissingSoftDelete: 查询 AiModelInfo 缺少软删除过滤
  ```
  m = db.query(AiModelInfo).filter(AiModelInfo.id == model_id).first()
  ```
- **[app\api\v1\ai\video_tasks.py:22]** P1-MissingSoftDelete: 查询 VideoGenerationTask 缺少软删除过滤
  ```
  q = db.query(VideoGenerationTask).filter(VideoGenerationTask.user_uuid == user_uuid)
  ```
- **[app\api\v1\ai\video_tasks.py:51]** P1-MissingSoftDelete: 查询 VideoGenerationTask 缺少软删除过滤
  ```
  db.query(VideoGenerationTask)
  ```
- **[app\api\v1\ai\n8n\route.py:186]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user_record = db2.query(User).filter(User.uuid == agent_data.connector_user_id).first()
  ```
- **[app\api\v1\app_version\app_version.py:42]** P1-MissingSoftDelete: 查询 AppVersion 缺少软删除过滤
  ```
  q = db.query(AppVersion)
  ```
- **[app\api\v1\app_version\app_version.py:65]** P1-MissingSoftDelete: 查询 AppVersion 缺少软删除过滤
  ```
  latest = db.query(AppVersion).filter(
  ```
- **[app\api\v1\app_version\app_version.py:119]** P1-MissingSoftDelete: 查询 AppVersion 缺少软删除过滤
  ```
  v = db.query(AppVersion).filter(AppVersion.id == vid).first()
  ```
- **[app\api\v1\app_version\app_version.py:138]** P1-MissingSoftDelete: 查询 AppVersion 缺少软删除过滤
  ```
  v = db.query(AppVersion).filter(AppVersion.id == vid).first()
  ```
- **[app\api\v1\ask\answer.py:41]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  q = db.query(AskQuestion).filter(AskQuestion.id == body.question_id).first()
  ```
- **[app\api\v1\ask\answer.py:64]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  a = db.query(AskAnswer).filter(AskAnswer.id == body.id).first()
  ```
- **[app\api\v1\ask\answer.py:79]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  a = db.query(AskAnswer).filter(AskAnswer.id == id).first()
  ```
- **[app\api\v1\ask\answer.py:83]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  q = db.query(AskQuestion).filter(AskQuestion.id == a.question_id).first()
  ```
- **[app\api\v1\ask\answer.py:101]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  q = db.query(AskAnswer).filter(AskAnswer.deleted.is_(False))
  ```
- **[app\api\v1\ask\answer.py:124]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  q = db.query(AskAnswer).filter(AskAnswer.deleted.is_(False))
  ```
- **[app\api\v1\ask\answer.py:144]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  a = db.query(AskAnswer).filter(AskAnswer.id == id, AskAnswer.deleted.is_(False)).first()
  ```
- **[app\api\v1\ask\answer.py:159]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  db.query(AskAnswer)
  ```
- **[app\api\v1\ask\answer.py:176]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  a = db.query(AskAnswer).filter(AskAnswer.id == id).first()
  ```
- **[app\api\v1\ask\answer.py:179]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  db.query(AskAnswer).filter(AskAnswer.question_id == a.question_id).update({AskAnswer.is_adopted: False})
  ```
- **[app\api\v1\ask\category.py:39]** P1-MissingSoftDelete: 查询 AskCategory 缺少软删除过滤
  ```
  q = db.query(AskCategory)
  ```
- **[app\api\v1\ask\category.py:58]** P1-MissingSoftDelete: 查询 AskCategory 缺少软删除过滤
  ```
  q = db.query(AskCategory).filter(AskCategory.is_show)
  ```
- **[app\api\v1\ask\category.py:74]** P1-MissingSoftDelete: 查询 AskCategory 缺少软删除过滤
  ```
  c = db.query(AskCategory).filter(AskCategory.id == cat_id).first()
  ```
- **[app\api\v1\ask\category.py:89]** P1-MissingSoftDelete: 查询 AskCategory 缺少软删除过滤
  ```
  p = db.query(AskCategory).filter(AskCategory.id == body.pid).first()
  ```
- **[app\api\v1\ask\category.py:113]** P1-MissingSoftDelete: 查询 AskCategory 缺少软删除过滤
  ```
  c = db.query(AskCategory).filter(AskCategory.id == body.id).first()
  ```
- **[app\api\v1\ask\category.py:138]** P1-MissingSoftDelete: 查询 AskCategory 缺少软删除过滤
  ```
  c = db.query(AskCategory).filter(AskCategory.id == cat_id).first()
  ```
- **[app\api\v1\ask\category.py:141]** P1-MissingSoftDelete: 查询 AskCategory 缺少软删除过滤
  ```
  has_child = db.query(AskCategory).filter(AskCategory.pid == cat_id).count() > 0
  ```
- **[app\api\v1\ask\category.py:155]** P1-MissingSoftDelete: 查询 AskCategory 缺少软删除过滤
  ```
  c = db.query(AskCategory).filter(AskCategory.id == id).first()
  ```
- **[app\api\v1\ask\category.py:169]** P1-MissingSoftDelete: 查询 AskCategory 缺少软删除过滤
  ```
  c = db.query(AskCategory).filter(AskCategory.id == id).first()
  ```
- **[app\api\v1\ask\question.py:63]** P1-MissingSoftDelete: 查询 AskLike 缺少软删除过滤
  ```
  db.query(AskLike).filter(AskLike.user_id == uid, AskLike.target_type == t, AskLike.target_id == tid).first()
  ```
- **[app\api\v1\ask\question.py:99]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  q = db.query(AskQuestion).filter(
  ```
- **[app\api\v1\ask\question.py:113]** P1-MissingSoftDelete: 查询 AskQuestionCategory 缺少软删除过滤
  ```
  db.query(AskQuestionCategory).filter(AskQuestionCategory.question_id == q.id).delete()
  ```
- **[app\api\v1\ask\question.py:126]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  q = db.query(AskQuestion).filter(AskQuestion.id == id).first()
  ```
- **[app\api\v1\ask\question.py:130]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  db.query(AskAnswer).filter(AskAnswer.question_id == id).update({AskAnswer.deleted: True})
  ```
- **[app\api\v1\ask\question.py:150]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  q = db.query(AskQuestion).filter(AskQuestion.deleted.is_(False))
  ```
- **[app\api\v1\ask\question.py:175]** P1-MissingSoftDelete: 查询 AskQuestionCategory 缺少软删除过滤
  ```
  db.query(AskQuestionCategory)
  ```
- **[app\api\v1\ask\question.py:184]** P1-MissingSoftDelete: 查询 AskCategory 缺少软删除过滤
  ```
  crows = db.query(AskCategory).filter(AskCategory.id.in_(list(all_cids))).all()
  ```
- **[app\api\v1\ask\question.py:207]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  q = db.query(AskQuestion).filter(
  ```
- **[app\api\v1\ask\question.py:231]** P1-MissingSoftDelete: 查询 AskQuestionCategory 缺少软删除过滤
  ```
  db.query(AskQuestionCategory)
  ```
- **[app\api\v1\ask\question.py:240]** P1-MissingSoftDelete: 查询 AskCategory 缺少软删除过滤
  ```
  crows = db.query(AskCategory).filter(AskCategory.id.in_(list(all_cids))).all()
  ```
- **[app\api\v1\ask\question.py:256]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  q = db.query(AskQuestion).filter(AskQuestion.id == id, AskQuestion.deleted.is_(False)).first()
  ```
- **[app\api\v1\ask\question.py:260]** P1-MissingSoftDelete: 查询 AskQuestionCategory 缺少软删除过滤
  ```
  qcs = db.query(AskQuestionCategory).filter(AskQuestionCategory.question_id == id).all()
  ```
- **[app\api\v1\ask\question.py:264]** P1-MissingSoftDelete: 查询 AskCategory 缺少软删除过滤
  ```
  crows = db.query(AskCategory).filter(AskCategory.id.in_(cids)).all()
  ```
- **[app\api\v1\ask\question.py:279]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  db.query(AskQuestion)
  ```
- **[app\api\v1\ask\question.py:298]** P1-MissingSoftDelete: 查询 AskLike 缺少软删除过滤
  ```
  db.query(AskLike)
  ```
- **[app\api\v1\ask\question.py:313]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  q = db.query(AskQuestion).filter(AskQuestion.id == target_id).first()
  ```
- **[app\api\v1\ask\question.py:317]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  a = db.query(AskAnswer).filter(AskAnswer.id == target_id).first()
  ```
- **[app\api\v1\ask\question.py:332]** P1-MissingSoftDelete: 查询 AskFavorite 缺少软删除过滤
  ```
  db.query(AskFavorite)
  ```
- **[app\api\v1\ask\question.py:368]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  q = db.query(AskQuestion).filter(AskQuestion.id == body.target_id).first()
  ```
- **[app\api\v1\ask\question.py:372]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  a = db.query(AskAnswer).filter(AskAnswer.id == body.target_id).first()
  ```
- **[app\api\v1\auth\ali_login.py:127]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == third.user_uuid).first()
  ```
- **[app\api\v1\auth\ali_login.py:165]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == third.user_uuid).first()
  ```
- **[app\api\v1\auth\bindings.py:60]** P1-MissingSoftDelete: 查询 UserThirdPartyAccount 缺少软删除过滤
  ```
  db.query(UserThirdPartyAccount)
  ```
- **[app\api\v1\auth\bindings.py:101]** P1-MissingSoftDelete: 查询 UserThirdPartyAccount 缺少软删除过滤
  ```
  db.query(UserThirdPartyAccount)
  ```
- **[app\api\v1\auth\legacy_local.py:68]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\legacy_local.py:97]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\login.py:225]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\login.py:231]** P1-MissingSoftDelete: 查询 UserAuthInfo 缺少软删除过滤
  ```
  auth = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\login.py:298]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\login.py:331]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\login.py:363]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\login.py:366]** P1-MissingSoftDelete: 查询 UserAuthInfo 缺少软删除过滤
  ```
  auth = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\login.py:396]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\login.py:424]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db2.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\login.py:427]** P1-MissingSoftDelete: 查询 UserAuthInfo 缺少软删除过滤
  ```
  auth = db2.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\login.py:428]** P1-MissingSoftDelete: 查询 UserMargin 缺少软删除过滤
  ```
  margin = db2.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\login.py:444]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  sys_user = db1.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\oauth.py:34]** P1-MissingSoftDelete: 查询 OAuthApp 缺少软删除过滤
  ```
  app = db.query(OAuthApp).filter(OAuthApp.client_id == client_id).first()
  ```
- **[app\api\v1\auth\oauth.py:69]** P1-MissingSoftDelete: 查询 OAuthApp 缺少软删除过滤
  ```
  db.query(OAuthApp)
  ```
- **[app\api\v1\auth\oauth.py:79]** P1-MissingSoftDelete: 查询 OAuthSession 缺少软删除过滤
  ```
  db.query(OAuthSession)
  ```
- **[app\api\v1\auth\oauth.py:169]** P1-MissingSoftDelete: 查询 OAuthApp 缺少软删除过滤
  ```
  total = db.query(OAuthApp).count()
  ```
- **[app\api\v1\auth\oauth.py:170]** P1-MissingSoftDelete: 查询 OAuthApp 缺少软删除过滤
  ```
  items = db.query(OAuthApp).order_by(OAuthApp.id.desc()).offset((page - 1) * limit).limit(limit).all()
  ```
- **[app\api\v1\auth\oauth.py:186]** P1-MissingSoftDelete: 查询 OAuthApp 缺少软删除过滤
  ```
  app = db.query(OAuthApp).filter(OAuthApp.client_id == client_id).first()
  ```
- **[app\api\v1\auth\oauth.py:204]** P1-MissingSoftDelete: 查询 OAuthApp 缺少软删除过滤
  ```
  app = db.query(OAuthApp).filter(OAuthApp.client_id == client_id).first()
  ```
- **[app\api\v1\auth\oauth.py:233]** P1-MissingSoftDelete: 查询 OAuthUser 缺少软删除过滤
  ```
  q = db.query(OAuthUser)
  ```
- **[app\api\v1\auth\oauth.py:262]** P1-MissingSoftDelete: 查询 OAuthUser 缺少软删除过滤
  ```
  u = db.query(OAuthUser).filter(OAuthUser.id == user_id).first()
  ```
- **[app\api\v1\auth\username_login.py:79]** P1-MissingSoftDelete: 查询 SysRole 缺少软删除过滤
  ```
  db.query(SysRole)
  ```
- **[app\api\v1\auth\username_login.py:91]** P1-MissingSoftDelete: 查询 SysDept 缺少软删除过滤
  ```
  dept = db.query(SysDept).filter(SysDept.dept_id == user.dept_id).first()
  ```
- **[app\api\v1\auth\user_sk.py:90]** P1-MissingSoftDelete: 查询 UserSKInfo 缺少软删除过滤
  ```
  total = db.query(UserSKInfo).filter(UserSKInfo.user_uuid == user_uuid).count()
  ```
- **[app\api\v1\auth\user_sk.py:92]** P1-MissingSoftDelete: 查询 UserSKInfo 缺少软删除过滤
  ```
  db.query(UserSKInfo)
  ```
- **[app\api\v1\auth\user_sk.py:115]** P1-MissingSoftDelete: 查询 UserSKInfo 缺少软删除过滤
  ```
  sk = db.query(UserSKInfo).filter(UserSKInfo.id == sk_id, UserSKInfo.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\user_sk.py:141]** P1-MissingSoftDelete: 查询 UserSKInfo 缺少软删除过滤
  ```
  sk = db.query(UserSKInfo).filter(UserSKInfo.id == sk_id, UserSKInfo.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\wechat.py:29]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  exists = db.query(User).filter(User.invite_code == code).first()
  ```
- **[app\api\v1\auth\wechat.py:119]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == tpa.user_uuid).first()
  ```
- **[app\api\v1\auth\wechat.py:126]** P1-MissingSoftDelete: 查询 UserAuthInfo 缺少软删除过滤
  ```
  auth = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user.uuid).first()
  ```
- **[app\api\v1\auth\wechat.py:219]** P1-MissingSoftDelete: 查询 UserAuthInfo 缺少软删除过滤
  ```
  db.query(UserAuthInfo)
  ```
- **[app\api\v1\auth\wechat.py:264]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  target_user = db.query(User).filter(User.uuid == existing_auth.user_uuid).first()
  ```
- **[app\api\v1\auth\wechat.py:278]** P1-MissingSoftDelete: 查询 UserAuthInfo 缺少软删除过滤
  ```
  auth = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\wechat.py:285]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\api\v1\auth\wechat.py:337]** P1-MissingSoftDelete: 查询 UserThirdPartyAccount 缺少软删除过滤
  ```
  db.query(UserThirdPartyAccount).filter(
  ```
- **[app\api\v1\auth\wechat.py:376]** P1-MissingSoftDelete: 查询 UserAuthInfo 缺少软删除过滤
  ```
  auth = db.query(UserAuthInfo).filter(UserAuthInfo.phone == phone).first()
  ```
- **[app\api\v1\auth\wechat.py:384]** P1-MissingSoftDelete: 查询 UserThirdPartyAccount 缺少软删除过滤
  ```
  db.query(UserThirdPartyAccount).filter(
  ```
- **[app\api\v1\auth\wechat.py:558]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == tp.user_uuid).first()
  ```
- **[app\api\v1\auth_identity\auth_identity.py:61]** P1-MissingSoftDelete: 查询 AuthIdentity 缺少软删除过滤
  ```
  exist = db.query(AuthIdentity).filter(AuthIdentity.user_id == uid).first()
  ```
- **[app\api\v1\auth_identity\auth_identity.py:89]** P1-MissingSoftDelete: 查询 AuthIdentity 缺少软删除过滤
  ```
  a = db.query(AuthIdentity).filter(AuthIdentity.user_id == _uid()).first()
  ```
- **[app\api\v1\auth_identity\auth_identity.py:116]** P1-MissingSoftDelete: 查询 AuthIdentity 缺少软删除过滤
  ```
  q = db.query(AuthIdentity)
  ```
- **[app\api\v1\auth_identity\auth_identity.py:147]** P1-MissingSoftDelete: 查询 AuthIdentity 缺少软删除过滤
  ```
  a = db.query(AuthIdentity).filter(AuthIdentity.id == aid).first()
  ```
- **[app\api\v1\behavior\behavior.py:35]** P1-MissingSoftDelete: 查询 BehaviorLike 缺少软删除过滤
  ```
  db.query(BehaviorLike)
  ```
- **[app\api\v1\behavior\behavior.py:69]** P1-MissingSoftDelete: 查询 BehaviorLike 缺少软删除过滤
  ```
  q = db.query(BehaviorLike)
  ```
- **[app\api\v1\behavior\behavior.py:104]** P1-MissingSoftDelete: 查询 BehaviorFavorite 缺少软删除过滤
  ```
  db.query(BehaviorFavorite)
  ```
- **[app\api\v1\behavior\behavior.py:139]** P1-MissingSoftDelete: 查询 BehaviorFavorite 缺少软删除过滤
  ```
  q = db.query(BehaviorFavorite).filter(BehaviorFavorite.user_id == _uid())
  ```
- **[app\api\v1\behavior\behavior.py:208]** P1-MissingSoftDelete: 查询 BehaviorComment 缺少软删除过滤
  ```
  q = db.query(BehaviorComment).filter(
  ```
- **[app\api\v1\behavior\behavior.py:242]** P1-MissingSoftDelete: 查询 BehaviorComment 缺少软删除过滤
  ```
  c = db.query(BehaviorComment).filter(BehaviorComment.id == cid).first()
  ```
- **[app\api\v1\behavior\behavior.py:308]** P1-MissingSoftDelete: 查询 BehaviorReport 缺少软删除过滤
  ```
  q = db.query(BehaviorReport)
  ```
- **[app\api\v1\behavior\behavior.py:340]** P1-MissingSoftDelete: 查询 BehaviorReport 缺少软删除过滤
  ```
  r = db.query(BehaviorReport).filter(BehaviorReport.id == rid).first()
  ```
- **[app\api\v1\behavior\behavior.py:357]** P1-MissingSoftDelete: 查询 BehaviorSensitive 缺少软删除过滤
  ```
  items = db.query(BehaviorSensitive).filter(BehaviorSensitive.status == 1).all()
  ```
- **[app\api\v1\behavior\behavior.py:370]** P1-MissingSoftDelete: 查询 BehaviorSensitive 缺少软删除过滤
  ```
  q = db.query(BehaviorSensitive)
  ```
- **[app\api\v1\behavior\behavior.py:425]** P1-MissingSoftDelete: 查询 BehaviorSensitive 缺少软删除过滤
  ```
  s = db.query(BehaviorSensitive).filter(BehaviorSensitive.id == sid).first()
  ```
- **[app\api\v1\behavior\behavior.py:439]** P1-MissingSoftDelete: 查询 BehaviorSensitive 缺少软删除过滤
  ```
  items = db.query(BehaviorSensitive).filter(BehaviorSensitive.status == 1).all()
  ```
- **[app\api\v1\behavior\behavior.py:468]** P1-MissingSoftDelete: 查询 BehaviorFollow 缺少软删除过滤
  ```
  db.query(BehaviorFollow)
  ```
- **[app\api\v1\behavior\behavior.py:491]** P1-MissingSoftDelete: 查询 BehaviorFollow 缺少软删除过滤
  ```
  q = db.query(BehaviorFollow).filter(BehaviorFollow.target_user_id == uid)
  ```
- **[app\api\v1\behavior\behavior.py:493]** P1-MissingSoftDelete: 查询 BehaviorFollow 缺少软删除过滤
  ```
  q = db.query(BehaviorFollow).filter(BehaviorFollow.user_id == uid)
  ```
- **[app\api\v1\callback\callback.py:108]** P1-MissingSoftDelete: 查询 CallBackLog 缺少软删除过滤
  ```
  q = db.query(CallBackLog)
  ```
- **[app\api\v1\callback\callback.py:143]** P1-MissingSoftDelete: 查询 CallBackLog 缺少软删除过滤
  ```
  l = db.query(CallBackLog).filter(CallBackLog.id == lid).first()
  ```
- **[app\api\v1\category_dictionary\category_dictionary.py:37]** P1-MissingSoftDelete: 查询 CategoryDictionary 缺少软删除过滤
  ```
  q = db.query(CategoryDictionary)
  ```
- **[app\api\v1\category_dictionary\category_dictionary.py:69]** P1-MissingSoftDelete: 查询 CategoryDictionary 缺少软删除过滤
  ```
  d = db.query(CategoryDictionary).filter(CategoryDictionary.id == did).first()
  ```
- **[app\api\v1\category_dictionary\category_dictionary.py:110]** P1-MissingSoftDelete: 查询 CategoryDictionary 缺少软删除过滤
  ```
  d = db.query(CategoryDictionary).filter(CategoryDictionary.id == did).first()
  ```
- **[app\api\v1\category_dictionary\category_dictionary.py:128]** P1-MissingSoftDelete: 查询 CategoryDictionary 缺少软删除过滤
  ```
  d = db.query(CategoryDictionary).filter(CategoryDictionary.id == did).first()
  ```
- **[app\api\v1\chat\history.py:150]** P1-MissingSoftDelete: 查询 ZhsUserModelChat 缺少软删除过滤
  ```
  db.query(ZhsUserModelChat)
  ```
- **[app\api\v1\chat\history.py:191]** P1-MissingSoftDelete: 查询 ZhsUserModelChat 缺少软删除过滤
  ```
  db.query(ZhsUserModelChat)
  ```
- **[app\api\v1\circle\circle.py:48]** P1-MissingSoftDelete: 查询 Circle 缺少软删除过滤
  ```
  q = db.query(Circle).filter(not Circle.deleted, Circle.status == 1)
  ```
- **[app\api\v1\circle\circle.py:69]** P1-MissingSoftDelete: 查询 Circle 缺少软删除过滤
  ```
  c = db.query(Circle).filter(Circle.id == cid, not Circle.deleted).first()
  ```
- **[app\api\v1\circle\circle.py:74]** P1-MissingSoftDelete: 查询 CircleMember 缺少软删除过滤
  ```
  db.query(CircleMember)
  ```
- **[app\api\v1\circle\circle.py:134]** P1-MissingSoftDelete: 查询 Circle 缺少软删除过滤
  ```
  c = db.query(Circle).filter(Circle.id == cid).first()
  ```
- **[app\api\v1\circle\circle.py:155]** P1-MissingSoftDelete: 查询 Circle 缺少软删除过滤
  ```
  c = db.query(Circle).filter(Circle.id == cid).first()
  ```
- **[app\api\v1\circle\circle.py:171]** P1-MissingSoftDelete: 查询 Circle 缺少软删除过滤
  ```
  c = db.query(Circle).filter(Circle.id == cid).first()
  ```
- **[app\api\v1\circle\circle.py:174]** P1-MissingSoftDelete: 查询 CircleMember 缺少软删除过滤
  ```
  m = db.query(CircleMember).filter(CircleMember.circle_id == cid, CircleMember.user_id == uid).first()
  ```
- **[app\api\v1\circle\circle.py:193]** P1-MissingSoftDelete: 查询 CircleMember 缺少软删除过滤
  ```
  m = db.query(CircleMember).filter(CircleMember.circle_id == cid, CircleMember.user_id == uid).first()
  ```
- **[app\api\v1\circle\circle.py:199]** P1-MissingSoftDelete: 查询 Circle 缺少软删除过滤
  ```
  c = db.query(Circle).filter(Circle.id == cid).first()
  ```
- **[app\api\v1\circle\circle.py:212]** P1-MissingSoftDelete: 查询 CircleMember 缺少软删除过滤
  ```
  q = db.query(CircleMember).filter(CircleMember.circle_id == cid, CircleMember.status == 1)
  ```
- **[app\api\v1\circle\circle.py:239]** P1-MissingSoftDelete: 查询 CircleCategory 缺少软删除过滤
  ```
  db.query(CircleCategory)
  ```
- **[app\api\v1\circle\post.py:51]** P1-MissingSoftDelete: 查询 CirclePost 缺少软删除过滤
  ```
  q = db.query(CirclePost).filter(not CirclePost.deleted, CirclePost.status == 1)
  ```
- **[app\api\v1\circle\post.py:97]** P1-MissingSoftDelete: 查询 CirclePost 缺少软删除过滤
  ```
  p = db.query(CirclePost).filter(CirclePost.id == pid, not CirclePost.deleted).first()
  ```
- **[app\api\v1\circle\post.py:102]** P1-MissingSoftDelete: 查询 CirclePostLike 缺少软删除过滤
  ```
  db.query(CirclePostLike).filter(CirclePostLike.post_id == pid, CirclePostLike.user_id == _uid()).first()
  ```
- **[app\api\v1\circle\post.py:120]** P1-MissingSoftDelete: 查询 Circle 缺少软删除过滤
  ```
  c = db.query(Circle).filter(Circle.id == circle_id).first()
  ```
- **[app\api\v1\circle\post.py:148]** P1-MissingSoftDelete: 查询 CirclePost 缺少软删除过滤
  ```
  p = db.query(CirclePost).filter(CirclePost.id == pid).first()
  ```
- **[app\api\v1\circle\post.py:167]** P1-MissingSoftDelete: 查询 CirclePost 缺少软删除过滤
  ```
  p = db.query(CirclePost).filter(CirclePost.id == pid).first()
  ```
- **[app\api\v1\circle\post.py:172]** P1-MissingSoftDelete: 查询 Circle 缺少软删除过滤
  ```
  c = db.query(Circle).filter(Circle.id == p.circle_id).first()
  ```
- **[app\api\v1\circle\post.py:186]** P1-MissingSoftDelete: 查询 CirclePostLike 缺少软删除过滤
  ```
  like = db.query(CirclePostLike).filter(CirclePostLike.post_id == pid, CirclePostLike.user_id == uid).first()
  ```
- **[app\api\v1\circle\post.py:187]** P1-MissingSoftDelete: 查询 CirclePost 缺少软删除过滤
  ```
  p = db.query(CirclePost).filter(CirclePost.id == pid).first()
  ```
- **[app\api\v1\circle\post.py:206]** P1-MissingSoftDelete: 查询 CirclePostComment 缺少软删除过滤
  ```
  q = db.query(CirclePostComment).filter(CirclePostComment.post_id == pid)
  ```
- **[app\api\v1\circle\post.py:242]** P1-MissingSoftDelete: 查询 CirclePost 缺少软删除过滤
  ```
  p = db.query(CirclePost).filter(CirclePost.id == pid).first()
  ```
- **[app\api\v1\content\about_us.py:20]** P1-MissingSoftDelete: 查询 AiContact 缺少软删除过滤
  ```
  contact = db.query(AiContact).filter(AiContact.status == 1).order_by(AiContact.id.desc()).first()
  ```
- **[app\api\v1\content\about_us.py:39]** P1-MissingSoftDelete: 查询 AiAboutUs 缺少软删除过滤
  ```
  items = db.query(AiAboutUs).filter(AiAboutUs.status == 1).order_by(AiAboutUs.sort).all()
  ```
- **[app\api\v1\content\about_us.py:49]** P1-MissingSoftDelete: 查询 AiNews 缺少软删除过滤
  ```
  q = db.query(AiNews).filter(AiNews.status == 1)
  ```
- **[app\api\v1\content\about_us.py:71]** P1-MissingSoftDelete: 查询 AiNews 缺少软删除过滤
  ```
  news = db.query(AiNews).filter(AiNews.id == news_id).first()
  ```
- **[app\api\v1\content\about_us.py:93]** P1-MissingSoftDelete: 查询 BannerCarousel 缺少软删除过滤
  ```
  q = db.query(BannerCarousel).filter(BannerCarousel.status == 1)
  ```
- **[app\api\v1\content\about_us.py:129]** P1-MissingSoftDelete: 查询 AppVersion 缺少软删除过滤
  ```
  db.query(AppVersion)
  ```
- **[app\api\v1\content\about_us.py:162]** P1-MissingSoftDelete: 查询 AppVersion 缺少软删除过滤
  ```
  q = db.query(AppVersion)
  ```
- **[app\api\v1\content\about_us.py:230]** P1-MissingSoftDelete: 查询 AppVersion 缺少软删除过滤
  ```
  v = db.query(AppVersion).filter(AppVersion.id == version_id).first()
  ```
- **[app\api\v1\content\about_us.py:263]** P1-MissingSoftDelete: 查询 AppVersion 缺少软删除过滤
  ```
  v = db.query(AppVersion).filter(AppVersion.id == version_id).first()
  ```
- **[app\api\v1\content\about_us.py:289]** P1-MissingSoftDelete: 查询 AiUserFeedback 缺少软删除过滤
  ```
  q = db.query(AiUserFeedback)
  ```
- **[app\api\v1\content\about_us.py:321]** P1-MissingSoftDelete: 查询 AiUserFeedback 缺少软删除过滤
  ```
  fb = db.query(AiUserFeedback).filter(AiUserFeedback.id == feedback_id).first()
  ```
- **[app\api\v1\content\about_us.py:345]** P1-MissingSoftDelete: 查询 AiUserFeedback 缺少软删除过滤
  ```
  fb = db.query(AiUserFeedback).filter(AiUserFeedback.id == feedback_id).first()
  ```
- **[app\api\v1\content\activity.py:23]** P1-MissingSoftDelete: 查询 Activity 缺少软删除过滤
  ```
  q = db.query(Activity)
  ```
- **[app\api\v1\content\activity.py:57]** P1-MissingSoftDelete: 查询 Activity 缺少软删除过滤
  ```
  act = db.query(Activity).filter(Activity.id == activity_id).first()
  ```
- **[app\api\v1\content\aigc.py:42]** P1-MissingSoftDelete: 查询 AiGc 缺少软删除过滤
  ```
  q = db.query(AiGc)
  ```
- **[app\api\v1\content\aigc.py:72]** P1-MissingSoftDelete: 查询 AiGc 缺少软删除过滤
  ```
  item = db.query(AiGc).filter(AiGc.id == item_id).first()
  ```
- **[app\api\v1\content\aigc.py:116]** P1-MissingSoftDelete: 查询 AiGc 缺少软删除过滤
  ```
  item = db.query(AiGc).filter(AiGc.id == body.id).first()
  ```
- **[app\api\v1\content\aigc.py:143]** P1-MissingSoftDelete: 查询 AiGc 缺少软删除过滤
  ```
  db.query(AiGc).filter(AiGc.id.in_(ids)).delete(synchronize_session=False)
  ```
- **[app\api\v1\content\cms.py:35]** P1-MissingSoftDelete: 查询 BannerCarousel 缺少软删除过滤
  ```
  q = db.query(BannerCarousel).filter(BannerCarousel.is_active == status)
  ```
- **[app\api\v1\content\cms.py:100]** P1-MissingSoftDelete: 查询 BannerCarousel 缺少软删除过滤
  ```
  banner = db.query(BannerCarousel).filter(BannerCarousel.id == banner_id).first()
  ```
- **[app\api\v1\content\cms.py:130]** P1-MissingSoftDelete: 查询 BannerCarousel 缺少软删除过滤
  ```
  banner = db.query(BannerCarousel).filter(BannerCarousel.id == banner_id).first()
  ```
- **[app\api\v1\content\cms.py:156]** P1-MissingSoftDelete: 查询 AiNews 缺少软删除过滤
  ```
  q = db.query(AiNews).filter(AiNews.is_active == 1)
  ```
- **[app\api\v1\content\cms.py:212]** P1-MissingSoftDelete: 查询 AiNews 缺少软删除过滤
  ```
  news = db.query(AiNews).filter(AiNews.id == news_id).first()
  ```
- **[app\api\v1\content\cms.py:240]** P1-MissingSoftDelete: 查询 AiNews 缺少软删除过滤
  ```
  news = db.query(AiNews).filter(AiNews.id == news_id).first()
  ```
- **[app\api\v1\content\cms.py:266]** P1-MissingSoftDelete: 查询 SysNotice 缺少软删除过滤
  ```
  q = db.query(SysNotice).filter(SysNotice.status == "0")
  ```
- **[app\api\v1\content\cms.py:323]** P1-MissingSoftDelete: 查询 SysNotice 缺少软删除过滤
  ```
  notice = db.query(SysNotice).filter(SysNotice.notice_id == notice_id).first()
  ```
- **[app\api\v1\content\cms.py:351]** P1-MissingSoftDelete: 查询 SysNotice 缺少软删除过滤
  ```
  notice = db.query(SysNotice).filter(SysNotice.notice_id == notice_id).first()
  ```
- **[app\api\v1\content\cms.py:376]** P1-MissingSoftDelete: 查询 BannerCarousel 缺少软删除过滤
  ```
  q = db.query(BannerCarousel).filter(BannerCarousel.is_active == 1)
  ```
- **[app\api\v1\content\file_storage.py:25]** P1-MissingSoftDelete: 查询 AiFileStorage 缺少软删除过滤
  ```
  q = db.query(AiFileStorage).filter(AiFileStorage.status == 1)
  ```
- **[app\api\v1\content\file_storage.py:89]** P1-MissingSoftDelete: 查询 AiFileStorage 缺少软删除过滤
  ```
  f = db.query(AiFileStorage).filter(AiFileStorage.id == file_id).first()
  ```
- **[app\api\v1\content\information.py:27]** P1-MissingSoftDelete: 查询 CategoryDictionary 缺少软删除过滤
  ```
  q = db.query(CategoryDictionary).filter(CategoryDictionary.status == 1)
  ```
- **[app\api\v1\content\information.py:86]** P1-MissingSoftDelete: 查询 Information 缺少软删除过滤
  ```
  q = db.query(Information)
  ```
- **[app\api\v1\courses\courses.py:64]** P1-MissingSoftDelete: 查询 Course 缺少软删除过滤
  ```
  q = db.query(Course).filter(Course.is_del == 0)
  ```
- **[app\api\v1\courses\courses.py:100]** P1-MissingSoftDelete: 查询 Course 缺少软删除过滤
  ```
  course = db.query(Course).filter(Course.id == course_id, Course.is_del == 0).first()
  ```
- **[app\api\v1\courses\courses.py:103]** P1-MissingSoftDelete: 查询 CourseVideo 缺少软删除过滤
  ```
  videos = db.query(CourseVideo).filter(CourseVideo.course_id == course_id).all()
  ```
- **[app\api\v1\courses\courses.py:187]** P1-MissingSoftDelete: 查询 Course 缺少软删除过滤
  ```
  course = db.query(Course).filter(Course.id == course_id, Course.is_del == 0).first()
  ```
- **[app\api\v1\courses\courses.py:213]** P1-MissingSoftDelete: 查询 Course 缺少软删除过滤
  ```
  course = db.query(Course).filter(Course.id == course_id, Course.is_del == 0).first()
  ```
- **[app\api\v1\courses\courses.py:237]** P1-MissingSoftDelete: 查询 Course 缺少软删除过滤
  ```
  course = db.query(Course).filter(Course.id == course_id, Course.is_del == 0).first()
  ```
- **[app\api\v1\courses\courses_ext.py:117]** P1-MissingSoftDelete: 查询 CourseVideo 缺少软删除过滤
  ```
  q = db.query(CourseVideo).filter(CourseVideo.course_id == course_id, CourseVideo.status == 1)
  ```
- **[app\api\v1\courses\courses_ext.py:146]** P1-MissingSoftDelete: 查询 CourseVideo 缺少软删除过滤
  ```
  v = db.query(CourseVideo).filter(CourseVideo.id == video_id).first()
  ```
- **[app\api\v1\courses\courses_ext.py:258]** P1-MissingSoftDelete: 查询 CourseVideo 缺少软删除过滤
  ```
  video = db.query(CourseVideo).filter(CourseVideo.id == video_id).first()
  ```
- **[app\api\v1\courses\courses_ext.py:280]** P1-MissingSoftDelete: 查询 CourseVideo 缺少软删除过滤
  ```
  video = db.query(CourseVideo).filter(CourseVideo.id == video_id).first()
  ```
- **[app\api\v1\courses\courses_ext.py:304]** P1-MissingSoftDelete: 查询 CourseVideo 缺少软删除过滤
  ```
  video = db.query(CourseVideo).filter(CourseVideo.id == video_id).first()
  ```
- **[app\api\v1\courses\courses_ext.py:307]** P1-MissingSoftDelete: 查询 Course 缺少软删除过滤
  ```
  target = db.query(Course).filter(Course.id == target_course_id, Course.is_del == 0).first()
  ```
- **[app\api\v1\courses\courses_ext.py:328]** P1-MissingSoftDelete: 查询 CourseVideo 缺少软删除过滤
  ```
  video = db.query(CourseVideo).filter(CourseVideo.id == video_id).first()
  ```
- **[app\api\v1\courses\courses_ext.py:352]** P1-MissingSoftDelete: 查询 CourseVideo 缺少软删除过滤
  ```
  q = db.query(CourseVideo).filter(CourseVideo.creator == user_uuid)
  ```
- **[app\api\v1\courses\courses_ext.py:445]** P1-MissingSoftDelete: 查询 EducationPlatform 缺少软删除过滤
  ```
  q = db.query(EducationPlatform).filter(
  ```
- **[app\api\v1\courses\courses_ext.py:474]** P1-MissingSoftDelete: 查询 EducationPlatform 缺少软删除过滤
  ```
  p = db.query(EducationPlatform).filter(EducationPlatform.code == code).first()
  ```
- **[app\api\v1\courses\courses_ext.py:498]** P1-MissingSoftDelete: 查询 EducationPlatform 缺少软删除过滤
  ```
  existing = db.query(EducationPlatform).filter(EducationPlatform.code == body.code).first()
  ```
- **[app\api\v1\courses\courses_ext.py:533]** P1-MissingSoftDelete: 查询 EducationPlatform 缺少软删除过滤
  ```
  db.query(EducationPlatform)
  ```
- **[app\api\v1\courses\courses_ext.py:559]** P1-MissingSoftDelete: 查询 EducationPlatform 缺少软删除过滤
  ```
  db.query(EducationPlatform)
  ```
- **[app\api\v1\courses\course_temp.py:45]** P1-MissingSoftDelete: 查询 ZhsCourseTemp 缺少软删除过滤
  ```
  q = db.query(ZhsCourseTemp)
  ```
- **[app\api\v1\courses\course_temp.py:55]** P1-MissingSoftDelete: 查询 ZhsCourseTemp 缺少软删除过滤
  ```
  item = db.query(ZhsCourseTemp).filter(ZhsCourseTemp.id == item_id).first()
  ```
- **[app\api\v1\courses\course_temp.py:71]** P1-MissingSoftDelete: 查询 ZhsCourseTemp 缺少软删除过滤
  ```
  item = db.query(ZhsCourseTemp).filter(ZhsCourseTemp.id == item_id).first()
  ```
- **[app\api\v1\courses\course_temp.py:81]** P1-MissingSoftDelete: 查询 ZhsCourseTemp 缺少软删除过滤
  ```
  item = db.query(ZhsCourseTemp).filter(ZhsCourseTemp.id == item_id).first()
  ```
- **[app\api\v1\courses\course_temp.py:90]** P1-MissingSoftDelete: 查询 ZhsCourseTemp 缺少软删除过滤
  ```
  item = db.query(ZhsCourseTemp).filter(ZhsCourseTemp.id == item_id).first()
  ```
- **[app\api\v1\courses\popular_courses.py:47]** P1-MissingSoftDelete: 查询 PopularCourse 缺少软删除过滤
  ```
  q = db.query(PopularCourse)
  ```
- **[app\api\v1\courses\popular_courses.py:57]** P1-MissingSoftDelete: 查询 PopularCourse 缺少软删除过滤
  ```
  item = db.query(PopularCourse).filter(PopularCourse.id == item_id).first()
  ```
- **[app\api\v1\courses\popular_courses.py:73]** P1-MissingSoftDelete: 查询 PopularCourse 缺少软删除过滤
  ```
  item = db.query(PopularCourse).filter(PopularCourse.id == item_id).first()
  ```
- **[app\api\v1\courses\popular_courses.py:84]** P1-MissingSoftDelete: 查询 PopularCourse 缺少软删除过滤
  ```
  item = db.query(PopularCourse).filter(PopularCourse.id == item_id).first()
  ```
- **[app\api\v1\courses\popular_courses.py:93]** P1-MissingSoftDelete: 查询 PopularCourse 缺少软删除过滤
  ```
  item = db.query(PopularCourse).filter(PopularCourse.id == item_id).first()
  ```
- **[app\api\v1\courses\video_temp.py:45]** P1-MissingSoftDelete: 查询 ZhsCourseVideoTemp 缺少软删除过滤
  ```
  q = db.query(ZhsCourseVideoTemp)
  ```
- **[app\api\v1\courses\video_temp.py:55]** P1-MissingSoftDelete: 查询 ZhsCourseVideoTemp 缺少软删除过滤
  ```
  item = db.query(ZhsCourseVideoTemp).filter(ZhsCourseVideoTemp.id == item_id).first()
  ```
- **[app\api\v1\courses\video_temp.py:71]** P1-MissingSoftDelete: 查询 ZhsCourseVideoTemp 缺少软删除过滤
  ```
  item = db.query(ZhsCourseVideoTemp).filter(ZhsCourseVideoTemp.id == item_id).first()
  ```
- **[app\api\v1\courses\video_temp.py:81]** P1-MissingSoftDelete: 查询 ZhsCourseVideoTemp 缺少软删除过滤
  ```
  item = db.query(ZhsCourseVideoTemp).filter(ZhsCourseVideoTemp.id == item_id).first()
  ```
- **[app\api\v1\courses\video_temp.py:90]** P1-MissingSoftDelete: 查询 ZhsCourseVideoTemp 缺少软删除过滤
  ```
  item = db.query(ZhsCourseVideoTemp).filter(ZhsCourseVideoTemp.id == item_id).first()
  ```
- **[app\api\v1\course_audit\course_audit.py:57]** P1-MissingSoftDelete: 查询 CourseAudit 缺少软删除过滤
  ```
  q = db.query(CourseAudit)
  ```
- **[app\api\v1\course_audit\course_audit.py:81]** P1-MissingSoftDelete: 查询 CourseAudit 缺少软删除过滤
  ```
  a = db.query(CourseAudit).filter(CourseAudit.id == aid).first()
  ```
- **[app\api\v1\course_audit\course_audit.py:101]** P1-MissingSoftDelete: 查询 CourseAudit 缺少软删除过滤
  ```
  a = db.query(CourseAudit).filter(CourseAudit.id == aid).first()
  ```
- **[app\api\v1\education_platform\education_platform.py:55]** P1-MissingSoftDelete: 查询 EducationPlatform 缺少软删除过滤
  ```
  q = db.query(EducationPlatform)
  ```
- **[app\api\v1\education_platform\education_platform.py:96]** P1-MissingSoftDelete: 查询 EducationPlatform 缺少软删除过滤
  ```
  p = db.query(EducationPlatform).filter(EducationPlatform.id == pid).first()
  ```
- **[app\api\v1\education_platform\education_platform.py:115]** P1-MissingSoftDelete: 查询 EducationPlatform 缺少软删除过滤
  ```
  p = db.query(EducationPlatform).filter(EducationPlatform.id == pid).first()
  ```
- **[app\api\v1\education_platform\education_platform.py:129]** P1-MissingSoftDelete: 查询 EducationPlatform 缺少软删除过滤
  ```
  p = db.query(EducationPlatform).filter(EducationPlatform.id == pid).first()
  ```
- **[app\api\v1\education_platform\education_platform.py:150]** P1-MissingSoftDelete: 查询 EducationSyncLog 缺少软删除过滤
  ```
  q = db.query(EducationSyncLog)
  ```
- **[app\api\v1\exam\paper.py:67]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  q = db.query(ExamPaper).filter(ExamPaper.status == 1)
  ```
- **[app\api\v1\exam\paper.py:76]** P1-MissingSoftDelete: 查询 ExamCategory 缺少软删除过滤
  ```
  categories = db.query(ExamCategory).filter(ExamCategory.is_show).order_by(ExamCategory.sort_order.asc()).all()
  ```
- **[app\api\v1\exam\paper.py:95]** P1-MissingSoftDelete: 查询 ExamCategory 缺少软删除过滤
  ```
  category = db.query(ExamCategory).filter(ExamCategory.is_show).order_by(ExamCategory.sort_order.asc()).first()
  ```
- **[app\api\v1\exam\paper.py:96]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  p = db.query(ExamPaper).filter(ExamPaper.id == pid).first()
  ```
- **[app\api\v1\exam\paper.py:161]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  p = db.query(ExamPaper).filter(ExamPaper.id == pid).first()
  ```
- **[app\api\v1\exam\paper.py:192]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  p = db.query(ExamPaper).filter(ExamPaper.id == pid).first()
  ```
- **[app\api\v1\exam\paper.py:196]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  db.query(ExamQuestion).filter(ExamQuestion.paper_id == pid).delete(synchronize_session=False)
  ```
- **[app\api\v1\exam\paper.py:209]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  db.query(ExamQuestion)
  ```
- **[app\api\v1\exam\paper.py:263]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  db.query(ExamPaper).filter(ExamPaper.id == paper_id).update(
  ```
- **[app\api\v1\exam\paper.py:310]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  q = db.query(ExamQuestion).filter(ExamQuestion.id == qid).first()
  ```
- **[app\api\v1\exam\paper.py:315]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  db.query(ExamPaper).filter(ExamPaper.id == paper_id).update(
  ```
- **[app\api\v1\exam\paper.py:332]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  p = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
  ```
- **[app\api\v1\exam\paper.py:358]** P1-MissingSoftDelete: 查询 ExamRecord 缺少软删除过滤
  ```
  r = db.query(ExamRecord).filter(ExamRecord.id == record_id).first()
  ```
- **[app\api\v1\exam\paper.py:369]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  questions = db.query(ExamQuestion).filter(ExamQuestion.paper_id == r.paper_id).all()
  ```
- **[app\api\v1\exam\paper.py:382]** P1-MissingSoftDelete: 查询 ExamWrongQuestion 缺少软删除过滤
  ```
  db.query(ExamWrongQuestion)
  ```
- **[app\api\v1\exam\paper.py:412]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  p = db.query(ExamPaper).filter(ExamPaper.id == r.paper_id).first()
  ```
- **[app\api\v1\exam\paper.py:433]** P1-MissingSoftDelete: 查询 ExamRecord 缺少软删除过滤
  ```
  q = db.query(ExamRecord).filter(ExamRecord.user_id == _uid())
  ```
- **[app\api\v1\exam\paper.py:476]** P1-MissingSoftDelete: 查询 ExamRecord 缺少软删除过滤
  ```
  r = db.query(ExamRecord).filter(ExamRecord.id == rid).first()
  ```
- **[app\api\v1\exam\paper.py:511]** P1-MissingSoftDelete: 查询 ExamWrongQuestion 缺少软删除过滤
  ```
  q = db.query(ExamWrongQuestion).filter(ExamWrongQuestion.user_id == _uid())
  ```
- **[app\api\v1\exam\paper.py:542]** P1-MissingSoftDelete: 查询 ExamWrongQuestion 缺少软删除过滤
  ```
  w = db.query(ExamWrongQuestion).filter(ExamWrongQuestion.id == wid).first()
  ```
- **[app\api\v1\exam\paper.py:557]** P1-MissingSoftDelete: 查询 ExamWrongQuestion 缺少软删除过滤
  ```
  w = db.query(ExamWrongQuestion).filter(ExamWrongQuestion.id == wid).first()
  ```
- **[app\api\v1\exam\paper.py:573]** P1-MissingSoftDelete: 查询 ExamCategory 缺少软删除过滤
  ```
  db.query(ExamCategory)
  ```
- **[app\api\v1\feedback\feedback.py:100]** P1-MissingSoftDelete: 查询 Feedback 缺少软删除过滤
  ```
  q = db.query(Feedback).filter(Feedback.user_id == _uid())
  ```
- **[app\api\v1\feedback\feedback.py:146]** P1-MissingSoftDelete: 查询 Feedback 缺少软删除过滤
  ```
  q = db.query(Feedback)
  ```
- **[app\api\v1\feedback\feedback.py:191]** P1-MissingSoftDelete: 查询 Feedback 缺少软删除过滤
  ```
  f = db.query(Feedback).filter(
  ```
- **[app\api\v1\feedback\feedback.py:236]** P1-MissingSoftDelete: 查询 Feedback 缺少软删除过滤
  ```
  f = db.query(Feedback).filter(Feedback.id == fid).first()
  ```
- **[app\api\v1\feedback\feedback.py:259]** P1-MissingSoftDelete: 查询 Feedback 缺少软删除过滤
  ```
  f = db.query(Feedback).filter(Feedback.id == fid).first()
  ```
- **[app\api\v1\feedback\feedback.py:273]** P1-MissingSoftDelete: 查询 Feedback 缺少软删除过滤
  ```
  f = db.query(Feedback).filter(Feedback.id == fid).first()
  ```
- **[app\api\v1\finance\commission.py:25]** P1-MissingSoftDelete: 查询 CommissionFlow 缺少软删除过滤
  ```
  q = db.query(CommissionFlow).filter(CommissionFlow.user_id == user_uuid)
  ```
- **[app\api\v1\finance\commission.py:153]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  q = db.query(Order).filter(Order.user_id == user_uuid)
  ```
- **[app\api\v1\finance\commission.py:190]** P1-MissingSoftDelete: 查询 CommissionFlow 缺少软删除过滤
  ```
  db.query(CommissionFlow)
  ```
- **[app\api\v1\finance\developer_fund_logs.py:45]** P1-MissingSoftDelete: 查询 ZhsDeveloperFundLogs 缺少软删除过滤
  ```
  q = db.query(ZhsDeveloperFundLogs)
  ```
- **[app\api\v1\finance\developer_fund_logs.py:57]** P1-MissingSoftDelete: 查询 ZhsDeveloperFundLogs 缺少软删除过滤
  ```
  item = db.query(ZhsDeveloperFundLogs).filter(ZhsDeveloperFundLogs.id == log_id).first()
  ```
- **[app\api\v1\finance\developer_fund_logs.py:86]** P1-MissingSoftDelete: 查询 ZhsDeveloperFundLogs 缺少软删除过滤
  ```
  item = db.query(ZhsDeveloperFundLogs).filter(ZhsDeveloperFundLogs.id == log_id).first()
  ```
- **[app\api\v1\finance\developer_fund_logs.py:104]** P1-MissingSoftDelete: 查询 ZhsDeveloperFundLogs 缺少软删除过滤
  ```
  item = db.query(ZhsDeveloperFundLogs).filter(ZhsDeveloperFundLogs.id == log_id).first()
  ```
- **[app\api\v1\finance\developer_fund_logs.py:117]** P1-MissingSoftDelete: 查询 ZhsDeveloperFundLogs 缺少软删除过滤
  ```
  q = db.query(ZhsDeveloperFundLogs)
  ```
- **[app\api\v1\finance\distribution.py:25]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  q = db.query(User).filter(User.parent_id == user_uuid)
  ```
- **[app\api\v1\finance\distribution.py:58]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  q = db.query(User).filter(User.parent_id == user_uuid)
  ```
- **[app\api\v1\finance\distribution.py:100]** P1-MissingSoftDelete: 查询 CommissionFlow 缺少软删除过滤
  ```
  q = db.query(CommissionFlow).filter(CommissionFlow.user_id == user_uuid)
  ```
- **[app\api\v1\finance\distribution.py:156]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  invitees = db.query(User).filter(User.parent_id == user_uuid).all()
  ```
- **[app\api\v1\finance\distribution.py:216]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  q = db.query(Order).filter(Order.user_id.in_(all_uuids))
  ```
- **[app\api\v1\finance\fund_info.py:46]** P1-MissingSoftDelete: 查询 UserFundInfo 缺少软删除过滤
  ```
  q = db.query(UserFundInfo)
  ```
- **[app\api\v1\finance\fund_info.py:60]** P1-MissingSoftDelete: 查询 UserFundInfo 缺少软删除过滤
  ```
  item = db.query(UserFundInfo).filter(UserFundInfo.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\finance\fund_info.py:87]** P1-MissingSoftDelete: 查询 UserFundInfo 缺少软删除过滤
  ```
  item = db.query(UserFundInfo).filter(UserFundInfo.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\finance\fund_info.py:102]** P1-MissingSoftDelete: 查询 UserFundInfo 缺少软删除过滤
  ```
  item = db.query(UserFundInfo).filter(UserFundInfo.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\finance\fund_info.py:116]** P1-MissingSoftDelete: 查询 UserFundInfo 缺少软删除过滤
  ```
  q = db.query(UserFundInfo)
  ```
- **[app\api\v1\finance\margin.py:190]** P1-MissingSoftDelete: 查询 OperateTokenFlow 缺少软删除过滤
  ```
  q = db.query(OperateTokenFlow)
  ```
- **[app\api\v1\finance\power_purchase_rule.py:40]** P1-MissingSoftDelete: 查询 PowerPurchaseRule 缺少软删除过滤
  ```
  q = db.query(PowerPurchaseRule).filter(PowerPurchaseRule.is_del == 0)
  ```
- **[app\api\v1\finance\power_purchase_rule.py:50]** P1-MissingSoftDelete: 查询 PowerPurchaseRule 缺少软删除过滤
  ```
  item = db.query(PowerPurchaseRule).filter(PowerPurchaseRule.id == rule_id, PowerPurchaseRule.is_del == 0).first()
  ```
- **[app\api\v1\finance\power_purchase_rule.py:76]** P1-MissingSoftDelete: 查询 PowerPurchaseRule 缺少软删除过滤
  ```
  item = db.query(PowerPurchaseRule).filter(PowerPurchaseRule.id == rule_id).first()
  ```
- **[app\api\v1\finance\power_purchase_rule.py:90]** P1-MissingSoftDelete: 查询 PowerPurchaseRule 缺少软删除过滤
  ```
  item = db.query(PowerPurchaseRule).filter(PowerPurchaseRule.id == rule_id).first()
  ```
- **[app\api\v1\finance\power_purchase_rule.py:99]** P1-MissingSoftDelete: 查询 PowerPurchaseRule 缺少软删除过滤
  ```
  item = db.query(PowerPurchaseRule).filter(PowerPurchaseRule.id == rule_id).first()
  ```
- **[app\api\v1\finance\product.py:46]** P1-MissingSoftDelete: 查询 ZhsProduct 缺少软删除过滤
  ```
  q = db.query(ZhsProduct)
  ```
- **[app\api\v1\finance\product.py:82]** P1-MissingSoftDelete: 查询 ZhsProduct 缺少软删除过滤
  ```
  item = db.query(ZhsProduct).filter(ZhsProduct.id == item_id).first()
  ```
- **[app\api\v1\finance\product.py:127]** P1-MissingSoftDelete: 查询 ZhsProduct 缺少软删除过滤
  ```
  item = db.query(ZhsProduct).filter(ZhsProduct.id == body.id).first()
  ```
- **[app\api\v1\finance\product.py:156]** P1-MissingSoftDelete: 查询 ZhsProduct 缺少软删除过滤
  ```
  db.query(ZhsProduct).filter(ZhsProduct.id.in_(ids)).delete(synchronize_session=False)
  ```
- **[app\api\v1\finance\product_identity.py:49]** P1-MissingSoftDelete: 查询 ProductIdentity 缺少软删除过滤
  ```
  q = db.query(ProductIdentity)
  ```
- **[app\api\v1\finance\product_identity.py:81]** P1-MissingSoftDelete: 查询 ProductIdentity 缺少软删除过滤
  ```
  item = db.query(ProductIdentity).filter(ProductIdentity.id == item_id).first()
  ```
- **[app\api\v1\finance\product_identity.py:130]** P1-MissingSoftDelete: 查询 ProductIdentity 缺少软删除过滤
  ```
  item = db.query(ProductIdentity).filter(ProductIdentity.id == body.id).first()
  ```
- **[app\api\v1\finance\product_identity.py:163]** P1-MissingSoftDelete: 查询 ProductIdentity 缺少软删除过滤
  ```
  db.query(ProductIdentity).filter(ProductIdentity.id.in_(ids)).delete(synchronize_session=False)
  ```
- **[app\api\v1\finance\withdrawal.py:62]** P1-MissingSoftDelete: 查询 WithdrawalFlow 缺少软删除过滤
  ```
  q = db.query(WithdrawalFlow).filter(WithdrawalFlow.user_id == user_uuid)
  ```
- **[app\api\v1\finance\withdrawal.py:228]** P1-MissingSoftDelete: 查询 AgentWithdrawalDetail 缺少软删除过滤
  ```
  q = db.query(AgentWithdrawalDetail).filter(AgentWithdrawalDetail.user_id == user_uuid)
  ```
- **[app\api\v1\learn\access.py:38]** P1-MissingSoftDelete: 查询 LessonAccess 缺少软删除过滤
  ```
  db.query(LessonAccess).filter(
  ```
- **[app\api\v1\learn\access.py:53]** P1-MissingSoftDelete: 查询 LessonAccess 缺少软删除过滤
  ```
  db.query(LessonAccess)
  ```
- **[app\api\v1\learn\access.py:72]** P1-MissingSoftDelete: 查询 LessonAccess 缺少软删除过滤
  ```
  db.query(LessonAccess)
  ```
- **[app\api\v1\learn\category.py:121]** P1-MissingSoftDelete: 查询 Category 缺少软删除过滤
  ```
  q = db.query(Category)
  ```
- **[app\api\v1\learn\category.py:144]** P1-MissingSoftDelete: 查询 Category 缺少软删除过滤
  ```
  db.query(Category)
  ```
- **[app\api\v1\learn\category.py:149]** P1-MissingSoftDelete: 查询 CategoryRelation 缺少软删除过滤
  ```
  relations = db.query(CategoryRelation).limit(1000).all()
  ```
- **[app\api\v1\learn\category.py:201]** P1-MissingSoftDelete: 查询 Category 缺少软删除过滤
  ```
  item = db.query(Category).filter(Category.id == category_id).first()
  ```
- **[app\api\v1\learn\category.py:231]** P1-MissingSoftDelete: 查询 Category 缺少软删除过滤
  ```
  item = db.query(Category).filter(Category.id == category_id).first()
  ```
- **[app\api\v1\learn\category.py:235]** P1-MissingSoftDelete: 查询 CategoryRelation 缺少软删除过滤
  ```
  db.query(CategoryRelation)
  ```
- **[app\api\v1\learn\category.py:242]** P1-MissingSoftDelete: 查询 CategoryRelation 缺少软删除过滤
  ```
  db.query(CategoryRelation).filter(
  ```
- **[app\api\v1\learn\category.py:257]** P1-MissingSoftDelete: 查询 Category 缺少软删除过滤
  ```
  item = db.query(Category).filter(Category.id == category_id).first()
  ```
- **[app\api\v1\learn\category.py:272]** P1-MissingSoftDelete: 查询 Category 缺少软删除过滤
  ```
  item = db.query(Category).filter(Category.id == category_id).first()
  ```
- **[app\api\v1\learn\category.py:288]** P1-MissingSoftDelete: 查询 CategoryRelation 缺少软删除过滤
  ```
  db.query(CategoryRelation)
  ```
- **[app\api\v1\learn\category.py:345]** P1-MissingSoftDelete: 查询 TopicCategory 缺少软删除过滤
  ```
  q = db.query(TopicCategory)
  ```
- **[app\api\v1\learn\category.py:393]** P1-MissingSoftDelete: 查询 TopicCategory 缺少软删除过滤
  ```
  db.query(TopicCategory)
  ```
- **[app\api\v1\learn\category.py:427]** P1-MissingSoftDelete: 查询 TopicCategory 缺少软删除过滤
  ```
  db.query(TopicCategory)
  ```
- **[app\api\v1\learn\category.py:434]** P1-MissingSoftDelete: 查询 TopicCategoryRelation 缺少软删除过滤
  ```
  db.query(TopicCategoryRelation)
  ```
- **[app\api\v1\learn\category.py:441]** P1-MissingSoftDelete: 查询 TopicCategoryRelation 缺少软删除过滤
  ```
  db.query(TopicCategoryRelation).filter(
  ```
- **[app\api\v1\learn\certificate.py:109]** P1-MissingSoftDelete: 查询 CertificateSerialNumber 缺少软删除过滤
  ```
  db.query(CertificateSerialNumber)
  ```
- **[app\api\v1\learn\certificate.py:267]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  q = db.query(Certificate).filter(Certificate.status != 5)
  ```
- **[app\api\v1\learn\certificate.py:299]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  db.query(Certificate)
  ```
- **[app\api\v1\learn\certificate.py:320]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  q = db.query(Certificate).filter(
  ```
- **[app\api\v1\learn\certificate.py:346]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  db.query(Certificate)
  ```
- **[app\api\v1\learn\certificate.py:368]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  q = db.query(Certificate).filter(
  ```
- **[app\api\v1\learn\certificate.py:398]** P1-MissingSoftDelete: 查询 CertificateTemplate 缺少软删除过滤
  ```
  db.query(CertificateTemplate)
  ```
- **[app\api\v1\learn\certificate.py:408]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  db.query(SignUp)
  ```
- **[app\api\v1\learn\certificate.py:416]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  db.query(Certificate)
  ```
- **[app\api\v1\learn\certificate.py:463]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  db.query(Certificate)
  ```
- **[app\api\v1\learn\certificate.py:480]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  db.query(Certificate)
  ```
- **[app\api\v1\learn\certificate.py:524]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  db.query(Certificate)
  ```
- **[app\api\v1\learn\certificate.py:545]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  db.query(Certificate)
  ```
- **[app\api\v1\learn\certificate.py:599]** P1-MissingSoftDelete: 查询 CertificateTemplate 缺少软删除过滤
  ```
  q = db.query(CertificateTemplate).filter(
  ```
- **[app\api\v1\learn\certificate.py:626]** P1-MissingSoftDelete: 查询 CertificateTemplate 缺少软删除过滤
  ```
  db.query(CertificateTemplate)
  ```
- **[app\api\v1\learn\certificate.py:643]** P1-MissingSoftDelete: 查询 CertificateTemplate 缺少软删除过滤
  ```
  db.query(CertificateTemplate)
  ```
- **[app\api\v1\learn\certificate.py:679]** P1-MissingSoftDelete: 查询 CertificateTemplate 缺少软删除过滤
  ```
  db.query(CertificateTemplate)
  ```
- **[app\api\v1\learn\certificate.py:700]** P1-MissingSoftDelete: 查询 CertificateTemplate 缺少软删除过滤
  ```
  db.query(CertificateTemplate)
  ```
- **[app\api\v1\learn\exampaper.py:71]** P1-MissingSoftDelete: 查询 ExamPaperRecord 缺少软删除过滤
  ```
  db.query(ExamPaperRecord)
  ```
- **[app\api\v1\learn\exampaper.py:116]** P1-MissingSoftDelete: 查询 ExamPaperRecord 缺少软删除过滤
  ```
  item = db.query(ExamPaperRecord).filter(ExamPaperRecord.id == body.record_id).first()
  ```
- **[app\api\v1\learn\exampaper.py:134]** P1-MissingSoftDelete: 查询 ExamPaperRecord 缺少软删除过滤
  ```
  item = db.query(ExamPaperRecord).filter(ExamPaperRecord.id == record_id).first()
  ```
- **[app\api\v1\learn\exampaper.py:154]** P1-MissingSoftDelete: 查询 ExamPaperRecord 缺少软删除过滤
  ```
  q = db.query(ExamPaperRecord).filter(ExamPaperRecord.member_id == member_id)
  ```
- **[app\api\v1\learn\exampaper.py:176]** P1-MissingSoftDelete: 查询 ExamPaperRecord 缺少软删除过滤
  ```
  q = db.query(ExamPaperRecord).filter(ExamPaperRecord.exam_id == exam_id)
  ```
- **[app\api\v1\learn\exampaper.py:198]** P1-MissingSoftDelete: 查询 ExamPaperRecord 缺少软删除过滤
  ```
  q = db.query(ExamPaperRecord).filter(ExamPaperRecord.lesson_id == lesson_id)
  ```
- **[app\api\v1\learn\exampaper.py:217]** P1-MissingSoftDelete: 查询 ExamPaperRecord 缺少软删除过滤
  ```
  db.query(ExamPaperRecord)
  ```
- **[app\api\v1\learn\exampaper.py:285]** P1-MissingSoftDelete: 查询 ExamPaperRecord 缺少软删除过滤
  ```
  item = db.query(ExamPaperRecord).filter(ExamPaperRecord.id == record_id).first()
  ```
- **[app\api\v1\learn\exampaper.py:298]** P1-MissingSoftDelete: 查询 ExamPaperRecord 缺少软删除过滤
  ```
  item = db.query(ExamPaperRecord).filter(ExamPaperRecord.id == record_id).first()
  ```
- **[app\api\v1\learn\homework.py:100]** P1-MissingSoftDelete: 查询 Homework 缺少软删除过滤
  ```
  item = db.query(Homework).filter(Homework.id == homework_id).first()
  ```
- **[app\api\v1\learn\homework.py:114]** P1-MissingSoftDelete: 查询 Homework 缺少软删除过滤
  ```
  db.query(Homework)
  ```
- **[app\api\v1\learn\homework.py:131]** P1-MissingSoftDelete: 查询 Homework 缺少软删除过滤
  ```
  item = db.query(Homework).filter(Homework.id == homework_id).first()
  ```
- **[app\api\v1\learn\homework.py:149]** P1-MissingSoftDelete: 查询 Homework 缺少软删除过滤
  ```
  item = db.query(Homework).filter(Homework.id == homework_id).first()
  ```
- **[app\api\v1\learn\homework.py:184]** P1-MissingSoftDelete: 查询 HomeworkRecord 缺少软删除过滤
  ```
  db.query(HomeworkRecord)
  ```
- **[app\api\v1\learn\homework.py:206]** P1-MissingSoftDelete: 查询 HomeworkRecord 缺少软删除过滤
  ```
  q = db.query(HomeworkRecord).filter(HomeworkRecord.lesson_id == lesson_id)
  ```
- **[app\api\v1\learn\homework.py:233]** P1-MissingSoftDelete: 查询 HomeworkRecord 缺少软删除过滤
  ```
  db.query(HomeworkRecord)
  ```
- **[app\api\v1\learn\learnmap.py:73]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  q = db.query(LearnMap).filter(LearnMap.status != 2)
  ```
- **[app\api\v1\learn\learnmap.py:95]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  item = db.query(LearnMap).filter(LearnMap.id == map_id).first()
  ```
- **[app\api\v1\learn\learnmap.py:99]** P1-MissingSoftDelete: 查询 LearnMapTopic 缺少软删除过滤
  ```
  db.query(LearnMapTopic)
  ```
- **[app\api\v1\learn\learnmap.py:137]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  item = db.query(LearnMap).filter(LearnMap.id == map_id).first()
  ```
- **[app\api\v1\learn\learnmap.py:157]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  item = db.query(LearnMap).filter(LearnMap.id == map_id).first()
  ```
- **[app\api\v1\learn\learnmap.py:172]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  item = db.query(LearnMap).filter(LearnMap.id == map_id).first()
  ```
- **[app\api\v1\learn\learnmap.py:187]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  item = db.query(LearnMap).filter(LearnMap.id == map_id).first()
  ```
- **[app\api\v1\learn\learnmap.py:205]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  q = db.query(LearnMap).filter(LearnMap.status == 1)
  ```
- **[app\api\v1\learn\learnmap.py:218]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  item = db.query(LearnMap).filter(LearnMap.id == map_id).first()
  ```
- **[app\api\v1\learn\learnmap.py:233]** P1-MissingSoftDelete: 查询 LearnMapTopic 缺少软删除过滤
  ```
  db.query(LearnMapTopic)
  ```
- **[app\api\v1\learn\learnmap.py:249]** P1-MissingSoftDelete: 查询 LearnMapTopic 缺少软删除过滤
  ```
  db.query(LearnMapTopic)
  ```
- **[app\api\v1\learn\learnmap.py:272]** P1-MissingSoftDelete: 查询 LearnMapTopic 缺少软删除过滤
  ```
  db.query(LearnMapTopic)
  ```
- **[app\api\v1\learn\lesson.py:187]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  q = db.query(Lesson).filter(Lesson.status != 2)
  ```
- **[app\api\v1\learn\lesson.py:212]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  q = db.query(Lesson).filter(Lesson.status == 1)
  ```
- **[app\api\v1\learn\lesson.py:269]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  q = db.query(Lesson).filter(Lesson.status == 1)
  ```
- **[app\api\v1\learn\lesson.py:292]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
  ```
- **[app\api\v1\learn\lesson.py:296]** P1-MissingSoftDelete: 查询 LessonChapter 缺少软删除过滤
  ```
  db.query(LessonChapter)
  ```
- **[app\api\v1\learn\lesson.py:304]** P1-MissingSoftDelete: 查询 LessonChapterSection 缺少软删除过滤
  ```
  db.query(LessonChapterSection)
  ```
- **[app\api\v1\learn\lesson.py:357]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
  ```
- **[app\api\v1\learn\lesson.py:374]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
  ```
- **[app\api\v1\learn\lesson.py:389]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
  ```
- **[app\api\v1\learn\lesson.py:404]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
  ```
- **[app\api\v1\learn\lesson.py:425]** P1-MissingSoftDelete: 查询 LessonCategoryRelation 缺少软删除过滤
  ```
  db.query(LessonCategoryRelation)
  ```
- **[app\api\v1\learn\lesson.py:448]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
  ```
- **[app\api\v1\learn\lesson.py:451]** P1-MissingSoftDelete: 查询 LessonCategoryRelation 缺少软删除过滤
  ```
  db.query(LessonCategoryRelation).filter(
  ```
- **[app\api\v1\learn\lesson.py:475]** P1-MissingSoftDelete: 查询 LessonChapter 缺少软删除过滤
  ```
  db.query(LessonChapter)
  ```
- **[app\api\v1\learn\lesson.py:490]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
  ```
- **[app\api\v1\learn\lesson.py:513]** P1-MissingSoftDelete: 查询 LessonChapter 缺少软删除过滤
  ```
  db.query(LessonChapter).filter(LessonChapter.id == item.id).first()
  ```
- **[app\api\v1\learn\lesson.py:529]** P1-MissingSoftDelete: 查询 LessonChapter 缺少软删除过滤
  ```
  db.query(LessonChapter).filter(LessonChapter.id == chapter_id).first()
  ```
- **[app\api\v1\learn\lesson.py:548]** P1-MissingSoftDelete: 查询 LessonChapter 缺少软删除过滤
  ```
  db.query(LessonChapter).filter(LessonChapter.id == chapter_id).first()
  ```
- **[app\api\v1\learn\lesson.py:552]** P1-MissingSoftDelete: 查询 LessonChapterSection 缺少软删除过滤
  ```
  db.query(LessonChapterSection).filter(
  ```
- **[app\api\v1\learn\lesson.py:573]** P1-MissingSoftDelete: 查询 LessonChapterSection 缺少软删除过滤
  ```
  db.query(LessonChapterSection)
  ```
- **[app\api\v1\learn\lesson.py:592]** P1-MissingSoftDelete: 查询 LessonChapter 缺少软删除过滤
  ```
  db.query(LessonChapter).filter(LessonChapter.id == chapter_id).first()
  ```
- **[app\api\v1\learn\lesson.py:620]** P1-MissingSoftDelete: 查询 LessonChapterSection 缺少软删除过滤
  ```
  db.query(LessonChapterSection)
  ```
- **[app\api\v1\learn\lesson.py:641]** P1-MissingSoftDelete: 查询 LessonChapterSection 缺少软删除过滤
  ```
  db.query(LessonChapterSection)
  ```
- **[app\api\v1\learn\rate.py:76]** P1-MissingSoftDelete: 查询 Rate 缺少软删除过滤
  ```
  db.query(Rate)
  ```
- **[app\api\v1\learn\rate.py:115]** P1-MissingSoftDelete: 查询 Rate 缺少软删除过滤
  ```
  q = db.query(Rate).filter(Rate.lesson_id == lesson_id)
  ```
- **[app\api\v1\learn\rate.py:133]** P1-MissingSoftDelete: 查询 Rate 缺少软删除过滤
  ```
  q = db.query(Rate).filter(Rate.lesson_id == lesson_id)
  ```
- **[app\api\v1\learn\rate.py:197]** P1-MissingSoftDelete: 查询 Rate 缺少软删除过滤
  ```
  q = db.query(Rate).filter(Rate.member_id == member_id)
  ```
- **[app\api\v1\learn\rate.py:215]** P1-MissingSoftDelete: 查询 Rate 缺少软删除过滤
  ```
  rate = db.query(Rate).filter(Rate.id == rate_id).first()
  ```
- **[app\api\v1\learn\rate.py:228]** P1-MissingSoftDelete: 查询 Rate 缺少软删除过滤
  ```
  rate = db.query(Rate).filter(Rate.id == rate_id).first()
  ```
- **[app\api\v1\learn\record.py:64]** P1-MissingSoftDelete: 查询 Record 缺少软删除过滤
  ```
  db.query(Record)
  ```
- **[app\api\v1\learn\record.py:104]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  signup = db.query(SignUp).filter(SignUp.id == body.sign_up_id).first()
  ```
- **[app\api\v1\learn\record.py:107]** P1-MissingSoftDelete: 查询 Record 缺少软删除过滤
  ```
  db.query(Record)
  ```
- **[app\api\v1\learn\record.py:132]** P1-MissingSoftDelete: 查询 Record 缺少软删除过滤
  ```
  db.query(Record)
  ```
- **[app\api\v1\learn\record.py:166]** P1-MissingSoftDelete: 查询 Record 缺少软删除过滤
  ```
  q = db.query(Record).filter(Record.member_id == member_id)
  ```
- **[app\api\v1\learn\report.py:50]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  lessons = db.query(Lesson).filter(Lesson.id.in_(lesson_ids)).all()
  ```
- **[app\api\v1\learn\report.py:93]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  lessons = db.query(Lesson).filter(Lesson.id.in_(lesson_ids)).all()
  ```
- **[app\api\v1\learn\signup.py:66]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  db.query(SignUp)
  ```
- **[app\api\v1\learn\signup.py:76]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  lesson = db.query(Lesson).filter(Lesson.id == body.lesson_id).first()
  ```
- **[app\api\v1\learn\signup.py:102]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  db.query(SignUp)
  ```
- **[app\api\v1\learn\signup.py:125]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  signup = db.query(SignUp).filter(SignUp.id == signup_id).first()
  ```
- **[app\api\v1\learn\signup.py:138]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  signup = db.query(SignUp).filter(SignUp.id == signup_id).first()
  ```
- **[app\api\v1\learn\signup.py:153]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  signup = db.query(SignUp).filter(SignUp.id == signup_id).first()
  ```
- **[app\api\v1\learn\signup.py:171]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  signup = db.query(SignUp).filter(SignUp.id == signup_id).first()
  ```
- **[app\api\v1\learn\signup.py:198]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  q = db.query(SignUp).filter(SignUp.member_id == member_id)
  ```
- **[app\api\v1\learn\signup.py:225]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  q = db.query(SignUp).filter(SignUp.lesson_id == lesson_id)
  ```
- **[app\api\v1\learn\signup.py:253]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  db.query(SignUp)
  ```
- **[app\api\v1\learn\signup.py:258]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  db.query(SignUp)
  ```
- **[app\api\v1\learn\signup.py:283]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  db.query(SignUp)
  ```
- **[app\api\v1\learn\signup.py:288]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  db.query(SignUp)
  ```
- **[app\api\v1\learn\task.py:97]** P1-MissingSoftDelete: 查询 LessonTask 缺少软删除过滤
  ```
  q = db.query(LessonTask).filter(LessonTask.lesson_id == lesson_id)
  ```
- **[app\api\v1\learn\task.py:118]** P1-MissingSoftDelete: 查询 LessonTask 缺少软删除过滤
  ```
  db.query(LessonTask)
  ```
- **[app\api\v1\learn\task.py:155]** P1-MissingSoftDelete: 查询 LessonTask 缺少软删除过滤
  ```
  task = db.query(LessonTask).filter(LessonTask.id == task_id).first()
  ```
- **[app\api\v1\learn\task.py:168]** P1-MissingSoftDelete: 查询 LessonTask 缺少软删除过滤
  ```
  task = db.query(LessonTask).filter(LessonTask.id == task_id).first()
  ```
- **[app\api\v1\learn\task.py:185]** P1-MissingSoftDelete: 查询 LessonTask 缺少软删除过滤
  ```
  task = db.query(LessonTask).filter(LessonTask.id == task_id).first()
  ```
- **[app\api\v1\learn\task.py:200]** P1-MissingSoftDelete: 查询 LessonTask 缺少软删除过滤
  ```
  task = db.query(LessonTask).filter(LessonTask.id == task_id).first()
  ```
- **[app\api\v1\learn\task.py:215]** P1-MissingSoftDelete: 查询 LessonTask 缺少软删除过滤
  ```
  task = db.query(LessonTask).filter(LessonTask.id == task_id).first()
  ```
- **[app\api\v1\learn\topic.py:95]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  q = db.query(Topic).filter(Topic.status != 2)
  ```
- **[app\api\v1\learn\topic.py:117]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  item = db.query(Topic).filter(Topic.id == topic_id).first()
  ```
- **[app\api\v1\learn\topic.py:153]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  item = db.query(Topic).filter(Topic.id == topic_id).first()
  ```
- **[app\api\v1\learn\topic.py:183]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  item = db.query(Topic).filter(Topic.id == topic_id).first()
  ```
- **[app\api\v1\learn\topic.py:198]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  item = db.query(Topic).filter(Topic.id == topic_id).first()
  ```
- **[app\api\v1\learn\topic.py:213]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  item = db.query(Topic).filter(Topic.id == topic_id).first()
  ```
- **[app\api\v1\learn\topic.py:231]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  q = db.query(Topic).filter(Topic.status == 1)
  ```
- **[app\api\v1\learn\topic.py:244]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  item = db.query(Topic).filter(Topic.id == topic_id).first()
  ```
- **[app\api\v1\learn\topic.py:264]** P1-MissingSoftDelete: 查询 TopicLesson 缺少软删除过滤
  ```
  q = db.query(TopicLesson).filter(TopicLesson.topic_id == topic_id)
  ```
- **[app\api\v1\learn\topic.py:285]** P1-MissingSoftDelete: 查询 TopicLesson 缺少软删除过滤
  ```
  db.query(TopicLesson)
  ```
- **[app\api\v1\learn\topic.py:308]** P1-MissingSoftDelete: 查询 TopicLesson 缺少软删除过滤
  ```
  db.query(TopicLesson)
  ```
- **[app\api\v1\live\category.py:74]** P1-MissingSoftDelete: 查询 LiveChannelCategory 缺少软删除过滤
  ```
  q = db.query(LiveChannelCategory)
  ```
- **[app\api\v1\live\category.py:112]** P1-MissingSoftDelete: 查询 LiveChannelCategory 缺少软删除过滤
  ```
  c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == body.id).first()
  ```
- **[app\api\v1\live\category.py:133]** P1-MissingSoftDelete: 查询 LiveChannelCategory 缺少软删除过滤
  ```
  c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == body.id).first()
  ```
- **[app\api\v1\live\category.py:147]** P1-MissingSoftDelete: 查询 LiveChannelCategory 缺少软删除过滤
  ```
  c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == body.id).first()
  ```
- **[app\api\v1\live\category.py:161]** P1-MissingSoftDelete: 查询 LiveChannelCategory 缺少软删除过滤
  ```
  c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == body.category_id).first()
  ```
- **[app\api\v1\live\category.py:175]** P1-MissingSoftDelete: 查询 LiveChannelCategory 缺少软删除过滤
  ```
  c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == category_id).first()
  ```
- **[app\api\v1\live\category.py:189]** P1-MissingSoftDelete: 查询 LiveChannelCategory 缺少软删除过滤
  ```
  c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == category_id).first()
  ```
- **[app\api\v1\live\category.py:202]** P1-MissingSoftDelete: 查询 LiveChannelCategory 缺少软删除过滤
  ```
  c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == category_id).first()
  ```
- **[app\api\v1\live\channel.py:68]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  q = db.query(LiveChannel).filter(LiveChannel.deleted == False)
  ```
- **[app\api\v1\live\channel.py:94]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(LiveChannel.id == cid, LiveChannel.deleted == False).first()
  ```
- **[app\api\v1\live\channel.py:101]** P1-MissingSoftDelete: 查询 LiveSubscribe 缺少软删除过滤
  ```
  db.query(LiveSubscribe).filter(LiveSubscribe.user_id == uid, LiveSubscribe.channel_id == cid).first()
  ```
- **[app\api\v1\live\channel.py:159]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(LiveChannel.id == cid).first()
  ```
- **[app\api\v1\live\channel.py:180]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(LiveChannel.id == cid).first()
  ```
- **[app\api\v1\live\channel.py:195]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(LiveChannel.id == cid).first()
  ```
- **[app\api\v1\live\channel.py:215]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(LiveChannel.id == cid).first()
  ```
- **[app\api\v1\live\channel.py:230]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(LiveChannel.id == cid).first()
  ```
- **[app\api\v1\live\channel.py:234]** P1-MissingSoftDelete: 查询 LiveSubscribe 缺少软删除过滤
  ```
  sub = db.query(LiveSubscribe).filter(LiveSubscribe.user_id == uid, LiveSubscribe.channel_id == cid).first()
  ```
- **[app\api\v1\live\channel.py:249]** P1-MissingSoftDelete: 查询 LiveComment 缺少软删除过滤
  ```
  q = db.query(LiveComment).filter(LiveComment.channel_id == cid)
  ```
- **[app\api\v1\live\channel.py:276]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(LiveChannel.id == cid).first()
  ```
- **[app\api\v1\live\channel.py:300]** P1-MissingSoftDelete: 查询 LiveChannelCategory 缺少软删除过滤
  ```
  db.query(LiveChannelCategory)
  ```
- **[app\api\v1\live\channel.py:316]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  items = db.query(LiveChannel).filter(LiveChannel.id.in_(id_list), LiveChannel.deleted == False).all()
  ```
- **[app\api\v1\live\channel.py:327]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(LiveChannel.id == cid, LiveChannel.deleted == False).first()
  ```
- **[app\api\v1\live\channel.py:350]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(LiveChannel.id == cid, LiveChannel.deleted == False).first()
  ```
- **[app\api\v1\live\lecturer.py:32]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(
  ```
- **[app\api\v1\live\lecturer.py:38]** P1-MissingSoftDelete: 查询 ChannelLecturer 缺少软删除过滤
  ```
  db.query(ChannelLecturer)
  ```
- **[app\api\v1\live\lecturer.py:64]** P1-MissingSoftDelete: 查询 ChannelLecturer 缺少软删除过滤
  ```
  db.query(ChannelLecturer)
  ```
- **[app\api\v1\live\lecturer.py:85]** P1-MissingSoftDelete: 查询 ChannelLecturer 缺少软删除过滤
  ```
  db.query(ChannelLecturer)
  ```
- **[app\api\v1\live\lecturer.py:101]** P1-MissingSoftDelete: 查询 ChannelLecturer 缺少软删除过滤
  ```
  db.query(ChannelLecturer)
  ```
- **[app\api\v1\live\lecturer.py:120]** P1-MissingSoftDelete: 查询 ChannelLecturer 缺少软删除过滤
  ```
  db.query(ChannelLecturer)
  ```
- **[app\api\v1\live\lecturer.py:144]** P1-MissingSoftDelete: 查询 ChannelLecturer 缺少软删除过滤
  ```
  db.query(ChannelLecturer)
  ```
- **[app\api\v1\live\subscribe.py:38]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(LiveChannel.id == body.channel_id, LiveChannel.deleted == False).first()
  ```
- **[app\api\v1\live\subscribe.py:43]** P1-MissingSoftDelete: 查询 LiveSubscribe 缺少软删除过滤
  ```
  db.query(LiveSubscribe)
  ```
- **[app\api\v1\live\subscribe.py:65]** P1-MissingSoftDelete: 查询 LiveSubscribe 缺少软删除过滤
  ```
  db.query(LiveSubscribe)
  ```
- **[app\api\v1\live\subscribe.py:83]** P1-MissingSoftDelete: 查询 LiveSubscribe 缺少软删除过滤
  ```
  db.query(LiveSubscribe)
  ```
- **[app\api\v1\live\subscribe.py:101]** P1-MissingSoftDelete: 查询 LiveSubscribe 缺少软删除过滤
  ```
  q = db.query(LiveSubscribe).filter(LiveSubscribe.channel_id == channel_id)
  ```
- **[app\api\v1\live\subscribe.py:121]** P1-MissingSoftDelete: 查询 LiveSubscribe 缺少软删除过滤
  ```
  db.query(LiveSubscribe)
  ```
- **[app\api\v1\live\tencent.py:40]** P1-MissingSoftDelete: 查询 TencentCloudLiveStream 缺少软删除过滤
  ```
  db.query(TencentCloudLiveStream)
  ```
- **[app\api\v1\live\tencent.py:64]** P1-MissingSoftDelete: 查询 TencentCloudLiveStream 缺少软删除过滤
  ```
  db.query(TencentCloudLiveStream)
  ```
- **[app\api\v1\live\tencent.py:101]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(LiveChannel.id == body.channel_id).first()
  ```
- **[app\api\v1\live\tencent.py:116]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  c = db.query(LiveChannel).filter(LiveChannel.id == body.channel_id).first()
  ```
- **[app\api\v1\llm\models_unify.py:32]** P1-MissingSoftDelete: 查询 AiModelInfo 缺少软删除过滤
  ```
  q = db.query(AiModelInfo)
  ```
- **[app\api\v1\message\message.py:128]** P1-MissingSoftDelete: 查询 Message 缺少软删除过滤
  ```
  q = db.query(Message).filter(Message.user_id == _uid())
  ```
- **[app\api\v1\message\message.py:166]** P1-MissingSoftDelete: 查询 Message 缺少软删除过滤
  ```
  count = db.query(Message).filter(Message.user_id == _uid(), not Message.is_read).count()
  ```
- **[app\api\v1\message\message.py:177]** P1-MissingSoftDelete: 查询 Message 缺少软删除过滤
  ```
  m = db.query(Message).filter(Message.id == mid, Message.user_id == _uid()).first()
  ```
- **[app\api\v1\message\message.py:192]** P1-MissingSoftDelete: 查询 Message 缺少软删除过滤
  ```
  db.query(Message).filter(Message.user_id == _uid(), not Message.is_read).update(
  ```
- **[app\api\v1\message\message.py:205]** P1-MissingSoftDelete: 查询 Message 缺少软删除过滤
  ```
  m = db.query(Message).filter(Message.id == mid, Message.user_id == _uid()).first()
  ```
- **[app\api\v1\message\message.py:220]** P1-MissingSoftDelete: 查询 Message 缺少软删除过滤
  ```
  db.query(Message).filter(Message.id.in_(id_list), Message.user_id == _uid()).delete(
  ```
- **[app\api\v1\message\message.py:240]** P1-MissingSoftDelete: 查询 MessageAnnouncement 缺少软删除过滤
  ```
  q = db.query(MessageAnnouncement).filter(MessageAnnouncement.status == 1)
  ```
- **[app\api\v1\message\message.py:282]** P1-MissingSoftDelete: 查询 MessageAnnouncement 缺少软删除过滤
  ```
  a = db.query(MessageAnnouncement).filter(
  ```
- **[app\api\v1\message\message.py:351]** P1-MissingSoftDelete: 查询 MessageAnnouncement 缺少软删除过滤
  ```
  a = db.query(MessageAnnouncement).filter(MessageAnnouncement.id == aid).first()
  ```
- **[app\api\v1\message\message.py:372]** P1-MissingSoftDelete: 查询 MessageAnnouncement 缺少软删除过滤
  ```
  a = db.query(MessageAnnouncement).filter(MessageAnnouncement.id == aid).first()
  ```
- **[app\api\v1\message\message.py:415]** P1-MissingSoftDelete: 查询 MessageTemplate 缺少软删除过滤
  ```
  q = db.query(MessageTemplate).filter(MessageTemplate.status == 1)
  ```
- **[app\api\v1\notification\notification.py:100]** P1-MissingSoftDelete: 查询 Notification 缺少软删除过滤
  ```
  q = db.query(Notification).filter((Notification.user_id == _uid()) | (Notification.user_id.is_(None)))
  ```
- **[app\api\v1\notification\notification.py:137]** P1-MissingSoftDelete: 查询 Notification 缺少软删除过滤
  ```
  db.query(Notification)
  ```
- **[app\api\v1\notification\notification.py:154]** P1-MissingSoftDelete: 查询 Notification 缺少软删除过滤
  ```
  n = db.query(Notification).filter(Notification.id == nid).first()
  ```
- **[app\api\v1\notification\notification.py:169]** P1-MissingSoftDelete: 查询 Notification 缺少软删除过滤
  ```
  db.query(Notification).filter(
  ```
- **[app\api\v1\notification\notification.py:183]** P1-MissingSoftDelete: 查询 Notification 缺少软删除过滤
  ```
  n = db.query(Notification).filter(Notification.id == nid).first()
  ```
- **[app\api\v1\notification\notification.py:200]** P1-MissingSoftDelete: 查询 NotificationChannel 缺少软删除过滤
  ```
  q = db.query(NotificationChannel).filter(NotificationChannel.status == 1)
  ```
- **[app\api\v1\notification\notification.py:246]** P1-MissingSoftDelete: 查询 NotificationChannel 缺少软删除过滤
  ```
  c = db.query(NotificationChannel).filter(NotificationChannel.id == cid).first()
  ```
- **[app\api\v1\notification\notification.py:267]** P1-MissingSoftDelete: 查询 NotificationChannel 缺少软删除过滤
  ```
  c = db.query(NotificationChannel).filter(NotificationChannel.id == cid).first()
  ```
- **[app\api\v1\notification\notification.py:284]** P1-MissingSoftDelete: 查询 NotificationSubscription 缺少软删除过滤
  ```
  items = db.query(NotificationSubscription).filter(NotificationSubscription.user_id == _uid()).all()
  ```
- **[app\api\v1\notification\notification.py:307]** P1-MissingSoftDelete: 查询 NotificationSubscription 缺少软删除过滤
  ```
  db.query(NotificationSubscription)
  ```
- **[app\api\v1\notification\notification.py:334]** P1-MissingSoftDelete: 查询 NotificationLog 缺少软删除过滤
  ```
  q = db.query(NotificationLog)
  ```
- **[app\api\v1\organization\organization.py:64]** P1-MissingSoftDelete: 查询 Organization 缺少软删除过滤
  ```
  q = db.query(Organization)
  ```
- **[app\api\v1\organization\organization.py:103]** P1-MissingSoftDelete: 查询 Organization 缺少软删除过滤
  ```
  db.query(Organization).filter(Organization.status == 1).order_by(Organization.sort_order.asc()).all()
  ```
- **[app\api\v1\organization\organization.py:136]** P1-MissingSoftDelete: 查询 Organization 缺少软删除过滤
  ```
  o = db.query(Organization).filter(Organization.id == oid).first()
  ```
- **[app\api\v1\organization\organization.py:214]** P1-MissingSoftDelete: 查询 Organization 缺少软删除过滤
  ```
  o = db.query(Organization).filter(Organization.id == oid).first()
  ```
- **[app\api\v1\organization\organization.py:241]** P1-MissingSoftDelete: 查询 Organization 缺少软删除过滤
  ```
  o = db.query(Organization).filter(Organization.id == oid).first()
  ```
- **[app\api\v1\organization\organization.py:244]** P1-MissingSoftDelete: 查询 Organization 缺少软删除过滤
  ```
  has_child = db.query(Organization).filter(Organization.pid == oid).count() > 0
  ```
- **[app\api\v1\organization\organization.py:247]** P1-MissingSoftDelete: 查询 OrganizationMember 缺少软删除过滤
  ```
  db.query(OrganizationMember).filter(OrganizationMember.org_id == oid).delete()
  ```
- **[app\api\v1\organization\organization.py:259]** P1-MissingSoftDelete: 查询 OrganizationMember 缺少软删除过滤
  ```
  q = db.query(OrganizationMember).filter(OrganizationMember.org_id == oid, OrganizationMember.status == 1)
  ```
- **[app\api\v1\organization\organization.py:285]** P1-MissingSoftDelete: 查询 OrganizationMember 缺少软删除过滤
  ```
  db.query(OrganizationMember)
  ```
- **[app\api\v1\organization\organization.py:301]** P1-MissingSoftDelete: 查询 Organization 缺少软删除过滤
  ```
  db.query(Organization).filter(Organization.id == oid).update(
  ```
- **[app\api\v1\organization\organization.py:315]** P1-MissingSoftDelete: 查询 OrganizationMember 缺少软删除过滤
  ```
  db.query(OrganizationMember)
  ```
- **[app\api\v1\organization\organization.py:322]** P1-MissingSoftDelete: 查询 Organization 缺少软删除过滤
  ```
  db.query(Organization).filter(Organization.id == oid).update(
  ```
- **[app\api\v1\payments\wechat.py:385]** P1-MissingSoftDelete: 查询 WithdrawalFlow 缺少软删除过滤
  ```
  flow = db1.query(WithdrawalFlow).filter(WithdrawalFlow.partner_trade_no == partner_trade_no).first()
  ```
- **[app\api\v1\payments\wechat.py:499]** P1-MissingSoftDelete: 查询 ZhsProduct 缺少软删除过滤
  ```
  db1.query(ZhsProduct)
  ```
- **[app\api\v1\point\point.py:27]** P1-MissingSoftDelete: 查询 PointAccount 缺少软删除过滤
  ```
  acc = db.query(PointAccount).filter(PointAccount.user_id == user_id).first()
  ```
- **[app\api\v1\point\point.py:45]** P1-MissingSoftDelete: 查询 PointRule 缺少软删除过滤
  ```
  rule = db.query(PointRule).filter(PointRule.code == action, PointRule.status == 1).first()
  ```
- **[app\api\v1\point\point.py:54]** P1-MissingSoftDelete: 查询 PointLog 缺少软删除过滤
  ```
  db.query(PointLog)
  ```
- **[app\api\v1\point\point.py:136]** P1-MissingSoftDelete: 查询 PointAccount 缺少软删除过滤
  ```
  acc = db.query(PointAccount).filter(PointAccount.user_id == user_id).first()
  ```
- **[app\api\v1\point\point.py:167]** P1-MissingSoftDelete: 查询 PointLog 缺少软删除过滤
  ```
  q = db.query(PointLog).filter(PointLog.user_id == _uid())
  ```
- **[app\api\v1\point\point.py:203]** P1-MissingSoftDelete: 查询 PointRule 缺少软删除过滤
  ```
  q = db.query(PointRule).filter(PointRule.status == 1)
  ```
- **[app\api\v1\point\point.py:267]** P1-MissingSoftDelete: 查询 PointRule 缺少软删除过滤
  ```
  r = db.query(PointRule).filter(PointRule.id == rid).first()
  ```
- **[app\api\v1\point\point.py:288]** P1-MissingSoftDelete: 查询 PointRule 缺少软删除过滤
  ```
  r = db.query(PointRule).filter(PointRule.id == rid).first()
  ```
- **[app\api\v1\point\point.py:345]** P1-MissingSoftDelete: 查询 PointGoods 缺少软删除过滤
  ```
  q = db.query(PointGoods).filter(PointGoods.status == 1)
  ```
- **[app\api\v1\point\point.py:382]** P1-MissingSoftDelete: 查询 PointGoods 缺少软删除过滤
  ```
  g = db.query(PointGoods).filter(PointGoods.id == gid).first()
  ```
- **[app\api\v1\point\point.py:447]** P1-MissingSoftDelete: 查询 PointGoods 缺少软删除过滤
  ```
  g = db.query(PointGoods).filter(PointGoods.id == gid).first()
  ```
- **[app\api\v1\point\point.py:470]** P1-MissingSoftDelete: 查询 PointGoods 缺少软删除过滤
  ```
  g = db.query(PointGoods).filter(PointGoods.id == gid).first()
  ```
- **[app\api\v1\point\point.py:493]** P1-MissingSoftDelete: 查询 PointGoods 缺少软删除过滤
  ```
  g = db.query(PointGoods).filter(PointGoods.id == goods_id).first()
  ```
- **[app\api\v1\point\point.py:500]** P1-MissingSoftDelete: 查询 PointExchange 缺少软删除过滤
  ```
  db.query(PointExchange)
  ```
- **[app\api\v1\point\point.py:536]** P1-MissingSoftDelete: 查询 PointExchange 缺少软删除过滤
  ```
  q = db.query(PointExchange).filter(PointExchange.user_id == _uid())
  ```
- **[app\api\v1\ranking\ranking.py:64]** P1-MissingSoftDelete: 查询 RankingList 缺少软删除过滤
  ```
  items = db.query(RankingList).filter(RankingList.status == 1).all()
  ```
- **[app\api\v1\ranking\ranking.py:90]** P1-MissingSoftDelete: 查询 PointAccount 缺少软删除过滤
  ```
  items = db.query(PointAccount).order_by(PointAccount.total_point.desc()).limit(limit).all()
  ```
- **[app\api\v1\ranking\ranking.py:127]** P1-MissingSoftDelete: 查询 _A 缺少软删除过滤
  ```
  items = db.query(_A).filter(_A.is_deleted == 0).order_by(_A.heat.desc()).limit(limit).all() if db.query(_A).filter(_A.is
  ```
- **[app\api\v1\ranking\ranking.py:141]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  items = db.query(Agent).filter(Agent.is_deleted == 0).order_by(Agent.heat.desc()).limit(limit).all()
  ```
- **[app\api\v1\ranking\ranking.py:164]** P1-MissingSoftDelete: 查询 ZhsCourse 缺少软删除过滤
  ```
  items = db.query(ZhsCourse).order_by(ZhsCourse.view_num.desc()).limit(limit).all()
  ```
- **[app\api\v1\resource\context.py:52]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  db.query(UserAgentContext)
  ```
- **[app\api\v1\resource\context.py:95]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  q = db.query(UserAgentContext).filter(
  ```
- **[app\api\v1\resource\context.py:138]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  db.query(UserAgentContext)
  ```
- **[app\api\v1\resource\context.py:176]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  db.query(UserAgentContext)
  ```
- **[app\api\v1\resource\context.py:206]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
  ```
- **[app\api\v1\resource\context.py:228]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  db.query(UserAgentContext)
  ```
- **[app\api\v1\resource\home.py:29]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  hot_agents = db1.query(Agent).filter(Agent.is_deleted == 0).order_by(Agent.usage_count.desc()).limit(6).all()
  ```
- **[app\api\v1\resource\home.py:30]** P1-MissingSoftDelete: 查询 EducationalCourse 缺少软删除过滤
  ```
  hot_courses = db1.query(EducationalCourse).order_by(EducationalCourse.id.desc()).limit(6).all()
  ```
- **[app\api\v1\resource\home.py:32]** P1-MissingSoftDelete: 查询 SysNotice 缺少软删除过滤
  ```
  db1.query(SysNotice).filter(SysNotice.status == "0").order_by(SysNotice.notice_id.desc()).limit(3).all()
  ```
- **[app\api\v1\resource\home.py:35]** P1-MissingSoftDelete: 查询 AppContent 缺少软删除过滤
  ```
  db1.query(AppContent)
  ```
- **[app\api\v1\resource\home.py:81]** P1-MissingSoftDelete: 查询 UserMargin 缺少软删除过滤
  ```
  margin = db2.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\resource\home.py:115]** P1-MissingSoftDelete: 查询 AgentDeveloper 缺少软删除过滤
  ```
  items = db1.query(AgentDeveloper).filter(AgentDeveloper.agent_id == agent_id).all()
  ```
- **[app\api\v1\resource\home.py:160]** P1-MissingSoftDelete: 查询 ZhsProduct 缺少软删除过滤
  ```
  products = db1.query(ZhsProduct).filter(ZhsProduct.status == 1).order_by(ZhsProduct.sort.asc()).all()
  ```
- **[app\api\v1\resource\home.py:161]** P1-MissingSoftDelete: 查询 ExchangeRate 缺少软删除过滤
  ```
  rates = db1.query(ExchangeRate).filter(ExchangeRate.status == 1).order_by(ExchangeRate.sort.asc()).all()
  ```
- **[app\api\v1\resource\home.py:198]** P1-MissingSoftDelete: 查询 KnowledgePlanet 缺少软删除过滤
  ```
  db1.query(KnowledgePlanet)
  ```
- **[app\api\v1\resource\home.py:225]** P1-MissingSoftDelete: 查询 KnowledgePlanet 缺少软删除过滤
  ```
  db1.query(KnowledgePlanet)
  ```
- **[app\api\v1\resource\home.py:257]** P1-MissingSoftDelete: 查询 UserAgentFreeTime 缺少软删除过滤
  ```
  db1.query(UserAgentFreeTime)
  ```
- **[app\api\v1\resource\home.py:290]** P1-MissingSoftDelete: 查询 UserAgentFreeTime 缺少软删除过滤
  ```
  db1.query(UserAgentFreeTime)
  ```
- **[app\api\v1\resource\home.py:317]** P1-MissingSoftDelete: 查询 UserVip 缺少软删除过滤
  ```
  db2.query(UserVip)
  ```
- **[app\api\v1\schedule\schedule.py:53]** P1-MissingSoftDelete: 查询 Schedule 缺少软删除过滤
  ```
  q = db.query(Schedule).filter(Schedule.user_id == _uid())
  ```
- **[app\api\v1\schedule\schedule.py:139]** P1-MissingSoftDelete: 查询 Schedule 缺少软删除过滤
  ```
  s = db.query(Schedule).filter(Schedule.id == sid, Schedule.user_id == _uid()).first()
  ```
- **[app\api\v1\schedule\schedule.py:164]** P1-MissingSoftDelete: 查询 Schedule 缺少软删除过滤
  ```
  s = db.query(Schedule).filter(Schedule.id == sid, Schedule.user_id == _uid()).first()
  ```
- **[app\api\v1\search\search.py:31]** P1-MissingSoftDelete: 查询 SearchIndex 缺少软删除过滤
  ```
  db.query(SearchIndex)
  ```
- **[app\api\v1\search\search.py:71]** P1-MissingSoftDelete: 查询 SearchHotKeyword 缺少软删除过滤
  ```
  kw_record = db.query(SearchHotKeyword).filter(SearchHotKeyword.keyword == keyword).first()
  ```
- **[app\api\v1\search\search.py:109]** P1-MissingSoftDelete: 查询 SearchHotKeyword 缺少软删除过滤
  ```
  db.query(SearchHotKeyword)
  ```
- **[app\api\v1\search\search.py:174]** P1-MissingSoftDelete: 查询 SearchIndex 缺少软删除过滤
  ```
  db.query(SearchIndex)
  ```
- **[app\api\v1\search\search.py:218]** P1-MissingSoftDelete: 查询 SearchIndex 缺少软删除过滤
  ```
  idx = db.query(SearchIndex).filter(SearchIndex.id == idx_id).first()
  ```
- **[app\api\v1\search\search.py:232]** P1-MissingSoftDelete: 查询 SearchIndex 缺少软删除过滤
  ```
  db.query(SearchIndex).filter(
  ```
- **[app\api\v1\search\search.py:249]** P1-MissingSoftDelete: 查询 SearchHotKeyword 缺少软删除过滤
  ```
  h = db.query(SearchHotKeyword).filter(SearchHotKeyword.keyword == keyword).first()
  ```
- **[app\api\v1\search\search.py:268]** P1-MissingSoftDelete: 查询 SearchHotKeyword 缺少软删除过滤
  ```
  h = db.query(SearchHotKeyword).filter(SearchHotKeyword.id == kid).first()
  ```
- **[app\api\v1\search\search.py:290]** P1-MissingSoftDelete: 查询 SearchLog 缺少软删除过滤
  ```
  q = db.query(SearchLog)
  ```
- **[app\api\v1\service_catalog\service_catalog.py:73]** P1-MissingSoftDelete: 查询 ServiceNode 缺少软删除过滤
  ```
  q = db.query(ServiceNode)
  ```
- **[app\api\v1\service_catalog\service_catalog.py:115]** P1-MissingSoftDelete: 查询 ServiceNode 缺少软删除过滤
  ```
  s = db.query(ServiceNode).filter(ServiceNode.id == sid).first()
  ```
- **[app\api\v1\service_catalog\service_catalog.py:198]** P1-MissingSoftDelete: 查询 ServiceNode 缺少软删除过滤
  ```
  s = db.query(ServiceNode).filter(ServiceNode.id == sid).first()
  ```
- **[app\api\v1\service_catalog\service_catalog.py:223]** P1-MissingSoftDelete: 查询 ServiceNode 缺少软删除过滤
  ```
  s = db.query(ServiceNode).filter(ServiceNode.id == sid).first()
  ```
- **[app\api\v1\service_catalog\service_catalog.py:237]** P1-MissingSoftDelete: 查询 ServiceNode 缺少软删除过滤
  ```
  s = db.query(ServiceNode).filter(ServiceNode.id == sid).first()
  ```
- **[app\api\v1\service_catalog\service_catalog.py:259]** P1-MissingSoftDelete: 查询 ServiceCallLog 缺少软删除过滤
  ```
  q = db.query(ServiceCallLog)
  ```
- **[app\api\v1\system\admin.py:34]** P1-MissingSoftDelete: 查询 model 缺少软删除过滤
  ```
  q = db.query(model)
  ```
- **[app\api\v1\system\admin.py:105]** P1-MissingSoftDelete: 查询 SysRole 缺少软删除过滤
  ```
  r = db.query(SysRole).filter(SysRole.role_id == role_id).first()
  ```
- **[app\api\v1\system\admin.py:119]** P1-MissingSoftDelete: 查询 SysRole 缺少软删除过滤
  ```
  r = db.query(SysRole).filter(SysRole.role_id == role_id).first()
  ```
- **[app\api\v1\system\admin.py:150]** P1-MissingSoftDelete: 查询 SysMenu 缺少软删除过滤
  ```
  menus = db.query(SysMenu).filter(SysMenu.status == "0").order_by(SysMenu.menu_id).all()
  ```
- **[app\api\v1\system\admin.py:179]** P1-MissingSoftDelete: 查询 SysMenu 缺少软删除过滤
  ```
  menus = db.query(SysMenu).filter(SysMenu.status == "0").order_by(SysMenu.menu_id).all()
  ```
- **[app\api\v1\system\admin.py:195]** P1-MissingSoftDelete: 查询 SysMenu 缺少软删除过滤
  ```
  menus = db.query(SysMenu).filter(SysMenu.status == "0").order_by(SysMenu.menu_id).all()
  ```
- **[app\api\v1\system\admin.py:238]** P1-MissingSoftDelete: 查询 SysMenu 缺少软删除过滤
  ```
  m = db.query(SysMenu).filter(SysMenu.menu_id == menu_id).first()
  ```
- **[app\api\v1\system\admin.py:290]** P1-MissingSoftDelete: 查询 SysDept 缺少软删除过滤
  ```
  d = db.query(SysDept).filter(SysDept.dept_id == dept_id).first()
  ```
- **[app\api\v1\system\admin.py:350]** P1-MissingSoftDelete: 查询 SysConfig 缺少软删除过滤
  ```
  c = db.query(SysConfig).filter(SysConfig.config_key == config_key).first()
  ```
- **[app\api\v1\system\admin.py:383]** P1-MissingSoftDelete: 查询 SysConfig 缺少软删除过滤
  ```
  c = db.query(SysConfig).filter(SysConfig.config_id == config_id).first()
  ```
- **[app\api\v1\system\admin.py:436]** P1-MissingSoftDelete: 查询 SysDictData 缺少软删除过滤
  ```
  items = db.query(SysDictData).filter(SysDictData.dict_type == dict_type).all()
  ```
- **[app\api\v1\system\admin.py:521]** P1-MissingSoftDelete: 查询 model 缺少软删除过滤
  ```
  q = db.query(model)
  ```
- **[app\api\v1\system\audit.py:26]** P1-MissingSoftDelete: 查询 SysOperLog 缺少软删除过滤
  ```
  q = db.query(SysOperLog)
  ```
- **[app\api\v1\system\audit.py:93]** P1-MissingSoftDelete: 查询 SysOperLog 缺少软删除过滤
  ```
  deleted = db.query(SysOperLog).filter(SysOperLog.oper_time < cutoff).delete()
  ```
- **[app\api\v1\system\audit.py:218]** P1-MissingSoftDelete: 查询 SysOperLog 缺少软删除过滤
  ```
  q = db.query(SysOperLog)
  ```
- **[app\api\v1\system\codegen.py:57]** P1-MissingSoftDelete: 查询 CodegenTable 缺少软删除过滤
  ```
  q = db.query(CodegenTable)
  ```
- **[app\api\v1\system\codegen.py:159]** P1-MissingSoftDelete: 查询 CodegenColumn 缺少软删除过滤
  ```
  rows = db.query(CodegenColumn).filter(CodegenColumn.table_id == table_id).order_by(CodegenColumn.sort).all()
  ```
- **[app\api\v1\system\codegen.py:209]** P1-MissingSoftDelete: 查询 CodegenTable 缺少软删除过滤
  ```
  exists = db.query(CodegenTable).filter(CodegenTable.table_name == tname).first()
  ```
- **[app\api\v1\system\codegen.py:320]** P1-MissingSoftDelete: 查询 CodegenTable 缺少软删除过滤
  ```
  table = db.query(CodegenTable).filter(CodegenTable.table_id == table_id).first()
  ```
- **[app\api\v1\system\codegen.py:325]** P1-MissingSoftDelete: 查询 CodegenColumn 缺少软删除过滤
  ```
  db.query(CodegenColumn).filter(CodegenColumn.table_id == table_id).order_by(CodegenColumn.sort).all()
  ```
- **[app\api\v1\system\codegen.py:370]** P1-MissingSoftDelete: 查询 CodegenTable 缺少软删除过滤
  ```
  table = db.query(CodegenTable).filter(CodegenTable.table_name == table_name).first()
  ```
- **[app\api\v1\system\codegen.py:375]** P1-MissingSoftDelete: 查询 CodegenColumn 缺少软删除过滤
  ```
  db.query(CodegenColumn)
  ```
- **[app\api\v1\system\codegen.py:431]** P1-MissingSoftDelete: 查询 CodegenTable 缺少软删除过滤
  ```
  table = db.query(CodegenTable).filter(CodegenTable.table_id == table_id).first()
  ```
- **[app\api\v1\system\codegen.py:459]** P1-MissingSoftDelete: 查询 CodegenColumn 缺少软删除过滤
  ```
  col = db.query(CodegenColumn).filter(CodegenColumn.column_id == col_id).first()
  ```
- **[app\api\v1\system\codegen.py:504]** P1-MissingSoftDelete: 查询 CodegenColumn 缺少软删除过滤
  ```
  db.query(CodegenColumn).filter(CodegenColumn.table_id.in_(ids)).delete(synchronize_session=False)
  ```
- **[app\api\v1\system\codegen.py:505]** P1-MissingSoftDelete: 查询 CodegenTable 缺少软删除过滤
  ```
  db.query(CodegenTable).filter(CodegenTable.table_id.in_(ids)).delete(synchronize_session=False)
  ```
- **[app\api\v1\system\user.py:35]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  u = db.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\system\user.py:179]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  u = db.query(SysUser).filter(SysUser.user_id == user_id).first()
  ```
- **[app\api\v1\system\user.py:211]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  u = db.query(SysUser).filter(SysUser.user_id == user_id).first()
  ```
- **[app\api\v1\system\user.py:243]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  u = db.query(SysUser).filter(SysUser.user_id == user_id).first()
  ```
- **[app\api\v1\system\user.py:263]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  u = db.query(SysUser).filter(SysUser.user_id == user_id).first()
  ```
- **[app\api\v1\system\user.py:393]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  user = db.query(SysUser).filter(SysUser.user_id == sys_user_id).first()
  ```
- **[app\api\v1\system\user.py:395]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  user = db.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\system\user.py:401]** P1-MissingSoftDelete: 查询 SysRole 缺少软删除过滤
  ```
  db.query(SysRole)
  ```
- **[app\api\v1\system\user.py:428]** P1-MissingSoftDelete: 查询 SysDept 缺少软删除过滤
  ```
  dept = db.query(SysDept).filter(SysDept.dept_id == user.dept_id).first()
  ```
- **[app\api\v1\system\user.py:472]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  user = db.query(SysUser).filter(SysUser.user_id == sys_user_id).first()
  ```
- **[app\api\v1\system\user.py:474]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  user = db.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\system\user.py:534]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  user = db.query(SysUser).filter(SysUser.user_id == sys_user_id).first()
  ```
- **[app\api\v1\system\user.py:536]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  user = db.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\system\user.py:580]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  user = db.query(SysUser).filter(SysUser.user_id == sys_user_id).first()
  ```
- **[app\api\v1\system\user.py:582]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  user = db.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\system\user.py:647]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  user = db.query(SysUser).filter(SysUser.user_id == sys_user_id).first()
  ```
- **[app\api\v1\system\user.py:649]** P1-MissingSoftDelete: 查询 SysUser 缺少软删除过滤
  ```
  user = db.query(SysUser).filter(SysUser.user_uuid == user_uuid).first()
  ```
- **[app\api\v1\system\user.py:686]** P1-MissingSoftDelete: 查询 SysMenu 缺少软删除过滤
  ```
  menus = db.query(SysMenu).order_by(SysMenu.order_num).limit(500).all()
  ```
- **[app\api\v1\system\user.py:706]** P1-MissingSoftDelete: 查询 SysMenu 缺少软删除过滤
  ```
  menus = db.query(SysMenu).filter(SysMenu.status == "0").order_by(SysMenu.menu_id).all()
  ```
- **[app\api\v1\system\user.py:735]** P1-MissingSoftDelete: 查询 SysMenu 缺少软删除过滤
  ```
  menus = db.query(SysMenu).filter(SysMenu.status == "0").order_by(SysMenu.menu_id).all()
  ```
- **[app\api\v1\system\user.py:774]** P1-MissingSoftDelete: 查询 SysPost 缺少软删除过滤
  ```
  items = db.query(SysPost).limit(500).all()
  ```
- **[app\api\v1\system\user.py:794]** P1-MissingSoftDelete: 查询 SysDictType 缺少软删除过滤
  ```
  items = db.query(SysDictType).limit(500).all()
  ```
- **[app\api\v1\system\user.py:808]** P1-MissingSoftDelete: 查询 SysDictData 缺少软删除过滤
  ```
  items = db.query(SysDictData).filter(SysDictData.dict_type == dict_type).all()
  ```
- **[app\api\v1\system\user.py:828]** P1-MissingSoftDelete: 查询 SysDictData 缺少软删除过滤
  ```
  items = db.query(SysDictData).filter(SysDictData.dict_type == dict_type).all()
  ```
- **[app\api\v1\system\user.py:848]** P1-MissingSoftDelete: 查询 SysConfig 缺少软删除过滤
  ```
  configs = db.query(SysConfig).limit(500).all()
  ```
- **[app\api\v1\system\user.py:866]** P1-MissingSoftDelete: 查询 SysDictData 缺少软删除过滤
  ```
  db.query(SysDictData)
  ```
- **[app\api\v1\tbox\tbox.py:68]** P1-MissingSoftDelete: 查询 TboxDevice 缺少软删除过滤
  ```
  q = db.query(TboxDevice)
  ```
- **[app\api\v1\tbox\tbox.py:98]** P1-MissingSoftDelete: 查询 TboxDevice 缺少软删除过滤
  ```
  d = db.query(TboxDevice).filter(TboxDevice.device_no == device_no).first()
  ```
- **[app\api\v1\tbox\tbox.py:121]** P1-MissingSoftDelete: 查询 TboxDevice 缺少软删除过滤
  ```
  d = db.query(TboxDevice).filter(TboxDevice.device_no == device_no).first()
  ```
- **[app\api\v1\tbox\tbox.py:143]** P1-MissingSoftDelete: 查询 TboxDevice 缺少软删除过滤
  ```
  d = db.query(TboxDevice).filter(TboxDevice.device_no == device_no).first()
  ```
- **[app\api\v1\tbox\tbox.py:163]** P1-MissingSoftDelete: 查询 TboxDevice 缺少软删除过滤
  ```
  d = db.query(TboxDevice).filter(TboxDevice.device_no == device_no).first()
  ```
- **[app\api\v1\tbox\tbox.py:185]** P1-MissingSoftDelete: 查询 TboxDevice 缺少软删除过滤
  ```
  d = db.query(TboxDevice).filter(TboxDevice.device_no == device_no).first()
  ```
- **[app\api\v1\tbox\tbox.py:205]** P1-MissingSoftDelete: 查询 TboxCommand 缺少软删除过滤
  ```
  q = db.query(TboxCommand)
  ```
- **[app\api\v1\upload\routes.py:413]** P1-MissingSoftDelete: 查询 ShareRecord 缺少软删除过滤
  ```
  shares = db.query(ShareRecord).order_by(ShareRecord.created_at.desc()).limit(100).all()
  ```
- **[app\api\v1\user\user_sys_link.py:39]** P1-MissingSoftDelete: 查询 ZhsUserSysLink 缺少软删除过滤
  ```
  q = db.query(ZhsUserSysLink).filter(ZhsUserSysLink.is_del == 0)
  ```
- **[app\api\v1\user\user_sys_link.py:51]** P1-MissingSoftDelete: 查询 ZhsUserSysLink 缺少软删除过滤
  ```
  item = db.query(ZhsUserSysLink).filter(ZhsUserSysLink.id == link_id, ZhsUserSysLink.is_del == 0).first()
  ```
- **[app\api\v1\user\user_sys_link.py:72]** P1-MissingSoftDelete: 查询 ZhsUserSysLink 缺少软删除过滤
  ```
  item = db.query(ZhsUserSysLink).filter(ZhsUserSysLink.id == link_id).first()
  ```
- **[app\api\v1\user\user_sys_link.py:84]** P1-MissingSoftDelete: 查询 ZhsUserSysLink 缺少软删除过滤
  ```
  item = db.query(ZhsUserSysLink).filter(ZhsUserSysLink.id == link_id).first()
  ```
- **[app\api\v1\user\user_sys_link.py:93]** P1-MissingSoftDelete: 查询 ZhsUserSysLink 缺少软删除过滤
  ```
  item = db.query(ZhsUserSysLink).filter(
  ```
- **[app\api\v1\user\vip.py:60]** P1-MissingSoftDelete: 查询 VipLevel 缺少软删除过滤
  ```
  db.query(VipLevel)
  ```
- **[app\api\v1\user\vip.py:78]** P1-MissingSoftDelete: 查询 VipLevel 缺少软删除过滤
  ```
  level = db.query(VipLevel).filter(VipLevel.id == vip_id).first()
  ```
- **[app\api\v1\user\vip.py:94]** P1-MissingSoftDelete: 查询 UserVip 缺少软删除过滤
  ```
  db.query(UserVip)
  ```
- **[app\api\v1\user\vip.py:112]** P1-MissingSoftDelete: 查询 VipLevel 缺少软删除过滤
  ```
  level = db.query(VipLevel).filter(VipLevel.id == record.vip_level_id).first()
  ```
- **[app\api\v1\user\vip.py:153]** P1-MissingSoftDelete: 查询 VipLevel 缺少软删除过滤
  ```
  db.query(VipLevel)
  ```
- **[app\api\v1\user\vip.py:215]** P1-MissingSoftDelete: 查询 UserVip 缺少软删除过滤
  ```
  db.query(UserVip)
  ```
- **[app\api\v1\user\vip.py:234]** P1-MissingSoftDelete: 查询 VipLevel 缺少软删除过滤
  ```
  level = db.query(VipLevel).filter(VipLevel.id == record.vip_level_id).first()
  ```
- **[app\api\v1\user_agent_context\user_agent_context.py:96]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  q = db.query(UserAgentContext).filter(
  ```
- **[app\api\v1\user_agent_context\user_agent_context.py:128]** P1-MissingSoftDelete: 查询 UserAgentContext 缺少软删除过滤
  ```
  q = db.query(UserAgentContext).filter(
  ```
- **[app\api\v1\user_agent_context\user_agent_context.py:176]** P1-MissingSoftDelete: 查询 UserAgentContextSummary 缺少软删除过滤
  ```
  db.query(UserAgentContextSummary)
  ```
- **[app\api\v1\user_agent_image\user_agent_image.py:97]** P1-MissingSoftDelete: 查询 UserAgentImage 缺少软删除过滤
  ```
  q = db.query(UserAgentImage).filter(UserAgentImage.user_id == _uid())
  ```
- **[app\api\v1\user_agent_image\user_agent_image.py:135]** P1-MissingSoftDelete: 查询 UserAgentImage 缺少软删除过滤
  ```
  i = db.query(UserAgentImage).filter(UserAgentImage.id == iid).first()
  ```
- **[app\api\v1\user_agent_image\user_agent_image.py:164]** P1-MissingSoftDelete: 查询 UserAgentImage 缺少软删除过滤
  ```
  i = db.query(UserAgentImage).filter(UserAgentImage.id == iid, UserAgentImage.user_id == _uid()).first()
  ```
- **[app\api\v1\user_comment_log\user_comment_log.py:62]** P1-MissingSoftDelete: 查询 UserCommentLog 缺少软删除过滤
  ```
  q = db.query(UserCommentLog)
  ```
- **[app\api\v1\user_video_comment\user_video_comment.py:43]** P1-MissingSoftDelete: 查询 UserVideoComment 缺少软删除过滤
  ```
  q = db.query(UserVideoComment).filter(
  ```
- **[app\api\v1\user_video_comment\user_video_comment.py:105]** P1-MissingSoftDelete: 查询 UserVideoComment 缺少软删除过滤
  ```
  c = db.query(UserVideoComment).filter(UserVideoComment.id == cid).first()
  ```
- **[app\api\v1\user_video_log\user_video_log.py:84]** P1-MissingSoftDelete: 查询 UserVideoLog 缺少软删除过滤
  ```
  q = db.query(UserVideoLog).filter(UserVideoLog.user_id == _uid())
  ```
- **[app\api\v1\user_video_log\user_video_log.py:119]** P1-MissingSoftDelete: 查询 UserVideoLog 缺少软删除过滤
  ```
  total = db.query(UserVideoLog).filter(UserVideoLog.user_id == uid).count()
  ```
- **[app\api\v1\user_video_log\user_video_log.py:121]** P1-MissingSoftDelete: 查询 UserVideoLog 缺少软删除过滤
  ```
  db.query(UserVideoLog).filter(UserVideoLog.user_id == uid, UserVideoLog.is_finished).count()
  ```
- **[app\api\v1\video_preload\video_preload.py:78]** P1-MissingSoftDelete: 查询 VideoPreload 缺少软删除过滤
  ```
  q = db.query(VideoPreload).filter(VideoPreload.user_id == _uid())
  ```
- **[app\api\v1\video_preload\video_preload.py:108]** P1-MissingSoftDelete: 查询 VideoPreload 缺少软删除过滤
  ```
  p = db.query(VideoPreload).filter(VideoPreload.id == pid, VideoPreload.user_id == _uid()).first()
  ```
- **[app\api\v1\video_preload\video_preload.py:122]** P1-MissingSoftDelete: 查询 VideoPreload 缺少软删除过滤
  ```
  p = db.query(VideoPreload).filter(VideoPreload.id == pid, VideoPreload.user_id == _uid()).first()
  ```
- **[app\api\v1\visit\visit.py:62]** P1-MissingSoftDelete: 查询 VisitStats 缺少软删除过滤
  ```
  db.query(VisitStats)
  ```
- **[app\api\v1\visit\visit.py:101]** P1-MissingSoftDelete: 查询 VisitLog 缺少软删除过滤
  ```
  q = db.query(VisitLog)
  ```
- **[app\api\v1\visit\visit.py:147]** P1-MissingSoftDelete: 查询 VisitStats 缺少软删除过滤
  ```
  q = db.query(VisitStats).filter(VisitStats.stat_type == "daily")
  ```
- **[app\api\v1\visit\visit.py:182]** P1-MissingSoftDelete: 查询 VisitStats 缺少软删除过滤
  ```
  db.query(VisitStats)
  ```
- **[app\api\v1\visit\visit.py:216]** P1-MissingSoftDelete: 查询 VisitSource 缺少软删除过滤
  ```
  q = db.query(VisitSource)
  ```
- **[app\api\v1\visit\visit.py:243]** P1-MissingSoftDelete: 查询 VisitPage 缺少软删除过滤
  ```
  q = db.query(VisitPage)
  ```
- **[app\api\v1\visit\visit.py:271]** P1-MissingSoftDelete: 查询 VisitSource 缺少软删除过滤
  ```
  r = db.query(VisitSource).filter(VisitSource.stat_date == d, VisitSource.source == source).first()
  ```
- **[app\api\v1\visit\visit.py:287]** P1-MissingSoftDelete: 查询 VisitPage 缺少软删除过滤
  ```
  r = db.query(VisitPage).filter(VisitPage.stat_date == d, VisitPage.path == path).first()
  ```
- **[app\api\v1\ws\timbre.py:51]** P1-MissingSoftDelete: 查询 Timbre 缺少软删除过滤
  ```
  q = db.query(Timbre).filter(Timbre.status == 1)
  ```
- **[app\api\v1\ws\timbre.py:112]** P1-MissingSoftDelete: 查询 Timbre 缺少软删除过滤
  ```
  t = db.query(Timbre).filter(Timbre.id == timbre_id).first()
  ```
- **[app\api\v1\ws\timbre.py:128]** P1-MissingSoftDelete: 查询 Timbre 缺少软删除过滤
  ```
  t = db.query(Timbre).filter(Timbre.id == timbre_id).first()
  ```
- **[app\services\agent_service.py:15]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  a = db.query(Agent).filter(Agent.agent_id == agent_id).first()
  ```
- **[app\services\agent_service.py:37]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  q = db.query(Agent)
  ```
- **[app\services\agent_service.py:89]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
  ```
- **[app\services\agent_service.py:101]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
  ```
- **[app\services\ask_business.py:60]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  q = db.query(AskQuestion)
  ```
- **[app\services\ask_business.py:72]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  obj = db.query(AskQuestion).filter(AskQuestion.id == circle_id).first()
  ```
- **[app\services\ask_business.py:101]** P1-MissingSoftDelete: 查询 AskQuestion 缺少软删除过滤
  ```
  q = db.query(AskQuestion)
  ```
- **[app\services\ask_business.py:124]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  q = db.query(AskAnswer)
  ```
- **[app\services\ask_business.py:164]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  q = db.query(AskAnswer)
  ```
- **[app\services\ask_business.py:174]** P1-MissingSoftDelete: 查询 AskAnswer 缺少软删除过滤
  ```
  obj = db.query(AskAnswer).filter(AskAnswer.id == answer_id).first()
  ```
- **[app\services\ask_business.py:197]** P1-MissingSoftDelete: 查询 AskWatch 缺少软删除过滤
  ```
  db.query(AskWatch)
  ```
- **[app\services\ask_circle_ext_service.py:51]** P1-MissingSoftDelete: 查询 AskAnswerExt 缺少软删除过滤
  ```
  db.query(AskAnswerExt).filter(AskAnswerExt.answer_id == answer_id).first()
  ```
- **[app\services\ask_circle_ext_service.py:86]** P1-MissingSoftDelete: 查询 AskQuestionExt 缺少软删除过滤
  ```
  db.query(AskQuestionExt)
  ```
- **[app\services\avatar_sync_service.py:27]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
  ```
- **[app\services\avatar_sync_service.py:31]** P1-MissingSoftDelete: 查询 AgentExamine 缺少软删除过滤
  ```
  db.query(AgentExamine)
  ```
- **[app\services\avatar_sync_service.py:89]** P1-MissingSoftDelete: 查询 Agent 缺少软删除过滤
  ```
  agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
  ```
- **[app\services\category_business.py:65]** P1-MissingSoftDelete: 查询 Category 缺少软删除过滤
  ```
  q = db.query(Category)
  ```
- **[app\services\category_business.py:81]** P1-MissingSoftDelete: 查询 Category 缺少软删除过滤
  ```
  obj = db.query(Category).filter(Category.id == cat_id).first()
  ```
- **[app\services\category_business.py:124]** P1-MissingSoftDelete: 查询 Category 缺少软删除过滤
  ```
  obj = db.query(Category).filter(Category.id == cat_id).first()
  ```
- **[app\services\category_business.py:146]** P1-MissingSoftDelete: 查询 Category 缺少软删除过滤
  ```
  obj = db.query(Category).filter(Category.id == cat_id).first()
  ```
- **[app\services\category_business.py:153]** P1-MissingSoftDelete: 查询 Category 缺少软删除过滤
  ```
  obj = db.query(Category).filter(Category.id == cat_id).first()
  ```
- **[app\services\category_business.py:160]** P1-MissingSoftDelete: 查询 Category 缺少软删除过滤
  ```
  obj = db.query(Category).filter(Category.id == cat_id).first()
  ```
- **[app\services\category_business.py:175]** P1-MissingSoftDelete: 查询 TopicCategory 缺少软删除过滤
  ```
  q = db.query(TopicCategory)
  ```
- **[app\services\category_business.py:187]** P1-MissingSoftDelete: 查询 TopicCategory 缺少软删除过滤
  ```
  obj = db.query(TopicCategory).filter(TopicCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:230]** P1-MissingSoftDelete: 查询 TopicCategory 缺少软删除过滤
  ```
  obj = db.query(TopicCategory).filter(TopicCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:252]** P1-MissingSoftDelete: 查询 TopicCategory 缺少软删除过滤
  ```
  obj = db.query(TopicCategory).filter(TopicCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:259]** P1-MissingSoftDelete: 查询 TopicCategory 缺少软删除过滤
  ```
  obj = db.query(TopicCategory).filter(TopicCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:266]** P1-MissingSoftDelete: 查询 TopicCategory 缺少软删除过滤
  ```
  obj = db.query(TopicCategory).filter(TopicCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:281]** P1-MissingSoftDelete: 查询 PaperCategory 缺少软删除过滤
  ```
  q = db.query(PaperCategory)
  ```
- **[app\services\category_business.py:293]** P1-MissingSoftDelete: 查询 PaperCategory 缺少软删除过滤
  ```
  obj = db.query(PaperCategory).filter(PaperCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:330]** P1-MissingSoftDelete: 查询 PaperCategory 缺少软删除过滤
  ```
  obj = db.query(PaperCategory).filter(PaperCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:352]** P1-MissingSoftDelete: 查询 PaperCategory 缺少软删除过滤
  ```
  obj = db.query(PaperCategory).filter(PaperCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:359]** P1-MissingSoftDelete: 查询 PaperCategory 缺少软删除过滤
  ```
  obj = db.query(PaperCategory).filter(PaperCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:366]** P1-MissingSoftDelete: 查询 PaperCategory 缺少软删除过滤
  ```
  obj = db.query(PaperCategory).filter(PaperCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:388]** P1-MissingSoftDelete: 查询 QuestionCategory 缺少软删除过滤
  ```
  q = db.query(QuestionCategory)
  ```
- **[app\services\category_business.py:400]** P1-MissingSoftDelete: 查询 QuestionCategory 缺少软删除过滤
  ```
  obj = db.query(QuestionCategory).filter(QuestionCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:437]** P1-MissingSoftDelete: 查询 QuestionCategory 缺少软删除过滤
  ```
  obj = db.query(QuestionCategory).filter(QuestionCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:459]** P1-MissingSoftDelete: 查询 QuestionCategory 缺少软删除过滤
  ```
  obj = db.query(QuestionCategory).filter(QuestionCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:466]** P1-MissingSoftDelete: 查询 QuestionCategory 缺少软删除过滤
  ```
  obj = db.query(QuestionCategory).filter(QuestionCategory.id == cat_id).first()
  ```
- **[app\services\category_business.py:473]** P1-MissingSoftDelete: 查询 QuestionCategory 缺少软删除过滤
  ```
  obj = db.query(QuestionCategory).filter(QuestionCategory.id == cat_id).first()
  ```
- **[app\services\category_service.py:15]** P1-MissingSoftDelete: 查询 AgentCategory 缺少软删除过滤
  ```
  q = db.query(AgentCategory)
  ```
- **[app\services\certificate_business.py:48]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  q = db.query(Certificate)
  ```
- **[app\services\certificate_business.py:62]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
  ```
- **[app\services\certificate_business.py:69]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  db.query(Certificate)
  ```
- **[app\services\certificate_business.py:112]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
  ```
- **[app\services\certificate_business.py:121]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
  ```
- **[app\services\certificate_business.py:130]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
  ```
- **[app\services\certificate_business.py:139]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
  ```
- **[app\services\certificate_business.py:148]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
  ```
- **[app\services\certificate_business.py:157]** P1-MissingSoftDelete: 查询 Certificate 缺少软删除过滤
  ```
  obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
  ```
- **[app\services\certificate_business.py:175]** P1-MissingSoftDelete: 查询 CertificateTemplate 缺少软删除过滤
  ```
  q = db.query(CertificateTemplate)
  ```
- **[app\services\certificate_business.py:187]** P1-MissingSoftDelete: 查询 CertificateTemplate 缺少软删除过滤
  ```
  obj = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
  ```
- **[app\services\certificate_business.py:233]** P1-MissingSoftDelete: 查询 CertificateTemplate 缺少软删除过滤
  ```
  obj = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
  ```
- **[app\services\certificate_business.py:263]** P1-MissingSoftDelete: 查询 CertificateTemplate 缺少软删除过滤
  ```
  obj = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
  ```
- **[app\services\certificate_business.py:270]** P1-MissingSoftDelete: 查询 CertificateTemplate 缺少软删除过滤
  ```
  obj = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
  ```
- **[app\services\certificate_business.py:277]** P1-MissingSoftDelete: 查询 CertificateTemplate 缺少软删除过滤
  ```
  obj = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
  ```
- **[app\services\commission_service.py:36]** P1-MissingSoftDelete: 查询 IdentityProportion 缺少软删除过滤
  ```
  db.query(IdentityProportion)
  ```
- **[app\services\commission_service.py:69]** P1-MissingSoftDelete: 查询 IdentityProportion 缺少软删除过滤
  ```
  db.query(IdentityProportion)
  ```
- **[app\services\commission_service.py:92]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == open_id).first()
  ```
- **[app\services\commission_service.py:370]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  order = db.query(Order).filter(Order.out_trade_no == out_trade_no).first()
  ```
- **[app\services\commission_service.py:384]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db2.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\services\crew_orchestrator.py:97]** P1-MissingSoftDelete: 查询 CrewSession 缺少软删除过滤
  ```
  session = db.query(CrewSession).filter(CrewSession.id == session_id).first()
  ```
- **[app\services\crew_orchestrator.py:256]** P1-MissingSoftDelete: 查询 CrewSession 缺少软删除过滤
  ```
  session = db.query(CrewSession).filter(CrewSession.id == session_id).first()
  ```
- **[app\services\crew_orchestrator.py:350]** P1-MissingSoftDelete: 查询 CrewSession 缺少软删除过滤
  ```
  s = db.query(CrewSession).filter(CrewSession.id == session_id).first()
  ```
- **[app\services\crew_orchestrator.py:525]** P1-MissingSoftDelete: 查询 CrewTask 缺少软删除过滤
  ```
  task = db.query(CrewTask).filter(CrewTask.id == task_id).first()
  ```
- **[app\services\crew_orchestrator.py:543]** P1-MissingSoftDelete: 查询 CrewSession 缺少软删除过滤
  ```
  session = db.query(CrewSession).filter(CrewSession.id == session_id).first()
  ```
- **[app\services\crew_orchestrator.py:575]** P1-MissingSoftDelete: 查询 CrewSession 缺少软删除过滤
  ```
  session = db.query(CrewSession).filter(CrewSession.id == session_id).first()
  ```
- **[app\services\crew_orchestrator.py:592]** P1-MissingSoftDelete: 查询 CrewSession 缺少软删除过滤
  ```
  q = db.query(CrewSession)
  ```
- **[app\services\crew_orchestrator.py:610]** P1-MissingSoftDelete: 查询 CrewTask 缺少软删除过滤
  ```
  db.query(CrewTask)
  ```
- **[app\services\crew_orchestrator.py:634]** P1-MissingSoftDelete: 查询 CrewMessage 缺少软删除过滤
  ```
  db.query(CrewMessage)
  ```
- **[app\services\crew_orchestrator.py:654]** P1-MissingSoftDelete: 查询 CrewSession 缺少软删除过滤
  ```
  session = db.query(CrewSession).filter(CrewSession.id == session_id).first()
  ```
- **[app\services\database_service.py:332]** P1-MissingSoftDelete: 查询 FileRecord 缺少软删除过滤
  ```
  return db.query(FileRecord).filter(FileRecord.file_id == file_id).first()
  ```
- **[app\services\database_service.py:336]** P1-MissingSoftDelete: 查询 FileRecord 缺少软删除过滤
  ```
  file_record = db.query(FileRecord).filter(FileRecord.file_id == file_id).first()
  ```
- **[app\services\database_service.py:360]** P1-MissingSoftDelete: 查询 OperationRecord 缺少软删除过滤
  ```
  op = db.query(OperationRecord).filter(OperationRecord.id == op_id).first()
  ```
- **[app\services\database_service.py:373]** P1-MissingSoftDelete: 查询 OperationRecord 缺少软删除过滤
  ```
  return db.query(OperationRecord).filter(OperationRecord.file_id == file_id).all()
  ```
- **[app\services\database_service.py:393]** P1-MissingSoftDelete: 查询 CertificateRecord 缺少软删除过滤
  ```
  return db.query(CertificateRecord).filter(
  ```
- **[app\services\database_service.py:399]** P1-MissingSoftDelete: 查询 CertificateRecord 缺少软删除过滤
  ```
  cert = db.query(CertificateRecord).filter(
  ```
- **[app\services\database_service.py:412]** P1-MissingSoftDelete: 查询 FileRecord 缺少软删除过滤
  ```
  expired = db.query(FileRecord).filter(FileRecord.created_at < cutoff).all()
  ```
- **[app\services\database_service.py:431]** P1-MissingSoftDelete: 查询 UploadRecord 缺少软删除过滤
  ```
  return db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
  ```
- **[app\services\database_service.py:435]** P1-MissingSoftDelete: 查询 UploadRecord 缺少软删除过滤
  ```
  record = db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
  ```
- **[app\services\database_service.py:447]** P1-MissingSoftDelete: 查询 UploadRecord 缺少软删除过滤
  ```
  record = db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
  ```
- **[app\services\database_service.py:457]** P1-MissingSoftDelete: 查询 UploadRecord 缺少软删除过滤
  ```
  record = db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
  ```
- **[app\services\database_service.py:476]** P1-MissingSoftDelete: 查询 UploadedFileRecord 缺少软删除过滤
  ```
  return db.query(UploadedFileRecord).filter(UploadedFileRecord.file_id == file_id).first()
  ```
- **[app\services\database_service.py:480]** P1-MissingSoftDelete: 查询 UploadedFileRecord 缺少软删除过滤
  ```
  query = db.query(UploadedFileRecord)
  ```
- **[app\services\database_service.py:487]** P1-MissingSoftDelete: 查询 UploadedFileRecord 缺少软删除过滤
  ```
  record = db.query(UploadedFileRecord).filter(UploadedFileRecord.file_id == file_id).first()
  ```
- **[app\services\database_service.py:496]** P1-MissingSoftDelete: 查询 UploadedFileRecord 缺少软删除过滤
  ```
  query = db.query(UploadedFileRecord)
  ```
- **[app\services\database_service.py:513]** P1-MissingSoftDelete: 查询 ShareRecord 缺少软删除过滤
  ```
  return db.query(ShareRecord).filter(ShareRecord.share_id == share_id).first()
  ```
- **[app\services\database_service.py:517]** P1-MissingSoftDelete: 查询 ShareRecord 缺少软删除过滤
  ```
  record = db.query(ShareRecord).filter(ShareRecord.share_id == share_id).first()
  ```
- **[app\services\database_service.py:527]** P1-MissingSoftDelete: 查询 ShareRecord 缺少软删除过滤
  ```
  record = db.query(ShareRecord).filter(ShareRecord.share_id == share_id).first()
  ```
- **[app\services\database_service.py:536]** P1-MissingSoftDelete: 查询 ShareRecord 缺少软删除过滤
  ```
  record = db.query(ShareRecord).filter(ShareRecord.share_id == share_id).first()
  ```
- **[app\services\database_service.py:545]** P1-MissingSoftDelete: 查询 ShareRecord 缺少软删除过滤
  ```
  return db.query(ShareRecord).filter(
  ```
- **[app\services\database_service.py:551]** P1-MissingSoftDelete: 查询 ShareRecord 缺少软删除过滤
  ```
  expired = db.query(ShareRecord).filter(
  ```
- **[app\services\database_service.py:566]** P1-MissingSoftDelete: 查询 FileVersionRecord 缺少软删除过滤
  ```
  db.query(FileVersionRecord).filter(
  ```
- **[app\services\database_service.py:570]** P1-MissingSoftDelete: 查询 FileVersionRecord 缺少软删除过滤
  ```
  latest = db.query(FileVersionRecord).filter(
  ```
- **[app\services\database_service.py:595]** P1-MissingSoftDelete: 查询 FileVersionRecord 缺少软删除过滤
  ```
  return db.query(FileVersionRecord).filter(
  ```
- **[app\services\database_service.py:601]** P1-MissingSoftDelete: 查询 FileVersionRecord 缺少软删除过滤
  ```
  return db.query(FileVersionRecord).filter(
  ```
- **[app\services\database_service.py:607]** P1-MissingSoftDelete: 查询 FileVersionRecord 缺少软删除过滤
  ```
  return db.query(FileVersionRecord).filter(
  ```
- **[app\services\database_service.py:614]** P1-MissingSoftDelete: 查询 FileVersionRecord 缺少软删除过滤
  ```
  version = db.query(FileVersionRecord).filter(
  ```
- **[app\services\database_service.py:620]** P1-MissingSoftDelete: 查询 FileVersionRecord 缺少软删除过滤
  ```
  db.query(FileVersionRecord).filter(
  ```
- **[app\services\database_service.py:631]** P1-MissingSoftDelete: 查询 FileVersionRecord 缺少软删除过滤
  ```
  version = db.query(FileVersionRecord).filter(
  ```
- **[app\services\database_service.py:685]** P1-MissingSoftDelete: 查询 UserRecord 缺少软删除过滤
  ```
  return db.query(UserRecord).filter(UserRecord.user_id == user_id).first()
  ```
- **[app\services\database_service.py:689]** P1-MissingSoftDelete: 查询 UserRecord 缺少软删除过滤
  ```
  return db.query(UserRecord).filter(UserRecord.id == id).first()
  ```
- **[app\services\database_service.py:693]** P1-MissingSoftDelete: 查询 UserRecord 缺少软删除过滤
  ```
  return db.query(UserRecord).filter(UserRecord.username == username).first()
  ```
- **[app\services\database_service.py:697]** P1-MissingSoftDelete: 查询 UserRecord 缺少软删除过滤
  ```
  user = db.query(UserRecord).filter(UserRecord.id == user_id).first()
  ```
- **[app\services\database_service.py:706]** P1-MissingSoftDelete: 查询 UserRecord 缺少软删除过滤
  ```
  user = db.query(UserRecord).filter(UserRecord.user_id == user_id).first()
  ```
- **[app\services\database_service.py:728]** P1-MissingSoftDelete: 查询 UserRoleRecord 缺少软删除过滤
  ```
  user_roles = db.query(UserRoleRecord).filter(
  ```
- **[app\services\database_service.py:732]** P1-MissingSoftDelete: 查询 RoleRecord 缺少软删除过滤
  ```
  return db.query(RoleRecord).filter(RoleRecord.role_id.in_(role_ids)).all()
  ```
- **[app\services\database_service.py:736]** P1-MissingSoftDelete: 查询 UserRoleRecord 缺少软删除过滤
  ```
  user_roles = db.query(UserRoleRecord).filter(
  ```
- **[app\services\database_service.py:741]** P1-MissingSoftDelete: 查询 RolePermissionRecord 缺少软删除过滤
  ```
  role_perms = db.query(RolePermissionRecord).filter(
  ```
- **[app\services\database_service.py:746]** P1-MissingSoftDelete: 查询 PermissionRecord 缺少软删除过滤
  ```
  return db.query(PermissionRecord).filter(
  ```
- **[app\services\database_service.py:769]** P1-MissingSoftDelete: 查询 RoleRecord 缺少软删除过滤
  ```
  return db.query(RoleRecord).filter(RoleRecord.role_id == role_id).first()
  ```
- **[app\services\database_service.py:773]** P1-MissingSoftDelete: 查询 RoleRecord 缺少软删除过滤
  ```
  return db.query(RoleRecord).limit(500).all()
  ```
- **[app\services\database_service.py:785]** P1-MissingSoftDelete: 查询 RolePermissionRecord 缺少软删除过滤
  ```
  role_perms = db.query(RolePermissionRecord).filter(
  ```
- **[app\services\database_service.py:789]** P1-MissingSoftDelete: 查询 PermissionRecord 缺少软删除过滤
  ```
  return db.query(PermissionRecord).filter(
  ```
- **[app\services\database_service.py:813]** P1-MissingSoftDelete: 查询 PermissionRecord 缺少软删除过滤
  ```
  return db.query(PermissionRecord).limit(500).all()
  ```
- **[app\services\database_service.py:817]** P1-MissingSoftDelete: 查询 PermissionRecord 缺少软删除过滤
  ```
  return db.query(PermissionRecord).filter(
  ```
- **[app\services\database_service.py:841]** P1-MissingSoftDelete: 查询 FileAccessRecord 缺少软删除过滤
  ```
  record = db.query(FileAccessRecord).filter(
  ```
- **[app\services\database_service.py:854]** P1-MissingSoftDelete: 查询 FileAccessRecord 缺少软删除过滤
  ```
  return db.query(FileAccessRecord).filter(
  ```
- **[app\services\database_service.py:860]** P1-MissingSoftDelete: 查询 FileAccessRecord 缺少软删除过滤
  ```
  records = db.query(FileAccessRecord).filter(
  ```
- **[app\services\database_service.py:873]** P1-MissingSoftDelete: 查询 RoleRecord 缺少软删除过滤
  ```
  existing = db.query(RoleRecord).first()
  ```
- **[app\services\dingtalk_auth_service.py:124]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == tp.user_uuid).first()
  ```
- **[app\services\edu_ask.py:224]** P1-MissingSoftDelete: 查询 EduAskAnswer 缺少软删除过滤
  ```
  db.query(EduAskAnswer).filter(
  ```
- **[app\services\enterprise_wechat_service.py:180]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == third.user_uuid).first()
  ```
- **[app\services\exam_business.py:64]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  q = db.query(ExamPaper)
  ```
- **[app\services\exam_business.py:80]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  obj = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
  ```
- **[app\services\exam_business.py:128]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  obj = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
  ```
- **[app\services\exam_business.py:160]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  obj = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
  ```
- **[app\services\exam_business.py:167]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  obj = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
  ```
- **[app\services\exam_business.py:174]** P1-MissingSoftDelete: 查询 ExamPaper 缺少软删除过滤
  ```
  obj = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
  ```
- **[app\services\exam_business.py:213]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  q = db.query(ExamQuestion)
  ```
- **[app\services\exam_business.py:231]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  obj = db.query(ExamQuestion).filter(ExamQuestion.id == question_id).first()
  ```
- **[app\services\exam_business.py:275]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  obj = db.query(ExamQuestion).filter(ExamQuestion.id == question_id).first()
  ```
- **[app\services\exam_business.py:305]** P1-MissingSoftDelete: 查询 ExamQuestion 缺少软删除过滤
  ```
  obj = db.query(ExamQuestion).filter(ExamQuestion.id == question_id).first()
  ```
- **[app\services\exam_business.py:316]** P1-MissingSoftDelete: 查询 ExamChapter 缺少软删除过滤
  ```
  q = db.query(ExamChapter)
  ```
- **[app\services\exam_business.py:343]** P1-MissingSoftDelete: 查询 ExamChapter 缺少软删除过滤
  ```
  obj = db.query(ExamChapter).filter(ExamChapter.id == chapter_id).first()
  ```
- **[app\services\exam_business.py:354]** P1-MissingSoftDelete: 查询 ExamChapterSection 缺少软删除过滤
  ```
  q = db.query(ExamChapterSection)
  ```
- **[app\services\exam_business.py:394]** P1-MissingSoftDelete: 查询 ExamWrongQuestion 缺少软删除过滤
  ```
  q = db.query(ExamWrongQuestion)
  ```
- **[app\services\exam_business.py:411]** P1-MissingSoftDelete: 查询 ExamWrongQuestion 缺少软删除过滤
  ```
  db.query(ExamWrongQuestion)
  ```
- **[app\services\exam_business.py:440]** P1-MissingSoftDelete: 查询 ExamRecord 缺少软删除过滤
  ```
  q = db.query(ExamRecord)
  ```
- **[app\services\exam_business.py:474]** P1-MissingSoftDelete: 查询 ExamRecord 缺少软删除过滤
  ```
  obj = db.query(ExamRecord).filter(ExamRecord.id == record_id).first()
  ```
- **[app\services\exam_business.py:486]** P1-MissingSoftDelete: 查询 ExamRecord 缺少软删除过滤
  ```
  obj = db.query(ExamRecord).filter(ExamRecord.id == record_id).first()
  ```
- **[app\services\exam_business.py:494]** P1-MissingSoftDelete: 查询 ExamRecord 缺少软删除过滤
  ```
  obj = db.query(ExamRecord).filter(ExamRecord.id == record_id).first()
  ```
- **[app\services\exam_ext_service.py:58]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  return db.query(Exam).filter(Exam.id == exam_id).first()
  ```
- **[app\services\exam_ext_service.py:67]** P1-MissingSoftDelete: 查询 Exam 缺少软删除过滤
  ```
  q = db.query(Exam)
  ```
- **[app\services\exam_ext_service.py:88]** P1-MissingSoftDelete: 查询 ExamSignUp 缺少软删除过滤
  ```
  db.query(ExamSignUp)
  ```
- **[app\services\exam_ext_service.py:104]** P1-MissingSoftDelete: 查询 ExamSignUp 缺少软删除过滤
  ```
  s = db.query(ExamSignUp).filter(ExamSignUp.id == signup_id).first()
  ```
- **[app\services\exam_ext_service.py:182]** P1-MissingSoftDelete: 查询 PaperQuestionRule 缺少软删除过滤
  ```
  existing = db.query(PaperQuestionRule).filter(PaperQuestionRule.paper_id == paper_id).first()
  ```
- **[app\services\exam_ext_service.py:232]** P1-MissingSoftDelete: 查询 Question 缺少软删除过滤
  ```
  db.query(Question)
  ```
- **[app\services\feishu_auth_service.py:109]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == third.user_uuid).first()
  ```
- **[app\services\heat_stats_service.py:20]** P1-MissingSoftDelete: 查询 AgentHeatStats 缺少软删除过滤
  ```
  existing = db.query(AgentHeatStats).filter(AgentHeatStats.date_str == date_str).count()
  ```
- **[app\services\heat_stats_service.py:50]** P1-MissingSoftDelete: 查询 AgentHeatStats 缺少软删除过滤
  ```
  db.query(AgentHeatStats)
  ```
- **[app\services\id_mapping_service.py:18]** P1-MissingSoftDelete: 查询 IdMapping 缺少软删除过滤
  ```
  db.query(IdMapping)
  ```
- **[app\services\id_mapping_service.py:32]** P1-MissingSoftDelete: 查询 IdMapping 缺少软删除过滤
  ```
  db.query(IdMapping)
  ```
- **[app\services\id_mapping_service.py:52]** P1-MissingSoftDelete: 查询 IdMapping 缺少软删除过滤
  ```
  db.query(IdMapping)
  ```
- **[app\services\invoice_title_business.py:73]** P1-MissingSoftDelete: 查询 InvoiceTitle 缺少软删除过滤
  ```
  obj = db.query(InvoiceTitle).filter(InvoiceTitle.id == title_id).first()
  ```
- **[app\services\invoice_title_business.py:92]** P1-MissingSoftDelete: 查询 InvoiceTitle 缺少软删除过滤
  ```
  obj = db.query(InvoiceTitle).filter(InvoiceTitle.id == title_id).first()
  ```
- **[app\services\invoice_title_business.py:102]** P1-MissingSoftDelete: 查询 InvoiceTitle 缺少软删除过滤
  ```
  obj = db.query(InvoiceTitle).filter(InvoiceTitle.id == title_id).first()
  ```
- **[app\services\invoice_title_business.py:114]** P1-MissingSoftDelete: 查询 InvoiceTitle 缺少软删除过滤
  ```
  q = db.query(InvoiceTitle)
  ```
- **[app\services\knowledge_service.py:168]** P1-MissingSoftDelete: 查询 KnowledgeChunk 缺少软删除过滤
  ```
  q = db.query(KnowledgeChunk).filter(
  ```
- **[app\services\knowledge_service.py:227]** P1-MissingSoftDelete: 查询 KnowledgeDoc 缺少软删除过滤
  ```
  db.query(KnowledgeDoc)
  ```
- **[app\services\knowledge_service.py:250]** P1-MissingSoftDelete: 查询 KnowledgeDoc 缺少软删除过滤
  ```
  db.query(KnowledgeDoc)
  ```
- **[app\services\knowledge_service.py:260]** P1-MissingSoftDelete: 查询 KnowledgeChunk 缺少软删除过滤
  ```
  db.query(KnowledgeChunk).filter(KnowledgeChunk.doc_id == doc_id).delete()
  ```
- **[app\services\knowledge_service.py:279]** P1-MissingSoftDelete: 查询 KnowledgeDoc 缺少软删除过滤
  ```
  db.query(KnowledgeDoc)
  ```
- **[app\services\knowledge_service.py:305]** P1-MissingSoftDelete: 查询 KnowledgeDoc 缺少软删除过滤
  ```
  db.query(KnowledgeDoc)
  ```
- **[app\services\knowledge_service.py:316]** P1-MissingSoftDelete: 查询 KnowledgeChunk 缺少软删除过滤
  ```
  db.query(KnowledgeChunk)
  ```
- **[app\services\learn_business.py:82]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  q = db.query(Lesson)
  ```
- **[app\services\learn_business.py:100]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  obj = db.query(Lesson).filter(Lesson.id == lesson_id).first()
  ```
- **[app\services\learn_business.py:157]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  obj = db.query(Lesson).filter(Lesson.id == lesson_id).first()
  ```
- **[app\services\learn_business.py:189]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  obj = db.query(Lesson).filter(Lesson.id == lesson_id).first()
  ```
- **[app\services\learn_business.py:196]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  obj = db.query(Lesson).filter(Lesson.id == lesson_id).first()
  ```
- **[app\services\learn_business.py:203]** P1-MissingSoftDelete: 查询 Lesson 缺少软删除过滤
  ```
  obj = db.query(Lesson).filter(Lesson.id == lesson_id).first()
  ```
- **[app\services\learn_business.py:214]** P1-MissingSoftDelete: 查询 LessonChapter 缺少软删除过滤
  ```
  q = db.query(LessonChapter).filter(LessonChapter.lesson_id == lesson_id).order_by(LessonChapter.sort_order.asc())
  ```
- **[app\services\learn_business.py:241]** P1-MissingSoftDelete: 查询 LessonChapter 缺少软删除过滤
  ```
  obj = db.query(LessonChapter).filter(LessonChapter.id == chapter_id).first()
  ```
- **[app\services\learn_business.py:257]** P1-MissingSoftDelete: 查询 LessonChapter 缺少软删除过滤
  ```
  obj = db.query(LessonChapter).filter(LessonChapter.id == chapter_id).first()
  ```
- **[app\services\learn_business.py:264]** P1-MissingSoftDelete: 查询 LessonChapter 缺少软删除过滤
  ```
  obj = db.query(LessonChapter).filter(LessonChapter.id == chapter_id).first()
  ```
- **[app\services\learn_business.py:308]** P1-MissingSoftDelete: 查询 LessonChapterSection 缺少软删除过滤
  ```
  obj = db.query(LessonChapterSection).filter(LessonChapterSection.id == section_id).first()
  ```
- **[app\services\learn_business.py:334]** P1-MissingSoftDelete: 查询 LessonChapterSection 缺少软删除过滤
  ```
  obj = db.query(LessonChapterSection).filter(LessonChapterSection.id == section_id).first()
  ```
- **[app\services\learn_business.py:350]** P1-MissingSoftDelete: 查询 Rate 缺少软删除过滤
  ```
  q = db.query(Rate)
  ```
- **[app\services\learn_business.py:362]** P1-MissingSoftDelete: 查询 Rate 缺少软删除过滤
  ```
  obj = db.query(Rate).filter(Rate.id == rate_id).first()
  ```
- **[app\services\learn_business.py:396]** P1-MissingSoftDelete: 查询 Rate 缺少软删除过滤
  ```
  obj = db.query(Rate).filter(Rate.id == rate_id).first()
  ```
- **[app\services\learn_business.py:449]** P1-MissingSoftDelete: 查询 Record 缺少软删除过滤
  ```
  obj = db.query(Record).filter(Record.id == record_id).first()
  ```
- **[app\services\learn_business.py:472]** P1-MissingSoftDelete: 查询 Record 缺少软删除过滤
  ```
  db.query(Record)
  ```
- **[app\services\learn_business.py:505]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  obj = db.query(SignUp).filter(SignUp.id == signup_id).first()
  ```
- **[app\services\learn_business.py:511]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  q = db.query(SignUp).filter(SignUp.id == signup_id)
  ```
- **[app\services\learn_business.py:556]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  q = db.query(SignUp)
  ```
- **[app\services\learn_business.py:571]** P1-MissingSoftDelete: 查询 SignUp 缺少软删除过滤
  ```
  db.query(SignUp)
  ```
- **[app\services\learn_business.py:592]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  q = db.query(LearnMap)
  ```
- **[app\services\learn_business.py:606]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  obj = db.query(LearnMap).filter(LearnMap.id == map_id).first()
  ```
- **[app\services\learn_business.py:637]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  obj = db.query(LearnMap).filter(LearnMap.id == map_id).first()
  ```
- **[app\services\learn_business.py:653]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  obj = db.query(LearnMap).filter(LearnMap.id == map_id).first()
  ```
- **[app\services\learn_business.py:660]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  obj = db.query(LearnMap).filter(LearnMap.id == map_id).first()
  ```
- **[app\services\learn_business.py:667]** P1-MissingSoftDelete: 查询 LearnMap 缺少软删除过滤
  ```
  obj = db.query(LearnMap).filter(LearnMap.id == map_id).first()
  ```
- **[app\services\learn_business.py:684]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  q = db.query(Topic)
  ```
- **[app\services\learn_business.py:698]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  obj = db.query(Topic).filter(Topic.id == topic_id).first()
  ```
- **[app\services\learn_business.py:734]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  obj = db.query(Topic).filter(Topic.id == topic_id).first()
  ```
- **[app\services\learn_business.py:754]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  obj = db.query(Topic).filter(Topic.id == topic_id).first()
  ```
- **[app\services\learn_business.py:761]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  obj = db.query(Topic).filter(Topic.id == topic_id).first()
  ```
- **[app\services\learn_business.py:768]** P1-MissingSoftDelete: 查询 Topic 缺少软删除过滤
  ```
  obj = db.query(Topic).filter(Topic.id == topic_id).first()
  ```
- **[app\services\learn_business.py:812]** P1-MissingSoftDelete: 查询 LessonAccess 缺少软删除过滤
  ```
  objs = db.query(LessonAccess).filter(LessonAccess.lesson_id == lesson_id).all()
  ```
- **[app\services\learn_business.py:822]** P1-MissingSoftDelete: 查询 LessonTask 缺少软删除过滤
  ```
  q = db.query(LessonTask).filter(LessonTask.lesson_id == lesson_id).order_by(LessonTask.id.asc())
  ```
- **[app\services\learn_business.py:829]** P1-MissingSoftDelete: 查询 LessonTask 缺少软删除过滤
  ```
  tasks = db.query(LessonTask).all()
  ```
- **[app\services\learn_business.py:842]** P1-MissingSoftDelete: 查询 Homework 缺少软删除过滤
  ```
  q = db.query(Homework).filter(Homework.lesson_id == lesson_id)
  ```
- **[app\services\learn_business.py:855]** P1-MissingSoftDelete: 查询 HomeworkRecord 缺少软删除过滤
  ```
  q = db.query(HomeworkRecord)
  ```
- **[app\services\learn_business.py:865]** P1-MissingSoftDelete: 查询 HomeworkRecord 缺少软删除过滤
  ```
  obj = db.query(HomeworkRecord).filter(HomeworkRecord.id == record_id).first()
  ```
- **[app\services\learn_business.py:872]** P1-MissingSoftDelete: 查询 HomeworkRecord 缺少软删除过滤
  ```
  obj = db.query(HomeworkRecord).filter(HomeworkRecord.id == record_id).first()
  ```
- **[app\services\live_business.py:52]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  q = db.query(LiveChannel)
  ```
- **[app\services\live_business.py:68]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  return _to_dict_list(db.query(LiveChannel).order_by(LiveChannel.id.desc()).limit(200).all())
  ```
- **[app\services\live_business.py:73]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  obj = db.query(LiveChannel).filter(LiveChannel.id == channel_id).first()
  ```
- **[app\services\live_business.py:79]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  obj = db.query(LiveChannel).filter(LiveChannel.id == channel_id).first()
  ```
- **[app\services\live_business.py:139]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  obj = db.query(LiveChannel).filter(LiveChannel.id == channel_id).first()
  ```
- **[app\services\live_business.py:157]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  obj = db.query(LiveChannel).filter(LiveChannel.id == channel_id).first()
  ```
- **[app\services\live_business.py:169]** P1-MissingSoftDelete: 查询 LiveSubscribe 缺少软删除过滤
  ```
  db.query(LiveSubscribe)
  ```
- **[app\services\live_business.py:186]** P1-MissingSoftDelete: 查询 LiveSubscribe 缺少软删除过滤
  ```
  db.query(LiveSubscribe)
  ```
- **[app\services\live_business.py:199]** P1-MissingSoftDelete: 查询 LiveChannelCategory 缺少软删除过滤
  ```
  return _to_dict_list(db.query(LiveChannelCategory).order_by(LiveChannelCategory.sort_order.asc()).all())
  ```
- **[app\services\live_business.py:219]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  ch = db.query(LiveChannel).filter(LiveChannel.host_id == str(lecturer_id)).first()
  ```
- **[app\services\live_business.py:235]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  items = db.query(LiveChannel).filter(LiveChannel.cover.isnot(None)).order_by(LiveChannel.id.desc()).limit(5).all()
  ```
- **[app\services\live_business.py:248]** P1-MissingSoftDelete: 查询 LiveChannel 缺少软删除过滤
  ```
  obj = db.query(LiveChannel).filter(LiveChannel.id == channel_id).first()
  ```
- **[app\services\member_business.py:95]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  q = db.query(EduMember)
  ```
- **[app\services\member_business.py:119]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:126]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.mobile == mobile).first()
  ```
- **[app\services\member_business.py:135]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  items = db.query(EduMember).filter(EduMember.id.in_(ids)).all()
  ```
- **[app\services\member_business.py:165]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  existing = db.query(EduMember).filter(EduMember.mobile == mobile).first()
  ```
- **[app\services\member_business.py:189]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:203]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:217]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:243]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:269]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:283]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:297]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:340]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(
  ```
- **[app\services\member_business.py:354]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  q = db.query(EduMember)
  ```
- **[app\services\member_business.py:369]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  q = db.query(EduMember).filter(EduMember.status == 1)
  ```
- **[app\services\member_business.py:380]** P1-MissingSoftDelete: 查询 EduMemberLevelRelation 缺少软删除过滤
  ```
  db.query(EduMemberLevelRelation).filter(EduMemberLevelRelation.member_id == member_id).delete()
  ```
- **[app\services\member_business.py:389]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:399]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:409]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:424]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:434]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:446]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:456]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  m = db.query(EduMember).filter(EduMember.id == member_id).first()
  ```
- **[app\services\member_business.py:470]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  existing = db.query(EduMember).filter(EduMember.wechat_open_id == open_id).first()
  ```
- **[app\services\member_business.py:515]** P1-MissingSoftDelete: 查询 EduMemberCompany 缺少软删除过滤
  ```
  q = db.query(EduMemberCompany)
  ```
- **[app\services\member_business.py:530]** P1-MissingSoftDelete: 查询 EduMemberCompany 缺少软删除过滤
  ```
  c = db.query(EduMemberCompany).filter(EduMemberCompany.id == company_id).first()
  ```
- **[app\services\member_business.py:563]** P1-MissingSoftDelete: 查询 EduMemberCompany 缺少软删除过滤
  ```
  c = db.query(EduMemberCompany).filter(EduMemberCompany.id == company_id).first()
  ```
- **[app\services\member_business.py:578]** P1-MissingSoftDelete: 查询 EduMemberCompany 缺少软删除过滤
  ```
  c = db.query(EduMemberCompany).filter(EduMemberCompany.id == company_id).first()
  ```
- **[app\services\member_business.py:582]** P1-MissingSoftDelete: 查询 EduMemberCompanyMemberRelation 缺少软删除过滤
  ```
  db.query(EduMemberCompanyMemberRelation).filter(EduMemberCompanyMemberRelation.member_company_id == company_id).delete()
  ```
- **[app\services\member_business.py:608]** P1-MissingSoftDelete: 查询 EduMemberCompanyType 缺少软删除过滤
  ```
  q = db.query(EduMemberCompanyType)
  ```
- **[app\services\member_business.py:620]** P1-MissingSoftDelete: 查询 EduMemberCompanyType 缺少软删除过滤
  ```
  t = db.query(EduMemberCompanyType).filter(EduMemberCompanyType.id == type_id).first()
  ```
- **[app\services\member_business.py:645]** P1-MissingSoftDelete: 查询 EduMemberCompanyType 缺少软删除过滤
  ```
  t = db.query(EduMemberCompanyType).filter(EduMemberCompanyType.id == type_id).first()
  ```
- **[app\services\member_business.py:659]** P1-MissingSoftDelete: 查询 EduMemberCompanyType 缺少软删除过滤
  ```
  t = db.query(EduMemberCompanyType).filter(EduMemberCompanyType.id == type_id).first()
  ```
- **[app\services\member_business.py:662]** P1-MissingSoftDelete: 查询 EduMemberCompany 缺少软删除过滤
  ```
  db.query(EduMemberCompany).filter(EduMemberCompany.company_type_id == type_id).update({"company_type_id": None})
  ```
- **[app\services\member_business.py:670]** P1-MissingSoftDelete: 查询 EduMemberCompanyType 缺少软删除过滤
  ```
  items = db.query(EduMemberCompanyType).filter(EduMemberCompanyType.status == 1).order_by(EduMemberCompanyType.sort_order
  ```
- **[app\services\member_business.py:684]** P1-MissingSoftDelete: 查询 EduMemberLevel 缺少软删除过滤
  ```
  q = db.query(EduMemberLevel)
  ```
- **[app\services\member_business.py:694]** P1-MissingSoftDelete: 查询 EduMemberLevel 缺少软删除过滤
  ```
  lv = db.query(EduMemberLevel).filter(EduMemberLevel.id == level_id).first()
  ```
- **[app\services\member_business.py:709]** P1-MissingSoftDelete: 查询 EduMemberLevel 缺少软删除过滤
  ```
  lv = db.query(EduMemberLevel).filter(EduMemberLevel.id == level_id).first()
  ```
- **[app\services\member_business.py:722]** P1-MissingSoftDelete: 查询 EduMemberLevel 缺少软删除过滤
  ```
  lv = db.query(EduMemberLevel).filter(EduMemberLevel.id == level_id).first()
  ```
- **[app\services\member_business.py:725]** P1-MissingSoftDelete: 查询 EduMemberLevelRelation 缺少软删除过滤
  ```
  db.query(EduMemberLevelRelation).filter(EduMemberLevelRelation.level_id == level_id).delete()
  ```
- **[app\services\member_business.py:736]** P1-MissingSoftDelete: 查询 EduMemberPost 缺少软删除过滤
  ```
  q = db.query(EduMemberPost)
  ```
- **[app\services\member_business.py:748]** P1-MissingSoftDelete: 查询 EduMemberPost 缺少软删除过滤
  ```
  p = db.query(EduMemberPost).filter(EduMemberPost.id == post_id).first()
  ```
- **[app\services\member_business.py:763]** P1-MissingSoftDelete: 查询 EduMemberPost 缺少软删除过滤
  ```
  p = db.query(EduMemberPost).filter(EduMemberPost.id == post_id).first()
  ```
- **[app\services\member_business.py:776]** P1-MissingSoftDelete: 查询 EduMemberPost 缺少软删除过滤
  ```
  p = db.query(EduMemberPost).filter(EduMemberPost.id == post_id).first()
  ```
- **[app\services\member_business.py:779]** P1-MissingSoftDelete: 查询 EduMemberPostMemberRelation 缺少软删除过滤
  ```
  db.query(EduMemberPostMemberRelation).filter(EduMemberPostMemberRelation.member_post_id == post_id).delete()
  ```
- **[app\services\member_business.py:786]** P1-MissingSoftDelete: 查询 EduMemberPost 缺少软删除过滤
  ```
  items = db.query(EduMemberPost).filter(EduMemberPost.status == 1).order_by(EduMemberPost.sort_order.desc()).all()
  ```
- **[app\services\member_business.py:796]** P1-MissingSoftDelete: 查询 EduMemberGroup 缺少软删除过滤
  ```
  q = db.query(EduMemberGroup)
  ```
- **[app\services\member_business.py:808]** P1-MissingSoftDelete: 查询 EduMemberGroup 缺少软删除过滤
  ```
  g = db.query(EduMemberGroup).filter(EduMemberGroup.id == group_id).first()
  ```
- **[app\services\member_business.py:823]** P1-MissingSoftDelete: 查询 EduMemberGroup 缺少软删除过滤
  ```
  g = db.query(EduMemberGroup).filter(EduMemberGroup.id == group_id).first()
  ```
- **[app\services\member_business.py:836]** P1-MissingSoftDelete: 查询 EduMemberGroup 缺少软删除过滤
  ```
  g = db.query(EduMemberGroup).filter(EduMemberGroup.id == group_id).first()
  ```
- **[app\services\member_business.py:839]** P1-MissingSoftDelete: 查询 EduMemberGroupMemberRelation 缺少软删除过滤
  ```
  db.query(EduMemberGroupMemberRelation).filter(EduMemberGroupMemberRelation.member_group_id == group_id).delete()
  ```
- **[app\services\member_business.py:846]** P1-MissingSoftDelete: 查询 EduMemberGroup 缺少软删除过滤
  ```
  items = db.query(EduMemberGroup).filter(EduMemberGroup.status == 1).order_by(EduMemberGroup.sort_order.desc()).all()
  ```
- **[app\services\member_business.py:856]** P1-MissingSoftDelete: 查询 EduMemberTag 缺少软删除过滤
  ```
  q = db.query(EduMemberTag)
  ```
- **[app\services\member_business.py:866]** P1-MissingSoftDelete: 查询 EduMemberTag 缺少软删除过滤
  ```
  t = db.query(EduMemberTag).filter(EduMemberTag.id == tag_id).first()
  ```
- **[app\services\member_business.py:881]** P1-MissingSoftDelete: 查询 EduMemberTag 缺少软删除过滤
  ```
  t = db.query(EduMemberTag).filter(EduMemberTag.id == tag_id).first()
  ```
- **[app\services\member_business.py:884]** P1-MissingSoftDelete: 查询 EduMemberTagMemberRelation 缺少软删除过滤
  ```
  db.query(EduMemberTagMemberRelation).filter(EduMemberTagMemberRelation.member_tag_id == tag_id).delete()
  ```
- **[app\services\member_business.py:896]** P1-MissingSoftDelete: 查询 EduCheckIn 缺少软删除过滤
  ```
  ci = db.query(EduCheckIn).filter(EduCheckIn.member_id == member_id).first()
  ```
- **[app\services\member_business.py:903]** P1-MissingSoftDelete: 查询 EduCheckIn 缺少软删除过滤
  ```
  ci = db.query(EduCheckIn).filter(EduCheckIn.member_id == member_id).first()
  ```
- **[app\services\member_business.py:923]** P1-MissingSoftDelete: 查询 EduFollow 缺少软删除过滤
  ```
  existing = db.query(EduFollow).filter(
  ```
- **[app\services\member_business.py:939]** P1-MissingSoftDelete: 查询 EduFollow 缺少软删除过滤
  ```
  f = db.query(EduFollow).filter(
  ```
- **[app\services\member_business.py:951]** P1-MissingSoftDelete: 查询 EduFollow 缺少软删除过滤
  ```
  items = db.query(EduFollow).filter(EduFollow.member_id == member_id, EduFollow.status == 1).all()
  ```
- **[app\services\member_business.py:958]** P1-MissingSoftDelete: 查询 EduFollow 缺少软删除过滤
  ```
  items = db.query(EduFollow).filter(
  ```
- **[app\services\member_business.py:981]** P1-MissingSoftDelete: 查询 EduFollow 缺少软删除过滤
  ```
  f = db.query(EduFollow).filter(
  ```
- **[app\services\member_service.py:35]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  return db.query(EduMember).filter(EduMember.id == edu_id).first()
  ```
- **[app\services\member_service.py:40]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  return db.query(EduMember).filter(EduMember.mobile == mobile).first()
  ```
- **[app\services\member_service.py:45]** P1-MissingSoftDelete: 查询 EduMember 缺少软删除过滤
  ```
  return db.query(EduMember).filter(EduMember.wechat_open_id == open_id).first()
  ```
- **[app\services\member_service.py:106]** P1-MissingSoftDelete: 查询 EduMemberCompany 缺少软删除过滤
  ```
  db.query(EduMemberCompany)
  ```
- **[app\services\member_service.py:136]** P1-MissingSoftDelete: 查询 EduMemberTag 缺少软删除过滤
  ```
  db.query(EduMemberTag)
  ```
- **[app\services\member_service.py:156]** P1-MissingSoftDelete: 查询 EduMemberPost 缺少软删除过滤
  ```
  return db.query(EduMemberPost).order_by(EduMemberPost.created_at.desc()).all()
  ```
- **[app\services\member_service.py:161]** P1-MissingSoftDelete: 查询 EduMemberPost 缺少软删除过滤
  ```
  p = db.query(EduMemberPost).filter(EduMemberPost.id == post_id).first()
  ```
- **[app\services\member_service.py:173]** P1-MissingSoftDelete: 查询 EduMemberPost 缺少软删除过滤
  ```
  p = db.query(EduMemberPost).filter(EduMemberPost.id == post_id).first()
  ```
- **[app\services\member_service.py:196]** P1-MissingSoftDelete: 查询 EduMemberGroup 缺少软删除过滤
  ```
  return db.query(EduMemberGroup).order_by(EduMemberGroup.created_at.desc()).all()
  ```
- **[app\services\member_service.py:201]** P1-MissingSoftDelete: 查询 EduMemberGroup 缺少软删除过滤
  ```
  g = db.query(EduMemberGroup).filter(EduMemberGroup.id == group_id).first()
  ```
- **[app\services\member_service.py:213]** P1-MissingSoftDelete: 查询 EduMemberGroup 缺少软删除过滤
  ```
  g = db.query(EduMemberGroup).filter(EduMemberGroup.id == group_id).first()
  ```
- **[app\services\member_service.py:240]** P1-MissingSoftDelete: 查询 EduMemberLevel 缺少软删除过滤
  ```
  return db.query(EduMemberLevel).order_by(EduMemberLevel.created_at.desc()).all()
  ```
- **[app\services\member_service.py:245]** P1-MissingSoftDelete: 查询 EduMemberLevel 缺少软删除过滤
  ```
  lv = db.query(EduMemberLevel).filter(EduMemberLevel.id == level_id).first()
  ```
- **[app\services\member_service.py:257]** P1-MissingSoftDelete: 查询 EduMemberLevel 缺少软删除过滤
  ```
  lv = db.query(EduMemberLevel).filter(EduMemberLevel.id == level_id).first()
  ```
- **[app\services\member_service.py:284]** P1-MissingSoftDelete: 查询 EduMemberCompanyType 缺少软删除过滤
  ```
  return db.query(EduMemberCompanyType).order_by(EduMemberCompanyType.created_at.desc()).all()
  ```
- **[app\services\member_service.py:289]** P1-MissingSoftDelete: 查询 EduMemberCompanyType 缺少软删除过滤
  ```
  t = db.query(EduMemberCompanyType).filter(EduMemberCompanyType.id == type_id).first()
  ```
- **[app\services\member_service.py:301]** P1-MissingSoftDelete: 查询 EduMemberCompanyType 缺少软删除过滤
  ```
  t = db.query(EduMemberCompanyType).filter(EduMemberCompanyType.id == type_id).first()
  ```
- **[app\services\member_service.py:310]** P1-MissingSoftDelete: 查询 EduMemberCompanyType 缺少软删除过滤
  ```
  return db.query(EduMemberCompanyType).filter(EduMemberCompanyType.id == type_id).first()
  ```
- **[app\services\member_service.py:320]** P1-MissingSoftDelete: 查询 EduCheckIn 缺少软删除过滤
  ```
  ci = db.query(EduCheckIn).filter(EduCheckIn.member_id == member_id).first()
  ```
- **[app\services\member_service.py:334]** P1-MissingSoftDelete: 查询 EduCheckInRecord 缺少软删除过滤
  ```
  db.query(EduCheckInRecord)
  ```
- **[app\services\member_service.py:349]** P1-MissingSoftDelete: 查询 EduFollow 缺少软删除过滤
  ```
  db.query(EduFollow)
  ```
- **[app\services\member_service.py:367]** P1-MissingSoftDelete: 查询 EduFollow 缺少软删除过滤
  ```
  db.query(EduFollow)
  ```
- **[app\services\member_service.py:383]** P1-MissingSoftDelete: 查询 EduFollow 缺少软删除过滤
  ```
  db.query(EduFollow)
  ```
- **[app\services\news_business.py:46]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  q = db.query(Article)
  ```
- **[app\services\news_business.py:64]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  obj = db.query(Article).filter(Article.id == news_id).first()
  ```
- **[app\services\news_business.py:97]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  obj = db.query(Article).filter(Article.id == news_id).first()
  ```
- **[app\services\news_business.py:117]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  obj = db.query(Article).filter(Article.id == news_id).first()
  ```
- **[app\services\news_business.py:124]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  obj = db.query(Article).filter(Article.id == news_id).first()
  ```
- **[app\services\news_business.py:131]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  obj = db.query(Article).filter(Article.id == news_id).first()
  ```
- **[app\services\news_business.py:138]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  obj = db.query(Article).filter(Article.id == news_id).first()
  ```
- **[app\services\news_business.py:145]** P1-MissingSoftDelete: 查询 Article 缺少软删除过滤
  ```
  obj = db.query(Article).filter(Article.id == news_id).first()
  ```
- **[app\services\order_ext_service.py:60]** P1-MissingSoftDelete: 查询 OrderItem 缺少软删除过滤
  ```
  db.query(OrderItem)
  ```
- **[app\services\order_ext_service.py:93]** P1-MissingSoftDelete: 查询 OrderPayment 缺少软删除过滤
  ```
  p = db.query(OrderPayment).filter(OrderPayment.id == payment_id).first()
  ```
- **[app\services\order_ext_service.py:145]** P1-MissingSoftDelete: 查询 InvoiceApplication 缺少软删除过滤
  ```
  q = db.query(InvoiceApplication)
  ```
- **[app\services\order_ext_service.py:188]** P1-MissingSoftDelete: 查询 InvoiceTitle 缺少软删除过滤
  ```
  db.query(InvoiceTitle)
  ```
- **[app\services\order_ext_service.py:199]** P1-MissingSoftDelete: 查询 InvoiceTitle 缺少软删除过滤
  ```
  db.query(InvoiceTitle).filter(
  ```
- **[app\services\order_ext_service.py:204]** P1-MissingSoftDelete: 查询 InvoiceTitle 缺少软删除过滤
  ```
  db.query(InvoiceTitle)
  ```
- **[app\services\order_service.py:89]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  order = db.query(Order).filter(Order.out_trade_no == out_trade_no).first()
  ```
- **[app\services\order_service.py:113]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  order = db.query(Order).filter(Order.out_trade_no == out_trade_no).first()
  ```
- **[app\services\order_service.py:131]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  q = db.query(Order).filter(Order.user_id == user_id).order_by(Order.id.desc())
  ```
- **[app\services\order_service.py:167]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  orders = db.query(Order).filter(Order.status == 1, Order.created_at.between(start, end)).all()
  ```
- **[app\services\payment_service.py:67]** P1-MissingSoftDelete: 查询 Payment 缺少软删除过滤
  ```
  return db.query(Payment).filter(Payment.order_no == order_no).first()
  ```
- **[app\services\payment_service.py:78]** P1-MissingSoftDelete: 查询 Payment 缺少软删除过滤
  ```
  p = db.query(Payment).filter(Payment.id == payment_id).first()
  ```
- **[app\services\payment_service.py:97]** P1-MissingSoftDelete: 查询 Payment 缺少软删除过滤
  ```
  q = db.query(Payment).filter(Payment.user_id == user_id)
  ```
- **[app\services\payment_service.py:111]** P1-MissingSoftDelete: 查询 PaymentConfig 缺少软删除过滤
  ```
  db.query(PaymentConfig)
  ```
- **[app\services\payment_service.py:132]** P1-MissingSoftDelete: 查询 PaymentConfig 缺少软删除过滤
  ```
  db.query(PaymentConfig)
  ```
- **[app\services\reconciliation_service.py:110]** P1-MissingSoftDelete: 查询 Order 缺少软删除过滤
  ```
  db.query(Order)
  ```
- **[app\services\resource_business.py:87]** P1-MissingSoftDelete: 查询 Resource 缺少软删除过滤
  ```
  q = db.query(Resource)
  ```
- **[app\services\resource_business.py:132]** P1-MissingSoftDelete: 查询 Resource 缺少软删除过滤
  ```
  r = db.query(Resource).filter(Resource.id == resource_id).first()
  ```
- **[app\services\resource_business.py:182]** P1-MissingSoftDelete: 查询 Resource 缺少软删除过滤
  ```
  r = db.query(Resource).filter(Resource.id == resource_id).first()
  ```
- **[app\services\resource_business.py:201]** P1-MissingSoftDelete: 查询 Resource 缺少软删除过滤
  ```
  r = db.query(Resource).filter(Resource.id == resource_id).first()
  ```
- **[app\services\resource_business.py:205]** P1-MissingSoftDelete: 查询 ResourceDownload 缺少软删除过滤
  ```
  db.query(ResourceDownload).filter(ResourceDownload.resource_id == resource_id).delete()
  ```
- **[app\services\resource_business.py:213]** P1-MissingSoftDelete: 查询 Resource 缺少软删除过滤
  ```
  r = db.query(Resource).filter(Resource.id == resource_id).first()
  ```
- **[app\services\resource_business.py:225]** P1-MissingSoftDelete: 查询 Resource 缺少软删除过滤
  ```
  items = db.query(Resource).filter(Resource.id.in_(ids)).all()
  ```
- **[app\services\resource_business.py:238]** P1-MissingSoftDelete: 查询 Resource 缺少软删除过滤
  ```
  r = db.query(Resource).filter(Resource.id == resource_id).first()
  ```
- **[app\services\resource_business.py:262]** P1-MissingSoftDelete: 查询 Resource 缺少软删除过滤
  ```
  items = db.query(Resource).filter(Resource.id.in_(ids)).all()
  ```
- **[app\services\resource_business.py:277]** P1-MissingSoftDelete: 查询 ResourceSearchRecord 缺少软删除过滤
  ```
  db.query(ResourceSearchRecord)
  ```
- **[app\services\resource_business.py:307]** P1-MissingSoftDelete: 查询 ResourceTag 缺少软删除过滤
  ```
  q = db.query(ResourceTag)
  ```
- **[app\services\resource_business.py:331]** P1-MissingSoftDelete: 查询 ResourceTag 缺少软删除过滤
  ```
  t = db.query(ResourceTag).filter(ResourceTag.id == tag_id).first()
  ```
- **[app\services\resource_business.py:348]** P1-MissingSoftDelete: 查询 ResourceTag 缺少软删除过滤
  ```
  t = db.query(ResourceTag).filter(ResourceTag.id == tag_id).first()
  ```
- **[app\services\resource_business.py:362]** P1-MissingSoftDelete: 查询 ResourceTag 缺少软删除过滤
  ```
  t = db.query(ResourceTag).filter(ResourceTag.id == tag_id).first()
  ```
- **[app\services\resource_business.py:372]** P1-MissingSoftDelete: 查询 ResourceTag 缺少软删除过滤
  ```
  t = db.query(ResourceTag).filter(ResourceTag.id == tag_id).first()
  ```
- **[app\services\resource_business.py:391]** P1-MissingSoftDelete: 查询 ResourceProduct 缺少软删除过滤
  ```
  q = db.query(ResourceProduct)
  ```
- **[app\services\resource_business.py:414]** P1-MissingSoftDelete: 查询 ResourceProduct 缺少软删除过滤
  ```
  p = db.query(ResourceProduct).filter(ResourceProduct.id == product_id).first()
  ```
- **[app\services\resource_business.py:437]** P1-MissingSoftDelete: 查询 ResourceProduct 缺少软删除过滤
  ```
  p = db.query(ResourceProduct).filter(ResourceProduct.id == product_id).first()
  ```
- **[app\services\resource_business.py:450]** P1-MissingSoftDelete: 查询 ResourceProduct 缺少软删除过滤
  ```
  p = db.query(ResourceProduct).filter(ResourceProduct.id == product_id).first()
  ```
- **[app\services\resource_business.py:459]** P1-MissingSoftDelete: 查询 ResourceProduct 缺少软删除过滤
  ```
  p = db.query(ResourceProduct).filter(ResourceProduct.id == product_id).first()
  ```
- **[app\services\resource_business.py:480]** P1-MissingSoftDelete: 查询 ResourceCategory 缺少软删除过滤
  ```
  q = db.query(ResourceCategory)
  ```
- **[app\services\resource_business.py:500]** P1-MissingSoftDelete: 查询 ResourceCategory 缺少软删除过滤
  ```
  c = db.query(ResourceCategory).filter(ResourceCategory.id == category_id).first()
  ```
- **[app\services\resource_business.py:534]** P1-MissingSoftDelete: 查询 ResourceCategory 缺少软删除过滤
  ```
  c = db.query(ResourceCategory).filter(ResourceCategory.id == category_id).first()
  ```
- **[app\services\resource_business.py:547]** P1-MissingSoftDelete: 查询 ResourceCategory 缺少软删除过滤
  ```
  c = db.query(ResourceCategory).filter(ResourceCategory.id == category_id).first()
  ```
- **[app\services\resource_business.py:551]** P1-MissingSoftDelete: 查询 ResourceCategory 缺少软删除过滤
  ```
  db.query(ResourceCategory).filter(ResourceCategory.parent_id == category_id).update({"parent_id": None})
  ```
- **[app\services\resource_business.py:562]** P1-MissingSoftDelete: 查询 ResourceCategory 缺少软删除过滤
  ```
  c = db.query(ResourceCategory).filter(ResourceCategory.id == category_id).first()
  ```
- **[app\services\resource_business.py:575]** P1-MissingSoftDelete: 查询 ResourceCategory 缺少软删除过滤
  ```
  c = db.query(ResourceCategory).filter(ResourceCategory.id == category_id).first()
  ```
- **[app\services\token_cache_service.py:68]** P1-MissingSoftDelete: 查询 UserMargin 缺少软删除过滤
  ```
  margin = db.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
  ```
- **[app\services\token_service.py:36]** P1-MissingSoftDelete: 查询 UserMargin 缺少软删除过滤
  ```
  margin = db.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
  ```
- **[app\services\token_service.py:50]** P1-MissingSoftDelete: 查询 UserMargin 缺少软删除过滤
  ```
  margin = db.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
  ```
- **[app\services\token_service.py:102]** P1-MissingSoftDelete: 查询 OperateTokenFlow 缺少软删除过滤
  ```
  q = db.query(OperateTokenFlow).filter(
  ```
- **[app\services\token_utils_service.py:27]** P1-MissingSoftDelete: 查询 Activity 缺少软删除过滤
  ```
  db.query(Activity)
  ```
- **[app\services\token_utils_service.py:119]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\services\token_utils_service.py:137]** P1-MissingSoftDelete: 查询 UserMargin 缺少软删除过滤
  ```
  margin = db.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
  ```
- **[app\services\token_utils_service.py:176]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\services\user_service.py:14]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\services\user_service.py:17]** P1-MissingSoftDelete: 查询 UserMargin 缺少软删除过滤
  ```
  margin = db.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
  ```
- **[app\services\user_service.py:18]** P1-MissingSoftDelete: 查询 UserAuthInfo 缺少软删除过滤
  ```
  auth = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).first()
  ```
- **[app\services\user_service.py:35]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\services\user_service.py:48]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  user = db.query(User).filter(User.uuid == user_uuid).first()
  ```
- **[app\services\user_service.py:58]** P1-MissingSoftDelete: 查询 User 缺少软删除过滤
  ```
  q = db.query(User)
  ```

## P2-MissingTimeout (1 个)

- **[app\services\alert_service.py:90]** P2-MissingTimeout: httpx.AsyncClient ( 外部 HTTP 请求未设置 timeout
  ```
  client_factory: callable 返回 httpx.AsyncClient (用于传 transport)
  ```

## P2-SwallowedException (0 个)


## P2-SensitiveLog (263 个)

- **[app\alertmanager_emulator.py:127]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(f"[alertmanager-emu] {format % args}")
  ```
- **[app\main.py:270]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Failed to register gzip middleware: {e}")
  ```
- **[app\main.py:689]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(f"TenantRoutingMiddleware skipped: {e}")
  ```
- **[app\shadow_traffic.py:356]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(
  ```
- **[app\tenant_demo.py:124]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("  - tenant_{tid} schema: 租户私有表 (users, products, orders)")
  ```
- **[app\api\admin_migration.py:220]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("回滚失败: %s", e)
  ```
- **[app\api\langchain_api_mini.py:619]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("LLM-Mini WS 错误: %s", e)
  ```
- **[app\api\outbound.py:65]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(
  ```
- **[app\api\outbound.py:100]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("[Outbound] 处理外呼回调异常: %s", e)
  ```
- **[app\api\v1\canary_routes.py:160]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Canary promote cooldown: %s", e)
  ```
- **[app\api\v1\canary_routes.py:163]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Canary promote stage error: %s", e)
  ```
- **[app\api\v1\canary_routes.py:181]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Canary rollback stage error: %s", e)
  ```
- **[app\api\v1\video.py:165]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"ffmpeg 转码回退失败: {proc.stderr.decode('utf-8', 'ignore')[:500]}")
  ```
- **[app\api\v1\video.py:556]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("Redis 写入 HLS 缓存失败")
  ```
- **[app\api\v1\video.py:590]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("Redis 读取 HLS manifest 失败")
  ```
- **[app\api\v1\video.py:616]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("读取本地 m3u8 文件失败")
  ```
- **[app\api\v1\agents\creation.py:263]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Operate creation error: {e}")
  ```
- **[app\api\v1\agents\creation.py:299]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Get creation by share code error: {e}")
  ```
- **[app\api\v1\agents\creation.py:359]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Share to code error: {e}")
  ```
- **[app\api\v1\agents\identity.py:130]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Create identity order error: {e}")
  ```
- **[app\api\v1\agents\personality.py:28]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Personality n8n error: " + str(resp.status_code))
  ```
- **[app\api\v1\ai\bailian\route.py:157]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Bailian API HTTP error: %s %s", e.response.status_code, e.response.text[:500])
  ```
- **[app\api\v1\ai\dashscope\route.py:658]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("[Audio ASR] Checking token balance for user=%s", eff_user_uuid)
  ```
- **[app\api\v1\ai\dashscope\route.py:710]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("[Audio ASR] Recognition succeeded, transcription length=%d", len(transcription))
  ```
- **[app\api\v1\ai\dashscope\route.py:726]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("[Audio ASR] Token deducted: %d, new_balance=%s", deducted_tokens, token_result.get("balance"))
  ```
- **[app\api\v1\ai\dashscope\route.py:728]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("[Audio ASR] Token deduction failed: %s", token_result.get("reason"))
  ```
- **[app\api\v1\ai\doubao\route.py:310]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Video generation completed: %s", video_url[:100])
  ```
- **[app\api\v1\ai\doubao\route.py:357]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Doubao video HTTP error: %s - %s", e.response.status_code, e.response.text)
  ```
- **[app\api\v1\ai\doubao\route.py:362]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Doubao video error: %s", e)
  ```
- **[app\api\v1\ai\doubao\route.py:408]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("Could not parse size string '%s', using default 1024x1024", size_str)
  ```
- **[app\api\v1\ai\doubao\route.py:444]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Image submit failed, no task_id. Response: %s", resp_data)
  ```
- **[app\api\v1\ai\doubao\route.py:477]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Base64 decode failed: %s", e)
  ```
- **[app\api\v1\ai\doubao\route.py:533]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Volcengine API HTTP error: %s - %s", e.response.status_code, e.response.text)
  ```
- **[app\api\v1\ai\doubao\route.py:538]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Image generation error: %s", e)
  ```
- **[app\api\v1\ai\doubao\route.py:624]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Base64 decode failed: %s", e)
  ```
- **[app\api\v1\ai\doubao\route.py:673]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Seedream HTTP error: %s - %s", e.response.status_code, e.response.text)
  ```
- **[app\api\v1\ai\doubao\route.py:678]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Seedream error: %s", e)
  ```
- **[app\api\v1\ai\gemini\route.py:128]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Gemini API HTTP error: %s %s", e.response.status_code, e.response.text[:500])
  ```
- **[app\api\v1\ai\gemini\route.py:179]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Gemini proxy HTTP error: %s %s", e.response.status_code, e.response.text[:500])
  ```
- **[app\api\v1\ai\gemini\route.py:211]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("Failed to decode base64 image: %s", e)
  ```
- **[app\api\v1\ai\n8n\route.py:272]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("N8N API HTTP error: %s %s", e.response.status_code, e.response.text[:500])
  ```
- **[app\api\v1\ai\sora2\route.py:99]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Sora2 create HTTP error: %s %s", e.response.status_code, e.response.text[:500])
  ```
- **[app\api\v1\ai\sora2\route.py:107]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Sora2 create failed: status=%s, data=%s", resp.status_code, create_data)
  ```
- **[app\api\v1\ai\sora2\route.py:280]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Sora2 query HTTP error: %s %s", e.response.status_code, e.response.text[:500])
  ```
- **[app\api\v1\ai\suno\route.py:141]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Suno API HTTP error: %s %s", e.response.status_code, e.response.text[:500])
  ```
- **[app\api\v1\ai\suno\route.py:177]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Suno query HTTP error: %s %s", e.response.status_code, e.response.text[:500])
  ```
- **[app\api\v1\ai\tencent\route.py:314]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(
  ```
- **[app\api\v1\ai\volcengine\route.py:272]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("JiMeng4 image HTTP error: %s - %s", e.response.status_code, e.response.text)
  ```
- **[app\api\v1\ai\volcengine\route.py:277]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("JiMeng4 image error: %s", e)
  ```
- **[app\api\v1\ai\volcengine\route.py:313]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("JiMeng31 HTTP error: %s - %s", e.response.status_code, e.response.text)
  ```
- **[app\api\v1\ai\volcengine\route.py:316]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("JiMeng31 error: %s", e)
  ```
- **[app\api\v1\ai\volcengine\route.py:387]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Visual submit failed, no task_id. Response: %s", resp_data)
  ```
- **[app\api\v1\ai\volcengine\route.py:412]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("Video download failed, using original URL")
  ```
- **[app\api\v1\ai\volcengine\route.py:450]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Volcengine visual HTTP error: %s - %s", e.response.status_code, e.response.text)
  ```
- **[app\api\v1\ai\volcengine\route.py:455]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Visual proxy error for req_key=%s: %s", req_key, e)
  ```
- **[app\api\v1\ai\volcengine\route.py:488]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("JiMeng4 CVProcess HTTP error: %s - %s", e.response.status_code, e.response.text)
  ```
- **[app\api\v1\ai\volcengine\route.py:491]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("JiMeng4 CVProcess error: %s", e)
  ```
- **[app\api\v1\alerting\webhook.py:85]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Invalid JSON: %s", e)
  ```
- **[app\api\v1\auth\ali_login.py:57]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Alipay OAuth code exchange, is_web=" + str(is_web))
  ```
- **[app\api\v1\auth\ali_login.py:106]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Alipay pc/wxCode, code=" + code[:10] + "...")
  ```
- **[app\api\v1\auth\ali_login.py:144]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Alipay web/wxCode, auth_code=" + auth_code[:10] + "...")
  ```
- **[app\api\v1\auth\coze_oauth.py:249]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Coze OAuth token 失败 (type={}): {}", body.type, e)
  ```
- **[app\api\v1\auth\coze_oauth.py:323]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Coze JWT token 配置错误: {}", e)
  ```
- **[app\api\v1\auth\coze_oauth.py:326]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Coze JWT token 获取失败: {}", e)
  ```
- **[app\api\v1\auth\dingtalk.py:23]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("DingTalk login by code, code=" + code[:10] + "...")
  ```
- **[app\api\v1\auth\enterprise_wechat.py:14]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Enterprise WeChat pc/wxCode, code=" + code[:10] + "...")
  ```
- **[app\api\v1\auth\feishu.py:14]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Feishu pc/wxCode request, code=" + code[:10] + "...")
  ```
- **[app\api\v1\auth\google.py:135]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"google tokeninfo 返回 {resp.status_code}: {resp.text[:200]}")
  ```
- **[app\api\v1\auth\google.py:140]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"google tokeninfo aud 不匹配: got={aud} allowed={allowed_audiences}")
  ```
- **[app\api\v1\auth\google.py:144]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"google tokeninfo 异常: {e}")
  ```
- **[app\api\v1\auth\google.py:155]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("Google OAuth 未配置 client_id/secret")
  ```
- **[app\api\v1\auth\google.py:170]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"google token exchange 失败 {resp.status_code}: {resp.text[:200]}")
  ```
- **[app\api\v1\auth\google.py:174]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"google token exchange 异常: {e}")
  ```
- **[app\api\v1\auth\legacy_local.py:107]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Change password error: {e}")
  ```
- **[app\api\v1\auth\login.py:341]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Change password error: {e}")
  ```
- **[app\api\v1\auth\login.py:376]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Change phone error: {e}")
  ```
- **[app\api\v1\auth\sms_proxy.py:108]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("SMS verify proxy error: " + str(e))
  ```
- **[app\api\v1\auth\username_login.py:95]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("Unexpected error in line 94")
  ```
- **[app\api\v1\auth\wechat.py:61]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Failed to get WeChat access_token: {data}")
  ```
- **[app\api\v1\auth\wechat.py:69]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"WeChat access_token request error: {e}")
  ```
- **[app\api\v1\auth\wechat.py:204]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"WeChat getuserphonenumber failed: {err_msg}")
  ```
- **[app\api\v1\auth\wechat.py:294]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"WeChat phone request error: {e}")
  ```
- **[app\api\v1\auth\wechat.py:398]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"WeChat rebind by phone error: {e}")
  ```
- **[app\api\v1\auth\wechat.py:427]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"WeChat getwxacodeunlimit failed: {err_data}")
  ```
- **[app\api\v1\auth\wechat.py:440]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"WeChat qrcode error: {e}")
  ```
- **[app\api\v1\auth\wechat.py:505]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("WeChat PC login not configured (WX_PC_APPID/WX_PC_SECRET empty)")
  ```
- **[app\api\v1\auth\wechat.py:519]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"WeChat PC token error: {token_data}")
  ```
- **[app\api\v1\callback\callback.py:293]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"[Outbound] 处理外呼回调异常: {e}")
  ```
- **[app\api\v1\chat\doubao.py:72]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(f"Client->Doubao forward ended: {e}")
  ```
- **[app\api\v1\chat\kling.py:54]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Failed to generate Kling JWT: {e}")
  ```
- **[app\api\v1\chat\kling.py:225]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(f"[Kling Identify] status={resp.status_code}, text={_trunc(resp.text)}")
  ```
- **[app\api\v1\chat\kling.py:696]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(f"[Kling T2V] POST {KLING_T2V_ENDPOINT}")
  ```
- **[app\api\v1\chat\kling.py:747]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(f"[Kling I2V] POST {KLING_I2V_ENDPOINT}")
  ```
- **[app\api\v1\chat\kling.py:793]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(f"[Kling T2I] POST {KLING_T2I_ENDPOINT}")
  ```
- **[app\api\v1\chat\zhipu.py:70]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(f"Client->Zhipu forward ended: {e}")
  ```
- **[app\api\v1\content\file_upload.py:41]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Base64 decode failed: %s", e)
  ```
- **[app\api\v1\content\file_upload.py:62]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("WebP conversion failed: %s", e)
  ```
- **[app\api\v1\content\file_upload.py:72]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Base64 upload error: " + str(e))
  ```
- **[app\api\v1\content\file_upload.py:90]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Form upload error: " + str(e))
  ```
- **[app\api\v1\content\file_upload.py:108]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Octet upload error: " + str(e))
  ```
- **[app\api\v1\courses\courses_ext.py:570]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Delete platform error: {e}")
  ```
- **[app\api\v1\coze\audio.py:54]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("List voices error: " + str(e))
  ```
- **[app\api\v1\coze\audio.py:70]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Create speech error: " + str(e))
  ```
- **[app\api\v1\coze\audio.py:86]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Chat audio error: " + str(e))
  ```
- **[app\api\v1\coze\audio.py:96]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("List voiceprints error: " + str(e))
  ```
- **[app\api\v1\coze\audio.py:111]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Create voiceprint error: " + str(e))
  ```
- **[app\api\v1\coze\audio.py:126]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Update voiceprint error: " + str(e))
  ```
- **[app\api\v1\coze\audio.py:136]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Delete voiceprint error: " + str(e))
  ```
- **[app\api\v1\coze\chat_audio.py:49]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Simple audio chat error: " + str(e))
  ```
- **[app\api\v1\coze\chat_audio.py:91]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Plugin audio error: " + str(e))
  ```
- **[app\api\v1\coze\conversations.py:41]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("List conversations error: " + str(e))
  ```
- **[app\api\v1\coze\conversations.py:51]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("List messages error: " + str(e))
  ```
- **[app\api\v1\coze\conversations.py:63]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Feedback error: " + str(e))
  ```
- **[app\api\v1\coze\conversations.py:73]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Retrieve conversation error: " + str(e))
  ```
- **[app\api\v1\coze\datasets.py:45]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Create dataset error: " + str(e))
  ```
- **[app\api\v1\coze\datasets.py:55]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("List datasets error: " + str(e))
  ```
- **[app\api\v1\coze\datasets.py:66]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Upload document error: " + str(e))
  ```
- **[app\api\v1\coze\datasets.py:76]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("List documents error: " + str(e))
  ```
- **[app\api\v1\coze\datasets.py:87]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Upload image error: " + str(e))
  ```
- **[app\api\v1\coze\datasets.py:97]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("List images error: " + str(e))
  ```
- **[app\api\v1\coze\review.py:52]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Update review error: " + str(e))
  ```
- **[app\api\v1\coze\review.py:67]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Get review status error: " + str(e))
  ```
- **[app\api\v1\coze\variables.py:35]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Retrieve variable error: " + str(e))
  ```
- **[app\api\v1\coze\variables.py:45]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("List variables error: " + str(e))
  ```
- **[app\api\v1\coze\variables.py:57]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Update variable error: " + str(e))
  ```
- **[app\api\v1\coze\variables.py:69]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Create variable error: " + str(e))
  ```
- **[app\api\v1\coze\variables.py:79]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Delete variable error: " + str(e))
  ```
- **[app\api\v1\coze\workflows.py:57]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Workflow run error: " + str(e))
  ```
- **[app\api\v1\coze\workflows.py:104]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Workflow history error: " + str(e))
  ```
- **[app\api\v1\coze\workflows.py:122]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Node history error: " + str(e))
  ```
- **[app\api\v1\coze\workflows_async.py:36]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Async workflow error: " + str(e))
  ```
- **[app\api\v1\coze\workflows_async.py:71]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Workflow chat error: " + str(e))
  ```
- **[app\api\v1\crew\__init__.py:52]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"创建会话失败: {e}")
  ```
- **[app\api\v1\crew\__init__.py:232]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"创建并执行失败: {e}")
  ```
- **[app\api\v1\finance\fund.py:85]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("WX callback signature verify failed")
  ```
- **[app\api\v1\finance\fund.py:109]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Fund notify received, serial=" + serial)
  ```
- **[app\api\v1\finance\fund.py:132]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Fund app notify received")
  ```
- **[app\api\v1\finance\fund.py:188]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Agent transfer notify received")
  ```
- **[app\api\v1\finance\fund.py:202]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("handle_transfer_notify not implemented, transfer callback unavailable")
  ```
- **[app\api\v1\knowledge\__init__.py:103]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"文本入库失败: {e}")
  ```
- **[app\api\v1\knowledge\__init__.py:141]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"文件入库失败: {e}")
  ```
- **[app\api\v1\knowledge\__init__.py:162]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"语义检索失败: {e}")
  ```
- **[app\api\v1\knowledge\__init__.py:183]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"RAG 上下文生成失败: {e}")
  ```
- **[app\api\v1\llm\ws.py:426]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"Token 校验异常(不阻断): {e}")
  ```
- **[app\api\v1\llm\ws.py:447]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"LLM HTTP 错误: {e}")
  ```
- **[app\api\v1\llm\ws.py:450]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"LLM 流式异常: {e}")
  ```
- **[app\api\v1\llm\ws.py:477]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("LLM 调用失败: %s", e)
  ```
- **[app\api\v1\monitor\alerts.py:84]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("alert webhook JSON parse failed: %s", e, exc_info=True)
  ```
- **[app\api\v1\payments\alipay.py:93]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Alipay notify verify failed")
  ```
- **[app\api\v1\payments\alipay_fund.py:72]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Alipay notify received, trade_no=" + params.get("trade_no", ""))
  ```
- **[app\api\v1\resource\context.py:189]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Remove field error: {e}")
  ```
- **[app\api\v1\resource\home.py:380]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Coze OAuth token error: {data}")
  ```
- **[app\api\v1\resource\home.py:385]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Coze access token error: {e}")
  ```
- **[app\api\v1\stock\analyse.py:101]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Stock WS disconnect: " + client_id)
  ```
- **[app\api\v1\stock\analyse.py:258]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Stock POST request: " + json.dumps(params, ensure_ascii=False))
  ```
- **[app\api\v1\system\codegen.py:185]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"gen/column error: {e}")
  ```
- **[app\api\v1\system\codegen.py:303]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"gen/import_table error: {e}")
  ```
- **[app\api\v1\system\codegen.py:353]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"gen/preview error: {e}")
  ```
- **[app\core\admin_auth.py:46]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug("admin JWT 解码失败: %s", e)
  ```
- **[app\core\exceptions.py:59]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"HTTP {exc.status_code} | {request.method} {request.url.path} | {exc.detail}")
  ```
- **[app\core\exceptions.py:87]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"Validation error | {request.method} {request.url.path} | {errors}")
  ```
- **[app\core\exceptions.py:116]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"DB error | {request.method} {request.url.path} | " f"{type(exc).__name__}: {str(exc)[:200]}")
  ```
- **[app\core\exceptions.py:124]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(
  ```
- **[app\core\exceptions.py:158]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(f"Business error | {request.method} {request.url.path} | " f"{exc.code}: {exc.msg}")
  ```
- **[app\core\jwt_blacklist.py:71]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"revoke_token redis failed, fallback to memory: {e}")
  ```
- **[app\core\rate_limit.py:138]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("限流触发: ip=%s path=%s limit=%d/%ds", ip, path, limit, window)
  ```
- **[app\middleware\rate_limiter.py:338]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug("记录限流指标失败: %s", e)
  ```
- **[app\middleware\response_normalizer.py:68]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(f"ResponseNormalizer: read body failed: {e}")
  ```
- **[app\middleware\response_normalizer.py:126]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(f"ResponseNormalizer: re-encode failed: {e}")
  ```
- **[app\services\agents_cache_service.py:30]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"Redis 不可用: {e}")
  ```
- **[app\services\alert_pagerduty.py:189]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"PagerDuty push failed: {info}")
  ```
- **[app\services\alert_service.py:306]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"Generic webhook push failed: {info}")
  ```
- **[app\services\alert_service.py:347]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(f"SMTP_SSL {port} failed: {e}")
  ```
- **[app\services\ali_ai_service.py:75]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"获取阿里云 Token 失败: {e}")
  ```
- **[app\services\auth_service.py:276]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("refresh_token success: uuid={}", user_uuid)
  ```
- **[app\services\crew_llm_adapter.py:30]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"LLM 配置未找到: {model_id}, 尝试回退")
  ```
- **[app\services\crew_llm_adapter.py:50]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("CrewAI 未安装, 使用 OpenAI 回退")
  ```
- **[app\services\crew_orchestrator.py:36]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("CrewAI 未安装, 多智能体将使用简化模式")
  ```
- **[app\services\dingtalk_auth_service.py:27]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("DingTalk appKey/appSecret not configured")
  ```
- **[app\services\dingtalk_auth_service.py:36]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"DingTalk gettoken error: {body}")
  ```
- **[app\services\dingtalk_auth_service.py:40]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"DingTalk gettoken exception: {e}")
  ```
- **[app\services\enterprise_wechat_service.py:26]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("No SuiteTicket in XML")
  ```
- **[app\services\enterprise_wechat_service.py:44]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Parse suite XML error: " + str(e))
  ```
- **[app\services\enterprise_wechat_service.py:62]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Redis check suite ticket error: " + str(e))
  ```
- **[app\services\enterprise_wechat_service.py:94]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Get suite token error: " + str(e))
  ```
- **[app\services\enterprise_wechat_service.py:119]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("code2session error: " + str(e))
  ```
- **[app\services\feishu_auth_service.py:42]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Feishu get access token error: " + str(e))
  ```
- **[app\services\member_business.py:313]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(f"[auth-code] 发送到 {mobile}: {code}")  # 实际应调用短信网关
  ```
- **[app\services\member_business.py:322]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(f"[pwd-auth-code] 发送到 {username}: {code}")
  ```
- **[app\services\metrics_service.py:85]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"请求处理错误: {e}")
  ```
- **[app\services\pdf_service.py:180]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"签发证书失败: {e}")
  ```
- **[app\services\token_cache_service.py:60]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Redis read error for {user_uuid}: {e}")
  ```
- **[app\services\token_cache_service.py:96]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Redis delete error for {user_uuid}: {e}")
  ```
- **[app\services\token_utils_service.py:124]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Check user vip error: {e}")
  ```
- **[app\services\token_utils_service.py:144]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Check token error: {e}")
  ```
- **[app\services\token_utils_service.py:205]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Calculate tokens per yuan error: {e}")
  ```
- **[app\services\token_utils_service.py:250]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"calculate_and_deduct_tokens_by_cost error: {e}")
  ```
- **[app\services\token_utils_service.py:283]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"calculate_and_deduct_tokens_for_hunyuan3d error: {e}")
  ```
- **[app\services\agent_upload\agent_client.py:56]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"任务查询请求异常, 继续重试: {e}")
  ```
- **[app\tasks\scheduler.py:245]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Alert noise inhibit ticket failed rc={result.returncode}, stderr: {result.stderr[-500:]}")
  ```
- **[app\utils\alert_router.py:76]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(f"[ALERT_SMS] {body}")
  ```
- **[app\utils\alert_router.py:149]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"[CRITICAL] {alert_key} {message}")
  ```
- **[app\utils\alipay_util.py:68]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Alipay verify failed: {e}")
  ```
- **[app\utils\alipay_util.py:100]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Alipay public key missing, reject notify")
  ```
- **[app\utils\audit_archive.py:165]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"audit_archive: read {path} fail: {e!r}")
  ```
- **[app\utils\audit_chain.py:136]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"audit_chain append fail: {e}")
  ```
- **[app\utils\audit_chain.py:159]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"audit_chain read fail: {e}")
  ```
- **[app\utils\audit_ddl_trail.py:123]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("ddl_audit: op=%s obj=%s.%s actor=%s", op, obj_type, obj_name, actor)
  ```
- **[app\utils\business_events.py:133]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(f"business_events local write failed: {e}")
  ```
- **[app\utils\canary_rule_snapshot.py:213]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("Caught unexpected exception")
  ```
- **[app\utils\coze_auth_utils.py:92]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("加载私钥失败: {}", e)
  ```
- **[app\utils\coze_auth_utils.py:159]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(
  ```
- **[app\utils\coze_auth_utils.py:171]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("无法加载私钥, 获取 access_token 失败")
  ```
- **[app\utils\coze_auth_utils.py:175]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("JWT 配置不完整, 缺少必要参数 (client_id/public_key_id/private_key)")
  ```
- **[app\utils\coze_auth_utils.py:206]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Coze 授权接口返回异常, 缺少 access_token: {}", result)
  ```
- **[app\utils\coze_auth_utils.py:214]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("Coze access_token 获取成功, 有效期 {} 秒", _TOKEN_TTL)
  ```
- **[app\utils\coze_auth_utils.py:218]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("生成 Coze access_token 失败: {}", e)
  ```
- **[app\utils\coze_oauth_apps.py:300]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info("JWT 流程无 refresh_token, 重新签发 access_token")
  ```
- **[app\utils\deadcode_ci.py:61]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"deadcode_ci: load {path} fail: {e!r}")
  ```
- **[app\utils\error_handler.py:136]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"API Error: {exc.code} - {exc.message} | Path: {request.url.path}")
  ```
- **[app\utils\error_handler.py:156]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"Validation Error: {len(errors)} errors | Path: {request.url.path}")
  ```
- **[app\utils\error_handler.py:171]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"Database Error: {type(exc).__name__} - {str(exc)[:200]} | " f"Path: {request.url.path}")
  ```
- **[app\utils\file_transfer.py:42]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Download HTTP error: " + str(e.response.status_code) + " - " + url)
  ```
- **[app\utils\file_transfer.py:70]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Network upload failed: " + str(resp.status_code))
  ```
- **[app\utils\file_transfer.py:109]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Upload failed: " + str(resp.status_code))
  ```
- **[app\utils\llm_cost.py:114]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"llm_cost: unknown model {model!r}, cost=0")
  ```
- **[app\utils\llm_cost.py:137]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"llm_cost: unknown model {model!r}, cost=0")
  ```
- **[app\utils\notify_email.py:70]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"SMTP STARTTLS not supported by {host}:{port}, sending plain")
  ```
- **[app\utils\notify_email.py:111]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("NOTIFY_SMTP_HOST/USER/PASSWORD 未配置, 无法发送通知邮件")
  ```
- **[app\utils\notify_email.py:127]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(
  ```
- **[app\utils\rate_limit_dist.py:324]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(f"token_bucket lua fail: {e}")
  ```
- **[app\utils\redis_util.py:66]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("Redis unavailable (%s), falling back to fakeredis", e)
  ```
- **[app\utils\sms_util.py:48]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug("Redis 存储验证码失败 (降级到内存): %s", e)
  ```
- **[app\utils\sms_util.py:62]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug("Redis 读取验证码失败 (降级到内存): %s", e)
  ```
- **[app\utils\sms_util.py:177]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Aliyun SMS credentials not configured")
  ```
- **[app\utils\sms_util.py:205]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("alibabacloud-dysmsapi20170525 not installed, falling back to proxy")
  ```
- **[app\utils\sms_util.py:276]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug("读取短信失败计数失败 (降级放行): %s", e)
  ```
- **[app\utils\sms_util.py:297]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug("写入短信失败计数失败: %s", e)
  ```
- **[app\utils\sms_util.py:319]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("253 SMS account/password not configured")
  ```
- **[app\utils\sms_util.py:338]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(
  ```
- **[app\utils\sms_util.py:364]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("Wuxi SMS gateway not configured (host/clientId/clientSecret)")
  ```
- **[app\utils\sms_util.py:394]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(
  ```
- **[app\utils\tencent_cos.py:94]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(
  ```
- **[app\utils\tencent_cos.py:121]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(
  ```
- **[app\utils\tencent_cos.py:150]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(
  ```
- **[app\utils\tencent_cos.py:202]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(
  ```
- **[app\utils\tencent_live.py:156]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(f"live stream stopped: stream={stream_name} resp_code={resp.get('Response', {}).get('Error', {}).get('Code',
  ```
- **[app\utils\tencent_live.py:239]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(
  ```
- **[app\utils\tencent_live.py:244]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"tencent live api http error: action={action} status={e.response.status_code} body={e.response.text[:500]}
  ```
- **[app\utils\token_flow_utils.py:59]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"[token_flow] get_user_id_from_uuid 查询失败 user_uuid={user_uuid} error={e}")
  ```
- **[app\utils\token_flow_utils.py:99]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(
  ```
- **[app\utils\token_flow_utils.py:105]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(
  ```
- **[app\utils\wechat_pay_util.py:79]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("WX platform cert missing, skip verify (DEV only)")
  ```
- **[app\utils\wechat_pay_util.py:90]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error(f"WX V3 signature verify failed: {e}")
  ```
- **[app\utils\ws_heartbeat.py:116]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning("Caught unexpected exception")
  ```
- **[app\ws\auth.py:102]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"WS origin denied: origin={origin} " f"path={ws.url.path} client={ws.client}")
  ```
- **[app\ws\auth_decorator.py:50]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.error("ws_require_auth: WebSocket instance not found in args")
  ```
- **[app\ws\auth_decorator.py:93]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(f"ws token decode failed: {e}")
  ```
- **[app\ws\manager.py:31]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"Redis unavailable for WS broadcast: {e}")
  ```
- **[app\ws\manager.py:59]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.warning(f"WS auth token decode error: {e}")
  ```
- **[app\ws\manager.py:278]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(f"WS connected: conn_id={conn_id} user={user_uuid} room={room_id} exp={token_exp}")
  ```
- **[app\ws\manager.py:293]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.debug(f"WS disconnected: conn_id={conn_id}")
  ```
- **[app\ws\manager.py:340]** P2-SensitiveLog: 日志可能包含敏感信息（phone/code/otp/password/token）
  ```
  logger.info(f"WS force close (token expired): conn_id={conn_id}")
  ```

