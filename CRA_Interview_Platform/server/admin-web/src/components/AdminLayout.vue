<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ElAside,
  ElConfigProvider,
  ElContainer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElHeader,
  ElIcon,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElMessageBox,
  ElTag,
} from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/es/components/aside/style/css';
import 'element-plus/es/components/container/style/css';
import 'element-plus/es/components/dropdown/style/css';
import 'element-plus/es/components/dropdown-item/style/css';
import 'element-plus/es/components/dropdown-menu/style/css';
import 'element-plus/es/components/header/style/css';
import 'element-plus/es/components/icon/style/css';
import 'element-plus/es/components/main/style/css';
import 'element-plus/es/components/menu/style/css';
import 'element-plus/es/components/menu-item/style/css';
import 'element-plus/es/components/message-box/style/css';
import 'element-plus/es/components/tag/style/css';
import {
  DataBoard,
  User,
  Calendar,
  Tickets,
  SwitchButton,
} from '@element-plus/icons-vue';
import { authStore } from '../auth';

const route = useRoute();
import { api } from '../api';
const router = useRouter();

const roleLabel = computed(() => {
  const map: Record<string, string> = {
    super_admin: '超级管理员',
    admin: '管理员',
    reviewer: '面试官',
  };
  return map[authStore.user?.role ?? ''] ?? authStore.user?.role ?? '';
});

const menus = [
  { path: '/', label: '仪表盘', icon: DataBoard, visible: true },
  { path: '/applications', label: '报名管理', icon: Tickets, visible: true },
  { path: '/slots', label: '面试时段', icon: Calendar, visible: authStore.canManage },
  { path: '/users', label: '账号管理', icon: User, visible: authStore.isSuperAdmin },
];

const activeMenu = computed(() => (route.path === '/' ? '/' : route.path));

async function handleLogout() {
  await ElMessageBox.confirm('确定退出登录吗？', '提示', { type: 'warning' });
  try {
    await api.post<void>('/api/admin/auth/logout');
  } finally {
    authStore.clear();
  }
  router.push('/login');
}
</script>

<template>
  <el-config-provider :locale="zhCn">
    <el-container class="admin-layout" style="height: 100%">
      <el-aside width="210px" class="admin-aside">
        <div class="admin-logo">CRA 面试平台</div>
        <el-menu :default-active="activeMenu" router background-color="#001529" text-color="#a6adb4" active-text-color="#ffffff">
          <el-menu-item v-for="menu in menus" v-show="menu.visible" :key="menu.path" :index="menu.path">
            <el-icon><component :is="menu.icon" /></el-icon>
            <span>{{ menu.label }}</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container>
        <el-header class="admin-header">
          <div class="admin-header__title">{{ route.meta.title ?? '' }}</div>
          <el-dropdown>
            <span class="admin-header__user">
              <el-icon><User /></el-icon>
              <span>{{ authStore.user?.displayName ?? authStore.user?.username }}</span>
              <el-tag size="small" type="info">{{ roleLabel }}</el-tag>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleLogout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-header>
        <el-main style="background: #f5f7fa; overflow-y: auto">
          <RouterView />
        </el-main>
      </el-container>
    </el-container>
  </el-config-provider>
</template>

<style scoped>
.admin-aside {
  background: #001529;
  display: flex;
  flex-direction: column;
}
.admin-logo {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  padding: 18px 20px;
  letter-spacing: 1px;
}
.admin-aside :deep(.el-menu) {
  border-right: none;
}
.admin-header {
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.admin-header__title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.admin-header__user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #606266;
}
</style>
