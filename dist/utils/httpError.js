"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildError = buildError;
const rw_1 = require("../registry/rw");
/**
 * Legacy adapter - delegates to registry
 * Mantiene compatibilità API per test esistenti
 */
function buildError(code, message, correlationId) {
    const { body } = (0, rw_1.buildError)(code, { message, correlationId });
    return body;
}
//# sourceMappingURL=httpError.js.map