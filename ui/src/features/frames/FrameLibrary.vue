<template>
  <div class="library">
    <i18n-t keypath="frames.library.intro" tag="p" class="intro">
      <template #manifest><code>frame.json</code></template>
      <template #template><code>frame.svg</code></template>
      <template #zip><code>.zip</code></template>
    </i18n-t>

    <div class="actions">
      <UiButton size="sm" @click="importArchive">
        {{ t("frames.library.importArchive") }}
      </UiButton>
      <UiButton size="sm" @click="importFolder">
        {{ t("frames.library.importFolder") }}
      </UiButton>
    </div>

    <ul v-if="mine.length" class="list">
      <li v-for="info in mine" :key="info.id">
        <span class="name">{{ info.name }}</span>
        <UiTooltip :text="t('frames.library.remove')">
          <UiButton
            variant="ghost"
            size="sm"
            icon
            :aria-label="t('frames.library.removeNamed', { name: info.name })"
            @click="remove(info.id)"
          >
            <Trash2 :size="14" />
          </UiButton>
        </UiTooltip>
      </li>
    </ul>
    <p v-else class="empty">{{ t("frames.library.empty") }}</p>

    <ul v-if="issues.length" class="issues" role="alert">
      <li v-for="issue in issues" :key="issue.folder">
        <strong>{{ issue.folder }}</strong> : {{ issue.message }}
      </li>
    </ul>

    <div class="actions">
      <UiButton variant="ghost" size="sm" @click="showFolder">
        <FolderOpen :size="14" />
        {{ t("frames.library.openFolder") }}
      </UiButton>
      <UiTooltip :text="t('frames.library.reloadHint')">
        <UiButton variant="ghost" size="sm" @click="reload">
          <RefreshCw :size="14" />
          {{ t("frames.library.reload") }}
        </UiButton>
      </UiTooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from "@/shared/i18n";
import { computed } from "vue";
import { FolderOpen, RefreshCw, Trash2 } from "lucide-vue-next";

import { useFrame } from "@/features/frames/useFrame";
import UiButton from "@/shared/ui/UiButton.vue";
import UiTooltip from "@/shared/ui/UiTooltip.vue";

const { frames, issues, remove, importArchive, importFolder, reload, showFolder } = useFrame();

const mine = computed(() => frames.value.filter((info) => !info.builtin));
</script>

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
