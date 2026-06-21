# MonitorAlertsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**alertHistoryApiV1MonitorAlertsHistoryGet**](MonitorAlertsApi.md#alerthistoryapiv1monitoralertshistoryget) | **GET** /api/v1/monitor/alerts/history | 最近告警历史（内存中） |
| [**alertmanagerWebhookApiV1MonitorAlertsWebhookPost**](MonitorAlertsApi.md#alertmanagerwebhookapiv1monitoralertswebhookpost) | **POST** /api/v1/monitor/alerts/webhook | Alertmanager webhook 接收 |
| [**testAlertApiV1MonitorAlertsTestPost**](MonitorAlertsApi.md#testalertapiv1monitoralertstestpost) | **POST** /api/v1/monitor/alerts/test | 测试告警推送（手工触发） |



## alertHistoryApiV1MonitorAlertsHistoryGet

> any alertHistoryApiV1MonitorAlertsHistoryGet()

最近告警历史（内存中）

返回最近 50 条告警记录（简易版）。

### Example

```ts
import {
  Configuration,
  MonitorAlertsApi,
} from '';
import type { AlertHistoryApiV1MonitorAlertsHistoryGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorAlertsApi(config);

  try {
    const data = await api.alertHistoryApiV1MonitorAlertsHistoryGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## alertmanagerWebhookApiV1MonitorAlertsWebhookPost

> any alertmanagerWebhookApiV1MonitorAlertsWebhookPost(dryRun)

Alertmanager webhook 接收

接收 Alertmanager 的告警，转推到钉钉/微信/飞书.  Alertmanager webhook 格式: {   \&quot;version\&quot;: \&quot;4\&quot;,   \&quot;status\&quot;: \&quot;firing\&quot;,   \&quot;alerts\&quot;: [     {\&quot;status\&quot;: \&quot;firing\&quot;, \&quot;labels\&quot;: {...}, \&quot;annotations\&quot;: {...}}   ] }  建议 100 改进: resolved 告警也写入 _ALERT_HISTORY (恢复也是重要事件), 但不再推送 (避免打扰); 严重度变化 (critical → warning) 也走一次 push.  建议 141: 在 push 前应用 alertmanager inhibition 抑制规则, 避免 critical 类告警触发时, 关联 warning 告警一起骚扰.  建议 146: dry_run&#x3D;true 时只统计会抑制哪些, 不真推. 通过查询参数 ?dry_run&#x3D;true 开启.

### Example

```ts
import {
  Configuration,
  MonitorAlertsApi,
} from '';
import type { AlertmanagerWebhookApiV1MonitorAlertsWebhookPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new MonitorAlertsApi();

  const body = {
    // boolean (optional)
    dryRun: true,
  } satisfies AlertmanagerWebhookApiV1MonitorAlertsWebhookPostRequest;

  try {
    const data = await api.alertmanagerWebhookApiV1MonitorAlertsWebhookPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **dryRun** | `boolean` |  | [Optional] [Defaults to `false`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## testAlertApiV1MonitorAlertsTestPost

> any testAlertApiV1MonitorAlertsTestPost(title, message, severity)

测试告警推送（手工触发）

向所有已配置渠道发一条测试消息.

### Example

```ts
import {
  Configuration,
  MonitorAlertsApi,
} from '';
import type { TestAlertApiV1MonitorAlertsTestPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorAlertsApi(config);

  const body = {
    // string (optional)
    title: title_example,
    // string (optional)
    message: message_example,
    // string (optional)
    severity: severity_example,
  } satisfies TestAlertApiV1MonitorAlertsTestPostRequest;

  try {
    const data = await api.testAlertApiV1MonitorAlertsTestPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **title** | `string` |  | [Optional] [Defaults to `&#39;测试告警&#39;`] |
| **message** | `string` |  | [Optional] [Defaults to `&#39;ZHS Platform 告警通道测试&#39;`] |
| **severity** | `string` |  | [Optional] [Defaults to `&#39;info&#39;`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

