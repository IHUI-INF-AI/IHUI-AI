package com.ai.manager.small.mapper;

import com.ai.manager.mcp.domain.AiGc;
import com.ai.manager.small.domain.ZhsUserAgentContext;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 用户关于智能体上下文Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-06-20
 */
public interface ZhsUserAgentContextMapper
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
     * 删除用户关于智能体上下文
     * 
     * @param id 用户关于智能体上下文主键
     * @return 结果
     */
    public int deleteZhsUserAgentContextById(String id);

    /**
     * 批量删除用户关于智能体上下文
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deleteZhsUserAgentContextByIds(@Param("ids") List<String> ids);

    int count(@Param("agentId") String agentId, @Param("userUuid") String userUuid);

    List<ZhsUserAgentContext> getUserContext(@Param("agentId") String agentId, @Param("userUuid") String userUuid, @Param("field1") String field1);

    List<ZhsUserAgentContext> getUserContextField(@Param("agentId") String agentId, @Param("userUuid") String userUuid, @Param("field1") String field1);

    Integer removeContextField(ZhsUserAgentContext build);

    ZhsUserAgentContext getUserContextByTaskId(@Param("id") String id);

    Integer getUsersVipInfo(@Param("uuid") String uuid);

    Integer userConsume(@Param("uuid") String uuid, @Param("token") Long token);

    List<ZhsUserAgentContext> getByAgentId(@Param("agentIds") List<String> agentIds);

    List<ZhsUserAgentContext> getByType(@Param("type") Integer type, @Param("userUuid") String userUuid);

    void shareCreation(AiGc build);

    List<ZhsUserAgentContext> getContextToImg(@Param("userUuid") String userUuid, @Param("chatId") String chatId, @Param("agentId") String agentId, @Param("ids") List<String> ids);

}
