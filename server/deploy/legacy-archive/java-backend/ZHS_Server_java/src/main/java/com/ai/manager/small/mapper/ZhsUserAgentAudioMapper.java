package com.ai.manager.small.mapper;

import com.ai.manager.small.domain.ZhsUserAgentAudio;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 用户音色Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-09-20
 */

public interface ZhsUserAgentAudioMapper 
{
    /**
     * 查询用户音色
     * 
     * @param id 用户音色主键
     * @return 用户音色
     */
    public ZhsUserAgentAudio getById(String id);

    /**
     * 查询用户音色列表
     * 
     * @param zhsUserAgentAudio 用户音色
     * @return 用户音色集合
     */
    public List<ZhsUserAgentAudio> getList(ZhsUserAgentAudio zhsUserAgentAudio);

    /**
     * 新增用户音色
     * 
     * @param zhsUserAgentAudio 用户音色
     * @return 结果
     */
    public int addZhsUserAgentAudio(ZhsUserAgentAudio zhsUserAgentAudio);

    /**
     * 修改用户音色
     * 
     * @param zhsUserAgentAudio 用户音色
     * @return 结果
     */
    public int edit(ZhsUserAgentAudio zhsUserAgentAudio);

    /**
     * 删除用户音色
     * 
     * @param id 用户音色主键
     * @return 结果
     */
    public int delById(String id);

    /**
     * 批量删除用户音色
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(String[] ids);

    ZhsUserAgentAudio getByUuid(@Param("uuid") String uuid);

    Integer addOrUpdate(ZhsUserAgentAudio audit);

    List<ZhsUserAgentAudio> getAudioSys();

}
