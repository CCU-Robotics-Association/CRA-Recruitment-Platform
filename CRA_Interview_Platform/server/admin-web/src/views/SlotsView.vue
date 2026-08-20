<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  ElButton,
  ElCard,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/card/style/css';
import 'element-plus/es/components/dialog/style/css';
import 'element-plus/es/components/form/style/css';
import 'element-plus/es/components/form-item/style/css';
import 'element-plus/es/components/input/style/css';
import 'element-plus/es/components/input-number/style/css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import 'element-plus/es/components/option/style/css';
import 'element-plus/es/components/select/style/css';
import 'element-plus/es/components/switch/style/css';
import 'element-plus/es/components/table/style/css';
import 'element-plus/es/components/table-column/style/css';
import 'element-plus/es/components/tag/style/css';
import { Clock, Plus, Refresh, Delete, EditPen } from '@element-plus/icons-vue';
import { api } from '../api';
import type { Round, Slot } from '../types';
import { formatTimeRange } from '../types';

const loading = ref(false);
const slots = ref<Slot[]>([]);
const rounds = ref<Round[]>([]);
const roundId = ref<number>();
const selectedSlots = ref<Slot[]>([]);

function asSlot(row: unknown): Slot {
  return row as Slot;
}

const generateVisible = ref(false);
const generateForm = reactive({
  startDate: '',
  endDate: '',
  startTime: '09:00',
  endTime: '17:00',
  durationMinutes: 30,
  capacity: 1,
  excludeWeekends: true,
});

const editVisible = ref(false);
const editingSlot = ref<Slot | null>(null);
const editForm = reactive({ capacity: 1, isEnabled: true });

const roundVisible = ref(false);
const roundMode = ref<'create' | 'edit'>('create');
const roundForm = reactive({
  title: '',
  description: '',
  applyStartAt: '',
  applyEndAt: '',
  isOpen: true,
});

const shiftVisible = ref(false);
const shiftSubmitting = ref(false);
const shiftForm = reactive({ firstSlotStartsAt: '' });
const currentRound = computed(() => rounds.value.find((round) => round.id === roundId.value) ?? null);
const firstSlot = computed(() => slots.value[0] ?? null);
const lastSlot = computed(() => slots.value.at(-1) ?? null);

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function localDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resetRoundForm() {
  roundForm.title = '';
  roundForm.description = '';
  roundForm.applyStartAt = '';
  roundForm.applyEndAt = '';
  roundForm.isOpen = true;
}

function openCreateRound() {
  roundMode.value = 'create';
  resetRoundForm();
  roundVisible.value = true;
}

function openEditRound() {
  const round = currentRound.value;
  if (!round) return;
  roundMode.value = 'edit';
  roundForm.title = round.title;
  roundForm.description = round.description;
  roundForm.applyStartAt = toDateTimeLocal(round.applyStartAt);
  roundForm.applyEndAt = toDateTimeLocal(round.applyEndAt);
  roundForm.isOpen = round.isOpen === 1;
  roundVisible.value = true;
}

async function submitRound() {
  if (!roundForm.title.trim()) {
    ElMessage.warning('请填写轮次标题');
    return;
  }
  const applyStartAt = localDate(roundForm.applyStartAt);
  const applyEndAt = localDate(roundForm.applyEndAt);
  if (!applyStartAt || !applyEndAt) {
    ElMessage.warning('请选择报名开始与结束时间');
    return;
  }
  if (applyEndAt.getTime() <= applyStartAt.getTime()) {
    ElMessage.warning('报名结束时间必须晚于开始时间');
    return;
  }
  try {
    const payload = {
      title: roundForm.title.trim(),
      description: roundForm.description.trim(),
      applyStartAt: applyStartAt.toISOString(),
      applyEndAt: applyEndAt.toISOString(),
      isOpen: roundForm.isOpen,
    };
    const saved = roundMode.value === 'create'
      ? await api.post<Round>('/api/admin/rounds', payload)
      : await api.put<Round>(`/api/admin/rounds/${roundId.value}`, payload);
    ElMessage.success(
      roundMode.value === 'create'
        ? `已创建轮次「${saved.title}」，请为其生成报名时段`
        : `轮次「${saved.title}」已更新`,
    );
    roundVisible.value = false;
    resetRoundForm();
    await loadRounds();
    roundId.value = saved.id;
    await loadSlots();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败');
  }
}

async function loadRounds() {
  const resp = await api.get<{ items: Round[] }>('/api/admin/rounds');
  rounds.value = resp.items;
  if (!resp.items.some((round) => round.id === roundId.value)) roundId.value = resp.items[0]?.id;
}

async function loadSlots() {
  if (!roundId.value) return;
  loading.value = true;
  try {
    slots.value = await api.get<Slot[]>('/api/admin/slots', { roundId: roundId.value });
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function openGenerate() {
  const today = new Date();
  const fmt = (d: Date) => {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    return p.replace(/\//g, '-');
  };
  generateForm.startDate = fmt(today);
  const end = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
  generateForm.endDate = fmt(end);
  generateVisible.value = true;
}

async function submitGenerate() {
  if (!roundId.value) return;
  try {
    const result = await api.post<{ created: number; skipped: number }>('/api/admin/slots/generate', {
      roundId: roundId.value,
      ...generateForm,
    });
    ElMessage.success(`生成完成：新增 ${result.created} 个时段${result.skipped ? `，跳过 ${result.skipped} 个已存在时段` : ''}`);
    generateVisible.value = false;
    loadSlots();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '生成失败');
  }
}

function describeShift(minutes: number): string {
  const direction = minutes > 0 ? '推迟' : '提前';
  let remaining = Math.abs(minutes);
  const days = Math.floor(remaining / 1440);
  remaining -= days * 1440;
  const hours = Math.floor(remaining / 60);
  const mins = Math.round(remaining - hours * 60);
  const parts = [days ? `${days} 天` : '', hours ? `${hours} 小时` : '', mins ? `${mins} 分钟` : ''].filter(Boolean);
  return `${direction} ${parts.join(' ') || '不到 1 分钟'}`;
}

const shiftPreview = computed(() => {
  if (!firstSlot.value || !shiftForm.firstSlotStartsAt) return '';
  const target = localDate(shiftForm.firstSlotStartsAt);
  if (!target) return '';
  const minutes = (target.getTime() - new Date(firstSlot.value.startsAt).getTime()) / 60_000;
  if (minutes === 0) return '时间未发生变化';
  return `全部 ${slots.value.length} 个时段将整体${describeShift(minutes)}`;
});

function openShiftSchedule() {
  if (!roundId.value || !firstSlot.value) {
    ElMessage.warning('当前轮次还没有可调整的报名时段');
    return;
  }
  shiftForm.firstSlotStartsAt = toDateTimeLocal(firstSlot.value.startsAt);
  shiftVisible.value = true;
}

async function submitShiftSchedule() {
  if (!roundId.value || !firstSlot.value) return;
  const target = localDate(shiftForm.firstSlotStartsAt);
  if (!target) {
    ElMessage.warning('请选择新的首个时段日期时间');
    return;
  }
  const deltaMinutes = (target.getTime() - new Date(firstSlot.value.startsAt).getTime()) / 60_000;
  if (deltaMinutes === 0) {
    ElMessage.warning('新的首个时段时间与当前时间相同');
    return;
  }
  await ElMessageBox.confirm(
    `${shiftPreview.value}。时段 ID、容量和已有报名关联都会保留，确定继续吗？`,
    '整体调整日期时间',
    { type: 'warning', confirmButtonText: '确认调整', cancelButtonText: '取消' },
  );
  shiftSubmitting.value = true;
  try {
    const result = await api.put<{ shifted: number; deltaMinutes: number }>(
      `/api/admin/rounds/${roundId.value}/shift-slots`,
      { firstSlotStartsAt: target.toISOString() },
    );
    ElMessage.success(`已整体调整 ${result.shifted} 个时段`);
    shiftVisible.value = false;
    await Promise.all([loadRounds(), loadSlots()]);
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '整体调整失败');
  } finally {
    shiftSubmitting.value = false;
  }
}

function openEdit(slot: Slot) {
  editingSlot.value = slot;
  editForm.capacity = slot.capacity;
  editForm.isEnabled = slot.isEnabled === 1;
  editVisible.value = true;
}

async function submitEdit() {
  if (!editingSlot.value) return;
  try {
    await api.put<Slot>(`/api/admin/slots/${editingSlot.value.id}`, editForm);
    ElMessage.success('已更新');
    editVisible.value = false;
    loadSlots();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '更新失败');
  }
}

async function removeSlot(slot: Slot) {
  await ElMessageBox.confirm(
    `确定删除时段「${formatTimeRange(slot.startsAt, slot.endsAt)}」吗？已有报名的时段不可删除。`,
    '删除确认',
    { type: 'warning' },
  );
  try {
    await api.delete(`/api/admin/slots/${slot.id}`);
    ElMessage.success('已删除');
    loadSlots();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败');
  }
}

async function removeSelectedSlots() {
  if (selectedSlots.value.length === 0) return;
  await ElMessageBox.confirm(
    `确定删除选中的 ${selectedSlots.value.length} 个时段吗？已有报名的时段会被跳过、不会删除。`,
    '批量删除确认',
    { type: 'warning' },
  );
  try {
    const result = await api.post<{ deleted: number; failed: Array<{ id: number; reason: string }> }>(
      '/api/admin/slots/batch-delete',
      { ids: selectedSlots.value.map((s) => s.id) },
    );
    if (result.failed.length > 0) {
      ElMessage.warning(
        `已删除 ${result.deleted} 个，${result.failed.length} 个未删除（${result.failed.map((f) => `#${f.id} ${f.reason}`).join('；')}）`,
      );
    } else {
      ElMessage.success(`已删除 ${result.deleted} 个时段`);
    }
    selectedSlots.value = [];
    loadSlots();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '批量删除失败');
  }
}

async function removeCurrentRound() {
  if (!roundId.value) return;
  const round = rounds.value.find((r) => r.id === roundId.value);
  await ElMessageBox.confirm(
    `确定删除招募轮次「${round?.title ?? roundId.value}」吗？该轮次下的所有报名时段将一并删除，且不可恢复。已有报名的轮次无法删除。`,
    '删除轮次确认',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
  );
  try {
    await api.delete(`/api/admin/rounds/${roundId.value}`);
    ElMessage.success('轮次已删除');
    selectedSlots.value = [];
    roundId.value = undefined;
    await loadRounds();
    await loadSlots();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败');
  }
}

onMounted(async () => {
  await loadRounds();
  await loadSlots();
});
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h2 class="page-title">报名时段</h2>
      <div>
        <el-button :icon="Plus" @click="openCreateRound">添加招募轮次</el-button>
        <el-button type="primary" :icon="Plus" @click="openGenerate">批量生成时段</el-button>
        <el-button
          type="danger"
          :disabled="selectedSlots.length === 0"
          @click="removeSelectedSlots"
        >
          批量删除{{ selectedSlots.length > 0 ? `（${selectedSlots.length}）` : '' }}
        </el-button>
        <el-button :icon="Refresh" @click="loadSlots">刷新</el-button>
      </div>
    </div>

    <div class="filter-bar">
      <span style="color: #606266">招募轮次：</span>
      <el-select v-model="roundId" style="width: 320px" @change="loadSlots">
        <el-option v-for="round in rounds" :key="round.id" :label="round.title" :value="round.id" />
      </el-select>
      <el-button :icon="EditPen" :disabled="!roundId" @click="openEditRound">
        编辑当前轮次
      </el-button>
      <el-button :icon="Clock" :disabled="!roundId || slots.length === 0" @click="openShiftSchedule">
        整体调整日期时间
      </el-button>
      <el-button type="danger" plain :disabled="!roundId" @click="removeCurrentRound">
        删除当前轮次
      </el-button>
    </div>

    <el-card shadow="never">
      <el-table :class="{ 'admin-loading': loading }" :aria-busy="loading" :data="slots" stripe @selection-change="(rows: Slot[]) => (selectedSlots = rows)">
        <el-table-column type="selection" width="44" />
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="时段" min-width="200">
          <template #default="{ row }">{{ formatTimeRange(row.startsAt, row.endsAt) }}</template>
        </el-table-column>
        <el-table-column prop="capacity" label="容量" width="80" />
        <el-table-column prop="booked" label="已约" width="80" />
        <el-table-column label="剩余" width="90">
          <template #default="{ row }">
            <span :style="{ color: row.remaining <= 0 ? '#f56c6c' : '#67c23a', fontWeight: 600 }">
              {{ row.remaining }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">
              {{ row.isEnabled ? '开放' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button size="small" type="primary" link :icon="EditPen" @click="openEdit(asSlot(row))">编辑</el-button>
            <el-button size="small" type="danger" link :icon="Delete" @click="removeSlot(asSlot(row))">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="roundVisible"
      :title="roundMode === 'create' ? '添加招募轮次' : '编辑当前轮次'"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-form label-width="110px">
        <el-form-item label="轮次标题" required>
          <el-input v-model="roundForm.title" maxlength="100" placeholder="如：2027 年春季招新" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="roundForm.description" type="textarea" :rows="2" maxlength="1000" placeholder="可选" />
        </el-form-item>
        <el-form-item label="报名开始" required>
          <input v-model="roundForm.applyStartAt" class="admin-native-field" type="datetime-local" step="60" required />
        </el-form-item>
        <el-form-item label="报名结束" required>
          <input v-model="roundForm.applyEndAt" class="admin-native-field" type="datetime-local" step="60" required />
        </el-form-item>
        <el-form-item label="开放报名">
          <el-switch v-model="roundForm.isOpen" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roundVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRound">{{ roundMode === 'create' ? '创建' : '保存' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="generateVisible" title="批量生成报名时段" width="520px">
      <el-form label-width="110px">
        <el-form-item label="开始日期">
          <input v-model="generateForm.startDate" class="admin-native-field" type="date" />
        </el-form-item>
        <el-form-item label="结束日期">
          <input v-model="generateForm.endDate" class="admin-native-field" type="date" />
        </el-form-item>
        <el-form-item label="每日时间范围">
          <input v-model="generateForm.startTime" class="admin-native-field admin-native-field--time" type="time" step="1800" />
          <span style="margin: 0 8px">至</span>
          <input v-model="generateForm.endTime" class="admin-native-field admin-native-field--time" type="time" step="1800" />
        </el-form-item>
        <el-form-item label="时段时长(分)">
          <el-input-number v-model="generateForm.durationMinutes" :min="5" :max="480" :step="5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="每时段容量">
          <el-input-number v-model="generateForm.capacity" :min="1" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="排除周末">
          <el-switch v-model="generateForm.excludeWeekends" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateVisible = false">取消</el-button>
        <el-button type="primary" @click="submitGenerate">生成</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="shiftVisible" title="整体调整本轮日期时间" width="560px" :close-on-click-modal="false">
      <el-form label-width="130px">
        <el-form-item label="当前时段范围">
          <span v-if="firstSlot && lastSlot">
            {{ formatTimeRange(firstSlot.startsAt, lastSlot.endsAt) }}（共 {{ slots.length }} 个）
          </span>
        </el-form-item>
        <el-form-item label="新的首个时段" required>
          <input
            v-model="shiftForm.firstSlotStartsAt"
            class="admin-native-field"
            type="datetime-local"
            step="60"
            required
          />
        </el-form-item>
      </el-form>
      <div
        style="margin-top: 8px; border-radius: 10px; padding: 12px 14px; color: #606266; background: #f5f7fa; line-height: 1.65"
      >
        <strong style="display: block; color: #303133">{{ shiftPreview || '请选择新的日期时间' }}</strong>
        所有时段会按相同时间差整体移动；时长、间隔、容量、开放状态及已有报名人员均保持不变。
      </div>
      <template #footer>
        <el-button :disabled="shiftSubmitting" @click="shiftVisible = false">取消</el-button>
        <el-button type="primary" :loading="shiftSubmitting" @click="submitShiftSchedule">确认调整</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" title="编辑时段" width="420px">
      <el-form label-width="90px" v-if="editingSlot">
        <el-form-item label="时段">
          <span>{{ formatTimeRange(editingSlot.startsAt, editingSlot.endsAt) }}</span>
        </el-form-item>
        <el-form-item label="容量">
          <el-input-number v-model="editForm.capacity" :min="1" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="开放预约">
          <el-switch v-model="editForm.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
