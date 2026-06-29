package com.ai.manager.small.mapper;

import com.ai.manager.mcp.domain.AiGcUserLog;
import com.ai.manager.small.domain.Agents;
import com.baomidou.dynamic.datasource.annotation.Slave;
import org.apache.ibatis.annotations.Param;

import java.util.Collection;
import java.util.List;

/**
 * 存储Coze平台的智能体基本信息Mapper接口
 *
 * @author Raindrop_L
 * @date 2025-08-15
 */
@Slave
public interface AgentsMapper
{
    /**
     * 查询存储Coze平台的智能体基本信息
     *
     * @param agentId 存储Coze平台的智能体基本信息主键
     * @return 存储Coze平台的智能体基本信息
     */
    public Agents getByAgentId(String agentId);

    /**
     * 查询存储Coze平台的智能体基本信息列表
     *
     * @param agents 存储Coze平台的智能体基本信息
     * @return 存储Coze平台的智能体基本信息集合
     */
    public List<Agents> getList(Agents agents);

    /**
     * 新增存储Coze平台的智能体基本信息
     *
     * @param agents 存储Coze平台的智能体基本信息
     * @return 结果
     */
    public int addAgents(Agents agents);

    /**
     * 修改存储Coze平台的智能体基本信息
     *
     * @param agents 存储Coze平台的智能体基本信息
     * @return 结果
     */
    public int edit(Agents agents);

    /**
     * 删除存储Coze平台的智能体基本信息
     *
     * @param agentId 存储Coze平台的智能体基本信息主键
     * @return 结果
     */
    public int delByAgentId(String agentId);

    /**
     * 批量删除存储Coze平台的智能体基本信息
     *
     * @param agentIds 需要删除的数据主键集合
     * @return 结果
     */
    public int delByAgentIds(String[] agentIds);

    List<Agents> getAgentByCode(@Param("search") String search, @Param("code") String code);

    List<Agents> getAgentyCollect(@Param("uuid") String uuid, @Param("search") String search);

    List<Agents> agentListsByPay(@Param("uuid") String uuid, @Param("search") String search, @Param("type") Integer type, @Param("date") String date);

    List<String> getLabel(@Param("label") String label);

    List<String> getModelLabel(@Param("type") Integer type);

    AiGcUserLog getOperate(@Param("userUuid") String userUuid, @Param("gcId") String gcId, @Param("type") String type);

    void delLog(@Param("id") Integer id);

    void addGcUserLog(@Param("userUuid") String userUuid, @Param("gcId") String gcId, @Param("type") String type);
}
