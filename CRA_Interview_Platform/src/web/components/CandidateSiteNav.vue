<script setup lang="ts">
import { ref } from 'vue';

type CandidateNavKey = 'home' | 'apply' | 'me';

defineProps<{
  active: CandidateNavKey;
}>();

const navItems = [
  { key: 'home', label: '主页面', to: '/' },
  { key: 'apply', label: '报名入口', to: '/apply' },
  { key: 'me', label: '我的报名', to: '/me' },
] as const;

const navRef = ref<HTMLElement | null>(null);
const indicatorRef = ref<HTMLElement | null>(null);

function showIndicator(event: Event) {
  const item = event.currentTarget;
  const indicator = indicatorRef.value;

  if (!(item instanceof HTMLElement) || !indicator) return;

  indicator.style.left = `${item.offsetLeft}px`;
  indicator.style.width = `${item.offsetWidth}px`;
  indicator.classList.add('is-visible');
}

function hideIndicator() {
  indicatorRef.value?.classList.remove('is-visible');
}

function handleFocusOut(event: FocusEvent) {
  const nextTarget = event.relatedTarget;
  if (!(nextTarget instanceof Node) || !navRef.value?.contains(nextTarget)) {
    hideIndicator();
  }
}
</script>

<template>
  <nav
    ref="navRef"
    class="candidate-site-nav"
    aria-label="候选人导航"
    @pointerleave="hideIndicator"
    @focusout="handleFocusOut"
  >
    <RouterLink
      v-for="item in navItems"
      :key="item.key"
      :to="item.to"
      :class="{ 'is-active': item.key === active }"
      :aria-current="item.key === active ? 'page' : undefined"
      @pointerenter="showIndicator"
      @focus="showIndicator"
    >
      {{ item.label }}
    </RouterLink>
    <i ref="indicatorRef" class="candidate-site-nav__indicator" aria-hidden="true"></i>
  </nav>
</template>
