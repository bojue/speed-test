<template>
  <div class="bg-white py-8 px-4 sm:px-6">
    <div class="max-w-5xl mx-auto space-y-10">

      <!-- ======================================================= -->
      <!-- 1. APP-SUMMARY (Your Results: + 4 Metric Cards)        -->
      <!-- ======================================================= -->
      <section class="space-y-6">
        <!-- Results Header: Title -->
        <div class="flex items-center justify-between border-b border-[#e6e6e6] pb-4">
          <h3 class="text-2xl sm:text-3xl font-light text-[#2c3e50] tracking-tight">
            {{ t('results.yourResults') }}
          </h3>
        </div>

        <!-- Summary Player: Left Score Ring Chart (50%) + Right 2x2 Metric Grid (50%) -->
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
          <!-- Left: Score Composition Ring Chart (col-2 / 50%) -->
          <div class="lg:col-span-2 bg-white border border-[#e0e0e0] rounded p-4 flex flex-col justify-between shadow-2xs">
            <div class="w-full border-b border-slate-100 pb-2 mb-3 flex items-center justify-between text-[11px] text-[#888888] font-mono">
              <span class="truncate max-w-[240px]">{{ targetUrl }}</span>
              <span class="text-emerald-700 font-semibold text-xs">HTTP {{ statusCode || '' }}{{ statusMessage ? ' ' + statusMessage : '' }}</span>
            </div>

            <!-- Score Composition Donut + Legend -->
            <div class="flex-1 flex items-center justify-center gap-6 min-h-[170px] select-none">
              <div class="relative w-[150px] h-[150px] shrink-0">
                <svg class="w-full h-full -rotate-90" viewBox="0 0 128 128">
                  <circle cx="64" cy="64" :r="donutRadius" fill="none" stroke="#f1f3f4" stroke-width="11" />
                  <circle
                    v-for="seg in donutSegments"
                    :key="seg.id"
                    cx="64"
                    cy="64"
                    :r="donutRadius"
                    fill="none"
                    :stroke="seg.color"
                    stroke-width="11"
                    :stroke-dasharray="seg.dash"
                    :stroke-dashoffset="seg.offset"
                  />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span class="text-2xl font-bold text-[#333333] leading-none">{{ score }}</span>
                  <span class="mt-1 text-[10px] text-[#999999] font-mono">{{ t('results.perfGrade') }}</span>
                </div>
              </div>

              <!-- Legend: per-dimension score + remaining points (numbers colored by score band) -->
              <div class="min-w-0 max-w-[220px] space-y-2">
                <div
                  v-for="seg in donutSegments"
                  :key="seg.id"
                  class="flex items-center gap-2 text-xs"
                >
                  <span class="w-2.5 h-2.5 rounded-xs shrink-0" :style="{ backgroundColor: seg.color }" />
                  <span class="truncate" :class="seg.id === 'remaining' ? 'text-[#d9534f]' : 'text-[#555555]'">
                    {{ seg.label }}
                  </span>
                  <span class="ml-auto font-mono font-semibold" :style="{ color: scoreBandColor(seg.score) }">
                    {{ seg.display }}
                  </span>
                </div>
              </div>
            </div>

            <div class="text-center text-[10px] text-[#999999] pt-2 font-mono">
              {{ t('results.server') }}: {{ serverHeader || 'nginx' }}
            </div>
          </div>

          <!-- Right: 2x2 Metric Boxes (col-2 / 50%) -->
          <div class="lg:col-span-2 grid grid-cols-2 gap-4">
            <!-- Box 1: Performance grade -->
            <div class="bg-white border border-[#e0e0e0] rounded p-5 shadow-2xs flex flex-col justify-between">
              <div class="text-xs sm:text-sm font-normal text-[#737373]">
                {{ t('results.perfGrade') }}
              </div>
              <div class="flex items-center gap-3 mt-3">
                <span
                  class="w-7 h-7 sm:w-8 sm:h-8 rounded text-white font-extrabold text-sm sm:text-base flex items-center justify-center shadow-xs"
                  :class="
                    grade === 'A' ? 'bg-[#70c144]' :
                    grade === 'B' ? 'bg-[#70c144]' :
                    grade === 'C' ? 'bg-[#f0ad4e]' : 'bg-[#d9534f]'
                  "
                >
                  {{ grade }}
                </span>
                <span class="text-3xl sm:text-4xl font-bold text-[#333333]">
                  {{ score }}
                </span>
              </div>
            </div>

            <!-- Box 2: Page size -->
            <div class="bg-white border border-[#e0e0e0] rounded p-5 shadow-2xs flex flex-col justify-between">
              <div class="text-xs sm:text-sm font-normal text-[#737373]">
                {{ t('results.pageSize') }}
              </div>
              <div class="text-3xl sm:text-4xl font-bold text-[#333333] mt-3">
                {{ pageSize }}
              </div>
            </div>

            <!-- Box 3: Load time -->
            <div class="bg-white border border-[#e0e0e0] rounded p-5 shadow-2xs flex flex-col justify-between">
              <div class="text-xs sm:text-sm font-normal text-[#737373]">
                {{ t('results.loadTime') }}
              </div>
              <div class="text-3xl sm:text-4xl font-bold text-[#333333] mt-3">
                {{ loadTimeFormatted }}
              </div>
            </div>

            <!-- Box 4: Requests -->
            <div class="bg-white border border-[#e0e0e0] rounded p-5 shadow-2xs flex flex-col justify-between">
              <div class="text-xs sm:text-sm font-normal text-[#737373]">
                {{ t('results.requests') }}
              </div>
              <div class="text-3xl sm:text-4xl font-bold text-[#333333] mt-3">
                {{ requestsCount }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================= -->
      <!-- 1.5. APP-LIGHTHOUSE (Real Chrome lab scores)           -->
      <!-- ======================================================= -->
      <section class="space-y-3" v-if="lighthouseResult">
        <div class="flex items-center justify-between border-b border-[#e6e6e6] pb-2">
          <h4 class="text-xl font-normal text-[#2c3e50]">
            {{ t('results.lighthouseTitle') }}
          </h4>
          <span class="text-xs font-mono text-emerald-700">
            {{ metricsSource === 'lighthouse-lab' ? t('results.lighthouseReal') : t('results.lighthouseEstimated') }}
          </span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div class="bg-white border border-[#e0e0e0] rounded p-4 shadow-2xs text-center">
            <div class="text-xs text-[#737373]">{{ t('results.lhPerformance') }}</div>
            <div class="mt-2 text-2xl font-bold" :style="{ color: scoreBandColor(lighthouseResult.performance) }">{{ lighthouseResult.performance }}</div>
          </div>
          <div class="bg-white border border-[#e0e0e0] rounded p-4 shadow-2xs text-center">
            <div class="text-xs text-[#737373]">{{ t('results.lhAccessibility') }}</div>
            <div class="mt-2 text-2xl font-bold" :style="{ color: scoreBandColor(lighthouseResult.accessibility) }">{{ lighthouseResult.accessibility }}</div>
          </div>
          <div class="bg-white border border-[#e0e0e0] rounded p-4 shadow-2xs text-center">
            <div class="text-xs text-[#737373]">{{ t('results.lhBestPractices') }}</div>
            <div class="mt-2 text-2xl font-bold" :style="{ color: scoreBandColor(lighthouseResult.bestPractices) }">{{ lighthouseResult.bestPractices }}</div>
          </div>
          <div class="bg-white border border-[#e0e0e0] rounded p-4 shadow-2xs text-center">
            <div class="text-xs text-[#737373]">{{ t('results.lhSeo') }}</div>
            <div class="mt-2 text-2xl font-bold" :style="{ color: scoreBandColor(lighthouseResult.seo) }">{{ lighthouseResult.seo }}</div>
          </div>
          <div class="bg-white border border-[#e0e0e0] rounded p-4 shadow-2xs text-center">
            <div class="text-xs text-[#737373]">{{ t('results.lhSpeedIndex') }}</div>
            <div class="mt-2 text-2xl font-bold text-[#333333]">{{ formatSpeedIndex(lighthouseResult.speedIndex) }}</div>
          </div>
        </div>
      </section>

      <!-- ======================================================= -->
      <!-- 2. APP-PERFORMANCE (Improve page performance)          -->
      <!-- ======================================================= -->
      <section class="space-y-3">
        <h4 class="text-xl font-normal text-[#2c3e50] border-b border-[#e6e6e6] pb-2">
          {{ t('section.improvePerf') }}
        </h4>

        <div class="border border-[#e6e6e6] rounded overflow-hidden">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold">
              <tr>
                <th class="py-2.5 px-4 w-28">{{ t('table.grade') }}</th>
                <th class="py-2.5 px-4">{{ t('table.suggestion') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f0f0f0]">
              <template v-for="item in recommendations" :key="item.rule">
                <tr
                  @click="toggleRec(item.rule)"
                  class="hover:bg-slate-50 cursor-pointer transition-colors select-none"
                >
                  <td class="py-3 px-4 flex items-center gap-2">
                    <span
                      class="w-5 h-5 rounded text-white font-bold text-xs flex items-center justify-center shrink-0"
                      :class="
                        item.grade === 'A' ? 'bg-[#70c144]' :
                        item.grade === 'B' ? 'bg-[#70c144]' :
                        item.grade === 'C' ? 'bg-[#f0ad4e]' : 'bg-[#d9534f]'
                      "
                    >
                      {{ item.grade }}
                    </span>
                    <span class="font-bold text-[#444444]">{{ item.score }}</span>
                  </td>
                  <td class="py-3 px-4">
                    <div class="flex items-center justify-between">
                      <span class="font-medium text-[#333333]">{{ item.name }}</span>
                      <svg
                        class="w-3.5 h-3.5 text-neutral-400 transition-transform duration-200"
                        :class="expandedRecs.has(item.rule) ? 'rotate-180' : ''"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </td>
                </tr>

                <!-- Expandable Row -->
                <tr v-if="expandedRecs.has(item.rule)" class="bg-[#fcfcfc]">
                  <td colspan="2" class="p-4 text-xs text-[#555555] leading-relaxed border-t border-[#f0f0f0]">
                    <div class="p-3 bg-white rounded border border-[#e6e6e6] space-y-1.5">
                      <p class="text-neutral-700 leading-relaxed">{{ item.advice }}</p>
                      <p v-if="item.savings" class="text-emerald-700 font-semibold text-[11px] pt-1 border-t border-slate-100">
                        Estimated savings: {{ item.savings }}
                      </p>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ======================================================= -->
      <!-- 2.5. APP-SEO (SEO & Search Readiness - Webmaster)      -->
      <!-- ======================================================= -->
      <section class="space-y-3">
        <div class="border-b border-[#e6e6e6] pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <h4 class="text-xl font-normal text-[#2c3e50]">
              SEO &amp; search readiness
            </h4>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-neutral-500 text-[11px] hidden md:inline font-mono">
              {{ activeSeo.passedCount }} passed, {{ activeSeo.warnCount }} warnings, {{ activeSeo.failCount }} failed
            </span>
            <span v-if="activeSeo.infoCount" class="text-neutral-400 text-[11px] hidden md:inline font-mono">
              {{ activeSeo.infoCount }} unconfirmed
            </span>
          </div>
        </div>

        <!-- SEO Filter toolbar -->
        <div class="flex flex-wrap items-center justify-between gap-3 bg-[#fafafa] border border-[#e6e6e6] rounded p-2 text-xs select-none">
          <div class="flex items-center gap-1 flex-wrap">
            <button
              v-for="tab in seoTabs"
              :key="tab.id"
              @click="activeSeoTab = tab.id"
              class="px-2.5 py-1 rounded text-xs transition-colors cursor-pointer"
              :class="activeSeoTab === tab.id ? 'bg-[#2c3e50] text-white font-medium shadow-2xs' : 'text-neutral-600 hover:bg-slate-200'"
            >
              {{ tab.label }} <span class="opacity-75">({{ getSeoCountByTab(tab.id) }})</span>
            </button>
          </div>

          <div class="text-[11px] text-neutral-500 flex items-center gap-3 font-mono">
            <span class="text-emerald-700 font-semibold">{{ activeSeo.passedCount }} PASS</span>
            <span class="text-amber-700 font-semibold">{{ activeSeo.warnCount }} WARN</span>
            <span v-if="activeSeo.infoCount" class="text-neutral-500 font-semibold">{{ activeSeo.infoCount }} INFO</span>
            <span v-if="activeSeo.failCount > 0" class="text-rose-700 font-semibold">{{ activeSeo.failCount }} FAIL</span>
          </div>
        </div>

        <!-- SEO Audit Table -->
        <div class="border border-[#e6e6e6] rounded overflow-hidden">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold">
              <tr>
                <th class="py-2.5 px-4 w-28">Status</th>
                <th class="py-2.5 px-4 w-2/5">Diagnostic Item</th>
                <th class="py-2.5 px-4">Audited Value</th>
                <th class="py-2.5 px-4 text-center w-20">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f0f0f0]">
              <template v-for="item in filteredSeoItems" :key="item.id">
                <tr
                  @click="toggleSeo(item.id)"
                  class="hover:bg-slate-50 cursor-pointer transition-colors select-none"
                >
                  <!-- Status Column -->
                  <td class="py-3 px-4">
                    <span
                      class="px-2 py-0.5 rounded text-white font-bold text-[10px] tracking-wider uppercase inline-block"
                      :class="
                        item.status === 'pass' ? 'bg-[#70c144]' :
                        item.status === 'warn' ? 'bg-[#f0ad4e]' :
                        item.status === 'info' ? 'bg-[#9e9e9e]' : 'bg-[#d9534f]'
                      "
                    >
                      {{ item.status === 'pass' ? 'PASS' : item.status === 'warn' ? 'WARN' : item.status === 'info' ? 'INFO' : 'FAIL' }}
                    </span>
                  </td>

                  <!-- Diagnostic Item Column -->
                  <td class="py-3 px-4 font-medium text-[#333333]">
                    <span>{{ item.name }}</span>
                  </td>

                  <!-- Summary Column -->
                  <td class="py-3 px-4 text-[#555555]">
                    <span class="truncate max-w-[280px] sm:max-w-md font-mono text-[11px] text-[#444444] block">
                      {{ item.value }}
                    </span>
                  </td>

                  <!-- Action Column -->
                  <td class="py-3 px-4 text-center">
                    <svg
                      class="w-4 h-4 mx-auto text-neutral-400 transition-transform duration-200"
                      :class="expandedSeo.has(item.id) ? 'rotate-180' : ''"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </td>
                </tr>

                <!-- Expanded SEO Details Row -->
                <tr v-if="expandedSeo.has(item.id)" class="bg-[#fcfcfc]">
                  <td colspan="4" class="p-4 text-xs text-[#555555] leading-relaxed border-t border-[#f0f0f0]">
                    <div class="p-3.5 bg-white rounded border border-[#e6e6e6] space-y-3">
                      <!-- Audited value -->
                      <div class="space-y-1">
                        <div class="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                          Audited Value
                        </div>
                        <div class="bg-slate-50 text-slate-800 p-2 rounded border border-slate-200 font-mono text-[11px] break-all">
                          {{ item.value }}
                        </div>
                      </div>

                      <!-- Recommendation -->
                      <div class="space-y-1">
                        <div class="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                          Recommendation
                        </div>
                        <p class="text-neutral-700 leading-relaxed text-xs">
                          {{ item.recommendation }}
                        </p>
                      </div>

                      <!-- Search & Ads Impact -->
                      <div class="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 text-xs">
                        <div class="text-neutral-600">
                          <span class="font-bold text-neutral-700">Search Impact: </span>
                          <template v-if="item.id === 'indexing'">
                            Controls spider access. Directives like 'noindex' prevent page ranking and trigger advertising landing page rejections.
                          </template>
                          <template v-else-if="item.id === 'title'">
                            Primary weighting signal for search algorithms and main headline for SERP previews and social sharing.
                          </template>
                          <template v-else-if="item.id === 'description'">
                            Displayed directly beneath search titles. Clear descriptions increase organic click-through rate (CTR).
                          </template>
                          <template v-else-if="item.id === 'canonical'">
                            Consolidates link equity across parameter variations (e.g., utm_source, fbclid) to prevent duplicate content issues.
                          </template>
                          <template v-else-if="item.id === 'social_og'">
                            Defines Open Graph card titles and thumbnails when shared on social and messaging apps.
                          </template>
                          <template v-else-if="item.id === 'mobile_viewport'">
                            Required by Google Mobile-First Indexing standards to properly scale content on mobile browsers.
                          </template>
                          <template v-else-if="item.id === 'ssl_security'">
                            Encrypted transport is enforced by modern browsers and functions as a standard ranking criteria.
                          </template>
                          <template v-else>
                            Aligns with modern webmaster crawl specifications and accessibility best practices.
                          </template>
                        </div>
                        <span class="text-neutral-400 font-mono text-[10px] shrink-0 uppercase">Category: {{ item.category }}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ======================================================= -->
      <!-- 3. APP-RESPONSE-CODES (Response codes)                 -->
      <!-- ======================================================= -->
      <section class="space-y-3">
        <h4 class="text-xl font-normal text-[#2c3e50] border-b border-[#e6e6e6] pb-2">
          Response codes
        </h4>

        <div class="border border-[#e6e6e6] rounded overflow-hidden">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold">
              <tr>
                <th class="py-2.5 px-4">Response Code</th>
                <th class="py-2.5 px-4 text-right">Responses</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f0f0f0]">
              <tr>
                <td class="py-3 px-4 flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-[#70c144]" />
                  <span class="font-bold text-[#333333]">200</span>
                  <span class="text-[#666666]">OK</span>
                </td>
                <td class="py-3 px-4 text-right font-mono font-bold text-[#333333]">
                  {{ requestsCount }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ======================================================= -->
      <!-- 4. APP-PERCENTAGES (4 Breakdown Tables in 2x2 Grid)    -->
      <!-- ======================================================= -->
      <section class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Table 1: Content size by content type -->
          <div class="space-y-2">
            <h4 class="text-base font-normal text-[#2c3e50]">{{ t('section.contentSize') }}</h4>
            <div class="border border-[#e6e6e6] rounded overflow-hidden">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold">
                  <tr>
                    <th class="py-2 px-3">Content Type</th>
                    <th class="py-2 px-3 text-right">Percent</th>
                    <th class="py-2 px-3 text-right">Size</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#f0f0f0]">
                  <tr v-for="item in contentTypeAnalysis" :key="item.type" class="relative">
                    <td class="py-2 px-3 font-medium text-[#333333] flex items-center gap-2">
                      <svg
                        class="w-3.5 h-3.5 shrink-0"
                        :class="contentTypeTextColor(item.type)"
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
                          v-for="(shape, index) in contentTypeIcon(item.type)"
                          :key="index"
                          v-bind="shape.attrs"
                        />
                      </svg>
                      <span>{{ item.label }}</span>
                    </td>
                    <td class="py-2 px-3 text-right font-mono text-[#555555]">
                      {{ item.sizePercent }}%
                    </td>
                    <td class="py-2 px-3 text-right font-mono text-[#333333]">
                      {{ (item.bytes / 1024).toFixed(1) }} KB
                    </td>
                  </tr>
                </tbody>
                <tfoot class="bg-[#fafafa] border-t border-[#e6e6e6] font-bold text-[#333333]">
                  <tr>
                    <td class="py-2 px-3">Total</td>
                    <td class="py-2 px-3 text-right font-mono">100.00%</td>
                    <td class="py-2 px-3 text-right font-mono">{{ pageSize }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- Table 2: Requests by content type -->
          <div class="space-y-2">
            <h4 class="text-base font-normal text-[#2c3e50]">{{ t('section.requestsByType') }}</h4>
            <div class="border border-[#e6e6e6] rounded overflow-hidden">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold">
                  <tr>
                    <th class="py-2 px-3">Content Type</th>
                    <th class="py-2 px-3 text-right">Percent</th>
                    <th class="py-2 px-3 text-right">Requests</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#f0f0f0]">
                  <tr v-for="item in contentTypeAnalysis" :key="item.type">
                    <td class="py-2 px-3 font-medium text-[#333333] flex items-center gap-2">
                      <svg
                        class="w-3.5 h-3.5 shrink-0"
                        :class="contentTypeTextColor(item.type)"
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
                          v-for="(shape, index) in contentTypeIcon(item.type)"
                          :key="index"
                          v-bind="shape.attrs"
                        />
                      </svg>
                      <span>{{ item.label }}</span>
                    </td>
                    <td class="py-2 px-3 text-right font-mono text-[#555555]">
                      {{ item.countPercent }}%
                    </td>
                    <td class="py-2 px-3 text-right font-mono text-[#333333]">
                      {{ item.count }}
                    </td>
                  </tr>
                </tbody>
                <tfoot class="bg-[#fafafa] border-t border-[#e6e6e6] font-bold text-[#333333]">
                  <tr>
                    <td class="py-2 px-3">Total</td>
                    <td class="py-2 px-3 text-right font-mono">100.00%</td>
                    <td class="py-2 px-3 text-right font-mono">{{ requestsCount }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- Table 3: Content size by domain -->
          <div class="space-y-2">
            <h4 class="text-base font-normal text-[#2c3e50]">{{ t('section.contentByDomain') }}</h4>
            <div class="border border-[#e6e6e6] rounded overflow-hidden">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold">
                  <tr>
                    <th class="py-2 px-3">Domain</th>
                    <th class="py-2 px-3 text-right">Percent</th>
                    <th class="py-2 px-3 text-right">Size</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#f0f0f0]">
                  <tr v-for="item in domainAnalysis" :key="item.domain">
                    <td class="py-2 px-3 font-mono text-[#333333] truncate max-w-[180px]">
                      {{ item.domain }}
                    </td>
                    <td class="py-2 px-3 text-right font-mono text-[#555555]">
                      {{ item.percent }}%
                    </td>
                    <td class="py-2 px-3 text-right font-mono text-[#333333]">
                      {{ (item.bytes / 1024).toFixed(1) }} KB
                    </td>
                  </tr>
                </tbody>
                <tfoot class="bg-[#fafafa] border-t border-[#e6e6e6] font-bold text-[#333333]">
                  <tr>
                    <td class="py-2 px-3">Total</td>
                    <td class="py-2 px-3 text-right font-mono">100.00%</td>
                    <td class="py-2 px-3 text-right font-mono">{{ pageSize }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- Table 4: Requests by domain -->
          <div class="space-y-2">
            <h4 class="text-base font-normal text-[#2c3e50]">{{ t('section.requestsByDomain') }}</h4>
            <div class="border border-[#e6e6e6] rounded overflow-hidden">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold">
                  <tr>
                    <th class="py-2 px-3">Domain</th>
                    <th class="py-2 px-3 text-right">Percent</th>
                    <th class="py-2 px-3 text-right">Requests</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#f0f0f0]">
                  <tr v-for="item in domainAnalysis" :key="item.domain">
                    <td class="py-2 px-3 font-mono text-[#333333] truncate max-w-[180px]">
                      {{ item.domain }}
                    </td>
                    <td class="py-2 px-3 text-right font-mono text-[#555555]">
                      {{ Math.round((item.count / requestsCount) * 100) }}%
                    </td>
                    <td class="py-2 px-3 text-right font-mono text-[#333333]">
                      {{ item.count }}
                    </td>
                  </tr>
                </tbody>
                <tfoot class="bg-[#fafafa] border-t border-[#e6e6e6] font-bold text-[#333333]">
                  <tr>
                    <td class="py-2 px-3">Total</td>
                    <td class="py-2 px-3 text-right font-mono">100.00%</td>
                    <td class="py-2 px-3 text-right font-mono">{{ requestsCount }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================= -->
      <!-- 5. APP-FILE-REQUESTS (Classic Pingdom Waterfall)       -->
      <!-- ======================================================= -->
      <section class="space-y-3">
        <h4 class="text-xl font-normal text-[#2c3e50] border-b border-[#e6e6e6] pb-2">
          {{ t('section.fileRequests') }}
        </h4>

        <!-- Filtering toolbar (Sort by, Type multi-select dropdown, Filter search, Legend) -->
        <div class="bg-[#fafafa] border border-[#e6e6e6] rounded p-3 text-xs select-none">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-4 flex-wrap">
              <!-- Sort by -->
              <div class="flex items-center gap-1.5">
                <label class="font-bold text-[#555555]">{{ t('toolbar.sortBy') }}</label>
                <select
                  v-model="sortCriteria"
                  class="bg-white border border-[#d0d0d0] rounded px-2 py-1 text-xs text-[#333333] focus:outline-none focus:border-slate-400"
                >
                  <option value="order">{{ t('toolbar.sortOrder') }}</option>
                  <option value="duration">{{ t('toolbar.sortDuration') }}</option>
                  <option value="size">{{ t('toolbar.sortSize') }}</option>
                </select>
              </div>

              <!-- Rising Checkbox -->
              <div class="flex items-center gap-1.5">
                <input
                  id="rising"
                  v-model="sortRising"
                  type="checkbox"
                  class="rounded border-slate-300 text-[#70c144] focus:ring-[#70c144]"
                />
                <label for="rising" class="text-[#555555] cursor-pointer">{{ t('toolbar.rising') }}</label>
              </div>

              <!-- Type: Multi-select dropdown -->
              <div class="flex items-center gap-1.5 relative" ref="typeDropdownRef">
                <label class="font-bold text-[#555555]">{{ t('toolbar.type') }}</label>
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
                      <span>{{ t('toolbar.multiSelect') }}</span>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          @click.stop="selectAllTypes"
                          class="text-[#70c144] hover:underline font-medium cursor-pointer"
                        >
                          {{ t('toolbar.selectAll') }}
                        </button>
                        <span class="text-slate-300">|</span>
                        <button
                          type="button"
                          @click.stop="clearAllTypes"
                          class="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                        >
                          {{ t('toolbar.clear') }}
                        </button>
                      </div>
                    </div>

                    <!-- Type Items List -->
                    <div class="max-h-56 overflow-y-auto py-0.5">
                      <label
                        v-for="item in availableContentTypes"
                        :key="item.id"
                        class="flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer text-xs transition-colors"
                      >
                        <div class="flex items-center gap-2">
                          <input
                            type="checkbox"
                            :value="item.id"
                            :checked="selectedContentTypes.includes(item.id)"
                            @change="toggleContentType(item.id)"
                            class="rounded border-slate-300 text-[#70c144] focus:ring-[#70c144] w-3.5 h-3.5 cursor-pointer"
                          />
                          <span :class="selectedContentTypes.includes(item.id) ? 'text-slate-900 font-medium' : 'text-slate-600'">
                            {{ item.label }}
                          </span>
                        </div>
                        <span class="text-[11px] font-mono text-slate-400">
                          {{ filterCounts[item.id]?.count || 0 }}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Filter Search Input -->
              <div class="flex items-center gap-1.5">
                <label class="font-bold text-[#555555]">{{ t('toolbar.filter') }}</label>
                <div class="relative flex items-center">
                  <input
                    v-model="filterText"
                    type="text"
                    :placeholder="t('toolbar.filterPlaceholder')"
                    class="bg-white border border-[#d0d0d0] rounded pl-2.5 pr-6 py-1 text-xs text-[#333333] w-48 sm:w-60 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                  />
                  <button
                    v-if="filterText"
                    type="button"
                    @click="filterText = ''"
                    class="absolute right-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                    title="Clear search"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <!-- Legend Bar (Official Pingdom Timing Colors) -->
            <div class="flex items-center gap-3 text-[11px] text-[#666666]">
              <span class="font-bold">Legend</span>
              <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 bg-[#f06292] rounded-xs" />{{ t('legend.dns') }}</div>
              <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 bg-[#ab47bc] rounded-xs" />{{ t('legend.ssl') }}</div>
              <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 bg-[#42a5f5] rounded-xs" />{{ t('legend.connect') }}</div>
              <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 bg-[#ff8a65] rounded-xs" />{{ t('legend.send') }}</div>
              <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 bg-[#fbc02d] rounded-xs" />{{ t('legend.wait') }}</div>
              <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 bg-[#81c784] rounded-xs" />{{ t('legend.receive') }}</div>
            </div>
          </div>
        </div>

        <!-- Filter Stats Bar (Subtle, clean neutral banner) -->
        <div
          v-if="hasActiveFilters"
          class="bg-slate-50 border border-slate-200 rounded px-3.5 py-1.5 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2"
        >
          <div class="flex items-center gap-2">
            <span>{{ t('toolbar.showingResults', { shown: processedRequests.length, total: requests.length }) }}</span>
            <span class="text-slate-300">|</span>
            <span>Filtered Size: <b class="text-slate-800">{{ formatBytes(filteredBytes) }}</b> of <b class="text-slate-800">{{ formatBytes(totalBytes) }}</b></span>
          </div>
          <button
            type="button"
            @click="resetFilters"
            class="text-slate-500 hover:text-slate-800 font-medium underline underline-offset-2 cursor-pointer transition-colors"
          >
            {{ t('toolbar.reset') }}
          </button>
        </div>

        <!-- Waterfall Table with Time Ticks -->
        <div class="border border-[#e6e6e6] rounded overflow-hidden">
          <!-- Table Header -->
          <div class="grid grid-cols-12 bg-[#fafafa] border-b border-[#e6e6e6] text-xs font-bold text-[#666666] px-4 py-2.5">
            <div class="col-span-5 sm:col-span-4">File</div>
            <div class="col-span-2 sm:col-span-1 text-right">Size</div>
            <div class="col-span-5 sm:col-span-7 pl-4 flex items-center justify-between text-[10px] text-[#888888] font-mono relative">
              <span>0.0s</span>
              <span>{{ (maxWaterfallTime * 0.25 / 1000).toFixed(1) }}s</span>
              <span>{{ (maxWaterfallTime * 0.50 / 1000).toFixed(1) }}s</span>
              <span>{{ (maxWaterfallTime * 0.75 / 1000).toFixed(1) }}s</span>
              <span>{{ (maxWaterfallTime / 1000).toFixed(1) }}s</span>
            </div>
          </div>

          <!-- Empty State when filter matches 0 requests -->
          <div
            v-if="processedRequests.length === 0"
            class="py-16 px-4 text-center bg-white"
          >
            <div class="w-10 h-10 mx-auto mb-4 text-slate-300 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p class="text-xs font-semibold text-slate-700">{{ t('results.noMatchTitle') }}</p>
            <p class="text-[11px] text-slate-400 mt-2">{{ t('results.noMatchHint') }}</p>
            <button
              type="button"
              @click="resetFilters"
              class="mt-5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 rounded text-xs font-medium transition-colors cursor-pointer shadow-2xs"
            >
              {{ t('results.resetFilters') }}
            </button>
          </div>

          <!-- Rows -->
          <div v-else class="divide-y divide-[#f0f0f0] max-h-[550px] overflow-y-auto overflow-x-hidden">
            <div
              v-for="req in processedRequests"
              :key="req.id"
              class="hover:bg-yellow-50/40 transition-colors"
            >
              <div
                @click="toggleRow(req.id)"
                class="grid grid-cols-12 items-center text-xs py-2 px-4 cursor-pointer select-none"
              >
                <!-- File name & domain -->
                <div class="col-span-5 sm:col-span-4 flex items-center gap-2 overflow-hidden pr-2">
                  <!-- Type icon doubles as the status marker: failed requests turn red -->
                  <svg
                    class="w-3.5 h-3.5 shrink-0"
                    :class="req.statusCode >= 400 ? 'text-rose-500' : contentTypeTextColor(req.type)"
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
                  <span class="font-medium text-[#333333] font-mono truncate text-[11px]">
                    {{ req.filename }}
                  </span>
                  <span class="text-[#888888] text-[10px] truncate hidden sm:inline font-mono">
                    {{ req.domain }}
                  </span>
                </div>

                <!-- Size -->
                <div class="col-span-2 sm:col-span-1 text-right font-mono text-[#555555] text-[11px]">
                  {{ req.size >= 1024 ? `${(req.size / 1024).toFixed(1)} KB` : `${req.size} B` }}
                </div>

                <!-- Waterfall Bar -->
                <div class="col-span-5 sm:col-span-7 pl-4 relative h-5 flex items-center">
                  <div
                    class="absolute h-3 rounded-xs flex overflow-hidden shadow-2xs"
                    :style="{
                      left: `${(req.startTime / maxWaterfallTime) * 100}%`,
                      width: `${Math.max(1.8, (req.timings.total / maxWaterfallTime) * 100)}%`,
                    }"
                  >
                    <div v-if="req.timings.dns > 0" class="h-full bg-[#f06292]" :style="{ width: `${(req.timings.dns / req.timings.total) * 100}%` }" />
                    <div v-if="req.timings.ssl > 0" class="h-full bg-[#ab47bc]" :style="{ width: `${(req.timings.ssl / req.timings.total) * 100}%` }" />
                    <div v-if="req.timings.connect > 0" class="h-full bg-[#42a5f5]" :style="{ width: `${(req.timings.connect / req.timings.total) * 100}%` }" />
                    <div v-if="req.timings.wait > 0" class="h-full bg-[#fbc02d]" :style="{ width: `${(req.timings.wait / req.timings.total) * 100}%` }" />
                    <div v-if="req.timings.receive > 0" class="h-full bg-[#81c784]" :style="{ width: `${(req.timings.receive / req.timings.total) * 100}%` }" />
                  </div>

                  <span
                    class="text-[10px] font-mono text-[#888888] absolute"
                    :style="{
                      left: `calc(${((req.startTime + req.timings.total) / maxWaterfallTime) * 100}% + 6px)`,
                    }"
                  >
                    {{ req.timings.total }}ms
                  </span>
                </div>
              </div>

              <!-- Expanded Details Drawer -->
              <div
                v-if="expandedRows.has(req.id)"
                class="bg-slate-50 p-3.5 border-t border-[#e6e6e6] text-xs font-mono space-y-2"
              >
                <div class="text-[#2563eb] font-bold truncate">
                  {{ req.url }}
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[11px]">
                  <div class="bg-white p-1.5 rounded border border-slate-200"><span class="text-slate-400 block">DNS</span><b>{{ req.timings.dns }}ms</b></div>
                  <div class="bg-white p-1.5 rounded border border-slate-200"><span class="text-slate-400 block">SSL</span><b>{{ req.timings.ssl }}ms</b></div>
                  <div class="bg-white p-1.5 rounded border border-slate-200"><span class="text-slate-400 block">Connect</span><b>{{ req.timings.connect }}ms</b></div>
                  <div class="bg-white p-1.5 rounded border border-slate-200"><span class="text-slate-400 block">Wait</span><b>{{ req.timings.wait }}ms</b></div>
                  <div class="bg-white p-1.5 rounded border border-slate-200"><span class="text-slate-400 block">Receive</span><b>{{ req.timings.receive }}ms</b></div>
                </div>
              </div>
            </div>
          </div>
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
  pageTitle: string;
  serverHeader: string;
  grade: string;
  score: number;
  pageSize: string;
  loadTimeFormatted: string;
  requestsCount: number;
  recommendations: any[];
  contentTypeAnalysis: any[];
  domainAnalysis: any[];
  requests: any[];
  seoAudit?: any;
  statusCode?: number;
  statusMessage?: string;
  lighthouseResult?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    speedIndex: number;
  } | null;
  metricsSource?: string;
}>();

defineEmits<{
  (e: 'download-har'): void;
  (e: 'share-result'): void;
}>();

// Donut chart parameters: performance recommendations are grouped into dimensions,
// and the SEO dimension reuses the SEO audit score.
const donutRadius = 54;
const donutCircumference = 2 * Math.PI * donutRadius;
// Dimension -> `rule` id used by the server-side performanceRecommendations (see server.ts)
const scoreCategories = [
  { id: 'network', rules: ['cdn', 'redirects', 'reduce_dns_lookups', 'cookie_free'], color: '#42a5f5' },
  { id: 'resource', rules: ['requests_count', 'image_dims', 'js_at_bottom', 'empty_src'], color: '#70c144' },
  { id: 'compression', rules: ['compression'], color: '#fbc02d' },
  { id: 'cache', rules: ['caching'], color: '#ff8a65' },
  { id: 'seo', rules: [], color: '#ab47bc' },
];

const scoreBandColor = (score: number) => {
  if (score >= 90) return '#70c144';
  if (score >= 70) return '#f0ad4e';
  return '#d9534f';
};

const formatSpeedIndex = (ms: number) => {
  if (!ms || ms <= 0) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
};

const donutSegments = computed(() => {
  const recs = props.recommendations || [];
  const dims: { id: string; label: string; score: number; color: string }[] = [];

  for (const cat of scoreCategories) {
    // The SEO dimension reuses the SEO audit score (same source as the SEO section);
    // it is skipped entirely when no audit data is available.
    if (cat.id === 'seo') {
      const seoScore = Number(activeSeo.value?.score);
      if (!Number.isFinite(seoScore) || seoScore <= 0) continue;
      dims.push({ id: cat.id, label: t('scoreCat.seo'), score: Math.round(seoScore), color: cat.color });
      continue;
    }

    const matched = recs.filter(r => cat.rules.includes(r.rule));
    const score = matched.length
      ? Math.round(matched.reduce((sum, r) => sum + (Number(r.score) || 0), 0) / matched.length)
      : props.score;
    dims.push({ id: cat.id, label: t(`scoreCat.${cat.id}`), score, color: cat.color });
  }

  // Scale each dimension proportionally so the arcs fill the total score;
  // whatever is left over is the score that was deducted.
  const totalScore = Math.max(0, Math.min(100, Number(props.score) || 0));
  const remaining = 100 - totalScore;
  const dimsSum = dims.reduce((sum, d) => sum + d.score, 0) || 1;

  const arcs = [
    ...dims.map(d => ({ ...d, value: (d.score / dimsSum) * totalScore, display: `${d.score}` })),
    ...(remaining > 0
      ? [{
          id: 'remaining',
          label: t('scoreCat.remaining'),
          score: remaining,
          color: '#d9534f',
          value: remaining,
          display: `-${remaining}`,
        }]
      : []),
  ];

  let offset = 0;
  return arcs.map(arc => {
    const length = (arc.value / 100) * donutCircumference;
    const segment = { ...arc, dash: `${length} ${donutCircumference - length}`, offset: -offset };
    offset += length;
    return segment;
  });
});

// Interactive state
const expandedRecs = ref(new Set<string>());
const expandedRows = ref(new Set<string>());
const expandedSeo = ref(new Set<string>(['indexing', 'social_og']));
const activeSeoTab = ref<'all' | 'indexing' | 'meta' | 'social' | 'mobile' | 'security'>('all');
const sortCriteria = ref<'order' | 'duration' | 'size'>('order');
const sortRising = ref(true);
const filterText = ref('');

// Type multi-select dropdown state
const isTypeDropdownOpen = ref(false);
const typeDropdownRef = ref<HTMLElement | null>(null);

const availableContentTypes = [
  { id: 'html', label: 'HTML', types: ['html', 'document'] },
  { id: 'script', label: 'JS', types: ['script', 'js', 'javascript'] },
  { id: 'stylesheet', label: 'CSS', types: ['stylesheet', 'css'] },
  { id: 'image', label: 'Images', types: ['image', 'img', 'media'] },
  { id: 'font', label: 'Fonts', types: ['font', 'fonts', 'woff2', 'woff'] },
  { id: 'other', label: 'Other', types: ['other', 'xhr', 'fetch'] },
];

const selectedContentTypes = ref<string[]>([]);

const selectedTypesLabel = computed(() => {
  if (selectedContentTypes.value.length === 0) return t('toolbar.allTypes');
  if (selectedContentTypes.value.length === availableContentTypes.length) return t('toolbar.allTypes');
  if (selectedContentTypes.value.length === 1) {
    const item = availableContentTypes.find(c => c.id === selectedContentTypes.value[0]);
    return item ? item.label : t('toolbar.selectedCount', { count: 1 });
  }
  return t('toolbar.selectedCount', { count: selectedContentTypes.value.length });
});

const toggleContentType = (id: string) => {
  const idx = selectedContentTypes.value.indexOf(id);
  if (idx >= 0) {
    selectedContentTypes.value.splice(idx, 1);
  } else {
    selectedContentTypes.value.push(id);
  }
};

const selectAllTypes = () => {
  selectedContentTypes.value = availableContentTypes.map(c => c.id);
};

const clearAllTypes = () => {
  selectedContentTypes.value = [];
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

const filterCounts = computed(() => {
  const reqs = props.requests || [];
  const map: Record<string, { count: number; bytes: number }> = {
    all: { count: reqs.length, bytes: reqs.reduce((sum, r) => sum + (r.size || 0), 0) },
    html: { count: 0, bytes: 0 },
    script: { count: 0, bytes: 0 },
    stylesheet: { count: 0, bytes: 0 },
    image: { count: 0, bytes: 0 },
    font: { count: 0, bytes: 0 },
    other: { count: 0, bytes: 0 },
  };

  for (const r of reqs) {
    const t = (r.type || '').toLowerCase();
    const sz = r.size || 0;
    if (t === 'html' || t === 'document') {
      map.html.count++;
      map.html.bytes += sz;
    } else if (t === 'script' || t === 'js' || t === 'javascript') {
      map.script.count++;
      map.script.bytes += sz;
    } else if (t === 'stylesheet' || t === 'css') {
      map.stylesheet.count++;
      map.stylesheet.bytes += sz;
    } else if (t === 'image' || t === 'img' || t === 'media') {
      map.image.count++;
      map.image.bytes += sz;
    } else if (t === 'font' || t === 'fonts' || t === 'woff2' || t === 'woff') {
      map.font.count++;
      map.font.bytes += sz;
    } else {
      map.other.count++;
      map.other.bytes += sz;
    }
  }

  return map;
});

// Return an empty structure when no SEO audit data is available; demo data is never
// used to stand in for a real result.
const emptySeo = {
  score: 0,
  grade: '-',
  passedCount: 0,
  warnCount: 0,
  failCount: 0,
  infoCount: 0,
  totalCount: 0,
  items: [] as any[],
};

const activeSeo = computed(() => {
  if (props.seoAudit && props.seoAudit.items && props.seoAudit.items.length > 0) {
    return props.seoAudit;
  }
  return emptySeo;
});

const seoTabs = [
  { id: 'all', label: 'All Audits' },
  { id: 'indexing', label: 'Indexing & Crawl' },
  { id: 'meta', label: 'Meta Tags' },
  { id: 'social', label: 'Open Graph' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'security', label: 'Security' },
];

const filteredSeoItems = computed(() => {
  const items = activeSeo.value.items || [];
  if (activeSeoTab.value === 'all') return items;
  return items.filter((item: any) => item.category === activeSeoTab.value);
});

const getSeoCountByTab = (tabId: string) => {
  const items = activeSeo.value.items || [];
  if (tabId === 'all') return items.length;
  return items.filter((item: any) => item.category === tabId).length;
};

const toggleSeo = (id: string) => {
  if (expandedSeo.value.has(id)) {
    expandedSeo.value.delete(id);
  } else {
    expandedSeo.value.add(id);
  }
};

const toggleRec = (rule: string) => {
  if (expandedRecs.value.has(rule)) {
    expandedRecs.value.delete(rule);
  } else {
    expandedRecs.value.add(rule);
  }
};

const toggleRow = (id: string) => {
  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id);
  } else {
    expandedRows.value.add(id);
  }
};

const maxWaterfallTime = computed(() => {
  if (!props.requests.length) return 800;
  const max = Math.max(...props.requests.map(r => r.startTime + r.timings.total));
  return Math.ceil(max / 100) * 100 || 800;
});

const processedRequests = computed(() => {
  let list = [...(props.requests || [])];

  // 1. Content-Type Category Filter (Multi-select)
  if (selectedContentTypes.value.length > 0 && selectedContentTypes.value.length < availableContentTypes.length) {
    const allowedTypes = new Set<string>();
    for (const id of selectedContentTypes.value) {
      const def = availableContentTypes.find(c => c.id === id);
      if (def) {
        def.types.forEach(t => allowedTypes.add(t));
      }
    }
    list = list.filter(r => {
      const t = (r.type || '').toLowerCase();
      return allowedTypes.has(t);
    });
  }

  // 2. Keyword Search (URL, filename, or domain)
  if (filterText.value.trim()) {
    const q = filterText.value.toLowerCase().trim();
    list = list.filter(r =>
      (r.url && r.url.toLowerCase().includes(q)) ||
      (r.filename && r.filename.toLowerCase().includes(q)) ||
      (r.domain && r.domain.toLowerCase().includes(q))
    );
  }

  // 3. Sorting
  list.sort((a, b) => {
    let diff = 0;
    if (sortCriteria.value === 'order') diff = a.startTime - b.startTime;
    else if (sortCriteria.value === 'duration') diff = a.timings.total - b.timings.total;
    else if (sortCriteria.value === 'size') diff = a.size - b.size;

    return sortRising.value ? diff : -diff;
  });

  return list;
});

const filteredBytes = computed(() => {
  return processedRequests.value.reduce((sum, r) => sum + (r.size || 0), 0);
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
  const isTypeFiltered = selectedContentTypes.value.length > 0 && selectedContentTypes.value.length < availableContentTypes.length;
  return isTypeFiltered || filterText.value.trim() !== '';
});

const resetFilters = () => {
  selectedContentTypes.value = [];
  filterText.value = '';
};
</script>
