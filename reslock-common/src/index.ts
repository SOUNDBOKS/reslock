

export enum LockState {
    Free = 0,
    Reserved = 1,
    Locked = 2,
}

export interface MissingResourcesError {
    error: "MISSING_RESOURCES"
    missing_resources: IResource[]
}

export interface ResourceLockedError {
    error: "RESOURCE_LOCKED"
}

export interface ResourceDoesNotExistError {
    error: "RESOURCE_DOES_NOT_EXIST"
}

export interface UnlockTokenDoesNotExistError {
    error: "UNLOCK_TOKEN_DOES_NOT_EXIST"
}

export type AcquireError = MissingResourcesError
export type UnlockError = UnlockTokenDoesNotExistError
export type CreateResourceError = { error: any }
export type DestroyResourceError = ResourceDoesNotExistError | ResourceLockedError

export interface IResource {
    resource_set: string,
    properties?: object,
}

export interface LockedResource<IDType> {
    _id: IDType,
    properties: object,
}

export interface UnlockToken<IDType> {
    _id: IDType,
    resources: LockedResource<IDType>[],
    locked_at: Date,
}