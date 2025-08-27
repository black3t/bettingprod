"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOutboxOnce = runOutboxOnce;
const WebhookDispatcher_1 = require("./WebhookDispatcher");
async function runOutboxOnce() {
    await WebhookDispatcher_1.WebhookDispatcher.runOnce();
}
exports.default = { runOutboxOnce };
//# sourceMappingURL=RgsOutbox.js.map