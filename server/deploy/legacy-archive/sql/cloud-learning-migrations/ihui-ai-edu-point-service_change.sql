-- liquibase formatted sql

-- changeset bill:2020070701
create table t_channel
(
    id                     bigint auto_increment comment '主键id',
    name                   nvarchar(50)             not null comment '名称',
    member_receive_num     bigint                   not null comment '会员每次领取数量',
    issued_num             bigint        default 0  not null comment '总发放阈值',
    day_issued_num         bigint        default 0  not null comment '日发放阈值',
    day_member_receive_num bigint        default 0  not null comment '每日会员领取阈值',
    change_remind          tinyint       default 0  not null comment '是否变动提醒',
    increase_remind_tips   nvarchar(500) default '' not null comment '增加积分变动提示语, {{coin}}表示变动金额',
    decrease_remind_tips   nvarchar(500) default '' not null comment '消耗积分变动提示语, {{coin}}表示变动金额',
    user_id                bigint                   not null comment '创建用户id',
    create_time            timestamp     default current_timestamp comment '创建时间',
    update_time            timestamp     default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '积分渠道';

-- changeset bill:2020070702
create table t_record
(
    id          bigint auto_increment comment '主键id',
    point_id    bigint  not null comment '积分id',
    channel_id  bigint  not null comment '积分渠道id',
    point_num   bigint  not null comment '积分数量',
    type        varchar(100) not null comment '积分记录类型',
    member_id   bigint not null comment '会员id',
    mobile      varchar(100) not null comment '会员手机号',
    remark      nvarchar(500) not null comment '备注原因',
    topic_id    bigint not null comment '积分记录主题id',
    topic_type  varchar(100) not null comment '积分记录主题类型',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '积分记录';

-- changeset bill:2020070703
create table t_point
(
    id               bigint auto_increment comment '主键id',
    name             nvarchar(100) not null comment '名称',
    start_date       timestamp     not null comment '有效期开始时间',
    end_date         timestamp     not null comment '有效期结束时间',
    redemption_ratio bigint        not null comment '兑换比例，1元=100积分，填写100',
    status           varchar(100)  not null comment '状态',
    user_id          bigint        not null comment '用户id',
    create_time      timestamp default current_timestamp comment '创建时间',
    update_time      timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '积分';

-- changeset bill:2020070704
create table t_point_channel_relation
(
    id          bigint auto_increment comment '主键id',
    point_id    bigint not null comment '积分id',
    channel_id  bigint not null comment '积分渠道id',
    create_time timestamp default current_timestamp comment '创建时间',
    update_time timestamp default current_timestamp on update current_timestamp comment '最后修改时间',
    primary key (id)
) comment '积分与积分渠道的关系';
