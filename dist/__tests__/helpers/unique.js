"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniqueId = exports.uniqueEmail = void 0;
const crypto_1 = require("crypto");
const uniqueEmail = (p = 't') => `${p}-${(0, crypto_1.randomUUID)()}@test.local`;
exports.uniqueEmail = uniqueEmail;
const uniqueId = (p = 'id') => `${p}-${(0, crypto_1.randomUUID)()}`;
exports.uniqueId = uniqueId;
//# sourceMappingURL=unique.js.map