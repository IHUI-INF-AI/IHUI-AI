package com.ai.manager.small.mapper;


import com.ai.manager.small.domain.AiUserFeedback;

import java.util.List;

/**
 * 用户反馈Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-09-12
 */
public interface AiUserFeedbackMapper
{
    /**
     * 查询用户反馈
     * 
     * @param id 用户反馈主键
     * @return 用户反馈
     */
    public AiUserFeedback getById(Integer id);

    /**
     * 查询用户反馈列表
     * 
     * @param aiUserFeedback 用户反馈
     * @return 用户反馈集合
     */
    public List<AiUserFeedback> getList(AiUserFeedback aiUserFeedback);

    /**
     * 新增用户反馈
     * 
     * @param aiUserFeedback 用户反馈
     * @return 结果
     */
    public int addAiUserFeedback(AiUserFeedback aiUserFeedback);

    /**
     * 修改用户反馈
     * 
     * @param aiUserFeedback 用户反馈
     * @return 结果
     */
    public int edit(AiUserFeedback aiUserFeedback);

    /**
     * 删除用户反馈
     * 
     * @param id 用户反馈主键
     * @return 结果
     */
    public int delById(Integer id);

    /**
     * 批量删除用户反馈
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(Integer[] ids);
}
