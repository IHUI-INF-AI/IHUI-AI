package com.ai.manager.small.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.LocalDateTime;

/**
 * 大模型信息表
 * 对应数据库表：zhs_ai_model_info
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@ToString
public class AiModelInfo {

    /**
     * 主键ID（默认UUID生成）
     */
    private String id;

    /**
     * 模型名称
     */
    private String name;

    /**
     * 来源厂商
     */
    private String source;

    /**
     * 图片地址
     */
    private String img;

    /**
     * 备注
     */
    private String remark;

    /**
     * 模型类别 0其他 | 1文本 | 2图片 | 3视频 | 4音频（默认0）
     */
    private Integer type = 0;

    /**
     * 排序（自增）
     */
    private Integer sort;

    /**
     * 是否删除（默认0）
     */
    private Integer isDel = 0;

    /**
     * 创建人
     */
    private String creator;

    /**
     * 创建时间（默认当前时间戳）
     */
    private LocalDateTime createdAt;

    /**
     * 修改人
     */
    private String updator;

    /**
     * 修改时间（更新时自动填充）
     */
    private LocalDateTime updatedAt;

    /**
     * 请求类型
     */
    private String questType;

    /**
     * 存储模型相关变量信息
     */
    private String variables;

    /**
     * 是否新增
     */
    private String isNew;

    /**
     * 排序（字段名冲突备注：数据库字段is_top注释为"排序"，与sort字段功能重复，建议确认业务含义）
     */
    private String isTop;

    /**
     * 厂商（与source字段注释重复，建议确认业务含义）
     */
    private String manufacturer;
}
