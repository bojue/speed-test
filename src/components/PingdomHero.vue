<template>
  <div class="bg-[#fdf45b] relative overflow-hidden pt-8 pb-10 select-none">
    <!-- Authentic Wave Background SVG from user specification -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <svg
        class="w-full h-full"
        viewBox="0 0 4442 720"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect height="720" width="4442" fill="#fdf45b" />
        <path
          class="wave-path"
          d="M592,510.37c237,0,331,97,531,98.63s309-120.57,509-116.5,304,31.73,443,39.8,399-84.48,555-85.3,410,147,660,141.36,410-143,565-130.8V718H592Z"
          fill="#f6ee55"
          style="transform: scaleY(1) translateX(0px);"
        />
      </svg>
    </div>

    <div class="max-w-5xl mx-auto px-4 sm:px-6 relative z-10 space-y-6">
      <!-- Main Header -->
      <div class="text-center space-y-2">
        <h1 class="text-3xl sm:text-4xl lg:text-[40px] font-normal text-[#282828] font-sans tracking-tight">
          {{ t('hero.title') }}
        </h1>
        <p class="text-sm sm:text-base text-[#444444] font-normal">
          {{ t('hero.subtitle') }}
        </p>
      </div>

      <!-- Test Form Grid -->
      <form @submit.prevent="handleSubmit" class="max-w-4xl mx-auto">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <!-- URL Input (col-span-5) -->
          <div class="md:col-span-5 space-y-1">
            <label for="urlInput" class="block text-xs font-semibold text-[#282828]">
              {{ t('hero.url') }}
            </label>
            <input
              id="urlInput"
              v-model="inputUrl"
              type="url"
              required
              placeholder="www.example.com"
              spellcheck="false"
              :disabled="isLoading"
              class="w-full h-11 px-3.5 bg-white rounded border border-[#d0d0d0] text-sm text-[#333333] focus:outline-none focus:border-[#5cc72a] focus:ring-1 focus:ring-[#5cc72a] shadow-2xs transition-colors"
            />
          </div>

          <!-- Device dropdown (col-span-2) -->
          <div class="md:col-span-2 space-y-1">
            <label for="deviceSelect" class="block text-xs font-semibold text-[#282828]">
              {{ t('hero.device') }}
            </label>
            <div class="relative">
              <select
                id="deviceSelect"
                v-model="selectedDevice"
                :disabled="isLoading"
                class="w-full h-11 px-3.5 bg-white rounded border border-[#d0d0d0] text-sm text-[#333333] focus:outline-none focus:border-[#5cc72a] focus:ring-1 focus:ring-[#5cc72a] appearance-none cursor-pointer pr-8 shadow-2xs transition-colors"
              >
                <option value="Desktop">{{ t('hero.deviceDesktop') }}</option>
                <option value="Mobile">{{ t('hero.deviceMobile') }}</option>
              </select>
              <div class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] text-xs">
                ▼
              </div>
            </div>
          </div>

          <!-- Test from dropdown (col-span-3) -->
          <div class="md:col-span-3 space-y-1">
            <label for="testFrom" class="block text-xs font-semibold text-[#282828]">
              {{ t('hero.testFrom') }}
            </label>
            <div class="relative">
              <select
                id="testFrom"
                v-model="selectedRegion"
                :disabled="isLoading"
                class="w-full h-11 px-3.5 bg-white rounded border border-[#d0d0d0] text-sm text-[#333333] focus:outline-none focus:border-[#5cc72a] focus:ring-1 focus:ring-[#5cc72a] appearance-none cursor-pointer pr-8 shadow-2xs transition-colors"
              >
                <option value="North China - Ulanqab">{{ t('hero.region.default') }}</option>
              </select>
              <div class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] text-xs">
                ▼
              </div>
            </div>
          </div>

          <!-- START TEST Button (col-span-2) -->
          <div class="md:col-span-2">
            <button
              type="submit"
              :disabled="isLoading"
              class="w-full h-11 bg-[#5cc72a] hover:bg-[#52b524] active:bg-[#479f1f] text-white font-bold text-sm tracking-wider uppercase rounded shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span v-if="isLoading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{{ isLoading ? t('hero.testing') : t('hero.startTest') }}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '../i18n';

const { t } = useI18n();

const props = defineProps<{
  targetUrl: string;
  region: string;
  deviceProfile: string;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit'): void;
  (e: 'update:targetUrl', val: string): void;
  (e: 'update:region', val: string): void;
  (e: 'update:deviceProfile', val: string): void;
}>();

const inputUrl = ref(props.targetUrl);
const selectedRegion = ref(props.region);
const selectedDevice = ref(props.deviceProfile);

watch(() => props.targetUrl, (val) => {
  inputUrl.value = val;
});

watch(() => props.deviceProfile, (val) => {
  selectedDevice.value = val;
});

watch(selectedRegion, (val) => emit('update:region', val));

watch(selectedDevice, (val) => emit('update:deviceProfile', val));

const handleSubmit = () => {
  let cleaned = inputUrl.value.trim();
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'http://' + cleaned;
  }
  emit('update:targetUrl', cleaned);
  emit('submit');
};
</script>
