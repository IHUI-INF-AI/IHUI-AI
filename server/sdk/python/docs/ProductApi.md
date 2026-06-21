# zhs_api.ProductApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_product_api_v1_zhs_product_post**](ProductApi.md#create_product_api_v1_zhs_product_post) | **POST** /api/v1/zhs_product | Create product
[**delete_products_api_v1_zhs_product_item_ids_delete**](ProductApi.md#delete_products_api_v1_zhs_product_item_ids_delete) | **DELETE** /api/v1/zhs_product/{item_ids} | Delete products
[**get_product_api_v1_zhs_product_item_id_get**](ProductApi.md#get_product_api_v1_zhs_product_item_id_get) | **GET** /api/v1/zhs_product/{item_id} | Get product detail
[**list_products_api_v1_zhs_product_list_get**](ProductApi.md#list_products_api_v1_zhs_product_list_get) | **GET** /api/v1/zhs_product/list | List products
[**update_product_api_v1_zhs_product_put**](ProductApi.md#update_product_api_v1_zhs_product_put) | **PUT** /api/v1/zhs_product | Update product


# **create_product_api_v1_zhs_product_post**
> object create_product_api_v1_zhs_product_post(product_create)

Create product

### Example


```python
import zhs_api
from zhs_api.models.product_create import ProductCreate
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.ProductApi(api_client)
    product_create = zhs_api.ProductCreate() # ProductCreate | 

    try:
        # Create product
        api_response = api_instance.create_product_api_v1_zhs_product_post(product_create)
        print("The response of ProductApi->create_product_api_v1_zhs_product_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ProductApi->create_product_api_v1_zhs_product_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **product_create** | [**ProductCreate**](ProductCreate.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_products_api_v1_zhs_product_item_ids_delete**
> object delete_products_api_v1_zhs_product_item_ids_delete(item_ids)

Delete products

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.ProductApi(api_client)
    item_ids = 'item_ids_example' # str | 

    try:
        # Delete products
        api_response = api_instance.delete_products_api_v1_zhs_product_item_ids_delete(item_ids)
        print("The response of ProductApi->delete_products_api_v1_zhs_product_item_ids_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ProductApi->delete_products_api_v1_zhs_product_item_ids_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **item_ids** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_product_api_v1_zhs_product_item_id_get**
> object get_product_api_v1_zhs_product_item_id_get(item_id)

Get product detail

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.ProductApi(api_client)
    item_id = 'item_id_example' # str | 

    try:
        # Get product detail
        api_response = api_instance.get_product_api_v1_zhs_product_item_id_get(item_id)
        print("The response of ProductApi->get_product_api_v1_zhs_product_item_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ProductApi->get_product_api_v1_zhs_product_item_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **item_id** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_products_api_v1_zhs_product_list_get**
> object list_products_api_v1_zhs_product_list_get(page=page, limit=limit, name=name, type=type, status=status)

List products

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.ProductApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    name = 'name_example' # str |  (optional)
    type = 'type_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # List products
        api_response = api_instance.list_products_api_v1_zhs_product_list_get(page=page, limit=limit, name=name, type=type, status=status)
        print("The response of ProductApi->list_products_api_v1_zhs_product_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ProductApi->list_products_api_v1_zhs_product_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **name** | **str**|  | [optional] 
 **type** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **update_product_api_v1_zhs_product_put**
> object update_product_api_v1_zhs_product_put(product_update)

Update product

### Example


```python
import zhs_api
from zhs_api.models.product_update import ProductUpdate
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.ProductApi(api_client)
    product_update = zhs_api.ProductUpdate() # ProductUpdate | 

    try:
        # Update product
        api_response = api_instance.update_product_api_v1_zhs_product_put(product_update)
        print("The response of ProductApi->update_product_api_v1_zhs_product_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ProductApi->update_product_api_v1_zhs_product_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **product_update** | [**ProductUpdate**](ProductUpdate.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

