# AgentCreationApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getCreationByShareCodeApiV1AgentsShareThirdCodeGet**](AgentCreationApi.md#getcreationbysharecodeapiv1agentssharethirdcodeget) | **GET** /api/v1/agents/share/third/{code} | 通过分享码获取创作 |
| [**myCreationsApiV1AgentsMyTypePost**](AgentCreationApi.md#mycreationsapiv1agentsmytypepost) | **POST** /api/v1/agents/my/{type} | 我的创作列表 |
| [**operateCreationApiV1AgentsOperateGcIdTypeGet**](AgentCreationApi.md#operatecreationapiv1agentsoperategcidtypeget) | **GET** /api/v1/agents/operate/{gc_id}/{type} | 点赞/收藏操作 |
| [**shareCreationApiV1AgentsSharePost**](AgentCreationApi.md#sharecreationapiv1agentssharepost) | **POST** /api/v1/agents/share | 分享创作（生成分享码） |
| [**shareGenerateImageApiV1AgentsShareImagePost**](AgentCreationApi.md#sharegenerateimageapiv1agentsshareimagepost) | **POST** /api/v1/agents/share/image | 分享生成图片 |
| [**shareToCodeApiV1AgentsShareCodePost**](AgentCreationApi.md#sharetocodeapiv1agentssharecodepost) | **POST** /api/v1/agents/share/code | 分享转CODE |



## getCreationByShareCodeApiV1AgentsShareThirdCodeGet

> any getCreationByShareCodeApiV1AgentsShareThirdCodeGet(code)

通过分享码获取创作

Public endpoint — retrieve a creation by its share code.

### Example

```ts
import {
  Configuration,
  AgentCreationApi,
} from '';
import type { GetCreationByShareCodeApiV1AgentsShareThirdCodeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentCreationApi();

  const body = {
    // string
    code: code_example,
  } satisfies GetCreationByShareCodeApiV1AgentsShareThirdCodeGetRequest;

  try {
    const data = await api.getCreationByShareCodeApiV1AgentsShareThirdCodeGet(body);
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
| **code** | `string` |  | [Defaults to `undefined`] |

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


## myCreationsApiV1AgentsMyTypePost

> any myCreationsApiV1AgentsMyTypePost(type, page, limit)

我的创作列表

Return the current user\&#39;s creations filtered by type.

### Example

```ts
import {
  Configuration,
  AgentCreationApi,
} from '';
import type { MyCreationsApiV1AgentsMyTypePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentCreationApi(config);

  const body = {
    // string
    type: type_example,
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies MyCreationsApiV1AgentsMyTypePostRequest;

  try {
    const data = await api.myCreationsApiV1AgentsMyTypePost(body);
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
| **type** | `string` |  | [Defaults to `undefined`] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

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


## operateCreationApiV1AgentsOperateGcIdTypeGet

> any operateCreationApiV1AgentsOperateGcIdTypeGet(gcId, type)

点赞/收藏操作

Toggle like or collect on a creation. Returns new state.

### Example

```ts
import {
  Configuration,
  AgentCreationApi,
} from '';
import type { OperateCreationApiV1AgentsOperateGcIdTypeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentCreationApi(config);

  const body = {
    // string
    gcId: gcId_example,
    // string
    type: type_example,
  } satisfies OperateCreationApiV1AgentsOperateGcIdTypeGetRequest;

  try {
    const data = await api.operateCreationApiV1AgentsOperateGcIdTypeGet(body);
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
| **gcId** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Defaults to `undefined`] |

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


## shareCreationApiV1AgentsSharePost

> any shareCreationApiV1AgentsSharePost(gcId)

分享创作（生成分享码）

Generate a share code for a creation.

### Example

```ts
import {
  Configuration,
  AgentCreationApi,
} from '';
import type { ShareCreationApiV1AgentsSharePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentCreationApi(config);

  const body = {
    // string | 创作ID
    gcId: gcId_example,
  } satisfies ShareCreationApiV1AgentsSharePostRequest;

  try {
    const data = await api.shareCreationApiV1AgentsSharePost(body);
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
| **gcId** | `string` | 创作ID | [Defaults to `undefined`] |

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


## shareGenerateImageApiV1AgentsShareImagePost

> any shareGenerateImageApiV1AgentsShareImagePost(gcId, width, height)

分享生成图片

Generate a shareable image card for a creation.

### Example

```ts
import {
  Configuration,
  AgentCreationApi,
} from '';
import type { ShareGenerateImageApiV1AgentsShareImagePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentCreationApi(config);

  const body = {
    // string | 创作ID
    gcId: gcId_example,
    // number | 图片宽度 (optional)
    width: 56,
    // number | 图片高度 (optional)
    height: 56,
  } satisfies ShareGenerateImageApiV1AgentsShareImagePostRequest;

  try {
    const data = await api.shareGenerateImageApiV1AgentsShareImagePost(body);
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
| **gcId** | `string` | 创作ID | [Defaults to `undefined`] |
| **width** | `number` | 图片宽度 | [Optional] [Defaults to `800`] |
| **height** | `number` | 图片高度 | [Optional] [Defaults to `600`] |

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


## shareToCodeApiV1AgentsShareCodePost

> any shareToCodeApiV1AgentsShareCodePost(gcId)

分享转CODE

Convert a share reference to a code (alias for share creation).

### Example

```ts
import {
  Configuration,
  AgentCreationApi,
} from '';
import type { ShareToCodeApiV1AgentsShareCodePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentCreationApi(config);

  const body = {
    // string | 创作ID
    gcId: gcId_example,
  } satisfies ShareToCodeApiV1AgentsShareCodePostRequest;

  try {
    const data = await api.shareToCodeApiV1AgentsShareCodePost(body);
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
| **gcId** | `string` | 创作ID | [Defaults to `undefined`] |

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

