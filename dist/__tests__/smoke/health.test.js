"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
// Simple smoke test for health endpoints
describe('Health Endpoints Smoke Test', () => {
    let app;
    beforeAll(() => {
        // Use the actual app instance
        jest.resetModules();
        process.env.USE_SQLITE = 'true';
        process.env.API_BASE_PATH = '/casino/api/v1';
        process.env.RGS_BASE_PATH = '/rgs/api/v1';
        process.env.NODE_ENV = 'test';
        app = require('../../index');
    });
    test('Casino health returns 200 with success=true and ts', async () => {
        const res = await (0, supertest_1.default)(app).get('/casino/api/v1/health');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
    test('RGS health returns 200 with success=true and ts', async () => {
        const res = await (0, supertest_1.default)(app).get('/rgs/api/v1/health');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});
//# sourceMappingURL=health.test.js.map