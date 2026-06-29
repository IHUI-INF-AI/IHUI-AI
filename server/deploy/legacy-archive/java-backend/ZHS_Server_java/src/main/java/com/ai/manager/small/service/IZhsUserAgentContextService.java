package com.ai.manager.small.service;

import com.ai.manager.small.domain.ZhsUserAgentContext;

import java.util.List;

/**
 * 用户关于智能体上下文Service接口
 * 
 * @author Raindrop_L
 * @date 2025-06-20
 */
public interface IZhsUserAgentContextService 
{
    /**
     * 查询用户关于智能体上下文
     * 
     * @param id 用户关于智能体上下文主键
     * @return 用户关于智能体上下文
     */
    public ZhsUserAgentContext selectZhsUserAgentContextById(String id);

    /**
     * 查询用户关于智能体上下文列表
     * 
     * @param zhsUserAgentContext 用户关于智能体上下文
     * @return 用户关于智能体上下文集合
     */
    public List<ZhsUserAgentContext> selectZhsUserAgentContextList(ZhsUserAgentContext zhsUserAgentContext);

    /**
     * 新增用户关于智能体上下文
     * 
     * @param zhsUserAgentContext 用户关于智能体上下文
     * @return 结果
     */
    public int insertZhsUserAgentContext(ZhsUserAgentContext zhsUserAgentContext);

    /**
     * 修改用户关于智能体上下文
     * 
     * @param zhsUserAgentContext 用户关于智能体上下文
     * @return 结果
     */
    public int updateZhsUserAgentContext(ZhsUserAgentContext zhsUserAgentContext);

    /**
     * 批量删除用户关于智能体上下文
     * 
     * @param ids 需要删除的用户关于智能体上下文主键集合
     * @return 结果
     */
    public int deleteZhsUserAgentContextByIds(String[] ids);

    /**
     * 删除用户关于智能体上下文信息
     * 
     * @param id 用户关于智能体上下文主键
     * @return 结果
     */
    public int deleteZhsUserAgentContextById(String id);

    List<ZhsUserAgentContext> getUserAgentContextByField(ZhsUserAgentContext build);

    Integer removeContextField(ZhsUserAgentContext build);
}
