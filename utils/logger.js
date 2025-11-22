const winston = require('winston');
const path = require('path');
const util = require('util');

// 增加堆栈追踪限制
Error.stackTraceLimit = 50;

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
            return `[${timestamp}] [${level.toUpperCase()}] [${caller}] ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, caller }) => {
                    return `[${timestamp}] ${level} [${caller}]: ${message}`;
                })
            )
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
