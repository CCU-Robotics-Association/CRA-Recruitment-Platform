<template>
  <div class="user-page">
    <div class="login-card">
      <div class="login-head">
        <h1 class="login-title">CRA 面试查询</h1>
        <p class="login-desc">使用报名时填写的学号与手机号登录，查看面试安排与结果</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @submit.prevent="submit">
        <el-form-item label="学号" prop="studentNumber">
          <el-input
            v-model="form.studentNumber"
            placeholder="9 位学号"
            maxlength="9"
            clearable
            :prefix-icon="Postcard"
          />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input
            v-model="form.phone"
            placeholder="报名时填写的手机号"
            maxlength="11"
            clearable
            :prefix-icon="Iphone"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="loading"
          native-type="submit"
        >
          登录
        </el-button>
      </el-form>
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
        class="login-error"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import { Postcard, Iphone } from '@element-plus/icons-vue';
import { api } from '../api';
import { authStore } from '../auth';

interface LoginResponse {
  token: string;
  expiresIn: number;
  user: {
    applicationId: number;
    name: string;
    studentNumber: string;
    phone: string;
    email: string;
  };
}

const route = useRoute();
const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const error = ref('');

const form = reactive({ studentNumber: '', phone: '' });

const rules: FormRules = {
  studentNumber: [
    { required: true, message: '请输入学号', trigger: 'blur' },
    { pattern: /^\d{9}$/, message: '学号应为 9 位数字', trigger: 'blur' },
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
};

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await api.post<LoginResponse>('/api/user/auth/login', {
      studentNumber: form.studentNumber.trim(),
      phone: form.phone.trim(),
    });
    authStore.set(res.token, res.user);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '登录失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.user-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px 16px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 12px;
  padding: 32px 28px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.login-head {
  margin-bottom: 24px;
}

.login-title {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 8px;
}

.login-desc {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.login-btn {
  width: 100%;
  margin-top: 8px;
}

.login-error {
  margin-top: 16px;
}
</style>
