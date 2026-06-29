package com.ai.manager.small.mapper;


import com.ai.manager.small.domain.ZhsAgent;

import java.util.List;

/**
 * Agent管理Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-06-20
 */
public interface ZhsAgentMapper 
{
    /**
     * 查询Agent管理
     * 
     * @param id Agent管理主键
     * @return Agent管理
     */
    public ZhsAgent selectZhsAgentById(String id);

    /**
     * 查询Agent管理列表
     * 
     * @param zhsAgent Agent管理
     * @return Agent管理集合
     */
    public List<ZhsAgent> selectZhsAgentList(ZhsAgent zhsAgent);

    /**
     * 新增Agent管理
     * 
     * @param zhsAgent Agent管理
     * @return 结果
     */
    public int insertZhsAgent(ZhsAgent zhsAgent);

    /**
     * 修改Agent管理
     * 
     * @param zhsAgent Agent管理
     * @return 结果
     */
    public int updateZhsAgent(ZhsAgent zhsAgent);

    /**
     * 删除Agent管理
     * 
     * @param id Agent管理主键
     * @return 结果
     */
    public int deleteZhsAgentById(String id);

    /**
     * 批量删除Agent管理
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deleteZhsAgentByIds(String[] ids);
}
