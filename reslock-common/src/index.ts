

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

export interface InvalidOptionsError {
    error: "INVALID_OPTIONS",
    cause?: string;
}

export type AcquireError = MissingResourcesError | InvalidOptionsError
export type UnlockError = UnlockTokenDoesNotExistError
export type CreateResourceError = { error: any }
export type DestroyResourceError = ResourceDoesNotExistError | ResourceLockedError

export interface IResource {
    resource_set: string,
    properties?: Record<string, any>,
    _id?: string,
}

export interface LockedResource<IDType> {
    _id: IDType,
    properties: object,
}


export interface UnlockToken<IDType> {
    _id: IDType,
    resources: LockedResource<IDType>[],
    locked_at: Date,
    unlock_set?: string;
    expire_date?: IDType extends string ? string : Date;
}

export interface ResourceAcquisitionOptions {
    expire_minutes?: number;
    expire_date?: string;
    unlock_set?: string;
}

export interface ResourceHookAcquisitionOptions {
    expire_minutes?: number;
    expire_date?: string;
    nonce?: string;
    resource_options?: ResourceAcquisitionOptions;
}

export interface ResourceAcquisitionRequest {
    resources: IResource[],
    options?: ResourceAcquisitionOptions,
}

export type ApiResponse<T, E> = { ok: true, data: T } | E