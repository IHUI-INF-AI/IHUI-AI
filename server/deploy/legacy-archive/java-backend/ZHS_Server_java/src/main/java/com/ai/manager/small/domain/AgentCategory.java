package com.ai.manager.small.domain;

import lombok.*;

import java.io.Serializable;
import java.util.Date;

/**
 * 智能体类型对象 agent_category
 * 
 * @author Raindrop_L
 * @date 2025-08-07
 */

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class AgentCategory implements Serializable
{
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    private String id;

    /** 智能体类别名称 */
    private String name;

    /** 智能体类别编码 */
    private String code;

    /** 上级id */
    private String parentId;

    /** 是否隐藏 */
    private Integer isHidden;

    /** 是否使用 */
    private Integer isUse;

    /** 状态 */
    private Integer status;

    /** 预留字段1 */
    private String field1;

    /** $column.columnComment */
    private String field2;

    /** 创建人 */
    private String creator;

    /** 创建时间 */
    private Date createdAt;

    /** 修改人 */
    private String updator;

    /** 修改时间 */
    private Date updatedAt;

    /** 修改时间 */
    private String showName;

    /** 按钮点击后显示图片 */
    private String butUrl;

}
