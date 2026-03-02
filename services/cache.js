/**
 * 订阅转换缓存管理服务
 * 采用 Stale-While-Revalidate 策略
 * 使用文件系统持久化存储
 */
const fs = require('fs');
const path = require('path');

class SubscriptionCache {
    constructor() {
        this.cacheDir = path.join(__dirname, '../data/cache');
        this.indexFile = path.join(this.cacheDir, 'index.json');

        // 确保缓存目录存在
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
            console.log(`缓存目录已创建: ${this.cacheDir}`);
        }

        // 从文件加载缓存索引
        this.cache = this.loadIndex();
        console.log(`缓存系统已启动，加载了 ${this.cache.size} 个缓存项`);
    }

    /**
     * 从文件加载缓存索引
     * @returns {Map} 缓存索引
     */
    loadIndex() {
        try {
            if (fs.existsSync(this.indexFile)) {
                const data = fs.readFileSync(this.indexFile, 'utf8');
                const indexData = JSON.parse(data);
                return new Map(Object.entries(indexData));
            }
        } catch (error) {
            console.error('加载缓存索引失败:', error.message);
        }
        return new Map();
    }

    /**
     * 保存缓存索引到文件
     */
    saveIndex() {
        try {
            const indexData = Object.fromEntries(this.cache);
            fs.writeFileSync(this.indexFile, JSON.stringify(indexData, null, 2), 'utf8');
        } catch (error) {
            console.error('保存缓存索引失败:', error.message);
        }
    }

    /**
     * 生成缓存文件路径
     * @param {string} key - 缓存key
     * @returns {string} 文件路径
     */
    getCacheFilePath(key) {
        // 将 key 转换为安全的文件名（Windows不支持冒号等特殊字符）
        const safeKey = key.replace(/:/g, '_').replace(/[^a-zA-Z0-9-_]/g, '_');
        return path.join(this.cacheDir, `${safeKey}.txt`);
    }

    /**
     * 生成缓存key
     * @param {string} token - 用户token
     * @param {string} format - 订阅格式
     * @param {string} mode - 转换模式 (remote/native)
     * @param {string} extensionKey - 扩展脚本指纹
     * @returns {string} 缓存key
     */
    generateKey(token, format, mode = 'remote', extensionKey = 'default') {
        return `sub_cache:${token}:${format}:${mode}:${extensionKey}`;
    }

    /**
     * 获取缓存
     * @param {string} key - 缓存key
     * @returns {object|undefined} 缓存数据
     */
    get(key) {
        const meta = this.cache.get(key);
        if (!meta) {
            return undefined;
        }

        try {
            const filePath = this.getCacheFilePath(key);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                return {
                    content,
                    format: meta.format,
                    lastUpdate: meta.lastUpdate,
                    expiresAt: meta.expiresAt,
                    refreshing: meta.refreshing || false
                };
            } else {
                // 文件不存在，清理索引
                this.cache.delete(key);
                this.saveIndex();
                return undefined;
            }
        } catch (error) {
            console.error(`读取缓存文件失败 ${key}:`, error.message);
            return undefined;
        }
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
        const meta = {
            format,
            lastUpdate: now,
            expiresAt: now + ttlHours * 60 * 60 * 1000,
            refreshing: false
        };

        try {
            // 写入缓存内容到文件
            const filePath = this.getCacheFilePath(key);
            fs.writeFileSync(filePath, content, 'utf8');

            // 更新索引
            this.cache.set(key, meta);
            this.saveIndex();

            console.log(`缓存已设置: ${key}, 有效期: ${ttlHours}小时`);
        } catch (error) {
            console.error(`写入缓存文件失败 ${key}:`, error.message);
        }
    }

    /**
     * 标记缓存是否正在刷新
     * @param {string} key - 缓存key
     * @param {boolean} refreshing - 是否正在刷新
     */
    markRefreshing(key, refreshing) {
        const meta = this.cache.get(key);
        if (meta) {
            meta.refreshing = refreshing;
            this.saveIndex();
        }
    }

    /**
     * 删除缓存
     * @param {string} key - 缓存key
     */
    delete(key) {
        try {
            // 删除缓存文件
            const filePath = this.getCacheFilePath(key);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            // 从索引中删除
            this.cache.delete(key);
            this.saveIndex();

            console.log(`缓存已删除: ${key}`);
        } catch (error) {
            console.error(`删除缓存失败 ${key}:`, error.message);
        }
    }

    /**
     * 清空所有缓存
     */
    clear() {
        try {
            const size = this.cache.size;

            // 删除所有缓存文件
            for (const key of this.cache.keys()) {
                const filePath = this.getCacheFilePath(key);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            // 清空索引
            this.cache.clear();
            this.saveIndex();

            console.log(`已清空所有缓存，共 ${size} 项`);
        } catch (error) {
            console.error('清空缓存失败:', error.message);
        }
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
