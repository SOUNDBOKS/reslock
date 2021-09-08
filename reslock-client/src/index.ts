

import fetch from "cross-fetch"


import { AcquireError, CreateResourceError, DestroyResourceError, IResource, LockedResource, UnlockError, UnlockToken } from "@soundboks/reslock-common"
import { Err, Ok, Result } from "ts-results"


type LogFn = (...args: any[]) => void



export default class ReslockClient {
    serverURI: string
    logExtra: LogFn = () => {}

    private constructor(serverURI: string, logExtra?: LogFn) {
        this.serverURI = serverURI
        this.logExtra = logExtra || this.logExtra
    }

    public static async connect(serverURI: string, logExtra?: LogFn): Promise<ReslockClient> {
        const { version, serviceName } = await (await fetch(serverURI + "/version")).json()

        if (serviceName !== "reslock") throw new Error("Expected a reslock server")

        return new ReslockClient(serverURI, logExtra)
    }

    public async acquire(resources: IResource[]): Promise<Result<UnlockToken<string>, IResource[]>> {
        const response: AcquireError | UnlockToken<string> =
            await (await fetch(this.serverURI + "/api/resources/acquire", {
                method: "POST",
                body: JSON.stringify({ resources }),
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
                }})).json()

        if ('error' in response) {
            this.logExtra("[reslock-client] Error in unlock:response: ", response)
            throw new Error(response.error)
        } else {
            return;
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
