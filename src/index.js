/**
 * Created by bangbang93 on 2017/9/13.
 */
'use strict';
const request = require('superagent')
const crypto = require('crypto')
const pascalCase = require('pascal-case')
const Stream = require('stream')
const fs = require('fs')

class UFile {
  /**
   * UFile SDK
   * @param {string} pubKey api公钥
   * @param {string} priKey api私钥
   * @param {string} bucketName 存储空间名
   * @param {string} domain 存储空间域名
   * @param {boolean} useHttps=false 是否使用https
   */
  constructor ({pubKey, priKey, bucketName, domain = '.cn-bj.ufileos.com', useHttps = false}) {
    this._pubKey = pubKey
    this._priKey = priKey
    this._bucketName = bucketName
    this._domain = domain
    this._protocol = useHttps? 'https' : 'http'
  }

  /**
   * 前缀列表查询
   * @param {string} [prefix=''] 前缀，utf-8编码，默认为空字符串
   * @param {string} [marker=''] 标志字符串，utf-8编码，默认为空字符串
   * @param {number} [limit=20] 文件列表数目，默认为20
   * @returns {Promise}
   */
  prefixFileList({prefix, marker, limit}) {
    return this._request({
      url: `http://${this._bucketName}${this._domain}`,
      query: {
        list: '',
        prefix,
        marker,
        limit
      }
    })
  }

  /**
   * 上传文件
   * @param {string} key
   * @param {Buffer|Stream.Readable|string} file 文件
   * @param {string} [mimeType='application/octet-stream'] 文件类型
   * @returns {Promise}
   */
  putFile({key, file, mimeType= 'application/octet-stream'}) {
    switch (true) {
      case file instanceof Buffer:
        return this._request({
          key,
          method: 'put',
          body: file,
          headers: {
            'content-type': mimeType
          }
        })
      case file instanceof Stream.Readable:
        const stream = this._request({
          key,
          method: 'put',
          headers: {
            'content-type': mimeType,
          }
        })
        return new Promise((resolve) => {
          file.pipe(stream)
          file.on('end', resolve)
        })
      case typeof file === 'string':
        return this.putFile({
          key,
          file: fs.createReadStream(file),
          mimeType,
        })
      default:
        throw new Error('cannot resolve file')
    }
  }

  /**
   * 秒传文件
   * @param {string} hash 待上传文件的ETag,详见ETag生成文档
   * @param {string} fileName Bucket中文件的名称
   * @param {string} fileSize 待上传文件的大小
   * @returns {Promise}
   */
  uploadHit({hash, fileName, fileSize}) {
    return this._request({
      url: `${this._protocol}://${this._bucketName}${this._domain}/uploadhit`,
      query: {
        Hash: hash,
        FileName: fileName,
        FileSize: fileSize,
      }
    })
  }

  /**
   * 下载文件
   * @param {string} key key
   * @param {string} [range] 分片下载的文件范围
   * @param {string} [ifModifiedSince] 只返回从某时修改过的文件，否则返回304(not modified)
   * @returns {Promise}
   */
  getFile({key, range, ifModifiedSince}) {
    return this._request({
      key,
      headers: {
        range,
        'if-modified-since': ifModifiedSince
      }
    })
  }

  /**
   * 查询文件基本信息
   * @param {string} key
   * @returns {Promise}
   */
  headFile(key) {
    if (typeof key === 'object') {
      key = key.key
    }
    return this._request({
      key,
      method: 'head'
    })
  }

  /**
   * 删除文件
   * @param {string} key
   * @returns {Promise}
   */
  deleteFile(key) {
    if (typeof key === 'object') {
      key = key.key
    }
    return this._request({
      key,
      method: 'delete'
    })
  }

  /**
   * 初始化分片上传
   * @param {string} key 文件名
   * @returns {Promise}
   */
  initiateMultipartUpload({key}) {
    return this._request({
      method: 'post',
      key,
      query:{
        uploads: ''
      }
    })
  }

  /**
   * 上传分片
   * @param {string} key 文件名
   * @param {string} uploadId 分片id
   * @param {number} partNumber 第几块分片
   * @param {buffer} buffer 内容
   * @returns {Promise}
   */
  uploadPart({key, uploadId, partNumber, buffer}) {
    return this._request({
      method: 'put',
      key,
      query: {
        uploadId,
        partNumber,
      },
      body: buffer,
    })
  }

  /**
   * 完成分片
   * @param {string} key 文件名
   * @param {string} uploadId 分片id
   * @param {string} [newKey] 等上传完毕开始指定的key可能已经被占用,遇到这种情形时会采用newKey参数的值作为文件最终的key，否则仍然采用原来的key
   * @param {array} parts 分片的etag们
   * @returns {Promise}
   */
  finishMultipartUpload({key, uploadId, newKey, parts}) {
    return this._request({
      method: 'post',
      key,
      query: {
        uploadId,
        newKey,
      },
      body: parts.join(',')
    })
  }

  /**
   * 放弃分片
   * @param {string} key 文件名
   * @param {string} uploadId 分片id
   * @returns {Promise}
   */
  abortMultipartUpload({key, uploadId}) {
    return this._request({
      method: 'delete',
      key,
      query: {
        uploadId,
      }
    })
  }

  /**
   * 获取正在执行的分片上传
   * @param {string} [prefix] 前缀，utf-8编码，默认为空字符串
   * @param {string} [marker] 标志字符串，utf-8编码，默认为空字符串
   * @param {number} [limit=20] id列表数目，默认为20
   * @returns {Promise}
   */
  getMultiUploadId({prefix, marker, limit}) {
    return this._request({
      method: 'get',
      query: {
        prefix,
        marker,
        limit,
      }
    })
  }

  /**
   * 获取已上传成功的分片列表
   * @param {string} uploadId 上传id
   * @returns {Promise}
   */
  getMultiUploadPart({uploadId}) {
    return this._request({
      method: 'get',
      query: {
        muploadpart: '',
        uploadId,
      }
    })
  }

  /**
   * 操作文件的Meta信息
   * @param {string} key key
   * @param {string} mimeType 文件的mimetype
   * @returns {Promise}
   */
  opMeta({key, mimeType}) {
    return this._request({
      method: 'post',
      key,
      query: {
        opmeta: ''
      },
      body: {
        op: 'ste',
        metak: 'mimetype',
        metav: mimeType,
      }
    })
  }

  async _request({url, query, body, method = 'get', files, headers, key = ''}) {
    if (!key.startsWith('/')) {
      key = '/' + key
    }
    if (!url) {
      url = `${this._protocol}://${this._bucketName}${this._domain}${key}`
    }

    const req = request(method, url)
    if (headers) {
      req.set(headers)
    }
    switch (method.toLowerCase()) {
      case 'post':
      case 'put':
      case 'patch':
        if (files) {
          req.field(body)
          Object.keys(files)
            .forEach((key) => {
              req.attach(key, files[key])
            })
        } else {
          req.send(body)
        }
        break
      default:
        break
    }
    if (qs) req.query(qs)
    req.use((req) => {
      req.set('authorization', `UCloud ${this._pubKey}:${this._sign(req, key)}`)
    })
    return req
  }

  sign({method, headers, bucketName = this._bucketName, key = ''}) {
    if (!key.startsWith('/')) {
      key = '/' + key
    }
    let p = [method.toUpperCase(), getHeader('content-md5'), getHeader('content-type'), getHeader('date')]
    Object.keys(headers)
      .sort()
      .forEach((key) => {
        if (key.toLowerCase().startsWith('x-ucloud')) {
          p.push(`${key.toLowerCase()}:${getHeader(key)}`)
        }
      })
    p.push(`/${bucketName}${key}`)
    const stringToSign = p.join('\n')
    return hmacSha1(stringToSign, this._priKey)

    function getHeader(key) {
      let r = headers[key] || header[key.toLowerCase()]
      if (r) return r
      const keys = Object.keys(headers)
      for(const k of keys) {
        if (k.toLowerCase() === key) {
          return headers[k]
        }
      }
      return ''
    }
  }
  

  _sign(req, key) {
    let p = [req.method.toUpperCase(), req.get('content-md5') || '', req.get('content-type') || '', req.get('date') ||'']
    Object.keys(req.header)
      .sort()
      .forEach((key) => {
        if (key.startsWith('X-UCloud')) {
          p.push(`${key.toLowerCase()}:${req.get(key)}`)
        }
      })
    p.push(`/${this._bucketName}${key}`)
    const stringToSign = p.join('\n')
    return hmacSha1(stringToSign, this._priKey)
  }
}

module.exports = UFile

const UFileBucket = require('./bucket')
UFile.Bucket = UFileBucket

function hmacSha1(str, priKey, digest = 'base64') {
  return crypto.createHmac('sha1', priKey).update(str).digest(digest)
}

function pascalObject(obj) {
  const r = {};
  Object.keys(obj)
    .forEach((key) => {
      r[pascalCase(key)] = obj[key]
    })
  return r
}
