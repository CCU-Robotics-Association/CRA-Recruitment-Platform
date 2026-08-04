import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'candidate-home',
      component: () => import('@web/views/candidate/CandidateHomeView.vue'),
      meta: { title: '在线面试平台' },
    },
    {
      path: '/apply',
      name: 'candidate-apply',
      component: () => import('@web/views/candidate/CandidateApplyView.vue'),
      meta: { title: '填写报名表' },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@web/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
});

router.beforeEach((to) => {
  document.title = `${String(to.meta.title ?? '在线面试平台')} · CRA`;
});
