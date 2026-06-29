package com.ai.manager.small.domain.dto;

import com.ai.manager.small.domain.AgentNeedTask;
import lombok.*;

import java.util.ArrayList;

/**
 * 智能体需求任务对象 agent_need_task
 * 
 * @author Raindrop_L
 * @date 2025-08-15
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class AgentNeedTaskDTO extends AgentNeedTask
{
    private static final long serialVersionUID = 1L;

    private String search;
    private ArrayList<String> types;
    private ArrayList<String> categorys;

}
