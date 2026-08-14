<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import 'element-plus/theme-chalk/el-message.css';

const paperTextureImage = '/cra/assets/candidate/application-form-paper.png';
const associationSymbol = '/cra/assets/cra-symbol-full.svg';

// 面试时段：优先从后端 /api/public/meta 加载；后端不可用时回退到默认时段
interface InterviewSlot {
  id: number | string;
  startsAt: string;
  endsAt: string;
  remaining?: number;
  available?: boolean;
}

const fallbackSlots: InterviewSlot[] = Array.from({ length: 12 }, (_, index) => {
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

const slots = ref<InterviewSlot[]>(fallbackSlots);
const applyPhase = ref<'not_started' | 'open' | 'ended'>('open');
const selectedSlotId = ref<number | string>('');
const submitting = ref(false);
const showEntryLoader = ref(true);

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

// 日历视图月份（初始取第一个时段的月份）
const firstSlot = slots.value[0];
const initialDate = firstSlot ? new Date(firstSlot.startsAt) : new Date();
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
  if (!dayIds.includes(selectedSlotId.value)) selectedSlotId.value = '';
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
  void loadInterviewMeta();
});

async function loadInterviewMeta() {
  try {
    const response = await fetch('/api/public/meta');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const meta = (await response.json()) as {
      round?: { applyPhase?: 'not_started' | 'open' | 'ended'; title?: string };
      slots?: InterviewSlot[];
    };
    if (meta.slots && meta.slots.length > 0) {
      slots.value = meta.slots;
    }
    if (meta.round?.applyPhase) {
      applyPhase.value = meta.round.applyPhase;
      if (applyPhase.value === 'not_started') {
        ElMessage.info('报名尚未开始，请耐心等待');
      } else if (applyPhase.value === 'ended') {
        ElMessage.info('本轮报名已结束');
      }
    }
  } catch {
    // 后端暂不可用时保留默认时段，提交阶段仍会做校验
  }
}

onBeforeUnmount(() => {
  if (entryLoaderTimer !== undefined) window.clearTimeout(entryLoaderTimer);
});

function formatTimeRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
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

async function submitRegistration() {
  if (submitting.value) return;
  if (!validateBasicInformation()) return;
  if (!validateQuestionAnswers()) return;
  if (!selectedSlotId.value) {
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

  const slotId = Number(selectedSlotId.value);
  if (!Number.isInteger(slotId) || slotId <= 0) {
    ElMessage.warning('请选择有效的面试时间');
    return;
  }

  submitting.value = true;
  try {
    const response = await fetch('/api/public/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        studentNumber: form.studentNumber.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        slotId,
        answers: form.answers,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | { queryCode?: string; message?: string; error?: { code?: string; message?: string } }
      | null;

    if (!response.ok) {
      ElMessage.error(data?.error?.message ?? '报名提交失败，请稍后重试');
      return;
    }

    ElMessage.success('报名成功');
  } catch {
    ElMessage.error('网络异常，报名提交失败，请稍后重试');
  } finally {
    submitting.value = false;
  }
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
      <div class="candidate-appointment-scroll">
        <div class="candidate-appointment-heading">
          <h2>面试预订时间</h2>
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
          <div class="calendar-grid">
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

        <div class="candidate-appointment-slots" role="radiogroup" aria-label="面试预订时间">
          <label
            v-for="slot in daySlots"
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
          <div v-if="daySlots.length === 0" class="calendar-empty">当天暂无面试时段</div>
        </div>
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
