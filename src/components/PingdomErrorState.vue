<template>
  <div class="bg-white py-8 px-4 sm:px-6">
    <div class="max-w-4xl mx-auto space-y-6">

      <!-- Pingdom Style Error Diagnostic Card -->
      <div class="bg-white border border-[#e6e6e6] rounded-md overflow-hidden shadow-xs">
        <!-- Card Top Stripe & Header -->
        <div class="bg-[#fff8f6] border-b border-[#fcdad5] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              :class="
                error?.errorType === 'waf_blocked'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-rose-100 text-rose-700 border border-rose-300'
              "
            >
              <svg v-if="error?.errorType === 'waf_blocked'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <svg v-else-if="error?.errorType === 'dns_failed'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <svg v-else-if="error?.errorType === 'ssl_error'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
                  :class="
                    error?.errorType === 'waf_blocked'
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-rose-200 text-rose-900'
                  "
                >
                  {{ errorTypeBadge }}
                </span>
                <span class="text-xs text-slate-500 font-mono">{{ t('errorState.defaultTitle') }}</span>
              </div>
              <h3 class="text-base sm:text-lg font-bold text-[#2c3e50] mt-0.5">
                {{ error?.title || t('errorState.defaultTitle') }}
              </h3>
            </div>
          </div>

          <div class="text-xs text-slate-500 font-mono">
            {{ t('errorState.node') }}: <b class="text-slate-700">{{ error?.region || 'North China - Ulanqab' }}</b>
          </div>
        </div>

        <!-- Card Body -->
        <div class="p-6 space-y-6">
          <!-- Main Error Description -->
          <div class="bg-slate-50 border border-slate-200 rounded p-4 text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2 font-sans">
            <p class="font-medium text-slate-800">
              {{ error?.message || t('errorState.defaultMessage') }}
            </p>
            <div class="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-200 font-mono">
              <div><b>{{ t('errorState.targetUrl') }}:</b> <span class="text-slate-800 break-all">{{ error?.targetUrl || targetUrl }}</span></div>
              <div v-if="error?.statusCode"><b>{{ t('errorState.httpStatus') }}:</b> <span class="text-rose-600 font-bold">{{ error.statusCode }}</span></div>
              <div v-if="error?.errorCode"><b>{{ t('errorState.osCode') }}:</b> <span class="text-slate-800">{{ error.errorCode }}</span></div>
            </div>
          </div>

          <!-- Troubleshooting Guidance -->
          <div class="space-y-3">
            <h4 class="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {{ t('errorState.checklist') }}
            </h4>

            <ul class="space-y-2 text-xs text-slate-600">
              <li
                v-for="(tip, idx) in troubleshootingTips"
                :key="idx"
                class="flex items-start gap-2 bg-slate-50/70 border border-slate-100 rounded px-3 py-2"
              >
                <span class="w-4 h-4 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-mono">
                  {{ idx + 1 }}
                </span>
                <span class="leading-relaxed">{{ tip }}</span>
              </li>
            </ul>
          </div>

          <!-- Action Buttons -->
          <div class="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="$emit('retry')"
                class="px-4 py-2 bg-[#70c144] hover:bg-[#62aa3b] text-white rounded font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {{ t('errorState.retry') }}
              </button>

              <button
                type="button"
                @click="$emit('test-sample', 'https://www.google.com/')"
                class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-xs transition-colors cursor-pointer"
              >
                {{ t('errorState.sample') }}
              </button>
            </div>

            <button
              v-if="hasPreviousResults"
              type="button"
              @click="$emit('dismiss')"
              class="text-xs text-slate-500 hover:text-slate-800 font-medium underline underline-offset-2 cursor-pointer"
            >
              {{ t('errorState.backToResults') }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../i18n';

const { t } = useI18n();

const props = defineProps<{
  error: {
    errorType?: string;
    title?: string;
    message?: string;
    targetUrl?: string;
    region?: string;
    statusCode?: number;
    errorCode?: string;
    troubleshootingTips?: string[];
  } | null;
  targetUrl: string;
  hasPreviousResults?: boolean;
}>();

defineEmits<{
  (e: 'retry'): void;
  (e: 'test-sample', url: string): void;
  (e: 'dismiss'): void;
}>();

const errorTypeBadge = computed(() => {
  switch (props.error?.errorType) {
    case 'waf_blocked': return t('errorType.waf_blocked');
    case 'dns_failed': return t('errorType.dns_failed');
    case 'ssl_error': return t('errorType.ssl_error');
    case 'timeout': return t('errorType.timeout');
    case 'conn_refused': return t('errorType.conn_refused');
    case 'intranet_ip': return t('errorType.intranet_ip');
    case 'http_error': return t('errorType.http_error', { code: props.error.statusCode || 500 });
    default: return t('errorType.probe_failed');
  }
});

const troubleshootingTips = computed(() => {
  if (props.error?.troubleshootingTips && props.error.troubleshootingTips.length > 0) {
    return props.error.troubleshootingTips;
  }
  return [t('errorState.tip1'), t('errorState.tip2'), t('errorState.tip3'), t('errorState.tip4')];
});
</script>
