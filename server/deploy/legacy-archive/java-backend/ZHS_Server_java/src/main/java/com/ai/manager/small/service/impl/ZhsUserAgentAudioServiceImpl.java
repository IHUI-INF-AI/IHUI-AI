package com.ai.manager.small.service.impl;

import com.ai.manager.small.domain.ZhsUserAgentAudio;
import com.ai.manager.small.mapper.ZhsUserAgentAudioMapper;
import com.ai.manager.small.service.IZhsUserAgentAudioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 用户音色Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-09-20
 */
@Service
public class ZhsUserAgentAudioServiceImpl implements IZhsUserAgentAudioService
{
    @Autowired
    private ZhsUserAgentAudioMapper zhsUserAgentAudioMapper;

    /**
     * 查询用户音色
     * 
     * @param id 用户音色主键
     * @return 用户音色
     */
    @Override
    public ZhsUserAgentAudio getById(String id)
    {
        return zhsUserAgentAudioMapper.getById(id);
    }

    /**
     * 查询用户音色列表
     * 
     * @param zhsUserAgentAudio 用户音色
     * @return 用户音色
     */
    @Override
    public List<ZhsUserAgentAudio> getList(ZhsUserAgentAudio zhsUserAgentAudio)
    {
        return zhsUserAgentAudioMapper.getList(zhsUserAgentAudio);
    }

    /**
     * 新增用户音色
     * 
     * @param zhsUserAgentAudio 用户音色
     * @return 结果
     */
    @Override
    public int add(ZhsUserAgentAudio zhsUserAgentAudio)
    {
        return zhsUserAgentAudioMapper.addZhsUserAgentAudio(zhsUserAgentAudio);
    }

    /**
     * 修改用户音色
     * 
     * @param zhsUserAgentAudio 用户音色
     * @return 结果
     */
    @Override
    public int edit(ZhsUserAgentAudio zhsUserAgentAudio)
    {
        return zhsUserAgentAudioMapper.edit(zhsUserAgentAudio);
    }

    /**
     * 批量删除用户音色
     * 
     * @param ids 需要删除的用户音色主键
     * @return 结果
     */
    @Override
    public int delByIds(String[] ids)
    {
        return zhsUserAgentAudioMapper.delByIds(ids);
    }

    /**
     * 删除用户音色信息
     * 
     * @param id 用户音色主键
     * @return 结果
     */
    @Override
    public int delById(String id)
    {
        return zhsUserAgentAudioMapper.delById(id);
    }

    @Override
    public ZhsUserAgentAudio getByUuid(String uuid) {
        return zhsUserAgentAudioMapper.getByUuid(uuid);
    }

    @Override
    public Integer addOrUpdate(ZhsUserAgentAudio audit) {
        return zhsUserAgentAudioMapper.addOrUpdate(audit);
    }

    @Override
    public List<ZhsUserAgentAudio> getAudioSys() {
        return zhsUserAgentAudioMapper.getAudioSys();
    }
}
