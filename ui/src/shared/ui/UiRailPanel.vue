<template>
  <div class="panel">
    <nav ref="nav" class="rail" :aria-label="label" @keydown="onKeydown">
      <template v-for="(item, index) in items" :key="item.id">
        <span v-if="index > 0 && item.section !== items[index - 1]?.section" class="divider" />
        <UiTooltip :text="item.label" side="right">
          <button
            type="button"
            class="item"
            :class="{ active: item.id === model }"
            :data-page="item.id"
            :data-section="item.section"
            :aria-label="t('rail.goTo', { group: item.label })"
            :aria-current="item.id === model ? 'true' : undefined"
            :aria-describedby="item.mark ? `${uid}-${index}` : undefined"
            :tabindex="item.id === tabbable ? 0 : -1"
            @click="pick(item.id)"
          >
            <component :is="item.icon" :size="16" />
            <span v-if="item.mark" class="dot" aria-hidden="true" />
            <span v-if="item.mark" :id="`${uid}-${index}`" class="sr-only">{{ item.mark }}</span>
          </button>
        </UiTooltip>
      </template>
    </nav>

    <div ref="body" class="body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type Component } from "vue";

import { t } from "@/shared/i18n";
import { scrollParent } from "@/shared/lib/scrollParent";
import UiTooltip from "@/shared/ui/UiTooltip.vue";

/// Un panneau en pages, et sur son bord une rampe d'icônes : une par page, qui l'affiche seule. Le
/// contenu des pages est le créneau par défaut : c'est à l'hôte de n'y montrer que la page choisie.
/// `section` range les pages en groupes, séparés d'un trait fin.
const props = defineProps<{
  label: string;
  /** `mark` : ce que dit le point sur l'icône (« Modifié »), ou rien pour pas de point. */
  items: { id: string; label: string; icon: Component; mark?: string; section?: string }[];
}>();

/// Un clic, même sur la page déjà affichée : de quoi la déplier.
const emit = defineEmits<{ pick: [id: string] }>();

const model = defineModel<string>({ required: true });

function pick(id: string) {
  model.value = id;
  emit("pick", id);
}

/// Un seul bouton de la rampe se tabule (celui de la page affichée) : les flèches font le reste, et
/// Tab passe directement au contenu au lieu de traverser quinze icônes.
const tabbable = computed(() =>
  props.items.some((item) => item.id === model.value) ? model.value : props.items[0]?.id,
);

const nav = ref<HTMLElement | null>(null);

/// Haut et bas changent de page (la rampe est verticale), en bouclant ; Début et Fin vont aux extrémités.
function onKeydown(event: KeyboardEvent) {
  const last = props.items.length - 1;
  const current = props.items.findIndex((item) => item.id === tabbable.value);
  const target = {
    ArrowDown: current >= last ? 0 : current + 1,
    ArrowUp: current <= 0 ? last : current - 1,
    Home: 0,
    End: last,
  }[event.key];
  const item = target === undefined ? undefined : props.items[target];
  if (!item) return;

  event.preventDefault();
  pick(item.id);
  void nextTick(() => nav.value?.querySelectorAll("button")[target ?? 0]?.focus());
}

const body = ref<HTMLElement | null>(null);
const uid = useId();

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

.divider {
  width: 16px;
  height: 1px;
  margin: var(--space-1) auto;
  background: var(--border-strong);
}

.item {
  position: relative;
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

.dot {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--accent);
  box-shadow: 0 0 0 2px var(--surface);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.body {
  flex: 1;
  min-width: 0;

  /* Les curseurs s'y mesurent : assez large, ils tiennent sur une seule ligne (voir `UiSlider`). */
  container-type: inline-size;
  container-name: rail-body;
}
</style>
