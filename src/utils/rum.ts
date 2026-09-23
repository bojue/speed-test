/**
 * Real-User Monitoring (RUM) collector.
 *
 * The server-side probe can only observe network-layer timings (DNS / TCP / TLS / TTFB /
 * download). The browser's Resource Timing API additionally exposes the browser-side phases
 * (queueing / stalled / request sent). This collector captures the current page's navigation
 * and full resource waterfall and posts it to /api/beacon, so the two measurement paths
 * complement each other in a single beacon store.
 */

export interface RumResourceTiming {
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

export interface RumResourceEntry {
  url: string;
  filename: string;
  domain: string;
  type: 'html' | 'script' | 'stylesheet' | 'image' | 'font' | 'other';
  size: number;
  startTime: number;
  timings: RumResourceTiming;
}

const MAX_RESOURCES = 200;

const round2 = (n: number) => Math.round(n * 100) / 100;

function classifyResource(url: string, initiatorType: string): RumResourceEntry['type'] {
  const path = (url.split('?')[0] || '').toLowerCase();
  if (/\.(woff2?|ttf|otf|eot)$/.test(path)) return 'font';
  if (/\.css$/.test(path)) return 'stylesheet';
  if (/\.m?js$/.test(path)) return 'script';
  if (/\.(png|jpe?g|gif|webp|avif|svg|ico)$/.test(path)) return 'image';

  switch (initiatorType) {
    case 'script': return 'script';
    case 'link':
    case 'css': return 'stylesheet';
    case 'img':
    case 'image':
    case 'input': return 'image';
    default: return 'other';
  }
}

function splitUrl(url: string): { filename: string; domain: string } {
  try {
    const u = new URL(url);
    return { filename: u.pathname.split('/').pop() || url, domain: u.hostname };
  } catch {
    return { filename: url, domain: '' };
  }
}

function mapTiming(e: PerformanceResourceTiming): RumResourceTiming {
  const total = round2(e.duration > 0 ? e.duration : e.responseEnd - e.startTime);

  // Cross-origin resources without Timing-Allow-Origin only expose startTime/responseEnd;
  // the granular phases are zeroed, so only the total duration is meaningful.
  if (!e.responseStart || !e.requestStart) {
    return { queueing: 0, stalled: 0, dns: 0, connect: 0, ssl: 0, requestSent: 0, wait: 0, receive: 0, total };
  }

  const ssl = e.secureConnectionStart > 0 ? e.connectEnd - e.secureConnectionStart : 0;
  const requestBase = e.connectEnd > 0 ? e.connectEnd : e.domainLookupEnd;
  return {
    queueing: round2(Math.max(0, e.fetchStart - e.startTime)),
    stalled: round2(Math.max(0, (e.domainLookupStart > 0 ? e.domainLookupStart : e.fetchStart) - e.fetchStart)),
    dns: round2(Math.max(0, e.domainLookupEnd - e.domainLookupStart)),
    connect: round2(Math.max(0, e.connectEnd - e.connectStart)),
    ssl: round2(Math.max(0, ssl)),
    requestSent: round2(Math.max(0, e.requestStart - requestBase)),
    wait: round2(Math.max(0, e.responseStart - e.requestStart)),
    receive: round2(Math.max(0, e.responseEnd - e.responseStart)),
    total,
  };
}

function mapResource(e: PerformanceResourceTiming): RumResourceEntry {
  const { filename, domain } = splitUrl(e.name);
  return {
    url: e.name,
    filename,
    domain,
    type: classifyResource(e.name, e.initiatorType),
    size: e.transferSize || e.encodedBodySize || e.decodedBodySize || 0,
    startTime: round2(e.startTime),
    timings: mapTiming(e),
  };
}

function mapNavigation(e: PerformanceNavigationTiming): RumResourceEntry {
  const { filename, domain } = splitUrl(e.name || location.href);
  return {
    url: e.name || location.href,
    filename,
    domain,
    type: 'html',
    size: e.transferSize || e.encodedBodySize || e.decodedBodySize || 0,
    startTime: 0,
    timings: mapTiming(e),
  };
}

function collectEntries(): RumResourceEntry[] {
  const entries: RumResourceEntry[] = [];

  const nav = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (nav.length > 0) entries.push(mapNavigation(nav[0]));

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  for (const res of resources) {
    entries.push(mapResource(res));
    if (entries.length >= MAX_RESOURCES) break;
  }

  return entries;
}

interface RumVitals {
  ttfb?: number;
  fcp?: number;
  lcp?: number;
  cls?: number;
}

/** Capture the Core Web Vitals that are reliably observable from a page load. */
function collectVitals(): RumVitals {
  const vitals: RumVitals = {};

  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav && nav.responseStart > 0) {
    vitals.ttfb = round2(nav.responseStart);
  }

  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  if (fcp) vitals.fcp = round2(fcp.startTime);

  const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
  if (lcpEntries.length > 0) {
    vitals.lcp = round2(lcpEntries[lcpEntries.length - 1].startTime);
  }

  let cls = 0;
  const shifts = performance.getEntriesByType('layout-shift') as (PerformanceEntry & { value?: number; hadRecentInput?: boolean })[];
  for (const s of shifts) {
    if (!s.hadRecentInput && typeof s.value === 'number') cls += s.value;
  }
  vitals.cls = round2(cls);

  return vitals;
}

function buildPayload(entries: RumResourceEntry[]) {
  const conn = (navigator as unknown as { connection?: Record<string, unknown> }).connection;
  return {
    url: location.href,
    resourceCount: entries.length,
    resources: entries,
    vitals: collectVitals(),
    deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    connection: conn
      ? {
          effectiveType: conn.effectiveType,
          downlink: conn.downlink,
          rtt: conn.rtt,
          saveData: !!conn.saveData,
        }
      : undefined,
  };
}

function sendBeacon(payload: unknown) {
  const body = JSON.stringify(payload);
  const apiUrl = '/api/beacon';

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    try {
      navigator.sendBeacon(apiUrl, blob);
      return;
    } catch {
      // fall through to fetch
    }
  }

  fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

/** Collect the current page's real-user waterfall and post it to the beacon store. */
export function initRum() {
  const flush = () => {
    const entries = collectEntries();
    if (entries.length === 0) return;
    sendBeacon(buildPayload(entries));
  };

  if (document.readyState === 'complete') {
    flush();
  } else {
    window.addEventListener('load', flush, { once: true });
  }
}
