/**
 * Single-locale copy dictionary.
 *
 * The product ships in English only: UI copy lives here, and API responses
 * already return plain English strings.
 */
export const messages: Record<string, string> = {
  // Header
  'header.webmaster': 'Webmaster',
  'header.engineer': 'Engineer',

  // Hero
  'hero.title': 'Website Speed Test',
  'hero.subtitle': 'Enter a URL to test the page load time, analyze it, and find bottlenecks.',
  'hero.url': 'URL',
  'hero.testFrom': 'Test from',
  'hero.device': 'Device',
  'hero.deviceDesktop': 'Desktop',
  'hero.deviceMobile': 'Mobile',
  'hero.startTest': 'START TEST',
  'hero.testing': 'TESTING...',
  'hero.region.default': 'North China - Ulanqab',

  // Results Summary
  'results.yourResults': 'Your Results:',
  'results.perfGrade': 'Performance grade',
  'results.pageSize': 'Page size',
  'results.loadTime': 'Load time',
  'results.requests': 'Requests',
  'results.server': 'Server',
  'results.lighthouseTitle': 'Lighthouse Lab Scores',
  'results.lighthouseReal': 'Real Chrome (headless) run',
  'results.lighthouseEstimated': 'Server-side estimate (no browser)',
  'results.lhPerformance': 'Performance',
  'results.lhAccessibility': 'Accessibility',
  'results.lhBestPractices': 'Best Practices',
  'results.lhSeo': 'SEO',
  'results.lhSpeedIndex': 'Speed Index',
  'results.fasterThan': 'Faster than {pct}% of tested sites',
  'results.noMatchTitle': 'No requests match the current filters',
  'results.noMatchHint': 'Try a broader keyword, or switch to the “All” category.',
  'results.resetFilters': 'Reset filters',

  // Error handling (client side)
  'error.networkTitle': 'Network connection error',
  'error.networkMessage': 'The browser could not reach the speed test API. Please check your network connection.',
  'error.fallbackTitle': 'Test could not be completed',
  'error.fallbackMessage': 'The target site did not respond. It may be blocked by a firewall or currently offline.',
  'error.tipVerifyBrowser': 'Confirm the URL opens instantly in a normal browser.',
  'error.tipWaf': 'If the site uses a WAF challenge, allow-list the probe agent.',
  'error.tipSwitchNode': 'Try switching to another test node at the top and probe again.',
  'error.tipCheckNetwork': 'Check that your local network connection is working.',
  'error.tipRetry': 'Refresh the page and run the test again.',

  // Error state card
  'errorState.defaultTitle': 'Test run terminated',
  'errorState.defaultMessage': 'The probe node hit an unrecoverable error while contacting the target site.',
  'errorState.checklist': 'Troubleshooting checklist',
  'errorState.retry': 'Re-test this site',
  'errorState.sample': 'Test a sample site (Google)',
  'errorState.backToResults': 'Back to previous results',
  'errorState.node': 'Node',
  'errorState.targetUrl': 'Target URL',
  'errorState.httpStatus': 'HTTP status',
  'errorState.osCode': 'OS code',
  'errorState.tip1': 'Confirm the target URL loads instantly in a normal browser.',
  'errorState.tip2': 'Check the domain spelling and make sure the port is reachable.',
  'errorState.tip3': 'If the site uses a hardened firewall, allow-list the probe User-Agent.',
  'errorState.tip4': 'Try switching to another test node at the top and probe again.',
  'errorType.waf_blocked': 'WAF / bot challenge',
  'errorType.dns_failed': 'DNS resolution failed',
  'errorType.ssl_error': 'SSL handshake failed',
  'errorType.timeout': 'Connection timeout',
  'errorType.conn_refused': 'Connection refused',
  'errorType.intranet_ip': 'Private / intranet address',
  'errorType.http_error': 'HTTP {code} error',
  'errorType.probe_failed': 'Network probe error',

  // Engineer mode filter labels
  'tech.selectTypes': 'Select multiple types',
  'tech.selectAll': 'Select all',
  'tech.clear': 'Clear',
  'tech.allTypesLabel': 'All types (All)',
  'tech.selectedCount': 'Selected {count}',
  'tech.synthesizedFrom': 'Direct edge telemetry · synthesized from {region}',

  // Toasts
  'toast.invalidUrl': 'Please enter a valid URL starting with http:// or https://',
  'toast.testComplete': 'Test complete! Results generated.',
  'toast.testFailed': 'The test could not be completed. Troubleshooting suggestions are shown below.',
  'toast.testError': 'The test failed. Please check the diagnostics card.',
  'toast.harDownloaded': 'HAR file downloaded successfully',
  'toast.resultCopied': 'Result copied to clipboard!',
  'scoreCat.network': 'Network',
  'scoreCat.resource': 'Resources',
  'scoreCat.compression': 'Compression',
  'scoreCat.cache': 'Caching',
  'scoreCat.seo': 'SEO',
  'scoreCat.remaining': 'Points to improve',

  // Sections
  'section.improvePerf': 'Improve page performance',
  'section.contentSize': 'Content size by content type',
  'section.requestsByType': 'Requests by content type',
  'section.contentByDomain': 'Content size by domain',
  'section.requestsByDomain': 'Requests by domain',
  'section.fileRequests': 'File requests',
  'section.seo': 'SEO & Meta Audit',

  // Intro placeholder (shown before any test has run)
  'intro.slowTitle': 'Nobody Likes a Slow Website',
  'intro.slowP1': 'We built this Website Speed Test to help you analyze your website load speed.',
  'intro.slowP2': 'The test is designed to help make your site faster by identifying what about a webpage is fast, slow, too big, and so on.',
  'intro.slowP3': 'We have tried to make it useful both for experts and novices alike. In short, we wanted it to be an easy-to-use tool built to help webmasters and web developers everywhere optimize their website performance.',
  'intro.aboutTitle': 'About Website Speed Test',
  'intro.aboutP1': 'Each test starts a real page load from a server-side probe node, measuring DNS, TLS, TTFB, the full request waterfall, and the page HTML itself.',
  'intro.aboutP2': 'Every run reports page weight, request count, Core Web Vitals estimates, and an SEO readiness audit, so you can see which fix matters most.',
  'intro.aboutP3': 'Results are presented for experts and novices alike, and every number can be traced back to the request that produced it.',
  'intro.aboutP4': 'Your visitors will thank you.',
  'intro.seoTitle': 'SEO & Meta Audit',
  'intro.seoP1': 'Every test also grades search-engine readiness across 10 on-page factors, each reported with a PASS / WARN / FAIL verdict and an actionable fix.',
  'intro.seoCheck.crawlability': 'Crawlability & indexing (robots / noindex)',
  'intro.seoCheck.title': 'Title tag length & presence',
  'intro.seoCheck.description': 'Meta description',
  'intro.seoCheck.canonical': 'Canonical URL',
  'intro.seoCheck.viewport': 'Mobile viewport declaration',
  'intro.seoCheck.og': 'Open Graph / social share cards',
  'intro.seoCheck.h1': 'H1 heading structure',
  'intro.seoCheck.https': 'HTTPS & HSTS security',
  'intro.seoCheck.alt': 'Image alt text coverage',
  'intro.seoCheck.jsonld': 'Structured data (JSON-LD)',
  'intro.stateColorsTitle': 'State Colors',
  'intro.stateColorsHint': 'The following colors are used in the chart bars to indicate the different stages of a request.',
  'intro.state.dns': 'Web browser is looking up DNS information',
  'intro.state.ssl': 'Web browser is performing an SSL handshake',
  'intro.state.connect': 'Web browser is connecting to the server',
  'intro.state.send': 'Web browser is sending data to the server',
  'intro.state.wait': 'Web browser is waiting for data from the server',
  'intro.state.receive': 'Web browser is receiving data from the server',
  'intro.contentTypesTitle': 'Content Types',
  'intro.contentTypesHint': 'The following colors are used to indicate different content types.',
  'intro.type.html': 'HTML',
  'intro.type.script': 'JavaScript',
  'intro.type.stylesheet': 'CSS',
  'intro.type.image': 'Image',
  'intro.type.font': 'Font',
  'intro.type.other': 'Other',
  'intro.typeDesc.html': 'HTML document',
  'intro.typeDesc.script': 'JavaScript file',
  'intro.typeDesc.stylesheet': 'CSS file',
  'intro.typeDesc.image': 'Image file',
  'intro.typeDesc.font': 'Web font file',
  'intro.typeDesc.other': 'Any other content type',
  'intro.statusCodesTitle': 'Server Response Codes',
  'intro.statusCodesHint': 'To make it easy for you to differentiate between the HTTP response codes in the chart, we’ve added color-coded dots beside each URL.',
  'intro.status.ok': '2xx',
  'intro.status.error': '4xx / 5xx',
  'intro.statusDesc.ok': 'The server responded with a successful code',
  'intro.statusDesc.error': 'A client or server error occurred, for example a 404 page not found or a 500 internal server error',

  // Recommendations Table
  'table.grade': 'Grade',
  'table.suggestion': 'Suggestion',

  // File requests toolbar
  'toolbar.sortBy': 'Sort by:',
  'toolbar.sortOrder': 'File order',
  'toolbar.sortDuration': 'Load time',
  'toolbar.sortSize': 'File size',
  'toolbar.rising': 'Rising',
  'toolbar.type': 'Type:',
  'toolbar.filter': 'Filter',
  'toolbar.filterPlaceholder': 'URL, filename or domain...',
  'toolbar.allTypes': 'All Types',
  'toolbar.selectedCount': '{count} selected',
  'toolbar.multiSelect': 'Multi-select types',
  'toolbar.selectAll': 'Select all',
  'toolbar.clear': 'Clear',
  'toolbar.reset': 'Reset',
  'toolbar.exportHAR': 'Export HAR',
  'toolbar.share': 'Share',
  'toolbar.showingResults': 'Showing {shown} of {total} requests',

  // Timing Legend
  'legend.dns': 'DNS',
  'legend.ssl': 'SSL',
  'legend.connect': 'Connect',
  'legend.send': 'Send',
  'legend.wait': 'Wait',
  'legend.receive': 'Receive',

  // Engineer Mode
  'eng.overview': 'Diagnostic Overview',
  'eng.webVitals': 'Core Web Vitals & Real Experience',
  'eng.navTimings': 'Navigation Waterfall & Milestones',
  'eng.remoteIp': 'Remote IP',
  'eng.encoding': 'Content-Encoding',
  'eng.ttfb': 'Probe TTFB',
  'eng.diagnostics': 'High-Impact Performance Diagnostics',
  'eng.status': 'Status',
  'eng.protocol': 'Protocol',
  'eng.method': 'Method',
  'eng.time': 'Time',
  'eng.size': 'Size',
  'eng.waterfall': 'Waterfall (Timeline)',

  // Error
  'error.title': 'Test Failed',
  'error.retry': 'Retry Test',
  'error.testSample': 'Load Sample Results',
};

export function t(key: string, params?: Record<string, string | number>): string {
  let text = messages[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export function useI18n() {
  return { t };
}
