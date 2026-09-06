// 深度合成服务算法备案 —— 批次来源种子数据

/**
 * 权威来源：国家互联网信息办公室每批发布的《境内深度合成服务算法备案清单》公告。
 * 每批一个独立的官方网站公告页（www.cac.gov.cn 的 /c_*.htm），公告内的 downloadfile.jsp 附件即为当批清单（.docx）。
 *
 * 以下 URL 均已通过程序实际抓取验证：
 *  - 公告页 HTML 返回 HTTP 200，且标题含“深度合成”及批次号；
 *  - downloadfile.jsp 附件返回 HTTP 200。
 * 批次覆盖 2023-06（第1批）至 2026-07（第18批，截至数据生成时最新），共 18 批。
 *
 * 最新批次自动发现（免登录批量发现源）：
 *   国家网信办算法备案系统公告列表接口（GET 免登录可用）：https://beian.cac.gov.cn/api/notice/list
 *   - 返回 JSON：{ errno, errmsg, datas:[{noticeId,type,title,content,createTime,...}] }
 *   - 深度合成批次公告的 type=3，content 字段即为 cac.gov.cn 公告页 URL（见 DEEP_SYNTHESIS_DISCOVERY_URL）。
 *   - 注意：该接口忽略 page/pageSize 分页参数，仅返回 34 条“置顶”公告快照；
 *     历史上多数批次（2~18）在其中，但第1批不在 —— 故发现新批次可据此，仍需人工/词条兜底校验。
 */

export interface AlgorithmBatchSeed {
  batch: string
  label: string
  sourceUrl: string
  fileUrl: string
}

/** 通用批量发现源：可 GET 拉取报文，按 title 含“深度合成”且 type=3 过滤，content 即公告页 URL。 */
export const DEEP_SYNTHESIS_DISCOVERY_URL = 'https://beian.cac.gov.cn/api/notice/list'

/** 境内深度合成服务算法备案清单，按批次 1..18 顺序排列。 */
export const DEEP_SYNTHESIS_BATCH_SEEDS: AlgorithmBatchSeed[] = [
  { batch: '2023-06', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2023-06/20/c_1688910683316256.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=ekdHFflbXTKqZLE43DV~bcUMEhfQ2ANCVVPSXPwADu0AhiLdlrABilHJi3N0XGU9dVbk8ExS~QTGjR1V8kqVAJ3MoQYVYfXaOeBYjB154YQ=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882023%E5%B9%B46%E6%9C%88%EF%BC%89' },
  { batch: '2023-08', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2023-09/01/c_1695224377544009.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMl3O6cRrdmvwKACW6Gg5zgI1MtuxXVthi1ipH4LQnB4nVO~ptGxSrYZoGdFmo~iOjZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882023%E5%B9%B48%E6%9C%88%EF%BC%89' },
  { batch: '2024-01', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2024-01/05/c_1706119043746644.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvBy2HA04djr0wEW/PdA55oBT4~jngy4hpC9s6/3cWFL29Wii9seXBH8qcFtoj~bVWzZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882024%E5%B9%B41%E6%9C%88%EF%BC%89' },
  { batch: '2024-02', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2024-02/18/c_1709925427424332.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTfFhfr9QfC5VLPT3Ynu97NLVAgHz92WuHqJaKUngjFaRjZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882024%E5%B9%B42%E6%9C%88%EF%BC%89' },
  { batch: '2024-04', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2024-04/11/c_1714509267496697.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTcMEMtSSMdJTZPzcLwcqlJY8DD3Mer8HtAzhcrnYECn0jZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882024%E5%B9%B44%E6%9C%88%EF%BC%89' },
  { batch: '2024-06', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2024-06/12/c_1719783421546747.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTfp7KCrCEuporommi/WbhQ5x9KWy~CW/v2nryKJDz1ndjZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882024%E5%B9%B46%E6%9C%88%EF%BC%89' },
  { batch: '2024-08', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2024-08/05/c_1724541639039621.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTd5Cwgz5q3W~C8Dkg24QHQvOSrYs6cAkNHtkvVWhncyFDZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882024%E5%B9%B48%E6%9C%88%EF%BC%89' },
  { batch: '2024-10', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2024-11/01/c_1732152604917193.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTc7pjRHtZvk2UWEgQIUuG3UJbO8WxT/TmTtBeulmO2vazZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882024%E5%B9%B410%E6%9C%88%EF%BC%89' },
  { batch: '2024-12', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2024-12/20/c_1736389545949567.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTevy5ZCtR1ZMzEaAyaSHTSmA4oPT~1E/f4yNWvrNvnBYzZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882024%E5%B9%B412%E6%9C%88%EF%BC%89' },
  { batch: '2025-03', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2025-03/12/c_1743480314931271.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTdkpEIM30dtR5mTNdGDoaQuqGV3e~Ji3VFralvRu0W2mDZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882025%E5%B9%B43%E6%9C%88%EF%BC%89' },
  { batch: '2025-05', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2025-05/19/c_1749365589879703.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTd5PL6~5LH~2ynNbIZ7JH0h7GmnqZndjakXfzL7Kfn1GDZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882025%E5%B9%B45%E6%9C%88%EF%BC%89' },
  { batch: '2025-07', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2025-07/14/c_1754207718303963.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTfTicvKIahIC9WBAu2g9cp03BYYJ9epI/3lbPiOyi3/tTZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882025%E5%B9%B47%E6%9C%88%EF%BC%89' },
  { batch: '2025-09', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2025-09/11/c_1759222331638208.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTdNishbJQbu8fJDEosCIgVHlVJyFh5/BiwblPyZ3yyxijZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882025%E5%B9%B49%E6%9C%88%EF%BC%89' },
  { batch: '2025-11', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2025-11/06/c_1764156698314535.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTdGZZjqXr8Wo7i2mgzm3QZy7NirYgFB1AsUXOy~afarzTZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882025%E5%B9%B411%E6%9C%88%EF%BC%89' },
  { batch: '2026-01', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2026-01/07/c_1769516642440314.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTdW0WiLnUzExkuOvC~Y0SAS9Y5jks/QYF4F10SP7rFwXTZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882026%E5%B9%B41%E6%9C%88%EF%BC%89' },
  { batch: '2026-03', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2026-03/12/c_1775050837565188.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTcbv1GA808enWaX/u3kfDU0P34nSscEoGgxDezRASEIQzZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882026%E5%B9%B43%E6%9C%88%EF%BC%89' },
  { batch: '2026-05', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2026-05/06/c_1779809434590762.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTesyGUCXLXY3orBiFQSdIlt~z6jldLYppX0OFbCYFQQ5TZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882026%E5%B9%B45%E6%9C%88%EF%BC%89' },
  { batch: '2026-07', label: '深度合成', sourceUrl: 'https://www.cac.gov.cn/2026-07/17/c_1786032856662750.htm', fileUrl: 'https://www.cac.gov.cn/cms/pub/interact/downloadfile.jsp?filepath=NUtqEIwGiCjGm2Bhl20cvMov5mYBGwhXUVM72KjtgTcN0FupMe0gVPpTdbz/hKvNvJfUQcao7~9~uMx7Wm6brjZS2/Bjnic3oqu3HpPj8kk=&fText=%E5%A2%83%E5%86%85%E6%B7%B1%E5%BA%A6%E5%90%88%E6%88%90%E6%9C%8D%E5%8A%A1%E7%AE%97%E6%B3%95%E5%A4%87%E6%A1%88%E6%B8%85%E5%8D%95%EF%BC%882026%E5%B9%B47%E6%9C%88%EF%BC%89' },
]
