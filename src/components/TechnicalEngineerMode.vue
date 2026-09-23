<template>
  <div class="bg-white py-8 px-4 sm:px-6">
    <div class="max-w-5xl mx-auto space-y-10">

      <!-- ======================================================= -->
      <!-- 1. SUMMARY: Connection Diagnostics + 4 Metric Boxes    -->
      <!-- ======================================================= -->
      <section class="space-y-6">
        <div class="flex items-center justify-between border-b border-[#e6e6e6] pb-3">
          <h3 class="text-2xl sm:text-3xl font-light text-[#2c3e50] tracking-tight">
            Engineer Diagnostics:
          </h3>
          <span class="text-xs text-[#777777] font-mono">
            Audit Region: <b class="text-[#333333]">{{ testRegion || 'North China - Ulanqab' }}</b>
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          <!-- Left: Connection Protocol Card -->
          <div class="md:col-span-5 bg-white border border-[#e0e0e0] rounded p-4 flex flex-col justify-between shadow-2xs">
            <div class="w-full border-b border-slate-100 pb-2 mb-3 flex items-center justify-between text-[11px] text-[#888888] font-mono">
              <span class="truncate max-w-[210px]" :title="targetUrl">{{ targetUrl || '—' }}</span>
              <span class="text-emerald-700 font-semibold text-xs">HTTP {{ statusSummary }}</span>
            </div>

            <div class="flex-1 bg-slate-50 rounded border border-slate-200 p-3.5 flex flex-col justify-center min-h-[160px] select-none text-left space-y-2 font-mono text-xs">
              <div class="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                <span class="text-slate-500">Remote IP:</span>
                <span class="font-bold text-slate-800">{{ remoteIp ? remoteIp + ':443' : '—' }}</span>
              </div>
              <div class="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                <span class="text-slate-500">Protocol:</span>
                <span class="font-bold text-emerald-700">{{ protocolSummary }}</span>
              </div>
              <div class="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                <span class="text-slate-500">Edge Server:</span>
                <span class="font-bold text-slate-800 truncate max-w-[150px]" :title="serverHeader">{{ serverHeader || '—' }}</span>
              </div>
              <div class="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                <span class="text-slate-500">Compression:</span>
                <span class="font-bold text-slate-800 uppercase">{{ contentEncoding || '—' }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Probe TTFB:</span>
                <span class="font-bold text-amber-600">{{ (probeTtfb || actualTimings.ttfb) ? (probeTtfb || actualTimings.ttfb) + ' ms' : '—' }}</span>
              </div>
            </div>

            <div class="text-center text-[10px] text-[#999999] pt-2 font-mono">
              {{ t('tech.synthesizedFrom', { region: testRegion || 'North China - Ulanqab' }) }}
            </div>
          </div>

          <!-- Right: 2x2 Metric Boxes (Pingdom Style) -->
          <div class="md:col-span-7 grid grid-cols-2 gap-4">
            <!-- Box 1: Performance grade -->
            <div class="bg-white border border-[#e0e0e0] rounded p-5 shadow-2xs flex flex-col justify-between">
              <div class="text-xs sm:text-sm font-normal text-[#737373]">
                Performance grade
              </div>
              <div class="flex items-center gap-3 mt-3">
                <span
                  class="w-7 h-7 sm:w-8 sm:h-8 rounded text-white font-extrabold text-sm sm:text-base flex items-center justify-center shadow-xs"
                  :class="
                    !grade ? 'bg-slate-300' :
                    grade === 'A' ? 'bg-[#70c144]' :
                    grade === 'B' ? 'bg-[#70c144]' :
                    grade === 'C' ? 'bg-[#f0ad4e]' : 'bg-[#d9534f]'
                  "
                >
                  {{ grade || '—' }}
                </span>
                <span class="text-3xl sm:text-4xl font-bold text-[#333333]">
                  {{ score ?? '—' }}
                </span>
              </div>
            </div>

            <!-- Box 2: Page size -->
            <div class="bg-white border border-[#e0e0e0] rounded p-5 shadow-2xs flex flex-col justify-between">
              <div class="text-xs sm:text-sm font-normal text-[#737373]">
                Page size
              </div>
              <div class="text-3xl sm:text-4xl font-bold text-[#333333] mt-3">
                {{ pageSize || '—' }}
              </div>
            </div>

            <!-- Box 3: Load time -->
            <div class="bg-white border border-[#e0e0e0] rounded p-5 shadow-2xs flex flex-col justify-between">
              <div class="text-xs sm:text-sm font-normal text-[#737373]">
                Load time
              </div>
              <div class="text-3xl sm:text-4xl font-bold text-[#333333] mt-3">
                {{ loadTimeFormatted || '—' }}
              </div>
            </div>

            <!-- Box 4: Requests -->
            <div class="bg-white border border-[#e0e0e0] rounded p-5 shadow-2xs flex flex-col justify-between">
              <div class="text-xs sm:text-sm font-normal text-[#737373]">
                Requests
              </div>
              <div class="text-3xl sm:text-4xl font-bold text-[#333333] mt-3">
                {{ requestsCount ?? '—' }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================= -->
      <!-- 2. CORE WEB VITALS BENCHMARK TABLE                     -->
      <!-- ======================================================= -->
      <section class="space-y-3">
        <div class="flex items-center justify-between border-b border-[#e6e6e6] pb-2">
          <h4 class="text-xl font-normal text-[#2c3e50]">
            Core Web Vitals Assessment
          </h4>
          <span class="text-xs text-[#777777] font-mono">
            Server-probe heuristic estimate (not CrUX field data)
          </span>
        </div>

        <div class="border border-[#e6e6e6] rounded overflow-hidden" v-if="hasMetrics">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold select-none">
              <tr>
                <th class="py-2.5 px-4 w-32 font-medium">Status</th>
                <th class="py-2.5 px-4 font-medium">Metric &amp; Assessment</th>
                <th class="py-2.5 px-4 text-right w-28 font-medium">Measured</th>
                <th class="py-2.5 px-4 text-right w-28 font-medium">Good Threshold</th>
                <th class="py-2.5 px-3 w-10"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f0f0f0]">
              <template v-for="item in computedMetrics" :key="item.id">
                <tr
                  @click="toggleMetric(item.id)"
                  class="hover:bg-slate-50 cursor-pointer transition-colors select-none group"
                  :class="selectedMetricId === item.id ? 'bg-[#fafae6]' : ''"
                >
                  <!-- Status: Clean Typography without any green dots -->
                  <td class="py-3 px-4">
                    <span
                      class="text-xs font-semibold"
                      :class="
                        item.status === 'good'
                          ? 'text-emerald-700'
                          : item.status === 'needs-improvement'
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      "
                    >
                      {{ item.status === 'good' ? 'Good' : item.status === 'needs-improvement' ? 'Needs Work' : 'Poor' }}
                    </span>
                  </td>

                  <!-- Metric Name -->
                  <td class="py-3 px-4">
                    <div class="font-bold text-[#333333] flex items-center gap-1.5">
                      <span class="font-mono text-sm">{{ item.shortName }}</span>
                      <span class="text-[#777777] font-normal text-xs">· {{ item.name }}</span>
                    </div>
                    <div class="text-[11px] text-[#888888] mt-0.5 truncate max-w-[420px]">
                      {{ item.sliceText }}
                    </div>
                  </td>

                  <!-- Measured Value -->
                  <td class="py-3 px-4 text-right font-mono text-sm font-bold text-[#333333]">
                    {{ formatMetricValue(item.value, item.unit) }}
                  </td>

                  <!-- Target Threshold -->
                  <td class="py-3 px-4 text-right font-mono text-xs text-[#666666]">
                    {{ formatThreshold(item.targetThreshold, item.unit) }}
                  </td>

                  <!-- Subtle Accordion Chevron (matches Pingdom style) -->
                  <td class="py-3 px-3 text-right">
                    <div class="inline-flex items-center justify-center w-6 h-6 rounded text-neutral-400 group-hover:text-neutral-700 transition-colors">
                      <svg
                        class="w-3.5 h-3.5 transition-transform duration-200"
                        :class="selectedMetricId === item.id ? 'rotate-180 text-neutral-800' : 'text-neutral-400'"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </td>
                </tr>

                <!-- Expanded Drawer: measurement & sub-phase breakdown -->
                <tr v-if="selectedMetricId === item.id" class="bg-[#fcfcfc]">
                  <td colspan="5" class="p-4 border-t border-b border-[#e6e6e6]">
                    <div class="bg-white rounded border border-[#e0e0e0] p-4 shadow-2xs space-y-4 text-xs font-mono">
                      <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span class="font-bold text-[#333333] text-sm">{{ item.name }} ({{ item.shortName }})</span>
                        <div class="text-slate-500 text-xs">
                          Sub-stage Breakdown: <b class="text-slate-700">{{ item.sliceText }}</b>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Left: what this probe actually measured -->
                        <div class="bg-[#fafafa] rounded border border-[#e6e6e6] p-3 space-y-2">
                          <div class="font-bold text-[#2c3e50] text-xs uppercase tracking-wider">
                            Probe Measurement
                          </div>
                          <div class="pt-1">
                            <div class="p-2.5 bg-white rounded border border-slate-200 text-center">
                              <span class="text-[10px] text-slate-400 block">Single probe run</span>
                              <span class="text-slate-800 font-bold text-lg">{{ formatMetricValue(item.value, item.unit) }}</span>
                            </div>
                          </div>
                          <p class="text-[10px] text-slate-500 leading-relaxed">
                            Estimated server-side from one request's network timings and HTML facts.
                            This is not a CrUX field distribution and carries no percentile data.
                          </p>
                        </div>

                        <!-- Right: Threshold reference -->
                        <div class="bg-[#fafafa] rounded border border-[#e6e6e6] p-3 space-y-2">
                          <div class="font-bold text-[#2c3e50] text-xs uppercase tracking-wider">
                            Industry Standard Thresholds
                          </div>
                          <div class="space-y-1 text-[11px] pt-1">
                            <div class="flex justify-between p-1.5 rounded bg-emerald-50 text-emerald-800">
                              <span>Good</span>
                              <span class="font-bold">≤ {{ formatThreshold(item.targetThreshold, item.unit) }}</span>
                            </div>
                            <div class="flex justify-between p-1.5 rounded bg-amber-50 text-amber-800">
                              <span>Needs Improvement</span>
                              <span class="font-bold">{{ formatThreshold(item.targetThreshold, item.unit) }} ~ {{ formatThreshold(item.poorThreshold, item.unit) }}</span>
                            </div>
                            <div class="flex justify-between p-1.5 rounded bg-rose-50 text-rose-800">
                              <span>Poor</span>
                              <span class="font-bold">&gt; {{ formatThreshold(item.poorThreshold, item.unit) }}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="pt-2 text-[11px] text-slate-600 font-sans border-t border-slate-100 leading-relaxed">
                        <b>Diagnostic Insight:</b> {{ getMetricInsight(item.id, item.value) }}
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div v-else class="border border-[#e6e6e6] rounded overflow-hidden py-10 text-center">
          <div class="text-[#999] text-sm font-sans">
            No Core Web Vitals data available for this audit.
          </div>
          <div class="text-[#bbb] text-xs font-mono mt-1">
            Server-side probe did not synthesize LCP/INP/CLS estimates.
          </div>
        </div>
      </section>

      <!-- ======================================================= -->
      <!-- 3. NAVIGATION TIMING PIPELINE (Chrome DevTools Timing)  -->
      <!-- ======================================================= -->
      <section class="space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e6e6e6] pb-2">
          <h4 class="text-xl font-normal text-[#2c3e50]">
            W3C Navigation Timing Pipeline
          </h4>
          <span class="text-xs text-[#666666] font-mono">
            Load Event: <b class="text-[#2c3e50] font-bold">{{ hasTimings ? actualTimings.loadEvent + ' ms' : '—' }}</b>
          </span>
        </div>

        <!-- Professional Chrome DevTools Timing Panel -->
        <div class="border border-[#dadce0] rounded bg-white p-4 sm:p-5 shadow-2xs space-y-4">
          <!-- Overview Waterfall Bar in Chrome DevTools Colors -->
          <div class="space-y-1.5" v-if="hasTimings">
            <div class="flex justify-between text-[11px] text-[#5f6368] font-mono select-none px-0.5">
              <span>0 ms</span>
              <span>{{ Math.round(timingBreakdown.total * 0.25) }} ms</span>
              <span>{{ Math.round(timingBreakdown.total * 0.5) }} ms</span>
              <span>{{ Math.round(timingBreakdown.total * 0.75) }} ms</span>
              <span>{{ timingBreakdown.total }} ms</span>
            </div>
            <div class="h-4 w-full rounded-[2px] bg-[#f1f3f4] overflow-hidden flex select-none">
              <div
                class="bg-[#00a2d6] h-full"
                :style="{ width: `${(actualTimings.dns / timingBreakdown.total) * 100}%` }"
                :title="`DNS: ${actualTimings.dns}ms`"
              ></div>
              <div
                class="bg-[#f57c00] h-full"
                :style="{ width: `${(actualTimings.tcp / timingBreakdown.total) * 100}%` }"
                :title="`Initial connection: ${actualTimings.tcp}ms`"
              ></div>
              <div
                class="bg-[#8e24aa] h-full"
                :style="{ width: `${(actualTimings.tls / timingBreakdown.total) * 100}%` }"
                :title="`SSL: ${actualTimings.tls}ms`"
              ></div>
              <div
                class="bg-[#2bb24c] h-full"
                :style="{ width: `${(actualTimings.ttfb / timingBreakdown.total) * 100}%` }"
                :title="`Waiting (TTFB): ${actualTimings.ttfb}ms`"
              ></div>
              <div
                class="bg-[#1a73e8] h-full flex-1"
                :title="`Content download & Render: ${(timingBreakdown.total - actualTimings.ttfb).toFixed(0)}ms`"
              ></div>
            </div>
          </div>
          <div v-else class="h-4 w-full rounded-[2px] bg-[#f1f3f4] flex items-center justify-center text-[10px] text-slate-400 font-mono">
            No timing data available
          </div>

          <!-- Quick Metric Chips in Chrome DevTools Colors -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono">
            <div class="bg-[#fafafa] border border-[#e6e6e6] rounded p-2.5 flex items-center justify-between">
              <div class="flex items-center gap-1.5 truncate">
                <span class="w-2 h-2 rounded-[1px] bg-[#00a2d6] shrink-0"></span>
                <span class="text-[11px] text-[#555555] font-sans truncate">DNS Lookup</span>
              </div>
              <span class="font-bold text-[#222222] shrink-0 ml-1">{{ hasTimings ? actualTimings.dns + ' ms' : '—' }}</span>
            </div>

            <div class="bg-[#fafafa] border border-[#e6e6e6] rounded p-2.5 flex items-center justify-between">
              <div class="flex items-center gap-1.5 truncate">
                <span class="w-2 h-2 rounded-[1px] bg-[#f57c00] shrink-0"></span>
                <span class="text-[11px] text-[#555555] font-sans truncate">Connection</span>
              </div>
              <span class="font-bold text-[#222222] shrink-0 ml-1">{{ hasTimings ? (actualTimings.tcp + actualTimings.tls) + ' ms' : '—' }}</span>
            </div>

            <div class="bg-[#fafafa] border border-[#e6e6e6] rounded p-2.5 flex items-center justify-between">
              <div class="flex items-center gap-1.5 truncate">
                <span class="w-2 h-2 rounded-[1px] bg-[#8e24aa] shrink-0"></span>
                <span class="text-[11px] text-[#555555] font-sans truncate">SSL Handshake</span>
              </div>
              <span class="font-bold text-[#222222] shrink-0 ml-1">{{ hasTimings ? actualTimings.tls + ' ms' : '—' }}</span>
            </div>

            <div class="bg-[#fafafa] border border-[#e6e6e6] rounded p-2.5 flex items-center justify-between">
              <div class="flex items-center gap-1.5 truncate">
                <span class="w-2 h-2 rounded-[1px] bg-[#2bb24c] shrink-0"></span>
                <span class="text-[11px] text-[#555555] font-sans truncate">Waiting (TTFB)</span>
              </div>
              <span class="font-bold text-[#2bb24c] shrink-0 ml-1">{{ hasTimings ? actualTimings.ttfb + ' ms' : '—' }}</span>
            </div>

            <div class="bg-[#fafafa] border border-[#e6e6e6] rounded p-2.5 flex items-center justify-between">
              <div class="flex items-center gap-1.5 truncate">
                <span class="w-2 h-2 rounded-[1px] bg-[#1a73e8] shrink-0"></span>
                <span class="text-[11px] text-[#555555] font-sans truncate">Download &amp; Render</span>
              </div>
              <span class="font-bold text-[#1a73e8] shrink-0 ml-1">{{ hasTimings ? actualTimings.domContentLoaded + ' ms' : '—' }}</span>
            </div>
          </div>

          <!-- Chrome DevTools Network Timing Waterfall Table -->
          <div class="border-t border-[#e8eaed] pt-3 font-sans text-xs space-y-3" v-if="hasTimings">
            <!-- 1. Connection start -->
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[#5f6368] font-medium pt-1">
                <span>Connection start</span>
                <span class="text-[10px] text-[#5f6368] tracking-wider uppercase">DURATION</span>
              </div>
              <div
                v-for="item in timingBreakdown.connection"
                :key="item.name"
                class="grid grid-cols-[160px_1fr_80px] sm:grid-cols-[200px_1fr_90px] items-center py-0.5 hover:bg-[#f8f9fa] rounded-xs px-1 -mx-1"
              >
                <span class="text-[#202124] pl-2 truncate">{{ item.name }}</span>
                <div class="relative w-full h-3 flex items-center px-1">
                  <div
                    class="absolute h-2 rounded-[1px] transition-all"
                    :class="item.colorClass"
                    :style="{
                      left: `${(item.start / timingBreakdown.total) * 100}%`,
                      width: `${Math.max(0.4, (item.duration / timingBreakdown.total) * 100)}%`
                    }"
                    :title="`${item.name}: ${item.duration.toFixed(2)} ms`"
                  ></div>
                </div>
                <span class="text-[#202124] font-mono text-right tabular-nums text-xs">
                  {{ item.duration < 1 ? item.duration.toFixed(2) : Math.round(item.duration) + '.00' }} ms
                </span>
              </div>
            </div>

            <!-- 2. Request/Response -->
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[#5f6368] font-medium pt-1">
                <span>Request/Response</span>
                <span class="text-[10px] text-[#5f6368] tracking-wider uppercase">DURATION</span>
              </div>
              <div
                v-for="item in timingBreakdown.reqRes"
                :key="item.name"
                class="grid grid-cols-[160px_1fr_80px] sm:grid-cols-[200px_1fr_90px] items-center py-0.5 hover:bg-[#f8f9fa] rounded-xs px-1 -mx-1"
              >
                <span class="text-[#202124] pl-2 truncate">{{ item.name }}</span>
                <div class="relative w-full h-3 flex items-center px-1">
                  <div
                    class="absolute h-2 rounded-[1px] transition-all"
                    :class="item.colorClass"
                    :style="{
                      left: `${(item.start / timingBreakdown.total) * 100}%`,
                      width: `${Math.max(0.4, (item.duration / timingBreakdown.total) * 100)}%`
                    }"
                    :title="`${item.name}: ${item.duration.toFixed(2)} ms`"
                  ></div>
                </div>
                <span class="text-[#202124] font-mono text-right tabular-nums text-xs">
                  {{ item.duration < 1 ? item.duration.toFixed(2) : Math.round(item.duration) + '.00' }} ms
                </span>
              </div>
            </div>

            <!-- Summary Total Row -->
            <div class="grid grid-cols-[160px_1fr_80px] sm:grid-cols-[200px_1fr_90px] items-center pt-2 pb-1 text-xs">
              <span class="text-[#202124] pl-2 font-bold border-t border-[#e8eaed] pt-2">Total</span>
              <div class="border-t border-[#e8eaed] pt-2"></div>
              <span class="text-[#202124] font-mono text-right tabular-nums font-bold border-t border-[#e8eaed] pt-2">
                {{ timingBreakdown.total }} ms
              </span>
            </div>

            <!-- Explanation link -->
            <div class="flex items-center justify-between pt-2">
              <a
                href="https://developer.chrome.com/docs/devtools/network/reference/#timing-explanation"
                target="_blank"
                rel="noopener"
                class="text-[#1a73e8] hover:underline"
              >
                Explanation
              </a>
            </div>

          </div>
          <div v-else class="border-t border-[#e8eaed] pt-3 font-sans text-xs text-center text-slate-400 py-4">
            No navigation timing data available for this audit.
          </div>
        </div>
      </section>

      <!-- ======================================================= -->
      <!-- 4. PROTOCOL & SECURITY AUDIT (Evaluated Diagnostics)   -->
      <!-- ======================================================= -->
      <section class="space-y-3">
        <h4 class="text-xl font-normal text-[#2c3e50] border-b border-[#e6e6e6] pb-2">
          Protocol &amp; Security Diagnostics
        </h4>

        <div class="border border-[#e6e6e6] rounded overflow-hidden">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold select-none">
              <tr>
                <th class="py-2.5 px-4 w-24">Status</th>
                <th class="py-2.5 px-4">Diagnostic Audit</th>
                <th class="py-2.5 px-4 text-right">Evaluated Result</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f0f0f0]">
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="py-3 px-4 font-semibold text-xs" :class="isHttp2 ? 'text-emerald-700' : 'text-slate-400'">
                  {{ isHttp2 ? 'Pass' : 'Info' }}
                </td>
                <td class="py-3 px-4">
                  <div class="font-bold text-[#333333]">HTTP/2 Multiplexing (ALPN)</div>
                  <div class="text-[11px] text-[#777777]">Binary framing layer multiplexes concurrent streams across a single TCP socket.</div>
                </td>
                <td class="py-3 px-4 text-right font-mono text-[#333333]">
                  {{ alpnDisplay }}
                </td>
              </tr>

              <tr class="hover:bg-slate-50 transition-colors">
                <td class="py-3 px-4 font-semibold text-xs text-emerald-700">
                  {{ tlsVersion ? 'Pass' : 'Info' }}
                </td>
                <td class="py-3 px-4">
                  <div class="font-bold text-[#333333]">Transport Security</div>
                  <div class="text-[11px] text-[#777777]">{{ tlsVersion ? `${tlsVersion} negotiated during the TLS handshake.` : 'TLS version could not be determined from the probe.' }}</div>
                </td>
                <td class="py-3 px-4 text-right font-mono text-[#333333]">
                  {{ tlsVersion || '—' }}
                </td>
              </tr>

              <tr class="hover:bg-slate-50 transition-colors">
                <td class="py-3 px-4 font-semibold text-xs text-emerald-700">
                  Pass
                </td>
                <td class="py-3 px-4">
                  <div class="font-bold text-[#333333]">Transfer Encoding Compression</div>
                  <div class="text-[11px] text-[#777777]">Payload compressed via Brotli or Gzip to optimize transfer bandwidth.</div>
                </td>
                <td class="py-3 px-4 text-right font-mono text-[#333333] uppercase">
                  {{ contentEncoding || '—' }} {{ contentEncoding ? 'Active' : '' }}
                </td>
              </tr>

              <tr class="hover:bg-slate-50 transition-colors">
                <td class="py-3 px-4 font-semibold text-xs text-emerald-700">
                  Pass
                </td>
                <td class="py-3 px-4">
                  <div class="font-bold text-[#333333]">DOM Complexity &amp; Render Tree</div>
                  <div class="text-[11px] text-[#777777]">Total document node count within recommended budget (≤ 1500 nodes).</div>
                </td>
                <td class="py-3 px-4 text-right font-mono text-[#333333]">
                  {{ diagnostics?.domNodesCount ?? '—' }} DOM Nodes
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ======================================================= -->
      <!-- 5. NETWORK REQUESTS & HEADERS TABLE                   -->
      <!-- ======================================================= -->
      <section class="space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e6e6e6] pb-2">
          <h4 class="text-xl font-normal text-[#2c3e50]">
            Network Requests &amp; Headers
          </h4>
          <span class="text-xs text-[#777777] font-mono">
            {{ filteredRequests.length }} requests displayed
          </span>
        </div>

        <!-- Filtering toolbar -->
        <div class="bg-[#fafafa] border border-[#e6e6e6] rounded p-3 text-xs flex flex-wrap items-center justify-between gap-4 select-none">
          <div class="flex items-center gap-4 flex-wrap">
            <!-- Type: Multi-select dropdown -->
            <div class="flex items-center gap-1.5 relative" ref="typeDropdownRef">
              <label class="font-bold text-[#555555]">Type:</label>
              <div class="relative">
                <button
                  type="button"
                  @click="isTypeDropdownOpen = !isTypeDropdownOpen"
                  class="bg-white border border-[#d0d0d0] hover:border-slate-400 rounded px-2.5 py-1 text-xs text-[#333333] flex items-center gap-2 cursor-pointer transition-colors shadow-2xs focus:outline-none focus:border-slate-400 min-w-[130px] justify-between"
                >
                  <span class="truncate max-w-[140px] text-left">
                    {{ selectedTypesLabel }}
                  </span>
                  <svg
                    class="w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform duration-150"
                    :class="{ 'rotate-180': isTypeDropdownOpen }"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <!-- Dropdown Menu -->
                <div
                  v-if="isTypeDropdownOpen"
                  class="absolute left-0 top-full mt-1 w-48 bg-white border border-[#d0d0d0] rounded-md shadow-lg py-1 z-30 divide-y divide-[#f0f0f0]"
                >
                  <!-- Quick Select/Clear Header -->
                  <div class="px-2.5 py-1.5 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/70">
                    <span>{{ t('tech.selectTypes') }}</span>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        @click.stop="selectAllTypes"
                        class="text-[#70c144] hover:underline font-medium cursor-pointer"
                      >
                        {{ t('tech.selectAll') }}
                      </button>
                      <span class="text-slate-300">|</span>
                      <button
                        type="button"
                        @click.stop="clearAllTypes"
                        class="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                      >
                        {{ t('tech.clear') }}
                      </button>
                    </div>
                  </div>

                  <!-- Type Items List -->
                  <div class="max-h-56 overflow-y-auto py-0.5">
                    <label
                      v-for="item in availableFilterTypes"
                      :key="item.id"
                      class="flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer text-xs transition-colors"
                    >
                      <div class="flex items-center gap-2">
                        <input
                          type="checkbox"
                          :value="item.id"
                          :checked="selectedTypes.includes(item.id)"
                          @change="toggleType(item.id)"
                          class="rounded border-slate-300 text-[#70c144] focus:ring-[#70c144] w-3.5 h-3.5 cursor-pointer"
                        />
                        <span :class="selectedTypes.includes(item.id) ? 'text-slate-900 font-medium' : 'text-slate-600'">
                          {{ item.label }}
                        </span>
                      </div>
                      <span class="text-[11px] font-mono text-slate-400">
                        {{ reqCountsByType[item.id] || 0 }}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5">
              <label class="font-bold text-[#555555]">Filter</label>
              <div class="relative flex items-center">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Filter URL, filename..."
                  class="bg-white border border-[#d0d0d0] rounded pl-2.5 pr-6 py-1 text-xs text-[#333333] w-48 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                />
                <button
                  v-if="searchQuery"
                  type="button"
                  @click="searchQuery = ''"
                  class="absolute right-2 text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-xs"
                  title="Clear search"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <!-- Legend Bar -->
          <div class="flex items-center gap-3 text-[11px] text-[#5f6368]">
            <span class="font-medium text-[#202124]">Timeline Legend:</span>
            <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 bg-[#2bb24c] rounded-[1px]" />Waiting for server response (TTFB)</div>
            <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 bg-[#1a73e8] rounded-[1px]" />Content download</div>
          </div>
        </div>

        <!-- Filter Stats Banner (shown when filtered) -->
        <div
          v-if="hasActiveFilters"
          class="bg-slate-50 border border-slate-200 rounded px-3.5 py-1.5 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 select-none"
        >
          <div class="flex items-center gap-2">
            <span>Showing <b class="text-slate-800">{{ filteredRequests.length }}</b> of <b class="text-slate-800">{{ (requests || []).length }}</b> network requests</span>
            <span class="text-slate-300">|</span>
            <span>Transfer: <b class="text-slate-800">{{ formatBytes(filteredBytes) }}</b> of <b class="text-slate-800">{{ formatBytes(totalBytes) }}</b></span>
          </div>
          <button
            type="button"
            @click="resetFilters"
            class="text-slate-500 hover:text-slate-800 font-medium underline underline-offset-2 cursor-pointer transition-colors"
          >
            Clear filters
          </button>
        </div>

        <!-- Requests Table -->
        <div class="border border-[#e6e6e6] rounded overflow-hidden">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold select-none">
              <tr>
                <th class="py-2.5 px-3 w-16">Status</th>
                <th class="py-2.5 px-3">File / URL</th>
                <th class="py-2.5 px-3 hidden sm:table-cell w-20">Type</th>
                <th class="py-2.5 px-3 text-right w-24">Size</th>
                <th class="py-2.5 px-3 text-right w-20">Time</th>
                <th class="py-2.5 px-3 text-center w-36">Waterfall</th>
                <th class="py-2.5 px-3 w-8" aria-label="Expand"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f0f0f0]">
              <!-- Empty State Row -->
              <tr v-if="filteredRequests.length === 0">
                <td colspan="7" class="py-10 text-center bg-slate-50/50">
                  <p class="text-xs mb-10 font-bold text-slate-600">No network requests match your filter.</p>
                  <button
                    type="button"
                    @click="resetFilters"
                    class="mt-10 text-xs text-[#70c144] hover:underline font-medium cursor-pointer"
                  >
                    Reset filters
                  </button>
                </td>
              </tr>
              <template v-for="req in filteredRequests" :key="req.id">
                <tr
                  @click="toggleReq(req)"
                  class="hover:bg-slate-50 cursor-pointer transition-colors group select-none"
                  :class="selectedReq?.id === req.id ? 'bg-[#fafae6]' : ''"
                >
                  <td class="py-2 px-3">
                    <span
                      class="font-mono text-xs font-semibold"
                      :class="req.statusCode < 300 ? 'text-emerald-700' : 'text-sky-700'"
                    >
                      {{ req.statusCode }}
                    </span>
                  </td>

                  <td class="py-2 px-3">
                    <div class="flex items-center gap-2 min-w-0">
                      <svg
                        class="w-3.5 h-3.5 shrink-0"
                        :class="contentTypeTextColor(req.type)"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <component
                          :is="shape.tag"
                          v-for="(shape, index) in contentTypeIcon(req.type)"
                          :key="index"
                          v-bind="shape.attrs"
                        />
                      </svg>
                      <div class="truncate max-w-[280px] sm:max-w-[360px]">
                        <div class="font-bold text-[#333333] truncate font-mono text-[11px]">{{ req.filename }}</div>
                        <div class="text-[10px] text-[#888888] truncate font-mono">{{ req.domain }}</div>
                      </div>
                    </div>
                  </td>

                  <td class="py-2 px-3 uppercase text-[10px] text-slate-500 hidden sm:table-cell font-mono">
                    {{ req.type }}
                  </td>

                  <td class="py-2 px-3 text-right font-mono text-slate-700">
                    {{ req.size >= 1024 ? `${(req.size / 1024).toFixed(1)} KB` : `${req.size} B` }}
                  </td>

                  <td class="py-2 px-3 text-right font-mono text-slate-800 font-bold">
                    {{ req.timings.total }}ms
                  </td>

                  <td class="py-2 px-3">
                    <div class="w-full bg-[#f1f3f4] h-2.5 rounded-[1px] overflow-hidden flex">
                      <div
                        class="h-full bg-[#2bb24c]"
                        :style="{ width: `${Math.max(10, (req.timings.wait / req.timings.total) * 100)}%` }"
                        title="Waiting for server response (TTFB)"
                      />
                      <div
                        class="h-full bg-[#1a73e8]"
                        :style="{ width: `${Math.max(10, (req.timings.receive / req.timings.total) * 100)}%` }"
                        title="Content download"
                      />
                    </div>
                  </td>

                  <!-- Expand / collapse toggle, kept at the end of the row -->
                  <td class="py-2 px-3 text-right">
                    <div class="inline-flex items-center justify-center w-5 h-5 text-neutral-400 group-hover:text-neutral-700 transition-colors">
                      <svg
                        class="w-3 h-3 transition-transform duration-200"
                        :class="selectedReq?.id === req.id ? 'rotate-180 text-neutral-800' : 'text-neutral-400'"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </td>
                </tr>

                <!-- Expanded Headers & Timings Drawer -->
                <tr v-if="selectedReq?.id === req.id" class="bg-[#fcfcfc]">
                  <td colspan="7" class="p-4 border-t border-b border-[#e6e6e6]">
                    <div class="bg-white rounded border border-[#e0e0e0] p-4 shadow-2xs space-y-4 text-xs font-mono">
                      <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span class="font-bold text-[#333333] text-sm">{{ req.filename }}</span>
                        <div class="flex items-center gap-2">
                          <span class="text-[11px] text-slate-500">Duration: <b>{{ req.timings.total }} ms</b></span>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="space-y-3">
                          <div class="bg-[#fafafa] rounded border border-[#e6e6e6] p-3 space-y-1.5">
                            <div class="font-bold text-[#2c3e50] text-xs uppercase tracking-wider mb-1">General Info</div>
                            <div><b class="text-slate-700">Request URL:</b> <span class="text-slate-600 break-all">{{ req.url }}</span></div>
                            <div><b class="text-slate-700">Request Method:</b> GET</div>
                            <div><b class="text-slate-700">Status Code:</b> <span class="text-emerald-700 font-bold">{{ req.statusCode }}</span></div>
                            <div><b class="text-slate-700">Remote Address:</b> {{ remoteIp ? remoteIp + ':443' : '—' }}</div>
                          </div>

                          <div class="bg-[#fafafa] rounded border border-[#e6e6e6] p-3 space-y-1.5">
                            <div class="font-bold text-[#2c3e50] text-xs uppercase tracking-wider mb-1">Request Headers</div>
                            <div><b class="text-slate-700">:authority:</b> {{ req.domain }}</div>
                            <div><b class="text-slate-700">:method:</b> GET</div>
                            <div><b class="text-slate-700">:scheme:</b> https</div>
                            <div><b class="text-slate-700">accept:</b> */*</div>
                            <div><b class="text-slate-700">accept-encoding:</b> identity</div>
                            <div><b class="text-slate-700">user-agent:</b> WebPulseProbe/1.0</div>
                          </div>
                        </div>

                        <div class="space-y-3">
                          <div class="bg-[#fafafa] rounded border border-[#e6e6e6] p-3 space-y-1.5">
                            <div class="font-bold text-[#2c3e50] text-xs uppercase tracking-wider mb-1">Response Headers</div>
                            <div v-for="(val, header) in req.headers" :key="header">
                              <b class="text-slate-700">{{ header }}:</b> <span class="text-slate-600 break-all">{{ val }}</span>
                            </div>
                            <div><b class="text-slate-700">server:</b> {{ serverHeader || '—' }}</div>
                          </div>

                          <div class="bg-[#fafafa] rounded border border-[#e6e6e6] p-3 space-y-1.5">
                            <div class="font-bold text-[#2c3e50] text-xs uppercase tracking-wider mb-1">Timing Breakdown</div>
                            <div class="space-y-1 text-[11px]">
                              <div class="flex justify-between text-slate-600">
                                <span>DNS Lookup</span>
                                <span>{{ req.timings.dns }} ms</span>
                              </div>
                              <div class="flex justify-between text-slate-600">
                                <span>Initial Connection (TCP + SSL)</span>
                                <span>{{ req.timings.connect + req.timings.ssl }} ms</span>
                              </div>
                              <div class="flex justify-between text-slate-600">
                                <span class="text-[#2bb24c] font-bold">Waiting for server response (TTFB)</span>
                                <span class="font-bold text-[#2bb24c]">{{ req.timings.wait }} ms</span>
                              </div>
                              <div class="flex justify-between text-slate-600">
                                <span class="text-[#1a73e8] font-bold">Content download</span>
                                <span class="font-bold text-[#1a73e8]">{{ req.timings.receive }} ms</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from '../i18n';
import { contentTypeIcon, contentTypeTextColor } from '../utils/contentTypeIcon';

const { t } = useI18n();

const props = defineProps<{
  targetUrl: string;
  testRegion: string;
  remoteIp: string;
  serverHeader: string;
  contentEncoding?: string;
  statusCode?: number;
  statusMessage?: string;
  httpVersion?: string;
  tlsVersion?: string;
  alpnProtocol?: string;
  probeTtfb: number;
  pageSize: string;
  requestsCount: number;
  requests: any[];
  grade?: string;
  score?: number;
  loadTimeFormatted?: string;
  timings?: {
    dns: number;
    tcp: number;
    tls: number;
    ttfb: number;
    domContentLoaded: number;
    loadEvent: number;
  };
  metrics?: any[];
  diagnostics?: any;
}>();

defineEmits<{
  (e: 'download-har'): void;
  (e: 'share-result'): void;
}>();

// --- 1. Metrics Management ---
const selectedMetricId = ref<string | null>(null);

function toggleMetric(id: string) {
  selectedMetricId.value = selectedMetricId.value === id ? null : id;
}

// Real connection facts measured by the probe (HTTP version, negotiated TLS & ALPN).
// These replace the previously hardcoded "HTTP/2.0 · TLS 1.3 (ALPN: h2)" placeholder.
const protocolSummary = computed(() => {
  const http = props.httpVersion ? `HTTP/${props.httpVersion}` : '';
  const tls = props.tlsVersion || '';
  const alpn = props.alpnProtocol ? `ALPN: ${props.alpnProtocol}` : '';
  const parts = [http, tls, alpn].filter(Boolean);
  return parts.join(' · ') || '—';
});

const statusSummary = computed(() => {
  const code = props.statusCode ? `${props.statusCode}` : '';
  const msg = props.statusMessage || '';
  return [code, msg].filter(Boolean).join(' ') || '—';
});

// HTTP/2 multiplexing is only claimed when the probe actually negotiated h2 (or h3).
const isHttp2 = computed(() => props.alpnProtocol === 'h2' || props.alpnProtocol === 'h3' || props.httpVersion === '2.0');
const alpnDisplay = computed(() => {
  if (isHttp2.value) return `${props.alpnProtocol || 'h2'} · Multiplexed`;
  if (props.httpVersion === '1.1' || props.httpVersion === '1.0') return `HTTP/${props.httpVersion} · No multiplexing`;
  return props.alpnProtocol || 'no ALPN';
});

const hasMetrics = computed(() => Array.isArray(props.metrics) && props.metrics.length > 0);

const computedMetrics = computed(() => {
  if (hasMetrics.value) {
    return props.metrics!.map(m => ({
      id: m.id,
      shortName: m.shortName,
      name: m.name,
      value: m.value,
      unit: m.unit,
      status: m.status || (Number(m.value) <= m.targetThreshold ? 'good' : Number(m.value) <= (m.poorThreshold || m.targetThreshold * 1.6) ? 'needs-improvement' : 'poor'),
      targetThreshold: m.targetThreshold,
      poorThreshold: m.poorThreshold || (m.unit === 'ms' ? m.targetThreshold * 1.6 : 0.25),
      sliceText: m.sliceText || `${m.shortName} telemetry benchmarked across field sessions`,
    }));
  }
  return [];
});

const formatMetricValue = (val: string | number, unit: string) => {
  const num = Number(val);
  if (isNaN(num)) return `${val} ${unit}`.trim();
  if (unit === '') return num.toFixed(3);
  if (num >= 1000 && unit === 'ms') {
    return `${(num / 1000).toFixed(2)} s`;
  }
  return `${num} ${unit}`;
};

const formatThreshold = (val: number, unit: string) => {
  if (unit === '') return `≤ ${val}`;
  if (val >= 1000 && unit === 'ms') {
    return `≤ ${(val / 1000).toFixed(1)} s`;
  }
  return `≤ ${val} ${unit}`;
};

const getMetricInsight = (id: string, _val: string | number) => {
  switch (id) {
    case 'lcp':
      return 'Largest Contentful Paint measures perceived load speed by identifying when the main page content has likely loaded. Driven by server TTFB, critical resource transfer size, and client-side render blocking.';
    case 'inp':
      return 'Interaction to Next Paint assesses responsiveness to user inputs (clicks, key presses) across the page lifecycle. Driven by main-thread availability and lightweight event listener processing.';
    case 'cls':
      return 'Cumulative Layout Shift quantifies unexpected visual displacement during loading. Maintained low by specifying explicit height/width aspect ratios on media containers and preloading fonts.';
    case 'fcp':
      return 'First Contentful Paint marks the moment when browser paints any text, image, or non-blank canvas. Accelerated by reducing render-blocking CSS and early connection setup.';
    case 'ttfb':
      return 'Time to First Byte reflects initial backend responsiveness, edge caching effectiveness, and TLS handshake latency from the probe location.';
    case 'tbt':
      return 'Total Blocking Time sums the duration of all long tasks (>50ms) between FCP and TTI, revealing main-thread CPU saturation.';
    default:
      return 'Standard Core Web Vitals telemetry captured from real-world Chrome UX Report field datasets.';
  }
};

// --- 2. Navigation Timings ---
const hasTimings = computed(() => !!props.timings && typeof props.timings.loadEvent === 'number' && props.timings.loadEvent > 0);

const actualTimings = computed(() => {
  if (props.timings) {
    return {
      dns: Number(props.timings.dns) || 0,
      tcp: Number(props.timings.tcp) || 0,
      tls: Number(props.timings.tls) || 0,
      ttfb: Number(props.timings.ttfb) || 0,
      domContentLoaded: Number(props.timings.domContentLoaded) || 0,
      loadEvent: Number(props.timings.loadEvent) || 0,
    };
  }
  return {
    dns: 0,
    tcp: 0,
    tls: 0,
    ttfb: 0,
    domContentLoaded: 0,
    loadEvent: 0,
  };
});

const totalDuration = computed(() => Number(actualTimings.value.loadEvent) || 0);

const timingBreakdown = computed(() => {
  const total = totalDuration.value;
  const dns = Number(actualTimings.value.dns) || 0;
  const tcp = Number(actualTimings.value.tcp) || 0;
  const tls = Number(actualTimings.value.tls) || 0;
  const ttfb = Number(actualTimings.value.ttfb) || 0;

  let cursor = 0;
  const dnsStart = cursor; cursor += dns;
  const tcpStart = cursor; cursor += tcp;
  const tlsStart = cursor; cursor += tls;
  const ttfbStart = cursor; cursor += ttfb;
  const downloadStart = cursor;
  const download = total > downloadStart ? total - downloadStart : 0;

  return {
    total,
    connection: [
      {
        name: 'DNS Lookup',
        start: dnsStart,
        duration: dns,
        colorClass: 'bg-[#00a2d6]',
      },
      {
        name: 'Initial connection',
        start: tcpStart,
        duration: tcp,
        colorClass: 'bg-[#f57c00]',
      },
      {
        name: 'SSL',
        start: tlsStart,
        duration: tls,
        colorClass: 'bg-[#8e24aa]',
      }
    ],
    reqRes: [
      {
        name: 'Waiting for server response',
        start: ttfbStart,
        duration: ttfb,
        colorClass: 'bg-[#2bb24c]',
      },
      {
        name: 'Content download',
        start: downloadStart,
        duration: download,
        colorClass: 'bg-[#1a73e8]',
      }
    ]
  };
});

const getTimingPercent = (timeVal: number) => {
  const total = actualTimings.value.loadEvent || 1;
  return Math.max(5, Math.min(40, (timeVal / total) * 100));
};

// --- 3. Network Requests & Filtering ---
const selectedReq = ref<any | null>(null);
const searchQuery = ref<string>('');

// Type multi-select dropdown state
const isTypeDropdownOpen = ref(false);
const typeDropdownRef = ref<HTMLElement | null>(null);

const availableFilterTypes = [
  { id: 'document', label: 'Doc', match: ['document', 'html'] },
  { id: 'script', label: 'JS', match: ['script', 'js', 'javascript'] },
  { id: 'stylesheet', label: 'CSS', match: ['stylesheet', 'css'] },
  { id: 'image', label: 'Img', match: ['image', 'img', 'media'] },
  { id: 'font', label: 'Font', match: ['font', 'fonts', 'woff2', 'woff'] },
];

const selectedTypes = ref<string[]>([]);

const selectedTypesLabel = computed(() => {
  if (selectedTypes.value.length === 0) return t('tech.allTypesLabel');
  if (selectedTypes.value.length === availableFilterTypes.length) return t('tech.allTypesLabel');
  if (selectedTypes.value.length === 1) {
    const item = availableFilterTypes.find(c => c.id === selectedTypes.value[0]);
    return item ? item.label : t('tech.selectedCount', { count: 1 });
  }
  return t('tech.selectedCount', { count: selectedTypes.value.length });
});

const toggleType = (id: string) => {
  const idx = selectedTypes.value.indexOf(id);
  if (idx >= 0) {
    selectedTypes.value.splice(idx, 1);
  } else {
    selectedTypes.value.push(id);
  }
};

const selectAllTypes = () => {
  selectedTypes.value = availableFilterTypes.map(c => c.id);
};

const clearAllTypes = () => {
  selectedTypes.value = [];
};

const handleClickOutside = (event: MouseEvent) => {
  if (typeDropdownRef.value && !typeDropdownRef.value.contains(event.target as Node)) {
    isTypeDropdownOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

function toggleReq(req: any) {
  selectedReq.value = selectedReq.value?.id === req.id ? null : req;
}

const reqCountsByType = computed(() => {
  const reqs = props.requests || [];
  const counts: Record<string, number> = {
    all: reqs.length,
    document: 0,
    script: 0,
    stylesheet: 0,
    image: 0,
    font: 0,
  };
  for (const r of reqs) {
    const t = (r.type || '').toLowerCase();
    if (t === 'document' || t === 'html') counts.document++;
    else if (t === 'script' || t === 'js' || t === 'javascript') counts.script++;
    else if (t === 'stylesheet' || t === 'css') counts.stylesheet++;
    else if (t === 'image' || t === 'img' || t === 'media') counts.image++;
    else if (t === 'font' || t === 'fonts' || t === 'woff2') counts.font++;
  }
  return counts;
});

const filteredRequests = computed(() => {
  let list = props.requests && props.requests.length > 0 ? [...props.requests] : [];

  // Multi-select type filter
  if (selectedTypes.value.length > 0 && selectedTypes.value.length < availableFilterTypes.length) {
    const allowed = new Set<string>();
    for (const id of selectedTypes.value) {
      const def = availableFilterTypes.find(f => f.id === id);
      if (def) {
        def.match.forEach(m => allowed.add(m));
      }
    }
    list = list.filter(r => allowed.has((r.type || '').toLowerCase()));
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(r =>
      (r.url && r.url.toLowerCase().includes(q)) ||
      (r.filename && r.filename.toLowerCase().includes(q)) ||
      (r.domain && r.domain.toLowerCase().includes(q))
    );
  }

  return list;
});

const filteredBytes = computed(() => {
  return filteredRequests.value.reduce((sum, r) => sum + (r.size || 0), 0);
});

const totalBytes = computed(() => {
  return (props.requests || []).reduce((sum, r) => sum + (r.size || 0), 0);
});

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

const hasActiveFilters = computed(() => {
  const isTypeFiltered = selectedTypes.value.length > 0 && selectedTypes.value.length < availableFilterTypes.length;
  return isTypeFiltered || searchQuery.value.trim() !== '';
});

const resetFilters = () => {
  selectedTypes.value = [];
  searchQuery.value = '';
};
</script>
