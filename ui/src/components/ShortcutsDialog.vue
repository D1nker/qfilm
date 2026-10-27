<template>
  <UiDialog
    v-model:open="shortcutsOpen"
    size="md"
    title="Raccourcis clavier"
    description="La liste des raccourcis clavier de qFilm."
  >
    <section v-for="group in SHORTCUT_GROUPS" :key="group.title">
      <h3>{{ group.title }}</h3>
      <dl>
        <div v-for="shortcut in group.shortcuts" :key="shortcut.label" class="row">
          <dt>{{ shortcut.label }}</dt>
          <dd>
            <kbd v-for="key in shortcut.keys" :key="key">{{ key }}</kbd>
          </dd>
        </div>
      </dl>
    </section>
  </UiDialog>
</template>

<script setup lang="ts">
import { SHORTCUT_GROUPS } from "@/lib/shortcuts";
import { useHelp } from "@/composables/useHelp";
import UiDialog from "@/components/ui/UiDialog.vue";

const { shortcutsOpen } = useHelp();
</script>

<style scoped>
section:first-child {
  padding-top: var(--space-2);
}

section + section {
  margin-top: var(--space-4);
}

h3 {
  margin-bottom: var(--space-1);
  color: var(--text-faint);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

dl,
dd {
  margin: 0;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  font-size: var(--text-sm);
}

dd {
  display: flex;
  gap: var(--space-1);
}

kbd {
  min-width: 22px;
  padding: 2px 6px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-active);
  color: var(--text-muted);
  font: inherit;
  font-size: var(--text-xs);
  text-align: center;
}
</style>
