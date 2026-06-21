
# NoticePushReq


## Properties

Name | Type
------------ | -------------
`topic` | string
`title` | string
`content` | string
`userId` | string
`level` | string
`extra` | { [key: string]: any; }

## Example

```typescript
import type { NoticePushReq } from ''

// TODO: Update the object below with actual values
const example = {
  "topic": null,
  "title": null,
  "content": null,
  "userId": null,
  "level": null,
  "extra": null,
} satisfies NoticePushReq

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as NoticePushReq
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


