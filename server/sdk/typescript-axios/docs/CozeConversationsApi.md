# CozeConversationsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost**](#createfeedbackapiv1cozeconversationsconversationsmessagesfeedbackpost) | **POST** /api/v1/coze/conversations/conversations/messages/feedback | Create Feedback|
|[**createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0**](#createfeedbackapiv1cozeconversationsconversationsmessagesfeedbackpost_0) | **POST** /api/v1/coze/conversations/conversations/messages/feedback | Create Feedback|
|[**listConversationsApiV1CozeConversationsConversationsPost**](#listconversationsapiv1cozeconversationsconversationspost) | **POST** /api/v1/coze/conversations/conversations | List Conversations|
|[**listConversationsApiV1CozeConversationsConversationsPost_0**](#listconversationsapiv1cozeconversationsconversationspost_0) | **POST** /api/v1/coze/conversations/conversations | List Conversations|
|[**listMessagesApiV1CozeConversationsConversationsMessagesPost**](#listmessagesapiv1cozeconversationsconversationsmessagespost) | **POST** /api/v1/coze/conversations/conversations/messages | List Messages|
|[**listMessagesApiV1CozeConversationsConversationsMessagesPost_0**](#listmessagesapiv1cozeconversationsconversationsmessagespost_0) | **POST** /api/v1/coze/conversations/conversations/messages | List Messages|
|[**retrieveConversationApiV1CozeConversationsConversationsRetrievePost**](#retrieveconversationapiv1cozeconversationsconversationsretrievepost) | **POST** /api/v1/coze/conversations/conversations/retrieve | Retrieve Conversation|
|[**retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0**](#retrieveconversationapiv1cozeconversationsconversationsretrievepost_0) | **POST** /api/v1/coze/conversations/conversations/retrieve | Retrieve Conversation|

# **createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost**
> any createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost(feedbackReq)


### Example

```typescript
import {
    CozeConversationsApi,
    Configuration,
    FeedbackReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeConversationsApi(configuration);

let feedbackReq: FeedbackReq; //

const { status, data } = await apiInstance.createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost(
    feedbackReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **feedbackReq** | **FeedbackReq**|  | |


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

# **createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0**
> any createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0(feedbackReq)


### Example

```typescript
import {
    CozeConversationsApi,
    Configuration,
    FeedbackReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeConversationsApi(configuration);

let feedbackReq: FeedbackReq; //

const { status, data } = await apiInstance.createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0(
    feedbackReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **feedbackReq** | **FeedbackReq**|  | |


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

# **listConversationsApiV1CozeConversationsConversationsPost**
> any listConversationsApiV1CozeConversationsConversationsPost(listConvReq)


### Example

```typescript
import {
    CozeConversationsApi,
    Configuration,
    ListConvReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeConversationsApi(configuration);

let listConvReq: ListConvReq; //

const { status, data } = await apiInstance.listConversationsApiV1CozeConversationsConversationsPost(
    listConvReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **listConvReq** | **ListConvReq**|  | |


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

# **listConversationsApiV1CozeConversationsConversationsPost_0**
> any listConversationsApiV1CozeConversationsConversationsPost_0(listConvReq)


### Example

```typescript
import {
    CozeConversationsApi,
    Configuration,
    ListConvReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeConversationsApi(configuration);

let listConvReq: ListConvReq; //

const { status, data } = await apiInstance.listConversationsApiV1CozeConversationsConversationsPost_0(
    listConvReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **listConvReq** | **ListConvReq**|  | |


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

# **listMessagesApiV1CozeConversationsConversationsMessagesPost**
> any listMessagesApiV1CozeConversationsConversationsMessagesPost(listMsgReq)


### Example

```typescript
import {
    CozeConversationsApi,
    Configuration,
    ListMsgReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeConversationsApi(configuration);

let listMsgReq: ListMsgReq; //

const { status, data } = await apiInstance.listMessagesApiV1CozeConversationsConversationsMessagesPost(
    listMsgReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **listMsgReq** | **ListMsgReq**|  | |


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

# **listMessagesApiV1CozeConversationsConversationsMessagesPost_0**
> any listMessagesApiV1CozeConversationsConversationsMessagesPost_0(listMsgReq)


### Example

```typescript
import {
    CozeConversationsApi,
    Configuration,
    ListMsgReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeConversationsApi(configuration);

let listMsgReq: ListMsgReq; //

const { status, data } = await apiInstance.listMessagesApiV1CozeConversationsConversationsMessagesPost_0(
    listMsgReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **listMsgReq** | **ListMsgReq**|  | |


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

# **retrieveConversationApiV1CozeConversationsConversationsRetrievePost**
> any retrieveConversationApiV1CozeConversationsConversationsRetrievePost(retrieveReq)


### Example

```typescript
import {
    CozeConversationsApi,
    Configuration,
    RetrieveReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeConversationsApi(configuration);

let retrieveReq: RetrieveReq; //

const { status, data } = await apiInstance.retrieveConversationApiV1CozeConversationsConversationsRetrievePost(
    retrieveReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **retrieveReq** | **RetrieveReq**|  | |


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

# **retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0**
> any retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0(retrieveReq)


### Example

```typescript
import {
    CozeConversationsApi,
    Configuration,
    RetrieveReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeConversationsApi(configuration);

let retrieveReq: RetrieveReq; //

const { status, data } = await apiInstance.retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0(
    retrieveReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **retrieveReq** | **RetrieveReq**|  | |


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

