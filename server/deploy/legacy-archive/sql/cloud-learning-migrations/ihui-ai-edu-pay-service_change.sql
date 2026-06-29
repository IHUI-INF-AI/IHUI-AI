-- liquibase formatted sql

-- changeset bill:202110181
create table t_payment
(
    id                     bigint auto_increment primary key comment '主键id',
    order_no               varchar(64)    not null comment '商户订单号,64个字符以内、只能包含字母、数字、下划线；需保证在商户端不重复',
    status                 varchar(64)    not null comment '支付状态',
    callback_url           varchar(2000)  null comment '支付回调接口（不同服务支付回调不同地址），规则  contextpath + restful api',
    subject                nvarchar(300)  not null comment '订单标题, 最大长度256',
    total_amount           decimal(14, 2) not null comment '订单总金额，单位为元，精确到小数点后两位，取值范围[0.01,100000000]，如果同时传入了【打折金额】，【不可打折金额】，【订单总金额】三者，则必须满足如下条件：【订单总金额】=【打折金额】+【不可打折金额】',
    order_create_time      timestamp      not null comment '创建订单时间',
    expire_time             int  null comment '过期分钟',
    return_url             varchar(2000)  null comment '支付成功后同步跳转的页面，是一个http/https开头的字符串',
    terminal               varchar(64)    not null comment '交易终端',
    platform               varchar(64)    not null comment '交易平台',
    channel                varchar(64)    null comment '平台渠道类型（非必填），部分平台存在',
    platform_callback_time timestamp      null comment '交易支付回调时间',
    ip                     varchar(20)    null comment '客户端ip',
    openid                 varchar(64)    null comment '微信id',
    transaction_id         varchar(64)    null comment '平台支付单号',
    user_id                bigint         not null comment '用户id',
    department_id          bigint         not null comment '部门id',
    company_id             bigint         not null comment '公司id',
    create_time            timestamp default current_timestamp comment '创建时间',
    update_time            timestamp default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '支付记录';
