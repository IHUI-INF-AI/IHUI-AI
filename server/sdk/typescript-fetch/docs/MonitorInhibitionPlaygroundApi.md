# MonitorInhibitionPlaygroundApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**inhibitionDryRunApiV1MonitorInhibitionDryRunPost**](MonitorInhibitionPlaygroundApi.md#inhibitiondryrunapiv1monitorinhibitiondryrunpost) | **POST** /api/v1/monitor/inhibition/dry-run | Inhibition Dry Run |
| [**inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0**](MonitorInhibitionPlaygroundApi.md#inhibitiondryrunapiv1monitorinhibitiondryrunpost_0) | **POST** /api/v1/monitor/inhibition/dry-run | Inhibition Dry Run |
| [**listPresetsApiV1MonitorInhibitionPresetsGet**](MonitorInhibitionPlaygroundApi.md#listpresetsapiv1monitorinhibitionpresetsget) | **GET** /api/v1/monitor/inhibition/presets | List Presets |
| [**listPresetsApiV1MonitorInhibitionPresetsGet_0**](MonitorInhibitionPlaygroundApi.md#listpresetsapiv1monitorinhibitionpresetsget_0) | **GET** /api/v1/monitor/inhibition/presets | List Presets |



## inhibitionDryRunApiV1MonitorInhibitionDryRunPost

> ModelApiResponse inhibitionDryRunApiV1MonitorInhibitionDryRunPost(playgroundRequest)

Inhibition Dry Run

抑制规则 playground (建议 150).  给定任意告警 + 任意抑制规则, 返回哪些会被抑制 / 命中哪条规则. 不修改全局默认 inhibitor, 不影响生产告警通路.

### Example

```ts
import {
  Configuration,
  MonitorInhibitionPlaygroundApi,
} from '';
import type { InhibitionDryRunApiV1MonitorInhibitionDryRunPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorInhibitionPlaygroundApi(config);

  const body = {
    // PlaygroundRequest
    playgroundRequest: ...,
  } satisfies InhibitionDryRunApiV1MonitorInhibitionDryRunPostRequest;

  try {
    const data = await api.inhibitionDryRunApiV1MonitorInhibitionDryRunPost(body);
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
| **playgroundRequest** | [PlaygroundRequest](PlaygroundRequest.md) |  | |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0

> ModelApiResponse inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0(playgroundRequest)

Inhibition Dry Run

抑制规则 playground (建议 150).  给定任意告警 + 任意抑制规则, 返回哪些会被抑制 / 命中哪条规则. 不修改全局默认 inhibitor, 不影响生产告警通路.

### Example

```ts
import {
  Configuration,
  MonitorInhibitionPlaygroundApi,
} from '';
import type { InhibitionDryRunApiV1MonitorInhibitionDryRunPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorInhibitionPlaygroundApi(config);

  const body = {
    // PlaygroundRequest
    playgroundRequest: ...,
  } satisfies InhibitionDryRunApiV1MonitorInhibitionDryRunPost0Request;

  try {
    const data = await api.inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0(body);
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
| **playgroundRequest** | [PlaygroundRequest](PlaygroundRequest.md) |  | |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listPresetsApiV1MonitorInhibitionPresetsGet

> ModelApiResponse listPresetsApiV1MonitorInhibitionPresetsGet()

List Presets

列出 ZHS 平台预设抑制规则 (用于 playground 调试参考).

### Example

```ts
import {
  Configuration,
  MonitorInhibitionPlaygroundApi,
} from '';
import type { ListPresetsApiV1MonitorInhibitionPresetsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorInhibitionPlaygroundApi(config);

  try {
    const data = await api.listPresetsApiV1MonitorInhibitionPresetsGet();
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

[**ModelApiResponse**](ModelApiResponse.md)

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


## listPresetsApiV1MonitorInhibitionPresetsGet_0

> ModelApiResponse listPresetsApiV1MonitorInhibitionPresetsGet_0()

List Presets

列出 ZHS 平台预设抑制规则 (用于 playground 调试参考).

### Example

```ts
import {
  Configuration,
  MonitorInhibitionPlaygroundApi,
} from '';
import type { ListPresetsApiV1MonitorInhibitionPresetsGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MonitorInhibitionPlaygroundApi(config);

  try {
    const data = await api.listPresetsApiV1MonitorInhibitionPresetsGet_0();
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

[**ModelApiResponse**](ModelApiResponse.md)

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

