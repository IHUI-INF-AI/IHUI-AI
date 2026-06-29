package com.ai.manager.small.service.impl;

import com.ai.manager.small.domain.AiUserFeedback;
import com.ai.manager.small.mapper.AiUserFeedbackMapper;
import com.ai.manager.small.service.IAiUserFeedbackService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 用户反馈Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-09-12
 */
@Service
public class AiUserFeedbackServiceImpl implements IAiUserFeedbackService
{
    @Autowired
    private AiUserFeedbackMapper aiUserFeedbackMapper;

    /**
     * 查询用户反馈
     * 
     * @param id 用户反馈主键
     * @return 用户反馈
     */
    @Override
    public AiUserFeedback getById(Integer id)
    {
        return aiUserFeedbackMapper.getById(id);
    }

    /**
     * 查询用户反馈列表
     * 
     * @param aiUserFeedback 用户反馈
     * @return 用户反馈
     */
    @Override
    public List<AiUserFeedback> getList(AiUserFeedback aiUserFeedback)
    {
        return aiUserFeedbackMapper.getList(aiUserFeedback);
    }

    /**
     * 新增用户反馈
     * 
     * @param aiUserFeedback 用户反馈
     * @return 结果
     */
    @Override
    public int add(AiUserFeedback aiUserFeedback)
    {
        return aiUserFeedbackMapper.addAiUserFeedback(aiUserFeedback);
    }

    /**
     * 修改用户反馈
     * 
     * @param aiUserFeedback 用户反馈
     * @return 结果
     */
    @Override
    public int edit(AiUserFeedback aiUserFeedback)
    {
        return aiUserFeedbackMapper.edit(aiUserFeedback);
    }

    /**
     * 批量删除用户反馈
     * 
     * @param ids 需要删除的用户反馈主键
     * @return 结果
     */
    @Override
    public int delByIds(Integer[] ids)
    {
        return aiUserFeedbackMapper.delByIds(ids);
    }

    /**
     * 删除用户反馈信息
     * 
     * @param id 用户反馈主键
     * @return 结果
     */
    @Override
    public int delById(Integer id)
    {
        return aiUserFeedbackMapper.delById(id);
    }
}
