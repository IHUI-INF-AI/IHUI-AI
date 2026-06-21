# ChatAudioReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**BotId** | **string** |  | 
**ConversationId** | Pointer to **NullableString** |  | [optional] 
**AudioData** | **string** |  | 

## Methods

### NewChatAudioReq

`func NewChatAudioReq(botId string, audioData string, ) *ChatAudioReq`

NewChatAudioReq instantiates a new ChatAudioReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewChatAudioReqWithDefaults

`func NewChatAudioReqWithDefaults() *ChatAudioReq`

NewChatAudioReqWithDefaults instantiates a new ChatAudioReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetBotId

`func (o *ChatAudioReq) GetBotId() string`

GetBotId returns the BotId field if non-nil, zero value otherwise.

### GetBotIdOk

`func (o *ChatAudioReq) GetBotIdOk() (*string, bool)`

GetBotIdOk returns a tuple with the BotId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBotId

`func (o *ChatAudioReq) SetBotId(v string)`

SetBotId sets BotId field to given value.


### GetConversationId

`func (o *ChatAudioReq) GetConversationId() string`

GetConversationId returns the ConversationId field if non-nil, zero value otherwise.

### GetConversationIdOk

`func (o *ChatAudioReq) GetConversationIdOk() (*string, bool)`

GetConversationIdOk returns a tuple with the ConversationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetConversationId

`func (o *ChatAudioReq) SetConversationId(v string)`

SetConversationId sets ConversationId field to given value.

### HasConversationId

`func (o *ChatAudioReq) HasConversationId() bool`

HasConversationId returns a boolean if a field has been set.

### SetConversationIdNil

`func (o *ChatAudioReq) SetConversationIdNil(b bool)`

 SetConversationIdNil sets the value for ConversationId to be an explicit nil

### UnsetConversationId
`func (o *ChatAudioReq) UnsetConversationId()`

UnsetConversationId ensures that no value is present for ConversationId, not even an explicit nil
### GetAudioData

`func (o *ChatAudioReq) GetAudioData() string`

GetAudioData returns the AudioData field if non-nil, zero value otherwise.

### GetAudioDataOk

`func (o *ChatAudioReq) GetAudioDataOk() (*string, bool)`

GetAudioDataOk returns a tuple with the AudioData field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioData

`func (o *ChatAudioReq) SetAudioData(v string)`

SetAudioData sets AudioData field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


