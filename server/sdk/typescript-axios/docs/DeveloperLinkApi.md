# DeveloperLinkApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**assignAccountApiV1DeveloperLinkAssignAccountPut**](#assignaccountapiv1developerlinkassignaccountput) | **PUT** /api/v1/developerLink/assignAccount | Assign Coze account to developer|
|[**createDeveloperLinkApiV1DeveloperLinkPost**](#createdeveloperlinkapiv1developerlinkpost) | **POST** /api/v1/developerLink | Create developer link|
|[**deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete**](#deletedeveloperlinksapiv1developerlinkitemidsdelete) | **DELETE** /api/v1/developerLink/{item_ids} | Delete developer links|
|[**getDeveloperLinkApiV1DeveloperLinkItemIdGet**](#getdeveloperlinkapiv1developerlinkitemidget) | **GET** /api/v1/developerLink/{item_id} | Get developer link detail|
|[**listDeveloperLinksApiV1DeveloperLinkListGet**](#listdeveloperlinksapiv1developerlinklistget) | **GET** /api/v1/developerLink/list | List developer links|
|[**updateDeveloperLinkApiV1DeveloperLinkPut**](#updatedeveloperlinkapiv1developerlinkput) | **PUT** /api/v1/developerLink | Update developer link|

# **assignAccountApiV1DeveloperLinkAssignAccountPut**
> any assignAccountApiV1DeveloperLinkAssignAccountPut(assignAccountRequest)

Assign a Coze account to a developer link.

### Example

```typescript
import {
    DeveloperLinkApi,
    Configuration,
    AssignAccountRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new DeveloperLinkApi(configuration);

let assignAccountRequest: AssignAccountRequest; //

const { status, data } = await apiInstance.assignAccountApiV1DeveloperLinkAssignAccountPut(
    assignAccountRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **assignAccountRequest** | **AssignAccountRequest**|  | |


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

# **createDeveloperLinkApiV1DeveloperLinkPost**
> any createDeveloperLinkApiV1DeveloperLinkPost(developerLinkCreate)


### Example

```typescript
import {
    DeveloperLinkApi,
    Configuration,
    DeveloperLinkCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new DeveloperLinkApi(configuration);

let developerLinkCreate: DeveloperLinkCreate; //

const { status, data } = await apiInstance.createDeveloperLinkApiV1DeveloperLinkPost(
    developerLinkCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **developerLinkCreate** | **DeveloperLinkCreate**|  | |


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

# **deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete**
> any deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete()


### Example

```typescript
import {
    DeveloperLinkApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DeveloperLinkApi(configuration);

let itemIds: string; // (default to undefined)

const { status, data } = await apiInstance.deleteDeveloperLinksApiV1DeveloperLinkItemIdsDelete(
    itemIds
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **itemIds** | [**string**] |  | defaults to undefined|


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

# **getDeveloperLinkApiV1DeveloperLinkItemIdGet**
> any getDeveloperLinkApiV1DeveloperLinkItemIdGet()


### Example

```typescript
import {
    DeveloperLinkApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DeveloperLinkApi(configuration);

let itemId: number; // (default to undefined)

const { status, data } = await apiInstance.getDeveloperLinkApiV1DeveloperLinkItemIdGet(
    itemId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **itemId** | [**number**] |  | defaults to undefined|


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

# **listDeveloperLinksApiV1DeveloperLinkListGet**
> any listDeveloperLinksApiV1DeveloperLinkListGet()


### Example

```typescript
import {
    DeveloperLinkApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DeveloperLinkApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userId: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listDeveloperLinksApiV1DeveloperLinkListGet(
    page,
    limit,
    userId,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userId** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **updateDeveloperLinkApiV1DeveloperLinkPut**
> any updateDeveloperLinkApiV1DeveloperLinkPut(developerLinkUpdate)


### Example

```typescript
import {
    DeveloperLinkApi,
    Configuration,
    DeveloperLinkUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new DeveloperLinkApi(configuration);

let developerLinkUpdate: DeveloperLinkUpdate; //

const { status, data } = await apiInstance.updateDeveloperLinkApiV1DeveloperLinkPut(
    developerLinkUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **developerLinkUpdate** | **DeveloperLinkUpdate**|  | |


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

