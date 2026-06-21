# CozeConversationsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost**](CozeConversationsApi.md#createfeedbackapiv1cozeconversationsconversationsmessagesfeedbackpost) | **POST** /api/v1/coze/conversations/conversations/messages/feedback | Create Feedback |
| [**createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0**](CozeConversationsApi.md#createfeedbackapiv1cozeconversationsconversationsmessagesfeedbackpost_0) | **POST** /api/v1/coze/conversations/conversations/messages/feedback | Create Feedback |
| [**listConversationsApiV1CozeConversationsConversationsPost**](CozeConversationsApi.md#listconversationsapiv1cozeconversationsconversationspost) | **POST** /api/v1/coze/conversations/conversations | List Conversations |
| [**listConversationsApiV1CozeConversationsConversationsPost_0**](CozeConversationsApi.md#listconversationsapiv1cozeconversationsconversationspost_0) | **POST** /api/v1/coze/conversations/conversations | List Conversations |
| [**listMessagesApiV1CozeConversationsConversationsMessagesPost**](CozeConversationsApi.md#listmessagesapiv1cozeconversationsconversationsmessagespost) | **POST** /api/v1/coze/conversations/conversations/messages | List Messages |
| [**listMessagesApiV1CozeConversationsConversationsMessagesPost_0**](CozeConversationsApi.md#listmessagesapiv1cozeconversationsconversationsmessagespost_0) | **POST** /api/v1/coze/conversations/conversations/messages | List Messages |
| [**retrieveConversationApiV1CozeConversationsConversationsRetrievePost**](CozeConversationsApi.md#retrieveconversationapiv1cozeconversationsconversationsretrievepost) | **POST** /api/v1/coze/conversations/conversations/retrieve | Retrieve Conversation |
| [**retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0**](CozeConversationsApi.md#retrieveconversationapiv1cozeconversationsconversationsretrievepost_0) | **POST** /api/v1/coze/conversations/conversations/retrieve | Retrieve Conversation |



## createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost

> any createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost(feedbackReq)

Create Feedback

### Example

```ts
import {
  Configuration,
  CozeConversationsApi,
} from '';
import type { CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeConversationsApi();

  const body = {
    // FeedbackReq
    feedbackReq: ...,
  } satisfies CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPostRequest;

  try {
    const data = await api.createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost(body);
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
| **feedbackReq** | [FeedbackReq](FeedbackReq.md) |  | |

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


## createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0

> any createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0(feedbackReq)

Create Feedback

### Example

```ts
import {
  Configuration,
  CozeConversationsApi,
} from '';
import type { CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeConversationsApi();

  const body = {
    // FeedbackReq
    feedbackReq: ...,
  } satisfies CreateFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost0Request;

  try {
    const data = await api.createFeedbackApiV1CozeConversationsConversationsMessagesFeedbackPost_0(body);
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
| **feedbackReq** | [FeedbackReq](FeedbackReq.md) |  | |

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


## listConversationsApiV1CozeConversationsConversationsPost

> any listConversationsApiV1CozeConversationsConversationsPost(listConvReq)

List Conversations

### Example

```ts
import {
  Configuration,
  CozeConversationsApi,
} from '';
import type { ListConversationsApiV1CozeConversationsConversationsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeConversationsApi();

  const body = {
    // ListConvReq
    listConvReq: ...,
  } satisfies ListConversationsApiV1CozeConversationsConversationsPostRequest;

  try {
    const data = await api.listConversationsApiV1CozeConversationsConversationsPost(body);
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
| **listConvReq** | [ListConvReq](ListConvReq.md) |  | |

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


## listConversationsApiV1CozeConversationsConversationsPost_0

> any listConversationsApiV1CozeConversationsConversationsPost_0(listConvReq)

List Conversations

### Example

```ts
import {
  Configuration,
  CozeConversationsApi,
} from '';
import type { ListConversationsApiV1CozeConversationsConversationsPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeConversationsApi();

  const body = {
    // ListConvReq
    listConvReq: ...,
  } satisfies ListConversationsApiV1CozeConversationsConversationsPost0Request;

  try {
    const data = await api.listConversationsApiV1CozeConversationsConversationsPost_0(body);
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
| **listConvReq** | [ListConvReq](ListConvReq.md) |  | |

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


## listMessagesApiV1CozeConversationsConversationsMessagesPost

> any listMessagesApiV1CozeConversationsConversationsMessagesPost(listMsgReq)

List Messages

### Example

```ts
import {
  Configuration,
  CozeConversationsApi,
} from '';
import type { ListMessagesApiV1CozeConversationsConversationsMessagesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeConversationsApi();

  const body = {
    // ListMsgReq
    listMsgReq: ...,
  } satisfies ListMessagesApiV1CozeConversationsConversationsMessagesPostRequest;

  try {
    const data = await api.listMessagesApiV1CozeConversationsConversationsMessagesPost(body);
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
| **listMsgReq** | [ListMsgReq](ListMsgReq.md) |  | |

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


## listMessagesApiV1CozeConversationsConversationsMessagesPost_0

> any listMessagesApiV1CozeConversationsConversationsMessagesPost_0(listMsgReq)

List Messages

### Example

```ts
import {
  Configuration,
  CozeConversationsApi,
} from '';
import type { ListMessagesApiV1CozeConversationsConversationsMessagesPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeConversationsApi();

  const body = {
    // ListMsgReq
    listMsgReq: ...,
  } satisfies ListMessagesApiV1CozeConversationsConversationsMessagesPost0Request;

  try {
    const data = await api.listMessagesApiV1CozeConversationsConversationsMessagesPost_0(body);
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
| **listMsgReq** | [ListMsgReq](ListMsgReq.md) |  | |

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


## retrieveConversationApiV1CozeConversationsConversationsRetrievePost

> any retrieveConversationApiV1CozeConversationsConversationsRetrievePost(retrieveReq)

Retrieve Conversation

### Example

```ts
import {
  Configuration,
  CozeConversationsApi,
} from '';
import type { RetrieveConversationApiV1CozeConversationsConversationsRetrievePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeConversationsApi();

  const body = {
    // RetrieveReq
    retrieveReq: ...,
  } satisfies RetrieveConversationApiV1CozeConversationsConversationsRetrievePostRequest;

  try {
    const data = await api.retrieveConversationApiV1CozeConversationsConversationsRetrievePost(body);
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
| **retrieveReq** | [RetrieveReq](RetrieveReq.md) |  | |

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


## retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0

> any retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0(retrieveReq)

Retrieve Conversation

### Example

```ts
import {
  Configuration,
  CozeConversationsApi,
} from '';
import type { RetrieveConversationApiV1CozeConversationsConversationsRetrievePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeConversationsApi();

  const body = {
    // RetrieveReq
    retrieveReq: ...,
  } satisfies RetrieveConversationApiV1CozeConversationsConversationsRetrievePost0Request;

  try {
    const data = await api.retrieveConversationApiV1CozeConversationsConversationsRetrievePost_0(body);
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
| **retrieveReq** | [RetrieveReq](RetrieveReq.md) |  | |

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

