# DoubaoImageRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** |  | 
**UserUuid** | **string** |  | 
**ChatId** | Pointer to **NullableString** |  | [optional] 
**Zidingyican** | Pointer to [**[]AppApiV1AiDoubaoRouteCustomParameter**](AppApiV1AiDoubaoRouteCustomParameter.md) | Custom parameters | [optional] 

## Methods

### NewDoubaoImageRequest

`func NewDoubaoImageRequest(prompt string, userUuid string, ) *DoubaoImageRequest`

NewDoubaoImageRequest instantiates a new DoubaoImageRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewDoubaoImageRequestWithDefaults

`func NewDoubaoImageRequestWithDefaults() *DoubaoImageRequest`

NewDoubaoImageRequestWithDefaults instantiates a new DoubaoImageRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *DoubaoImageRequest) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *DoubaoImageRequest) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *DoubaoImageRequest) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetUserUuid

`func (o *DoubaoImageRequest) GetUserUuid() string`

GetUserUuid returns the UserUuid field if non-nil, zero value otherwise.

### GetUserUuidOk

`func (o *DoubaoImageRequest) GetUserUuidOk() (*string, bool)`

GetUserUuidOk returns a tuple with the UserUuid field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserUuid

`func (o *DoubaoImageRequest) SetUserUuid(v string)`

SetUserUuid sets UserUuid field to given value.


### GetChatId

`func (o *DoubaoImageRequest) GetChatId() string`

GetChatId returns the ChatId field if non-nil, zero value otherwise.

### GetChatIdOk

`func (o *DoubaoImageRequest) GetChatIdOk() (*string, bool)`

GetChatIdOk returns a tuple with the ChatId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChatId

`func (o *DoubaoImageRequest) SetChatId(v string)`

SetChatId sets ChatId field to given value.

### HasChatId

`func (o *DoubaoImageRequest) HasChatId() bool`

HasChatId returns a boolean if a field has been set.

### SetChatIdNil

`func (o *DoubaoImageRequest) SetChatIdNil(b bool)`

 SetChatIdNil sets the value for ChatId to be an explicit nil

### UnsetChatId
`func (o *DoubaoImageRequest) UnsetChatId()`

UnsetChatId ensures that no value is present for ChatId, not even an explicit nil
### GetZidingyican

`func (o *DoubaoImageRequest) GetZidingyican() []AppApiV1AiDoubaoRouteCustomParameter`

GetZidingyican returns the Zidingyican field if non-nil, zero value otherwise.

### GetZidingyicanOk

`func (o *DoubaoImageRequest) GetZidingyicanOk() (*[]AppApiV1AiDoubaoRouteCustomParameter, bool)`

GetZidingyicanOk returns a tuple with the Zidingyican field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetZidingyican

`func (o *DoubaoImageRequest) SetZidingyican(v []AppApiV1AiDoubaoRouteCustomParameter)`

SetZidingyican sets Zidingyican field to given value.

### HasZidingyican

`func (o *DoubaoImageRequest) HasZidingyican() bool`

HasZidingyican returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


