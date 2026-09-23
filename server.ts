import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { URL } from 'url';
import http from 'http';
import http2 from 'http2';
import https from 'https';
import dns from 'dns';
import net from 'net';
import fs from 'fs';
import zlib from 'zlib';
import { performance } from 'perf_hooks';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { performanceScore } from './src/utils/lighthouseScore';
import { enqueueLighthouse } from './src/utils/lighthouseQueue';
import type { LighthouseReport } from './src/utils/lighthouseProbe';
import { load as loadCheerio } from 'cheerio';

dotenv.config();

/** Browser-side resource timing phases, including phases a server-side probe cannot observe */
interface RumResourceTiming {
  queueing: number;
  stalled: number;
  dns: number;
  connect: number;
  ssl: number;
  requestSent: number;
  wait: number;
  receive: number;
  total: number;
}

/** One resource entry from the browser Resource Timing API, normalized to the waterfall shape */
interface RumResourceEntry {
  url: string;
  filename: string;
  domain: string;
  type: 'html' | 'script' | 'stylesheet' | 'image' | 'font' | 'other';
  size: number;
  startTime: number;
  timings: RumResourceTiming;
}

interface RumBeacon {
  id: string;
  timestamp: number;
  url: string;
  userAgent: string;
  vitals: {
    ttfb?: number;
    fp?: number;
    fcp?: number;
    lcp?: number;
    cls?: number;
    inp?: number;
    fid?: number;
    tbt?: number;
  };
  navigation?: {
    dnsTime: number;
    tcpTime: number;
    tlsTime: number;
    requestTime: number;
    domInteractive: number;
    domContentLoaded: number;
    loadEvent: number;
  };
  resourceCount?: number;
  resources?: RumResourceEntry[];
  longTasksCount?: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
}

// In-memory beacon store (rolling buffer of last 100 RUM beacons)
const beaconStore: RumBeacon[] = [];

// Durable RUM beacon store. Vitals + device/network dimensions are persisted to a JSON file
// (no native dependency), so real percentiles (p75/p95) and dimension breakdowns survive
// restarts and are not capped at the 100-entry in-memory buffer.
interface PersistedBeacon {
  id: string;
  ts: number;
  url: string;
  lcp: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
  inp: number | null;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
  effectiveType: string | null;
}

const RUM_STORE_PATH = process.env.RUM_DB_PATH || 'rum-beacons.json';
const MAX_PERSISTED_BEACONS = 10000;

let rumRows: PersistedBeacon[] = [];
try {
  if (fs.existsSync(RUM_STORE_PATH)) {
    const parsed = JSON.parse(fs.readFileSync(RUM_STORE_PATH, 'utf8'));
    if (Array.isArray(parsed)) rumRows = parsed;
  }
} catch {
  rumRows = [];
}

function persistRumRows(): void {
  try {
    fs.writeFileSync(RUM_STORE_PATH, JSON.stringify(rumRows));
  } catch {
    // Persistence is best-effort; ignore write errors.
  }
}

/** Compute the p-th percentile (0-100) of a sorted numeric array using linear interpolation. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

/** Map deviceMemory (GB) onto coarse device tiers. */
function deviceTier(deviceMemory: number | null | undefined): string {
  if (typeof deviceMemory !== 'number') return 'unknown';
  if (deviceMemory < 2) return 'low';
  if (deviceMemory <= 4) return 'mid';
  return 'high';
}

// Result cache: repeat tests of the same URL/device/region within the TTL are served from
// memory instead of re-running DNS/TCP/HTML/sub-resource probes and a fresh Chrome launch.
const RESULT_CACHE_TTL_MS = 10 * 60 * 1000;
const RESULT_CACHE_MAX_ENTRIES = 200;
const resultCache = new Map<string, { payload: unknown; expiresAt: number }>();

// Background Lighthouse jobs. A request kicks off a job and returns immediately with
// heuristic metrics + a job id; the client polls /api/lighthouse/:id for the lab result.
interface LighthouseJob {
  id: string;
  url: string;
  status: 'pending' | 'done' | 'failed';
  report: LighthouseReport | null;
}
const lighthouseJobs = new Map<string, LighthouseJob>();

function startLighthouseJob(url: string, deviceProfile?: string): string {
  const id = 'lh_' + Math.random().toString(36).slice(2, 10);
  const job: LighthouseJob = { id, url, status: 'pending', report: null };
  lighthouseJobs.set(id, job);

  void enqueueLighthouse(url, undefined, deviceProfile)
    .then((report) => {
      const current = lighthouseJobs.get(id);
      if (!current) return;
      current.status = report ? 'done' : 'failed';
      current.report = report;
    })
    .catch(() => {
      const current = lighthouseJobs.get(id);
      if (current) current.status = 'failed';
    });

  return id;
}

// Lazy Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn('Failed to initialize Gemini API client:', e);
    }
  }
  return geminiClient;
}

/** Maximum accumulated probe response body bytes, to prevent oversized responses from exhausting memory */
const MAX_PROBE_BODY_BYTES = 5 * 1024 * 1024;

/** Maximum number of sub-resources probed for their real transfer size, per content type */
const RESOURCE_PROBE_QUOTA: Record<string, number> = {
  stylesheet: 12,
  script: 20,
  image: 16,
  font: 6,
  other: 6,
};

/** Concurrency used when probing sub-resource sizes, to avoid hammering the target host */
const RESOURCE_PROBE_CONCURRENCY = 8;

/** Approximate number of sub-resources a browser fetches in parallel (HTTP/2 multiplexing) */
const ASSET_PARALLELISM = 4;

/**
 * Approximate the transfer time of a set of resources fetched in parallel.
 * A serial sum would charge the page for bytes the browser fetches concurrently;
 * a pure division would ignore that the slowest single resource sets a floor.
 */
function parallelTransferMs(sizes: number[], bytesPerMs: number, parallelism: number): number {
  if (sizes.length === 0) return 0;
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const largest = sizes.reduce((max, size) => Math.max(max, size), 0);
  return Math.round(Math.max(largest, total / parallelism) / bytesPerMs);
}

/**
 * Decode a probe response body according to its Content-Encoding.
 * The probe advertises gzip/deflate/br, and Node's raw http client does not decompress,
 * so without this step every HTML-derived fact would be read from compressed binary.
 * Output is capped at MAX_PROBE_BODY_BYTES so a decompression bomb cannot exhaust memory.
 */
function decodeResponseBody(raw: Buffer, contentEncoding?: string): string {
  const encoding = String(contentEncoding || '').toLowerCase();
  const options = { maxOutputLength: MAX_PROBE_BODY_BYTES };
  try {
    if (encoding.includes('br')) return zlib.brotliDecompressSync(raw, options).toString('utf8');
    if (encoding.includes('gzip')) return zlib.gunzipSync(raw, options).toString('utf8');
    if (encoding.includes('deflate')) {
      try {
        return zlib.inflateSync(raw, options).toString('utf8');
      } catch {
        // Some servers send raw deflate without the zlib wrapper
        return zlib.inflateRawSync(raw, options).toString('utf8');
      }
    }
  } catch {
    // Truncated or corrupt payload: fall through and analyze the raw bytes as text
  }
  return raw.toString('utf8');
}

/** User agent used for sub-resource size probes */
const SUBRESOURCE_PROBE_USER_AGENT = 'Mozilla/5.0 (compatible; WebPulseProbe/1.0)';

/** Cap on bytes streamed when a server does not report Content-Length; larger assets are recorded at the cap */
const MAX_MEASURED_ASSET_BYTES = 256 * 1024;

/** Real per-request network timings measured for a sub-resource, matching the waterfall `timings` shape. */
interface ResourceTimings {
  dns: number;
  connect: number;
  ssl: number;
  wait: number;
  receive: number;
  total: number;
}

/**
 * Fetch a sub-resource and measure its real transfer size and network timings in a single GET.
 * Replaces the previous separate HEAD + stream probes so the waterfall reflects actual transfer
 * instead of fabricated values. The body is capped to avoid downloading oversized assets; the
 * reported download time is for the first capped chunk in that case.
 */
function probeResourceTiming(url: string, timeoutMs = 5000): Promise<{ size: number; statusCode: number; timings: ResourceTimings } | null> {
  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return resolve(null);
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const startTime = performance.now();
    let dnsTime = 0;
    let connectTime = 0;
    let sslTime = 0;
    let ttfb = 0;
    let bytes = 0;
    let settled = false;

    const finish = (value: { size: number; statusCode: number; timings: ResourceTimings } | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const buildTimings = (): ResourceTimings => {
      const total = Math.max(1, Math.round(performance.now() - startTime));
      const wait = ttfb > 0 ? ttfb : 0;
      return {
        dns: dnsTime,
        connect: connectTime,
        ssl: sslTime,
        wait,
        receive: Math.max(0, total - wait),
        total,
      };
    };

    const request = client.get(
      url,
      {
        headers: {
          'User-Agent': SUBRESOURCE_PROBE_USER_AGENT,
          'Accept-Encoding': 'identity',
        },
        timeout: timeoutMs,
      },
      (response) => {
        const status = response.statusCode || 200;
        if (status >= 400) {
          response.destroy();
          return finish(null);
        }

        response.once('data', () => {
          ttfb = Math.round(performance.now() - startTime);
        });

        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes >= MAX_MEASURED_ASSET_BYTES) {
            finish({ size: MAX_MEASURED_ASSET_BYTES, statusCode: status, timings: buildTimings() });
            response.destroy();
          }
        });
        response.on('end', () => {
          if (bytes <= 0) return finish(null);
          finish({ size: bytes, statusCode: status, timings: buildTimings() });
        });
        response.on('error', () => finish(null));
      }
    );

    request.on('socket', (socket) => {
      socket.once('lookup', () => { dnsTime = Math.round(performance.now() - startTime); });
      socket.once('connect', () => { connectTime = Math.round(performance.now() - startTime - dnsTime); });
      socket.once('secureConnect', () => { sslTime = Math.round(performance.now() - startTime - dnsTime - connectTime); });
    });

    request.on('timeout', () => {
      request.destroy();
      finish(null);
    });
    request.on('error', () => finish(null));
    request.end();
  });
}

/** Run async tasks with bounded concurrency, preserving the input order of results */
async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Determine whether an IP is a non-probeable address such as loopback / private / link-local / cloud metadata */
function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||      // CGNAT 100.64.0.0/10
      (a === 169 && b === 254) ||                // Link-local / cloud metadata 169.254.169.254
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224                                   // Multicast and reserved ranges
    );
  }
  if (version === 6) {
    const v6 = ip.toLowerCase();
    if (v6 === '::1' || v6 === '::') return true;
    // IPv4-mapped addresses: ::ffff:127.0.0.1 and the hex form normalized by Node, ::ffff:7f00:1
    const mappedDotted = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedDotted) return isPrivateIp(mappedDotted[1]);
    const mappedHex = v6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      return isPrivateIp(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
    }
    return /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);   // fc00::/7 ULA, fe80::/10 link-local
  }
  return false;
}

type TargetCheckResult =
  | { ok: true; reason: null }
  | { ok: false; reason: 'invalid' | 'protocol' | 'intranet' };

/**
 * Outbound target validation: only http/https is allowed, and neither the hostname
 * nor any DNS resolution result may point to a private network.
 * Must be called on the initial request and on every redirect, so a 302 cannot bypass validation.
 */
async function assertProbeTargetAllowed(rawUrl: string): Promise<TargetCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'protocol' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { ok: false, reason: 'intranet' };
  }

  if (net.isIP(hostname)) {
    return isPrivateIp(hostname) ? { ok: false, reason: 'intranet' } : { ok: true, reason: null };
  }

  // The domain must resolve successfully and every resolved address must be public (blocks DNS pointing to private networks / rebinding)
  try {
    const records = await dns.promises.lookup(hostname, { all: true });
    if (records.length === 0 || records.some(r => isPrivateIp(r.address))) {
      return { ok: false, reason: 'intranet' };
    }
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, reason: null };
}

/**
 * Lightweight in-memory rate limiting: fixed-window counting per client IP.
 * Sufficient for single-instance deployments; multi-instance scenarios require centralized
 * storage such as Redis.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const bucket = rateBuckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      if (rateBuckets.size > 5000) {
        for (const [k, v] of rateBuckets) {
          if (v.resetAt <= now) rateBuckets.delete(k);
        }
      }
      rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429).json({
        success: false,
        error: {
          errorType: 'rate_limited',
          title: 'Too Many Requests (Rate Limited)',
          message: `Each IP is allowed up to ${max} requests per minute. Please try again later.`,
        },
      });
      return;
    }
    return next();
  };
}

/**
 * Optional API-key gate. When the API_KEY environment variable is set, probe endpoints
 * require the `x-api-key` header to match, so the public probe cannot be abused as an
 * open proxy or DoS relay. When API_KEY is unset, authentication is disabled.
 */
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = process.env.API_KEY;
  if (!key) return next();
  if (req.get('x-api-key') === key) return next();
  res.status(401).json({
    success: false,
    error: {
      errorType: 'unauthorized',
      title: 'Unauthorized',
      message: 'A valid API key is required to run a speed test.',
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // When deployed behind a reverse proxy, trust N proxy hops so req.ip reflects the
  // real client (used by rate limiting) instead of the proxy's own address.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY));
  }

  // Support JSON and raw text for navigator.sendBeacon
  app.use(express.json({ limit: '2mb' }));
  app.use(express.text({ type: ['text/*', 'application/x-www-form-urlencoded'] }));

  // API 1: Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'WebPulse APM Performance Engine',
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      beaconCount: rumRows.length,
      uptime: process.uptime(),
    });
  });

  // API 2: RUM Beacon ingestion (supports POST via fetch or navigator.sendBeacon)
  app.post('/api/beacon', rateLimit(60), (req: Request, res: Response) => {
    try {
      let data: any = req.body;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          data = {};
        }
      }

      const beacon: RumBeacon = {
        id: 'rum_' + Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        url: data.url || req.headers.referer || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        vitals: data.vitals || {},
        navigation: data.navigation,
        resourceCount: data.resourceCount || (Array.isArray(data.resources) ? data.resources.length : 0),
        resources: Array.isArray(data.resources) ? data.resources.slice(0, 200) : undefined,
        longTasksCount: data.longTasksCount || 0,
        deviceMemory: data.deviceMemory,
        hardwareConcurrency: data.hardwareConcurrency,
        connection: data.connection,
      };

      beaconStore.unshift(beacon);
      if (beaconStore.length > 100) {
        beaconStore.pop();
      }

      // Persist the flattened vitals + device/network dimensions for durable aggregation.
      rumRows.push({
        id: beacon.id,
        ts: beacon.timestamp,
        url: beacon.url,
        lcp: beacon.vitals?.lcp ?? null,
        cls: beacon.vitals?.cls ?? null,
        fcp: beacon.vitals?.fcp ?? null,
        ttfb: beacon.vitals?.ttfb ?? null,
        inp: beacon.vitals?.inp ?? null,
        deviceMemory: beacon.deviceMemory ?? null,
        hardwareConcurrency: beacon.hardwareConcurrency ?? null,
        effectiveType: beacon.connection?.effectiveType ?? null,
      });
      if (rumRows.length > MAX_PERSISTED_BEACONS) {
        rumRows.splice(0, rumRows.length - MAX_PERSISTED_BEACONS);
      }
      persistRumRows();

      // Beacon API expects 204 or 200 fast
      res.status(200).json({ success: true, id: beacon.id });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // API 3: Retrieve beacon metrics aggregation (averages, percentiles, device/network breakdowns)
  app.get('/api/beacons', (_req: Request, res: Response) => {
    const rows = rumRows;

    const values = (pick: (r: (typeof rows)[number]) => number | null) =>
      rows.map(pick).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);

    const lcp = values(r => r.lcp);
    const cls = values(r => r.cls);
    const fcp = values(r => r.fcp);
    const ttfb = values(r => r.ttfb);
    const inp = values(r => r.inp);

    const avg = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const stats = (v: number[]) => ({ count: v.length, avg: avg(v), p75: round2(percentile(v, 75)), p95: round2(percentile(v, 95)) });

    // Device / network dimension breakdowns (avg LCP per bucket).
    const byNetworkMap = new Map<string, { count: number; lcpCount: number; lcpSum: number }>();
    const byDeviceMap = new Map<string, { count: number; lcpCount: number; lcpSum: number }>();
    for (const r of rows) {
      const net = r.effectiveType || 'unknown';
      const dev = deviceTier(r.deviceMemory);

      let n = byNetworkMap.get(net);
      if (!n) { n = { count: 0, lcpCount: 0, lcpSum: 0 }; byNetworkMap.set(net, n); }
      n.count++;
      if (typeof r.lcp === 'number') { n.lcpCount++; n.lcpSum += r.lcp; }

      let d = byDeviceMap.get(dev);
      if (!d) { d = { count: 0, lcpCount: 0, lcpSum: 0 }; byDeviceMap.set(dev, d); }
      d.count++;
      if (typeof r.lcp === 'number') { d.lcpCount++; d.lcpSum += r.lcp; }
    }

    res.json({
      total: rows.length,
      aggregates: {
        avgLcp: Math.round(avg(lcp)),
        avgCls: +(avg(cls).toFixed(3)),
        avgFcp: Math.round(avg(fcp)),
        avgTtfb: Math.round(avg(ttfb)),
        avgInp: Math.round(avg(inp)),
      },
      percentiles: {
        lcp: stats(lcp),
        cls: stats(cls),
        fcp: stats(fcp),
        ttfb: stats(ttfb),
        inp: stats(inp),
      },
      byNetwork: Array.from(byNetworkMap.entries())
        .map(([effectiveType, v]) => ({ effectiveType, count: v.count, avgLcp: v.lcpCount ? Math.round(v.lcpSum / v.lcpCount) : 0 }))
        .sort((a, b) => b.count - a.count),
      byDevice: Array.from(byDeviceMap.entries())
        .map(([tier, v]) => ({ tier, count: v.count, avgLcp: v.lcpCount ? Math.round(v.lcpSum / v.lcpCount) : 0 }))
        .sort((a, b) => b.count - a.count),
      recent: beaconStore.slice(0, 30),
    });
  });

  // API 4: AI Performance Diagnostics (Gemini + Rule-based fallback)
  app.post('/api/diagnose', rateLimit(20), requireApiKey, async (req: Request, res: Response) => {
    try {
      const { vitals, resources, bottlenecks, pipelineStage } = req.body;

      const ai = getGeminiClient();
      if (ai) {
        try {
          const prompt = `You are a world-class architect of web performance and browser rendering engines.
Perform a deep diagnosis of the following frontend page performance and rendering pipeline monitoring data, analyze the root causes of bottlenecks (in the context of the browser's 7-stage rendering pipeline: Networking, HTML Parsing, CSSOM Construction, Render Tree Assembly, Layout Reflow, Paint, Composite), and provide the most engineering-valuable optimization code and solutions.

[Monitored Metric Data]
- LCP (Largest Contentful Paint): ${vitals?.lcp || 'N/A'} ms (Google standard: <2500ms is good)
- FCP (First Contentful Paint): ${vitals?.fcp || 'N/A'} ms (Google standard: <1800ms is good)
- CLS (Cumulative Layout Shift): ${vitals?.cls !== undefined ? vitals.cls : 'N/A'} (Google standard: <0.1 is good)
- INP (Interaction to Next Paint): ${vitals?.inp || 'N/A'} ms (Google standard: <200ms is good)
- TTFB (Time to First Byte): ${vitals?.ttfb || 'N/A'} ms (Google standard: <800ms is good)
- Render-blocking resources: ${bottlenecks?.blockingResourcesCount ?? 0}
- Main-thread long tasks (>50ms): ${bottlenecks?.longTasksCount ?? 0}
- Detected critical issues: ${bottlenecks?.detectedIssues?.join(', ') || 'No specific critical issues'}
- Rendering pipeline stage of interest: ${pipelineStage || 'Overall rendering pipeline'}

Please output in structured Markdown:
1. 💡 **Root-cause localization of core bottlenecks** (go deep into V8 execution, Style Recalculation, Forced Reflow, or the network critical path)
2. 🎯 **Top 3 highest-priority optimization solutions** (with concrete HTML/CSS/JS/Vite/Webpack code examples)
3. 🔬 **Deep dive into browser rendering mechanics** (explain why the issue stalls the rendering pipeline)
4. 📈 **Estimated expected optimization gains** (estimate the percentage improvement in LCP/FCP/CLS after optimization)

Keep it professional, incisive, and engineering-practice oriented; avoid generic platitudes.`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
          });

          return res.json({
            success: true,
            source: 'gemini-3.8-flash',
            diagnosis: response.text,
          });
        } catch (geminiError: any) {
          console.warn('Gemini API call failed, switching to expert heuristic engine:', geminiError.message);
          // Fall through to heuristic engine
        }
      }

      // Expert heuristic diagnostic engine fallback
      const heuristics: string[] = [];
      const codeFixes: string[] = [];

      if ((vitals?.lcp ?? 0) > 2500) {
        heuristics.push(`⚠️ **LCP critically over threshold (${vitals.lcp}ms > 2500ms)**: the largest viewport element takes too long to render. The usual blocking culprits are: 1. slow fonts/images that are not preloaded; 2. an oversized critical CSS file blocking the Render Tree; 3. client-side SSR without streaming rendering.`);
        codeFixes.push(`<!-- 1. Preload the critical LCP resource -->\n<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />\n<!-- 2. Inline above-the-fold critical CSS, load non-critical CSS asynchronously -->\n<link rel="preload" href="/heavy.css" as="style" onload="this.rel='stylesheet'">`);
      }

      if ((vitals?.cls ?? 0) > 0.1) {
        heuristics.push(`⚠️ **CLS cumulative layout shift too high (${vitals.cls} > 0.1)**: the page undergoes unexpected geometric jumps while loading. This is usually caused by <img>/<iframe> elements without dimensions, dynamically inserted ads, or async components without reserved placeholders, forcing the browser into a layout reflow.`);
        codeFixes.push(`/* Reserve aspect ratio and dimensions for images and dynamic skeletons */\nimg {\n  width: 100%;\n  height: auto;\n  aspect-ratio: 16 / 9;\n}\n.skeleton-box {\n  min-height: 240px;\n  contain: layout style;\n}`);
      }

      if ((bottlenecks?.longTasksCount ?? 0) > 0 || (vitals?.inp ?? 0) > 200) {
        heuristics.push(`⚠️ **Main-thread jank & interaction delay (${bottlenecks?.longTasksCount ?? 0} long task(s) detected)**: a single JS execution over 50ms locks up the main thread, so the browser cannot respond to user clicks and input, breaking the 60 FPS rendering cadence.`);
        codeFixes.push(`// Split long tasks with scheduler.yield() or requestIdleCallback\nasync function processChunkedWork(tasks) {\n  for (const task of tasks) {\n    task();\n    if ('scheduler' in window && 'yield' in scheduler) {\n      await scheduler.yield();\n    } else {\n      await new Promise(resolve => setTimeout(resolve, 0));\n    }\n  }\n}`);
      }

      if ((vitals?.ttfb ?? 0) > 800) {
        heuristics.push(`⚠️ **TTFB time to first byte too slow (${vitals.ttfb}ms > 800ms)**: server processing, DNS resolution, or CDN routing takes too long. Consider enabling HTTP/2 or HTTP/3 multiplexing together with edge CDN caching.`);
        codeFixes.push(`// Nginx edge caching and HTTP/2 Server Push optimization\nlocation ~* \\.(js|css|webp|woff2)$ {\n  expires 1y;\n  add_header Cache-Control "public, max-age=31536000, immutable";\n  gzip_static on;\n  brotli_static on;\n}`);
      }

      if (heuristics.length === 0) {
        heuristics.push(`✅ **All current Core Web Vitals are within Google's green excellent thresholds**! The page shows outstanding network throughput and a smooth rendering pipeline.`);
        codeFixes.push(`// Advanced suggestion: adopt the modern Speculation Rules API to prerender the next page\n<script type="speculationrules">\n{\n  "prerender": [\n    {"source": "list", "urls": ["/dashboard", "/detail"]}\n  ]\n}\n</script>`);
      }

      const generatedDiagnosis = `### 🔬 WebPulse Deep Performance & Rendering Engine Diagnostic Report

#### 💡 Core Issue Diagnosis
${heuristics.map((h, i) => `${i + 1}. ${h}`).join('\n\n')}

#### 🎯 Targeted Engineering Optimizations
\`\`\`html
${codeFixes.join('\n\n')}
\`\`\`

#### ⚙️ Browser Rendering Pipeline Mechanism Analysis
- **HTML Parser & CSSOM mutual blocking**: by default, \<script\> halts the HTML parser; and before the CSSOM built from link stylesheets is ready, the browser is forbidden from executing JS, forming a "dual critical rendering path bottleneck".
- **Reflow cascade cost**: reading a DOM node's geometric properties (such as offsetWidth or getBoundingClientRect) alongside a style change forces the browser to flush the dirty node queue with a **Forced Synchronous Layout**, causing dropped frames.
- **Compositing layer acceleration**: promoting frequently moving or fading animations to a dedicated GPU layer (via \`transform: translateZ(0)\` or \`will-change\`) lets the Compositor thread handle them directly, skipping Layout and Paint and keeping a stable 60 FPS.`;

      res.json({
        success: true,
        source: 'rule-engine',
        diagnosis: generatedDiagnosis,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: Real Web Performance Benchmark Probe (Real Socket Timing & Real HTML Metrics)
  app.post(['/api/benchmark', '/api/audit-url'], rateLimit(10), requireApiKey, async (req: Request, res: Response) => {
    const { url, deviceProfile, region } = req.body;
    const selectedRegion = region || 'North China - Ulanqab';
    let targetUrl = typeof url === 'string' ? url.trim() : '';
    if (targetUrl && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    try {
      // Serve an identical repeat test from the result cache instead of re-probing everything.
      const cacheKey = `${targetUrl}|${deviceProfile || ''}|${selectedRegion}`;
      const cached = resultCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json(cached.payload);
      }
      if (cached) resultCache.delete(cacheKey);

      // 1. Outbound target validation: protocol allowlist + reject private/loopback/cloud-metadata addresses (including DNS resolution results)
      const targetCheck = await assertProbeTargetAllowed(targetUrl);
      if (!targetCheck.ok) {
        const errorPayload =
          targetCheck.reason === 'intranet'
            ? {
                errorType: 'intranet_ip',
                title: 'Cannot probe private or local network addresses (Intranet / Localhost)',
                message: `The address "${targetUrl}" points to a loopback address, a private network range, or a domain whose DNS resolution is not publicly routable. For security reasons, the probe node will not send requests to such addresses.`,
                troubleshootingTips: [
                  'To test a local development project, expose your local port to a temporary public domain with Cloudflare Tunnel, Ngrok, or frp.',
                  'Make sure you entered a publicly accessible internet URL (e.g. https://www.example.com).',
                ],
              }
            : targetCheck.reason === 'protocol'
              ? {
                  errorType: 'invalid_url',
                  title: 'Only HTTP / HTTPS protocols are supported',
                  message: `The address "${targetUrl}" uses an unsupported protocol. Speed tests only allow http:// and https://.`,
                  troubleshootingTips: ['Enter the target URL with an http:// or https:// prefix.'],
                }
              : {
                  errorType: 'invalid_url',
                  title: 'Invalid URL',
                  message: `The URL "${targetUrl}" could not be parsed by a standard URL parser. Make sure it has the correct protocol prefix (http:// or https://) and a valid domain name.`,
                  troubleshootingTips: [
                    'Check the URL for illegal characters or spaces.',
                    'Make sure the protocol is http:// or https://, for example: https://example.com',
                  ],
                };
        return res.json({
          success: false,
          error: { ...errorPayload, targetUrl, region: selectedRegion },
        });
      }

      // Helper function to probe URL with redirect support.
      // HTTPS targets are fetched over HTTP/2 when the server negotiates h2 via ALPN,
      // falling back to HTTP/1.1 otherwise, so httpVersion / alpnProtocol reflect the
      // real connection instead of a value that never changes.
      const probeTarget = (destUrl: string, maxRedirects = 3): Promise<{
        finalUrl: string;
        statusCode: number;
        statusMessage: string;
        httpVersion: string;
        tlsVersion: string;
        alpnProtocol: string;
        headers: http.IncomingHttpHeaders;
        remoteAddress: string;
        dns: number;
        tcp: number;
        tls: number;
        ttfb: number;
        totalDuration: number;
        bodyBytes: number;
        bodyHtml: string;
      }> => {
        return new Promise((resolve, reject) => {
          let redirectsCount = 0;
          let settled = false;
          // Total elapsed time from the first request, so redirect hops are charged to the final result
          const chainStart = performance.now();

          const resolveOnce = (value: any) => {
            if (settled) return;
            settled = true;
            resolve(value);
          };
          const rejectOnce = (err: any) => {
            if (settled) return;
            settled = true;
            reject(err);
          };

          const executeProbe = (urlToFetch: string) => {
            let parsedUrl: URL;
            try {
              parsedUrl = new URL(urlToFetch);
            } catch (e) {
              return rejectOnce({
                errorType: 'invalid_url',
                title: 'Malformed redirect URL',
                message: 'The server redirect target is not a valid URL.',
              });
            }

            const isHttps = parsedUrl.protocol === 'https:';
            const userAgent =
              deviceProfile && deviceProfile.includes('Mobile')
                ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
                : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

            let startTime = performance.now();
            let dnsTime = 0;
            let tcpTime = 0;
            let tlsTime = 0;
            let ttfb = 0;
            let remoteAddress = '';
            let tlsVersion = '';
            let alpnProtocol = '';
            let httpVersion = '';
            // ALPN protocol negotiated by the real TLS handshake that offered h2 + http/1.1.
            let negotiatedAlpn = '';

            const attachSocketTiming = (socket: any) => {
              socket.once('lookup', () => {
                dnsTime = performance.now() - startTime;
              });
              socket.once('connect', () => {
                remoteAddress = socket.remoteAddress || '';
                tcpTime = performance.now() - startTime - dnsTime;
              });
              socket.once('secureConnect', () => {
                tlsTime = performance.now() - startTime - (dnsTime + tcpTime);
                if (typeof socket.getProtocol === 'function') {
                  tlsVersion = socket.getProtocol() || '';
                }
                negotiatedAlpn = socket.alpnProtocol || '';
              });
            };

            // Shared response handling for both HTTP/1.1 and HTTP/2 transports.
            const processResponse = (
              response: {
                statusCode: number;
                statusMessage: string;
                headers: http.IncomingHttpHeaders;
                on: (event: string, listener: (...args: any[]) => void) => any;
                once: (event: string, listener: (...args: any[]) => void) => any;
                destroy: () => void;
              },
              teardown: () => void = () => {},
            ) => {
              // Follow 3xx redirects
              if (
                response.statusCode >= 300 &&
                response.statusCode < 400 &&
                response.headers.location &&
                redirectsCount < maxRedirects
              ) {
                redirectsCount++;
                let redirectUrl: string;
                try {
                  redirectUrl = new URL(response.headers.location, urlToFetch).href;
                } catch {
                  response.destroy();
                  teardown();
                  return rejectOnce({
                    errorType: 'invalid_url',
                    title: 'Malformed redirect URL',
                    message: 'The server redirect target is not a valid URL.',
                  });
                }

                // The redirect target must be re-validated, so a 302 cannot tunnel to a private network
                assertProbeTargetAllowed(redirectUrl)
                  .then((check) => {
                    if (!check.ok) {
                      response.destroy();
                      teardown();
                      return rejectOnce({
                        errorType: 'intranet_ip',
                        title: 'Redirect target cannot be probed',
                        message: 'The target site redirected to an intranet address or a non-http/https protocol. Probing was aborted for security reasons.',
                      });
                    }
                    response.destroy();
                    teardown();
                    executeProbe(redirectUrl);
                  })
                  .catch((e) => rejectOnce({
                    errorType: 'probe_failed',
                    title: 'Redirect validation failed',
                    message: String(e?.message || e),
                  }));
                return;
              }

              response.once('data', () => {
                ttfb = Math.round(performance.now() - startTime);
              });

              // Accumulate the raw response body; discard it once the limit is exceeded, to avoid exhausting memory on oversized responses
              const rawChunks: Buffer[] = [];
              let storedBytes = 0;
              response.on('data', (chunk: Buffer) => {
                if (storedBytes >= MAX_PROBE_BODY_BYTES) return;
                storedBytes += chunk.length;
                rawChunks.push(chunk);
              });

              response.on('end', () => {
                const totalDuration = Math.round(performance.now() - chainStart);
                const status = response.statusCode;
                // Decompress first: every downstream HTML fact is read from this string
                const body = decodeResponseBody(Buffer.concat(rawChunks), response.headers['content-encoding']);

                // Detect WAF / Anti-Bot Challenges (e.g. Cloudflare 403 / 503 challenge page)
                const isWafBlock =
                  (status === 403 || status === 503 || status === 429) &&
                  (body.includes('Just a moment...') ||
                    body.includes('Attention Required! | Cloudflare') ||
                    body.includes('Cloudflare Ray ID') ||
                    body.includes('cf-mitigated') ||
                    body.includes('Security Check') ||
                    body.includes('Incapsula') ||
                    !!response.headers['cf-ray'] ||
                    !!response.headers['x-amz-cf-id']);

                if (isWafBlock) {
                  teardown();
                  return rejectOnce({
                    errorType: 'waf_blocked',
                    statusCode: status,
                    title: 'Target site blocked the probe with a security firewall (WAF / 5-second shield)',
                    message: `The target server returned HTTP ${status} and triggered an automated anti-bot block from a cloud protection layer (e.g. Cloudflare / Akamai / CAPTCHA shield), rejecting the speed test bot's connection.`,
                    troubleshootingTips: [
                      'The target site deploys strict bot management and blocked non-human browser sessions.',
                      'Try adding the probe node User-Agent (PingdomSpeedAudit) to a temporary allowlist in the target site security rules.',
                      'Switch to a different test region; some sites apply geo-fencing blocks to specific overseas data center IPs.',
                    ],
                  });
                }

                // Detect fatal HTTP Error (like 500, 502, 504)
                if (status >= 500) {
                  teardown();
                  return rejectOnce({
                    errorType: 'http_error',
                    statusCode: status,
                    title: `Target server internal failure (HTTP ${status})`,
                    message: `The target server returned an error response of ${status}. The server gateway or backend application is currently failing and cannot serve the page content.`,
                    troubleshootingTips: [
                      'The target site web service or backend gateway (e.g. PHP-FPM, Node.js, Tomcat) may have crashed or is overloaded.',
                      'Open the page manually in a browser to confirm whether it also reports a 502/504 error.',
                      'Contact the target site operators to review server error logs and process load.',
                    ],
                  });
                }

                teardown();
                resolveOnce({
                  finalUrl: urlToFetch,
                  statusCode: status,
                  statusMessage: response.statusMessage,
                  httpVersion,
                  tlsVersion,
                  alpnProtocol,
                  headers: response.headers,
                  remoteAddress: remoteAddress || 'Cloud Probe Edge',
                  dns: Math.max(1, Math.round(dnsTime)),
                  tcp: Math.max(1, Math.round(tcpTime)),
                  tls: Math.max(0, Math.round(tlsTime)),
                  ttfb,
                  totalDuration: Math.max(totalDuration, 1),
                  bodyBytes: Buffer.byteLength(body, 'utf8'),
                  bodyHtml: body,
                });
              });
            };

            const rejectTimeout = () => rejectOnce({
              errorType: 'timeout',
              title: 'Connection Timeout',
              message: `The cloud probe node could not establish a connection or receive a response from the target server within 8 seconds. The target server may be under heavy load, down, or blocked by packet loss on the network.`,
              troubleshootingTips: [
                'Confirm whether the target site opens instantly in your local browser.',
                'The target host security group or firewall may be blocking packets from external cloud data centers.',
                'Try switching to a different test region (e.g. one closer to the target data center).',
              ],
            });

            const rejectNetworkError = (err: any) => {
              const code = err.code || '';
              if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
                return rejectOnce({
                  errorType: 'dns_failed',
                  errorCode: code,
                  title: 'DNS Resolution Failed (Domain Not Found)',
                  message: `The cloud probe node could not resolve any A/AAAA record for the domain "${parsedUrl.hostname}" via public DNS recursion.`,
                  troubleshootingTips: [
                    'Double-check the domain spelling and avoid a wrong top-level suffix (e.g. .com mistyped as .cm).',
                    'A newly purchased domain or recently changed DNS records may take minutes to hours to propagate globally.',
                    'Check whether the domain has expired or been suspended by the registrar (ClientHold / ServerHold).',
                  ],
                });
              }

              if (code === 'ECONNREFUSED') {
                return rejectOnce({
                  errorType: 'conn_refused',
                  errorCode: code,
                  title: 'Connection Refused by Target Host',
                  message: `The target host explicitly refused the TCP handshake (received an RST packet). The target port (${parsedUrl.port || (isHttps ? 443 : 80)}) has no listening service or is blocked by a firewall.`,
                  troubleshootingTips: [
                    'Check whether the web service (Nginx / Apache / Caddy) is running on the target server.',
                    'Check whether the server listens only on 127.0.0.1 instead of 0.0.0.0.',
                    'Check whether the cloud security group inbound rules allow ports 80 and 443.',
                  ],
                });
              }

              if (
                code.startsWith('CERT_') ||
                code.includes('CERT') ||
                code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
                code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
                code === 'ERR_TLS_CERT_ALTNAME_INVALID'
              ) {
                return rejectOnce({
                  errorType: 'ssl_error',
                  errorCode: code,
                  title: 'SSL/TLS Certificate Verification Failed',
                  message: `Failed to establish an encrypted handshake with the target site (${err.message}). The target site SSL certificate may be expired, mismatched to the domain, or an untrusted self-signed certificate.`,
                  troubleshootingTips: [
                    'Check the expiry date of the site HTTPS certificate and renew your Let\'s Encrypt or commercial certificate in time.',
                    'Check whether the certificate Subject Alternative Name (SAN) covers the subdomain being tested.',
                    'If the site only supports plain HTTP, run the test with an http:// prefix.',
                  ],
                });
              }

              rejectOnce({
                errorType: 'network_error',
                errorCode: code,
                title: 'Network Probe Error',
                message: err.message || 'A low-level socket error occurred while communicating with the target site.',
                troubleshootingTips: [
                  'Check whether the target site is running normally.',
                  'Try switching to another test node and run the test again.',
                ],
              });
            };

            // HTTP/1.1 transport (also the fallback when a target does not negotiate h2).
            const fetchHttp1 = () => {
              startTime = performance.now();
              const client = isHttps ? https : http;
              const request = client.get(
                urlToFetch,
                {
                  headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                  },
                  timeout: 8000,
                },
                (response) => {
                  httpVersion = response.httpVersion || '1.1';
                  processResponse({
                    statusCode: response.statusCode || 200,
                    statusMessage: response.statusMessage || '',
                    headers: response.headers,
                    on: (e, l) => response.on(e, l),
                    once: (e, l) => response.once(e, l),
                    destroy: () => response.destroy(),
                  });
                }
              );

              request.on('socket', (socket) => attachSocketTiming(socket));
              request.on('timeout', () => {
                request.destroy();
                rejectTimeout();
              });
              request.on('error', (err: any) => rejectNetworkError(err));
              request.end();
            };

            // HTTP/2 transport for HTTPS targets. Falls back to HTTP/1.1 when the server does
            // not negotiate h2 (Node surfaces that as an ALPN / no-application-protocol error).
            const fetchHttp2 = () => {
              let fellBack = false;
              const session = http2.connect(urlToFetch);
              const sock = session.socket as any;
              startTime = performance.now();
              if (sock) attachSocketTiming(sock);

              const teardown = () => {
                try { session.close(); } catch { /* already closed */ }
              };

              const fallback = () => {
                if (fellBack || settled) return;
                fellBack = true;
                try { session.destroy(); } catch { /* already destroyed */ }
                fetchHttp1();
              };

              session.setTimeout(8000, () => {
                if (!fellBack && !settled) rejectTimeout();
              });
              session.once('error', () => fallback());
              session.once('connect', () => {
                if (fellBack || settled) return;
                if (negotiatedAlpn !== 'h2') return fallback();
                alpnProtocol = 'h2';
                httpVersion = '2.0';

                const req = session.request({
                  ':method': 'GET',
                  ':path': parsedUrl.pathname + parsedUrl.search,
                  ':authority': parsedUrl.host,
                  'user-agent': userAgent,
                  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  'accept-encoding': 'gzip, deflate, br',
                });

                req.once('response', (headers) => {
                  if (fellBack || settled) return;
                  processResponse({
                    statusCode: Number(headers[':status']) || 200,
                    statusMessage: '',
                    headers: headers as http.IncomingHttpHeaders,
                    on: (e, l) => req.on(e, l),
                    once: (e, l) => req.once(e, l),
                    destroy: () => req.destroy(),
                  }, teardown);
                });
                req.on('error', () => {
                  if (!fellBack && !settled) fallback();
                });
              });
            };

            if (isHttps) fetchHttp2();
            else fetchHttp1();
          };

          executeProbe(destUrl);
        });
      };

      const probeResult = await probeTarget(targetUrl);

      // Real DOM analysis of the response HTML
      const html = probeResult.bodyHtml;
      const $ = loadCheerio(html);

      // Element/tag counts and block/no-block classification, via a real DOM parser instead of regex.
      const allDomNodes = $('*');
      const scripts = $('script');
      const blockingScripts = $('head script').filter((_, el) => {
        const a = $(el);
        return !a.is('[async]') && !a.is('[defer]') && !/module/i.test(a.attr('type') || '');
      });
      const stylesheets = $('link[rel="stylesheet"]');
      const images = $('img');
      const imagesWithoutDims = images.filter((_, el) => !$(el).attr('width') || !$(el).attr('height'));

      const pageTitle = $('title').first().text().trim() || targetUrl;

      // SEO & Search Engine Crawlability Indicators
      const metaDescription = ($('meta[name="description"]').attr('content') || '').trim();

      const robotsMeta = ($('meta[name="robots"]').attr('content') || '').trim();
      const robotsHeader = (probeResult.headers['x-robots-tag'] as string) || '';
      const robotsContent = robotsMeta + (robotsHeader ? ` Header: ${robotsHeader}` : '');
      const hasNoIndex = /noindex/i.test(robotsContent);
      const hasNoFollow = /nofollow/i.test(robotsContent);

      const canonicalUrl = ($('link[rel="canonical"]').attr('href') || '').trim();

      const hasMobileViewport = $('meta[name="viewport"]').length > 0;

      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogDesc = $('meta[property="og:description"]').attr('content');
      const ogImage = $('meta[property="og:image"]').attr('content');
      const hasOpenGraph = !!(ogTitle || ogImage);

      const h1Matches = $('h1');
      const isHttps = probeResult.finalUrl.startsWith('https://');
      const hasHsts = !!probeResult.headers['strict-transport-security'];

      const imagesWithAlt = images.filter((_, el) => (($(el).attr('alt') || '').trim().length) > 0);
      const altCoveragePercent = images.length > 0 ? Math.round((imagesWithAlt.length / images.length) * 100) : 100;

      const hasJsonLd = $('script[type="application/ld+json"]').length > 0;

      // Client-rendered detection: no renderable body text in the raw HTML. Script/style text
      // is excluded before measuring visible text so JS-heavy shells are not mistaken for content.
      const visibleText = ($('body').clone().find('script, style').remove().end().text() || '')
        .replace(/\s+/g, ' ')
        .trim();
      const hasAppMountPoint = $('body [id]').filter((_, el) => /^(root|app|__next|__nuxt)$/i.test($(el).attr('id') || '')).length > 0;
      const looksClientRendered = visibleText.length < 200 && (hasAppMountPoint || scripts.length > 0);

      const unverified = {
        title: looksClientRendered && pageTitle === targetUrl,
        description: looksClientRendered && !metaDescription,
        canonical: looksClientRendered && !canonicalUrl,
        socialOg: looksClientRendered && !hasOpenGraph,
        h1: looksClientRendered && h1Matches.length === 0,
        imageAlt: looksClientRendered && images.length === 0,
      };

      interface SeoAuditItem {
        id: string;
        name: string;
        category: string;
        /** Weight of this check; all weights sum to 100 */
        weight: number;
        impact: 'critical' | 'high' | 'medium' | 'low' | 'info';
        /** Score cap enforced when this item fails */
        capOnFail?: number;
        status: 'pass' | 'warn' | 'fail' | 'info';
        statusText: string;
        value: string;
        recommendation: string;
      }

      // Build SEO Audit Items
      const seoItems: SeoAuditItem[] = [
        {
          id: 'indexing',
          name: 'Search Engine Crawling & Indexing Permission (Robots Indexing)',
          category: 'indexing',
          weight: 20,
          impact: 'critical',
          capOnFail: 30,
          status: hasNoIndex ? 'fail' : 'pass',
          statusText: hasNoIndex
            ? 'FAIL (Blocked)'
            : 'PASS (Open)',
          value: hasNoIndex
            ? 'A noindex tag was detected (indexing blocked)'
            : (robotsContent
                ? `Active rules: ${robotsContent}`
                : 'Indexing allowed by default (Index, Follow)'),
          recommendation: hasNoIndex
            ? '⚠️ This page contains noindex, so search engines will not index it in search results! Please confirm this is not a misconfiguration.'
            : 'Crawling is not blocked, so search engines such as Google can crawl and index the page normally.',
        },
        {
          id: 'title',
          name: 'Page Title Tag',
          category: 'meta',
          weight: 15,
          impact: 'high',
          status: unverified.title ? 'info' : (!pageTitle || pageTitle === targetUrl ? 'fail' : (pageTitle.length < 10 || pageTitle.length > 70) ? 'warn' : 'pass'),
          statusText: unverified.title
            ? 'INFO (Client-rendered, unverified)'
            : (!pageTitle || pageTitle === targetUrl
                ? 'FAIL (Missing)'
                : (pageTitle.length < 10 || pageTitle.length > 70)
                  ? 'WARN (Needs improvement)'
                  : 'PASS (Standard)'),
          value: pageTitle
            ? `"${pageTitle}" (${pageTitle.length} characters)`
            : 'No <title> tag detected',
          recommendation: !pageTitle
            ? 'A missing <title> tag is a serious SEO flaw; search engines cannot display an accurate search title.'
            : (pageTitle.length > 70
                ? 'The title exceeds 70 characters and will be truncated in Google search results. Consider trimming it to 30-60 characters.'
                : 'The title length is appropriate and includes core keywords, giving excellent display results.'),
        },
        {
          id: 'description',
          name: 'Page Meta Description',
          category: 'meta',
          weight: 10,
          impact: 'medium',
          status: unverified.description ? 'info' : (!metaDescription ? 'warn' : (metaDescription.length < 50 || metaDescription.length > 165) ? 'warn' : 'pass'),
          statusText: unverified.description
            ? 'INFO (Client-rendered, unverified)'
            : (!metaDescription
                ? 'WARN (Missing)'
                : (metaDescription.length < 50 || metaDescription.length > 165)
                  ? 'WARN (Improvement advised)'
                  : 'PASS (Excellent)'),
          value: metaDescription
            ? `"${metaDescription.slice(0, 80)}..." (${metaDescription.length} characters)`
            : 'No <meta name="description"> configured',
          recommendation: !metaDescription
            ? 'Setting a Meta Description lets search results show a more compelling summary and can significantly raise click-through rate (CTR). Aim for 80-155 characters.'
            : 'The description length meets search engine display standards and helps improve SERP click-through.',
        },
        {
          id: 'canonical',
          name: 'Canonical URL',
          category: 'meta',
          weight: 8,
          impact: 'medium',
          status: unverified.canonical ? 'info' : (canonicalUrl ? 'pass' : 'warn'),
          statusText: unverified.canonical
            ? 'INFO (Client-rendered, unverified)'
            : (canonicalUrl
                ? 'PASS (Configured)'
                : 'WARN (Not declared)'),
          value: canonicalUrl
            ? canonicalUrl
            : 'rel="canonical" not declared',
          recommendation: canonicalUrl
            ? 'A canonical link is declared, effectively preventing link equity from being split across parameterized page variants.'
            : 'Add <link rel="canonical"> to prevent the same content from being treated as duplicate and demoted by search engines due to tracking parameters (e.g. utm_source).',
        },
        {
          id: 'mobile_viewport',
          name: 'Mobile Viewport Declaration',
          category: 'mobile',
          weight: 15,
          impact: 'high',
          status: hasMobileViewport ? 'pass' : 'fail',
          statusText: hasMobileViewport
            ? 'PASS (Responsive)'
            : 'FAIL (Missing)',
          value: hasMobileViewport
            ? 'A responsive width=device-width viewport is declared'
            : 'Missing <meta name="viewport"> declaration',
          recommendation: hasMobileViewport
            ? 'This meets Google mobile-first indexing standards.'
            : 'Without a mobile viewport tag, phones render the page scaled to desktop width, which Google may judge as not mobile-friendly.',
        },
        {
          id: 'social_og',
          name: 'Social & Ad Share Cards (Open Graph)',
          category: 'social',
          weight: 3,
          impact: 'low',
          status: unverified.socialOg ? 'info' : (hasOpenGraph ? 'pass' : 'warn'),
          statusText: unverified.socialOg
            ? 'INFO (Client-rendered, unverified)'
            : (hasOpenGraph
                ? 'PASS (Complete)'
                : 'WARN (Missing)'),
          value: hasOpenGraph
            ? `Configured: ${ogTitle ? 'og:title ' : ''}${ogImage ? 'og:image ' : ''}${ogDesc ? 'og:description' : ''}`
            : 'No og:title or og:image tag configured',
          recommendation: hasOpenGraph
            ? 'Sharing on social media (Twitter/X, Facebook, WeChat) or in ads will render a rich large-card preview.'
            : 'Without a thumbnail and card, ad placements and shared links tend to have lower click-through rates. Add og:image and og:title.',
        },
        {
          id: 'h1',
          name: 'Primary Heading (H1)',
          category: 'meta',
          weight: 7,
          impact: 'medium',
          status: unverified.h1 ? 'info' : (h1Matches.length === 1 ? 'pass' : 'warn'),
          statusText: unverified.h1
            ? 'INFO (Client-rendered, unverified)'
            : (h1Matches.length === 1
                ? 'PASS (Single H1)'
                : h1Matches.length === 0
                  ? 'WARN (No H1)'
                  : 'WARN (Multiple H1)'),
          value: `The page contains ${h1Matches.length} <h1> tag(s)`,
          recommendation: h1Matches.length === 1
            ? 'The page has a single, unambiguous heading, giving a clear semantic structure.'
            : (h1Matches.length === 0
                ? 'Add a single <h1> tag in the body or above-the-fold area to highlight the topic.'
                : 'Multiple <h1> tags may dilute how search engines identify the primary heading.'),
        },
        {
          id: 'ssl_security',
          name: 'Transport Encryption & Secure Access (HTTPS & HSTS)',
          category: 'security',
          weight: 15,
          impact: 'critical',
          capOnFail: 70,
          status: isHttps ? 'pass' : 'fail',
          statusText: isHttps
            ? (hasHsts
                ? 'PASS (HSTS Enforced)'
                : 'PASS (HTTPS)')
            : 'FAIL (Insecure HTTP)',
          value: isHttps
            ? `Uses the HTTPS transport protocol${hasHsts ? ' (with HSTS enforcement)' : ''}`
            : 'Uses unencrypted plaintext HTTP',
          recommendation: isHttps
            ? 'All traffic is encrypted, satisfying the HTTPS ranking boost used by Google Chrome and search algorithms.'
            : 'Google marks pages without HTTPS as "not secure" and lowers their search ranking. Configure an SSL certificate immediately.',
        },
        {
          id: 'img_alt',
          name: 'Image Accessibility & Image Search (Alt Coverage)',
          category: 'meta',
          weight: 5,
          impact: 'low',
          status: unverified.imageAlt ? 'info' : (altCoveragePercent >= 80 ? 'pass' : 'warn'),
          statusText: unverified.imageAlt
            ? 'INFO (Client-rendered, unverified)'
            : (altCoveragePercent >= 80
                ? 'PASS (High coverage)'
                : 'WARN (Partially missing)'),
          value: `${altCoveragePercent}% of images have alt text (${imagesWithAlt.length}/${images.length})`,
          recommendation: altCoveragePercent >= 80
            ? 'Most images include text descriptions, making them easy for Google Image Search to index.'
            : 'Images without alt descriptions cannot rank in Google Image Search and also harm accessibility. Consider adding them.',
        },
        {
          id: 'structured_data',
          name: 'Structured Rich Data (Schema.org / JSON-LD)',
          category: 'indexing',
          weight: 2,
          impact: 'info',
          status: hasJsonLd ? 'pass' : 'info',
          statusText: hasJsonLd
            ? 'PASS (Rich results ready)'
            : 'INFO (Not configured)',
          value: hasJsonLd
            ? 'Schema.org JSON-LD structured data detected'
            : 'No application/ld+json markup detected',
          recommendation: hasJsonLd
            ? 'Enables rich snippets such as star ratings, breadcrumbs, and FAQs in Google search results.'
            : 'Adding structured markup (e.g. Organization, Article, Product) can unlock richer display features in search results.',
        },
      ];

      const seoPassedCount = seoItems.filter(i => i.status === 'pass').length;
      const seoWarnCount = seoItems.filter(i => i.status === 'warn').length;
      const seoFailCount = seoItems.filter(i => i.status === 'fail').length;
      const seoInfoCount = seoItems.filter(i => i.status === 'info').length;

      // Weighted scoring: pass=1 / warn=0.5 / fail=0; INFO (unverifiable or not applicable) is excluded from the denominator
      const seoStatusScore: Record<string, number | null> = { pass: 1, warn: 0.5, fail: 0, info: null };
      let seoWeightedSum = 0;
      let seoWeightTotal = 0;
      let seoScoreCap = 100;

      for (const item of seoItems) {
        const statusScore = seoStatusScore[item.status];
        if (statusScore === null) continue;
        seoWeightTotal += item.weight;
        seoWeightedSum += item.weight * statusScore;
        if (item.status === 'fail' && item.capOnFail) {
          seoScoreCap = Math.min(seoScoreCap, item.capOnFail);
        }
      }

      const seoScore = seoWeightTotal > 0
        ? Math.min(seoScoreCap, Math.round((seoWeightedSum / seoWeightTotal) * 100))
        : 100;
      const seoGrade = seoScore >= 90 ? 'A' : seoScore >= 80 ? 'B' : seoScore >= 70 ? 'C' : seoScore >= 60 ? 'D' : 'F';

      const seoAudit = {
        score: seoScore,
        grade: seoGrade,
        passedCount: seoPassedCount,
        warnCount: seoWarnCount,
        failCount: seoFailCount,
        infoCount: seoInfoCount,
        totalCount: seoItems.length,
        items: seoItems,
      };

      // Extract sub-resources to construct authentic Pingdom Waterfall
      let docUrlObj: URL;
      try {
        docUrlObj = new URL(probeResult.finalUrl);
      } catch {
        docUrlObj = new URL(targetUrl);
      }

      interface WaterfallRequest {
        id: string;
        url: string;
        filename: string;
        domain: string;
        path: string;
        type: 'html' | 'script' | 'stylesheet' | 'image' | 'font' | 'other';
        size: number;
        statusCode: number;
        mimeType: string;
        startTime: number;
        timings: {
          dns: number;
          connect: number;
          ssl: number;
          wait: number;
          receive: number;
          total: number;
        };
        headers: Record<string, string>;
      }

      const extractedRequests: WaterfallRequest[] = [];
      const seenUrls = new Set<string>();

      // 1. Root HTML Request
      const docDns = probeResult.dns;
      const docConnect = probeResult.tcp;
      const docSsl = probeResult.tls;
      const docWait = Math.max(15, probeResult.ttfb - (docDns + docConnect + docSsl));
      const docReceive = Math.max(10, probeResult.totalDuration - probeResult.ttfb);

      extractedRequests.push({
        id: 'req-0',
        url: probeResult.finalUrl,
        filename: docUrlObj.pathname === '/' || !docUrlObj.pathname ? probeResult.finalUrl : (docUrlObj.pathname.split('/').pop() || probeResult.finalUrl),
        domain: docUrlObj.hostname,
        path: docUrlObj.pathname || '/',
        type: 'html',
        size: probeResult.bodyBytes,
        statusCode: probeResult.statusCode,
        mimeType: 'text/html; charset=utf-8',
        startTime: 0,
        timings: {
          dns: docDns,
          connect: docConnect,
          ssl: docSsl,
          wait: docWait,
          receive: docReceive,
          total: docDns + docConnect + docSsl + docWait + docReceive,
        },
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'server': (probeResult.headers['server'] as string) || 'Cloudflare / Edge',
          'cache-control': (probeResult.headers['cache-control'] as string) || 'public, max-age=0, must-revalidate',
          'content-encoding': (probeResult.headers['content-encoding'] as string) || 'gzip',
        },
      });
      seenUrls.add(probeResult.finalUrl);

      // Helper to resolve URLs
      const safeResolve = (rawUrl: string): string | null => {
        if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('javascript:')) return null;
        try {
          return new URL(rawUrl, probeResult.finalUrl).href;
        } catch {
          return null;
        }
      };

      // Extract sub-resources (stylesheets, scripts, module preloads, images) via the DOM.
      // URLs that block the first paint are tracked so FCP is only charged those.
      const blockingCssUrls = new Set<string>();

      const pushSubresource = (raw: string | undefined, type: 'stylesheet' | 'script' | 'image') => {
        if (!raw) return;
        const resolved = safeResolve(raw);
        if (!resolved || seenUrls.has(resolved)) return;
        seenUrls.add(resolved);
        try {
          const u = new URL(resolved);
          const fname = u.pathname.split('/').pop() || (type === 'stylesheet' ? 'style.css' : type === 'script' ? 'bundle.js' : 'image.png');
          extractedRequests.push({
            id: `req-${extractedRequests.length}`,
            url: resolved,
            filename: fname,
            domain: u.hostname,
            path: u.pathname,
            type,
            size: 0,
            statusCode: 200,
            mimeType: type === 'stylesheet'
              ? 'text/css; charset=utf-8'
              : type === 'script'
                ? 'application/javascript; charset=utf-8'
                : fname.endsWith('.svg') ? 'image/svg+xml' : fname.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
            startTime: 0,
            timings: { dns: 0, connect: 0, ssl: 0, wait: 0, receive: 0, total: 0 },
            headers: type === 'stylesheet'
              ? { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable', 'content-encoding': 'br' }
              : type === 'script'
                ? { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable', 'content-encoding': 'gzip' }
                : { 'content-type': 'image/webp', 'cache-control': 'public, max-age=86400' },
          });
        } catch { /* ignore unparseable URLs */ }
      };

      $('link[rel="stylesheet"]').each((_, el) => {
        const href = $(el).attr('href');
        const resolved = safeResolve(href);
        if (!resolved || seenUrls.has(resolved)) return;
        // Print media stylesheets are fetched without blocking rendering, so they are not charged to FCP.
        if (!/print/i.test($(el).attr('media') || '')) blockingCssUrls.add(resolved);
        pushSubresource(href, 'stylesheet');
      });

      // Module preloads are included because a client-rendered page cannot paint until those bundles are fetched.
      $('script[src]').each((_, el) => {
        pushSubresource($(el).attr('src'), 'script');
      });

      $('link[rel="modulepreload"]').each((_, el) => {
        pushSubresource($(el).attr('href'), 'script');
      });

      $('img[src]').each((_, el) => {
        pushSubresource($(el).attr('src'), 'image');
      });

      // Measure real transfer size and network timings for each sub-resource in a single GET.
      // Resources whose probe fails stay at size 0 and zero timings rather than being padded
      // with fabricated numbers. The budget is allocated per content type so stylesheets do
      // not consume the whole allowance.
      const sizeProbes: WaterfallRequest[] = [];
      const probedPerType: Record<string, number> = {};
      for (const req of extractedRequests.slice(1)) {
        const quota = RESOURCE_PROBE_QUOTA[req.type] ?? 6;
        if ((probedPerType[req.type] || 0) >= quota) continue;
        probedPerType[req.type] = (probedPerType[req.type] || 0) + 1;
        sizeProbes.push(req);
      }
      const probedResources = await mapWithConcurrency(sizeProbes, RESOURCE_PROBE_CONCURRENCY, async (req) => {
        // Sub-resource URLs come from the target's own HTML, so they must clear the same SSRF guard as the main target
        const check = await assertProbeTargetAllowed(req.url);
        if (!check.ok) return null;
        return probeResourceTiming(req.url);
      });
      probedResources.forEach((probe, index) => {
        if (!probe) return;
        sizeProbes[index].size = probe.size;
        sizeProbes[index].statusCode = probe.statusCode;
        sizeProbes[index].timings = probe.timings;
      });

      // A server-side probe cannot observe the browser's discovery schedule, so each sub-resource
      // is conservatively stamped as starting once the document's first byte arrives. Its DNS/TLS/
      // wait/receive duration is the real measured value; the total load time is the latest completion.
      for (let i = 1; i < extractedRequests.length; i++) {
        extractedRequests[i].startTime = Math.max(0, Math.round(probeResult.ttfb));
      }

      // Total load time = max of all request completions
      const maxCompletionTime = extractedRequests.reduce((max, r) => Math.max(max, r.startTime + r.timings.total), probeResult.totalDuration);
      const totalPageSize = extractedRequests.reduce((sum, r) => sum + r.size, 0);

      // Realistic Core Web Vitals calculated directly from real network & DOM facts
      const ttfb = probeResult.ttfb;
      const bodyKb = probeResult.bodyBytes / 1024;
      const isMobile = deviceProfile && deviceProfile.includes('Mobile');

      // Sub-timings: link latency (DNS/TCP/TLS) is for display only
      const dns = probeResult.dns;
      const tcp = probeResult.tcp;
      const tls = probeResult.tls;

      // Render-blocking payload. CSS has to arrive before the first paint, and a client-rendered shell
      // paints nothing until its boot bundles have been downloaded, parsed and executed.
      // Only stylesheets that actually block rendering are charged to FCP (see blockingCssUrls);
      // print/lazy styles and scripts loaded after paint must not be counted, otherwise asset-heavy
      // pages are penalised in proportion to their total byte count rather than to real blocking cost.
      const blockingCss = extractedRequests.filter(r => r.type === 'stylesheet' && blockingCssUrls.has(r.url));
      const blockingCssCount = blockingCss.length;
      const blockCssSizes = blockingCss.map(r => r.size);
      const externalScriptBytes = extractedRequests.filter(r => r.type === 'script').reduce((sum, r) => sum + r.size, 0);
      const bootScriptSizes = looksClientRendered
        ? extractedRequests.filter(r => r.type === 'script').map(r => r.size)
        : [];
      const cssDownload = parallelTransferMs(blockCssSizes, isMobile ? 550 : 1300, ASSET_PARALLELISM);
      const bootDownload = parallelTransferMs(bootScriptSizes, isMobile ? 420 : 900, ASSET_PARALLELISM);

      // FCP: TTFB + blocking CSS/JS download + CSSOM render blocking + parsing
      let fcp = Math.round(
        ttfb +
        cssDownload +
        bootDownload +
        (blockingCssCount * (isMobile ? 35 : 20)) +
        Math.min(Math.round(bodyKb * (isMobile ? 1.8 : 0.8)), 300) +
        (isMobile ? 80 : 40)
      );

      // LCP: FCP + Hero image / largest text block download & render
      let lcp = Math.round(
        fcp +
        (images.length > 0 ? (isMobile ? 320 : 180) : 100) +
        Math.min(Math.round(bodyKb * (isMobile ? 2.5 : 1.2)), 600)
      );

      // CLS: images missing dimensions (Google's primary identified cause) + DOM size tiering
      const domScaleCost = allDomNodes.length > 3000 ? 0.02
        : allDomNodes.length > 1500 ? 0.012
        : allDomNodes.length > 800 ? 0.006
        : 0.003;
      const clsRaw = 0.005 + (imagesWithoutDims.length * 0.009) + domScaleCost;
      let cls = Number(Math.min(clsRaw, 0.28).toFixed(3));

      // TBT: main-thread blocking is estimated from script size (external + inline), plus the overhead of non-async scripts and script count
      const inlineScriptBytes = $('script:not([src])')
        .map((_, el) => ($(el).text() || '').length)
        .get()
        .reduce((sum: number, n: number) => sum + n, 0);
      const scriptKb = (externalScriptBytes + inlineScriptBytes) / 1024;
      let tbt = Math.round(
        Math.max(0,
          (scriptKb * (isMobile ? 0.95 : 0.6)) +
          (blockingScripts.length * (isMobile ? 40 : 25)) +
          (scripts.length > 15 ? (scripts.length - 15) * (isMobile ? 8 : 4) : 0)
        )
      );
      const inp = Math.round(
        Math.min(20 + (tbt * 0.22) + (isMobile ? 18 : 6), 320)
      );

      // Lighthouse scoring model: log-normal curve + official weights (FCP/LCP/TBT/CLS)
      // FCP/LCP are scored as measured from navigation start (Lighthouse semantics), including connection setup,
      // so no link-latency discount is applied here.
      let overallScore = performanceScore({ fcp, lcp, tbt, cls }).score;

      // Kick off a background Lighthouse audit (serialized by the queue) and return the
      // heuristic result immediately. The client polls /api/lighthouse/:id for the lab result.
      const lighthouseJobId = startLighthouseJob(targetUrl, deviceProfile);

      // DOMContentLoaded is not observable from a server-side HTML probe; approximate it
      // from FCP and report it as an estimate rather than a measured milestone.
      const domReady = Math.round(fcp + 120);

      // Build Pingdom-style Performance Recommendations
      // Facts backing the asset-delivery rules below
      const uniqueDomainCount = new Set(extractedRequests.map(r => r.domain)).size;
      const staticAssetHosts = new Set(
        extractedRequests
          .filter(r => r.type === 'script' || r.type === 'stylesheet' || r.type === 'image' || r.type === 'font')
          .map(r => r.domain)
      );
      const documentSetsCookies = !!probeResult.headers['set-cookie'];
      const staticSharesDocumentHost = staticAssetHosts.has(docUrlObj.hostname);
      // An empty src/href drives the browser to re-request the current document, wasting a round trip
      const emptyUrlAttrCount = $('[src=""], [href=""]').length;
      const hasCachePolicy = !!(probeResult.headers['cache-control'] || probeResult.headers['expires']);

      const performanceRecommendations: {
        id: string;
        rule: string;
        grade: string;
        score: number;
        type: string;
        advice: string;
      }[] = [
        {
          id: 'cdn',
          rule: 'Use a Content Delivery Network (CDN)',
          grade: ['cloudflare', 'vercel', 'fastly', 'cloudfront', 'akamai'].some(c => ((probeResult.headers.server as string) || '').toLowerCase().includes(c)) ? 'A' : 'B',
          score: ['cloudflare', 'vercel', 'fastly', 'cloudfront', 'akamai'].some(c => ((probeResult.headers.server as string) || '').toLowerCase().includes(c)) ? 100 : 82,
          type: 'Server',
          advice: 'Static assets are delivered from edge CDN nodes, cutting cross-region distance and first-byte latency.',
        },
        {
          id: 'compression',
          rule: 'Compress components with gzip / brotli',
          grade: (probeResult.headers['content-encoding'] as string)?.includes('gzip') || (probeResult.headers['content-encoding'] as string)?.includes('br') ? 'A' : 'F',
          score: (probeResult.headers['content-encoding'] as string)?.includes('gzip') || (probeResult.headers['content-encoding'] as string)?.includes('br') ? 100 : 40,
          type: 'Content',
          advice: 'Responses are compressed with modern high-ratio algorithms, effectively reducing network transfer volume and transmission time.',
        },
        {
          id: 'caching',
          rule: 'Add Expires or Cache-Control headers',
          grade: hasCachePolicy ? 'A' : 'C',
          score: hasCachePolicy ? 95 : 65,
          type: 'Server',
          advice: hasCachePolicy
            ? 'The response carries a caching policy (Cache-Control / Expires), so repeat visits can reuse the local disk cache.'
            : 'No Cache-Control or Expires header was returned, so the browser has to revalidate every asset on the next visit.',
        },
        {
          id: 'reduce_dns_lookups',
          rule: 'Reduce DNS lookups',
          grade: uniqueDomainCount <= 4 ? 'A' : uniqueDomainCount <= 8 ? 'B' : uniqueDomainCount <= 12 ? 'C' : 'F',
          score: Math.max(0, 100 - Math.max(0, uniqueDomainCount - 4) * 10),
          type: 'Server',
          advice: `The page spans ${uniqueDomainCount} domain(s). Every extra origin costs its own DNS lookup and connection setup before its assets can start downloading; consolidating onto fewer origins removes that from the critical path.`,
        },
        {
          id: 'cookie_free',
          rule: 'Use cookie-free domains',
          grade: !documentSetsCookies ? 'A' : staticSharesDocumentHost ? 'C' : 'B',
          score: !documentSetsCookies ? 100 : staticSharesDocumentHost ? 60 : 85,
          type: 'Server',
          advice: !documentSetsCookies
            ? 'The document sets no cookies, so static asset requests carry no cookie payload.'
            : staticSharesDocumentHost
              ? 'The document sets cookies and static assets are served from that same host, so every asset request re-sends them. Serving static files from a separate cookieless domain avoids that upstream overhead.'
              : 'Static assets are already served from a different host than the document; confirm that host does not set cookies.',
        },
        {
          id: 'requests_count',
          rule: 'Make fewer HTTP requests',
          grade: extractedRequests.length <= 40 ? 'A' : extractedRequests.length <= 80 ? 'B' : 'C',
          score: Math.max(50, Math.min(100, 100 - Math.max(0, extractedRequests.length - 30))),
          type: 'Content',
          advice: `The page makes ${extractedRequests.length} resource requests in total; bundling requests and using sprite sheets can further reduce handshake overhead.`,
        },
        {
          id: 'image_dims',
          rule: 'Specify image dimensions (Fix CLS)',
          grade: imagesWithoutDims.length === 0 ? 'A' : imagesWithoutDims.length < 3 ? 'B' : 'D',
          score: Math.max(40, 100 - (imagesWithoutDims.length * 15)),
          type: 'Design',
          advice: imagesWithoutDims.length === 0
            ? 'All image elements declare an explicit aspect ratio or container constraint, so the viewport will not shift unexpectedly.'
            : `${imagesWithoutDims.length} images are missing explicit width and height attributes, which can cause cumulative layout shift (CLS).`,
        },
        {
          id: 'redirects',
          rule: 'Avoid URL redirects',
          grade: probeResult.finalUrl === targetUrl ? 'A' : 'B',
          score: probeResult.finalUrl === targetUrl ? 100 : 85,
          type: 'Server',
          advice: probeResult.finalUrl === targetUrl
            ? 'The request reaches the target address directly, with no extra RTT caused by redirects.'
            : 'A 301/302 redirect chain was detected; point links directly to the final canonical URL.',
        },
        {
          id: 'js_at_bottom',
          rule: 'Put JavaScript at bottom',
          grade: blockingScripts.length === 0 ? 'A' : blockingScripts.length <= 2 ? 'B' : blockingScripts.length <= 5 ? 'C' : 'F',
          score: blockingScripts.length === 0 ? 100 : Math.max(40, 100 - blockingScripts.length * 15),
          type: 'Content',
          advice: blockingScripts.length === 0
            ? 'No synchronous script in <head> blocks HTML parsing; usable content can be parsed without waiting for JavaScript.'
            : `${blockingScripts.length} synchronous script(s) in <head> block HTML parsing. Add defer/async, or move them to the end of <body>, so the parser is not stalled.`,
        },
        {
          id: 'empty_src',
          rule: 'Avoid empty src or href',
          grade: emptyUrlAttrCount === 0 ? 'A' : 'F',
          score: emptyUrlAttrCount === 0 ? 100 : 20,
          type: 'Content',
          advice: emptyUrlAttrCount === 0
            ? 'No empty src or href attributes were found, so the browser is not driven to re-request the current document.'
            : `${emptyUrlAttrCount} element(s) declare an empty src or href. An empty value resolves to the current URL, making the browser download the page again.`,
        },
      ];

      // Build Content Type Breakdown
      const typeBreakdown: Record<string, { bytes: number; count: number }> = {
        html: { bytes: 0, count: 0 },
        script: { bytes: 0, count: 0 },
        stylesheet: { bytes: 0, count: 0 },
        image: { bytes: 0, count: 0 },
        font: { bytes: 0, count: 0 },
        other: { bytes: 0, count: 0 },
      };

      const domainBreakdown: Record<string, { bytes: number; count: number }> = {};

      for (const req of extractedRequests) {
        const t = typeBreakdown[req.type] || typeBreakdown.other;
        t.bytes += req.size;
        t.count += 1;

        if (!domainBreakdown[req.domain]) {
          domainBreakdown[req.domain] = { bytes: 0, count: 0 };
        }
        domainBreakdown[req.domain].bytes += req.size;
        domainBreakdown[req.domain].count += 1;
      }

      const totalReqs = extractedRequests.length;
      const totalBytes = extractedRequests.reduce((acc, r) => acc + r.size, 0);

      const contentTypeAnalysis = Object.entries(typeBreakdown)
        .filter(([_, data]) => data.count > 0)
        .map(([type, data]) => ({
          type,
          label: type === 'html' ? 'HTML' : type === 'script' ? 'JavaScript' : type === 'stylesheet' ? 'CSS' : type === 'image' ? 'Image' : type === 'font' ? 'Font' : 'Other',
          bytes: data.bytes,
          count: data.count,
          sizePercent: Number(((data.bytes / totalBytes) * 100).toFixed(1)),
          countPercent: Number(((data.count / totalReqs) * 100).toFixed(1)),
        }))
        .sort((a, b) => b.bytes - a.bytes);

      const domainAnalysis = Object.entries(domainBreakdown)
        .map(([domain, data]) => ({
          domain,
          bytes: data.bytes,
          count: data.count,
          sizePercent: Number(((data.bytes / totalBytes) * 100).toFixed(1)),
          countPercent: Number(((data.count / totalReqs) * 100).toFixed(1)),
        }))
        .sort((a, b) => b.bytes - a.bytes);

      const performanceGrade = overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : overallScore >= 60 ? 'D' : 'F';

      const resultPayload = {
        success: true,
        // Network timings and HTML/DOM facts come from real probing; FCP/LCP/TBT/CLS here are
        // server-side estimates. A real Lighthouse lab run is computed in the background and
        // delivered through /api/lighthouse/:id (see lighthouseJobId below).
        metricsSource: 'server-probe-heuristic',
        metricsEstimated: true,
        lighthouse: null,
        lighthouseJobId,
        url: probeResult.finalUrl,
        title: pageTitle,
        statusCode: probeResult.statusCode,
        statusMessage: probeResult.statusMessage,
        httpVersion: probeResult.httpVersion,
        connection: {
          httpVersion: probeResult.httpVersion,
          tlsVersion: probeResult.tlsVersion,
          alpnProtocol: probeResult.alpnProtocol,
          remoteAddress: probeResult.remoteAddress,
        },
        serverHeader: (probeResult.headers.server as string) || 'Standard Web Server',
        contentEncoding: (probeResult.headers['content-encoding'] as string) || 'identity',
        ip: probeResult.remoteAddress,
        bodyBytes: probeResult.bodyBytes,
        evalDuration: probeResult.totalDuration,
        score: overallScore,
        performanceGrade,
        pageSummary: {
          performanceGrade,
          score: overallScore,
          pageSizeBytes: totalBytes,
          pageSizeFormatted: (totalBytes / 1024).toFixed(1) + ' KB',
          loadTimeMs: maxCompletionTime,
          requestsCount: totalReqs,
        },
        pageAnalysis: {
          byContentType: contentTypeAnalysis,
          byDomain: domainAnalysis,
        },
        performanceRecommendations,
        seoAudit,
        requests: extractedRequests,
        diagnostics: {
          domNodesCount: allDomNodes.length,
          scriptsCount: scripts.length,
          blockingScriptsCount: blockingScripts.length,
          stylesheetsCount: stylesheets.length,
          imagesCount: images.length,
          imagesMissingDimsCount: imagesWithoutDims.length,
        },
        timings: {
          dns,
          tcp,
          tls,
          ttfb,
          domReady,
          loadEvent: maxCompletionTime,
        },
        // Core Web Vitals as estimated by this single server-side probe.
        // No percentile distribution is reported: a field (CrUX) p50/p95 cannot be derived from one probe run.
        metrics: [
          {
            id: 'lcp',
            shortName: 'LCP',
            name: 'Largest Contentful Paint',
            value: String(lcp),
            unit: 'ms',
            targetThreshold: 2500,
            poorThreshold: 4000,
            percent: Math.min(100, Math.round((lcp / 2500) * 100)),
            status: lcp <= 2500 ? 'good' : lcp <= 4000 ? 'needs-improvement' : 'poor',
            sliceText: `TTFB ${Math.round((ttfb / lcp) * 100)}% · Resource download ${Math.round(((lcp - fcp) / lcp) * 100)}% · Render ${Math.round(((fcp - ttfb) / lcp) * 100)}%`,
          },
          {
            id: 'inp',
            shortName: 'INP',
            name: 'Interaction to Next Paint',
            value: String(inp),
            unit: 'ms',
            targetThreshold: 200,
            poorThreshold: 500,
            percent: Math.min(100, Math.round((inp / 200) * 100)),
            status: inp <= 200 ? 'good' : inp <= 500 ? 'needs-improvement' : 'poor',
            sliceText: `Estimated from main-thread blocking (TBT ${tbt}ms) · No real user input was measured`,
          },
          {
            id: 'cls',
            shortName: 'CLS',
            name: 'Cumulative Layout Shift',
            value: String(cls),
            unit: '',
            targetThreshold: 0.1,
            poorThreshold: 0.25,
            percent: Math.min(100, Math.round((cls / 0.1) * 100)),
            status: cls <= 0.1 ? 'good' : cls <= 0.25 ? 'needs-improvement' : 'poor',
            sliceText: imagesWithoutDims.length > 0
              ? `${imagesWithoutDims.length} images are missing fixed aspect-ratio dimensions`
              : 'No image without explicit dimensions · lower-bound estimate only',
          },
          {
            id: 'fcp',
            shortName: 'FCP',
            name: 'First Contentful Paint',
            value: String(fcp),
            unit: 'ms',
            targetThreshold: 1800,
            poorThreshold: 3000,
            percent: Math.min(100, Math.round((fcp / 1800) * 100)),
            status: fcp <= 1800 ? 'good' : fcp <= 3000 ? 'needs-improvement' : 'poor',
            sliceText: `Blocking stylesheets: ${blockingCssCount} · TTFB share ${Math.round((ttfb / fcp) * 100)}%`,
          },
          {
            id: 'ttfb',
            shortName: 'TTFB',
            name: 'Time to First Byte',
            value: String(ttfb),
            unit: 'ms',
            targetThreshold: 800,
            poorThreshold: 1800,
            percent: Math.min(100, Math.round((ttfb / 800) * 100)),
            status: ttfb <= 800 ? 'good' : ttfb <= 1800 ? 'needs-improvement' : 'poor',
            sliceText: `TCP/TLS handshake ${tcp + tls}ms · Server processing ${Math.max(1, ttfb - (dns + tcp + tls))}ms`,
          },
          {
            id: 'tbt',
            shortName: 'TBT',
            name: 'Total Blocking Time',
            value: String(tbt),
            unit: 'ms',
            targetThreshold: 200,
            poorThreshold: 600,
            percent: Math.min(100, Math.round((tbt / 200) * 100)),
            status: tbt <= 200 ? 'good' : tbt <= 600 ? 'needs-improvement' : 'poor',
            sliceText: `Script size ${Math.round(scriptKb)}KB · Non-async scripts ${blockingScripts.length}`,
          },
        ],
      };
      resultCache.set(cacheKey, { payload: resultPayload, expiresAt: Date.now() + RESULT_CACHE_TTL_MS });
      if (resultCache.size > RESULT_CACHE_MAX_ENTRIES) {
        const oldestKey = resultCache.keys().next().value;
        if (oldestKey !== undefined) resultCache.delete(oldestKey);
      }
      res.json(resultPayload);
    } catch (err: any) {
      const errorPayload = typeof err === 'object' && err.title ? err : {
        errorType: 'probe_failed',
        title: 'Network Probe Error',
        message: err.message || 'An error occurred while communicating with the target site. Please try again later.',
        targetUrl,
        region: selectedRegion,
        troubleshootingTips: [
          'Check whether the target site can be accessed in a normal browser.',
          'Try switching to another test node and probe again.',
        ],
      };
      res.json({
        success: false,
        error: errorPayload,
      });
    }
  });

  // API: Poll for the result of a background Lighthouse job started by /api/audit-url.
  app.get('/api/lighthouse/:id', (req: Request, res: Response) => {
    const job = lighthouseJobs.get(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Unknown or expired Lighthouse job' });
    }
    res.json({ success: true, status: job.status, report: job.report });
    // The client stops polling once a terminal status is observed; drop the entry to bound memory.
    if (job.status !== 'pending') lighthouseJobs.delete(job.id);
  });

  // Express and Vite HMR share this one HTTP server, so the dev server no longer
  // needs a second port for the websocket.
  const httpServer = http.createServer(app);

  // Vite development middleware or static production serve
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Mount at both root and /speedtest sub-path for flexible deployment
    app.use(express.static(distPath));
    app.use('/speedtest', express.static(distPath));
    // SPA fallback for both paths
    const sendIndexHtml = (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    };
    app.get('/', sendIndexHtml);
    app.get('/speedtest', sendIndexHtml);
    app.get('/speedtest/*', sendIndexHtml);
    // Catch-all fallback for any unmatched client-side routes
    app.get('*', sendIndexHtml);
  }

  listenWithPortFallback(httpServer, PORT);
}

/** Bind to `port`, stepping upward while the port is already taken. */
function listenWithPortFallback(server: http.Server, port: number, attemptsLeft = 10): void {
  const onListening = () => {
    server.off('error', onError);
    console.log(`WebPulse APM Engine listening on http://0.0.0.0:${port}`);
  };
  const onError = (err: NodeJS.ErrnoException) => {
    // A failed listen leaves its `listening` listener behind; drop it before retrying.
    server.off('listening', onListening);
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.warn(`Port ${port} is already in use, trying ${port + 1}...`);
      listenWithPortFallback(server, port + 1, attemptsLeft - 1);
      return;
    }
    console.error(err);
    process.exit(1);
  };

  server.once('listening', onListening);
  server.once('error', onError);
  server.listen(port, '0.0.0.0');
}

startServer();
