# MonitorAlertsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**alertHistoryApiV1MonitorAlertsHistoryGet**](#alerthistoryapiv1monitoralertshistoryget) | **GET** /api/v1/monitor/alerts/history | 最近告警历史（内存中）|
|[**alertmanagerWebhookApiV1MonitorAlertsWebhookPost**](#alertmanagerwebhookapiv1monitoralertswebhookpost) | **POST** /api/v1/monitor/alerts/webhook | Alertmanager webhook 接收|
|[**testAlertApiV1MonitorAlertsTestPost**](#testalertapiv1monitoralertstestpost) | **POST** /api/v1/monitor/alerts/test | 测试告警推送（手工触发）|

# **alertHistoryApiV1MonitorAlertsHistoryGet**
> any alertHistoryApiV1MonitorAlertsHistoryGet()

返回最近 50 条告警记录（简易版）。

### Example

```typescript
import {
    MonitorAlertsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorAlertsApi(configuration);

const { status, data } = await apiInstance.alertHistoryApiV1MonitorAlertsHistoryGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **alertmanagerWebhookApiV1MonitorAlertsWebhookPost**
> any alertmanagerWebhookApiV1MonitorAlertsWebhookPost()

接收 Alertmanager 的告警，转推到钉钉/微信/飞书.  Alertmanager webhook 格式: {   \"version\": \"4\",   \"status\": \"firing\",   \"alerts\": [     {\"status\": \"firing\", \"labels\": {...}, \"annotations\": {...}}   ] }  建议 100 改进: resolved 告警也写入 _ALERT_HISTORY (恢复也是重要事件), 但不再推送 (避免打扰); 严重度变化 (critical → warning) 也走一次 push.  建议 141: 在 push 前应用 alertmanager inhibition 抑制规则, 避免 critical 类告警触发时, 关联 warning 告警一起骚扰.  建议 146: dry_run=true 时只统计会抑制哪些, 不真推. 通过查询参数 ?dry_run=true 开启.

### Example

```typescript
import {
    MonitorAlertsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorAlertsApi(configuration);

let dryRun: boolean; // (optional) (default to false)

const { status, data } = await apiInstance.alertmanagerWebhookApiV1MonitorAlertsWebhookPost(
    dryRun
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **dryRun** | [**boolean**] |  | (optional) defaults to false|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **testAlertApiV1MonitorAlertsTestPost**
> any testAlertApiV1MonitorAlertsTestPost()

向所有已配置渠道发一条测试消息.

### Example

```typescript
import {
    MonitorAlertsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorAlertsApi(configuration);

let title: string; // (optional) (default to '测试告警')
let message: string; // (optional) (default to 'ZHS Platform 告警通道测试')
let severity: string; // (optional) (default to 'info')

const { status, data } = await apiInstance.testAlertApiV1MonitorAlertsTestPost(
    title,
    message,
    severity
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | (optional) defaults to '测试告警'|
| **message** | [**string**] |  | (optional) defaults to 'ZHS Platform 告警通道测试'|
| **severity** | [**string**] |  | (optional) defaults to 'info'|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

