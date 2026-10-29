<template>
  <div class="panel">
    <nav class="rail" :aria-label="label">
      <UiTooltip v-for="item in items" :key="item.id" :text="item.label" side="right">
        <button
          type="button"
          class="item"
          :class="{ active: item.id === active }"
          :aria-label="t('rail.goTo', { group: item.label })"
          :aria-current="item.id === active ? 'true' : undefined"
          @click="jump(item.id)"
        >
          <component :is="item.icon" :size="16" />
        </button>
      </UiTooltip>
    </nav>

    <div ref="body" class="body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, type Component } from "vue";

import { t } from "@/shared/i18n";
import { activeSection, scrollParent } from "@/shared/lib/scrollSpy";
import UiTooltip from "@/shared/ui/UiTooltip.vue";

/// Un panneau long, et sur son bord une rampe d'icônes : une par groupe, qui y mène et montre où l'on est.
/// Chaque groupe porte `data-rail="<id>"` ; le défilement est celui de l'ancêtre qui défile.
const props = defineProps<{
  label: string;
  items: { id: string; label: string; icon: Component }[];
}>();

/// Le repère se place un peu sous le haut du panneau : un titre qui vient d'y arriver compte déjà.
const MARKER = 24;

const body = ref<HTMLElement | null>(null);
const active = ref<string | null>(null);

let scroller: HTMLElement | null = null;
let observer: ResizeObserver | null = null;

/// Après un clic, le groupe visé reste le courant tant que l'on ne reprend pas la main : un groupe
/// court en fin de panneau ne peut pas monter jusqu'au repère, et on le verrait céder sa place au dernier.
let clicked: string | null = null;
const takeOver = () => {
  clicked = null;
};
const TAKE_OVER = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

const anchor = (id: string) =>
  body.value?.querySelector<HTMLElement>(`[data-rail="${id}"]`) ?? null;

function update() {
  if (!scroller || clicked) return;

  const top = scroller.getBoundingClientRect().top;
  const tops = props.items.map((item) => {
    const element = anchor(item.id);
    return element ? element.getBoundingClientRect().top - top : null;
  });
  // Un panneau qui tient sans défiler est « au bout » d'office : cela ne dit rien de la fin.
  const scrollable = scroller.scrollHeight > scroller.clientHeight + 2;
  const atEnd =
    scrollable && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;

  active.value = props.items[activeSection(tops, MARKER, atEnd)]?.id ?? null;
}

function jump(id: string) {
  const target = anchor(id);
  if (!target || !scroller) return;

  const offset = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  scroller.scrollTo({ top: scroller.scrollTop + offset - MARKER / 2, behavior: "smooth" });
  clicked = id;
  active.value = id;
}

onMounted(() => {
  scroller = scrollParent(body.value);
  scroller?.addEventListener("scroll", update, { passive: true });
  for (const type of TAKE_OVER) scroller?.addEventListener(type, takeOver, { passive: true });

  // Ouvrir ou fermer une section déplace les suivantes sans faire défiler quoi que ce soit.
  if (body.value) {
    observer = new ResizeObserver(update);
    observer.observe(body.value);
  }
  update();
});

onBeforeUnmount(() => {
  scroller?.removeEventListener("scroll", update);
  for (const type of TAKE_OVER) scroller?.removeEventListener(type, takeOver);
  observer?.disconnect();
});
</script>

<style scoped>
.panel {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.rail {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: var(--space-1);
}

.item {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

.item:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.item.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.body {
  flex: 1;
  min-width: 0;
}
</style>
