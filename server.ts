import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_IMAGE_MIME = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const ALLOWED_VIDEO_MIME = new Map<string, string>([
  ['video/webm', '.webm'],
  ['video/mp4', '.mp4'],
  ['video/quicktime', '.mov'],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const baseMime = file.mimetype.split(';')[0].trim().toLowerCase();
    const ext = ALLOWED_IMAGE_MIME.get(baseMime) || ALLOWED_VIDEO_MIME.get(baseMime) || '.bin';
    const uniqueId = crypto.randomUUID();
    cb(null, `artifact-${Date.now()}-${uniqueId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB cap for archival video/photo
  },
  fileFilter: (_req, file, cb) => {
    const baseMime = file.mimetype.split(';')[0].trim().toLowerCase();
    if (ALLOWED_IMAGE_MIME.has(baseMime) || ALLOWED_VIDEO_MIME.has(baseMime)) {
      cb(null, true);
    } else {
      cb(new Error('不支援的檔案格式，請使用 JPG、PNG、WebP 照片或 MP4、WebM、MOV 攝影影片。'));
    }
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Serve archived photos and videos with Range support for HTML5 video streaming
  app.use(
    '/uploads',
    express.static(uploadsDir, {
      maxAge: '7d',
      acceptRanges: true,
    })
  );

  app.post('/api/upload', upload.single('media'), (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: '未收到影像檔案，請重新拍照、攝影或選擇檔案。' });
      return;
    }

    const baseMime = req.file.mimetype.split(';')[0].trim().toLowerCase();
    const mediaType = ALLOWED_VIDEO_MIME.has(baseMime) ? 'video' : 'photo';

    res.status(201).json({
      url: `/uploads/${req.file.filename}`,
      mediaType,
      size: req.file.size,
      mimeType: baseMime,
    });
  });

  // Upload error handler
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: '檔案大小超過 100MB 上限，請縮短攝影時間或壓縮後再上傳。' });
        return;
      }
      res.status(400).json({ error: `上傳失敗：${err.message}` });
      return;
    }
    if (err instanceof Error && err.message.includes('不支援的檔案格式')) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Xinsheng Archive Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
