<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import CandidateEntryPreloader from '@web/components/CandidateEntryPreloader.vue';
import CandidateSiteNav from '@web/components/CandidateSiteNav.vue';
import { useRoute, useRouter } from 'vue-router';
import { candidateApi } from '@web/candidate/api';
import { candidateAuth } from '@web/candidate/auth';
import type { CandidateLoginResponse } from '@web/candidate/types';

const route = useRoute();
const router = useRouter();
const form = reactive({
  studentNumber: '',
  password: '',
});
const submitting = ref(false);
const errorMessage = ref('');
const resetVisible = ref(false);
const resetSubmitting = ref(false);
const resetCodeSending = ref(false);
const resetCodeCooldown = ref(0);
const resetMessage = ref('');
const resetError = ref('');
const resetVerificationId = ref('');
const resetForm = reactive({
  studentNumber: '',
  email: '',
  code: '',
  newPassword: '',
  confirmPassword: '',
});
const showEntryLoader = ref(true);
let entryLoaderTimer: number | undefined;
let resetCodeTimer: number | undefined;

const submitLabel = computed(() => (submitting.value ? '正在验证…' : '进入我的报名'));

onMounted(() => {
  entryLoaderTimer = window.setTimeout(() => {
    showEntryLoader.value = false;
  }, 3600);
  try {
    form.studentNumber = window.sessionStorage.getItem('cra_pending_student_number') ?? '';
  } catch {
    form.studentNumber = '';
  }
});

onBeforeUnmount(() => {
  if (entryLoaderTimer !== undefined) window.clearTimeout(entryLoaderTimer);
  if (resetCodeTimer !== undefined) window.clearInterval(resetCodeTimer);
});

function normalizeStudentNumber() {
  form.studentNumber = form.studentNumber.replace(/\D/g, '').slice(0, 9);
}

function normalizeResetStudentNumber() {
  resetForm.studentNumber = resetForm.studentNumber.replace(/\D/g, '').slice(0, 9);
}

function openPasswordReset() {
  resetVisible.value = true;
  resetMessage.value = '';
  resetError.value = '';
  resetForm.studentNumber = form.studentNumber;
}

async function requestResetCode() {
  if (resetCodeSending.value || resetCodeCooldown.value > 0) return;
  resetError.value = '';
  resetMessage.value = '';
  if (!/^\d{9}$/.test(resetForm.studentNumber)) {
    resetError.value = '请输入 9 位数字学号';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetForm.email.trim())) {
    resetError.value = '请输入报名时填写的邮箱';
    return;
  }

  resetCodeSending.value = true;
  try {
    const response = await candidateApi.post<{
      verificationId: string;
      message: string;
      devCode?: string;
    }>('/api/user/auth/password-reset/request', {
      studentNumber: resetForm.studentNumber,
      email: resetForm.email.trim().toLowerCase(),
    });
    resetVerificationId.value = response.verificationId;
    if (response.devCode) resetForm.code = response.devCode;
    resetMessage.value = response.devCode ? '开发环境验证码已自动填入' : response.message;
    resetCodeCooldown.value = 60;
    if (resetCodeTimer !== undefined) window.clearInterval(resetCodeTimer);
    resetCodeTimer = window.setInterval(() => {
      resetCodeCooldown.value -= 1;
      if (resetCodeCooldown.value <= 0 && resetCodeTimer !== undefined) {
        window.clearInterval(resetCodeTimer);
        resetCodeTimer = undefined;
      }
    }, 1000);
  } catch (error) {
    resetError.value = error instanceof Error ? error.message : '验证码发送失败，请稍后再试';
  } finally {
    resetCodeSending.value = false;
  }
}

async function confirmPasswordReset() {
  if (resetSubmitting.value) return;
  resetError.value = '';
  resetMessage.value = '';
  if (!resetVerificationId.value || !/^\d{6}$/.test(resetForm.code)) {
    resetError.value = '请先获取并填写 6 位验证码';
    return;
  }
  if (
    resetForm.newPassword.length < 8 ||
    resetForm.newPassword.length > 32 ||
    !/[A-Za-z]/.test(resetForm.newPassword) ||
    !/\d/.test(resetForm.newPassword)
  ) {
    resetError.value = '新密码需为 8–32 位，并同时包含英文字母和数字';
    return;
  }
  if (resetForm.newPassword !== resetForm.confirmPassword) {
    resetError.value = '两次输入的新密码不一致';
    return;
  }

  resetSubmitting.value = true;
  try {
    const response = await candidateApi.post<{ message: string }>(
      '/api/user/auth/password-reset/confirm',
      {
        studentNumber: resetForm.studentNumber,
        email: resetForm.email.trim().toLowerCase(),
        verificationId: resetVerificationId.value,
        verificationCode: resetForm.code,
        newPassword: resetForm.newPassword,
      },
    );
    form.studentNumber = resetForm.studentNumber;
    form.password = resetForm.newPassword;
    resetVisible.value = false;
    errorMessage.value = '';
    resetMessage.value = response.message;
  } catch (error) {
    resetError.value = error instanceof Error ? error.message : '密码重置失败，请稍后再试';
  } finally {
    resetSubmitting.value = false;
  }
}

function getSafeRedirect(): string {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/me';
  return redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/me';
}

function validatePassword(): boolean {
  if (
    form.password.length < 8 ||
    form.password.length > 32 ||
    !/[A-Za-z]/.test(form.password) ||
    !/\d/.test(form.password)
  ) {
    errorMessage.value = '密码需为 8–32 位，并同时包含英文字母和数字';
    return false;
  }
  return true;
}

async function submit() {
  if (submitting.value) return;
  errorMessage.value = '';

  if (!/^\d{9}$/.test(form.studentNumber)) {
    errorMessage.value = '请输入 9 位数字学号';
    return;
  }
  if (!validatePassword()) return;

  submitting.value = true;
  try {
    const response = await candidateApi.post<CandidateLoginResponse>('/api/user/auth/login', {
      studentNumber: form.studentNumber,
      password: form.password,
    });
    candidateAuth.set(response.user, response.csrfToken);
    window.sessionStorage.removeItem('cra_pending_student_number');
    await router.replace(getSafeRedirect());
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '操作失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="candidate-login-page" :class="{ 'is-entry-loading': showEntryLoader }">
    <CandidateEntryPreloader v-if="showEntryLoader" />

    <header class="candidate-site-header candidate-login-header">
      <RouterLink class="candidate-account-brand" to="/" aria-label="返回 CRA 主页面">
        <img src="/cra/assets/cra-symbol-full.svg" alt="" />
        <span>
          <strong>CRA</strong>
          <small>CCU ROBOTICS ASSOCIATION</small>
        </span>
      </RouterLink>

      <CandidateSiteNav active="me" />
    </header>

    <section class="candidate-login-intro">
      <p class="candidate-account-eyebrow">CRA / CANDIDATE / 2026</p>
      <h1>
        查看你的
        <span>报名与面试</span>
      </h1>
    </section>

    <section class="candidate-login-panel" aria-labelledby="candidate-login-title">
      <header>
        <span>01</span>
        <div>
          <p>候选人入口</p>
          <h2 id="candidate-login-title">登录我的报名</h2>
        </div>
      </header>

      <form @submit.prevent="submit">
        <label>
          <span>学号</span>
          <input
            v-model="form.studentNumber"
            type="text"
            inputmode="numeric"
            maxlength="9"
            autocomplete="username"
            placeholder="9 位数字学号"
            @input="normalizeStudentNumber"
          />
        </label>


        <label>
          <span>密码</span>
          <input
            v-model="form.password"
            type="password"
            minlength="8"
            maxlength="32"
            autocomplete="current-password"
            placeholder="输入报名时设置的密码"
          />
        </label>


        <p class="candidate-login-hint">
          忘记密码？
          <button type="button" @click="openPasswordReset">使用报名邮箱重置</button>
        </p>
        <p v-if="resetMessage && !resetVisible" class="candidate-login-success" role="status">
          {{ resetMessage }}
        </p>
        <p v-if="errorMessage" class="candidate-login-error" role="alert">{{ errorMessage }}</p>

        <button type="submit" :disabled="submitting">
          <span>{{ submitLabel }}</span>
          <span aria-hidden="true">↗</span>
        </button>
      </form>

      <section v-if="resetVisible" class="candidate-password-reset" aria-labelledby="candidate-reset-title">
        <header>
          <div>
            <p>安全验证</p>
            <h3 id="candidate-reset-title">重置报名密码</h3>
          </div>
          <button type="button" aria-label="关闭密码重置" @click="resetVisible = false">×</button>
        </header>

        <form @submit.prevent="confirmPasswordReset">
          <label>
            <span>学号</span>
            <input
              v-model="resetForm.studentNumber"
              type="text"
              inputmode="numeric"
              maxlength="9"
              autocomplete="username"
              placeholder="9 位数字学号"
              @input="normalizeResetStudentNumber"
            />
          </label>
          <label>
            <span>报名邮箱</span>
            <input
              v-model="resetForm.email"
              type="email"
              maxlength="254"
              autocomplete="email"
              placeholder="报名时填写的邮箱"
            />
          </label>
          <label>
            <span>邮箱验证码</span>
            <div class="candidate-reset-code">
              <input
                v-model="resetForm.code"
                type="text"
                inputmode="numeric"
                maxlength="6"
                autocomplete="one-time-code"
                placeholder="6 位验证码"
              />
              <button
                type="button"
                :disabled="resetCodeSending || resetCodeCooldown > 0"
                @click="requestResetCode"
              >
                {{
                  resetCodeSending
                    ? '发送中…'
                    : resetCodeCooldown > 0
                      ? resetCodeCooldown + ' 秒'
                      : '获取验证码'
                }}
              </button>
            </div>
          </label>
          <label>
            <span>新密码</span>
            <input
              v-model="resetForm.newPassword"
              type="password"
              minlength="8"
              maxlength="32"
              autocomplete="new-password"
              placeholder="8–32 位，包含字母和数字"
            />
          </label>
          <label>
            <span>确认新密码</span>
            <input
              v-model="resetForm.confirmPassword"
              type="password"
              minlength="8"
              maxlength="32"
              autocomplete="new-password"
              placeholder="再次输入新密码"
            />
          </label>
          <p v-if="resetMessage" class="candidate-login-success" role="status">{{ resetMessage }}</p>
          <p v-if="resetError" class="candidate-login-error" role="alert">{{ resetError }}</p>
          <button type="submit" :disabled="resetSubmitting">
            <span>{{ resetSubmitting ? '正在重置…' : '确认重置密码' }}</span>
            <span aria-hidden="true">↗</span>
          </button>
        </form>
      </section>

      <footer class="candidate-login-panel-footer">
        <RouterLink to="/apply">还没有报名？填写报名表</RouterLink>
      </footer>
    </section>
  </main>
</template>
