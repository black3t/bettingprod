"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionStore = void 0;
const redis_1 = require("../config/redis");
const ioredis_1 = __importDefault(require("ioredis"));
// Wrapper to handle both Redis and Map for session storage
exports.sessionStore = {
    async get(key) {
        if (!redis_1.sessionStore)
            return null;
        if (redis_1.sessionStore instanceof ioredis_1.default) {
            return await redis_1.sessionStore.get(key);
        }
        else if (redis_1.sessionStore instanceof Map) {
            return redis_1.sessionStore.get(key) || null;
        }
        return null;
    },
    async setex(key, seconds, value) {
        if (!redis_1.sessionStore)
            return;
        if (redis_1.sessionStore instanceof ioredis_1.default) {
            await redis_1.sessionStore.setex(key, seconds, value);
        }
        else if (redis_1.sessionStore instanceof Map) {
            redis_1.sessionStore.set(key, value);
            // Simulate expiry in test mode
            setTimeout(() => {
                if (redis_1.sessionStore instanceof Map) {
                    redis_1.sessionStore.delete(key);
                }
            }, seconds * 1000);
        }
    },
    async del(key) {
        if (!redis_1.sessionStore)
            return;
        if (redis_1.sessionStore instanceof ioredis_1.default) {
            await redis_1.sessionStore.del(key);
        }
        else if (redis_1.sessionStore instanceof Map) {
            redis_1.sessionStore.delete(key);
        }
    }
};
//# sourceMappingURL=sessionStore.js.map