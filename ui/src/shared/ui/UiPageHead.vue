<template>
  <div class="head">
    <h3 class="title">{{ title }}</h3>
    <div class="actions">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/// Le titre d'une page de panneau : en capitales, avec à droite ce que la page propose (sa réinitialisation).
defineProps<{ title: string }>();
</script>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  margin-bottom: var(--space-2);
}

.title {
  margin: 0;
  color: var(--text);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.actions {
  display: flex;
  align-items: center;
}
</style>
