<template>
  <div class="bg-white py-8 px-4 sm:px-6">
    <div class="max-w-5xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">

        <!-- Left: intro copy -->
        <div class="space-y-7">
          <section>
            <h3 class="text-xl font-normal text-[#2c3e50] border-b border-[#e6e6e6] pb-2">
              {{ t('intro.slowTitle') }}
            </h3>
            <div class="mt-3 space-y-3 text-sm text-[#666666] leading-relaxed">
              <p>{{ t('intro.slowP1') }}</p>
              <p>{{ t('intro.slowP2') }}</p>
              <p>{{ t('intro.slowP3') }}</p>
            </div>
          </section>

          <section>
            <h3 class="text-xl font-normal text-[#2c3e50] border-b border-[#e6e6e6] pb-2">
              {{ t('intro.aboutTitle') }}
            </h3>
            <div class="mt-3 space-y-3 text-sm text-[#666666] leading-relaxed">
              <p v-for="key in aboutParagraphs" :key="key">{{ t(key) }}</p>
            </div>
          </section>

          <section>
            <h3 class="text-xl font-normal text-[#2c3e50] border-b border-[#e6e6e6] pb-2">
              {{ t('intro.seoTitle') }}
            </h3>
            <div class="mt-3 space-y-3 text-sm text-[#666666] leading-relaxed">
              <p>{{ t('intro.seoP1') }}</p>
              <ul class="space-y-1.5 list-disc pl-5">
                <li v-for="key in seoChecks" :key="key">{{ t(key) }}</li>
              </ul>
            </div>
          </section>
        </div>

        <!-- Right: reference legends -->
        <div class="space-y-6">
          <div
            v-for="box in legendBoxes"
            :key="box.titleKey"
            class="border border-[#e6e6e6] rounded p-4"
          >
            <h4 class="text-base font-normal text-[#2c3e50]">{{ t(box.titleKey) }}</h4>
            <p class="mt-1 text-xs text-[#888888]">{{ t(box.hintKey) }}</p>

            <table class="w-full mt-3 text-left text-xs border-collapse">
              <tbody class="divide-y divide-[#f0f0f0]">
                <tr v-for="row in box.rows" :key="row.labelKey">
                  <td class="py-2 pr-3 align-middle">
                    <svg
                      v-if="row.type"
                      class="w-4 h-4"
                      :class="contentTypeTextColor(row.type)"
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
                        v-for="(shape, index) in contentTypeIcon(row.type)"
                        :key="index"
                        v-bind="shape.attrs"
                      />
                    </svg>
                    <span v-else class="block w-3 h-3 rounded-xs" :style="{ backgroundColor: row.color }" />
                  </td>
                  <td class="py-2 pr-4 font-medium text-[#333333] whitespace-nowrap align-middle">
                    {{ t(row.labelKey) }}
                  </td>
                  <td class="py-2 text-[#777777] align-middle">{{ t(row.descKey) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '../i18n';
import { contentTypeIcon, contentTypeTextColor } from '../utils/contentTypeIcon';

const { t } = useI18n();

const aboutParagraphs = ['intro.aboutP1', 'intro.aboutP2', 'intro.aboutP3', 'intro.aboutP4'];

const seoChecks = [
  'intro.seoCheck.crawlability',
  'intro.seoCheck.title',
  'intro.seoCheck.description',
  'intro.seoCheck.canonical',
  'intro.seoCheck.viewport',
  'intro.seoCheck.og',
  'intro.seoCheck.h1',
  'intro.seoCheck.https',
  'intro.seoCheck.alt',
  'intro.seoCheck.jsonld',
];

interface LegendRow {
  labelKey: string;
  descKey: string;
  color: string;
  type?: string;
}

interface LegendBox {
  titleKey: string;
  hintKey: string;
  rows: LegendRow[];
}

// Sample colors mirror the values actually rendered in the results view:
// waterfall phases (PingdomResults), content-type icon colors (contentTypeTextColor)
// and the request status dot.
const legendBoxes: LegendBox[] = [
  {
    titleKey: 'intro.stateColorsTitle',
    hintKey: 'intro.stateColorsHint',
    rows: [
      { labelKey: 'legend.dns', descKey: 'intro.state.dns', color: '#f06292' },
      { labelKey: 'legend.ssl', descKey: 'intro.state.ssl', color: '#ab47bc' },
      { labelKey: 'legend.connect', descKey: 'intro.state.connect', color: '#42a5f5' },
      { labelKey: 'legend.send', descKey: 'intro.state.send', color: '#ff8a65' },
      { labelKey: 'legend.wait', descKey: 'intro.state.wait', color: '#fbc02d' },
      { labelKey: 'legend.receive', descKey: 'intro.state.receive', color: '#81c784' },
    ],
  },
  {
    titleKey: 'intro.contentTypesTitle',
    hintKey: 'intro.contentTypesHint',
    rows: [
      { labelKey: 'intro.type.html', descKey: 'intro.typeDesc.html', color: '#ff8a65', type: 'html' },
      { labelKey: 'intro.type.script', descKey: 'intro.typeDesc.script', color: '#fbc02d', type: 'script' },
      { labelKey: 'intro.type.stylesheet', descKey: 'intro.typeDesc.stylesheet', color: '#42a5f5', type: 'stylesheet' },
      { labelKey: 'intro.type.image', descKey: 'intro.typeDesc.image', color: '#70c144', type: 'image' },
      { labelKey: 'intro.type.font', descKey: 'intro.typeDesc.font', color: '#ab47bc', type: 'font' },
      { labelKey: 'intro.type.other', descKey: 'intro.typeDesc.other', color: '#9e9e9e', type: 'other' },
    ],
  },
  {
    titleKey: 'intro.statusCodesTitle',
    hintKey: 'intro.statusCodesHint',
    rows: [
      { labelKey: 'intro.status.ok', descKey: 'intro.statusDesc.ok', color: '#70c144' },
      { labelKey: 'intro.status.error', descKey: 'intro.statusDesc.error', color: '#f43f5e' },
    ],
  },
];
</script>
