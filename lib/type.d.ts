/// <reference types="node" />
import { EnumStorageClass } from './constant';
export interface IPrefixFileListRes {
    BucketName: string;
    BucketId: string;
    NextMarker: string;
    DataSet: {
        BucketName: string;
        FileName: string;
        Hash: string;
        MimeType: string;
        Size: number;
        CreateTime: number;
        ModifyTime: number;
        StorageClass: EnumStorageClass;
    }[];
}
export interface IHeadFileRes extends NodeJS.Dict<string | string[]> {
    'content-type'?: string;
    'content-length'?: string;
    'content-range'?: string;
    'etag'?: string;
    'x-sessionid'?: string;
}
export interface IListObjectsRes {
    Name: string;
    Prefix: string;
    MaxKeys: number;
    Delimiter: string;
    IsTruncated: boolean;
    NextMarker: string;
    contents: {
        Key: string;
        MimeType: string;
        ETag: string;
        Size: string;
        StorageClass: EnumStorageClass;
        LastModified: number;
        CreateTime: number;
    }[];
    CommonPrefixes: {
        Prefix: string;
    }[];
}
export interface IInitiateMultipartUploadRes {
    UploadId: string;
    BlkSize: number;
    Bucket: string;
    key: string;
}
export interface IUploadPartRes {
    PartNumber: number;
}
export interface IFinishMultipartUploadRes {
    Bucket: string;
    Key: string;
    FileSize: number;
    ETag: string;
}
export interface IGetMultiUploadIdRes {
    RetCode: number;
    Action: string;
    ErrMsg?: string;
    NextMarker?: string;
    DataSet?: {
        UploadId?: string;
        FileName?: string;
        StartTime?: number;
    }[];
}
export interface IOptions {
    pubKey: string;
    priKey: string;
    bucketName: string;
    region?: string;
    domain?: string;
    useHttps?: boolean;
}
