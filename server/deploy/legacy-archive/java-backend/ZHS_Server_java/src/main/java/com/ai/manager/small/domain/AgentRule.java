package com.ai.manager.small.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.util.Date;
import java.util.List;

/**
 * 智能体自定义筛选规则对象 agent_rule
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
public class AgentRule extends PageBean
{
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    private Long id;

    /** 标题 */
    
    private String title;

    /** 类型 0首页 */
    
    private Long type;

    /** 备用字段 */
    private String field1;

    /** 逻辑隐藏 0显示 | 1隐藏 */
    
    private Long isHidden;

    /** 创建人 */
    
    private String creator;

    /** 创建时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    
    private Date createdAt;

    private String remark;

    List<AgentRuleParam> ruleParams;

    List<AgentRuleLink> ruleLinks;


    private String agentCategory;
    private String agentMainCategory;

}
