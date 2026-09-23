<template>
  <section class="bg-white py-8 px-4 sm:px-6 border-t border-[#e6e6e6]">
    <div class="max-w-5xl mx-auto space-y-4">
      <div class="flex items-center justify-between border-b border-[#e6e6e6] pb-2">
        <h3 class="text-xl sm:text-2xl font-light text-[#2c3e50] tracking-tight">Real User Monitoring</h3>
        <span v-if="total > 0" class="text-xs font-mono text-[#888888]">{{ total }} sample(s)</span>
      </div>

      <!-- Empty state -->
      <div
        v-if="!loading && total === 0"
        class="border border-[#e6e6e6] rounded p-10 text-center text-sm text-[#999999]"
      >
        No field data yet. Beacons will appear here as visitors load the page.
      </div>

      <template v-else>
        <!-- Percentile table -->
        <div class="border border-[#e6e6e6] rounded overflow-hidden">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold">
              <tr>
                <th class="py-2.5 px-4">Metric</th>
                <th class="py-2.5 px-4 text-right">Samples</th>
                <th class="py-2.5 px-4 text-right">Average</th>
                <th class="py-2.5 px-4 text-right">p75</th>
                <th class="py-2.5 px-4 text-right">p95</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f0f0f0]">
              <tr v-for="m in metricRows" :key="m.key">
                <td class="py-2.5 px-4 font-medium text-[#333333]">{{ m.label }}</td>
                <td class="py-2.5 px-4 text-right font-mono text-[#555555]">{{ m.count }}</td>
                <td class="py-2.5 px-4 text-right font-mono text-[#555555]">{{ m.avg }}</td>
                <td class="py-2.5 px-4 text-right font-mono text-[#333333]">{{ m.p75 }}</td>
                <td class="py-2.5 px-4 text-right font-mono text-[#333333]">{{ m.p95 }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Dimension breakdowns -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <h4 class="text-base font-normal text-[#2c3e50]">By network</h4>
            <div class="border border-[#e6e6e6] rounded overflow-hidden">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold">
                  <tr>
                    <th class="py-2 px-3">Network</th>
                    <th class="py-2 px-3 text-right">Samples</th>
                    <th class="py-2 px-3 text-right">Avg LCP</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#f0f0f0]">
                  <tr v-for="n in byNetwork" :key="n.effectiveType">
                    <td class="py-2 px-3 font-mono text-[#333333]">{{ n.effectiveType }}</td>
                    <td class="py-2 px-3 text-right font-mono text-[#555555]">{{ n.count }}</td>
                    <td class="py-2 px-3 text-right font-mono text-[#333333]">{{ n.avgLcp }} ms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="space-y-2">
            <h4 class="text-base font-normal text-[#2c3e50]">By device</h4>
            <div class="border border-[#e6e6e6] rounded overflow-hidden">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-[#fafafa] border-b border-[#e6e6e6] text-[#666666] font-bold">
                  <tr>
                    <th class="py-2 px-3">Device</th>
                    <th class="py-2 px-3 text-right">Samples</th>
                    <th class="py-2 px-3 text-right">Avg LCP</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#f0f0f0]">
                  <tr v-for="d in byDevice" :key="d.tier">
                    <td class="py-2 px-3 font-mono text-[#333333]">{{ d.tier }}</td>
                    <td class="py-2 px-3 text-right font-mono text-[#555555]">{{ d.count }}</td>
                    <td class="py-2 px-3 text-right font-mono text-[#333333]">{{ d.avgLcp }} ms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const data = ref<any | null>(null);
const loading = ref(true);

const total = computed(() => data.value?.total ?? 0);
const byNetwork = computed(() => data.value?.byNetwork ?? []);
const byDevice = computed(() => data.value?.byDevice ?? []);

const metricRows = computed(() => {
  const percentiles = data.value?.percentiles;
  if (!percentiles) return [] as { key: string; label: string; count: number; avg: string; p75: string; p95: string }[];

  const defs = [
    { key: 'lcp', label: 'LCP', unit: 'ms' },
    { key: 'cls', label: 'CLS', unit: '' },
    { key: 'fcp', label: 'FCP', unit: 'ms' },
    { key: 'ttfb', label: 'TTFB', unit: 'ms' },
    { key: 'inp', label: 'INP', unit: 'ms' },
  ];
  const fmt = (v: number, unit: string) => (unit === 'ms' ? String(Math.round(v)) : v.toFixed(3));

  const rows: { key: string; label: string; count: number; avg: string; p75: string; p95: string }[] = [];
  for (const d of defs) {
    const s = percentiles[d.key];
    if (!s) continue;
    rows.push({
      key: d.key,
      label: d.label,
      count: s.count,
      avg: fmt(s.avg, d.unit),
      p75: fmt(s.p75, d.unit),
      p95: fmt(s.p95, d.unit),
    });
  }
  return rows;
});

onMounted(async () => {
  try {
    const res = await fetch('/api/beacons');
    data.value = await res.json();
  } catch {
    data.value = null;
  } finally {
    loading.value = false;
  }
});
</script>
