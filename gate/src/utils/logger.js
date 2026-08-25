"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
exports.warn = warn;
exports.error = error;
function prefix() {
    return `[${new Date().toISOString()}]`;
}
function log(message) {
    console.log(`${prefix()} ${message}`);
}
function warn(message) {
    console.warn(`${prefix()} WARNING: ${message}`);
}
function error(message) {
    console.error(`${prefix()} ERROR: ${message}`);
}
//# sourceMappingURL=logger.js.map