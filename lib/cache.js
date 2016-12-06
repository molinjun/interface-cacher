const _ = require('lodash');
const Redis = require('ioredis');

class Cacher {
  /**
   * @param payload
   * @param {object} payload.redis 用于redis的连接
   * @param {string} payload.prefix key的默认前缀
   * @param {number} payload.expire key的有效期，单位s
   */
  constructor(payload) {
    const opt = _.defaults(payload, {
      redis: {
        host: '127.0.0.1',
        port: '6379',
        db: '12'
      }
    });

    this.client = new Redis(opt.redis);
    this.prefix = opt.prefix || '';
    this.expire = opt.expire || 5;
  }

  /**
    * 使用redis为接口加缓存
    * @param {object} payload
    * @param {string} payload.key 要查找的key
    * @param {promise} payload.executor 如果未击中，要执行的操作
    * @param {number} payload.expire 失效时间, 单位s
    * @return {object} 缓存中数据(击中) 或executor返回数据(未击中)
    * @Example:
    * 说明：以给getShopes接口加缓存为例
    * 要点： executor为一个返回bluebird 的promise
    * getShopes接口如下：
    * const getShopes = (type) => {
    *   if (type === 0) {
    *     return Promise.reject(new Error('bad params'));
    *   }
    *   return Promise.resolve(['shop01', 'shop02']);
    * };
    *
    * 使用方式：
    * const cache = require('path-to-cache');
    *
    * const payload = {
    *   key: 'getShopes',
    *   executor: getShopes.bind(null, 1),
    *   expire: 100
    * };
    *
    * cache.get(payload)
    * .then((data) => {
    *   // process the data
    * }
    * .catch((err) => {
    *   / handle the exception when encounter with error
    * );
    */
  get(payload) {
    const self = this;
    const { key } = payload;
    const prefix = this.prefix;
    let expire = payload.expire || this.expire;

    if (expire < 0) {
      expire = this.expire;
    }

    const saveKey = prefix + key;
    return this.client.get(saveKey).then((data) => {
      if (data !== null && data !== 'undefined') {
        return JSON.parse(data);
      }

      return payload.executor()
        .tap((result) => {
          if (!_.isUndefined(result)) {
            const value = JSON.stringify(result);
            self.client.set(saveKey, value, 'ex', expire);
          }
        });
    });
  }
}

module.exports = Cacher;
