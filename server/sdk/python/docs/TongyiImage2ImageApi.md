# zhs_api.TongyiImage2ImageApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**background_generation_api_v1_tongyi_image2image_background_generation_post**](TongyiImage2ImageApi.md#background_generation_api_v1_tongyi_image2image_background_generation_post) | **POST** /api/v1/tongyi-image2image/background-generation | 通义背景生成
[**background_generation_api_v1_tongyi_image2image_background_generation_post_0**](TongyiImage2ImageApi.md#background_generation_api_v1_tongyi_image2image_background_generation_post_0) | **POST** /api/v1/tongyi-image2image/background-generation | 通义背景生成
[**image_to_image_api_v1_tongyi_image2image_image_to_image_post**](TongyiImage2ImageApi.md#image_to_image_api_v1_tongyi_image2image_image_to_image_post) | **POST** /api/v1/tongyi-image2image/image-to-image | 通义图生图
[**image_to_image_api_v1_tongyi_image2image_image_to_image_post_0**](TongyiImage2ImageApi.md#image_to_image_api_v1_tongyi_image2image_image_to_image_post_0) | **POST** /api/v1/tongyi-image2image/image-to-image | 通义图生图
[**style_transfer_api_v1_tongyi_image2image_style_transfer_post**](TongyiImage2ImageApi.md#style_transfer_api_v1_tongyi_image2image_style_transfer_post) | **POST** /api/v1/tongyi-image2image/style-transfer | 通义风格迁移
[**style_transfer_api_v1_tongyi_image2image_style_transfer_post_0**](TongyiImage2ImageApi.md#style_transfer_api_v1_tongyi_image2image_style_transfer_post_0) | **POST** /api/v1/tongyi-image2image/style-transfer | 通义风格迁移
[**tongyi_image2image_list_models**](TongyiImage2ImageApi.md#tongyi_image2image_list_models) | **GET** /api/v1/tongyi-image2image/models | 通义图生图可用模型
[**tongyi_image2image_list_models_0**](TongyiImage2ImageApi.md#tongyi_image2image_list_models_0) | **GET** /api/v1/tongyi-image2image/models | 通义图生图可用模型
[**virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post**](TongyiImage2ImageApi.md#virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post) | **POST** /api/v1/tongyi-image2image/virtual-try-on | 通义虚拟试衣
[**virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post_0**](TongyiImage2ImageApi.md#virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post_0) | **POST** /api/v1/tongyi-image2image/virtual-try-on | 通义虚拟试衣


# **background_generation_api_v1_tongyi_image2image_background_generation_post**
> object background_generation_api_v1_tongyi_image2image_background_generation_post(body_background_generation_api_v1_tongyi_image2image_background_generation_post, api_key=api_key)

通义背景生成

### Example


```python
import zhs_api
from zhs_api.models.body_background_generation_api_v1_tongyi_image2image_background_generation_post import BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost
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
    api_instance = zhs_api.TongyiImage2ImageApi(api_client)
    body_background_generation_api_v1_tongyi_image2image_background_generation_post = zhs_api.BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost() # BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 通义背景生成
        api_response = api_instance.background_generation_api_v1_tongyi_image2image_background_generation_post(body_background_generation_api_v1_tongyi_image2image_background_generation_post, api_key=api_key)
        print("The response of TongyiImage2ImageApi->background_generation_api_v1_tongyi_image2image_background_generation_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImage2ImageApi->background_generation_api_v1_tongyi_image2image_background_generation_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_background_generation_api_v1_tongyi_image2image_background_generation_post** | [**BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**](BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost.md)|  | 
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

# **background_generation_api_v1_tongyi_image2image_background_generation_post_0**
> object background_generation_api_v1_tongyi_image2image_background_generation_post_0(body_background_generation_api_v1_tongyi_image2image_background_generation_post, api_key=api_key)

通义背景生成

### Example


```python
import zhs_api
from zhs_api.models.body_background_generation_api_v1_tongyi_image2image_background_generation_post import BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost
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
    api_instance = zhs_api.TongyiImage2ImageApi(api_client)
    body_background_generation_api_v1_tongyi_image2image_background_generation_post = zhs_api.BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost() # BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 通义背景生成
        api_response = api_instance.background_generation_api_v1_tongyi_image2image_background_generation_post_0(body_background_generation_api_v1_tongyi_image2image_background_generation_post, api_key=api_key)
        print("The response of TongyiImage2ImageApi->background_generation_api_v1_tongyi_image2image_background_generation_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImage2ImageApi->background_generation_api_v1_tongyi_image2image_background_generation_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_background_generation_api_v1_tongyi_image2image_background_generation_post** | [**BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost**](BodyBackgroundGenerationApiV1TongyiImage2imageBackgroundGenerationPost.md)|  | 
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

# **image_to_image_api_v1_tongyi_image2image_image_to_image_post**
> object image_to_image_api_v1_tongyi_image2image_image_to_image_post(body_image_to_image_api_v1_tongyi_image2image_image_to_image_post, api_key=api_key)

通义图生图

### Example


```python
import zhs_api
from zhs_api.models.body_image_to_image_api_v1_tongyi_image2image_image_to_image_post import BodyImageToImageApiV1TongyiImage2imageImageToImagePost
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
    api_instance = zhs_api.TongyiImage2ImageApi(api_client)
    body_image_to_image_api_v1_tongyi_image2image_image_to_image_post = zhs_api.BodyImageToImageApiV1TongyiImage2imageImageToImagePost() # BodyImageToImageApiV1TongyiImage2imageImageToImagePost | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 通义图生图
        api_response = api_instance.image_to_image_api_v1_tongyi_image2image_image_to_image_post(body_image_to_image_api_v1_tongyi_image2image_image_to_image_post, api_key=api_key)
        print("The response of TongyiImage2ImageApi->image_to_image_api_v1_tongyi_image2image_image_to_image_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImage2ImageApi->image_to_image_api_v1_tongyi_image2image_image_to_image_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_image_to_image_api_v1_tongyi_image2image_image_to_image_post** | [**BodyImageToImageApiV1TongyiImage2imageImageToImagePost**](BodyImageToImageApiV1TongyiImage2imageImageToImagePost.md)|  | 
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

# **image_to_image_api_v1_tongyi_image2image_image_to_image_post_0**
> object image_to_image_api_v1_tongyi_image2image_image_to_image_post_0(body_image_to_image_api_v1_tongyi_image2image_image_to_image_post, api_key=api_key)

通义图生图

### Example


```python
import zhs_api
from zhs_api.models.body_image_to_image_api_v1_tongyi_image2image_image_to_image_post import BodyImageToImageApiV1TongyiImage2imageImageToImagePost
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
    api_instance = zhs_api.TongyiImage2ImageApi(api_client)
    body_image_to_image_api_v1_tongyi_image2image_image_to_image_post = zhs_api.BodyImageToImageApiV1TongyiImage2imageImageToImagePost() # BodyImageToImageApiV1TongyiImage2imageImageToImagePost | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 通义图生图
        api_response = api_instance.image_to_image_api_v1_tongyi_image2image_image_to_image_post_0(body_image_to_image_api_v1_tongyi_image2image_image_to_image_post, api_key=api_key)
        print("The response of TongyiImage2ImageApi->image_to_image_api_v1_tongyi_image2image_image_to_image_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImage2ImageApi->image_to_image_api_v1_tongyi_image2image_image_to_image_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_image_to_image_api_v1_tongyi_image2image_image_to_image_post** | [**BodyImageToImageApiV1TongyiImage2imageImageToImagePost**](BodyImageToImageApiV1TongyiImage2imageImageToImagePost.md)|  | 
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

# **style_transfer_api_v1_tongyi_image2image_style_transfer_post**
> object style_transfer_api_v1_tongyi_image2image_style_transfer_post(body_style_transfer_api_v1_tongyi_image2image_style_transfer_post, api_key=api_key)

通义风格迁移

### Example


```python
import zhs_api
from zhs_api.models.body_style_transfer_api_v1_tongyi_image2image_style_transfer_post import BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost
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
    api_instance = zhs_api.TongyiImage2ImageApi(api_client)
    body_style_transfer_api_v1_tongyi_image2image_style_transfer_post = zhs_api.BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost() # BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 通义风格迁移
        api_response = api_instance.style_transfer_api_v1_tongyi_image2image_style_transfer_post(body_style_transfer_api_v1_tongyi_image2image_style_transfer_post, api_key=api_key)
        print("The response of TongyiImage2ImageApi->style_transfer_api_v1_tongyi_image2image_style_transfer_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImage2ImageApi->style_transfer_api_v1_tongyi_image2image_style_transfer_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_style_transfer_api_v1_tongyi_image2image_style_transfer_post** | [**BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost**](BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost.md)|  | 
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

# **style_transfer_api_v1_tongyi_image2image_style_transfer_post_0**
> object style_transfer_api_v1_tongyi_image2image_style_transfer_post_0(body_style_transfer_api_v1_tongyi_image2image_style_transfer_post, api_key=api_key)

通义风格迁移

### Example


```python
import zhs_api
from zhs_api.models.body_style_transfer_api_v1_tongyi_image2image_style_transfer_post import BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost
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
    api_instance = zhs_api.TongyiImage2ImageApi(api_client)
    body_style_transfer_api_v1_tongyi_image2image_style_transfer_post = zhs_api.BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost() # BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 通义风格迁移
        api_response = api_instance.style_transfer_api_v1_tongyi_image2image_style_transfer_post_0(body_style_transfer_api_v1_tongyi_image2image_style_transfer_post, api_key=api_key)
        print("The response of TongyiImage2ImageApi->style_transfer_api_v1_tongyi_image2image_style_transfer_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImage2ImageApi->style_transfer_api_v1_tongyi_image2image_style_transfer_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_style_transfer_api_v1_tongyi_image2image_style_transfer_post** | [**BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost**](BodyStyleTransferApiV1TongyiImage2imageStyleTransferPost.md)|  | 
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

# **tongyi_image2image_list_models**
> object tongyi_image2image_list_models()

通义图生图可用模型

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
    api_instance = zhs_api.TongyiImage2ImageApi(api_client)

    try:
        # 通义图生图可用模型
        api_response = api_instance.tongyi_image2image_list_models()
        print("The response of TongyiImage2ImageApi->tongyi_image2image_list_models:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImage2ImageApi->tongyi_image2image_list_models: %s\n" % e)
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

# **tongyi_image2image_list_models_0**
> object tongyi_image2image_list_models_0()

通义图生图可用模型

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
    api_instance = zhs_api.TongyiImage2ImageApi(api_client)

    try:
        # 通义图生图可用模型
        api_response = api_instance.tongyi_image2image_list_models_0()
        print("The response of TongyiImage2ImageApi->tongyi_image2image_list_models_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImage2ImageApi->tongyi_image2image_list_models_0: %s\n" % e)
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

# **virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post**
> object virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post(body_virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post, api_key=api_key)

通义虚拟试衣

### Example


```python
import zhs_api
from zhs_api.models.body_virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post import BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost
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
    api_instance = zhs_api.TongyiImage2ImageApi(api_client)
    body_virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post = zhs_api.BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost() # BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 通义虚拟试衣
        api_response = api_instance.virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post(body_virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post, api_key=api_key)
        print("The response of TongyiImage2ImageApi->virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImage2ImageApi->virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post** | [**BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**](BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost.md)|  | 
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

# **virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post_0**
> object virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post_0(body_virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post, api_key=api_key)

通义虚拟试衣

### Example


```python
import zhs_api
from zhs_api.models.body_virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post import BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost
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
    api_instance = zhs_api.TongyiImage2ImageApi(api_client)
    body_virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post = zhs_api.BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost() # BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost | 
    api_key = 'api_key_example' # str |  (optional)

    try:
        # 通义虚拟试衣
        api_response = api_instance.virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post_0(body_virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post, api_key=api_key)
        print("The response of TongyiImage2ImageApi->virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TongyiImage2ImageApi->virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body_virtual_try_on_api_v1_tongyi_image2image_virtual_try_on_post** | [**BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost**](BodyVirtualTryOnApiV1TongyiImage2imageVirtualTryOnPost.md)|  | 
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

