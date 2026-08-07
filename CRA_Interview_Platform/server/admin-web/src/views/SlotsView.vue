<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Delete, EditPen } from '@element-plus/icons-vue';
import { api } from '../api';
import type { Round, Slot } from '../types';
import { formatTimeRange } from '../types';

const loading = ref(false);
const slots = ref<Slot[]>([]);
const rounds = ref<Round[]>([]);
const roundId = ref<number>();

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

async function loadRounds() {
  const resp = await api.get<{ items: Round[] }>('/api/admin/rounds');
  rounds.value = resp.items;
  if (!roundId.value && resp.items.length > 0) roundId.value = resp.items[0]?.id;
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

onMounted(async () => {
  await loadRounds();
  await loadSlots();
});
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h2 class="page-title">面试时段</h2>
      <div>
        <el-button type="primary" :icon="Plus" @click="openGenerate">批量生成时段</el-button>
        <el-button :icon="Refresh" @click="loadSlots">刷新</el-button>
      </div>
    </div>

    <div class="filter-bar">
      <span style="color: #606266">招募轮次：</span>
      <el-select v-model="roundId" style="width: 320px" @change="loadSlots">
        <el-option v-for="round in rounds" :key="round.id" :label="round.title" :value="round.id" />
      </el-select>
    </div>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="slots" stripe>
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
            <el-button size="small" type="primary" link :icon="EditPen" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" link :icon="Delete" @click="removeSlot(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="generateVisible" title="批量生成面试时段" width="520px">
      <el-form label-width="110px">
        <el-form-item label="开始日期">
          <el-date-picker v-model="generateForm.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" placeholder="选择日期" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="generateForm.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" placeholder="选择日期" />
        </el-form-item>
        <el-form-item label="每日时间范围">
          <el-time-select v-model="generateForm.startTime" start="00:00" step="00:30" end="23:30" placeholder="开始" style="width: 45%" />
          <span style="margin: 0 8px">至</span>
          <el-time-select v-model="generateForm.endTime" start="00:30" step="00:30" end="23:59" placeholder="结束" style="width: 45%" />
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
