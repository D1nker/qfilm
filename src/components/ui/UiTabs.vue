<script setup lang="ts" generic="T extends string">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui";

defineProps<{ tabs: { value: T; label: string }[] }>();

const model = defineModel<T>({ required: true });
</script>

<template>
  <TabsRoot v-model="model" class="tabs">
    <TabsList class="list">
      <TabsTrigger v-for="tab in tabs" :key="tab.value" :value="tab.value" class="trigger">
        {{ tab.label }}
      </TabsTrigger>
    </TabsList>

    <TabsContent v-for="tab in tabs" :key="tab.value" :value="tab.value" class="content">
      <slot :name="tab.value" />
    </TabsContent>
  </TabsRoot>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.list {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.trigger {
  position: relative;
  flex: 1;
  height: 40px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease);
}

.trigger:hover {
  color: var(--text);
}

.trigger[data-state="active"] {
  color: var(--text);
}

.trigger[data-state="active"]::after {
  content: "";
  position: absolute;
  right: var(--space-3);
  bottom: -1px;
  left: var(--space-3);
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--accent);
}

.trigger:focus-visible {
  outline: none;
  box-shadow: inset var(--focus-ring);
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-4);
}

.content:focus-visible {
  outline: none;
}
</style>
