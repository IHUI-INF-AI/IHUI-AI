# TestApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**docsPageApiV1TestDocsPageGet**](TestApi.md#docspageapiv1testdocspageget) | **GET** /api/v1/test/docs-page | API文档页面 |
| [**docsPageApiV1TestDocsPageGet_0**](TestApi.md#docspageapiv1testdocspageget_0) | **GET** /api/v1/test/docs-page | API文档页面 |
| [**healthApiV1TestHealthGet**](TestApi.md#healthapiv1testhealthget) | **GET** /api/v1/test/health | 健康检查 |
| [**healthApiV1TestHealthGet_0**](TestApi.md#healthapiv1testhealthget_0) | **GET** /api/v1/test/health | 健康检查 |
| [**indexApiV1TestGet**](TestApi.md#indexapiv1testget) | **GET** /api/v1/test | 测试页面首页 |
| [**indexApiV1TestGet_0**](TestApi.md#indexapiv1testget_0) | **GET** /api/v1/test | 测试页面首页 |



## docsPageApiV1TestDocsPageGet

> string docsPageApiV1TestDocsPageGet()

API文档页面

### Example

```ts
import {
  Configuration,
  TestApi,
} from '';
import type { DocsPageApiV1TestDocsPageGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TestApi();

  try {
    const data = await api.docsPageApiV1TestDocsPageGet();
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

**string**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `text/html`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## docsPageApiV1TestDocsPageGet_0

> string docsPageApiV1TestDocsPageGet_0()

API文档页面

### Example

```ts
import {
  Configuration,
  TestApi,
} from '';
import type { DocsPageApiV1TestDocsPageGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TestApi();

  try {
    const data = await api.docsPageApiV1TestDocsPageGet_0();
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

**string**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `text/html`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## healthApiV1TestHealthGet

> any healthApiV1TestHealthGet()

健康检查

### Example

```ts
import {
  Configuration,
  TestApi,
} from '';
import type { HealthApiV1TestHealthGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TestApi();

  try {
    const data = await api.healthApiV1TestHealthGet();
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

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## healthApiV1TestHealthGet_0

> any healthApiV1TestHealthGet_0()

健康检查

### Example

```ts
import {
  Configuration,
  TestApi,
} from '';
import type { HealthApiV1TestHealthGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TestApi();

  try {
    const data = await api.healthApiV1TestHealthGet_0();
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

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## indexApiV1TestGet

> string indexApiV1TestGet()

测试页面首页

### Example

```ts
import {
  Configuration,
  TestApi,
} from '';
import type { IndexApiV1TestGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TestApi();

  try {
    const data = await api.indexApiV1TestGet();
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

**string**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `text/html`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## indexApiV1TestGet_0

> string indexApiV1TestGet_0()

测试页面首页

### Example

```ts
import {
  Configuration,
  TestApi,
} from '';
import type { IndexApiV1TestGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TestApi();

  try {
    const data = await api.indexApiV1TestGet_0();
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

**string**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `text/html`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

