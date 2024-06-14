class Cache {
  cacheData = {};

  constructor() {
    this.cacheData = {};
  }

  get(key) {
    return this.cacheData[key];
  }

  set(key, value) {
    this.cacheData[key] = value;
  }
}

module.exports = Cache;
