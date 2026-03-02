const winston = require('winston');
const path = require('path');
const util = require('util');
const fs = require('fs');

// 增加堆栈追踪限制
Error.stackTraceLimit = 50;
const CALLER_WIDTH = 42;

// 创建日志目录
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function getCallerInfo() {
    const oldPrepareStackTrace = Error.prepareStackTrace;
    try {
        Error.prepareStackTrace = (err, stack) => stack;
        const stack = new Error().stack;
        Error.prepareStackTrace = oldPrepareStackTrace;

        if (stack && stack.length > 0) {
            const currentFile = __filename;

            for (let i = 0; i < stack.length; i++) {
                const frame = stack[i];
                const fileName = frame.getFileName();

                if (!fileName) continue;
                if (fileName === currentFile) continue;
                if (fileName.startsWith('node:')) continue;
                if (fileName.includes('node_modules')) continue;

                const line = frame.getLineNumber();
                let displayPath = fileName;
                try {
                    displayPath = path.relative(process.cwd(), fileName);
                } catch (e) {
                    displayPath = path.basename(fileName);
                }
                return `${displayPath}:${line}`;
            }
        }
    } catch (e) {
        return 'unknown error';
    }
    return 'unknown stack';
}

function formatCaller(caller, width = CALLER_WIDTH) {
    const value = caller || 'unknown';
    if (value.length > width) {
        return `...${value.slice(-(width - 3))}`;
    }
    return value.padEnd(width, ' ');
}

const fileLineFormat = winston.format((info) => {
    info.caller = getCallerInfo();
    return info;
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        fileLineFormat(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, caller }) => {
            return `[${timestamp}] [${level.toUpperCase()}] [${formatCaller(caller)}] ${message}`;
        })
    ),
    transports: [
        // 控制台输出（带颜色）
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, caller }) => {
                    return `[${timestamp}] ${level} [${formatCaller(caller)}]: ${message}`;
                })
            )
        }),
        // 合并日志文件（所有级别）
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5, // 保留5个文件
            tailable: true
        }),
        // 错误日志文件（仅错误级别）
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        }),
        // 按日期的日志文件
        new winston.transports.File({
            filename: path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 30, // 保留30天
            tailable: true
        })
    ],
});

console.log = function (...args) {
    logger.info(util.format(...args));
};

console.error = function (...args) {
    logger.error(util.format(...args));
};

console.warn = function (...args) {
    logger.warn(util.format(...args));
};

console.info = function (...args) {
    logger.info(util.format(...args));
};

console.debug = function (...args) {
    logger.debug(util.format(...args));
};

module.exports = logger;
