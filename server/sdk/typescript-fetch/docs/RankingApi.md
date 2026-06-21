# RankingApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**agentRankingApiV1RankingAgentGet**](RankingApi.md#agentrankingapiv1rankingagentget) | **GET** /api/v1/ranking/agent | Agent排行榜 |
| [**agentRankingApiV1RankingAgentGet_0**](RankingApi.md#agentrankingapiv1rankingagentget_0) | **GET** /api/v1/ranking/agent | Agent排行榜 |
| [**courseRankingApiV1RankingCourseGet**](RankingApi.md#courserankingapiv1rankingcourseget) | **GET** /api/v1/ranking/course | 课程排行榜 |
| [**courseRankingApiV1RankingCourseGet_0**](RankingApi.md#courserankingapiv1rankingcourseget_0) | **GET** /api/v1/ranking/course | 课程排行榜 |
| [**createRankingApiV1RankingPost**](RankingApi.md#createrankingapiv1rankingpost) | **POST** /api/v1/ranking | 创建榜单 |
| [**createRankingApiV1RankingPost_0**](RankingApi.md#createrankingapiv1rankingpost_0) | **POST** /api/v1/ranking | 创建榜单 |
| [**listRankingsApiV1RankingListGet**](RankingApi.md#listrankingsapiv1rankinglistget) | **GET** /api/v1/ranking/list | 排行榜列表 |
| [**listRankingsApiV1RankingListGet_0**](RankingApi.md#listrankingsapiv1rankinglistget_0) | **GET** /api/v1/ranking/list | 排行榜列表 |
| [**userRankingApiV1RankingUserGet**](RankingApi.md#userrankingapiv1rankinguserget) | **GET** /api/v1/ranking/user | 用户积分排行榜 |
| [**userRankingApiV1RankingUserGet_0**](RankingApi.md#userrankingapiv1rankinguserget_0) | **GET** /api/v1/ranking/user | 用户积分排行榜 |



## agentRankingApiV1RankingAgentGet

> any agentRankingApiV1RankingAgentGet(period, limit)

Agent排行榜

### Example

```ts
import {
  Configuration,
  RankingApi,
} from '';
import type { AgentRankingApiV1RankingAgentGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RankingApi();

  const body = {
    // string (optional)
    period: period_example,
    // number (optional)
    limit: 56,
  } satisfies AgentRankingApiV1RankingAgentGetRequest;

  try {
    const data = await api.agentRankingApiV1RankingAgentGet(body);
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
| **period** | `string` |  | [Optional] [Defaults to `&#39;all&#39;`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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


## agentRankingApiV1RankingAgentGet_0

> any agentRankingApiV1RankingAgentGet_0(period, limit)

Agent排行榜

### Example

```ts
import {
  Configuration,
  RankingApi,
} from '';
import type { AgentRankingApiV1RankingAgentGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RankingApi();

  const body = {
    // string (optional)
    period: period_example,
    // number (optional)
    limit: 56,
  } satisfies AgentRankingApiV1RankingAgentGet0Request;

  try {
    const data = await api.agentRankingApiV1RankingAgentGet_0(body);
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
| **period** | `string` |  | [Optional] [Defaults to `&#39;all&#39;`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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


## courseRankingApiV1RankingCourseGet

> any courseRankingApiV1RankingCourseGet(limit)

课程排行榜

### Example

```ts
import {
  Configuration,
  RankingApi,
} from '';
import type { CourseRankingApiV1RankingCourseGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RankingApi();

  const body = {
    // number (optional)
    limit: 56,
  } satisfies CourseRankingApiV1RankingCourseGetRequest;

  try {
    const data = await api.courseRankingApiV1RankingCourseGet(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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


## courseRankingApiV1RankingCourseGet_0

> any courseRankingApiV1RankingCourseGet_0(limit)

课程排行榜

### Example

```ts
import {
  Configuration,
  RankingApi,
} from '';
import type { CourseRankingApiV1RankingCourseGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RankingApi();

  const body = {
    // number (optional)
    limit: 56,
  } satisfies CourseRankingApiV1RankingCourseGet0Request;

  try {
    const data = await api.courseRankingApiV1RankingCourseGet_0(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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


## createRankingApiV1RankingPost

> any createRankingApiV1RankingPost(name, code, type, period, description)

创建榜单

### Example

```ts
import {
  Configuration,
  RankingApi,
} from '';
import type { CreateRankingApiV1RankingPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RankingApi();

  const body = {
    // string
    name: name_example,
    // string
    code: code_example,
    // string (optional)
    type: type_example,
    // string (optional)
    period: period_example,
    // string (optional)
    description: description_example,
  } satisfies CreateRankingApiV1RankingPostRequest;

  try {
    const data = await api.createRankingApiV1RankingPost(body);
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
| **name** | `string` |  | [Defaults to `undefined`] |
| **code** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;agent&#39;`] |
| **period** | `string` |  | [Optional] [Defaults to `&#39;day&#39;`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## createRankingApiV1RankingPost_0

> any createRankingApiV1RankingPost_0(name, code, type, period, description)

创建榜单

### Example

```ts
import {
  Configuration,
  RankingApi,
} from '';
import type { CreateRankingApiV1RankingPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RankingApi();

  const body = {
    // string
    name: name_example,
    // string
    code: code_example,
    // string (optional)
    type: type_example,
    // string (optional)
    period: period_example,
    // string (optional)
    description: description_example,
  } satisfies CreateRankingApiV1RankingPost0Request;

  try {
    const data = await api.createRankingApiV1RankingPost_0(body);
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
| **name** | `string` |  | [Defaults to `undefined`] |
| **code** | `string` |  | [Defaults to `undefined`] |
| **type** | `string` |  | [Optional] [Defaults to `&#39;agent&#39;`] |
| **period** | `string` |  | [Optional] [Defaults to `&#39;day&#39;`] |
| **description** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## listRankingsApiV1RankingListGet

> any listRankingsApiV1RankingListGet()

排行榜列表

### Example

```ts
import {
  Configuration,
  RankingApi,
} from '';
import type { ListRankingsApiV1RankingListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RankingApi();

  try {
    const data = await api.listRankingsApiV1RankingListGet();
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


## listRankingsApiV1RankingListGet_0

> any listRankingsApiV1RankingListGet_0()

排行榜列表

### Example

```ts
import {
  Configuration,
  RankingApi,
} from '';
import type { ListRankingsApiV1RankingListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RankingApi();

  try {
    const data = await api.listRankingsApiV1RankingListGet_0();
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


## userRankingApiV1RankingUserGet

> any userRankingApiV1RankingUserGet(period, limit)

用户积分排行榜

### Example

```ts
import {
  Configuration,
  RankingApi,
} from '';
import type { UserRankingApiV1RankingUserGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RankingApi();

  const body = {
    // string (optional)
    period: period_example,
    // number (optional)
    limit: 56,
  } satisfies UserRankingApiV1RankingUserGetRequest;

  try {
    const data = await api.userRankingApiV1RankingUserGet(body);
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
| **period** | `string` |  | [Optional] [Defaults to `&#39;all&#39;`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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


## userRankingApiV1RankingUserGet_0

> any userRankingApiV1RankingUserGet_0(period, limit)

用户积分排行榜

### Example

```ts
import {
  Configuration,
  RankingApi,
} from '';
import type { UserRankingApiV1RankingUserGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new RankingApi();

  const body = {
    // string (optional)
    period: period_example,
    // number (optional)
    limit: 56,
  } satisfies UserRankingApiV1RankingUserGet0Request;

  try {
    const data = await api.userRankingApiV1RankingUserGet_0(body);
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
| **period** | `string` |  | [Optional] [Defaults to `&#39;all&#39;`] |
| **limit** | `number` |  | [Optional] [Defaults to `50`] |

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

