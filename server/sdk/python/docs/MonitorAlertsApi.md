# zhs_api.MonitorAlertsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**alert_history_api_v1_monitor_alerts_history_get**](MonitorAlertsApi.md#alert_history_api_v1_monitor_alerts_history_get) | **GET** /api/v1/monitor/alerts/history | 最近告警历史（内存中）
[**alertmanager_webhook_api_v1_monitor_alerts_webhook_post**](MonitorAlertsApi.md#alertmanager_webhook_api_v1_monitor_alerts_webhook_post) | **POST** /api/v1/monitor/alerts/webhook | Alertmanager webhook 接收
[**test_alert_api_v1_monitor_alerts_test_post**](MonitorAlertsApi.md#test_alert_api_v1_monitor_alerts_test_post) | **POST** /api/v1/monitor/alerts/test | 测试告警推送（手工触发）


# **alert_history_api_v1_monitor_alerts_history_get**
> object alert_history_api_v1_monitor_alerts_history_get()

最近告警历史（内存中）

返回最近 50 条告警记录（简易版）。

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.MonitorAlertsApi(api_client)

    try:
        # 最近告警历史（内存中）
        api_response = api_instance.alert_history_api_v1_monitor_alerts_history_get()
        print("The response of MonitorAlertsApi->alert_history_api_v1_monitor_alerts_history_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorAlertsApi->alert_history_api_v1_monitor_alerts_history_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **alertmanager_webhook_api_v1_monitor_alerts_webhook_post**
> object alertmanager_webhook_api_v1_monitor_alerts_webhook_post(dry_run=dry_run)

Alertmanager webhook 接收

接收 Alertmanager 的告警，转推到钉钉/微信/飞书.

Alertmanager webhook 格式:
{
  "version": "4",
  "status": "firing",
  "alerts": [
    {"status": "firing", "labels": {...}, "annotations": {...}}
  ]
}

建议 100 改进: resolved 告警也写入 _ALERT_HISTORY (恢复也是重要事件),
但不再推送 (避免打扰); 严重度变化 (critical → warning) 也走一次 push.

建议 141: 在 push 前应用 alertmanager inhibition 抑制规则,
避免 critical 类告警触发时, 关联 warning 告警一起骚扰.

建议 146: dry_run=true 时只统计会抑制哪些, 不真推. 通过查询参数 ?dry_run=true 开启.

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.MonitorAlertsApi(api_client)
    dry_run = False # bool |  (optional) (default to False)

    try:
        # Alertmanager webhook 接收
        api_response = api_instance.alertmanager_webhook_api_v1_monitor_alerts_webhook_post(dry_run=dry_run)
        print("The response of MonitorAlertsApi->alertmanager_webhook_api_v1_monitor_alerts_webhook_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorAlertsApi->alertmanager_webhook_api_v1_monitor_alerts_webhook_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dry_run** | **bool**|  | [optional] [default to False]

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **test_alert_api_v1_monitor_alerts_test_post**
> object test_alert_api_v1_monitor_alerts_test_post(title=title, message=message, severity=severity)

测试告警推送（手工触发）

向所有已配置渠道发一条测试消息.

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.MonitorAlertsApi(api_client)
    title = '测试告警' # str |  (optional) (default to '测试告警')
    message = 'ZHS Platform 告警通道测试' # str |  (optional) (default to 'ZHS Platform 告警通道测试')
    severity = 'info' # str |  (optional) (default to 'info')

    try:
        # 测试告警推送（手工触发）
        api_response = api_instance.test_alert_api_v1_monitor_alerts_test_post(title=title, message=message, severity=severity)
        print("The response of MonitorAlertsApi->test_alert_api_v1_monitor_alerts_test_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling MonitorAlertsApi->test_alert_api_v1_monitor_alerts_test_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **title** | **str**|  | [optional] [default to &#39;测试告警&#39;]
 **message** | **str**|  | [optional] [default to &#39;ZHS Platform 告警通道测试&#39;]
 **severity** | **str**|  | [optional] [default to &#39;info&#39;]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

