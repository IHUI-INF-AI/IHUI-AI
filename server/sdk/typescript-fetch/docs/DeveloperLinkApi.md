# DeveloperLinkApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**assignAccountApiV1DeveloperLinkAssignAccountPut**](DeveloperLinkApi.md#assignaccountapiv1developerlinkassignaccountput) | **PUT** /api/v1/developerLink/assignAccount | Assign Coze account to developer |
| [**createDeveloperLinkApiV1DeveloperLinkPost**](DeveloperLinkApi.md#createdeveloperlinkapiv1developerlinkpost) | **POST** /api/v1/developerLink | Create developer link |
| [**deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete**](DeveloperLinkApi.md#deletedeveloperlinksapiv1developerlinkitemidsdelete) | **DELETE** /api/v1/developerLink/{item_ids} | Delete developer links |
| [**getDeveloperLinkApiV1DeveloperLinkItemIdGet**](DeveloperLinkApi.md#getdeveloperlinkapiv1developerlinkitemidget) | **GET** /api/v1/developerLink/{item_id} | Get developer link detail |
| [**listDeveloperLinksApiV1DeveloperLinkListGet**](DeveloperLinkApi.md#listdeveloperlinksapiv1developerlinklistget) | **GET** /api/v1/developerLink/list | List developer links |
| [**updateDeveloperLinkApiV1DeveloperLinkPut**](DeveloperLinkApi.md#updatedeveloperlinkapiv1developerlinkput) | **PUT** /api/v1/developerLink | Update developer link |



## assignAccountApiV1DeveloperLinkAssignAccountPut

> any assignAccountApiV1DeveloperLinkAssignAccountPut(assignAccountRequest)

Assign Coze account to developer

Assign a Coze account to a developer link.

### Example

```ts
import {
  Configuration,
  DeveloperLinkApi,
} from '';
import type { AssignAccountApiV1DeveloperLinkAssignAccountPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DeveloperLinkApi();

  const body = {
    // AssignAccountRequest
    assignAccountRequest: ...,
  } satisfies AssignAccountApiV1DeveloperLinkAssignAccountPutRequest;

  try {
    const data = await api.assignAccountApiV1DeveloperLinkAssignAccountPut(body);
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
| **assignAccountRequest** | [AssignAccountRequest](AssignAccountRequest.md) |  | |

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


## createDeveloperLinkApiV1DeveloperLinkPost

> any createDeveloperLinkApiV1DeveloperLinkPost(developerLinkCreate)

Create developer link

### Example

```ts
import {
  Configuration,
  DeveloperLinkApi,
} from '';
import type { CreateDeveloperLinkApiV1DeveloperLinkPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DeveloperLinkApi();

  const body = {
    // DeveloperLinkCreate
    developerLinkCreate: ...,
  } satisfies CreateDeveloperLinkApiV1DeveloperLinkPostRequest;

  try {
    const data = await api.createDeveloperLinkApiV1DeveloperLinkPost(body);
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
| **developerLinkCreate** | [DeveloperLinkCreate](DeveloperLinkCreate.md) |  | |

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


## deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete

> any deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete(itemIds)

Delete developer links

### Example

```ts
import {
  Configuration,
  DeveloperLinkApi,
} from '';
import type { DeleteDeveloperLinksApiV1DeveloperLinkItemIdsDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DeveloperLinkApi();

  const body = {
    // string
    itemIds: itemIds_example,
  } satisfies DeleteDeveloperLinksApiV1DeveloperLinkItemIdsDeleteRequest;

  try {
    const data = await api.deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete(body);
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
| **itemIds** | `string` |  | [Defaults to `undefined`] |

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


## getDeveloperLinkApiV1DeveloperLinkItemIdGet

> any getDeveloperLinkApiV1DeveloperLinkItemIdGet(itemId)

Get developer link detail

### Example

```ts
import {
  Configuration,
  DeveloperLinkApi,
} from '';
import type { GetDeveloperLinkApiV1DeveloperLinkItemIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DeveloperLinkApi();

  const body = {
    // number
    itemId: 56,
  } satisfies GetDeveloperLinkApiV1DeveloperLinkItemIdGetRequest;

  try {
    const data = await api.getDeveloperLinkApiV1DeveloperLinkItemIdGet(body);
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
| **itemId** | `number` |  | [Defaults to `undefined`] |

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


## listDeveloperLinksApiV1DeveloperLinkListGet

> any listDeveloperLinksApiV1DeveloperLinkListGet(page, limit, userId, status)

List developer links

### Example

```ts
import {
  Configuration,
  DeveloperLinkApi,
} from '';
import type { ListDeveloperLinksApiV1DeveloperLinkListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DeveloperLinkApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userId: userId_example,
    // number (optional)
    status: 56,
  } satisfies ListDeveloperLinksApiV1DeveloperLinkListGetRequest;

  try {
    const data = await api.listDeveloperLinksApiV1DeveloperLinkListGet(body);
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
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **userId** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateDeveloperLinkApiV1DeveloperLinkPut

> any updateDeveloperLinkApiV1DeveloperLinkPut(developerLinkUpdate)

Update developer link

### Example

```ts
import {
  Configuration,
  DeveloperLinkApi,
} from '';
import type { UpdateDeveloperLinkApiV1DeveloperLinkPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DeveloperLinkApi();

  const body = {
    // DeveloperLinkUpdate
    developerLinkUpdate: ...,
  } satisfies UpdateDeveloperLinkApiV1DeveloperLinkPutRequest;

  try {
    const data = await api.updateDeveloperLinkApiV1DeveloperLinkPut(body);
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
| **developerLinkUpdate** | [DeveloperLinkUpdate](DeveloperLinkUpdate.md) |  | |

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

