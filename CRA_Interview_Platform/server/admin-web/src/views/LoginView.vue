<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '../api';
import { authStore } from '../auth';
import type { AdminUser } from '../auth';

const route = useRoute();
const router = useRouter();

const form = reactive({ username: '', password: '' });
const loading = ref(false);

async function handleLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码');
    return;
  }
  loading.value = true;
  try {
    const resp = await api.post<{ token: string; expiresIn: number; user: AdminUser }>(
      '/api/admin/auth/login',
      form,
    );
    authStore.set(resp.token, resp.user);
    ElMessage.success(`欢迎回来，${resp.user.displayName}`);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    router.push(redirect);
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card">
      <h1 class="login-title">CRA 在线面试平台</h1>
      <p class="login-subtitle">管理端登录</p>
      <el-form label-position="top" @keyup.enter="handleLogin">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>
        <el-button type="primary" style="width: 100%" :loading="loading" @click="handleLogin">
          登 录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%);
}
.login-card {
  width: 380px;
  padding: 12px 8px;
}
.login-title {
  text-align: center;
  font-size: 22px;
  margin: 4px 0 0;
  color: #303133;
}
.login-subtitle {
  text-align: center;
  color: #909399;
  margin: 8px 0 20px;
}
</style>
