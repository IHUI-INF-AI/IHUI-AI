# zhs_api.TBoxApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**activate_device_api_v1_tbox_device_device_no_activate_post**](TBoxApi.md#activate_device_api_v1_tbox_device_device_no_activate_post) | **POST** /api/v1/tbox/device/{device_no}/activate | 激活设备
[**activate_device_api_v1_tbox_device_device_no_activate_post_0**](TBoxApi.md#activate_device_api_v1_tbox_device_device_no_activate_post_0) | **POST** /api/v1/tbox/device/{device_no}/activate | 激活设备
[**get_device_api_v1_tbox_device_device_no_get**](TBoxApi.md#get_device_api_v1_tbox_device_device_no_get) | **GET** /api/v1/tbox/device/{device_no} | 设备详情
[**get_device_api_v1_tbox_device_device_no_get_0**](TBoxApi.md#get_device_api_v1_tbox_device_device_no_get_0) | **GET** /api/v1/tbox/device/{device_no} | 设备详情
[**heartbeat_api_v1_tbox_device_heartbeat_post**](TBoxApi.md#heartbeat_api_v1_tbox_device_heartbeat_post) | **POST** /api/v1/tbox/device/heartbeat | 设备心跳
[**heartbeat_api_v1_tbox_device_heartbeat_post_0**](TBoxApi.md#heartbeat_api_v1_tbox_device_heartbeat_post_0) | **POST** /api/v1/tbox/device/heartbeat | 设备心跳
[**list_commands_api_v1_tbox_command_list_get**](TBoxApi.md#list_commands_api_v1_tbox_command_list_get) | **GET** /api/v1/tbox/command/list | 指令列表
[**list_commands_api_v1_tbox_command_list_get_0**](TBoxApi.md#list_commands_api_v1_tbox_command_list_get_0) | **GET** /api/v1/tbox/command/list | 指令列表
[**list_devices_api_v1_tbox_device_list_get**](TBoxApi.md#list_devices_api_v1_tbox_device_list_get) | **GET** /api/v1/tbox/device/list | 设备列表
[**list_devices_api_v1_tbox_device_list_get_0**](TBoxApi.md#list_devices_api_v1_tbox_device_list_get_0) | **GET** /api/v1/tbox/device/list | 设备列表
[**register_device_api_v1_tbox_device_post**](TBoxApi.md#register_device_api_v1_tbox_device_post) | **POST** /api/v1/tbox/device | 注册设备
[**register_device_api_v1_tbox_device_post_0**](TBoxApi.md#register_device_api_v1_tbox_device_post_0) | **POST** /api/v1/tbox/device | 注册设备
[**send_command_api_v1_tbox_device_device_no_command_post**](TBoxApi.md#send_command_api_v1_tbox_device_device_no_command_post) | **POST** /api/v1/tbox/device/{device_no}/command | 下发指令
[**send_command_api_v1_tbox_device_device_no_command_post_0**](TBoxApi.md#send_command_api_v1_tbox_device_device_no_command_post_0) | **POST** /api/v1/tbox/device/{device_no}/command | 下发指令


# **activate_device_api_v1_tbox_device_device_no_activate_post**
> object activate_device_api_v1_tbox_device_device_no_activate_post(device_no, user_id, user_name=user_name)

激活设备

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
    api_instance = zhs_api.TBoxApi(api_client)
    device_no = 'device_no_example' # str | 
    user_id = 'user_id_example' # str | 
    user_name = 'user_name_example' # str |  (optional)

    try:
        # 激活设备
        api_response = api_instance.activate_device_api_v1_tbox_device_device_no_activate_post(device_no, user_id, user_name=user_name)
        print("The response of TBoxApi->activate_device_api_v1_tbox_device_device_no_activate_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->activate_device_api_v1_tbox_device_device_no_activate_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **device_no** | **str**|  | 
 **user_id** | **str**|  | 
 **user_name** | **str**|  | [optional] 

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

# **activate_device_api_v1_tbox_device_device_no_activate_post_0**
> object activate_device_api_v1_tbox_device_device_no_activate_post_0(device_no, user_id, user_name=user_name)

激活设备

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
    api_instance = zhs_api.TBoxApi(api_client)
    device_no = 'device_no_example' # str | 
    user_id = 'user_id_example' # str | 
    user_name = 'user_name_example' # str |  (optional)

    try:
        # 激活设备
        api_response = api_instance.activate_device_api_v1_tbox_device_device_no_activate_post_0(device_no, user_id, user_name=user_name)
        print("The response of TBoxApi->activate_device_api_v1_tbox_device_device_no_activate_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->activate_device_api_v1_tbox_device_device_no_activate_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **device_no** | **str**|  | 
 **user_id** | **str**|  | 
 **user_name** | **str**|  | [optional] 

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

# **get_device_api_v1_tbox_device_device_no_get**
> object get_device_api_v1_tbox_device_device_no_get(device_no)

设备详情

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
    api_instance = zhs_api.TBoxApi(api_client)
    device_no = 'device_no_example' # str | 

    try:
        # 设备详情
        api_response = api_instance.get_device_api_v1_tbox_device_device_no_get(device_no)
        print("The response of TBoxApi->get_device_api_v1_tbox_device_device_no_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->get_device_api_v1_tbox_device_device_no_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **device_no** | **str**|  | 

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

# **get_device_api_v1_tbox_device_device_no_get_0**
> object get_device_api_v1_tbox_device_device_no_get_0(device_no)

设备详情

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
    api_instance = zhs_api.TBoxApi(api_client)
    device_no = 'device_no_example' # str | 

    try:
        # 设备详情
        api_response = api_instance.get_device_api_v1_tbox_device_device_no_get_0(device_no)
        print("The response of TBoxApi->get_device_api_v1_tbox_device_device_no_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->get_device_api_v1_tbox_device_device_no_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **device_no** | **str**|  | 

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

# **heartbeat_api_v1_tbox_device_heartbeat_post**
> object heartbeat_api_v1_tbox_device_heartbeat_post(device_no, is_online=is_online, signal_strength=signal_strength, battery=battery, location=location)

设备心跳

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
    api_instance = zhs_api.TBoxApi(api_client)
    device_no = 'device_no_example' # str | 
    is_online = True # bool |  (optional) (default to True)
    signal_strength = 0 # int |  (optional) (default to 0)
    battery = 0 # int |  (optional) (default to 0)
    location = 'location_example' # str |  (optional)

    try:
        # 设备心跳
        api_response = api_instance.heartbeat_api_v1_tbox_device_heartbeat_post(device_no, is_online=is_online, signal_strength=signal_strength, battery=battery, location=location)
        print("The response of TBoxApi->heartbeat_api_v1_tbox_device_heartbeat_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->heartbeat_api_v1_tbox_device_heartbeat_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **device_no** | **str**|  | 
 **is_online** | **bool**|  | [optional] [default to True]
 **signal_strength** | **int**|  | [optional] [default to 0]
 **battery** | **int**|  | [optional] [default to 0]
 **location** | **str**|  | [optional] 

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

# **heartbeat_api_v1_tbox_device_heartbeat_post_0**
> object heartbeat_api_v1_tbox_device_heartbeat_post_0(device_no, is_online=is_online, signal_strength=signal_strength, battery=battery, location=location)

设备心跳

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
    api_instance = zhs_api.TBoxApi(api_client)
    device_no = 'device_no_example' # str | 
    is_online = True # bool |  (optional) (default to True)
    signal_strength = 0 # int |  (optional) (default to 0)
    battery = 0 # int |  (optional) (default to 0)
    location = 'location_example' # str |  (optional)

    try:
        # 设备心跳
        api_response = api_instance.heartbeat_api_v1_tbox_device_heartbeat_post_0(device_no, is_online=is_online, signal_strength=signal_strength, battery=battery, location=location)
        print("The response of TBoxApi->heartbeat_api_v1_tbox_device_heartbeat_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->heartbeat_api_v1_tbox_device_heartbeat_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **device_no** | **str**|  | 
 **is_online** | **bool**|  | [optional] [default to True]
 **signal_strength** | **int**|  | [optional] [default to 0]
 **battery** | **int**|  | [optional] [default to 0]
 **location** | **str**|  | [optional] 

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

# **list_commands_api_v1_tbox_command_list_get**
> object list_commands_api_v1_tbox_command_list_get(page=page, limit=limit, device_no=device_no, status=status)

指令列表

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
    api_instance = zhs_api.TBoxApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    device_no = 'device_no_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # 指令列表
        api_response = api_instance.list_commands_api_v1_tbox_command_list_get(page=page, limit=limit, device_no=device_no, status=status)
        print("The response of TBoxApi->list_commands_api_v1_tbox_command_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->list_commands_api_v1_tbox_command_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **device_no** | **str**|  | [optional] 
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

# **list_commands_api_v1_tbox_command_list_get_0**
> object list_commands_api_v1_tbox_command_list_get_0(page=page, limit=limit, device_no=device_no, status=status)

指令列表

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
    api_instance = zhs_api.TBoxApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    device_no = 'device_no_example' # str |  (optional)
    status = 56 # int |  (optional)

    try:
        # 指令列表
        api_response = api_instance.list_commands_api_v1_tbox_command_list_get_0(page=page, limit=limit, device_no=device_no, status=status)
        print("The response of TBoxApi->list_commands_api_v1_tbox_command_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->list_commands_api_v1_tbox_command_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **device_no** | **str**|  | [optional] 
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

# **list_devices_api_v1_tbox_device_list_get**
> object list_devices_api_v1_tbox_device_list_get(page=page, limit=limit, user_id=user_id, device_type=device_type, status=status, is_online=is_online)

设备列表

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
    api_instance = zhs_api.TBoxApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_id = 'user_id_example' # str |  (optional)
    device_type = 'device_type_example' # str |  (optional)
    status = 56 # int |  (optional)
    is_online = True # bool |  (optional)

    try:
        # 设备列表
        api_response = api_instance.list_devices_api_v1_tbox_device_list_get(page=page, limit=limit, user_id=user_id, device_type=device_type, status=status, is_online=is_online)
        print("The response of TBoxApi->list_devices_api_v1_tbox_device_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->list_devices_api_v1_tbox_device_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_id** | **str**|  | [optional] 
 **device_type** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
 **is_online** | **bool**|  | [optional] 

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

# **list_devices_api_v1_tbox_device_list_get_0**
> object list_devices_api_v1_tbox_device_list_get_0(page=page, limit=limit, user_id=user_id, device_type=device_type, status=status, is_online=is_online)

设备列表

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
    api_instance = zhs_api.TBoxApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)
    user_id = 'user_id_example' # str |  (optional)
    device_type = 'device_type_example' # str |  (optional)
    status = 56 # int |  (optional)
    is_online = True # bool |  (optional)

    try:
        # 设备列表
        api_response = api_instance.list_devices_api_v1_tbox_device_list_get_0(page=page, limit=limit, user_id=user_id, device_type=device_type, status=status, is_online=is_online)
        print("The response of TBoxApi->list_devices_api_v1_tbox_device_list_get_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->list_devices_api_v1_tbox_device_list_get_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 20]
 **user_id** | **str**|  | [optional] 
 **device_type** | **str**|  | [optional] 
 **status** | **int**|  | [optional] 
 **is_online** | **bool**|  | [optional] 

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

# **register_device_api_v1_tbox_device_post**
> object register_device_api_v1_tbox_device_post(device_no, device_name=device_name, device_type=device_type, model=model, brand=brand, iccid=iccid, imei=imei, firmware=firmware)

注册设备

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
    api_instance = zhs_api.TBoxApi(api_client)
    device_no = 'device_no_example' # str | 
    device_name = 'device_name_example' # str |  (optional)
    device_type = 'tbox' # str |  (optional) (default to 'tbox')
    model = 'model_example' # str |  (optional)
    brand = 'brand_example' # str |  (optional)
    iccid = 'iccid_example' # str |  (optional)
    imei = 'imei_example' # str |  (optional)
    firmware = 'firmware_example' # str |  (optional)

    try:
        # 注册设备
        api_response = api_instance.register_device_api_v1_tbox_device_post(device_no, device_name=device_name, device_type=device_type, model=model, brand=brand, iccid=iccid, imei=imei, firmware=firmware)
        print("The response of TBoxApi->register_device_api_v1_tbox_device_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->register_device_api_v1_tbox_device_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **device_no** | **str**|  | 
 **device_name** | **str**|  | [optional] 
 **device_type** | **str**|  | [optional] [default to &#39;tbox&#39;]
 **model** | **str**|  | [optional] 
 **brand** | **str**|  | [optional] 
 **iccid** | **str**|  | [optional] 
 **imei** | **str**|  | [optional] 
 **firmware** | **str**|  | [optional] 

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

# **register_device_api_v1_tbox_device_post_0**
> object register_device_api_v1_tbox_device_post_0(device_no, device_name=device_name, device_type=device_type, model=model, brand=brand, iccid=iccid, imei=imei, firmware=firmware)

注册设备

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
    api_instance = zhs_api.TBoxApi(api_client)
    device_no = 'device_no_example' # str | 
    device_name = 'device_name_example' # str |  (optional)
    device_type = 'tbox' # str |  (optional) (default to 'tbox')
    model = 'model_example' # str |  (optional)
    brand = 'brand_example' # str |  (optional)
    iccid = 'iccid_example' # str |  (optional)
    imei = 'imei_example' # str |  (optional)
    firmware = 'firmware_example' # str |  (optional)

    try:
        # 注册设备
        api_response = api_instance.register_device_api_v1_tbox_device_post_0(device_no, device_name=device_name, device_type=device_type, model=model, brand=brand, iccid=iccid, imei=imei, firmware=firmware)
        print("The response of TBoxApi->register_device_api_v1_tbox_device_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->register_device_api_v1_tbox_device_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **device_no** | **str**|  | 
 **device_name** | **str**|  | [optional] 
 **device_type** | **str**|  | [optional] [default to &#39;tbox&#39;]
 **model** | **str**|  | [optional] 
 **brand** | **str**|  | [optional] 
 **iccid** | **str**|  | [optional] 
 **imei** | **str**|  | [optional] 
 **firmware** | **str**|  | [optional] 

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

# **send_command_api_v1_tbox_device_device_no_command_post**
> object send_command_api_v1_tbox_device_device_no_command_post(device_no, command, params=params)

下发指令

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
    api_instance = zhs_api.TBoxApi(api_client)
    device_no = 'device_no_example' # str | 
    command = 'command_example' # str | 
    params = 'params_example' # str |  (optional)

    try:
        # 下发指令
        api_response = api_instance.send_command_api_v1_tbox_device_device_no_command_post(device_no, command, params=params)
        print("The response of TBoxApi->send_command_api_v1_tbox_device_device_no_command_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->send_command_api_v1_tbox_device_device_no_command_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **device_no** | **str**|  | 
 **command** | **str**|  | 
 **params** | **str**|  | [optional] 

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

# **send_command_api_v1_tbox_device_device_no_command_post_0**
> object send_command_api_v1_tbox_device_device_no_command_post_0(device_no, command, params=params)

下发指令

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
    api_instance = zhs_api.TBoxApi(api_client)
    device_no = 'device_no_example' # str | 
    command = 'command_example' # str | 
    params = 'params_example' # str |  (optional)

    try:
        # 下发指令
        api_response = api_instance.send_command_api_v1_tbox_device_device_no_command_post_0(device_no, command, params=params)
        print("The response of TBoxApi->send_command_api_v1_tbox_device_device_no_command_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling TBoxApi->send_command_api_v1_tbox_device_device_no_command_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **device_no** | **str**|  | 
 **command** | **str**|  | 
 **params** | **str**|  | [optional] 

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

