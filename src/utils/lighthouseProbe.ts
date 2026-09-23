/**
 * Server-side Lighthouse probe.
 *
 * The heuristic probe in server.ts can only estimate Core Web Vitals from network and
 * HTML facts. This module runs a real headless Chrome via Lighthouse to capture actual
 * lab metrics (FCP / LCP / CLS / TBT / Speed Index) plus the Accessibility / Best
 * Practices / SEO / Performance category scores. Used as an override when available.
 */

import http from 'http';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

export type ResourceType = 'html' | 'script' | 'stylesheet' | 'image' | 'font' | 'other';

export interface LighthouseResourceEntry {
  url: string;
  filename: string;
  domain: string;
  path: string;
  type: ResourceType;
  /** Decoded (uncompressed) size, consistent with the server-side "page size" semantics. */
  size: number;
  /** Compressed bytes actually transferred over the wire. */
  transferSize: number;
  statusCode: number;
  mimeType: string;
  /** Start time in ms, relative to navigation start. */
  startTime: number;
  /** Total duration in ms. */
  total: number;
  protocol: string;
}

export interface LighthouseResourceSummary {
  totalBytes: number;
  totalTransferBytes: number;
  totalRequests: number;
  byType: { type: ResourceType; bytes: number; transferBytes: number; count: number }[];
}

export interface LighthouseReport {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fcp: number;
  lcp: number;
  cls: number;
  tbt: number;
  speedIndex: number;
  /** Full browser-observed resource list (from the network-requests audit). */
  resources?: LighthouseResourceEntry[];
  /** Aggregated resource totals by content type. */
  resourceSummary?: LighthouseResourceSummary;
}

function auditValue(lhr: any, id: string): number {
  const audit = lhr.audits?.[id];
  const value = typeof audit?.numericValue === 'number' ? audit.numericValue : 0;
  return Number.isFinite(value) ? value : 0;
}

/** Map a Lighthouse resourceType (e.g. "Document", "Stylesheet") onto the 6-type waterfall scheme. */
function normalizeResourceType(resourceType: string | undefined): ResourceType {
  switch ((resourceType || '').toLowerCase()) {
    case 'document': return 'html';
    case 'script': return 'script';
    case 'stylesheet': return 'stylesheet';
    case 'image': return 'image';
    case 'font': return 'font';
    default: return 'other';
  }
}

/** Extract the full browser-observed resource list from the network-requests audit. */
function extractResources(lhr: any): LighthouseResourceEntry[] {
  const items: any[] = lhr.audits?.['network-requests']?.details?.items || [];
  return items.map((it) => {
    let domain = '';
    let filename = it.url || '';
    let path = '/';
    try {
      const u = new URL(it.url);
      domain = u.hostname;
      path = u.pathname || '/';
      filename = u.pathname.split('/').pop() || it.url;
    } catch {
      // Malformed URL: keep the raw url as the filename and an empty domain.
    }
    const startTime = Math.round(it.networkRequestTime || 0);
    const endTime = Math.round(it.networkEndTime || 0);
    return {
      url: it.url,
      filename,
      domain,
      path,
      type: normalizeResourceType(it.resourceType),
      size: it.resourceSize || it.transferSize || 0,
      transferSize: it.transferSize || 0,
      statusCode: it.statusCode || 0,
      mimeType: it.mimeType || '',
      startTime,
      total: Math.max(0, endTime - startTime),
      protocol: it.protocol || '',
    };
  });
}

function summarizeResources(resources: LighthouseResourceEntry[]): LighthouseResourceSummary {
  const byType: Record<string, { bytes: number; transferBytes: number; count: number }> = {};
  let totalBytes = 0;
  let totalTransferBytes = 0;

  for (const r of resources) {
    totalBytes += r.size;
    totalTransferBytes += r.transferSize;
    const bucket = byType[r.type] || (byType[r.type] = { bytes: 0, transferBytes: 0, count: 0 });
    bucket.bytes += r.size;
    bucket.transferBytes += r.transferSize;
    bucket.count += 1;
  }

  return {
    totalBytes,
    totalTransferBytes,
    totalRequests: resources.length,
    byType: Object.entries(byType)
      .map(([type, v]) => ({ type: type as ResourceType, bytes: v.bytes, transferBytes: v.transferBytes, count: v.count }))
      .sort((a, b) => b.bytes - a.bytes),
  };
}

/** Poll Chrome's DevTools HTTP endpoint until it responds, using Node's http module. */
function waitForChrome(port: number, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/json/version', timeout: 2000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error(`Chrome DevTools not ready on port ${port}`));
        else setTimeout(attempt, 300);
      });
      req.on('timeout', () => req.destroy());
    };
    attempt();
  });
}

/** Run a Lighthouse audit against a URL and normalize the result. Returns null on any failure. */
export async function runLighthouse(url: string, timeoutMs = 60000, deviceProfile?: string): Promise<LighthouseReport | null> {
  let chrome: Awaited<ReturnType<typeof chromeLauncher.launch>> | undefined;
  const isMobile = (deviceProfile || '').toLowerCase().includes('mobile');

  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: [
        '--headless',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--remote-debugging-address=127.0.0.1',
      ],
    });

    await waitForChrome(chrome.port);

    const result = await Promise.race([
      lighthouse(url, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        // Real network (no simulated 4G throttling). Select the form-factor preset so
        // mobile requests use Lighthouse's mobile emulation instead of always auditing
        // a desktop viewport; desktop keeps the previous non-emulated viewport.
        formFactor: isMobile ? 'mobile' : 'desktop',
        ...(isMobile ? {} : { screenEmulation: { disabled: true } }),
        throttlingMethod: 'provided',
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Lighthouse audit timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);

    const lhr = result.lhr;
    const resources = extractResources(lhr);
    return {
      performance: Math.round((lhr.categories.performance?.score ?? 0) * 100),
      accessibility: Math.round((lhr.categories.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((lhr.categories['best-practices']?.score ?? 0) * 100),
      seo: Math.round((lhr.categories.seo?.score ?? 0) * 100),
      fcp: Math.round(auditValue(lhr, 'first-contentful-paint')),
      lcp: Math.round(auditValue(lhr, 'largest-contentful-paint')),
      cls: Number(auditValue(lhr, 'cumulative-layout-shift').toFixed(3)),
      tbt: Math.round(auditValue(lhr, 'total-blocking-time')),
      speedIndex: Math.round(auditValue(lhr, 'speed-index')),
      resources,
      resourceSummary: summarizeResources(resources),
    };
  } catch (err) {
    console.warn('Lighthouse audit failed:', (err as Error)?.message || err);
    return null;
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
      } catch {
        // Chrome may already be closed; ignore.
      }
    }
  }
}
