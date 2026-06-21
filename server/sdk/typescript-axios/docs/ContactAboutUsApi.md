# ContactAboutUsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**contactAddApiV1ContentContactPost**](#contactaddapiv1contentcontactpost) | **POST** /api/v1/content/contact | Contact Add|
|[**contactEditApiV1ContentContactPut**](#contacteditapiv1contentcontactput) | **PUT** /api/v1/content/contact | Contact Edit|
|[**contactGetInfoApiV1ContentContactItemIdGet**](#contactgetinfoapiv1contentcontactitemidget) | **GET** /api/v1/content/contact/{item_id} | Contact Get Info|
|[**contactListApiV1ContentContactListGet**](#contactlistapiv1contentcontactlistget) | **GET** /api/v1/content/contact/list | Contact List|
|[**contactRemoveApiV1ContentContactItemIdsDelete**](#contactremoveapiv1contentcontactitemidsdelete) | **DELETE** /api/v1/content/contact/{item_ids} | Contact Remove|

# **contactAddApiV1ContentContactPost**
> any contactAddApiV1ContentContactPost(contactIn)

Create new contact.

### Example

```typescript
import {
    ContactAboutUsApi,
    Configuration,
    ContactIn
} from './api';

const configuration = new Configuration();
const apiInstance = new ContactAboutUsApi(configuration);

let contactIn: ContactIn; //

const { status, data } = await apiInstance.contactAddApiV1ContentContactPost(
    contactIn
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **contactIn** | **ContactIn**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **contactEditApiV1ContentContactPut**
> any contactEditApiV1ContentContactPut(contactIn)

Update contact.

### Example

```typescript
import {
    ContactAboutUsApi,
    Configuration,
    ContactIn
} from './api';

const configuration = new Configuration();
const apiInstance = new ContactAboutUsApi(configuration);

let id: number; // (default to undefined)
let contactIn: ContactIn; //

const { status, data } = await apiInstance.contactEditApiV1ContentContactPut(
    id,
    contactIn
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **contactIn** | **ContactIn**|  | |
| **id** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **contactGetInfoApiV1ContentContactItemIdGet**
> any contactGetInfoApiV1ContentContactItemIdGet()

Get contact detail by ID.

### Example

```typescript
import {
    ContactAboutUsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContactAboutUsApi(configuration);

let itemId: number; // (default to undefined)

const { status, data } = await apiInstance.contactGetInfoApiV1ContentContactItemIdGet(
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

# **contactListApiV1ContentContactListGet**
> any contactListApiV1ContentContactListGet()

List contacts with pagination.

### Example

```typescript
import {
    ContactAboutUsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContactAboutUsApi(configuration);

let pageNum: number; // (optional) (default to 1)
let pageSize: number; // (optional) (default to 10)

const { status, data } = await apiInstance.contactListApiV1ContentContactListGet(
    pageNum,
    pageSize
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **pageNum** | [**number**] |  | (optional) defaults to 1|
| **pageSize** | [**number**] |  | (optional) defaults to 10|


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

# **contactRemoveApiV1ContentContactItemIdsDelete**
> any contactRemoveApiV1ContentContactItemIdsDelete()

Delete contacts by comma-separated IDs.  Fixed: Use parameterized queries to prevent SQL injection. IDs are validated as integers before use.

### Example

```typescript
import {
    ContactAboutUsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContactAboutUsApi(configuration);

let itemIds: string; // (default to undefined)

const { status, data } = await apiInstance.contactRemoveApiV1ContentContactItemIdsDelete(
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

