<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import CandidateEntryPreloader from '@web/components/CandidateEntryPreloader.vue';
import CandidateSiteNav from '@web/components/CandidateSiteNav.vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import 'element-plus/theme-chalk/el-message.css';
import { candidateApi } from '@web/candidate/api';
import { candidateAuth } from '@web/candidate/auth';
import type { CandidateLoginResponse } from '@web/candidate/types';

const router = useRouter();

interface InterviewSlot {
  id: number;
  startsAt: string;
  endsAt: string;
  remaining?: number;
  available?: boolean;
}

const slots = ref<InterviewSlot[]>([]);
const applyPhase = ref<'not_started' | 'open' | 'ended'>('open');
const selectedSlotId = ref<number | ''>('');
const interviewMetaLoading = ref(true);
const interviewMetaError = ref('');
const submitting = ref(false);
const showEntryLoader = ref(true);
const pageRoot = ref<HTMLElement | null>(null);
let revealObserver: IntersectionObserver | undefined;
let revealFrame: number | undefined;
let interviewMetaRequestVersion = 0;
let emailCodeTimer: number | undefined;

/* ---------- 面试时段日历（按日期选择当天时段） ---------- */

// 时段按北京时间日期分组：key 形如 "2026-09-10"
function slotDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

const groupedSlots = computed(() => {
  const map = new Map<string, InterviewSlot[]>();
  for (const slot of slots.value) {
    const key = slotDateKey(slot.startsAt);
    const list = map.get(key);
    if (list) list.push(slot);
    else map.set(key, [slot]);
  }
  return map;
});

// 接口返回前先显示当前月份，成功后自动跳转到首个可预约日期
const initialDate = new Date();
const viewYear = ref(initialDate.getFullYear());
const viewMonth = ref(initialDate.getMonth()); // 0-11

// 当前选中日期（key 形如 "2026-09-10"；初始为第一个有时段的日期）
const selectedDateKey = ref('');

const effectiveSelectedDate = computed(() => {
  if (selectedDateKey.value && groupedSlots.value.has(selectedDateKey.value)) return selectedDateKey.value;
  const firstKey = Array.from(groupedSlots.value.keys())[0];
  return firstKey ?? '';
});

// 选中日期当天的时段
const daySlots = computed(() => groupedSlots.value.get(effectiveSelectedDate.value) ?? []);
const selectedSlot = computed(() => slots.value.find((slot) => slot.id === selectedSlotId.value));

// 当月日历格子（含行首补齐的空位）
const calendarDays = computed(() => {
  const year = viewYear.value;
  const month = viewMonth.value;
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=周日
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ key: string; day: number } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
});

function slotCountOn(key: string): number {
  return groupedSlots.value.get(key)?.length ?? 0;
}

function selectDay(key: string) {
  selectedDateKey.value = key;
  // 切换日期后，若原选中时段不在当天则清空选择
  const dayIds = (groupedSlots.value.get(key) ?? []).map((s) => s.id);
  if (selectedSlotId.value !== '' && !dayIds.includes(selectedSlotId.value)) selectedSlotId.value = '';
}

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11;
    viewYear.value -= 1;
  } else {
    viewMonth.value -= 1;
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0;
    viewYear.value += 1;
  } else {
    viewMonth.value += 1;
  }
}

// 选中日期中文显示，如 "2026年9月11日周五"
function formatDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
const form = reactive({
  name: '',
  studentNumber: '',
  gender: '' as '' | 'male' | 'female',
  college: '',
  email: '',
  emailVerificationCode: '',
  phone: '',
  password: '',
  confirmPassword: '',
  answers: {
    placeholderQuestion1: '',
    placeholderQuestion2: '',
    placeholderQuestion3: '',
  } as Record<string, string>,
});
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const emailVerificationId = ref('');
const emailVerificationTarget = ref('');
const emailCodeSending = ref(false);
const emailCodeCooldown = ref(0);

watch(
  () => [form.studentNumber.trim(), form.email.trim().toLowerCase()],
  ([studentNumber, email]) => {
    const target = studentNumber + ':' + email;
    if (emailVerificationTarget.value && emailVerificationTarget.value !== target) {
      emailVerificationId.value = '';
      form.emailVerificationCode = '';
    }
  },
);

const passwordRequirements = computed(() => [
  {
    key: 'length',
    label: '8–32 位',
    met: form.password.length >= 8 && form.password.length <= 32,
  },
  {
    key: 'letter',
    label: '包含英文字母',
    met: /[A-Za-z]/.test(form.password),
  },
  {
    key: 'number',
    label: '包含数字',
    met: /\d/.test(form.password),
  },
]);

const passwordStrength = computed(() => {
  const password = form.password;
  if (!password) {
    return {
      level: 0,
      label: '等待输入',
      tone: 'idle',
      hint: '密码至少 8 位，并同时包含英文字母和数字。',
    };
  }

  const meetsRequiredRules = passwordRequirements.value.every((requirement) => requirement.met);
  if (!meetsRequiredRules) {
    return {
      level: 1,
      label: '较弱',
      tone: 'weak',
      hint: '请先满足下方全部必需条件。',
    };
  }

  let score = 2;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9\s]/.test(password)) score += 1;

  if (score >= 5) {
    return {
      level: 4,
      label: '强密码',
      tone: 'strong',
      hint: '组合丰富，密码强度很好。',
    };
  }
  if (score >= 4) {
    return {
      level: 3,
      label: '较强',
      tone: 'good',
      hint: '已经比较可靠，再加入符号可进一步增强。',
    };
  }
  return {
    level: 2,
    label: '可用',
    tone: 'usable',
    hint: '已满足报名要求，建议达到 12 位并混合大小写与符号。',
  };
});

const passwordsMatch = computed(
  () => form.confirmPassword.length > 0 && form.password === form.confirmPassword,
);
let entryLoaderTimer: number | undefined;

onMounted(() => {
  entryLoaderTimer = window.setTimeout(() => {
    showEntryLoader.value = false;
  }, 3600);
  setupContentReveal();
  void loadInterviewMeta();
});

function setupContentReveal() {
  const root = pageRoot.value;
  if (!root) return;

  const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-candidate-reveal]'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((target) => target.classList.add('is-revealed'));
    return;
  }

  root.classList.add('has-reveal-motion');
  revealFrame = window.requestAnimationFrame(() => {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          revealObserver?.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -7% 0px' },
    );
    targets.forEach((target) => revealObserver?.observe(target));
  });
}

async function loadInterviewMeta() {
  const requestVersion = ++interviewMetaRequestVersion;
  interviewMetaLoading.value = true;
  interviewMetaError.value = '';
  slots.value = [];
  selectedSlotId.value = '';
  selectedDateKey.value = '';

  for (const retryDelay of [0, 450, 900]) {
    if (retryDelay > 0) await new Promise((resolve) => window.setTimeout(resolve, retryDelay));
    if (requestVersion !== interviewMetaRequestVersion) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6_000);
    try {
      const response = await fetch('/api/public/meta', {
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const meta = (await response.json()) as {
        round?: { applyPhase?: 'not_started' | 'open' | 'ended'; title?: string };
        slots?: InterviewSlot[];
      };
      if (!meta.round?.applyPhase || !Array.isArray(meta.slots)) throw new Error('INVALID_META');

      const availableSlots = meta.slots
        .filter(
          (slot) =>
            Number.isInteger(slot.id) &&
            slot.id > 0 &&
            Number.isFinite(Date.parse(slot.startsAt)) &&
            Number.isFinite(Date.parse(slot.endsAt)) &&
            slot.available !== false &&
            (slot.remaining === undefined || slot.remaining > 0),
        )
        .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));

      if (requestVersion !== interviewMetaRequestVersion) return;
      slots.value = availableSlots;
      applyPhase.value = meta.round.applyPhase;
      interviewMetaError.value = '';

      const firstAvailableSlot = availableSlots[0];
      if (firstAvailableSlot) {
        const firstDateKey = slotDateKey(firstAvailableSlot.startsAt);
        const [year, month] = firstDateKey.split('-').map(Number);
        selectedDateKey.value = firstDateKey;
        if (year && month) {
          viewYear.value = year;
          viewMonth.value = month - 1;
        }
      }

      if (applyPhase.value === 'not_started') {
        ElMessage.info('报名尚未开始，请耐心等待');
      } else if (applyPhase.value === 'ended') {
        ElMessage.info('本轮报名已结束');
      }
      interviewMetaLoading.value = false;
      window.clearTimeout(timeout);
      return;
    } catch {
      window.clearTimeout(timeout);
    }
  }

  if (requestVersion !== interviewMetaRequestVersion) return;
  interviewMetaLoading.value = false;
  interviewMetaError.value = '面试时间加载失败，请检查网络后重新加载';
  ElMessage.error(interviewMetaError.value);
}

onBeforeUnmount(() => {
  if (entryLoaderTimer !== undefined) window.clearTimeout(entryLoaderTimer);
  if (revealFrame !== undefined) window.cancelAnimationFrame(revealFrame);
  revealObserver?.disconnect();
  interviewMetaRequestVersion += 1;
  if (emailCodeTimer !== undefined) window.clearInterval(emailCodeTimer);
});

function formatTimeRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
}

function validateQuestionAnswers(): boolean {
  const visibleQuestions = [
    { key: 'placeholderQuestion1', title: '问题1占位' },
    { key: 'placeholderQuestion2', title: '问题2占位' },
    { key: 'placeholderQuestion3', title: '问题3占位' },
  ];

  for (const question of visibleQuestions) {
    const answer = form.answers[question.key];
    if (!answer?.trim()) {
      ElMessage.warning(`请填写“${question.title}”`);
      return false;
    }
  }
  return true;
}

function normalizeDigits(event: Event, field: 'studentNumber' | 'phone', maxLength: number) {
  const input = event.target as HTMLInputElement;
  const value = input.value.replace(/\D/g, '').slice(0, maxLength);
  input.value = value;
  form[field] = value;
}

function validateStudentNumber(showWarning = true): boolean {
  const isValid = /^\d{9}$/.test(form.studentNumber);
  if (!isValid && showWarning) ElMessage.warning('学号应为 9 位数字');
  return isValid;
}

function validatePhone(showWarning = true): boolean {
  const isValid = /^1[3-9]\d{9}$/.test(form.phone);
  if (!isValid && showWarning) ElMessage.warning('请输入正确的 11 位手机号');
  return isValid;
}

function validateEmail(showWarning = true): boolean {
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  if (!isValid && showWarning) ElMessage.warning('请输入正确的邮箱地址');
  return isValid;
}

async function requestEmailVerificationCode() {
  if (emailCodeSending.value || emailCodeCooldown.value > 0) return;
  if (!validateStudentNumber() || !validateEmail()) return;
  emailCodeSending.value = true;
  try {
    const response = await candidateApi.post<{
      verificationId: string;
      expiresAt: string;
      message: string;
      devCode?: string;
    }>('/api/public/verifications/email', {
      studentNumber: form.studentNumber.trim(),
      email: form.email.trim().toLowerCase(),
    });
    emailVerificationId.value = response.verificationId;
    emailVerificationTarget.value =
      form.studentNumber.trim() + ':' + form.email.trim().toLowerCase();
    if (response.devCode) form.emailVerificationCode = response.devCode;
    emailCodeCooldown.value = 60;
    if (emailCodeTimer !== undefined) window.clearInterval(emailCodeTimer);
    emailCodeTimer = window.setInterval(() => {
      emailCodeCooldown.value -= 1;
      if (emailCodeCooldown.value <= 0 && emailCodeTimer !== undefined) {
        window.clearInterval(emailCodeTimer);
        emailCodeTimer = undefined;
      }
    }, 1000);
    ElMessage.success(response.devCode ? '开发环境验证码已自动填入' : response.message);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '验证码发送失败，请稍后再试');
  } finally {
    emailCodeSending.value = false;
  }
}

function validatePassword(showWarning = true): boolean {
  const isValid =
    form.password.length >= 8 &&
    form.password.length <= 32 &&
    /[A-Za-z]/.test(form.password) &&
    /\d/.test(form.password);
  if (!isValid && showWarning) {
    ElMessage.warning('密码需为 8–32 位，并同时包含英文字母和数字');
    return false;
  }
  if (form.password !== form.confirmPassword) {
    if (showWarning) ElMessage.warning('两次输入的密码不一致');
    return false;
  }
  return true;
}

function validateBasicInformation(): boolean {
  if (!form.name.trim()) {
    ElMessage.warning('请输入姓名');
    return false;
  }
  if (!form.gender) {
    ElMessage.warning('请选择性别');
    return false;
  }
  if (!['计算机科学技术学院', '电子信息工程学院', '数学与统计学院'].includes(form.college)) {
    ElMessage.warning('请选择学院');
    return false;
  }
  if (!validateStudentNumber() || !validatePhone() || !validateEmail() || !validatePassword()) return false;
  if (!emailVerificationId.value || !/^\d{6}$/.test(form.emailVerificationCode)) {
    ElMessage.warning('请获取并填写 6 位邮箱验证码');
    return false;
  }
  return true;
}

async function submitRegistration() {
  if (submitting.value) return;
  if (interviewMetaLoading.value) {
    ElMessage.warning('面试时间仍在加载，请稍候');
    return;
  }
  if (interviewMetaError.value) {
    ElMessage.warning('请先重新加载面试时间');
    return;
  }
  if (!validateBasicInformation()) return;
  if (!validateQuestionAnswers()) return;
  if (!selectedSlotId.value || !selectedSlot.value) {
    ElMessage.warning('请选择面试时间');
    return;
  }
  if (applyPhase.value === 'not_started') {
    ElMessage.warning('报名尚未开始');
    return;
  }
  if (applyPhase.value === 'ended') {
    ElMessage.warning('本轮报名已结束');
    return;
  }

  const slotId = selectedSlotId.value;

  submitting.value = true;
  try {
    const response = await fetch('/api/public/applications', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        studentNumber: form.studentNumber.trim(),
        gender: form.gender,
        college: form.college.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
        emailVerificationId: emailVerificationId.value,
        emailVerificationCode: form.emailVerificationCode,
        slotId,
        answers: form.answers,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | { message?: string; error?: { code?: string; message?: string } }
      | null;

    if (!response.ok) {
      ElMessage.error(data?.error?.message ?? '报名提交失败，请稍后重试');
      return;
    }

    try {
      const login = await candidateApi.post<CandidateLoginResponse>('/api/user/auth/login', {
        studentNumber: form.studentNumber.trim(),
        password: form.password,
      });
      candidateAuth.set(login.user, login.csrfToken);
      window.sessionStorage.removeItem('cra_pending_student_number');
      ElMessage.success('报名成功，已进入我的报名');
      await router.replace({ name: 'candidate-me' });
    } catch {
      window.sessionStorage.setItem('cra_pending_student_number', form.studentNumber.trim());
      ElMessage.success('报名成功，请登录后查看报名信息');
      await router.replace({
        name: 'candidate-login',
        query: { redirect: '/me' },
      });
    }
  } catch {
    ElMessage.error('网络异常，报名提交失败，请稍后重试');
  } finally {
    submitting.value = false;
  }
}

</script>

<template>
  <main ref="pageRoot" class="candidate-form-page candidate-apply-page" :class="{ 'is-entry-loading': showEntryLoader }">
    <CandidateEntryPreloader v-if="showEntryLoader" />

    <header class="candidate-site-header candidate-apply-header">
      <RouterLink class="candidate-account-brand" to="/" aria-label="返回 CRA 主页面">
        <img src="/cra/assets/cra-symbol-full.svg" alt="" />
        <span>
          <strong>CRA</strong>
          <small>CCU ROBOTICS ASSOCIATION</small>
        </span>
      </RouterLink>

      <CandidateSiteNav active="apply" />
    </header>

    <section class="candidate-apply-intro" aria-labelledby="candidate-apply-title">
      <div class="candidate-apply-intro__copy" data-candidate-reveal="left" style="--candidate-reveal-delay: 60ms">
        <p class="candidate-apply-eyebrow">CRA / RECRUITMENT / 2026</p>
        <h1 id="candidate-apply-title">面试报名表</h1>
        <p>填写面试报名表，并选择适合的面试时段。提交成功后，可通过“我的报名”随时查看报名进度。</p>
      </div>

      <div
        class="candidate-apply-progress"
        data-candidate-reveal="right"
        style="--candidate-reveal-delay: 150ms"
        aria-label="报名流程"
      >
        <div>
          <span>01</span>
          <strong>填写面试表</strong>
          <small>完善个人信息与基础问答</small>
        </div>
        <div>
          <span>02</span>
          <strong>预约面试</strong>
          <small>选择合适的日期与时间</small>
        </div>
        <div>
          <span>03</span>
          <strong>提交报名</strong>
          <small>登录后查看或编辑报名信息</small>
        </div>
      </div>
    </section>

    <div class="candidate-apply-workspace">
      <form class="candidate-apply-form-card" @submit.prevent="submitRegistration">
        <header class="candidate-apply-card-heading" data-candidate-reveal="up">
          <span>01 / APPLICATION</span>
          <div>
            <h2>报名资料</h2>
            <p>请确保联系方式准确，后续通知将以此为准</p>
          </div>
        </header>

        <section class="candidate-apply-section" data-candidate-reveal="up" style="--candidate-reveal-delay: 40ms">
          <div class="candidate-apply-section-title">
            <span>01</span>
            <div>
              <h3>基本信息</h3>
              <p>用于身份核验与联系</p>
            </div>
          </div>

          <div class="candidate-apply-field-grid">
            <label class="candidate-apply-field">
              <span>姓名</span>
              <input v-model="form.name" type="text" maxlength="50" autocomplete="name" placeholder="请输入姓名" required />
            </label>

            <label class="candidate-apply-field">
              <span>性别</span>
              <select v-model="form.gender" required>
                <option value="" disabled>请选择性别</option>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </label>

            <label class="candidate-apply-field">
              <span>学号</span>
              <input
                v-model="form.studentNumber"
                type="text"
                inputmode="numeric"
                maxlength="9"
                pattern="[0-9]{9}"
                autocomplete="off"
                placeholder="请输入 9 位学号"
                title="请输入 9 位数字学号"
                required
                @input="normalizeDigits($event, 'studentNumber', 9)"
                @blur="form.studentNumber && validateStudentNumber()"
              />
            </label>

            <label class="candidate-apply-field">
              <span>学院</span>
              <select v-model="form.college" required>
                <option value="" disabled>请选择学院</option>
                <option value="计算机科学技术学院">计算机科学技术学院</option>
                <option value="电子信息工程学院">电子信息工程学院</option>
                <option value="数学与统计学院">数学与统计学院</option>
              </select>
            </label>

            <label class="candidate-apply-field">
              <span>手机号</span>
              <input
                v-model="form.phone"
                type="tel"
                inputmode="numeric"
                maxlength="11"
                pattern="1[3-9][0-9]{9}"
                autocomplete="tel"
                placeholder="用于接收面试通知"
                title="请输入正确的 11 位手机号"
                required
                @input="normalizeDigits($event, 'phone', 11)"
                @blur="form.phone && validatePhone()"
              />
            </label>

            <label class="candidate-apply-field">
              <span>邮箱</span>
              <input
                v-model="form.email"
                type="email"
                maxlength="254"
                autocomplete="email"
                placeholder="name@example.com"
                title="请输入正确的邮箱地址"
                required
                @blur="form.email && validateEmail()"
              />
            </label>

            <label class="candidate-apply-field candidate-apply-field--verification">
              <span>邮箱验证码</span>
              <div class="candidate-verification-input">
                <input
                  v-model="form.emailVerificationCode"
                  type="text"
                  inputmode="numeric"
                  maxlength="6"
                  pattern="[0-9]{6}"
                  autocomplete="one-time-code"
                  placeholder="请输入 6 位验证码"
                  required
                  @input="form.emailVerificationCode = ($event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6)"
                />
                <button
                  type="button"
                  :disabled="emailCodeSending || emailCodeCooldown > 0"
                  @click="requestEmailVerificationCode"
                >
                  {{
                    emailCodeSending
                      ? '发送中…'
                      : emailCodeCooldown > 0
                        ? emailCodeCooldown + ' 秒后重发'
                        : emailVerificationId
                          ? '重新发送'
                          : '获取验证码'
                  }}
                </button>
              </div>
              <small>验证码 10 分钟内有效，更换学号或邮箱后需要重新获取。</small>
            </label>
          </div>
        </section>

        <section class="candidate-apply-section" data-candidate-reveal="up" style="--candidate-reveal-delay: 60ms">
          <div class="candidate-apply-section-title">
            <span>02</span>
            <div>
              <h3>登录设置</h3>
              <p>报名后使用学号和密码查看进度</p>
            </div>
          </div>

          <div class="candidate-apply-field-grid">
            <label class="candidate-apply-field">
              <span>登录密码</span>
              <div class="candidate-password-input">
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  minlength="8"
                  maxlength="32"
                  autocomplete="new-password"
                  placeholder="8–32 位，包含英文字母和数字"
                  title="8–32 位，同时包含英文字母和数字"
                  required
                />
                <button
                  type="button"
                  class="candidate-password-visibility"
                  :aria-label="showPassword ? '隐藏登录密码' : '显示登录密码'"
                  :aria-pressed="showPassword"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? '隐藏' : '显示' }}
                </button>
              </div>
            </label>

            <label class="candidate-apply-field">
              <span>确认密码</span>
              <div class="candidate-password-input">
                <input
                  v-model="form.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  minlength="8"
                  maxlength="32"
                  autocomplete="new-password"
                  placeholder="请再次输入密码"
                  title="请再次输入登录密码"
                  required
                  @blur="form.confirmPassword && validatePassword()"
                />
                <button
                  type="button"
                  class="candidate-password-visibility"
                  :aria-label="showConfirmPassword ? '隐藏确认密码' : '显示确认密码'"
                  :aria-pressed="showConfirmPassword"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  {{ showConfirmPassword ? '隐藏' : '显示' }}
                </button>
              </div>
              <span
                v-if="form.confirmPassword"
                class="candidate-password-match"
                :class="passwordsMatch ? 'is-match' : 'is-mismatch'"
                role="status"
              >
                <i aria-hidden="true">{{ passwordsMatch ? '✓' : '!' }}</i>
                {{ passwordsMatch ? '两次输入一致' : '两次输入不一致' }}
              </span>
            </label>

            <div
              class="candidate-password-feedback"
              :class="`is-${passwordStrength.tone}`"
              role="status"
              aria-live="polite"
            >
              <div class="candidate-password-feedback__heading">
                <span>密码强度</span>
                <strong><i aria-hidden="true"></i>{{ passwordStrength.label }}</strong>
              </div>
              <div
                class="candidate-password-meter"
                role="progressbar"
                aria-label="密码强度"
                aria-valuemin="0"
                aria-valuemax="4"
                :aria-valuenow="passwordStrength.level"
                :aria-valuetext="passwordStrength.label"
              >
                <span
                  v-for="level in 4"
                  :key="level"
                  :class="{ 'is-active': level <= passwordStrength.level }"
                ></span>
              </div>
              <p>{{ passwordStrength.hint }}</p>
              <ul class="candidate-password-requirements" aria-label="密码必需条件">
                <li
                  v-for="requirement in passwordRequirements"
                  :key="requirement.key"
                  :class="{ 'is-met': requirement.met }"
                >
                  <i aria-hidden="true">{{ requirement.met ? '✓' : '·' }}</i>
                  {{ requirement.label }}
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section
          class="candidate-apply-section candidate-apply-section--questions"
          data-candidate-reveal="up"
          style="--candidate-reveal-delay: 60ms"
        >
          <div class="candidate-apply-section-title">
            <span>03</span>
            <div>
              <h3>申请问答</h3>
            </div>
          </div>

          <div class="candidate-apply-question-list">
            <label class="candidate-apply-field candidate-apply-field--question">
              <span>问题1占位</span>
              <textarea v-model="form.answers.placeholderQuestion1" maxlength="1000" placeholder="问题1占位" required></textarea>
            </label>

            <label class="candidate-apply-field candidate-apply-field--question">
              <span>问题2占位</span>
              <textarea v-model="form.answers.placeholderQuestion2" maxlength="1000" placeholder="问题2占位" required></textarea>
            </label>

            <label class="candidate-apply-field candidate-apply-field--question">
              <span>问题3占位</span>
              <textarea v-model="form.answers.placeholderQuestion3" maxlength="1000" placeholder="问题3占位" required></textarea>
            </label>
          </div>
        </section>
      </form>

      <aside
        class="candidate-appointment-panel candidate-apply-schedule-card"
        data-candidate-reveal="right"
        style="--candidate-reveal-delay: 120ms"
      >
        <div class="candidate-appointment-scroll">
          <header class="candidate-apply-card-heading candidate-apply-card-heading--schedule">
            <span>02 / INTERVIEW</span>
            <div>
              <h2>选择面试时间</h2>
              <p>选择有可预约标记的日期，再确定具体时段。</p>
            </div>
          </header>

          <div class="candidate-appointment-heading">
            <strong>预约日期</strong>
            <span v-if="effectiveSelectedDate">{{ formatDateKey(effectiveSelectedDate) }}</span>
          </div>

          <div class="candidate-appointment-calendar">
            <div class="calendar-nav">
              <button type="button" class="calendar-nav__btn" aria-label="上个月" @click="prevMonth">‹</button>
              <span class="calendar-nav__title">{{ viewYear }}年{{ viewMonth + 1 }}月</span>
              <button type="button" class="calendar-nav__btn" aria-label="下个月" @click="nextMonth">›</button>
            </div>
            <div class="calendar-weekdays">
              <span v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w">{{ w }}</span>
            </div>
            <div :key="`${viewYear}-${viewMonth}`" class="calendar-grid">
              <button
                v-for="(cell, index) in calendarDays"
                :key="index"
                type="button"
                class="calendar-day"
                :class="{
                  'is-empty': !cell,
                  'has-slots': cell && slotCountOn(cell.key) > 0,
                  'is-selected': cell && cell.key === effectiveSelectedDate,
                }"
                :disabled="!cell || slotCountOn(cell.key) === 0"
                @click="cell && selectDay(cell.key)"
              >
                <template v-if="cell">
                  {{ cell.day }}
                  <span v-if="slotCountOn(cell.key) > 0" class="calendar-day__badge">{{ slotCountOn(cell.key) }}</span>
                </template>
              </button>
            </div>
          </div>

          <div class="candidate-appointment-time-heading">
            <strong>可选时段</strong>
            <span v-if="interviewMetaLoading">正在同步…</span>
            <span v-else-if="interviewMetaError">加载失败</span>
            <span v-else>{{ daySlots.length }} 个可预约</span>
          </div>

          <div
            :key="effectiveSelectedDate"
            class="candidate-appointment-slots"
            role="radiogroup"
            aria-label="面试预订时间"
          >
            <label
              v-for="slot in daySlots"
              :key="slot.id"
              class="candidate-appointment-slot"
              :class="{ 'is-selected': selectedSlotId === slot.id }"
            >
              <input v-model="selectedSlotId" type="radio" name="candidate-appointment-time" :value="slot.id" />
              <span>{{ formatTimeRange(slot.startsAt, slot.endsAt) }}</span>
            </label>
            <div v-if="interviewMetaLoading" class="calendar-empty candidate-slot-state" aria-live="polite">
              <i class="candidate-slot-state__spinner" aria-hidden="true"></i>
              <span>正在加载可预约时间</span>
            </div>
            <div v-else-if="interviewMetaError" class="calendar-empty candidate-slot-state is-error" role="alert">
              <span>{{ interviewMetaError }}</span>
              <button type="button" class="candidate-slot-retry" @click="loadInterviewMeta">重新加载</button>
            </div>
            <div v-else-if="daySlots.length === 0" class="calendar-empty candidate-slot-state">
              当前日期暂无可预约时段
            </div>
          </div>

          <div class="candidate-appointment-selection" :class="{ 'has-selection': selectedSlot }">
            <span>当前选择</span>
            <template v-if="selectedSlot">
              <strong>{{ formatDateKey(slotDateKey(selectedSlot.startsAt)) }}</strong>
              <small>{{ formatTimeRange(selectedSlot.startsAt, selectedSlot.endsAt) }}</small>
            </template>
            <strong v-else>尚未选择面试时间</strong>
          </div>
        </div>

        <button
          class="candidate-confirm-registration"
          type="button"
          :disabled="submitting || interviewMetaLoading || Boolean(interviewMetaError) || slots.length === 0 || applyPhase !== 'open'"
          @click="submitRegistration"
        >
          {{ submitting ? '正在提交…' : interviewMetaLoading ? '正在加载面试时间…' : interviewMetaError ? '请重新加载面试时间' : slots.length === 0 ? '暂无可预约时段' : applyPhase === 'not_started' ? '报名尚未开始' : applyPhase === 'ended' ? '本轮报名已结束' : '确认并提交报名' }}
        </button>
        <p class="candidate-apply-submit-note">提交后可前往“我的报名”查看和管理报名信息</p>
      </aside>
    </div>
  </main>
</template>
