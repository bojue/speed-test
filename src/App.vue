<template>
  <div class="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col selection:bg-[#f90] selection:text-white">
    <!-- 1. Pingdom Brand Header -->
    <PingdomHeader
      :view-mode="currentViewMode"
      @update:view-mode="currentViewMode = $event"
      @update:viewMode="currentViewMode = $event"
    />

    <!-- Spacer to offset the fixed header height -->
    <div class="h-[57px] shrink-0" aria-hidden="true" />

    <!-- 2. The Iconic Pingdom Warm Yellow Hero & Test Bar -->
    <PingdomHero
      v-model:targetUrl="targetUrl"
      v-model:region="testRegion"
      v-model:deviceProfile="deviceProfile"
      :is-loading="isLoading"
      @submit="startTest"
    />

    <!-- 3. Main Results Container (Faithful to User Screenshot & Professional Modes) -->
    <main class="flex-1">
      <!-- Error State View (when probe encounters WAF, DNS, Timeout, SSL, etc.) -->
      <div v-if="testError">
        <PingdomErrorState
          :error="testError"
          :target-url="targetUrl"
          :has-previous-results="hasPreviousResults"
          @retry="startTest"
          @test-sample="onTestSample"
          @dismiss="rawError = null"
        />
      </div>

      <!-- MODE 1: Webmaster (Pingdom Classic Style) -->
      <div v-else-if="hasResults && currentViewMode === 'webmaster'">
        <PingdomResults
          :target-url="currentUrl"
          :page-title="pageTitle"
          :server-header="pageServer"
          :grade="perfGrade"
          :score="perfScore"
          :page-size="pageSizeFormatted"
          :load-time-formatted="loadTimeFormatted"
          :requests-count="totalRequestsCount"
          :recommendations="performanceRecommendations"
          :content-type-analysis="pageAnalysis.byContentType"
          :domain-analysis="pageAnalysis.byDomain"
          :requests="rawRequests"
          :seo-audit="seoAudit"
          :status-code="statusCode"
          :status-message="statusMessage"
          :lighthouse-result="lighthouseResult"
          :metrics-source="metricsSource"
          @download-har="downloadHAR"
          @share-result="shareResult"
        />
      </div>

      <!-- MODE 2: Engineer (Network & Headers + Core Web Vitals) -->
      <div v-else-if="hasResults && currentViewMode === 'engineer'">
        <TechnicalEngineerMode
          :target-url="currentUrl"
          :test-region="testRegion"
          :remote-ip="remoteIp"
          :server-header="pageServer"
          :content-encoding="contentEncoding"
          :status-code="statusCode"
          :status-message="statusMessage"
          :http-version="httpVersion"
          :tls-version="tlsVersion"
          :alpn-protocol="alpnProtocol"
          :probe-ttfb="probeTtfb"
          :page-size="pageSizeFormatted"
          :requests-count="totalRequestsCount"
          :requests="rawRequests"
          :grade="perfGrade"
          :score="perfScore"
          :load-time-formatted="loadTimeFormatted"
          :timings="navTimings"
          :metrics="webVitalsMetrics"
          :diagnostics="pageDiagnostics"
          @download-har="downloadHAR"
          @share-result="shareResult"
        />
      </div>

      <!-- No test has run yet: show the intro copy instead of placeholder result data -->
      <PingdomIntro v-else />

      <!-- RUM dashboard (aggregate real-user field data, independent of any single test) -->
      <RumOverview />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useI18n } from './i18n';
import PingdomHeader, { type ViewMode } from './components/PingdomHeader.vue';
import PingdomHero from './components/PingdomHero.vue';
import PingdomIntro from './components/PingdomIntro.vue';
import PingdomResults from './components/PingdomResults.vue';
import TechnicalEngineerMode from './components/TechnicalEngineerMode.vue';
import PingdomErrorState from './components/PingdomErrorState.vue';
import RumOverview from './components/RumOverview.vue';

// --- View Mode State: 'webmaster' | 'engineer' ---
const currentViewMode = ref<ViewMode>('webmaster');

const { t } = useI18n();

// --- Form & Test State ---
const targetUrl = ref('');
const testRegion = ref('North China - Ulanqab');
const deviceProfile = ref('Desktop');
const isLoading = ref(false);
const hasPreviousResults = ref(false);
// Whether at least one real test has finished; nothing is rendered before that,
// so placeholder or demo data can never leak into the UI.
const hasResults = ref(false);

// Raw response of the latest probe. The API already returns English copy,
// so the stored value is rendered as-is.
const rawResult = ref<any | null>(null);
// Latest error payload, stored raw as well.
const rawError = ref<any | null>(null);

const currentUrl = computed(() => rawResult.value?.finalUrl || rawResult.value?.url || '');
const pageTitle = computed(() => rawResult.value?.title || '');
const pageServer = computed(() => rawResult.value?.serverHeader || '');
const remoteIp = computed(() => rawResult.value?.ip || '');
const statusCode = computed(() => rawResult.value?.statusCode || 0);
const statusMessage = computed(() => rawResult.value?.statusMessage || '');
const httpVersion = computed(() => rawResult.value?.connection?.httpVersion || rawResult.value?.httpVersion || '');
const tlsVersion = computed(() => rawResult.value?.connection?.tlsVersion || '');
const alpnProtocol = computed(() => rawResult.value?.connection?.alpnProtocol || '');
const probeTtfb = computed(() => rawResult.value?.timings?.ttfb ?? 0);
const contentEncoding = computed(() => rawResult.value?.contentEncoding || 'identity');

const perfGrade = computed(() => rawResult.value?.pageSummary?.performanceGrade || '');
const perfScore = computed(() => rawResult.value?.pageSummary?.score ?? 0);
const loadTimeMs = computed(() => rawResult.value?.pageSummary?.loadTimeMs ?? 0);
const pageSizeFormatted = computed(() => rawResult.value?.pageSummary?.pageSizeFormatted || '—');
const totalRequestsCount = computed(() => rawResult.value?.pageSummary?.requestsCount ?? 0);

// Real Lighthouse lab report (present when the server ran a headless Chrome audit)
const lighthouseResult = computed(() => rawResult.value?.lighthouse || null);
const metricsSource = computed(() => rawResult.value?.metricsSource || 'server-probe-heuristic');

const loadTimeFormatted = computed(() => {
  if (loadTimeMs.value >= 1000) {
    return `${(loadTimeMs.value / 1000).toFixed(2)} s`;
  }
  return `${loadTimeMs.value} ms`;
});

const navTimings = computed(() => {
  const timings = rawResult.value?.timings;
  return {
    dns: timings?.dns ?? 0,
    tcp: timings?.tcp ?? 0,
    tls: timings?.tls ?? 0,
    ttfb: timings?.ttfb ?? 0,
    domContentLoaded: timings?.domReady ?? 0,
    loadEvent: timings?.loadEvent ?? loadTimeMs.value,
  };
});

// Core Web Vitals metric cards (from API `metrics`)
const webVitalsMetrics = computed(() => {
  const metrics = rawResult.value?.metrics;
  return Array.isArray(metrics) ? metrics : [];
});

const pageDiagnostics = computed(() => rawResult.value?.diagnostics || {
  domNodesCount: 0,
  scriptsCount: 0,
  blockingScriptsCount: 0,
  stylesheetsCount: 0,
  imagesCount: 0,
  imagesMissingDimsCount: 0,
});

// Request waterfall list (from API `requests`)
const rawRequests = computed<any[]>(() => Array.isArray(rawResult.value?.requests) ? rawResult.value.requests : []);

// Page asset analysis (from API `pageAnalysis`)
const pageAnalysis = computed(() => rawResult.value?.pageAnalysis || { byContentType: [], byDomain: [] });

// Performance recommendations (from API `performanceRecommendations`)
const performanceRecommendations = computed(() => {
  const list = rawResult.value?.performanceRecommendations;
  if (!Array.isArray(list)) return [];
  return list.map((r: any) => ({
    rule: r.id || r.rule,
    name: r.rule,
    grade: r.grade,
    score: r.score,
    advice: r.advice,
  }));
});

// SEO audit (from API `seoAudit`)
const seoAudit = computed(() => rawResult.value?.seoAudit || null);

// Error payload; API errors and client-side fallbacks share the same shape.
const testError = computed(() => rawError.value);

// Include the API key when the deployment requires it (server-side API_KEY env).
const apiHeaders = (): Record<string, string> => {
  const key = (import.meta as any).env?.VITE_API_KEY;
  return key ? { 'x-api-key': key } : {};
};

// Start Test execution
const startTest = async () => {
  if (!targetUrl.value || !targetUrl.value.startsWith('http')) {
    Message.error(t('toast.invalidUrl'));
    return;
  }

  isLoading.value = true;
  rawError.value = null;

  try {
    const apiUrl = '/api/audit-url';
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...apiHeaders() },
      body: JSON.stringify({
        url: targetUrl.value,
        region: testRegion.value,
        deviceProfile: deviceProfile.value,
      }),
    });

    const data = await res.json();
    if (data.success) {
      rawError.value = null;
      hasPreviousResults.value = true;
      hasResults.value = true;
      // Store the raw response; the render layer reads it directly.
      rawResult.value = data;
      // A Lighthouse lab audit runs in the background; poll for it and merge when ready.
      if (data.lighthouseJobId) {
        pollLighthouse(data.lighthouseJobId);
      }
      Message.success(t('toast.testComplete'));
    } else {
      // Structured error presentation (the API returns ready-to-render copy)
      rawError.value = typeof data.error === 'object' && data.error ? data.error : {
        title: t('error.fallbackTitle'),
        message: data.error || t('error.fallbackMessage'),
        errorType: 'probe_failed',
        targetUrl: targetUrl.value,
        region: testRegion.value,
        troubleshootingTips: [
          t('error.tipVerifyBrowser'),
          t('error.tipWaf'),
          t('error.tipSwitchNode'),
        ],
      };
      Message.warning(t('toast.testFailed'));
    }
  } catch (err: any) {
    rawError.value = {
      title: t('error.networkTitle'),
      message: err.message || t('error.networkMessage'),
      errorType: 'network_error',
      targetUrl: targetUrl.value,
      region: testRegion.value,
      troubleshootingTips: [
        t('error.tipCheckNetwork'),
        t('error.tipRetry'),
      ],
    };
    Message.error(t('toast.testError'));
  } finally {
    isLoading.value = false;
  }
};

const onTestSample = (sampleUrl: string) => {
  targetUrl.value = sampleUrl;
  startTest();
};

// Poll a background Lighthouse job and merge its lab result into the current result.
const pollLighthouse = (jobId: string) => {
  let attempts = 0;
  const poll = async () => {
    if (attempts++ > 40) return; // give up after ~60s
    try {
      const res = await fetch(`/api/lighthouse/${jobId}`, { headers: { ...apiHeaders() } });
      const data = await res.json();
      if (data.status === 'done' && data.report) {
        applyLighthouse(data.report);
        return;
      }
      if (data.status === 'failed') return;
    } catch {
      return; // stop polling on error
    }
    setTimeout(poll, 1500);
  };
  poll();
};

const applyLighthouse = (report: any) => {
  const r = rawResult.value;
  if (!r || !report) return;

  const gradeFor = (score: number) =>
    score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  const labelForType = (type: string) =>
    type === 'html' ? 'HTML' : type === 'script' ? 'JavaScript' : type === 'stylesheet' ? 'CSS' : type === 'image' ? 'Image' : type === 'font' ? 'Font' : 'Other';

  r.lighthouse = {
    performance: report.performance,
    accessibility: report.accessibility,
    bestPractices: report.bestPractices,
    seo: report.seo,
    speedIndex: report.speedIndex,
  };
  r.metricsSource = 'lighthouse-lab';
  r.metricsEstimated = false;
  r.score = report.performance;
  r.performanceGrade = gradeFor(report.performance);
  if (r.pageSummary) {
    r.pageSummary.score = report.performance;
    r.pageSummary.performanceGrade = gradeFor(report.performance);
  }

  // Replace the server-side estimates for the metrics Lighthouse actually measures.
  const overrides: Record<string, number> = {
    lcp: report.lcp,
    fcp: report.fcp,
    cls: report.cls,
    tbt: report.tbt,
  };
  if (Array.isArray(r.metrics)) {
    for (const m of r.metrics) {
      const value = overrides[m.id];
      if (typeof value !== 'number') continue;
      m.value = String(value);
      m.percent = Math.min(100, Math.round((value / m.targetThreshold) * 100));
      m.status = value <= m.targetThreshold ? 'good' : value <= m.poorThreshold ? 'needs-improvement' : 'poor';
    }
  }

  // B6 subset 1: replace the server-side (regex-discovered, quota-truncated) page size and
  // content-type breakdown with Lighthouse's complete resource summary.
  if (report.resourceSummary && report.resourceSummary.totalRequests > 0) {
    const rs = report.resourceSummary;
    if (r.pageSummary) {
      r.pageSummary.pageSizeBytes = rs.totalBytes;
      r.pageSummary.pageSizeFormatted = (rs.totalBytes / 1024).toFixed(1) + ' KB';
      r.pageSummary.requestsCount = rs.totalRequests;
    }
    if (r.pageAnalysis) {
      r.pageAnalysis.byContentType = rs.byType.map((t: any) => ({
        type: t.type,
        label: labelForType(t.type),
        bytes: t.bytes,
        count: t.count,
        sizePercent: rs.totalBytes ? Number(((t.bytes / rs.totalBytes) * 100).toFixed(1)) : 0,
        countPercent: rs.totalRequests ? Number(((t.count / rs.totalRequests) * 100).toFixed(1)) : 0,
      }));
    }
  }

  // B6 subset 2: replace the waterfall with Lighthouse's complete browser-observed list and
  // recompute the domain breakdown and load time. Phase-level timings (DNS/connect/SSL/wait/
  // receive) are not available from the browser, so the total duration is reported as "wait".
  if (Array.isArray(report.resources) && report.resources.length > 0) {
    const reqs = report.resources.map((res: any, i: number) => ({
      id: 'req-' + i,
      url: res.url,
      filename: res.filename,
      domain: res.domain,
      path: res.path,
      type: res.type,
      size: res.size,
      statusCode: res.statusCode,
      mimeType: res.mimeType,
      startTime: res.startTime,
      timings: { dns: 0, connect: 0, ssl: 0, wait: res.total, receive: 0, total: res.total },
      headers: { 'content-type': res.mimeType || 'application/octet-stream' },
    }));
    r.requests = reqs;

    const domainMap: Record<string, { bytes: number; count: number }> = {};
    let totalBytes = 0;
    for (const x of reqs) {
      totalBytes += x.size;
      const d = domainMap[x.domain] || (domainMap[x.domain] = { bytes: 0, count: 0 });
      d.bytes += x.size;
      d.count += 1;
    }
    const totalCount = reqs.length;
    if (r.pageAnalysis) {
      r.pageAnalysis.byDomain = Object.entries(domainMap)
        .map(([domain, d]) => {
          const sizePercent = totalBytes ? Number(((d.bytes / totalBytes) * 100).toFixed(1)) : 0;
          return {
            domain,
            bytes: d.bytes,
            count: d.count,
            percent: sizePercent,
            sizePercent,
            countPercent: totalCount ? Number(((d.count / totalCount) * 100).toFixed(1)) : 0,
          };
        })
        .sort((a, b) => b.bytes - a.bytes);
    }

    const loadTime = reqs.reduce((m, x) => Math.max(m, x.startTime + x.timings.total), 0);
    if (r.pageSummary) {
      r.pageSummary.loadTimeMs = loadTime;
    }
  }
};

// Download HAR
const downloadHAR = () => {
  const har = {
    log: {
      version: '1.2',
      creator: { name: 'Website Speed Test', version: '1.0' },
      browser: { name: 'WebPulse Server Probe', version: '1.0' },
      pages: [
        {
          startedDateTime: new Date().toISOString(),
          id: 'page_1',
          title: pageTitle.value,
          pageTimings: {
            onContentLoad: Math.round(navTimings.value.domContentLoaded),
            onLoad: Math.round(navTimings.value.loadEvent),
          },
        },
      ],
      entries: rawRequests.value.map(r => ({
        pageref: 'page_1',
        startedDateTime: new Date().toISOString(),
        time: r.timings.total,
        request: {
          method: 'GET',
          url: r.url,
          httpVersion: httpVersion.value ? `HTTP/${httpVersion.value}` : 'HTTP/1.1',
          headers: [{ name: 'User-Agent', value: 'WebPulse Server Probe' }],
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: 0,
        },
        response: {
          status: r.statusCode,
          statusText: statusMessage.value || 'OK',
          httpVersion: httpVersion.value ? `HTTP/${httpVersion.value}` : 'HTTP/1.1',
          headers: Object.entries(r.headers).map(([k, v]) => ({ name: k, value: String(v) })),
          content: { size: r.size, mimeType: r.headers['content-type'] || 'text/plain' },
          redirectURL: '',
          headersSize: -1,
          bodySize: r.size,
        },
        cache: {},
        timings: {
          dns: r.timings.dns,
          connect: r.timings.connect,
          ssl: r.timings.ssl,
          send: 0,
          wait: r.timings.wait,
          receive: r.timings.receive,
        },
      })),
    },
  };

  const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `speedtest-${new URL(currentUrl.value).hostname}-${Date.now()}.har`;
  a.click();
  URL.revokeObjectURL(url);
  Message.success(t('toast.harDownloaded'));
};

// Share Result
const shareResult = () => {
  const shareText = `[Website Speed Test Result]\nURL: ${currentUrl.value}\nPerformance grade: ${perfGrade.value} ${perfScore.value}\nPage size: ${pageSizeFormatted.value}\nLoad time: ${loadTimeFormatted.value}\nRequests: ${totalRequestsCount.value}`;
  navigator.clipboard.writeText(shareText);
  Message.success(t('toast.resultCopied'));
};
</script>
