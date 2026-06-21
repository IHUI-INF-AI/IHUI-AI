# VisualGenericRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** | Generation prompt | 
**Images** | Pointer to **[]string** | Image URLs for i2v tasks | [optional] 
**UserUuid** | **string** | User UUID | 
**ChatId** | Pointer to **NullableString** | Chat context ID | [optional] 
**First** | Pointer to **bool** | Whether first-frame generation | [optional] [default to true]
**Zidingyican** | Pointer to [**[]AppApiV1AiDoubaoRouteCustomParameter**](AppApiV1AiDoubaoRouteCustomParameter.md) | Custom parameters | [optional] 

## Methods

### NewVisualGenericRequest

`func NewVisualGenericRequest(prompt string, userUuid string, ) *VisualGenericRequest`

NewVisualGenericRequest instantiates a new VisualGenericRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewVisualGenericRequestWithDefaults

`func NewVisualGenericRequestWithDefaults() *VisualGenericRequest`

NewVisualGenericRequestWithDefaults instantiates a new VisualGenericRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *VisualGenericRequest) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *VisualGenericRequest) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *VisualGenericRequest) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetImages

`func (o *VisualGenericRequest) GetImages() []string`

GetImages returns the Images field if non-nil, zero value otherwise.

### GetImagesOk

`func (o *VisualGenericRequest) GetImagesOk() (*[]string, bool)`

GetImagesOk returns a tuple with the Images field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImages

`func (o *VisualGenericRequest) SetImages(v []string)`

SetImages sets Images field to given value.

### HasImages

`func (o *VisualGenericRequest) HasImages() bool`

HasImages returns a boolean if a field has been set.

### SetImagesNil

`func (o *VisualGenericRequest) SetImagesNil(b bool)`

 SetImagesNil sets the value for Images to be an explicit nil

### UnsetImages
`func (o *VisualGenericRequest) UnsetImages()`

UnsetImages ensures that no value is present for Images, not even an explicit nil
### GetUserUuid

`func (o *VisualGenericRequest) GetUserUuid() string`

GetUserUuid returns the UserUuid field if non-nil, zero value otherwise.

### GetUserUuidOk

`func (o *VisualGenericRequest) GetUserUuidOk() (*string, bool)`

GetUserUuidOk returns a tuple with the UserUuid field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserUuid

`func (o *VisualGenericRequest) SetUserUuid(v string)`

SetUserUuid sets UserUuid field to given value.


### GetChatId

`func (o *VisualGenericRequest) GetChatId() string`

GetChatId returns the ChatId field if non-nil, zero value otherwise.

### GetChatIdOk

`func (o *VisualGenericRequest) GetChatIdOk() (*string, bool)`

GetChatIdOk returns a tuple with the ChatId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChatId

`func (o *VisualGenericRequest) SetChatId(v string)`

SetChatId sets ChatId field to given value.

### HasChatId

`func (o *VisualGenericRequest) HasChatId() bool`

HasChatId returns a boolean if a field has been set.

### SetChatIdNil

`func (o *VisualGenericRequest) SetChatIdNil(b bool)`

 SetChatIdNil sets the value for ChatId to be an explicit nil

### UnsetChatId
`func (o *VisualGenericRequest) UnsetChatId()`

UnsetChatId ensures that no value is present for ChatId, not even an explicit nil
### GetFirst

`func (o *VisualGenericRequest) GetFirst() bool`

GetFirst returns the First field if non-nil, zero value otherwise.

### GetFirstOk

`func (o *VisualGenericRequest) GetFirstOk() (*bool, bool)`

GetFirstOk returns a tuple with the First field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFirst

`func (o *VisualGenericRequest) SetFirst(v bool)`

SetFirst sets First field to given value.

### HasFirst

`func (o *VisualGenericRequest) HasFirst() bool`

HasFirst returns a boolean if a field has been set.

### GetZidingyican

`func (o *VisualGenericRequest) GetZidingyican() []AppApiV1AiDoubaoRouteCustomParameter`

GetZidingyican returns the Zidingyican field if non-nil, zero value otherwise.

### GetZidingyicanOk

`func (o *VisualGenericRequest) GetZidingyicanOk() (*[]AppApiV1AiDoubaoRouteCustomParameter, bool)`

GetZidingyicanOk returns a tuple with the Zidingyican field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetZidingyican

`func (o *VisualGenericRequest) SetZidingyican(v []AppApiV1AiDoubaoRouteCustomParameter)`

SetZidingyican sets Zidingyican field to given value.

### HasZidingyican

`func (o *VisualGenericRequest) HasZidingyican() bool`

HasZidingyican returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


