<script setup lang="ts">
import { computed } from "vue";
import { FolderOpen, RefreshCw, Trash2 } from "lucide-vue-next";

import { useFrame } from "@/composables/useFrame";
import UiButton from "@/components/ui/UiButton.vue";
import UiTooltip from "@/components/ui/UiTooltip.vue";

const { frames, issues, remove, importArchive, importFolder, reload, showFolder } = useFrame();

const mine = computed(() => frames.value.filter((info) => !info.builtin));
</script>

<template>
  <div class="library">
    <p class="intro">
      Un cadre est un dossier avec un <code>frame.json</code> et un <code>frame.svg</code>. Importe
      une archive <code>.zip</code> (ou dépose-la sur la fenêtre), ou un dossier.
    </p>

    <div class="actions">
      <UiButton size="sm" @click="importArchive">Importer un .zip</UiButton>
      <UiButton size="sm" @click="importFolder">Importer un dossier</UiButton>
    </div>

    <ul v-if="mine.length" class="list">
      <li v-for="info in mine" :key="info.id">
        <span class="name">{{ info.name }}</span>
        <UiTooltip text="Supprimer ce cadre">
          <UiButton
            variant="ghost"
            size="sm"
            icon
            :aria-label="`Supprimer le cadre ${info.name}`"
            @click="remove(info.id)"
          >
            <Trash2 :size="14" />
          </UiButton>
        </UiTooltip>
      </li>
    </ul>
    <p v-else class="empty">Aucun cadre importé pour l'instant.</p>

    <ul v-if="issues.length" class="issues" role="alert">
      <li v-for="issue in issues" :key="issue.folder">
        <strong>{{ issue.folder }}</strong> : {{ issue.message }}
      </li>
    </ul>

    <div class="actions">
      <UiButton variant="ghost" size="sm" @click="showFolder">
        <FolderOpen :size="14" />
        Ouvrir le dossier
      </UiButton>
      <UiTooltip text="Relire le dossier, pour voir un cadre en cours d'écriture">
        <UiButton variant="ghost" size="sm" @click="reload">
          <RefreshCw :size="14" />
          Recharger
        </UiButton>
      </UiTooltip>
    </div>
  </div>
</template>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.intro,
.empty {
  color: var(--text-faint);
  font-size: var(--text-xs);
  line-height: 1.5;
}

code {
  padding: 1px 4px;
  border-radius: var(--radius-sm);
  background: var(--surface-active);
  font-size: var(--text-xs);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.list,
.issues {
  margin: 0;
  padding: 0;
  list-style: none;
}

.list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.list li:hover {
  background: var(--surface-hover);
}

.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issues {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--danger);
  border-radius: var(--radius-md);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: var(--text-xs);
  line-height: 1.5;
}
</style>
