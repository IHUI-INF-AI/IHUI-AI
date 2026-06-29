-- liquibase formatted sql

-- changeset bill:202110181
create table t_order
(
    id             bigint auto_increment primary key comment '主键id',
    no             varchar(50)               not null comment '订单号',
    status         varchar(50)               not null comment '状态',
    remark         nvarchar(2000) default '' not null comment '用户备注',
    freight_amount decimal(14, 2) default 0  not null comment '邮费金额',
    item_amount    decimal(14, 2)            not null comment '商品金额',
    payment_amount decimal(14, 2)            not null comment '付款金额',
    user_id        bigint                    not null comment '用户id',
    department_id  bigint                    not null comment '部门id',
    company_id     bigint                    not null comment '公司id',
    create_time    timestamp      default current_timestamp comment '创建时间',
    update_time    timestamp      default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '订单';

-- changeset bill:202110182
create table t_order_item
(
    id             bigint auto_increment primary key comment '主键id',
    order_id       bigint         not null comment '订单id',
    item_id        varchar(100)   not null comment '商品id',
    title          nvarchar(500)  not null comment '标题',
    image          varchar(2000)  not null comment '图片',
    original_price decimal(14, 2) not null comment '原价',
    price          decimal(14, 2) not null comment '价格',
    quantity       int            not null comment '数量',
    payment_amount decimal(14, 2) not null comment '付款金额',
    create_time    timestamp default current_timestamp comment '创建时间',
    update_time    timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '订单商品';

-- changeset bill:202110183
create table t_order_payment
(
    id          bigint auto_increment primary key comment '主键id',
    order_id    bigint         not null comment '订单id',
    status      varchar(100)   not null comment '状态',
    channel     varchar(100)   not null comment '渠道',
    amount      decimal(14, 2) not null comment '金额',
    create_time timestamp      not null default current_timestamp comment '创建时间',
    update_time timestamp      not null default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '订单支付';

-- changeset bill:202503271
create table t_invoice_title
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

-- changeset bill:202503272
create table t_invoice_application
(
    id                  bigint auto_increment primary key comment '主键id',
    user_id             bigint                    not null comment '用户ID',
    company_id          bigint                             comment '公司ID',
    order_id            bigint                    not null comment '订单ID',
    order_no            varchar(50)               not null comment '订单号',
    invoice_title_id    bigint                             comment '发票抬头ID',
    title_type          int                       not null comment '抬头类型（1-企业单位/2-个人或非企业单位）',
    company_name        varchar(200)              not null comment '公司名称/个人姓名',
    company_tax_number  varchar(50)                        comment '公司税号',
    company_address     varchar(500)                       comment '公司地址',
    company_phone       varchar(50)                        comment '公司电话',
    bank_name           varchar(200)                       comment '开户银行',
    bank_account        varchar(100)                       comment '银行账号',
    email               varchar(200)                       comment '电子邮箱',
    mobile_phone        varchar(50)                        comment '手机号码',
    invoice_amount      decimal(14, 2)            not null comment '开票金额',
    invoice_content     varchar(500)                       comment '发票内容',
    status              int            default 0  not null comment '状态（0-待开票/1-开票中/2-已开票/3-已拒绝/4-已取消）',
    invoice_no          varchar(100)                       comment '发票号码',
    invoice_url         varchar(500)                       comment '发票URL',
    reject_reason       varchar(500)                       comment '拒绝原因',
    create_user_id      bigint                             comment '创建人ID',
    update_user_id      bigint                             comment '更新人ID',
    create_time         timestamp      default current_timestamp comment '创建时间',
    update_time         timestamp      default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '发票申请';

