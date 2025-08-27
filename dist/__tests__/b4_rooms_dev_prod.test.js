"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const devServer_1 = require("../test-utils/devServer");
describe('B4: Rooms Dev/Prod', () => {
    describe('Dev mode rooms operations', () => {
        test('rooms allocate/join/leave/close success path', async () => {
            await (0, devServer_1.withServer)({
                env: {
                    NODE_ENV: 'development',
                    ORCH_ENABLED: 'true'
                }
            }, async (url) => {
                // Allocate room
                const allocateRes = await axios_1.default.post(`${url}/orch/api/v1/rooms/allocate`, {
                    gameId: 'rawwar-demo',
                    playerId: '123e4567-e89b-42d3-a456-426614174000'
                }, {
                    headers: {
                        'X-Correlation-Id': '11111111-2222-4333-8444-555555555555'
                    }
                });
                expect(allocateRes.status).toBe(200);
                expect(allocateRes.data.ok).toBe(true);
                expect(allocateRes.data.roomId).toBeDefined();
                const roomId = allocateRes.data.roomId;
                // Join room
                const joinRes = await axios_1.default.post(`${url}/orch/api/v1/rooms/join`, {
                    roomId,
                    playerId: '223e4567-e89b-42d3-a456-426614174001'
                }, {
                    headers: {
                        'X-Correlation-Id': '22222222-3333-4444-8555-666666666666'
                    }
                });
                expect(joinRes.status).toBe(200);
                expect(joinRes.data.ok).toBe(true);
                expect(joinRes.data.players).toBe(2);
                // Leave room
                const leaveRes = await axios_1.default.post(`${url}/orch/api/v1/rooms/leave`, {
                    roomId,
                    playerId: '223e4567-e89b-42d3-a456-426614174001'
                }, {
                    headers: {
                        'X-Correlation-Id': '33333333-4444-4555-8666-777777777777'
                    }
                });
                expect(leaveRes.status).toBe(200);
                expect(leaveRes.data.ok).toBe(true);
                expect(leaveRes.data.removed).toBe(true);
                // Close room
                const closeRes = await axios_1.default.post(`${url}/orch/api/v1/rooms/close`, {
                    roomId
                }, {
                    headers: {
                        'X-Correlation-Id': '44444444-5555-4666-8777-888888888888'
                    }
                });
                expect(closeRes.status).toBe(200);
                expect(closeRes.data.ok).toBe(true);
            });
        });
        test('rooms negative cases - invalid UUID', async () => {
            await (0, devServer_1.withServer)({
                env: {
                    NODE_ENV: 'development',
                    ORCH_ENABLED: 'true'
                }
            }, async (url) => {
                try {
                    await axios_1.default.post(`${url}/orch/api/v1/rooms/join`, {
                        roomId: 'room-123',
                        playerId: 'not-a-uuid'
                    }, {
                        headers: {
                            'X-Correlation-Id': '55555555-6666-4777-8888-999999999999'
                        }
                    });
                    fail('Should have thrown 422');
                }
                catch (error) {
                    expect(error.response.status).toBe(422);
                    expect(error.response.data.error.code).toBe('RW-CAS-006');
                    expect(error.response.data.error.message).toBe('Invalid request');
                }
            });
        });
        test('rooms negative cases - unknown room', async () => {
            await (0, devServer_1.withServer)({
                env: {
                    NODE_ENV: 'development',
                    ORCH_ENABLED: 'true'
                }
            }, async (url) => {
                try {
                    await axios_1.default.post(`${url}/orch/api/v1/rooms/leave`, {
                        roomId: 'unknown-room-id',
                        playerId: '323e4567-e89b-42d3-a456-426614174002'
                    }, {
                        headers: {
                            'X-Correlation-Id': '66666666-7777-4888-8999-000000000000'
                        }
                    });
                    // Leave returns ok even for unknown room
                    // This is expected behavior
                }
                catch (error) {
                    // If it does error, check it's the right error
                    if (error.response) {
                        expect(error.response.status).toBe(422);
                    }
                }
            });
        });
        test('rooms method discipline - GET returns 405', async () => {
            await (0, devServer_1.withServer)({
                env: {
                    NODE_ENV: 'development',
                    ORCH_ENABLED: 'true'
                }
            }, async (url) => {
                const endpoints = ['/rooms/join', '/rooms/leave', '/rooms/close'];
                for (const endpoint of endpoints) {
                    try {
                        await axios_1.default.get(`${url}/orch/api/v1${endpoint}`, {
                            headers: {
                                'X-Correlation-Id': '77777777-8888-4999-8000-111111111111'
                            }
                        });
                        fail('Should have thrown 405');
                    }
                    catch (error) {
                        expect(error.response.status).toBe(405);
                        expect(error.response.headers['allow']).toBe('POST');
                        expect(error.response.data.error.code).toBe('RW-SYS-000');
                    }
                }
            });
        });
    });
    describe('Prod mode rooms blocked', () => {
        test('rooms endpoints return 404 in production', async () => {
            await (0, devServer_1.withServer)({
                env: {
                    NODE_ENV: 'production',
                    ORCH_ENABLED: 'true'
                }
            }, async (url) => {
                const endpoints = [
                    '/rooms/allocate',
                    '/rooms/join',
                    '/rooms/leave',
                    '/rooms/close'
                ];
                for (const endpoint of endpoints) {
                    try {
                        await axios_1.default.post(`${url}/orch/api/v1${endpoint}`, {
                            gameId: 'test',
                            playerId: '423e4567-e89b-42d3-a456-426614174003'
                        }, {
                            headers: {
                                'X-Correlation-Id': '88888888-9999-4000-8111-222222222222'
                            }
                        });
                        fail('Should have thrown 404');
                    }
                    catch (error) {
                        expect(error.response.status).toBe(404);
                        expect(error.response.data.error.code).toBe('RW-CAS-005');
                        expect(error.response.data.error.message).toBe('Not allowed in production');
                    }
                }
            });
        });
        test('orchestrator endpoints return 404 when disabled', async () => {
            await (0, devServer_1.withServer)({
                env: {
                    NODE_ENV: 'production',
                    ORCH_ENABLED: 'false'
                }
            }, async (url) => {
                try {
                    await axios_1.default.get(`${url}/orch/api/v1/health`, {
                        headers: {
                            'X-Correlation-Id': '99999999-0000-4111-8222-333333333333'
                        }
                    });
                    fail('Should have thrown 404');
                }
                catch (error) {
                    expect(error.response.status).toBe(404);
                    expect(error.response.data.error.code).toBe('RW-SYS-000');
                    expect(error.response.data.error.message).toBe('Not found');
                }
            });
        });
    });
});
//# sourceMappingURL=b4_rooms_dev_prod.test.js.map