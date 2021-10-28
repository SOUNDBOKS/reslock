import * as Express from "express"
import { IResource, LockState, ResourceAcquisitionRequest } from "@soundboks/reslock-common"
import { version } from "../../package.json"
import { requestResources, unlockResourcesFromSet, unlockResourcesFromToken } from "../resources"
import { ObjectId } from "mongodb"
import { useDatabase } from "../utils"

type Handler<T> = (req: Express.Request) => Promise<T>

export function reject_non_json_post(req: Express.Request) {
    if (req.method === "POST" && req.header("Content-Type") !== "application/json") {
        throw new ReslockError("MISSING_CONTENT_TYPE", "POST requests must include the 'Content-Type: application/json' header")
    }
}

export function endpoint<T>(handler: Handler<T>) {
    return async (req: Express.Request, res: Express.Response) => {
        try {
            reject_non_json_post(req)
            const ret = await handler(req)
            res.send({ ok: true, data: ret })
        } catch(e: any) {
            console.log(e.error)
            if (e instanceof ReslockError) {
                res.send({ error: e.error, cause: e.cause, ...e.extra })
            } else {
                res.send({ error: "GENERIC", cause: e.toString() })
            }
        }
    }
}


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


export const ApiRouter = new class{
    router = Express.Router()
    get<T>(route: string, handler: Handler<T>) {
        this.router.get(route, endpoint(handler))
    }
    post<T>(route: string, handler: Handler<T>) {
        this.router.post(route, endpoint(handler))
    }
}

ApiRouter.get("/version", async () => {
    return {
        version,
        serviceName: "reslock"
    }
})

ApiRouter.post("/resources/acquire", async request => {
    const { resources, options }: ResourceAcquisitionRequest = request.body

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

ApiRouter.post("/resources/unlock", async request => {
    const { token }: { token: string } = request.body

    await unlockResourcesFromToken(new ObjectId(token))
})

ApiRouter.post("/resources/unlock_set", async request => {
    const { unlock_set }: { unlock_set: string } = request.body

    const count = await unlockResourcesFromSet(unlock_set)
    return { count }
})

ApiRouter.post("/resource/create", async request => {
    const { resource_set, properties }: IResource = request.body

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

ApiRouter.post("/resource/:id/destroy", async request => {
    const db = await useDatabase()
    const resource = await db.collection("resources").findOne({
        _id: new ObjectId(request.params.id)
    })

    assert(resource, "RESOURCE_DOES_NOT_EXIST")
    assert(resource!.lock_state === LockState.Free, "RESOURCE_LOCKED")

    await db.collection("resources").deleteOne({
        _id: new ObjectId(request.params.id)
    })
})

ApiRouter.get("/resources/list", async request => {
    const db = await useDatabase()
    return { resources: await db.collection("resources").find().toArray() }
})

ApiRouter.get("/resources/:set/list", async request => {
    assert(typeof request.params.set === "string", "INVALID_INPUT", "'set' must be a string")
    const db = await useDatabase()
    return {
        resources: await db.collection("resources").find({
            resource_set: request.params.set
        }).toArray()
    }
})