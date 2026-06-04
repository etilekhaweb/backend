import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Load env vars before importing modules that depend on them
dotenv.config();
import path from 'path';
import fs from 'fs';
import apiRouter from './router';
import { uploadsDir } from './uploads';

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());

// Serve static files from the uploads directory
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api', apiRouter);

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Backend is healthy and running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
