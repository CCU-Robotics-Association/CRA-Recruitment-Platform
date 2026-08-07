import { createRouter, createWebHistory } from 'vue-router';
import { authStore } from './auth';

// 生产构建产物托管在 /admin/ 下；开发模式由 vite dev server 直接服务根路径
const historyBase = import.meta.env.DEV ? '/' : '/admin/';

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
      component: () => import('./components/AdminLayout.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('./views/DashboardView.vue'),
          meta: { title: '仪表盘' },
        },
        {
          path: 'applications',
          name: 'applications',
          component: () => import('./views/ApplicationsView.vue'),
          meta: { title: '报名管理' },
        },
        {
          path: 'slots',
          name: 'slots',
          component: () => import('./views/SlotsView.vue'),
          meta: { title: '面试时段', role: ['super_admin', 'admin'] },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('./views/UsersView.vue'),
          meta: { title: '账号管理', role: ['super_admin'] },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('./views/NotFoundView.vue'),
      meta: { title: '页面不存在', public: true },
    },
  ],
});

router.beforeEach((to) => {
  document.title = `${String(to.meta.title ?? '管理端')} · CRA`;
  if (!to.meta.public && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  const requiredRoles = to.meta.role as string[] | undefined;
  if (requiredRoles && authStore.user && !requiredRoles.includes(authStore.user.role)) {
    return { name: 'dashboard' };
  }
  return true;
});
