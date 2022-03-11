import is from '@sindresorhus/is'
import {createHmac} from 'crypto'
import {createReadStream} from 'fs'
import got, {Got, Options} from 'got'
import * as Stream from 'stream'
import {Readable} from 'stream'
import {pipeline} from 'stream/promises'
import {EnumStorageClass} from './constant'
import {
  IFinishMultipartUploadRes, IGetMultiUploadIdRes, IHeadFileRes, IInitiateMultipartUploadRes, IListObjectsRes, IOptions,
  IPrefixFileListRes, IUploadPartRes,
} from './type'

const defaultMimeType = 'application/octet-stream'

export class UFile {
  public readonly got: Got

  private readonly pubKey: string
  private readonly priKey: string
  private readonly bucketName: string
  private readonly domain: string
  private readonly scheme: string

  /**
   * UFile SDK
   * @param options
   */
  constructor(options: IOptions) {
    this.pubKey = options.pubKey
    this.priKey = options.priKey
    this.bucketName = options.bucketName
    this.domain = `${this.bucketName}.${options.region}.ufileos.com`
    this.scheme = options.useHttps ? 'https' : 'http'
    this.got = got.extend({
      prefixUrl: `${this.scheme}://${this.domain}`,
      username: this.pubKey,
      hooks: {
        beforeRequest: [
          (options) => {
            const sign = this.sign(options)
            options.password = sign
            options.headers['authorization'] = `UCloud ${options.username}:${sign}`
          },
        ],
      },
    })
  }

  /**
   * 前缀列表查询
   * @param {string} [prefix=''] 前缀，utf-8编码，默认为空字符串
   * @param {string} [marker=''] 标志字符串，utf-8编码，默认为空字符串
   * @param {number} [limit=20] 文件列表数目，默认为20
   * @returns {Promise}
   */
  public async prefixFileList(prefix = '', marker = '', limit = 20): Promise<IPrefixFileListRes> {
    return this.got<IPrefixFileListRes>({
      searchParams: {
        list: '',
        prefix,
        marker,
        limit,
      },
    }).json()
  }

  /**
   * 上传文件
   * @param {string} key
   * @param {Buffer|Stream.Readable|string} file 文件
   * @param {string} [mimeType='application/octet-stream'] 文件类型
   * @returns {Promise}
   */
  public async putFile(key: string, file: Buffer | Readable | string,
    mimeType = defaultMimeType): Promise<void> {
    switch (true) {
      case is.buffer(file):
      case is.string(file):
        await this.got.put(key, {
          body: file,
          headers: {
            'content-type': mimeType,
          },
        })
        break
      case file instanceof Stream.Readable:
        await pipeline(file, this.got.put(key, {
          headers: {
            'content-type': mimeType,
          },
          isStream: true,
        }))
        break
      default:
        throw new TypeError('unknown file type')
    }
  }

  /**
   * 上传本地文件
   * @param {string} key
   * @param {string} path 文件路径
   * @param {string} [mimeType='application/octet-stream'] 文件类型
   * @returns {Promise}
   */
  public async uploadFile(key: string, path: string,
    mimeType = defaultMimeType): Promise<void> {
    return this.putFile(key, createReadStream(path), mimeType)
  }

  /**
   * 秒传文件
   * @param {string} hash 待上传文件的ETag,详见ETag生成文档
   * @param {string} fileName Bucket中文件的名称
   * @param {string} fileSize 待上传文件的大小
   * @returns {Promise}
   */
  public async uploadHit(hash: string, fileName: string, fileSize: string): Promise<boolean> {
    const res = await this.got.post('uploadhit', {
      searchParams: {
        Hash: hash,
        FileName: fileName,
        FileSize: fileSize,
      },
      throwHttpErrors: false,
    })
    return res.statusCode === 200
  }

  /**
   * 下载文件
   * @param {string} key key
   * @param {string} [range] 分片下载的文件范围
   * @param {string} [ifModifiedSince] 只返回从某时修改过的文件，否则返回304(not modified)
   * @returns {Promise}
   */
  public async getFile(key: string, range?: string, ifModifiedSince?: string): Promise<Buffer> {
    return this.got(key, {
      headers: {
        range,
        'if-modified-since': ifModifiedSince,
      },
    })
      .buffer()
  }

  /**
   * 下载文件
   * @param {string} key key
   * @param {string} [range] 分片下载的文件范围
   * @param {string} [ifModifiedSince] 只返回从某时修改过的文件，否则返回304(not modified)
   * @returns {Promise}
   */
  public async getFileStream(key: string, range?: string, ifModifiedSince?: string): Promise<Readable> {
    return this.got(key, {
      headers: {
        range,
        'if-modified-since': ifModifiedSince,
      },
      isStream: true,
    })
  }

  /**
   * 查询文件基本信息
   * @param {string} key
   * @returns {Promise}
   */
  public async headFile(key: string): Promise<IHeadFileRes> {
    const res = await this.got.head(key)
    return res.headers
  }

  /**
   * 获取目录文件列表
   * @param prefix
   * @param marker
   * @param maxKeys
   * @param delimiter
   */
  public async listObjects(prefix: string, marker?: string, maxKeys?: number,
    delimiter?: string): Promise<IListObjectsRes> {
    return this.got.get({
      searchParams: {
        'listobjects': '',
        prefix,
        marker,
        'max-keys': maxKeys,
        delimiter,
      },
    })
      .json()
  }

  /**
   * 删除文件
   * @param {string} key
   * @returns {Promise}
   */
  public async deleteFile(key: string): Promise<void> {
    await this.got.delete(key)
  }

  /**
   * 初始化分片上传
   * @param {string} key 文件名
   * @returns {Promise}
   */
  public async initiateMultipartUpload(key: string): Promise<IInitiateMultipartUploadRes> {
    return this.got.post(key, {
      searchParams: {
        uploads: '',
      },
    })
      .json()
  }

  /**
   * 上传分片
   * @param {string} key 文件名
   * @param {string} uploadId 分片id
   * @param {number} partNumber 第几块分片
   * @param {buffer} buffer 内容
   * @returns {Promise}
   */
  public async uploadPart(key: string, uploadId: string, partNumber: number, buffer: Buffer): Promise<IUploadPartRes> {
    return this.got.put(key, {
      searchParams: {
        uploadId,
        partNumber,
      },
      body: buffer,
    })
      .json()
  }

  /**
   * 完成分片
   * @param {string} key 文件名
   * @param {string} uploadId 分片id
   * @param {array} parts 分片的etag们
   * @param {string} [newKey] 等上传完毕开始指定的key可能已经被占用,遇到这种情形时会采用newKey参数的值作为文件最终的key，否则仍然采用原来的key
   * @returns {Promise}
   */
  public async finishMultipartUpload(key: string, uploadId: string, parts?: string[],
    newKey?: string): Promise<IFinishMultipartUploadRes> {
    const res = await this.got.post<Omit<IFinishMultipartUploadRes, 'ETag'>>(key, {
      searchParams: {
        uploadId,
        newKey,
      },
      body: parts.join(','),
      responseType: 'json',
    })
    return {
      ...res.body,
      ETag: res.headers.etag,
    }
  }

  /**
   * 放弃分片
   * @param {string} key 文件名
   * @param {string} uploadId 分片id
   * @returns {Promise}
   */
  public async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.got.delete(key, {
      searchParams: {
        uploadId,
      },
    })
  }

  /**
   * 获取正在执行的分片上传
   * @param {string} [prefix] 前缀，utf-8编码，默认为空字符串
   * @param {string} [marker] 标志字符串，utf-8编码，默认为空字符串
   * @param {number} [limit=20] id列表数目，默认为20
   * @returns {Promise}
   */
  public async getMultiUploadId(prefix: string, marker: string, limit = 20): Promise<IGetMultiUploadIdRes> {
    return this.got({
      searchParams: {
        muploadid: '',
        prefix,
        marker,
        limit,
      },
    })
      .json()
  }

  /**
   * 文件存储类型转换
   * @param key
   * @param storageClass
   */
  public async classSwitch(key: string, storageClass: EnumStorageClass): Promise<void> {
    await this.got.put(key, {
      searchParams: {
        storageClass,
      },
    })
  }

  /**
   * 解冻文件
   * @param key
   */
  public async restore(key: string): Promise<void> {
    await this.got.put(key, {
      searchParams: {
        restore: '',
      },
    })
  }

  /**
   * 操作文件的Meta信息
   * @param {string} key key
   * @param {string} mimeType 文件的mimetype
   * @returns {Promise}
   */
  public async opMeta(key: string, mimeType: string): Promise<void> {
    await this.got.post(key, {
      searchParams: {
        opmeta: '',
      },
      json: {
        op: 'set',
        metak: 'mimetype',
        metav: mimeType,
      },
    })
  }

  private sign(options: Options): string {
    const p = [options.method.toUpperCase(), getHeader('content-md5'), getHeader('content-type'), getHeader('date')]
    Object.keys(options.headers)
      .sort()
      .forEach((key) => {
        if (key.toLowerCase().startsWith('x-ucloud')) {
          p.push(`${key.toLowerCase()}:${getHeader(key)}`)
        }
      })
    let url = options.url
    if (is.string(url)) {
      url = new URL(url)
    }
    p.push(`/${this.bucketName}${url.pathname}`)
    const stringToSign = p.join('\n')
    return createHmac('sha1', this.priKey).update(stringToSign).digest('base64')

    function getHeader(key): string {
      const header = options.headers[key] ?? options[key.toLowerCase()] ?? ''
      if (Array.isArray(header)) return header.join()
      return header
    }
  }
}

export * from './constant.js'
export * from './type.js'