import * as Express from "express"
import { IResource, LockState, ResourceAcquisitionRequest } from "@soundboks/reslock-common"
import { version } from "../../package.json"
import { requestResources, unlockResourcesFromSet, unlockResourcesFromToken } from "../resources"
import { ObjectId } from "mongodb"
import { useDatabase } from "../utils"

import { ApiRouter, useBody, useParam } from "@soundboks/expresso"

const apiRouter = new ApiRouter()

class ReslockError extends Error {
    error: string
    cause?: string
    extra?: object;

    constructor(error: string, cause?: string, extra?: object) {
        super(error + ": " + cause)
        this.error = error
        this.cause = cause
        this.extra = extra

        Object.setPrototypeOf(this, ReslockError.prototype)
    }
}



function assert(val: any, error: string, cause?: string) {
    if (val) return;

    throw new ReslockError(error, cause)
}



apiRouter.get("/version", async () => {
    return {
        version,
        serviceName: "reslock"
    }
})

apiRouter.post("/resources/acquire", async () => {
    const { resources, options }: ResourceAcquisitionRequest = useBody()

    if (options?.expire_date && options?.expire_minutes) {
        throw new ReslockError("INVALID_OPTIONS", "Don't set expire_date and expire_minutes together")
    }

    const lockedResources = await requestResources(resources, options || {})
    if (lockedResources.ok) {
        return lockedResources.val
    } else {
        throw new ReslockError("MISSING_RESOURCES", undefined, {
            missing_resources: lockedResources.val
        })
    }
})

apiRouter.post("/resources/unlock", async () => {
    const { token }: { token: string } = useBody()

    await unlockResourcesFromToken(new ObjectId(token))
})

apiRouter.post("/resources/unlock_set", async () => {
    const { unlock_set }: { unlock_set: string } = useBody()

    const count = await unlockResourcesFromSet(unlock_set)
    return { count }
})

apiRouter.post("/resource/create", async () => {
    const { resource_set, properties }: IResource = useBody()

    assert(typeof resource_set === "string", "INVALID_INPUT", "'resource_set' must be a string")
    assert(typeof properties === "object", "INVALID_INPUT", "'properties' must be an object")

    const db = await useDatabase()
    const inserted = await db.collection("resources").insertOne({
        resource_set,
        properties,
        lock_state: LockState.Free,
    })

    return { _id: inserted.insertedId }
})


apiRouter.post("/resource/:id/disable", async () => {
    const db = await useDatabase()
    
    const resource = await db.collection("resources").findOne({
        _id: new ObjectId(useParam("id"))
    })

    assert(resource, "RESOURCE_DOES_NOT_EXIST")
    if (resource!.lock_state === LockState.Disabled) return;
    assert(resource!.lock_state === LockState.Free, "RESOURCE_LOCKED")


    const result = await db.collection("resources").updateOne({
        _id: new ObjectId(useParam("id")),
        // Atomicity: Don't disable the item if it got locked by another request
        lock_state: LockState.Free,
    }, {
        $set: {
            lock_state: LockState.Disabled,
        }
    })

    if (result.modifiedCount !== 1) throw new Error("Update failed. Expected one object to be modified")
})

apiRouter.post("/resource/:id/enable", async () => {
    const db = await useDatabase()

    const resource = await db.collection("resources").findOne({
        _id: new ObjectId(useParam("id")),
    })

    assert(resource, "RESOURCE_DOES_NOT_EXIST")
    assert(resource!.lock_state === LockState.Disabled, "RESOURCE_ALREADY_ENABLED")

    const result = await db.collection("resources").updateOne({
        _id: new ObjectId(useParam("id")),
        // Atomicity: Don't enable the item if it got modified by another request
        lock_state: LockState.Disabled,
    }, {
        $set: { lock_state: LockState.Free }
    })

    if (result.modifiedCount !== 1) throw new Error("Update failed. Expected one object to be modified")
})

apiRouter.post("/resource/:id/destroy", async () => {
    const id = useParam("id")

    const db = await useDatabase()
    const resource = await db.collection("resources").findOne({
        _id: new ObjectId(id)
    })

    assert(resource, "RESOURCE_DOES_NOT_EXIST")
    assert(resource!.lock_state === LockState.Free, "RESOURCE_LOCKED")

    await db.collection("resources").deleteOne({
        _id: new ObjectId(id)
    })
})

apiRouter.get("/resources/list", async () => {
    const db = await useDatabase()
    return { resources: await db.collection("resources").find().toArray() }
})

apiRouter.get("/resources/:set/list", async () => {
    const set = useParam("set")

    const db = await useDatabase()
    return {
        resources: await db.collection("resources").find({
            resource_set: set
        }).toArray()
    }
})

export default apiRouter