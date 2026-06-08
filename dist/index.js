"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load env vars before importing modules that depend on them
dotenv_1.default.config();
const fs_1 = __importDefault(require("fs"));
const router_1 = __importDefault(require("./router"));
const uploads_1 = require("./uploads");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Ensure uploads directory exists
if (!fs_1.default.existsSync(uploads_1.uploadsDir)) {
    fs_1.default.mkdirSync(uploads_1.uploadsDir, { recursive: true });
}
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve static files from the uploads directory
app.use('/uploads', express_1.default.static(uploads_1.uploadsDir));
// API Routes
app.use('/api', router_1.default);
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is healthy and running' });
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
