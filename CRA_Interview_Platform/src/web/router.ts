import { createRouter, createWebHistory } from 'vue-router';
import { candidateAuth } from './candidate/auth';

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
      path: '/login',
      name: 'candidate-login',
      component: () => import('@web/views/candidate/CandidateLoginView.vue'),
      meta: { title: '候选人登录' },
    },
    {
      path: '/me',
      name: 'candidate-me',
      component: () => import('@web/views/candidate/CandidateMeView.vue'),
      meta: { title: '我的报名', requiresCandidateAuth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@web/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
});

router.beforeEach(async (to) => {
  document.title = `${String(to.meta.title ?? '在线面试平台')} · CRA`;

  if ((to.meta.requiresCandidateAuth || to.name === 'candidate-login') && !candidateAuth.initialized) {
    await candidateAuth.restore();
  }

  if (to.meta.requiresCandidateAuth && !candidateAuth.isAuthenticated) {
    return {
      name: 'candidate-login',
      query: { redirect: to.fullPath },
    };
  }

  if (to.name === 'candidate-login' && candidateAuth.isAuthenticated) {
    return { name: 'candidate-me' };
  }

  return true;
});
