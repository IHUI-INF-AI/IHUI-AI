package com.ai.manager.small.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.util.Date;

/**
 * 智能体自定义检索规则字段对象 agent_rule_param
 * 
 * @author Raindrop_L
 * @date 2025-09-26
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class AgentRuleParam extends PageBean
{
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    private Long id;

    /** 规则id */
    
    private Long ruleId;

    /** 查询规则 */
    
    private String context;

    /** 对应数据库字段名 */
    
    private String paramName;

    /** 查询类型 0搜索 | 1排序 */
    
    private Long type;

    /** 排序方式 0正序 | 1倒叙 */
    
    private Long sortord;

    /** 逻辑使用 0使用中 | 1不使用 */
    private Long isUse;

    /** 创建人 */
    
    private String creator;

    /** 创建时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    
    private Date createdAt;

    private String remark;

}
