import is from '@sindresorhus/is';
import { createHmac } from 'crypto';
import { createReadStream } from 'fs';
import got from 'got';
import { lookup } from 'mime-types';
import ms from 'ms';
import { extname } from 'path';
import { EnumStorageClass } from './constant.js';
const defaultMimeType = 'application/octet-stream';
export class UFile {
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
        this.got = got.extend({
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
        mimeType = lookup(extname(key)) || defaultMimeType;
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
        mimeType = lookup(extname(key)) || defaultMimeType;
        return this.putFile(key, createReadStream(path), mimeType);
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
    async waitForRestore(key, interval = ms('10s'), maxRetry = 30) {
        var _a;
        for (let i = 0; i <= maxRetry; i++) {
            const headers = await this.headFile(key);
            if (headers['x-ufile-storage-class'].toString() !== EnumStorageClass.archive) {
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
        if (headers['x-ufile-storage-class'].toString() !== EnumStorageClass.archive) {
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
        const sign = createHmac('sha1', this.priKey).update(str).digest('base64');
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
        if (!is.string(key) || key.match(/^https?:\/\//)) {
            key = decodeURI(new URL(options.url).pathname);
        }
        p.push(`/${this.bucketName}${key}`);
        const stringToSign = p.join('\n');
        return createHmac('sha1', this.priKey).update(stringToSign).digest('base64');
        function getHeader(key) {
            var _a, _b;
            const header = (_b = (_a = options.headers[key]) !== null && _a !== void 0 ? _a : options[key.toLowerCase()]) !== null && _b !== void 0 ? _b : '';
            if (Array.isArray(header))
                return header.join();
            return header;
        }
    }
}
export * from './constant.js';
export * from './type.js';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sa0JBQWtCLENBQUE7QUFDakMsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLFFBQVEsQ0FBQTtBQUNqQyxPQUFPLEVBQUMsZ0JBQWdCLEVBQUMsTUFBTSxJQUFJLENBQUE7QUFDbkMsT0FBTyxHQUEyQixNQUFNLEtBQUssQ0FBQTtBQUM3QyxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sWUFBWSxDQUFBO0FBQ2pDLE9BQU8sRUFBRSxNQUFNLElBQUksQ0FBQTtBQUNuQixPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sTUFBTSxDQUFBO0FBRTVCLE9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLGVBQWUsQ0FBQTtBQU05QyxNQUFNLGVBQWUsR0FBRywwQkFBMEIsQ0FBQTtBQUVsRCxNQUFNLE9BQU8sS0FBSztJQVNoQjs7O09BR0c7SUFDSCxZQUFZLE9BQWlCO1FBQzNCLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQTtRQUM1QixJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUE7UUFDNUIsSUFBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFBO1FBQ3BDLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRTtZQUNsQixJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFVBQVUsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUE7U0FDckQ7YUFBTTtZQUNMLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFO2dCQUNuQixNQUFNLElBQUksU0FBUyxDQUFDLHVDQUF1QyxDQUFDLENBQUE7YUFDN0Q7WUFDRCxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFVBQVUsSUFBSSxPQUFPLENBQUMsTUFBTSxjQUFjLENB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