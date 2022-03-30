"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UFile = void 0;
const is_1 = require("@sindresorhus/is");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const got_1 = require("got");
const mime_types_1 = require("mime-types");
const ms_1 = require("ms");
const path_1 = require("path");
const constant_js_1 = require("./constant.js");
const defaultMimeType = 'application/octet-stream';
class UFile {
    /**
     * UFile SDK
     * @param options
     */
    constructor(options) {
        this.pubKey = options.pubKey;
        this.priKey = options.priKey;
        this.bucketName = options.bucketName;
        if (options.domain) {
            this.domain = `${this.bucketName}.${options.domain}`;
        }
        else {
            if (!options.region) {
                throw new TypeError('domain and region cannot both be null');
            }
            this.domain = `${this.bucketName}.${options.region}.ufileos.com`;
        }
        this.scheme = options.useHttps ? 'https' : 'http';
        this.got = got_1.default.extend({
            prefixUrl: `${this.scheme}://${this.domain}`,
            username: this.pubKey,
            hooks: {
                beforeRequest: [
                    (options) => {
                        const sign = this.sign(options);
                        options.password = sign;
                        options.headers['authorization'] = `UCloud ${options.username}:${sign}`;
                    },
                ],
            },
        });
    }
    /**
     * 前缀列表查询
     * @param {string} [prefix=''] 前缀，utf-8编码，默认为空字符串
     * @param {string} [marker=''] 标志字符串，utf-8编码，默认为空字符串
     * @param {number} [limit=20] 文件列表数目，默认为20
     * @returns {Promise}
     */
    async prefixFileList(prefix = '', marker = '', limit = 20) {
        return this.got({
            searchParams: {
                list: '',
                prefix,
                marker,
                limit,
            },
        }).json();
    }
    /**
     * 上传文件
     * @param {string} key
     * @param {Buffer|Stream.Readable|string} file 文件
     * @param {string} [mimeType='application/octet-stream'] 文件类型
     * @returns {Promise}
     */
    async putFile(key, file, mimeType) {
        key = key.replace(/^\//, '');
        mimeType = (0, mime_types_1.lookup)((0, path_1.extname)(key)) || defaultMimeType;
        await this.got.put(key, {
            headers: {
                'content-type': mimeType,
            },
            body: file,
        });
    }
    /**
     * 上传本地文件
     * @param {string} key
     * @param {string} path 文件路径
     * @param {string} [mimeType='application/octet-stream'] 文件类型
     * @returns {Promise}
     */
    async uploadFile(key, path, mimeType) {
        mimeType = (0, mime_types_1.lookup)((0, path_1.extname)(key)) || defaultMimeType;
        return this.putFile(key, (0, fs_1.createReadStream)(path), mimeType);
    }
    /**
     * 秒传文件
     * @param {string} hash 待上传文件的ETag,详见ETag生成文档
     * @param {string} fileName Bucket中文件的名称
     * @param {string} fileSize 待上传文件的大小
     * @returns {Promise}
     */
    async uploadHit(hash, fileName, fileSize) {
        const res = await this.got.post('uploadhit', {
            searchParams: {
                Hash: hash,
                FileName: fileName,
                FileSize: fileSize,
            },
            throwHttpErrors: false,
        });
        return res.statusCode === 200;
    }
    /**
     * 下载文件
     * @param {string} key key
     * @param {string} [range] 分片下载的文件范围
     * @param {string} [ifModifiedSince] 只返回从某时修改过的文件，否则返回304(not modified)
     * @returns {Promise}
     */
    async getFile(key, range, ifModifiedSince) {
        key = key.replace(/^\//, '');
        return this.got(key, {
            headers: {
                range,
                'if-modified-since': ifModifiedSince,
            },
        })
            .buffer();
    }
    /**
     * 下载文件
     * @param {string} key key
     * @param {string} [range] 分片下载的文件范围
     * @param {string} [ifModifiedSince] 只返回从某时修改过的文件，否则返回304(not modified)
     * @returns {Promise}
     */
    async getFileStream(key, range, ifModifiedSince) {
        key = key.replace(/^\//, '');
        return this.got(key, {
            headers: {
                range,
                'if-modified-since': ifModifiedSince,
            },
            isStream: true,
        });
    }
    /**
     * 查询文件基本信息
     * @param {string} key
     * @returns {Promise}
     */
    async headFile(key) {
        key = key.replace(/^\//, '');
        const res = await this.got.head(key);
        return res.headers;
    }
    /**
     * 获取目录文件列表
     * @param prefix
     * @param marker
     * @param maxKeys
     * @param delimiter
     */
    async listObjects(prefix, marker, maxKeys, delimiter) {
        return this.got.get({
            searchParams: {
                'listobjects': '',
                prefix,
                marker,
                'max-keys': maxKeys,
                delimiter,
            },
        })
            .json();
    }
    /**
     * 删除文件
     * @param {string} key
     * @returns {Promise}
     */
    async deleteFile(key) {
        key = key.replace(/^\//, '');
        await this.got.delete(key);
    }
    /**
     * 初始化分片上传
     * @param {string} key 文件名
     * @returns {Promise}
     */
    async initiateMultipartUpload(key) {
        key = key.replace(/^\//, '');
        return this.got.post(key, {
            searchParams: {
                uploads: '',
            },
        })
            .json();
    }
    /**
     * 上传分片
     * @param {string} key 文件名
     * @param {string} uploadId 分片id
     * @param {number} partNumber 第几块分片
     * @param {buffer} buffer 内容
     * @returns {Promise}
     */
    async uploadPart(key, uploadId, partNumber, buffer) {
        key = key.replace(/^\//, '');
        return this.got.put(key, {
            searchParams: {
                uploadId,
                partNumber,
            },
            body: buffer,
        })
            .json();
    }
    /**
     * 完成分片
     * @param {string} key 文件名
     * @param {string} uploadId 分片id
     * @param {array} parts 分片的etag们
     * @param {string} [newKey] 等上传完毕开始指定的key可能已经被占用,遇到这种情形时会采用newKey参数的值作为文件最终的key，否则仍然采用原来的key
     * @returns {Promise}
     */
    async finishMultipartUpload(key, uploadId, parts, newKey) {
        key = key.replace(/^\//, '');
        const res = await this.got.post(key, {
            searchParams: {
                uploadId,
                newKey,
            },
            body: parts.join(','),
            responseType: 'json',
        });
        return {
            ...res.body,
            ETag: res.headers.etag,
        };
    }
    /**
     * 放弃分片
     * @param {string} key 文件名
     * @param {string} uploadId 分片id
     * @returns {Promise}
     */
    async abortMultipartUpload(key, uploadId) {
        key = key.replace(/^\//, '');
        await this.got.delete(key, {
            searchParams: {
                uploadId,
            },
        });
    }
    /**
     * 获取正在执行的分片上传
     * @param {string} [prefix] 前缀，utf-8编码，默认为空字符串
     * @param {string} [marker] 标志字符串，utf-8编码，默认为空字符串
     * @param {number} [limit=20] id列表数目，默认为20
     * @returns {Promise}
     */
    async getMultiUploadId(prefix, marker, limit = 20) {
        return this.got({
            searchParams: {
                muploadid: '',
                prefix,
                marker,
                limit,
            },
        })
            .json();
    }
    /**
     * 文件存储类型转换
     * @param key
     * @param storageClass
     */
    async classSwitch(key, storageClass) {
        key = key.replace(/^\//, '');
        await this.got.put(key, {
            searchParams: {
                storageClass,
            },
        });
    }
    /**
     * 解冻文件
     * @param key
     */
    async restore(key) {
        key = key.replace(/^\//, '');
        await this.got.put(key, {
            searchParams: {
                restore: '',
            },
        });
    }
    /**
     * 等待解冻完成
     * @param key
     * @param interval 重试间隔
     * @param maxRetry 重试次数
     */
    async waitForRestore(key, interval = (0, ms_1.default)('10s'), maxRetry = 30) {
        var _a;
        for (let i = 0; i <= maxRetry; i++) {
            const headers = await this.headFile(key);
            if (headers['x-ufile-storage-class'].toString() !== constant_js_1.EnumStorageClass.archive) {
                throw new Error('not archive storage');
            }
            if ((_a = headers['x-ufile-restore']) === null || _a === void 0 ? void 0 : _a.toString().includes('ongoing-request="false"'))
                return;
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
        throw new Error('restore wait timeout');
    }
    /**
     * 判断是否需要解冻
     * @param key
     */
    async isNeedRestore(key) {
        var _a;
        const headers = await this.headFile(key);
        if (headers['x-ufile-storage-class'].toString() !== constant_js_1.EnumStorageClass.archive) {
            return false;
        }
        const restoreState = (_a = headers['x-ufile-restore']) === null || _a === void 0 ? void 0 : _a.toString();
        if (!restoreState)
            return true;
        if (restoreState.includes('ongoing-request="true"'))
            return false;
        if (restoreState.includes('ongoing-request="false"')) {
            const expiresMatch = /expiry-date="(?<date>.*)"/.exec(restoreState);
            if (!(expiresMatch === null || expiresMatch === void 0 ? void 0 : expiresMatch.groups.date)) {
                return true;
            }
            const expires = new Date(expiresMatch === null || expiresMatch === void 0 ? void 0 : expiresMatch.groups.date);
            return Date.now() < expires.valueOf();
        }
        return true;
    }
    /**
     * 操作文件的Meta信息
     * @param {string} key key
     * @param {string} mimeType 文件的mimetype
     * @returns {Promise}
     */
    async opMeta(key, mimeType) {
        key = key.replace(/^\//, '');
        await this.got.post(key, {
            searchParams: {
                opmeta: '',
            },
            json: {
                op: 'set',
                metak: 'mimetype',
                metav: mimeType,
            },
        });
    }
    getAuthorization(method, key, contentMd5 = '', contentType = 'multipart/form-data') {
        if (!key.startsWith('/')) {
            key += `/${key}`;
        }
        const p = [method.toUpperCase(), contentMd5, contentType, '', `${this.bucketName}${key}`];
        const str = p.join('\n');
        const sign = (0, crypto_1.createHmac)('sha1', this.priKey).update(str).digest('base64');
        return `UCloud ${this.pubKey}:${sign}`;
    }
    sign(options) {
        const p = [options.method.toUpperCase(), getHeader('content-md5'), getHeader('content-type'), getHeader('date')];
        Object.keys(options.headers)
            .sort()
            .forEach((key) => {
            if (key.toLowerCase().startsWith('x-ucloud')) {
                p.push(`${key.toLowerCase()}:${getHeader(key)}`);
            }
        });
        let key = options.url;
        if (!is_1.default.string(key) || key.match(/^https?:\/\//)) {
            key = decodeURI(new URL(options.url).pathname);
        }
        p.push(`/${this.bucketName}${key}`);
        const stringToSign = p.join('\n');
        return (0, crypto_1.createHmac)('sha1', this.priKey).update(stringToSign).digest('base64');
        function getHeader(key) {
            var _a, _b;
            const header = (_b = (_a = options.headers[key]) !== null && _a !== void 0 ? _a : options[key.toLowerCase()]) !== null && _b !== void 0 ? _b : '';
            if (Array.isArray(header))
                return header.join();
            return header;
        }
    }
}
exports.UFile = UFile;
__exportStar(require("./constant.js"), exports);
__exportStar(require("./type.js"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx5Q0FBaUM7QUFDakMsbUNBQWlDO0FBQ2pDLDJCQUFtQztBQUNuQyw2QkFBNkM7QUFDN0MsMkNBQWlDO0FBQ2pDLDJCQUFtQjtBQUNuQiwrQkFBNEI7QUFFNUIsK0NBQThDO0FBTTlDLE1BQU0sZUFBZSxHQUFHLDBCQUEwQixDQUFBO0FBRWxELE1BQWEsS0FBSztJQVNoQjs7O09BR0c7SUFDSCxZQUFZLE9BQWlCO1FBQzNCLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQTtRQUM1QixJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUE7UUFDNUIsSUFBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFBO1FBQ3BDLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRTtZQUNsQixJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFVBQVUsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUE7U0FDckQ7YUFBTTtZQUNMLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFO2dCQUNuQixNQUFNLElBQUksU0FBUyxDQUFDLHVDQUF1QyxDQUFDLENBQUE7YUFDN0Q7WUFDRCxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFVBQVUsSUFBSSxPQUFPLENBQUMsTUFBTSxjQUFjLENBQUE7U0FDakU7UUFDRCxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFBO1FBQ2pELElBQUksQ0FBQyxHQUFHLEdBQUcsYUFBRyxDQUFDLE1BQU0sQ0FBQztZQUNwQixTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxNQUFNLElBQUksQ0FB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