# zhs_api.DoubaoImageEditApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**doubao_image_edit**](DoubaoImageEditApi.md#doubao_image_edit) | **POST** /api/v1/doubao-image-edit/image-edit | 豆包图片编辑
[**doubao_image_edit_0**](DoubaoImageEditApi.md#doubao_image_edit_0) | **POST** /api/v1/doubao-image-edit/image-edit | 豆包图片编辑
[**doubao_image_edit_list_models**](DoubaoImageEditApi.md#doubao_image_edit_list_models) | **GET** /api/v1/doubao-image-edit/models | 豆包可用模型
[**doubao_image_edit_list_models_0**](DoubaoImageEditApi.md#doubao_image_edit_list_models_0) | **GET** /api/v1/doubao-image-edit/models | 豆包可用模型
[**image_generate_api_v1_doubao_image_edit_image_generate_post**](DoubaoImageEditApi.md#image_generate_api_v1_doubao_image_edit_image_generate_post) | **POST** /api/v1/doubao-image-edit/image-generate | 豆包文生图
[**image_generate_api_v1_doubao_image_edit_image_generate_post_0**](DoubaoImageEditApi.md#image_generate_api_v1_doubao_image_edit_image_generate_post_0) | **POST** /api/v1/doubao-image-edit/image-generate | 豆包文生图


# **doubao_image_edit**
> object doubao_image_edit(body_doubao_image_edit, api_key=api_key)

豆包图片编辑

### Example


```python
import zhs_api
from zhs_api.models.body_doubao_image_edit import BodyDoubaoImageEdit
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
    api_instance = zhs_api.DoubaoImageEditApi(api_client)
    body_doubao_image_edit = zhs_api.BodyDoubaoImageEdit() # BodyDoubaoImageEdit | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 豆包图片编辑
        api_response = api_instance.doubao_image_edit(body_doubao_image_edit, api_key=api_key)
        print("The response of DoubaoImageEditApi->doubao_image_edit:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DoubaoImageEditApi->doubao_image_edit: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_doubao_image_edit** | [**BodyDoubaoImageEdit**](BodyDoubaoImageEdit.md)|  | 
 **api_key** | **str**|  | [optional] 

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

# **doubao_image_edit_0**
> object doubao_image_edit_0(body_doubao_image_edit, api_key=api_key)

豆包图片编辑

### Example


```python
import zhs_api
from zhs_api.models.body_doubao_image_edit import BodyDoubaoImageEdit
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
    api_instance = zhs_api.DoubaoImageEditApi(api_client)
    body_doubao_image_edit = zhs_api.BodyDoubaoImageEdit() # BodyDoubaoImageEdit | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 豆包图片编辑
        api_response = api_instance.doubao_image_edit_0(body_doubao_image_edit, api_key=api_key)
        print("The response of DoubaoImageEditApi->doubao_image_edit_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DoubaoImageEditApi->doubao_image_edit_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_doubao_image_edit** | [**BodyDoubaoImageEdit**](BodyDoubaoImageEdit.md)|  | 
 **api_key** | **str**|  | [optional] 

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

# **doubao_image_edit_list_models**
> object doubao_image_edit_list_models()

豆包可用模型

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
    api_instance = zhs_api.DoubaoImageEditApi(api_client)

    try:
        # 豆包可用模型
        api_response = api_instance.doubao_image_edit_list_models()
        print("The response of DoubaoImageEditApi->doubao_image_edit_list_models:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DoubaoImageEditApi->doubao_image_edit_list_models: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **doubao_image_edit_list_models_0**
> object doubao_image_edit_list_models_0()

豆包可用模型

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
    api_instance = zhs_api.DoubaoImageEditApi(api_client)

    try:
        # 豆包可用模型
        api_response = api_instance.doubao_image_edit_list_models_0()
        print("The response of DoubaoImageEditApi->doubao_image_edit_list_models_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DoubaoImageEditApi->doubao_image_edit_list_models_0: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **image_generate_api_v1_doubao_image_edit_image_generate_post**
> object image_generate_api_v1_doubao_image_edit_image_generate_post(body_image_generate_api_v1_doubao_image_edit_image_generate_post, api_key=api_key)

豆包文生图

### Example


```python
import zhs_api
from zhs_api.models.body_image_generate_api_v1_doubao_image_edit_image_generate_post import BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost
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
    api_instance = zhs_api.DoubaoImageEditApi(api_client)
    body_image_generate_api_v1_doubao_image_edit_image_generate_post = zhs_api.BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost() # BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 豆包文生图
        api_response = api_instance.image_generate_api_v1_doubao_image_edit_image_generate_post(body_image_generate_api_v1_doubao_image_edit_image_generate_post, api_key=api_key)
        print("The response of DoubaoImageEditApi->image_generate_api_v1_doubao_image_edit_image_generate_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DoubaoImageEditApi->image_generate_api_v1_doubao_image_edit_image_generate_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_image_generate_api_v1_doubao_image_edit_image_generate_post** | [**BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost**](BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost.md)|  | 
 **api_key** | **str**|  | [optional] 

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

# **image_generate_api_v1_doubao_image_edit_image_generate_post_0**
> object image_generate_api_v1_doubao_image_edit_image_generate_post_0(body_image_generate_api_v1_doubao_image_edit_image_generate_post, api_key=api_key)

豆包文生图

### Example


```python
import zhs_api
from zhs_api.models.body_image_generate_api_v1_doubao_image_edit_image_generate_post import BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost
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
    api_instance = zhs_api.DoubaoImageEditApi(api_client)
    body_image_generate_api_v1_doubao_image_edit_image_generate_post = zhs_api.BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost() # BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 豆包文生图
        api_response = api_instance.image_generate_api_v1_doubao_image_edit_image_generate_post_0(body_image_generate_api_v1_doubao_image_edit_image_generate_post, api_key=api_key)
        print("The response of DoubaoImageEditApi->image_generate_api_v1_doubao_image_edit_image_generate_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DoubaoImageEditApi->image_generate_api_v1_doubao_image_edit_image_generate_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_image_generate_api_v1_doubao_image_edit_image_generate_post** | [**BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost**](BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost.md)|  | 
 **api_key** | **str**|  | [optional] 

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

