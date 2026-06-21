# AskAnswerApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**adoptAnswerApiV1AskAnswerAdoptPut**](AskAnswerApi.md#adoptanswerapiv1askansweradoptput) | **PUT** /api/v1/ask/answer/adopt | 采纳回答 |
| [**createAnswerApiV1AskAnswerPost**](AskAnswerApi.md#createanswerapiv1askanswerpost) | **POST** /api/v1/ask/answer | 提出回答 |
| [**deleteAnswerApiV1AskAnswerDelete**](AskAnswerApi.md#deleteanswerapiv1askanswerdelete) | **DELETE** /api/v1/ask/answer | 删除回答 |
| [**getAnswerApiV1AskAnswerPublicApiGet**](AskAnswerApi.md#getanswerapiv1askanswerpublicapiget) | **GET** /api/v1/ask/answer/public-api | 回答详情 |
| [**listAnswersApiV1AskAnswerListGet**](AskAnswerApi.md#listanswersapiv1askanswerlistget) | **GET** /api/v1/ask/answer/list | 回答列表(需权限) |
| [**memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet**](AskAnswerApi.md#memberanswercountapiv1askanswerpublicapimembercountget) | **GET** /api/v1/ask/answer/public-api/member/count | 会员回答数 |
| [**publicListAnswersApiV1AskAnswerPublicApiListGet**](AskAnswerApi.md#publiclistanswersapiv1askanswerpublicapilistget) | **GET** /api/v1/ask/answer/public-api/list | 回答列表(公开) |
| [**updateAnswerApiV1AskAnswerPut**](AskAnswerApi.md#updateanswerapiv1askanswerput) | **PUT** /api/v1/ask/answer | 修改回答 |



## adoptAnswerApiV1AskAnswerAdoptPut

> any adoptAnswerApiV1AskAnswerAdoptPut(id)

采纳回答

### Example

```ts
import {
  Configuration,
  AskAnswerApi,
} from '';
import type { AdoptAnswerApiV1AskAnswerAdoptPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskAnswerApi();

  const body = {
    // number
    id: 56,
  } satisfies AdoptAnswerApiV1AskAnswerAdoptPutRequest;

  try {
    const data = await api.adoptAnswerApiV1AskAnswerAdoptPut(body);
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
| **id** | `number` |  | [Defaults to `undefined`] |

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


## createAnswerApiV1AskAnswerPost

> any createAnswerApiV1AskAnswerPost(answerCreate)

提出回答

### Example

```ts
import {
  Configuration,
  AskAnswerApi,
} from '';
import type { CreateAnswerApiV1AskAnswerPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskAnswerApi();

  const body = {
    // AnswerCreate
    answerCreate: ...,
  } satisfies CreateAnswerApiV1AskAnswerPostRequest;

  try {
    const data = await api.createAnswerApiV1AskAnswerPost(body);
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
| **answerCreate** | [AnswerCreate](AnswerCreate.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteAnswerApiV1AskAnswerDelete

> any deleteAnswerApiV1AskAnswerDelete(id)

删除回答

### Example

```ts
import {
  Configuration,
  AskAnswerApi,
} from '';
import type { DeleteAnswerApiV1AskAnswerDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskAnswerApi();

  const body = {
    // number
    id: 56,
  } satisfies DeleteAnswerApiV1AskAnswerDeleteRequest;

  try {
    const data = await api.deleteAnswerApiV1AskAnswerDelete(body);
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
| **id** | `number` |  | [Defaults to `undefined`] |

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


## getAnswerApiV1AskAnswerPublicApiGet

> any getAnswerApiV1AskAnswerPublicApiGet(id)

回答详情

### Example

```ts
import {
  Configuration,
  AskAnswerApi,
} from '';
import type { GetAnswerApiV1AskAnswerPublicApiGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskAnswerApi();

  const body = {
    // number
    id: 56,
  } satisfies GetAnswerApiV1AskAnswerPublicApiGetRequest;

  try {
    const data = await api.getAnswerApiV1AskAnswerPublicApiGet(body);
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
| **id** | `number` |  | [Defaults to `undefined`] |

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


## listAnswersApiV1AskAnswerListGet

> any listAnswersApiV1AskAnswerListGet(page, limit, questionId, memberId)

回答列表(需权限)

### Example

```ts
import {
  Configuration,
  AskAnswerApi,
} from '';
import type { ListAnswersApiV1AskAnswerListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskAnswerApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    questionId: 56,
    // string (optional)
    memberId: memberId_example,
  } satisfies ListAnswersApiV1AskAnswerListGetRequest;

  try {
    const data = await api.listAnswersApiV1AskAnswerListGet(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `10`] |
| **questionId** | `number` |  | [Optional] [Defaults to `undefined`] |
| **memberId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet

> any memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet(memberId)

会员回答数

### Example

```ts
import {
  Configuration,
  AskAnswerApi,
} from '';
import type { MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskAnswerApi();

  const body = {
    // string (optional)
    memberId: memberId_example,
  } satisfies MemberAnswerCountApiV1AskAnswerPublicApiMemberCountGetRequest;

  try {
    const data = await api.memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet(body);
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
| **memberId** | `string` |  | [Optional] [Defaults to `undefined`] |

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


## publicListAnswersApiV1AskAnswerPublicApiListGet

> any publicListAnswersApiV1AskAnswerPublicApiListGet(page, limit, questionId)

回答列表(公开)

### Example

```ts
import {
  Configuration,
  AskAnswerApi,
} from '';
import type { PublicListAnswersApiV1AskAnswerPublicApiListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskAnswerApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number (optional)
    questionId: 56,
  } satisfies PublicListAnswersApiV1AskAnswerPublicApiListGetRequest;

  try {
    const data = await api.publicListAnswersApiV1AskAnswerPublicApiListGet(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `10`] |
| **questionId** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateAnswerApiV1AskAnswerPut

> any updateAnswerApiV1AskAnswerPut(answerUpdate)

修改回答

### Example

```ts
import {
  Configuration,
  AskAnswerApi,
} from '';
import type { UpdateAnswerApiV1AskAnswerPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AskAnswerApi();

  const body = {
    // AnswerUpdate
    answerUpdate: ...,
  } satisfies UpdateAnswerApiV1AskAnswerPutRequest;

  try {
    const data = await api.updateAnswerApiV1AskAnswerPut(body);
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
| **answerUpdate** | [AnswerUpdate](AnswerUpdate.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

