"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDegradeState = setDegradeState;
exports.getDegradeState = getDegradeState;
exports.resetDegradeState = resetDegradeState;
exports.isDbDegradeOn = isDbDegradeOn;
// Health degrade simulation for testing
const fs_1 = __importDefault(require("fs"));
let degradeState = {
    db: false,
    redis: false
};
function setDegradeState(component, state) {
    degradeState[component] = state;
}
function getDegradeState() {
    return { ...degradeState };
}
function resetDegradeState() {
    degradeState.db = false;
    degradeState.redis = false;
}
function isDbDegradeOn() {
    return process.env.DEGRADE_DB === '1' || fs_1.default.existsSync('/tmp/rawwar_degrade_db');
}
//# sourceMappingURL=healthDegrade.js.map