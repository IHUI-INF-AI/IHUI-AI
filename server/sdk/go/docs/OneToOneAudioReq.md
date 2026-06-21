# OneToOneAudioReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**BotId** | **string** |  | 
**UserId** | **string** |  | 
**ConversationId** | Pointer to **NullableString** |  | [optional] 
**AudioData** | **string** |  | 
**VoiceId** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewOneToOneAudioReq

`func NewOneToOneAudioReq(botId string, userId string, audioData string, ) *OneToOneAudioReq`

NewOneToOneAudioReq instantiates a new OneToOneAudioReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewOneToOneAudioReqWithDefaults

`func NewOneToOneAudioReqWithDefaults() *OneToOneAudioReq`

NewOneToOneAudioReqWithDefaults instantiates a new OneToOneAudioReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetBotId

`func (o *OneToOneAudioReq) GetBotId() string`

GetBotId returns the BotId field if non-nil, zero value otherwise.

### GetBotIdOk

`func (o *OneToOneAudioReq) GetBotIdOk() (*string, bool)`

GetBotIdOk returns a tuple with the BotId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBotId

`func (o *OneToOneAudioReq) SetBotId(v string)`

SetBotId sets BotId field to given value.


### GetUserId

`func (o *OneToOneAudioReq) GetUserId() string`

GetUserId returns the UserId field if non-nil, zero value otherwise.

### GetUserIdOk

`func (o *OneToOneAudioReq) GetUserIdOk() (*string, bool)`

GetUserIdOk returns a tuple with the UserId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserId

`func (o *OneToOneAudioReq) SetUserId(v string)`

SetUserId sets UserId field to given value.


### GetConversationId

`func (o *OneToOneAudioReq) GetConversationId() string`

GetConversationId returns the ConversationId field if non-nil, zero value otherwise.

### GetConversationIdOk

`func (o *OneToOneAudioReq) GetConversationIdOk() (*string, bool)`

GetConversationIdOk returns a tuple with the ConversationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetConversationId

`func (o *OneToOneAudioReq) SetConversationId(v string)`

SetConversationId sets ConversationId field to given value.

### HasConversationId

`func (o *OneToOneAudioReq) HasConversationId() bool`

HasConversationId returns a boolean if a field has been set.

### SetConversationIdNil

`func (o *OneToOneAudioReq) SetConversationIdNil(b bool)`

 SetConversationIdNil sets the value for ConversationId to be an explicit nil

### UnsetConversationId
`func (o *OneToOneAudioReq) UnsetConversationId()`

UnsetConversationId ensures that no value is present for ConversationId, not even an explicit nil
### GetAudioData

`func (o *OneToOneAudioReq) GetAudioData() string`

GetAudioData returns the AudioData field if non-nil, zero value otherwise.

### GetAudioDataOk

`func (o *OneToOneAudioReq) GetAudioDataOk() (*string, bool)`

GetAudioDataOk returns a tuple with the AudioData field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioData

`func (o *OneToOneAudioReq) SetAudioData(v string)`

SetAudioData sets AudioData field to given value.


### GetVoiceId

`func (o *OneToOneAudioReq) GetVoiceId() string`

GetVoiceId returns the VoiceId field if non-nil, zero value otherwise.

### GetVoiceIdOk

`func (o *OneToOneAudioReq) GetVoiceIdOk() (*string, bool)`

GetVoiceIdOk returns a tuple with the VoiceId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVoiceId

`func (o *OneToOneAudioReq) SetVoiceId(v string)`

SetVoiceId sets VoiceId field to given value.

### HasVoiceId

`func (o *OneToOneAudioReq) HasVoiceId() bool`

HasVoiceId returns a boolean if a field has been set.

### SetVoiceIdNil

`func (o *OneToOneAudioReq) SetVoiceIdNil(b bool)`

 SetVoiceIdNil sets the value for VoiceId to be an explicit nil

### UnsetVoiceId
`func (o *OneToOneAudioReq) UnsetVoiceId()`

UnsetVoiceId ensures that no value is present for VoiceId, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


