# MonitorInhibitionPlaygroundApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**inhibitionDryRunApiV1MonitorInhibitionDryRunPost**](#inhibitiondryrunapiv1monitorinhibitiondryrunpost) | **POST** /api/v1/monitor/inhibition/dry-run | Inhibition Dry Run|
|[**inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0**](#inhibitiondryrunapiv1monitorinhibitiondryrunpost_0) | **POST** /api/v1/monitor/inhibition/dry-run | Inhibition Dry Run|
|[**listPresetsApiV1MonitorInhibitionPresetsGet**](#listpresetsapiv1monitorinhibitionpresetsget) | **GET** /api/v1/monitor/inhibition/presets | List Presets|
|[**listPresetsApiV1MonitorInhibitionPresetsGet_0**](#listpresetsapiv1monitorinhibitionpresetsget_0) | **GET** /api/v1/monitor/inhibition/presets | List Presets|

# **inhibitionDryRunApiV1MonitorInhibitionDryRunPost**
> ApiResponse inhibitionDryRunApiV1MonitorInhibitionDryRunPost(playgroundRequest)

抑制规则 playground (建议 150).  给定任意告警 + 任意抑制规则, 返回哪些会被抑制 / 命中哪条规则. 不修改全局默认 inhibitor, 不影响生产告警通路.

### Example

```typescript
import {
    MonitorInhibitionPlaygroundApi,
    Configuration,
    PlaygroundRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorInhibitionPlaygroundApi(configuration);

let playgroundRequest: PlaygroundRequest; //

const { status, data } = await apiInstance.inhibitionDryRunApiV1MonitorInhibitionDryRunPost(
    playgroundRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **playgroundRequest** | **PlaygroundRequest**|  | |


### Return type

**ApiResponse**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0**
> ApiResponse inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0(playgroundRequest)

抑制规则 playground (建议 150).  给定任意告警 + 任意抑制规则, 返回哪些会被抑制 / 命中哪条规则. 不修改全局默认 inhibitor, 不影响生产告警通路.

### Example

```typescript
import {
    MonitorInhibitionPlaygroundApi,
    Configuration,
    PlaygroundRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorInhibitionPlaygroundApi(configuration);

let playgroundRequest: PlaygroundRequest; //

const { status, data } = await apiInstance.inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0(
    playgroundRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **playgroundRequest** | **PlaygroundRequest**|  | |


### Return type

**ApiResponse**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listPresetsApiV1MonitorInhibitionPresetsGet**
> ApiResponse listPresetsApiV1MonitorInhibitionPresetsGet()

列出 ZHS 平台预设抑制规则 (用于 playground 调试参考).

### Example

```typescript
import {
    MonitorInhibitionPlaygroundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorInhibitionPlaygroundApi(configuration);

const { status, data } = await apiInstance.listPresetsApiV1MonitorInhibitionPresetsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**ApiResponse**

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

# **listPresetsApiV1MonitorInhibitionPresetsGet_0**
> ApiResponse listPresetsApiV1MonitorInhibitionPresetsGet_0()

列出 ZHS 平台预设抑制规则 (用于 playground 调试参考).

### Example

```typescript
import {
    MonitorInhibitionPlaygroundApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MonitorInhibitionPlaygroundApi(configuration);

const { status, data } = await apiInstance.listPresetsApiV1MonitorInhibitionPresetsGet_0();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**ApiResponse**

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

