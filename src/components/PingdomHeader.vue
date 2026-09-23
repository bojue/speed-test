<template>
  <header class="bg-[#fff000] border-b border-[#fff000] px-4 sm:px-8 py-3 select-none fixed top-0 left-0 right-0 w-full z-40">
    <div class="max-w-6xl mx-auto flex items-center justify-between">
      <!-- Modern Elegant Brand Header: Refined Minimalist Speed Glyph + Sharp Modern Typography -->
      <a
        :href="basePath"
        class="flex items-center gap-2.5 text-[#111827] hover:text-black transition-all group cursor-pointer"
        aria-label="Website Speed Test"
        title="Website Speed Test"
      >
        <!-- Refined, elegant speedometer pulse emblem -->
        <div class="w-8 h-8 rounded-lg bg-white/85 shadow-2xs border border-black/5 flex items-center justify-center transition-all duration-300 group-hover:bg-white group-hover:scale-105 group-hover:shadow-xs">
          <svg
            class="w-5 h-5 text-[#e67e00] transition-transform duration-300 group-hover:rotate-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <!-- Smooth Precision Gauge Arc -->
            <path
              d="M3.5 16.5A9 9 0 1 1 20.5 16.5"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <!-- Center Pivot Node -->
            <circle cx="12" cy="14.5" r="1.75" fill="currentColor" />
            <!-- Dynamic Swift Needle pointing up-right with speed motion -->
            <path
              d="M12 14.5L16.2 8.8"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <!-- Subtle Velocity Accent Streak -->
            <path
              d="M7 17.5H4"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-opacity="0.6"
            />
            <path
              d="M20 17.5H17"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-opacity="0.6"
            />
          </svg>
        </div>

        <div class="flex items-baseline font-sans">
          <span class="font-extrabold text-[19px] tracking-tight text-[#111827]">
            Speed<span class="text-[#e67e00]">Test</span>
          </span>
        </div>
      </a>

      <!-- Right controls: View Mode Switcher -->
      <div class="flex items-center gap-3">
        <!-- Segmented control with a filled active pill for clear active/inactive contrast -->
        <div
          class="inline-flex items-center p-1 rounded-full bg-white border border-black/10 shadow-sm select-none"
          role="tablist"
          aria-label="View mode switcher"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="viewMode === 'webmaster'"
            @click="changeMode('webmaster')"
            class="px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer outline-none focus:outline-none select-none"
            :class="
              viewMode === 'webmaster'
                ? 'bg-[#111827] text-white shadow-sm'
                : 'text-neutral-500 hover:text-[#111827] hover:bg-black/5'
            "
          >
            {{ t('header.webmaster') }}
          </button>

          <button
            type="button"
            role="tab"
            :aria-selected="viewMode === 'engineer'"
            @click="changeMode('engineer')"
            class="px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer outline-none focus:outline-none select-none"
            :class="
              viewMode === 'engineer'
                ? 'bg-[#111827] text-white shadow-sm'
                : 'text-neutral-500 hover:text-[#111827] hover:bg-black/5'
            "
          >
            {{ t('header.engineer') }}
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from '../i18n';
import { computed } from 'vue';

export type ViewMode = 'webmaster' | 'engineer';

defineProps<{
  viewMode: ViewMode;
}>();

const emit = defineEmits<{
  (e: 'update:viewMode', mode: ViewMode): void;
  (e: 'update:view-mode', mode: ViewMode): void;
}>();

const { t } = useI18n();

const basePath = computed(() => import.meta.env.BASE_URL.replace(/\/+$/, '') || '/');

const changeMode = (mode: ViewMode) => {
  emit('update:viewMode', mode);
  emit('update:view-mode', mode);
};
</script>
