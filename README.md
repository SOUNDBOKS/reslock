# reslock
A server for atomic resource locking


## How it works
Reslock keeps track of opague "resources", which are up to you to define. Each resource belongs to a "set" and can optionally have a list of properties. Example of a well formed resource:
```json
{
  "resource_set": "phones",
  "properties": {
    "platform": "ios",
    "platformVersion": "12",
    "udid": "00001111222233334444"
  }
}   
```

### Endpoints

#### `POST /api/resources/acquire`
Ask the server for a set of resources with optional filters. Note that the server will always return all properties defined on the resource, even if you only filtered for some of them.  

##### Example Request Body
```json
{
  "resources": [
    { "resource_set": "phones", "filters": { "platform": "ios" } },
    { "resource_set": "workers" }
  ]
}
```

##### Example Response
```json
{
  "_id": "ac726a9257d28",
  "locked_at": "2021-09-06T12:49:09.110Z",
  "resources": [...]
}
```

The _id field serves as an unlock token, so store it!

##### Example Error Response
```json
{
  "error": {
    "cause": "Failed to lock some resources",
    "missing_resources": [
      { "resource_set": "phones", "filters": { "platform": "ios" } }
    ]
  }
}
```

#### `POST /api/resources/unlock`
Tell the server you are done with a set of resources you acquired earlier. This will unlock all resources associated with that id.

##### Example Request Body
```json
{
  "token": "ac726a9257d28"
}
```

##### Example Response
```json
{
  "ok": true
}
```
