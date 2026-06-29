CREATE TABLE IF NOT EXISTS t_invoice_title
(
    id                 bigint auto_increment primary key comment '主键id',
    user_id            bigint                    not null comment '用户ID',
    company_id         bigint                             comment '公司ID',
    title_type         int                       not null comment '抬头类型（1-企业单位/2-个人或非企业单位）',
    company_name       varchar(200)              not null comment '公司名称/个人姓名',
    company_tax_number varchar(50)                        comment '公司税号（个人可为空）',
    company_address    varchar(500)                       comment '公司地址',
    company_phone      varchar(50)                        comment '公司电话',
    bank_name          varchar(200)                       comment '开户银行',
    bank_account       varchar(100)                       comment '银行账号',
    email              varchar(200)                       comment '电子邮箱（接收电子发票）',
    mobile_phone       varchar(50)                        comment '手机号码',
    default_flag       tinyint(1)     default 0  not null comment '是否默认发票抬头（0: 否, 1: 是）',
    create_user_id     bigint                             comment '创建人ID',
    update_user_id     bigint                             comment '更新人ID',
    create_time        timestamp      default current_timestamp comment '创建时间',
    update_time        timestamp      default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '发票抬头';
