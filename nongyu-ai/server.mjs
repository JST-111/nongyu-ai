import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateCopies,
  InputValidationError
} from "./src/generator.js";

const PUBLIC_ROOT = fileURLToPath(new URL("./public/", import.meta.url));
const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp"
});

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const RATE_BUCKETS = new Map();

class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function readPort(value) {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT 必须是 1 到 65535 之间的整数");
  }
  return port;
}

const PORT = readPort(process.env.PORT);
const HOST = process.env.HOST?.trim() || "0.0.0.0";
const STARTED_AT = Date.now();

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join("; ")
  );
}

function sendJson(request, response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": MIME_TYPES[".json"],
    "X-Request-Id": request.requestId
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

function getClientIp(request) {
  return request.socket.remoteAddress ?? "unknown";
}

function enforceRateLimit(request) {
  const now = Date.now();
  const clientIp = getClientIp(request);
  const current = RATE_BUCKETS.get(clientIp);

  if (!current || current.resetAt <= now) {
    RATE_BUCKETS.set(clientIp, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return;
  }

  current.count += 1;
  if (current.count > RATE_LIMIT_MAX) {
    throw new HttpError(
      429,
      "RATE_LIMITED",
      "请求过于频繁，请一分钟后再试"
    );
  }
}

async function readJsonBody(request) {
  const contentType = request.headers["content-type"]
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "请求内容必须使用 application/json 格式"
    );
  }

  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "提交内容过大");
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", "提交内容过大");
    }
    chunks.push(chunk);
  }

  if (totalBytes === 0) {
    throw new HttpError(400, "EMPTY_BODY", "请求内容不能为空");
  }

  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "请求内容不是有效的 JSON");
  }
}

async function handleGenerate(request, response) {
  enforceRateLimit(request);
  const body = await readJsonBody(request);
  const result = generateCopies(body);

  sendJson(request, response, 200, {
    ok: true,
    requestId: request.requestId,
    generatedAt: new Date().toISOString(),
    ...result
  });
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/health") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "该接口仅支持 GET");
    }

    sendJson(request, response, 200, {
      ok: true,
      service: "nongyu-ai",
      version: "1.0.0",
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000)
    });
    return;
  }

  if (pathname === "/api/generate") {
    if (request.method !== "POST") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "该接口仅支持 POST");
    }

    await handleGenerate(request, response);
    return;
  }

  throw new HttpError(404, "NOT_FOUND", "接口不存在");
}

function resolvePublicPath(pathname) {
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, "BAD_PATH", "网址格式不正确");
  }

  if (decodedPath.includes("\0")) {
    throw new HttpError(400, "BAD_PATH", "网址格式不正确");
  }

  const relativePath =
    decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/u, "");
  const resolvedPath = path.resolve(PUBLIC_ROOT, relativePath);
  const rootPrefix = `${path.resolve(PUBLIC_ROOT)}${path.sep}`;

  if (resolvedPath !== path.resolve(PUBLIC_ROOT) && !resolvedPath.startsWith(rootPrefix)) {
    throw new HttpError(404, "NOT_FOUND", "文件不存在");
  }

  return resolvedPath;
}

async function serveStatic(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    throw new HttpError(405, "METHOD_NOT_ALLOWED", "该地址仅支持 GET");
  }

  const filePath = resolvePublicPath(pathname);
  let fileStat;

  try {
    fileStat = await stat(filePath);
  } catch {
    throw new HttpError(404, "NOT_FOUND", "页面不存在");
  }

  if (!fileStat.isFile()) {
    throw new HttpError(404, "NOT_FOUND", "页面不存在");
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType =
    MIME_TYPES[extension] ?? "application/octet-stream";
  const cacheControl =
    extension === ".html"
      ? "no-cache"
      : "public, max-age=3600";

  response.writeHead(200, {
    "Cache-Control": cacheControl,
    "Content-Length": fileStat.size,
    "Content-Type": contentType,
    "X-Request-Id": request.requestId
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    response.on("finish", resolve);
    response.on("close", resolve);
    stream.pipe(response);
  });
}

function sendError(request, response, error) {
  if (response.headersSent) {
    response.destroy();
    return;
  }

  if (error instanceof InputValidationError) {
    sendJson(request, response, 400, {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: error.message,
        fields: error.fields
      }
    });
    return;
  }

  if (error instanceof HttpError) {
    sendJson(request, response, error.status, {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {})
      }
    });
    return;
  }

  console.error(`[${request.requestId}]`, error);
  sendJson(request, response, 500, {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "服务器暂时无法完成请求，请稍后重试"
    }
  });
}

const server = createServer(async (request, response) => {
  request.requestId = randomUUID();
  applySecurityHeaders(response);

  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      await handleApi(request, response, pathname);
      return;
    }

    await serveStatic(request, response, pathname);
  } catch (error) {
    sendError(request, response, error);
  }
});

server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

const rateCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of RATE_BUCKETS) {
    if (bucket.resetAt <= now) {
      RATE_BUCKETS.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);
rateCleanupTimer.unref();

server.listen(PORT, HOST, () => {
  console.log(`农语 AI 已启动：http://localhost:${PORT}`);

  if (HOST === "0.0.0.0" || HOST === "::") {
    const addresses = Object.values(networkInterfaces())
      .flat()
      .filter((item) => item && item.family === "IPv4" && !item.internal)
      .map((item) => `http://${item.address}:${PORT}`);

    for (const address of addresses) {
      console.log(`局域网访问：${address}`);
    }
  }
});

function shutdown(signal) {
  console.log(`收到 ${signal}，正在关闭服务...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
