const _ = require('lodash');
const Promise = require('bluebird');
const test = require('ava').test;
const Redis = require('ioredis');

const Cacher = require('../lib/cache');

const opt = {
  redis: {
    host: '127.0.0.1',
    port: '6379',
    db: '12'
  },
  prefix: 'TEST_',
  expire: 5
};

const client = new Redis(opt.redis);
const cacher = new Cacher(opt);

const KEY = `${opt.prefix}getShopes`;
const getShopes = (type) => {
  if (type === 0) {
    return Promise.reject(new Error('bad params'));
  }

  if (type === 2) {
    return Promise.resolve(undefined);
  }

  return Promise.resolve(['shop01', 'shop02']);
};

test.beforeEach(() => client.flushall());

test('cache: should cache results in redis', (t) => {
  const payload = {
    key: 'getShopes',
    executor: getShopes.bind(null, 1)
  };
  return cacher.get(payload)
    .then((data) => {
      t.deepEqual(data, ["shop01", "shop02"]);
      return client.get(KEY);
    })
    .then(data => t.is(data, "[\"shop01\",\"shop02\"]"));
});

test('cache: should not cache when executor reject', (t) => {
  const payload = {
    key: 'getShopes',
    executor: getShopes.bind(null, 0)
  };
  return cacher.get(payload)
    .catch((err) => {
      t.is(err.message, 'bad params');
      return client.get(KEY);
    })
    .then(data => t.is(data, null));
});

test('cache: should return cache data when hit', (t) => {
  const payload = {
    key: 'getShopes',
    executor: getShopes.bind(null, 1),
    expire: 100
  };
  return client.set(KEY, '["shop01"]')
    .then(() => cacher.get(payload))
    .then((data) => {
      t.true(_.isArray(data));
      t.deepEqual(data, ['shop01']);
    });
});

test('cache: should recache when cache is outdated', (t) => {
  const payload = {
    key: 'getShopes',
    executor: getShopes.bind(null, 1)
  };
  return client.set(KEY, '["shop01"]', 'px', 10)
    .delay(11)
    .then(() => cacher.get(payload))
    .then((data) => {
      t.true(_.isArray(data));
      t.deepEqual(data, ["shop01", "shop02"]);
      return client.get(KEY);
    })
    .then(data => t.is(data, "[\"shop01\",\"shop02\"]"));
});

test('cache: should use default expire when expire is less than 0', (t) => {
  const payload = {
    key: 'getShopes',
    executor: getShopes.bind(null, 1),
    expire: -1
  };
  return cacher.get(payload)
    .then((data) => {
      t.true(_.isArray(data));
      t.deepEqual(data, ["shop01", "shop02"]);
      return client.ttl(KEY);
    })
    .then(ttl => t.true(ttl > 0 && ttl <= 5));
});

test('cache: should not cache when return an undefined by executor', (t) => {
  const payload = {
    key: 'getShopes',
    executor: getShopes.bind(null, 2)
  };
  return cacher.get(payload)
    .then((data) => {
      t.is(data, undefined);
      return client.get(KEY);
    })
    .then(data => t.is(data, null));
});
