# ContactAboutUsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**contactAddApiV1ContentContactPost**](ContactAboutUsApi.md#contactaddapiv1contentcontactpost) | **POST** /api/v1/content/contact | Contact Add |
| [**contactEditApiV1ContentContactPut**](ContactAboutUsApi.md#contacteditapiv1contentcontactput) | **PUT** /api/v1/content/contact | Contact Edit |
| [**contactGetInfoApiV1ContentContactItemIdGet**](ContactAboutUsApi.md#contactgetinfoapiv1contentcontactitemidget) | **GET** /api/v1/content/contact/{item_id} | Contact Get Info |
| [**contactListApiV1ContentContactListGet**](ContactAboutUsApi.md#contactlistapiv1contentcontactlistget) | **GET** /api/v1/content/contact/list | Contact List |
| [**contactRemoveApiV1ContentContactItemIdsDelete**](ContactAboutUsApi.md#contactremoveapiv1contentcontactitemidsdelete) | **DELETE** /api/v1/content/contact/{item_ids} | Contact Remove |



## contactAddApiV1ContentContactPost

> any contactAddApiV1ContentContactPost(contactIn)

Contact Add

Create new contact.

### Example

```ts
import {
  Configuration,
  ContactAboutUsApi,
} from '';
import type { ContactAddApiV1ContentContactPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContactAboutUsApi(config);

  const body = {
    // ContactIn
    contactIn: ...,
  } satisfies ContactAddApiV1ContentContactPostRequest;

  try {
    const data = await api.contactAddApiV1ContentContactPost(body);
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
| **contactIn** | [ContactIn](ContactIn.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## contactEditApiV1ContentContactPut

> any contactEditApiV1ContentContactPut(id, contactIn)

Contact Edit

Update contact.

### Example

```ts
import {
  Configuration,
  ContactAboutUsApi,
} from '';
import type { ContactEditApiV1ContentContactPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContactAboutUsApi(config);

  const body = {
    // number
    id: 56,
    // ContactIn
    contactIn: ...,
  } satisfies ContactEditApiV1ContentContactPutRequest;

  try {
    const data = await api.contactEditApiV1ContentContactPut(body);
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
| **contactIn** | [ContactIn](ContactIn.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## contactGetInfoApiV1ContentContactItemIdGet

> any contactGetInfoApiV1ContentContactItemIdGet(itemId)

Contact Get Info

Get contact detail by ID.

### Example

```ts
import {
  Configuration,
  ContactAboutUsApi,
} from '';
import type { ContactGetInfoApiV1ContentContactItemIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContactAboutUsApi();

  const body = {
    // number
    itemId: 56,
  } satisfies ContactGetInfoApiV1ContentContactItemIdGetRequest;

  try {
    const data = await api.contactGetInfoApiV1ContentContactItemIdGet(body);
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


## contactListApiV1ContentContactListGet

> any contactListApiV1ContentContactListGet(pageNum, pageSize)

Contact List

List contacts with pagination.

### Example

```ts
import {
  Configuration,
  ContactAboutUsApi,
} from '';
import type { ContactListApiV1ContentContactListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContactAboutUsApi();

  const body = {
    // number (optional)
    pageNum: 56,
    // number (optional)
    pageSize: 56,
  } satisfies ContactListApiV1ContentContactListGetRequest;

  try {
    const data = await api.contactListApiV1ContentContactListGet(body);
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
| **pageNum** | `number` |  | [Optional] [Defaults to `1`] |
| **pageSize** | `number` |  | [Optional] [Defaults to `10`] |

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


## contactRemoveApiV1ContentContactItemIdsDelete

> any contactRemoveApiV1ContentContactItemIdsDelete(itemIds)

Contact Remove

Delete contacts by comma-separated IDs.  Fixed: Use parameterized queries to prevent SQL injection. IDs are validated as integers before use.

### Example

```ts
import {
  Configuration,
  ContactAboutUsApi,
} from '';
import type { ContactRemoveApiV1ContentContactItemIdsDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContactAboutUsApi(config);

  const body = {
    // string
    itemIds: itemIds_example,
  } satisfies ContactRemoveApiV1ContentContactItemIdsDeleteRequest;

  try {
    const data = await api.contactRemoveApiV1ContentContactItemIdsDelete(body);
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

