

import fetch from "cross-fetch"


import { AcquireError, CreateResourceError, DestroyResourceError, IResource, LockedResource, ResourceAcquisitionOptions, UnlockError, UnlockToken } from "@soundboks/reslock-common"
import { Err, Ok, Result } from "ts-results"


type LogFn = (...args: any[]) => void



export default class ReslockClient {
    serverURI: string
    logExtra: LogFn = () => { }

    private constructor(serverURI: string, logExtra?: LogFn) {
        this.serverURI = serverURI
        this.logExtra = logExtra || this.logExtra
    }

    public static async connect(serverURI: string, logExtra?: LogFn): Promise<ReslockClient> {
        const { version, serviceName } = await (await fetch(serverURI + "/version")).json()

        if (serviceName !== "reslock") throw new Error("Expected a reslock server")

        return new ReslockClient(serverURI, logExtra)
    }

    public async acquire(resources: IResource[], options?: ResourceAcquisitionOptions): Promise<Result<UnlockToken<string>, IResource[]>> {
        const response: AcquireError | UnlockToken<string> =
            await (await fetch(this.serverURI + "/api/resources/acquire", {
                method: "POST",
                body: JSON.stringify({ resources, options }),
                headers: {
                    "Content-Type": "application/json"
                }
            })).json()

        if ('error' in response) {
            this.logExtra("[reslock-client] Error in acquire:response: ", response)
            switch (response.error) {
                case "MISSING_RESOURCES":
                    return Err(response.missing_resources)
                default:
                    throw new Error(response.error)
            }
        } else {
            return Ok(response)
        }
    }

    public async unlock(unlockToken: UnlockToken<string> | string): Promise<void> {
        const token = typeof unlockToken === "string" ? unlockToken : unlockToken._id
        const response: UnlockError | { ok: true } =
            await (await fetch(this.serverURI + "/api/resources/unlock", {
                method: "POST",
                body: JSON.stringify({ token }),
                headers: {
                    "Content-Type": "application/json"
                }
            })).json()

        if ('error' in response) {
            this.logExtra("[reslock-client] Error in unlock:response: ", response)
            throw new Error(response.error)
        } else {
            return;
        }
    }

    public async unlock_set(setId: string): Promise<number> {
        const response: UnlockError | { ok: true, count: number } =
            await (await fetch(this.serverURI + "/api/resources/unlock_set", {
                method: "POST",
                body: JSON.stringify({ unlock_set: setId }),
                headers: {
                    "Content-Type": "application/json"
                }
            })).json()

        if ('error' in response) {
            this.logExtra("[reslock-client] Error in unlock_set:response: ", response)
            throw new Error(response.error)
        } else {
            return response.count
        }
    }

    public async create_resource(resource_set: string, properties: object): Promise<string> {
        const response: CreateResourceError | { _id: string } =
            await (await fetch(this.serverURI + "/api/resource/create", {
                method: "POST",
                body: JSON.stringify({ resource_set, properties }),
                headers: {
                    "Content-Type": "application/json"
                }
            })).json()

        if ('error' in response) {
            this.logExtra("[reslock-client] Error in create_resource:response: ", response)
            switch (response.error) {
                default:
                    throw new Error(response.error)
            }
        } else {
            return response._id
        }
    }

    public async destroy_resource(id: string): Promise<void> {
        const response: DestroyResourceError | { ok: true } =
            await (await fetch(this.serverURI + `/api/resource/${id}/destroy`, { method: "POST" })).json()

        if ('error' in response) {
            this.logExtra("[reslock-client] Error in destroy_resource:response: ", response)
            throw new Error(response.error)
        } else {
            return;
        }
    }

    public async list_resources(set?: string): Promise<(IResource & { _id: string })[]> {
        const endpoint = set ? `/api/resources/${set}/list` : "/api/resources/list"
        const response = await (await fetch(this.serverURI + endpoint)).json()

        return response.resources
    }
}
