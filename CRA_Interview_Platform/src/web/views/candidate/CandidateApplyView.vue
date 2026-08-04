<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import 'element-plus/theme-chalk/el-message.css';

const paperTextureImage = '/cra/assets/candidate/application-form-paper.png';
const associationSymbol = '/cra/assets/cra-symbol-full.svg';
const slots = Array.from({ length: 12 }, (_, index) => {
  const startMinutes = 9 * 60 + index * 15;
  const endMinutes = startMinutes + 15;
  const formatMinutes = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

  return {
    id: `slot-${index + 1}`,
    startsAt: `2026-09-10T${formatMinutes(startMinutes)}:00+08:00`,
    endsAt: `2026-09-10T${formatMinutes(endMinutes)}:00+08:00`,
  };
});
const selectedSlotId = ref('');
const showEntryLoader = ref(true);
const form = reactive({
  name: '',
  studentNumber: '',
  email: '',
  phone: '',
  answers: {
    placeholderQuestion1: '',
    placeholderQuestion2: '',
    placeholderQuestion3: '',
  } as Record<string, string>,
});
let entryLoaderTimer: number | undefined;

onMounted(() => {
  entryLoaderTimer = window.setTimeout(() => {
    showEntryLoader.value = false;
  }, 3600);
});

onBeforeUnmount(() => {
  if (entryLoaderTimer !== undefined) window.clearTimeout(entryLoaderTimer);
});

function formatTimeRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
}

function formatSlotDate(startsAt: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(startsAt));
}

function validateQuestionAnswers(): boolean {
  const visibleQuestions = [
    { key: 'placeholderQuestion1', title: '问题1' },
    { key: 'placeholderQuestion2', title: '问题2' },
    { key: 'placeholderQuestion3', title: '问题3' },
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

function validateBasicInformation(): boolean {
  if (!form.name.trim()) {
    ElMessage.warning('请输入姓名');
    return false;
  }
  return validateStudentNumber() && validatePhone() && validateEmail();
}

function moveBackButton(event: MouseEvent) {
  const button = event.currentTarget as HTMLElement;
  const rect = button.getBoundingClientRect();
  const offsetX = event.clientX - (rect.left + rect.width / 2);
  const offsetY = event.clientY - (rect.top + rect.height / 2);
  const distance = Math.hypot(offsetX, offsetY);
  const strength = Math.min(distance, 10);
  const translateX = distance ? (offsetX / distance) * strength : 0;
  const translateY = distance ? (offsetY / distance) * strength : 0;
  const text = button.querySelector<HTMLElement>('.candidate-apply-back-button__text');

  button.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
  if (text) text.style.transform = `translate3d(${translateX * .4}px, ${translateY * .4}px, 0) scale(.95)`;
}

function resetBackButton(event: Event) {
  const button = event.currentTarget as HTMLElement;
  const text = button.querySelector<HTMLElement>('.candidate-apply-back-button__text');

  button.style.transform = 'translate3d(0, 0, 0)';
  if (text) text.style.transform = 'translate3d(0, 0, 0) scale(1)';
}

function submitRegistration() {
  if (!validateBasicInformation()) return;
  if (!validateQuestionAnswers()) return;
  if (!selectedSlotId.value) {
    ElMessage.warning('请选择面试时间');
    return;
  }
  ElMessage.success('报名确认成功');
}

</script>

<template>
  <main class="candidate-form-page candidate-apply-page" :class="{ 'is-entry-loading': showEntryLoader }">
    <div
      v-if="showEntryLoader"
      class="candidate-entry-preloader"
      role="status"
      aria-label="页面加载中"
    >
      <div class="candidate-entry-preloader__outer">
        <div class="candidate-entry-preloader__inner">
          <div class="candidate-entry-preloader__logo">
            <div class="candidate-entry-cube">
              <div class="candidate-entry-cube__inner">
                <div class="candidate-entry-cube__face candidate-entry-cube__face--front"></div>
                <div class="candidate-entry-cube__face candidate-entry-cube__face--right"></div>
                <div class="candidate-entry-cube__face candidate-entry-cube__face--back"></div>
                <div class="candidate-entry-cube__face candidate-entry-cube__face--left"></div>
                <div class="candidate-entry-cube__face candidate-entry-cube__face--top"></div>
                <div class="candidate-entry-cube__face candidate-entry-cube__face--bottom"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="candidate-apply-back-row">
      <RouterLink
        class="back-link candidate-apply-back-button"
        to="/"
        @mousemove="moveBackButton"
        @mouseleave="resetBackButton"
        @blur="resetBackButton"
      >
        <span class="candidate-apply-back-button__text">返回首页</span>
      </RouterLink>
    </div>
    <div class="candidate-apply-status" aria-label="报名中">
      <img class="candidate-apply-status__symbol" :src="associationSymbol" alt="" />
      <span class="candidate-apply-status__text">报名中</span>
    </div>
    <section class="candidate-form-card candidate-application-card">
      <img class="candidate-paper-preview" :src="paperTextureImage" alt="" />
      <div class="candidate-paper-content">
        <label class="candidate-paper-name-row">
          <span>姓名:</span>
          <input
            v-model="form.name"
            type="text"
            autocomplete="name"
            aria-label="姓名"
          />
        </label>
        <label class="candidate-paper-name-row candidate-paper-student-number-row">
          <span>学号:</span>
          <input
            v-model="form.studentNumber"
            class="candidate-paper-latin-input"
            type="text"
            inputmode="numeric"
            maxlength="9"
            pattern="[0-9]{9}"
            autocomplete="off"
            aria-label="学号"
            title="请输入 9 位数字学号"
            required
            @input="normalizeDigits($event, 'studentNumber', 9)"
            @blur="form.studentNumber && validateStudentNumber()"
          />
        </label>
        <label class="candidate-paper-name-row candidate-paper-phone-row">
          <span>电话号:</span>
          <input
            v-model="form.phone"
            class="candidate-paper-latin-input"
            type="tel"
            inputmode="numeric"
            maxlength="11"
            pattern="1[3-9][0-9]{9}"
            autocomplete="tel"
            aria-label="电话号"
            title="请输入正确的 11 位手机号"
            required
            @input="normalizeDigits($event, 'phone', 11)"
            @blur="form.phone && validatePhone()"
          />
        </label>
        <label class="candidate-paper-name-row candidate-paper-email-row">
          <span>邮箱:</span>
          <input
            v-model="form.email"
            class="candidate-paper-latin-input"
            type="email"
            maxlength="254"
            autocomplete="email"
            aria-label="邮箱"
            title="请输入正确的邮箱地址"
            required
            @blur="form.email && validateEmail()"
          />
        </label>
        <div class="candidate-paper-placeholder-questions">
          <label class="candidate-paper-placeholder-question">
            <span>问题1占位</span>
            <textarea
              v-model="form.answers.placeholderQuestion1"
              aria-label="问题1占位"
            ></textarea>
          </label>
          <label class="candidate-paper-placeholder-question">
            <span>问题2占位</span>
            <textarea
              v-model="form.answers.placeholderQuestion2"
              aria-label="问题2占位"
            ></textarea>
          </label>
          <label class="candidate-paper-placeholder-question">
            <span>问题3占位</span>
            <textarea
              v-model="form.answers.placeholderQuestion3"
              aria-label="问题3占位"
            ></textarea>
          </label>
        </div>
      </div>
    </section>

    <aside class="candidate-appointment-panel">
      <div class="candidate-appointment-heading">
        <h2>面试预订时间</h2>
        <span v-if="slots[0]">{{ formatSlotDate(slots[0].startsAt) }}</span>
      </div>
      <div class="candidate-appointment-slots" role="radiogroup" aria-label="面试预订时间">
        <label
          v-for="slot in slots"
          :key="slot.id"
          class="candidate-appointment-slot"
          :class="{ 'is-selected': selectedSlotId === slot.id }"
        >
          <input
            v-model="selectedSlotId"
            type="radio"
            name="candidate-appointment-time"
            :value="slot.id"
          />
          <span>{{ formatTimeRange(slot.startsAt, slot.endsAt) }}</span>
        </label>
      </div>
      <button
        class="candidate-confirm-registration"
        type="button"
        @click="submitRegistration"
      >
        确认报名
      </button>
    </aside>
  </main>
</template>
