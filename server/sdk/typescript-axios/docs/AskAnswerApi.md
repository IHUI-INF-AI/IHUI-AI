# AskAnswerApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adoptAnswerApiV1AskAnswerAdoptPut**](#adoptanswerapiv1askansweradoptput) | **PUT** /api/v1/ask/answer/adopt | 采纳回答|
|[**createAnswerApiV1AskAnswerPost**](#createanswerapiv1askanswerpost) | **POST** /api/v1/ask/answer | 提出回答|
|[**deleteAnswerApiV1AskAnswerDelete**](#deleteanswerapiv1askanswerdelete) | **DELETE** /api/v1/ask/answer | 删除回答|
|[**getAnswerApiV1AskAnswerPublicApiGet**](#getanswerapiv1askanswerpublicapiget) | **GET** /api/v1/ask/answer/public-api | 回答详情|
|[**listAnswersApiV1AskAnswerListGet**](#listanswersapiv1askanswerlistget) | **GET** /api/v1/ask/answer/list | 回答列表(需权限)|
|[**memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet**](#memberanswercountapiv1askanswerpublicapimembercountget) | **GET** /api/v1/ask/answer/public-api/member/count | 会员回答数|
|[**publicListAnswersApiV1AskAnswerPublicApiListGet**](#publiclistanswersapiv1askanswerpublicapilistget) | **GET** /api/v1/ask/answer/public-api/list | 回答列表(公开)|
|[**updateAnswerApiV1AskAnswerPut**](#updateanswerapiv1askanswerput) | **PUT** /api/v1/ask/answer | 修改回答|

# **adoptAnswerApiV1AskAnswerAdoptPut**
> any adoptAnswerApiV1AskAnswerAdoptPut()


### Example

```typescript
import {
    AskAnswerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskAnswerApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.adoptAnswerApiV1AskAnswerAdoptPut(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


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

# **createAnswerApiV1AskAnswerPost**
> any createAnswerApiV1AskAnswerPost(answerCreate)


### Example

```typescript
import {
    AskAnswerApi,
    Configuration,
    AnswerCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskAnswerApi(configuration);

let answerCreate: AnswerCreate; //

const { status, data } = await apiInstance.createAnswerApiV1AskAnswerPost(
    answerCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **answerCreate** | **AnswerCreate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteAnswerApiV1AskAnswerDelete**
> any deleteAnswerApiV1AskAnswerDelete()


### Example

```typescript
import {
    AskAnswerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskAnswerApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.deleteAnswerApiV1AskAnswerDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


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

# **getAnswerApiV1AskAnswerPublicApiGet**
> any getAnswerApiV1AskAnswerPublicApiGet()


### Example

```typescript
import {
    AskAnswerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskAnswerApi(configuration);

let id: number; // (default to undefined)

const { status, data } = await apiInstance.getAnswerApiV1AskAnswerPublicApiGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] |  | defaults to undefined|


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

# **listAnswersApiV1AskAnswerListGet**
> any listAnswersApiV1AskAnswerListGet()


### Example

```typescript
import {
    AskAnswerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskAnswerApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 10)
let questionId: number; // (optional) (default to undefined)
let memberId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listAnswersApiV1AskAnswerListGet(
    page,
    limit,
    questionId,
    memberId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 10|
| **questionId** | [**number**] |  | (optional) defaults to undefined|
| **memberId** | [**string**] |  | (optional) defaults to undefined|


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

# **memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet**
> any memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet()


### Example

```typescript
import {
    AskAnswerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskAnswerApi(configuration);

let memberId: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.memberAnswerCountApiV1AskAnswerPublicApiMemberCountGet(
    memberId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **memberId** | [**string**] |  | (optional) defaults to undefined|


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

# **publicListAnswersApiV1AskAnswerPublicApiListGet**
> any publicListAnswersApiV1AskAnswerPublicApiListGet()


### Example

```typescript
import {
    AskAnswerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AskAnswerApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 10)
let questionId: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.publicListAnswersApiV1AskAnswerPublicApiListGet(
    page,
    limit,
    questionId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 10|
| **questionId** | [**number**] |  | (optional) defaults to undefined|


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

# **updateAnswerApiV1AskAnswerPut**
> any updateAnswerApiV1AskAnswerPut(answerUpdate)


### Example

```typescript
import {
    AskAnswerApi,
    Configuration,
    AnswerUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new AskAnswerApi(configuration);

let answerUpdate: AnswerUpdate; //

const { status, data } = await apiInstance.updateAnswerApiV1AskAnswerPut(
    answerUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **answerUpdate** | **AnswerUpdate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

