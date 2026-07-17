import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface VideoRecord {
  id: string;
  taskId: string;
  prompt: string;
  duration: string;
  quality: string;
  videoUrl: string | null;
  service: string;
  status: 'generating' | 'completed' | 'failed';
  createdAt: number;
  keyUsed: string; // To know which key to use for polling
}

interface Database {
  history: VideoRecord[];
}

function getDb(): Database {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    } catch(e) {
      return { history: [] };
    }
  }
  return { history: [] };
}

function saveDb(db: Database) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Extract keys from environment variables
function getKeysForService(service: string): string[] {
  const prefix = `${service.toUpperCase()}_API_KEY_`;
  return Object.keys(process.env)
    .filter(key => key.startsWith(prefix))
    .sort() // Ensures order KLING_API_KEY_1, KLING_API_KEY_2, etc.
    .map(key => process.env[key] as string)
    .filter(val => val.trim() !== "");
}

function analyzePrompt(prompt: string): string[] {
    const p = prompt.toLowerCase();
    
    // Kling: Realistic, cinematic, humans, natural movement
    const klingKeywords = ["واقعي", "سينمائي", "حقيقي", "اشخاص", "طبيعي", "realistic", "cinematic", "photorealistic", "4k", "8k", "human", "people", "natural"];
    
    // Hailuo: Fantasy, camera movements, effects, magic
    const hailuoKeywords = ["خيال", "حركة كاميرا", "طيران", "سحر", "تأثيرات", "fantasy", "camera", "pan", "zoom", "motion", "magic", "effects"];
    
    // Pika: Short videos, social media, TikTok, animation, anime
    const pikaKeywords = ["سوشيال", "تيك توك", "قصير", "انمي", "كرتون", "social", "tiktok", "short", "anime", "cartoon", "reels"];

    let klingScore = klingKeywords.filter(k => p.includes(k)).length;
    let hailuoScore = hailuoKeywords.filter(k => p.includes(k)).length;
    let pikaScore = pikaKeywords.filter(k => p.includes(k)).length;

    const scores = [
      { service: "kling", score: klingScore + 0.3 },
      { service: "hailuo", score: hailuoScore + 0.2 },
      { service: "pika", score: pikaScore + 0.1 }
    ];

    scores.sort((a, b) => b.score - a.score);
    return scores.map(s => s.service);
}

// REAL API request wrappers
async function generateVideoRequest(service: string, key: string, prompt: string): Promise<{ taskId: string }> {
  let url = "";
  let body: any = {};
  let headers: any = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${key}`
  };

  if (service === "kling") {
    url = "https://api.klingai.com/v1/videos/text2video";
    body = { prompt, model_name: "kling-v1" }; // Standard assumed endpoint
  } else if (service === "hailuo") {
    url = "https://api.minimax.chat/v1/video_generation";
    body = { prompt, model: "video-01" };
  } else if (service === "pika") {
    url = "https://api.pika.art/v1/videos";
    body = { promptText: prompt };
  } else {
    throw new Error("Unknown service");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: controller.signal
  });
  
  clearTimeout(timeoutId);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    let errorReason = "Unknown Error";
    if (response.status === 401) errorReason = "Invalid API Key";
    else if (response.status === 402 || response.status === 403) errorReason = "Quota Exceeded";
    else if (response.status === 429) errorReason = "Rate Limited";
    else if (response.status >= 500) errorReason = "Server Error";
    throw new Error(`API Error ${response.status}: ${errorReason} - ${JSON.stringify(data)}`);
  }

  // Parse task ID based on common API structures
  let taskId = "";
  if (service === "kling") taskId = data.data?.task_id || data.task_id;
  else if (service === "hailuo") taskId = data.task_id || data.id;
  else if (service === "pika") taskId = data.id || data.task_id;

  if (!taskId) {
    throw new Error(`No task ID returned in response: ${JSON.stringify(data)}`);
  }

  return { taskId };
}

async function checkVideoStatus(service: string, key: string, taskId: string): Promise<{ status: 'generating' | 'completed' | 'failed', videoUrl?: string }> {
  let url = "";
  let headers: any = {
    "Authorization": `Bearer ${key}`
  };

  if (service === "kling") {
    url = `https://api.klingai.com/v1/videos/text2video/${taskId}`;
  } else if (service === "hailuo") {
    url = `https://api.minimax.chat/v1/query/video_generation?task_id=${taskId}`;
  } else if (service === "pika") {
    url = `https://api.pika.art/v1/videos/${taskId}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error("Failed to fetch status");
  
  const data = await response.json();
  
  let status: 'generating' | 'completed' | 'failed' = 'generating';
  let videoUrl = undefined;

  // Generic parsing based on common AI APIs
  const apiStatus = (data.status || data.data?.status || data.state || "").toLowerCase();
  if (apiStatus.includes("success") || apiStatus.includes("completed") || apiStatus.includes("finished")) {
    status = 'completed';
    // Look for video url
    videoUrl = data.data?.video?.url || data.video_url || data.file_url || data.url || (data.data?.results && data.data.results[0]?.url);
  } else if (apiStatus.includes("fail") || apiStatus.includes("error")) {
    status = 'failed';
  }

  return { status, videoUrl };
}

// History API
app.get("/api/videos/history", (req, res) => {
  const db = getDb();
  // Strip the sensitive keyUsed before sending to client
  const safeHistory = db.history.map(({ keyUsed, ...rest }) => rest).sort((a, b) => b.createdAt - a.createdAt);
  res.json(safeHistory);
});

// Generate Video API
app.post("/api/videos/generate", async (req, res) => {
  const { prompt, duration, quality } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  const db = getDb();
  const preferredServices = analyzePrompt(prompt);
  
  let success = false;
  let taskId = "";
  let usedService = "";
  let successfulKey = "";
  let backendLogs: string[] = [];

  for (const service of preferredServices) {
    const keys = getKeysForService(service);
    if (keys.length === 0) {
      backendLogs.push(`[${service}] No API keys configured.`);
      continue;
    }

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        console.log(`[${service}] Trying Key ${i + 1}...`);
        const result = await generateVideoRequest(service, key, prompt);
        taskId = result.taskId;
        success = true;
        usedService = service;
        successfulKey = key;
        backendLogs.push(`[${service}] Key ${i + 1} succeeded. Task ID: ${taskId}`);
        break; // Break key loop
      } catch (err: any) {
        console.error(`[${service}] Key ${i + 1} failed: ${err.message}`);
        backendLogs.push(`[${service}] Key ${i + 1} failed: ${err.message}`);
        continue; // Try next key
      }
    }
    if (success) break; // Break service loop if successful
  }

  if (success) {
    const record: VideoRecord = {
      id: uuidv4(),
      taskId,
      prompt,
      duration,
      quality,
      videoUrl: null,
      service: usedService,
      status: 'generating',
      createdAt: Date.now(),
      keyUsed: successfulKey
    };
    db.history.push(record);
    saveDb(db);
    res.json({ success: true, data: { ...record, keyUsed: undefined }, logs: backendLogs });
  } else {
    console.error("All API keys failed. Logs:", backendLogs);
    res.status(500).json({ 
      error: "جميع محاولات إنشاء الفيديو فشلت. تأكد من صحة مفاتيح API والحصص المتاحة.",
      logs: backendLogs 
    });
  }
});

// Background Poller (every 10 seconds)
setInterval(async () => {
  const db = getDb();
  let modified = false;

  for (const record of db.history) {
    if (record.status === 'generating' && record.taskId && record.keyUsed) {
      try {
        const result = await checkVideoStatus(record.service, record.keyUsed, record.taskId);
        if (result.status !== 'generating') {
          record.status = result.status;
          record.videoUrl = result.videoUrl || null;
          modified = true;
          console.log(`Task ${record.taskId} updated to ${record.status}`);
        }
      } catch (err) {
        // Just log and retry next tick
        console.error(`Failed to check status for task ${record.taskId}:`, err);
      }
    }
  }

  if (modified) {
    saveDb(db);
  }
}, 10000);

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
