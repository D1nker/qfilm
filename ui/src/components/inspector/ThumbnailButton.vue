<template>
  <button type="button" class="thumb" :class="{ active }">
    <span class="frame">
      <img v-if="src" :src="src" :alt="name" :class="fit" draggable="false" />
      <span v-else class="skeleton" />
    </span>
    <span class="name">{{ name }}</span>
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string;
    src?: string;
    active: boolean;
    fit?: "cover" | "contain";
  }>(),
  { src: undefined, fit: "cover" },
);
</script>

<style scoped>
.thumb {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-xs);
  text-align: left;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease);
}

.thumb:hover {
  color: var(--text);
}

.thumb:focus-visible {
  outline: none;
}

.frame {
  display: block;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-md);
  background: var(--surface-active);
  box-shadow: 0 0 0 1px var(--border);
  overflow: hidden;
  transition: box-shadow var(--duration-fast) var(--ease);
}

.thumb:hover .frame {
  box-shadow: 0 0 0 1px var(--border-strong);
}

.thumb:focus-visible .frame {
  box-shadow: var(--focus-ring);
}

.thumb.active .frame {
  box-shadow: 0 0 0 2px var(--accent);
}

.thumb.active {
  color: var(--accent);
  font-weight: var(--weight-medium);
}

img {
  display: block;
  width: 100%;
  height: 100%;
}

img.cover {
  object-fit: cover;
}

img.contain {
  object-fit: contain;
}

.skeleton {
  display: block;
  width: 100%;
  height: 100%;
}

@media (prefers-reduced-motion: no-preference) {
  .skeleton {
    background: linear-gradient(
      100deg,
      transparent 30%,
      color-mix(in oklch, var(--text) 8%, transparent) 50%,
      transparent 70%
    );
    background-size: 200% 100%;
    animation: shimmer 1.4s linear infinite;
  }
}

.name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

@keyframes shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
</style>
