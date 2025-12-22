/**
 * 订阅转换缓存管理服务
 * 采用 Stale-While-Revalidate 策略
 */
class SubscriptionCache {
    constructor() {
        this.cache = new Map(); // key: cacheKey, value: cacheData
    }

    /**
     * 生成缓存key
     * @param {string} token - 用户token
     * @param {string} format - 订阅格式
     * @returns {string} 缓存key
     */
    generateKey(token, format) {
        return `sub_cache:${token}:${format}`;
    }

    /**
     * 获取缓存
     * @param {string} key - 缓存key
     * @returns {object|undefined} 缓存数据
     */
    get(key) {
        return this.cache.get(key);
    }

    /**
     * 检查缓存是否有效（未过期）
     * @param {object} cacheData - 缓存数据
     * @returns {boolean} 是否有效
     */
    isValid(cacheData) {
        if (!cacheData) return false;
        return Date.now() < cacheData.expiresAt;
    }

    /**
     * 设置缓存
     * @param {string} key - 缓存key
     * @param {string} content - 订阅内容
     * @param {string} format - 订阅格式
     * @param {number} ttlHours - 缓存有效期（小时）
     */
    set(key, content, format, ttlHours) {
        const now = Date.now();
        this.cache.set(key, {
            content,
            format,
            lastUpdate: now,
            expiresAt: now + ttlHours * 60 * 60 * 1000,
            refreshing: false
        });
        console.log(`缓存已设置: ${key}, 有效期: ${ttlHours}小时`);
    }

    /**
     * 标记缓存是否正在刷新
     * @param {string} key - 缓存key
     * @param {boolean} refreshing - 是否正在刷新
     */
    markRefreshing(key, refreshing) {
        const data = this.cache.get(key);
        if (data) {
            data.refreshing = refreshing;
        }
    }

    /**
     * 删除缓存
     * @param {string} key - 缓存key
     */
    delete(key) {
        this.cache.delete(key);
        console.log(`缓存已删除: ${key}`);
    }

    /**
     * 清空所有缓存
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`已清空所有缓存，共 ${size} 项`);
    }

    /**
     * 获取缓存统计信息
     * @returns {object} 统计信息
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * 获取缓存年龄（秒）
     * @param {object} cacheData - 缓存数据
     * @returns {number} 缓存年龄（秒）
     */
    getCacheAge(cacheData) {
        if (!cacheData) return 0;
        return Math.floor((Date.now() - cacheData.lastUpdate) / 1000);
    }
}

// 导出单例
module.exports = new SubscriptionCache();
