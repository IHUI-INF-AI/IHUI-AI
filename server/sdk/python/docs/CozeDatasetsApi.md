# zhs_api.CozeDatasetsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_dataset_api_v1_coze_datasets_datasets_post**](CozeDatasetsApi.md#create_dataset_api_v1_coze_datasets_datasets_post) | **POST** /api/v1/coze/datasets/datasets | Create Dataset
[**list_datasets_api_v1_coze_datasets_datasets_list_post**](CozeDatasetsApi.md#list_datasets_api_v1_coze_datasets_datasets_list_post) | **POST** /api/v1/coze/datasets/datasets/list | List Datasets
[**list_documents_api_v1_coze_datasets_datasets_documents_list_post**](CozeDatasetsApi.md#list_documents_api_v1_coze_datasets_datasets_documents_list_post) | **POST** /api/v1/coze/datasets/datasets/documents/list | List Documents
[**list_images_api_v1_coze_datasets_datasets_images_list_post**](CozeDatasetsApi.md#list_images_api_v1_coze_datasets_datasets_images_list_post) | **POST** /api/v1/coze/datasets/datasets/images/list | List Images
[**upload_document_api_v1_coze_datasets_datasets_documents_upload_post**](CozeDatasetsApi.md#upload_document_api_v1_coze_datasets_datasets_documents_upload_post) | **POST** /api/v1/coze/datasets/datasets/documents/upload | Upload Document
[**upload_image_api_v1_coze_datasets_datasets_images_upload_post**](CozeDatasetsApi.md#upload_image_api_v1_coze_datasets_datasets_images_upload_post) | **POST** /api/v1/coze/datasets/datasets/images/upload | Upload Image


# **create_dataset_api_v1_coze_datasets_datasets_post**
> object create_dataset_api_v1_coze_datasets_datasets_post(dataset_create_req)

Create Dataset

### Example


```python
import zhs_api
from zhs_api.models.dataset_create_req import DatasetCreateReq
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
    api_instance = zhs_api.CozeDatasetsApi(api_client)
    dataset_create_req = zhs_api.DatasetCreateReq() # DatasetCreateReq | 

    try:
        # Create Dataset
        api_response = api_instance.create_dataset_api_v1_coze_datasets_datasets_post(dataset_create_req)
        print("The response of CozeDatasetsApi->create_dataset_api_v1_coze_datasets_datasets_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeDatasetsApi->create_dataset_api_v1_coze_datasets_datasets_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dataset_create_req** | [**DatasetCreateReq**](DatasetCreateReq.md)|  | 

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

# **list_datasets_api_v1_coze_datasets_datasets_list_post**
> object list_datasets_api_v1_coze_datasets_datasets_list_post(dataset_list_req)

List Datasets

### Example


```python
import zhs_api
from zhs_api.models.dataset_list_req import DatasetListReq
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
    api_instance = zhs_api.CozeDatasetsApi(api_client)
    dataset_list_req = zhs_api.DatasetListReq() # DatasetListReq | 

    try:
        # List Datasets
        api_response = api_instance.list_datasets_api_v1_coze_datasets_datasets_list_post(dataset_list_req)
        print("The response of CozeDatasetsApi->list_datasets_api_v1_coze_datasets_datasets_list_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeDatasetsApi->list_datasets_api_v1_coze_datasets_datasets_list_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dataset_list_req** | [**DatasetListReq**](DatasetListReq.md)|  | 

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

# **list_documents_api_v1_coze_datasets_datasets_documents_list_post**
> object list_documents_api_v1_coze_datasets_datasets_documents_list_post(doc_list_req)

List Documents

### Example


```python
import zhs_api
from zhs_api.models.doc_list_req import DocListReq
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
    api_instance = zhs_api.CozeDatasetsApi(api_client)
    doc_list_req = zhs_api.DocListReq() # DocListReq | 

    try:
        # List Documents
        api_response = api_instance.list_documents_api_v1_coze_datasets_datasets_documents_list_post(doc_list_req)
        print("The response of CozeDatasetsApi->list_documents_api_v1_coze_datasets_datasets_documents_list_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeDatasetsApi->list_documents_api_v1_coze_datasets_datasets_documents_list_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **doc_list_req** | [**DocListReq**](DocListReq.md)|  | 

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

# **list_images_api_v1_coze_datasets_datasets_images_list_post**
> object list_images_api_v1_coze_datasets_datasets_images_list_post(image_list_req)

List Images

### Example


```python
import zhs_api
from zhs_api.models.image_list_req import ImageListReq
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
    api_instance = zhs_api.CozeDatasetsApi(api_client)
    image_list_req = zhs_api.ImageListReq() # ImageListReq | 

    try:
        # List Images
        api_response = api_instance.list_images_api_v1_coze_datasets_datasets_images_list_post(image_list_req)
        print("The response of CozeDatasetsApi->list_images_api_v1_coze_datasets_datasets_images_list_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeDatasetsApi->list_images_api_v1_coze_datasets_datasets_images_list_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **image_list_req** | [**ImageListReq**](ImageListReq.md)|  | 

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

# **upload_document_api_v1_coze_datasets_datasets_documents_upload_post**
> object upload_document_api_v1_coze_datasets_datasets_documents_upload_post(dataset_id, file)

Upload Document

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
    api_instance = zhs_api.CozeDatasetsApi(api_client)
    dataset_id = 'dataset_id_example' # str | 
    file = None # bytes | 

    try:
        # Upload Document
        api_response = api_instance.upload_document_api_v1_coze_datasets_datasets_documents_upload_post(dataset_id, file)
        print("The response of CozeDatasetsApi->upload_document_api_v1_coze_datasets_datasets_documents_upload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeDatasetsApi->upload_document_api_v1_coze_datasets_datasets_documents_upload_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dataset_id** | **str**|  | 
 **file** | **bytes**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **upload_image_api_v1_coze_datasets_datasets_images_upload_post**
> object upload_image_api_v1_coze_datasets_datasets_images_upload_post(dataset_id, file)

Upload Image

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
    api_instance = zhs_api.CozeDatasetsApi(api_client)
    dataset_id = 'dataset_id_example' # str | 
    file = None # bytes | 

    try:
        # Upload Image
        api_response = api_instance.upload_image_api_v1_coze_datasets_datasets_images_upload_post(dataset_id, file)
        print("The response of CozeDatasetsApi->upload_image_api_v1_coze_datasets_datasets_images_upload_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeDatasetsApi->upload_image_api_v1_coze_datasets_datasets_images_upload_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dataset_id** | **str**|  | 
 **file** | **bytes**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

