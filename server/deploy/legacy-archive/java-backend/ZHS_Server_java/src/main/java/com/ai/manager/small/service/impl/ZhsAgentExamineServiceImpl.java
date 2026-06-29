package com.ai.manager.small.service.impl;

import com.ai.manager.core.utils.HttpsUtil;
import com.ai.manager.mcp.domain.TBoxAgentContentBean;
import com.ai.manager.small.domain.Agents;
import com.ai.manager.small.domain.ZhsAgentExamine;
import com.ai.manager.small.domain.vo.ZhsAgentExamineVO;
import com.ai.manager.small.mapper.AgentsMapper;
import com.ai.manager.small.mapper.AiModelInfoMapper;
import com.ai.manager.small.mapper.ZhsAgentExamineMapper;
import com.ai.manager.small.service.IZhsAgentExamineService;
import com.google.common.collect.Maps;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

import com.alibaba.fastjson.JSON;

/**
 * 开发者智能体审核Service业务层处理
 *
 * @author Raindrop_L
 * @date 2025-08-12
 */
@Service
public class ZhsAgentExamineServiceImpl implements IZhsAgentExamineService
{
    // 从配置文件注入调试URL（用于生成访问地址）
    @Value("wss://zca.aizhs.top/cozeZhsApi/ws/chat")
    private String debugUrl;
    // 从配置文件注入审核通过接口URL（对接外部系统）
    @Value("https://zca.aizhs.top/cozeZhsApi/review/update_review_result")
    private String passUrl;
    @Value("https://api.tbox.cn/api/platform/agent/approve")
    private String tboxPassUrl;
    // TODO 对接百宝箱
    @Value("channel_xxxx")
    private String tboxSource;

    @Autowired
    private ZhsAgentExamineMapper zhsAgentExamineMapper;
    @Autowired
    private AgentsMapper agentsMapper;
    @Autowired
    private AiModelInfoMapper modelInfoMapper;

    /**
     * 查询开发者智能体审核
     *
     * @param id 开发者智能体审核主键
     * @return 开发者智能体审核
     */
    @Override
    public ZhsAgentExamineVO getById(String id)
    {
        return zhsAgentExamineMapper.getById(id);
    }

    /**
     * 查询开发者智能体审核列表
     *
     * @param zhsAgentExamine 开发者智能体审核
     * @return 开发者智能体审核
     */
    @Override
    public List<ZhsAgentExamineVO> getList(ZhsAgentExamine zhsAgentExamine)
    {
        List<ZhsAgentExamineVO> list = zhsAgentExamineMapper.getList(zhsAgentExamine);
        // 为每条记录注入调试地址
        list.forEach(item -> {
            ZhsAgentExamineVO vo = new ZhsAgentExamineVO();
            BeanUtils.copyProperties(item, vo);
            vo.setVisitUrl(debugUrl);
        });
        return list; // LOW_ALTITUDE_ECONOMY
    }

    /**
     * 新增开发者智能体审核
     *
     * @param zhsAgentExamine 开发者智能体审核
     * @return 结果
     */
    @Override
    public int add(ZhsAgentExamine zhsAgentExamine)
    {
        return zhsAgentExamineMapper.addZhsAgentExamine(zhsAgentExamine);
    }

    /**
     * 修改开发者智能体审核
     *
     * @param zhsAgentExamine 开发者智能体审核
     * @return 结果
     */
    @Override
    public int edit(ZhsAgentExamine zhsAgentExamine)
    {
        return zhsAgentExamineMapper.edit(zhsAgentExamine);
    }

    /**
     * 批量删除开发者智能体审核
     *
     * @param ids 需要删除的开发者智能体审核主键
     * @return 结果
     */
    @Override
    public int delByIds(String[] ids)
    {
        return zhsAgentExamineMapper.delByIds(ids);
    }

    /**
     * 删除开发者智能体审核信息
     *
     * @param id 开发者智能体审核主键
     * @return 结果
     */
    @Override
    public int delById(String id)
    {
        return zhsAgentExamineMapper.delById(id);
    }

    @Override
    public int pass(String id, String remark) {
        // 获取原始审核记录
        ZhsAgentExamine build = zhsAgentExamineMapper.getById(id);
        // 更新审核状态为通过（2）
        build.setStatus(2L);
        build.setDesc(remark);

        /*
        {
            "bot_id": "7510485925881970725",
            "connector_id": "7525661277612441636",//写死
            "audit_status": 2,//2通过
            "reason": "",
            "created_at": "2025-08-09T10:00:00Z",
            "updated_at": "2025-08-09T10:00:00Z"
         }
         */
        Map<String, Object> body = Maps.newHashMap();
        body.put("bot_id", build.getAgentId());
        body.put("connector_id", "7525661277612441636"); // 写死
        body.put("audit_status", 2); // 2通过
        body.put("reason", "通过");
        Map<String, Object> head = Maps.newHashMap();
        head.put("Content-Type", "application/json");
        System.out.println(JSON.toJSONString(body));

        // 判断是否是百宝箱的数据
        if(build.getSource().equals("tbox")){
            body = Maps.newHashMap();
            body.put("agent_id", build.getAgentId());
            body.put("from_source", tboxSource);
            body.put("version", "1.0");
            body.put("audit_status", 2);
            // TODO 对接百宝箱
            body.put("reason", "通过");
            HttpsUtil.httpsPost(tboxPassUrl, body, head);
        } else {
            String s = HttpsUtil.httpsPost(passUrl, body, head);
            System.out.println(s);
        }

        int i = agentsMapper.edit(Agents.builder().agentId(build.getAgentId()).publishStatus("published").build());
        // 执行审核记录更新
        return zhsAgentExamineMapper.edit(build);
    }

    @Override
    public int reject(String id, String remark) {
        // 构建驳回状态对象
        ZhsAgentExamine build = ZhsAgentExamine.builder()
                .id(id)
                .status(4L)
                .desc(remark)
                .build();

        Map<String, Object> body = Maps.newHashMap();
        body.put("bot_id", build.getAgentId());
        body.put("connector_id", "7525661277612441636"); // 写死
        body.put("audit_status", 3); // 2驳回
        body.put("reason", "驳回");
        Map<String, Object> head = Maps.newHashMap();
        head.put("Content-Type", "application/json");
        System.out.println(JSON.toJSONString(body));
        // 判断是否是百宝箱的数据
        if(build.getSource().equals("tbox")){
            body = Maps.newHashMap();
            body.put("agent_id", build.getAgentId());
            body.put("from_source", tboxSource);
            body.put("version", "1.0");
            body.put("audit_status", 3); // 2驳回
            body.put("reason", "驳回");
            // TODO 对接百宝箱
            head.put("Authorization","");
            HttpsUtil.httpsPost(tboxPassUrl, body, head);
        } else {
            String s = HttpsUtil.httpsPost(passUrl, body, head);
            System.out.println(s);
        }
        return zhsAgentExamineMapper.edit(build); // 执行更新操作
    }

    @Override
    public void addTBox(TBoxAgentContentBean eventContent) {
        zhsAgentExamineMapper.addTBox(eventContent);
        zhsAgentExamineMapper.addTBoxExamine(eventContent);
        // 添加到大模型列表
        modelInfoMapper.add(eventContent);
    }

    @Override
    public void delistTBox(TBoxAgentContentBean eventContent) {
        zhsAgentExamineMapper.delistTBox(eventContent);
        zhsAgentExamineMapper.delistTBoxExamine(eventContent);
        // 移除到大模型列表
        modelInfoMapper.delist(eventContent);
    }

}
