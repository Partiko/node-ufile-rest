/// <reference types="node" />
import { Got, Method } from 'got';
import { Readable } from 'stream';
import { EnumStorageClass } from './constant.js';
import { IFinishMultipartUploadRes, IGetMultiUploadIdRes, IHeadFileRes, IInitiateMultipartUploadRes, IListObjectsRes, IOptions, IPrefixFileListRes, IUploadPartRes } from './type.js';
export declare class UFile {
    readonly got: Got;
    private readonly pubKey;
    private readonly priKey;
    private readonly bucketName;
    private readonly domain;
    private readonly scheme;
    /**
     * UFile SDK
     * @param options
     */
    constructor(options: IOptions);
    /**
     * 前缀列表查询
     * @param {string} [prefix=''] 前缀，utf-8编码，默认为空字符串
     * @param {string} [marker=''] 标志字符串，utf-8编码，默认为空字符串
     * @param {number} [limit=20] 文件列表数目，默认为20
     * @returns {Promise}
     */
    prefixFileList(prefix?: string, marker?: string, limit?: number): Promise<IPrefixFileListRes>;
    /**
     * 上传文件
     * @param {string} key
     * @param {Buffer|Stream.Readable|string} file 文件
     * @param {string} [mimeType='application/octet-stream'] 文件类型
     * @returns {Promise}
     */
    putFile(key: string, file: Buffer | Readable | string, mimeType?: string): Promise<void>;
    /**
     * 上传本地文件
     * @param {string} key
     * @param {string} path 文件路径
     * @param {string} [mimeType='application/octet-stream'] 文件类型
     * @returns {Promise}
     */
    uploadFile(key: string, path: string, mimeType?: string): Promise<void>;
    /**
     * 秒传文件
     * @param {string} hash 待上传文件的ETag,详见ETag生成文档
     * @param {string} fileName Bucket中文件的名称
     * @param {string} fileSize 待上传文件的大小
     * @returns {Promise}
     */
    uploadHit(hash: string, fileName: string, fileSize: string): Promise<boolean>;
    /**
     * 下载文件
     * @param {string} key key
     * @param {string} [range] 分片下载的文件范围
     * @param {string} [ifModifiedSince] 只返回从某时修改过的文件，否则返回304(not modified)
     * @returns {Promise}
     */
    getFile(key: string, range?: string, ifModifiedSince?: string): Promise<Buffer>;
    /**
     * 下载文件
     * @param {string} key key
     * @param {string} [range] 分片下载的文件范围
     * @param {string} [ifModifiedSince] 只返回从某时修改过的文件，否则返回304(not modified)
     * @returns {Promise}
     */
    getFileStream(key: string, range?: string, ifModifiedSince?: string): Promise<Readable>;
    /**
     * 查询文件基本信息
     * @param {string} key
     * @returns {Promise}
     */
    headFile(key: string): Promise<IHeadFileRes>;
    /**
     * 获取目录文件列表
     * @param prefix
     * @param marker
     * @param maxKeys
     * @param delimiter
     */
    listObjects(prefix: string, marker?: string, maxKeys?: number, delimiter?: string): Promise<IListObjectsRes>;
    /**
     * 删除文件
     * @param {string} key
     * @returns {Promise}
     */
    deleteFile(key: string): Promise<void>;
    /**
     * 初始化分片上传
     * @param {string} key 文件名
     * @returns {Promise}
     */
    initiateMultipartUpload(key: string): Promise<IInitiateMultipartUploadRes>;
    /**
     * 上传分片
     * @param {string} key 文件名
     * @param {string} uploadId 分片id
     * @param {number} partNumber 第几块分片
     * @param {buffer} buffer 内容
     * @returns {Promise}
     */
    uploadPart(key: string, uploadId: string, partNumber: number, buffer: Buffer): Promise<IUploadPartRes>;
    /**
     * 完成分片
     * @param {string} key 文件名
     * @param {string} uploadId 分片id
     * @param {array} parts 分片的etag们
     * @param {string} [newKey] 等上传完毕开始指定的key可能已经被占用,遇到这种情形时会采用newKey参数的值作为文件最终的key，否则仍然采用原来的key
     * @returns {Promise}
     */
    finishMultipartUpload(key: string, uploadId: string, parts?: string[], newKey?: string): Promise<IFinishMultipartUploadRes>;
    /**
     * 放弃分片
     * @param {string} key 文件名
     * @param {string} uploadId 分片id
     * @returns {Promise}
     */
    abortMultipartUpload(key: string, uploadId: string): Promise<void>;
    /**
     * 获取正在执行的分片上传
     * @param {string} [prefix] 前缀，utf-8编码，默认为空字符串
     * @param {string} [marker] 标志字符串，utf-8编码，默认为空字符串
     * @param {number} [limit=20] id列表数目，默认为20
     * @returns {Promise}
     */
    getMultiUploadId(prefix: string, marker: string, limit?: number): Promise<IGetMultiUploadIdRes>;
    /**
     * 文件存储类型转换
     * @param key
     * @param storageClass
     */
    classSwitch(key: string, storageClass: EnumStorageClass): Promise<void>;
    /**
     * 解冻文件
     * @param key
     */
    restore(key: string): Promise<void>;
    /**
     * 等待解冻完成
     * @param key
     * @param interval 重试间隔
     * @param maxRetry 重试次数
     */
    waitForRestore(key: string, interval?: number, maxRetry?: number): Promise<void>;
    /**
     * 判断是否需要解冻
     * @param key
     */
    isNeedRestore(key: string): Promise<boolean>;
    /**
     * 操作文件的Meta信息
     * @param {string} key key
     * @param {string} mimeType 文件的mimetype
     * @returns {Promise}
     */
    opMeta(key: string, mimeType: string): Promise<void>;
    getAuthorization(method: Method, key: string, contentMd5?: string, contentType?: string): string;
    private sign;
}
export * from './constant.js';
export * from './type.js';
