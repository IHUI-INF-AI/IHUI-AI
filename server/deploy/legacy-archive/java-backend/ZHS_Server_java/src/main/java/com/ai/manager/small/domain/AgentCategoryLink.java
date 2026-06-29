package com.ai.manager.small.domain;

import lombok.*;

import java.io.Serializable;
import java.util.Date;

/**
 * 智能体类型关联对象 agent_category_link
 * 
 * @author Raindrop_L
 * @date 2025-08-07
 */

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class AgentCategoryLink implements Serializable
{
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    private Integer id;

    /** 智能体id */
    private String agentId;

    /** 智能体类别id */
    private String categoryId;

    /** 是否逻辑删除 0否 | 1是 */
    private Integer isDel;

    /** 预留字段 */
    private String field1;

    /** 预留字段 */
    private String field2;

    /** 创建时间 */
    private Date createdAt;

}
