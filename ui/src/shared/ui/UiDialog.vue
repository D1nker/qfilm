<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="overlay" />
      <DialogContent
        class="content"
        :class="`content--${size}`"
        @escape-key-down="emit('escapeKeyDown', $event)"
      >
        <header class="head">
          <DialogTitle class="title">{{ title }}</DialogTitle>
          <DialogDescription class="sr-only">{{ description }}</DialogDescription>
          <DialogClose class="close" :aria-label="t('dialog.close')">
            <X :size="16" />
          </DialogClose>
        </header>

        <div class="body">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="foot">
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { X } from "lucide-vue-next";

import { t } from "@/shared/i18n";

withDefaults(
  defineProps<{
    title: string;
    /** Lue par les lecteurs d'écran, jamais affichée. */
    description: string;
    size?: "md" | "lg";
  }>(),
  { size: "lg" },
);

const emit = defineEmits<{ escapeKeyDown: [event: KeyboardEvent] }>();

const open = defineModel<boolean>("open", { required: true });
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: oklch(0 0 0 / 0.5);
}

.overlay[data-state="open"] {
  animation: fade-in var(--duration) var(--ease);
}

.overlay[data-state="closed"] {
  animation: fade-out var(--duration) var(--ease);
}

.content {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 51;
  display: flex;
  flex-direction: column;
  width: min(1180px, calc(100vw - 64px));
  height: min(760px, calc(100vh - 64px));
  transform: translate(-50%, -50%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.content--md {
  width: min(420px, calc(100vw - 64px));
  height: auto;
  max-height: calc(100vh - 64px);
}

.content[data-state="open"] {
  animation: pop-in var(--duration) var(--ease);
}

.content[data-state="closed"] {
  animation: pop-out var(--duration) var(--ease);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
}

.title {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.close {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.close:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.close:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.content--md .body {
  flex-direction: column;
  padding: var(--space-2) var(--space-4) var(--space-4);
}

.foot {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}

@keyframes fade-out {
  to {
    opacity: 0;
  }
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.98);
  }
}

@keyframes pop-out {
  to {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.98);
  }
}
</style>
