<template>
  <div class="panel">
    <nav class="rail" :aria-label="label">
      <UiTooltip v-for="item in items" :key="item.id" :text="item.label" side="right">
        <button
          type="button"
          class="item"
          :class="{ active: item.id === model }"
          :aria-label="t('rail.goTo', { group: item.label })"
          :aria-current="item.id === model ? 'true' : undefined"
          @click="pick(item.id)"
        >
          <component :is="item.icon" :size="16" />
        </button>
      </UiTooltip>
    </nav>

    <div ref="body" class="body">
      <div v-for="item in items" v-show="item.id === model" :key="item.id" class="page">
        <slot :name="item.id" />
      </div>
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch, type Component } from "vue";

import { t } from "@/shared/i18n";
import { scrollParent } from "@/shared/lib/scrollParent";
import UiTooltip from "@/shared/ui/UiTooltip.vue";

/// Un panneau en pages, et sur son bord une rampe d'icônes : une par page, qui l'affiche seule. Le
/// contenu de chaque page vient du créneau qui porte son identifiant ; `footer` suit la page affichée, quelle qu'elle soit.
defineProps<{
  label: string;
  items: { id: string; label: string; icon: Component }[];
}>();

/// Un clic, même sur la page déjà affichée : de quoi la déplier.
const emit = defineEmits<{ pick: [id: string] }>();

defineSlots<Record<string, () => unknown>>();

const model = defineModel<string>({ required: true });

function pick(id: string) {
  model.value = id;
  emit("pick", id);
}

const body = ref<HTMLElement | null>(null);

// Une autre page commence en haut, pas là où l'on avait défilé dans la précédente.
watch(model, async () => {
  await nextTick();
  scrollParent(body.value)?.scrollTo({ top: 0 });
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

  /* Les curseurs s'y mesurent : assez large, ils tiennent sur une seule ligne (voir `UiSlider`). */
  container-type: inline-size;
  container-name: rail-body;
}
</style>
