import { createRouter, createWebHistory } from 'vue-router';
import { authStore } from './auth';

// 生产构建产物托管在 /user/ 下；开发模式由 vite dev server 直接服务根路径
const historyBase = import.meta.env.DEV ? '/' : '/user/';

export const router = createRouter({
  history: createWebHistory(historyBase),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('./views/LoginView.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/',
      name: 'my-interview',
      component: () => import('./views/MyInterviewView.vue'),
      meta: { title: '我的面试' },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('./views/NotFoundView.vue'),
      meta: { title: '页面不存在', public: true },
    },
  ],
});

router.beforeEach((to) => {
  document.title = `${String(to.meta.title ?? '用户端')} · CRA`;
  if (!to.meta.public && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});
