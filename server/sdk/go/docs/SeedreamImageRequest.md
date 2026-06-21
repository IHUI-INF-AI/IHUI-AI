# SeedreamImageRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** | Generation prompt, supports Chinese/English | 
**UserUuid** | **string** | User UUID | 
**ChatId** | Pointer to **NullableString** | Chat context ID | [optional] 
**Images** | Pointer to **NullableString** | Image URL or Base64 for image-to-image | [optional] 
**Zidingyican** | Pointer to [**[]AppApiV1AiDoubaoRouteCustomParameter**](AppApiV1AiDoubaoRouteCustomParameter.md) | Custom parameters | [optional] 

## Methods

### NewSeedreamImageRequest

`func NewSeedreamImageRequest(prompt string, userUuid string, ) *SeedreamImageRequest`

NewSeedreamImageRequest instantiates a new SeedreamImageRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSeedreamImageRequestWithDefaults

`func NewSeedreamImageRequestWithDefaults() *SeedreamImageRequest`

NewSeedreamImageRequestWithDefaults instantiates a new SeedreamImageRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *SeedreamImageRequest) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *SeedreamImageRequest) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *SeedreamImageRequest) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetUserUuid

`func (o *SeedreamImageRequest) GetUserUuid() string`

GetUserUuid returns the UserUuid field if non-nil, zero value otherwise.

### GetUserUuidOk

`func (o *SeedreamImageRequest) GetUserUuidOk() (*string, bool)`

GetUserUuidOk returns a tuple with the UserUuid field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserUuid

`func (o *SeedreamImageRequest) SetUserUuid(v string)`

SetUserUuid sets UserUuid field to given value.


### GetChatId

`func (o *SeedreamImageRequest) GetChatId() string`

GetChatId returns the ChatId field if non-nil, zero value otherwise.

### GetChatIdOk

`func (o *SeedreamImageRequest) GetChatIdOk() (*string, bool)`

GetChatIdOk returns a tuple with the ChatId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChatId

`func (o *SeedreamImageRequest) SetChatId(v string)`

SetChatId sets ChatId field to given value.

### HasChatId

`func (o *SeedreamImageRequest) HasChatId() bool`

HasChatId returns a boolean if a field has been set.

### SetChatIdNil

`func (o *SeedreamImageRequest) SetChatIdNil(b bool)`

 SetChatIdNil sets the value for ChatId to be an explicit nil

### UnsetChatId
`func (o *SeedreamImageRequest) UnsetChatId()`

UnsetChatId ensures that no value is present for ChatId, not even an explicit nil
### GetImages

`func (o *SeedreamImageRequest) GetImages() string`

GetImages returns the Images field if non-nil, zero value otherwise.

### GetImagesOk

`func (o *SeedreamImageRequest) GetImagesOk() (*string, bool)`

GetImagesOk returns a tuple with the Images field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImages

`func (o *SeedreamImageRequest) SetImages(v string)`

SetImages sets Images field to given value.

### HasImages

`func (o *SeedreamImageRequest) HasImages() bool`

HasImages returns a boolean if a field has been set.

### SetImagesNil

`func (o *SeedreamImageRequest) SetImagesNil(b bool)`

 SetImagesNil sets the value for Images to be an explicit nil

### UnsetImages
`func (o *SeedreamImageRequest) UnsetImages()`

UnsetImages ensures that no value is present for Images, not even an explicit nil
### GetZidingyican

`func (o *SeedreamImageRequest) GetZidingyican() []AppApiV1AiDoubaoRouteCustomParameter`

GetZidingyican returns the Zidingyican field if non-nil, zero value otherwise.

### GetZidingyicanOk

`func (o *SeedreamImageRequest) GetZidingyicanOk() (*[]AppApiV1AiDoubaoRouteCustomParameter, bool)`

GetZidingyicanOk returns a tuple with the Zidingyican field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetZidingyican

`func (o *SeedreamImageRequest) SetZidingyican(v []AppApiV1AiDoubaoRouteCustomParameter)`

SetZidingyican sets Zidingyican field to given value.

### HasZidingyican

`func (o *SeedreamImageRequest) HasZidingyican() bool`

HasZidingyican returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


