-- liquibase formatted sql

-- changeset bill.lai:202106131
create table t_visit_log
(
    id          bigint auto_increment primary key comment '主键id',
    ip_address  varchar(200)   not null comment 'ip地址',
    uuid        varchar(50)    not null comment 'UV标志',
    member_id   bigint         not null default 0 comment '会员id',
    channel     varchar(200)   not null comment '渠道',
    visit_date  date           not null comment '日期',
    visit_time  varchar(20)    not null comment '时间',
    session_id  varchar(50)    not null comment '会话id',
    url         nvarchar(1000) not null default '' comment '地址',
    create_time timestamp               default current_timestamp comment '创建时间',
    update_time timestamp               default current_timestamp on update current_timestamp comment '最后修改时间'
) comment '访问记录';

-- changeset bill.lai:202106132
alter table t_visit_log
    add ip_city_name nvarchar(500) default '' not null comment 'ip所在城市';

