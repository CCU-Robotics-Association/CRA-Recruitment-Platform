<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import CandidateSiteNav from '@web/components/CandidateSiteNav.vue';
import { candidateApi } from '@web/candidate/api';
import { candidateAuth } from '@web/candidate/auth';
import { formatCn, formatTimeRange } from '@web/candidate/types';
import type { MyApplicationResponse } from '@web/candidate/types';
import 'element-plus/theme-chalk/el-message.css';

interface EditableSlot {
  id: number;
  startsAt: string;
  endsAt: string;
  remaining: number;
  current: boolean;
}

const QUESTION_LABELS: Record<string, string> = {
  placeholderQuestion1: '问题1占位',
  placeholderQuestion2: '问题2占位',
  placeholderQuestion3: '问题3占位',
};
const COLLEGES = ['计算机科学技术学院', '电子信息工程学院', '数学与统计学院'] as const;

const router = useRouter();
const loading = ref(true);
const refreshing = ref(false);
const errorMessage = ref('');
const accountData = ref<MyApplicationResponse | null>(null);
const editorOpen = ref(false);
const editorLoading = ref(false);
const saving = ref(false);
const editorError = ref('');
const emailVerificationSending = ref(false);
const emailVerificationCooldown = ref(0);
const emailVerificationTarget = ref('');
let emailVerificationTimer: number | undefined;
const editableSlots = ref<EditableSlot[]>([]);
const editNameInput = ref<HTMLInputElement | null>(null);
const editForm = reactive({
  name: '',
  gender: '' as '' | 'male' | 'female',
  college: '',
  phone: '',
  email: '',
  emailVerificationId: '',
  emailVerificationCode: '',
  slotId: 0,
  answers: {} as Record<string, string>,
});

const answerEntries = computed(() => Object.entries(accountData.value?.application.answers ?? {}));
const editorEmailChanged = computed(
  () =>
    editForm.email.trim().toLowerCase() !==
    (accountData.value?.application.email.trim().toLowerCase() ?? ''),
);

function questionLabel(key: string, index: number): string {
  return QUESTION_LABELS[key] ?? `问题 ${index + 1}`;
}

function genderLabel(gender: MyApplicationResponse['application']['gender']): string {
  if (gender === 'male') return '男';
  if (gender === 'female') return '女';
  return '—';
}

async function load(showRefreshing = false) {
  if (showRefreshing) refreshing.value = true;
  else loading.value = true;
  errorMessage.value = '';

  try {
    accountData.value = await candidateApi.get<MyApplicationResponse>('/api/user/me');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '报名信息加载失败';
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

function fillEditor() {
  const application = accountData.value?.application;
  if (!application) return;
  editForm.name = application.name;
  editForm.gender = application.gender === 'male' || application.gender === 'female' ? application.gender : '';
  editForm.college = application.college ?? '';
  editForm.phone = application.phone;
  editForm.email = application.email;
  editForm.emailVerificationId = '';
  editForm.emailVerificationCode = '';
  emailVerificationTarget.value = '';
  editForm.slotId = application.slot?.id ?? 0;
  editForm.answers = { ...application.answers };
  editableSlots.value = application.slot
    ? [{ ...application.slot, remaining: 0, current: true }]
    : [];
}

async function openEditor() {
  if (!accountData.value?.editable) {
    ElMessage.warning('报名已经结束，报名资料已锁定');
    return;
  }
  fillEditor();
  editorError.value = '';
  editorOpen.value = true;
  document.body.classList.add('candidate-editor-open');
  await nextTick();
  editNameInput.value?.focus();

  editorLoading.value = true;
  try {
    const result = await candidateApi.get<{ editable: boolean; slots: EditableSlot[] }>('/api/user/me/slots');
    if (!result.editable) {
      accountData.value.editable = false;
      editorError.value = '报名刚刚结束，资料已锁定';
      return;
    }
    editableSlots.value = result.slots;
    if (!editableSlots.value.some((slot) => slot.id === editForm.slotId)) editForm.slotId = 0;
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : '可预约时间加载失败';
  } finally {
    editorLoading.value = false;
  }
}

function closeEditor() {
  if (saving.value) return;
  editorOpen.value = false;
  editorError.value = '';
  document.body.classList.remove('candidate-editor-open');
}

function startEmailVerificationCooldown(seconds = 60) {
  if (emailVerificationTimer !== undefined) window.clearInterval(emailVerificationTimer);
  emailVerificationCooldown.value = seconds;
  emailVerificationTimer = window.setInterval(() => {
    emailVerificationCooldown.value -= 1;
    if (emailVerificationCooldown.value <= 0 && emailVerificationTimer !== undefined) {
      window.clearInterval(emailVerificationTimer);
      emailVerificationTimer = undefined;
    }
  }, 1000);
}

async function sendEditorEmailCode() {
  const application = accountData.value?.application;
  const email = editForm.email.trim().toLowerCase();
  if (!application || emailVerificationSending.value || emailVerificationCooldown.value > 0) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    ElMessage.warning('请先填写正确的新邮箱');
    return;
  }
  emailVerificationSending.value = true;
  editorError.value = '';
  try {
    const result = await candidateApi.post<{
      verificationId: string;
      expiresAt: string;
      devCode?: string;
    }>('/api/public/verifications/email', {
      studentNumber: application.studentNumber,
      email,
    });
    editForm.emailVerificationId = result.verificationId;
    editForm.emailVerificationCode = result.devCode ?? '';
    emailVerificationTarget.value = email;
    startEmailVerificationCooldown();
    ElMessage.success('验证码已发送到新邮箱');
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : '验证码发送失败，请稍后重试';
  } finally {
    emailVerificationSending.value = false;
  }
}

function validateEditor(): boolean {
  if (!editForm.name.trim()) {
    ElMessage.warning('请填写姓名');
    return false;
  }
  if (!editForm.gender) {
    ElMessage.warning('请选择性别');
    return false;
  }
  if (!COLLEGES.includes(editForm.college as (typeof COLLEGES)[number])) {
    ElMessage.warning('请选择学院');
    return false;
  }
  if (!/^1[3-9]\d{9}$/.test(editForm.phone.trim())) {
    ElMessage.warning('请输入正确的手机号');
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email.trim())) {
    ElMessage.warning('请输入正确的邮箱');
    return false;
  }
  if (
    editorEmailChanged.value &&
    (!editForm.emailVerificationId ||
      !/^\d{6}$/.test(editForm.emailVerificationCode.trim()) ||
      emailVerificationTarget.value !== editForm.email.trim().toLowerCase())
  ) {
    ElMessage.warning('请获取并填写新邮箱的 6 位验证码');
    return false;
  }
  if (!editForm.slotId) {
    ElMessage.warning('请选择有效的面试时间');
    return false;
  }
  if (Object.values(editForm.answers).some((answer) => !answer.trim())) {
    ElMessage.warning('请完整填写申请问答');
    return false;
  }
  return true;
}

async function saveEditor() {
  if (saving.value || !validateEditor()) return;
  saving.value = true;
  editorError.value = '';
  try {
    const updated = await candidateApi.put<MyApplicationResponse>('/api/user/me', {
      name: editForm.name.trim(),
      gender: editForm.gender,
      college: editForm.college,
      phone: editForm.phone.trim(),
      email: editForm.email.trim(),
      ...(editorEmailChanged.value
        ? {
            emailVerificationId: editForm.emailVerificationId,
            emailVerificationCode: editForm.emailVerificationCode.trim(),
          }
        : {}),
      slotId: editForm.slotId,
      answers: Object.fromEntries(
        Object.entries(editForm.answers).map(([key, value]) => [key, value.trim()]),
      ),
    });
    accountData.value = updated;
    if (candidateAuth.user) {
      candidateAuth.user.name = updated.application.name;
      candidateAuth.user.phone = updated.application.phone;
      candidateAuth.user.email = updated.application.email;
    }
    ElMessage.success('报名信息已更新');
    editorOpen.value = false;
    document.body.classList.remove('candidate-editor-open');
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : '保存失败，请稍后重试';
  } finally {
    saving.value = false;
  }
}

async function logout() {
  try {
    await candidateApi.post<void>('/api/user/auth/logout');
  } finally {
    candidateAuth.clear();
    await router.replace('/');
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && editorOpen.value) closeEditor();
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape);
  void load();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape);
  document.body.classList.remove('candidate-editor-open');
  if (emailVerificationTimer !== undefined) window.clearInterval(emailVerificationTimer);
});
</script>

<template>
  <main class="candidate-account-page">
    <header class="candidate-site-header candidate-account-header">
      <RouterLink class="candidate-account-brand" to="/" aria-label="返回 CRA 主页面">
        <img src="/cra/assets/cra-symbol-full.svg" alt="" />
        <span>
          <strong>CRA</strong>
          <small>CCU ROBOTICS ASSOCIATION</small>
        </span>
      </RouterLink>

      <CandidateSiteNav active="me" />

      <div class="candidate-site-actions">
        <button type="button" :disabled="refreshing" @click="load(true)">
          {{ refreshing ? '刷新中…' : '刷新' }}
        </button>
        <button type="button" @click="logout">退出登录</button>
      </div>
    </header>

    <section class="candidate-account-hero">
      <div>
        <p class="candidate-account-eyebrow">CRA / MY APPLICATION</p>
        <h1>我的报名</h1>
        <p v-if="candidateAuth.user">
          {{ candidateAuth.user.name }} · {{ candidateAuth.user.studentNumber }}
        </p>
      </div>
      <span aria-hidden="true">2026</span>
    </section>

    <section v-if="loading" class="candidate-account-loading" aria-live="polite">
      <span></span>
      <p>正在读取报名信息</p>
    </section>

    <section v-else-if="errorMessage" class="candidate-account-error">
      <p>{{ errorMessage }}</p>
      <button type="button" @click="load()">重新加载</button>
    </section>

    <div v-else-if="accountData" class="candidate-account-grid">
      <article class="candidate-account-card candidate-account-card--application">
        <header>
          <div>
            <span>01 / APPLICATION</span>
            <h2>报名信息</h2>
          </div>
          <div class="candidate-application-actions">
            <button
              v-if="accountData.editable"
              type="button"
              class="candidate-application-edit"
              @click="openEditor"
            >
              <span>编辑报名</span><i aria-hidden="true">↗</i>
            </button>
            <span v-else class="candidate-application-locked">报名已结束 · 资料已锁定</span>
          </div>
        </header>

        <dl class="candidate-account-details">
          <div><dt>姓名</dt><dd>{{ accountData.application.name }}</dd></div>
          <div><dt>学号</dt><dd>{{ accountData.application.studentNumber }}</dd></div>
          <div><dt>性别</dt><dd>{{ genderLabel(accountData.application.gender) }}</dd></div>
          <div><dt>学院</dt><dd>{{ accountData.application.college || '—' }}</dd></div>
          <div><dt>手机号</dt><dd>{{ accountData.application.phone }}</dd></div>
          <div><dt>邮箱</dt><dd>{{ accountData.application.email }}</dd></div>
          <div><dt>报名时间</dt><dd>{{ formatCn(accountData.application.createdAt) }}</dd></div>
          <div><dt>报名截止</dt><dd>{{ formatCn(accountData.application.round.applyEndAt) }}</dd></div>
        </dl>
      </article>

      <article class="candidate-account-card candidate-account-card--questions">
        <header>
          <div>
            <span>02 / QUESTIONS</span>
            <h2>问题</h2>
          </div>
        </header>
        <div v-if="answerEntries.length" class="candidate-answer-list">
          <section v-for="([key, answer], index) in answerEntries" :key="key">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <h3>{{ questionLabel(key, index) }}</h3>
              <p>{{ answer }}</p>
            </div>
          </section>
        </div>
        <div v-else class="candidate-account-empty">
          <strong>暂无申请问答</strong>
        </div>
      </article>

      <article class="candidate-account-card candidate-account-card--interview">
        <header>
          <div>
            <span>03 / INTERVIEW</span>
            <h2>面试安排</h2>
          </div>
        </header>

        <div v-if="accountData.application.slot" class="candidate-interview-slot">
          <span>北京时间</span>
          <strong>{{ formatTimeRange(accountData.application.slot.startsAt, accountData.application.slot.endsAt) }}</strong>
          <p>请按上述时间准时参加面试。</p>
        </div>
        <div v-else class="candidate-account-empty">
          <strong>尚未安排面试时段</strong>
          <p>安排完成后会显示在这里。</p>
        </div>
      </article>
    </div>

    <footer class="candidate-account-footer">
      <span>CCU ROBOTICS ASSOCIATION@2026</span>
      <span v-if="accountData?.editable">报名截止前可随时编辑并保存报名信息。</span>
      <span v-else>如报名信息有误，请联系协会负责人。</span>
    </footer>
  </main>

  <Teleport to="body">
    <Transition name="candidate-editor">
      <div v-if="editorOpen && accountData" class="candidate-editor-backdrop" @click.self="closeEditor">
        <section class="candidate-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="candidate-editor-title">
          <header>
            <div>
              <p>CRA / EDIT APPLICATION</p>
              <h2 id="candidate-editor-title">编辑报名信息</h2>
              <span>截止 {{ formatCn(accountData.application.round.applyEndAt) }} 前可保存修改</span>
            </div>
            <button type="button" aria-label="关闭编辑窗口" :disabled="saving" @click="closeEditor">×</button>
          </header>

          <form @submit.prevent="saveEditor">
            <section class="candidate-editor-section">
              <div class="candidate-editor-section__title"><span>01</span><h3>基本信息</h3></div>
              <div class="candidate-editor-fields">
                <label><span>姓名</span><input ref="editNameInput" v-model="editForm.name" maxlength="64" autocomplete="name" required /></label>
                <label><span>学号 · 登录账号</span><input :value="accountData.application.studentNumber" readonly aria-readonly="true" /></label>
                <label><span>性别</span><select v-model="editForm.gender" required><option value="" disabled>请选择</option><option value="male">男</option><option value="female">女</option></select></label>
                <label><span>学院</span><select v-model="editForm.college" required><option value="" disabled>请选择学院</option><option v-for="college in COLLEGES" :key="college" :value="college">{{ college }}</option></select></label>
                <label><span>手机号</span><input v-model="editForm.phone" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel" required /></label>
                <label><span>邮箱</span><input v-model="editForm.email" type="email" maxlength="254" autocomplete="email" required /></label>
                <label v-if="editorEmailChanged" class="candidate-editor-email-verification">
                  <span>验证新邮箱</span>
                  <div class="candidate-verification-input">
                    <input
                      v-model="editForm.emailVerificationCode"
                      type="text"
                      inputmode="numeric"
                      autocomplete="one-time-code"
                      maxlength="6"
                      placeholder="6 位验证码"
                      required
                    />
                    <button
                      type="button"
                      :disabled="emailVerificationSending || emailVerificationCooldown > 0"
                      @click="sendEditorEmailCode"
                    >
                      {{
                        emailVerificationSending
                          ? '发送中…'
                          : emailVerificationCooldown > 0
                            ? emailVerificationCooldown + ' 秒'
                            : '发送验证码'
                      }}
                    </button>
                  </div>
                </label>
              </div>
              <p class="candidate-editor-note">学号用于识别账号，报名后不可修改；修改邮箱需验证新邮箱，登录密码不会在此处显示。</p>
            </section>

            <section class="candidate-editor-section">
              <div class="candidate-editor-section__title"><span>02</span><h3>申请问答</h3></div>
              <div class="candidate-editor-answers">
                <label v-for="([key], index) in Object.entries(editForm.answers)" :key="key">
                  <span>{{ questionLabel(key, index) }}</span>
                  <textarea v-model="editForm.answers[key]" maxlength="2000" required></textarea>
                </label>
              </div>
            </section>

            <section class="candidate-editor-section">
              <div class="candidate-editor-section__title"><span>03</span><h3>面试时间</h3></div>
              <div v-if="editorLoading" class="candidate-editor-slot-state"><i></i><span>正在同步可预约时段</span></div>
              <div v-else-if="editableSlots.length" class="candidate-editor-slots" role="radiogroup" aria-label="选择面试时间">
                <label v-for="slot in editableSlots" :key="slot.id" :class="{ 'is-selected': editForm.slotId === slot.id }">
                  <input v-model="editForm.slotId" type="radio" name="edit-slot" :value="slot.id" />
                  <span>{{ formatTimeRange(slot.startsAt, slot.endsAt) }}</span>
                  <small>{{ slot.current ? '当前选择' : `剩余 ${slot.remaining} 个名额` }}</small>
                </label>
              </div>
              <div v-else class="candidate-editor-slot-state is-error">暂无可选择的面试时段</div>
            </section>

            <p v-if="editorError" class="candidate-editor-error" role="alert">{{ editorError }}</p>

            <footer>
              <button type="button" :disabled="saving" @click="closeEditor">取消</button>
              <button type="submit" :disabled="saving || editorLoading || Boolean(editorError)">
                <span>{{ saving ? '正在保存…' : '保存报名信息' }}</span><i aria-hidden="true">↗</i>
              </button>
            </footer>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
