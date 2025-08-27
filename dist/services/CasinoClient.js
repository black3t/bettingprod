"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class CasinoClient {
    client;
    constructor() {
        const baseURL = process.env.CASINO_BASE_URL || 'http://localhost:3001';
        const timeout = process.env.NODE_ENV === 'test' ? 7000 : 5000;
        this.client = axios_1.default.create({
            baseURL: baseURL.includes('/casino/api/v1') ? baseURL : `${baseURL}/casino/api/v1`,
            timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        // Request interceptor to add required headers
        this.client.interceptors.request.use((config) => {
            // Ensure required headers are present
            if (!config.headers['Authorization']) {
                config.headers['Authorization'] = `Bearer ${process.env.RGS_API_KEY || 'test_rgs_key'}`;
            }
            // sanitized trace only (no secrets/PII)
            logger_1.logger.info('outbound.rgs.request', {
                action: 'outbound.rgs.request',
                method: (config.method || 'GET').toUpperCase(),
                url: String(config.url || '')
            });
            return config;
        }, (error) => {
            logger_1.logger.error('Casino client request error', error);
            return Promise.reject(error);
        });
    }
    async debit(data, headers) {
        return this.client.post('/wallet/debit', data, { headers });
    }
    async credit(data, headers) {
        return this.client.post('/wallet/credit', data, { headers });
    }
    async checkLimits(data, headers) {
        return this.client.post('/limits/check', data, { headers });
    }
    async getBalance(data, headers) {
        return this.client.post('/wallet/balance', data, { headers });
    }
}
exports.default = new CasinoClient();
//# sourceMappingURL=CasinoClient.js.map