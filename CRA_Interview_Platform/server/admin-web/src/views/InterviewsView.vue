<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, Search, View, EditPen } from '@element-plus/icons-vue';
import { api } from '../api';
import type { InterviewDetail, InterviewListResponse, InterviewListItem, InterviewStatus, Round } from '../types';
import {
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_STATUS_TYPES,
  formatCn,
  formatTimeRange,
} from '../types';

function statusLabel(status: string): string {
  return INTERVIEW_STATUS_LABELS[status as InterviewStatus] ?? status;
}

function statusType(status: string): 'info' | 'warning' | 'success' | 'danger' | 'primary' {
  return INTERVIEW_STATUS_TYPES[status as InterviewStatus] ?? 'info';
}

/** 终态（结果对候选人可见） */
function isFinal(status: string): boolean {
  return status === 'passed' || status === 'failed' || status === 'waitlisted';
}

const loading = ref(false);
const items = ref<InterviewListItem[]>([]);
const total = ref(0);
const rounds = ref<Round[]>([]);
const filters = reactive({
  roundId: undefined as number | undefined,
  status: '' as string,
  keyword: '',
  page: 1,
  pageSize: 20,
});

const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<InterviewDetail | null>(null);

const editVisible = ref(false);
const editLoading = ref(false);
const editTarget = ref<InterviewListItem | null>(null);
const editForm = reactive<{ status: InterviewStatus; score: number | null; comment: string }>({
  status: 'pending',
  score: null,
  comment: '',
});

async function load() {
  loading.value = true;
  try {
    const resp = await api.get<InterviewListResponse>('/api/admin/interviews', {
      roundId: filters.roundId,
      status: filters.status || undefined,
      keyword: filters.keyword || undefined,
      page: filters.page,
      pageSize: filters.pageSize,
    });
    items.value = resp.items;
    total.value = resp.total;
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadRounds() {
  try {
    const resp = await api.get<{ items: Round[] }>('/api/admin/rounds');
    rounds.value = resp.items;
  } catch {
    rounds.value = [];
  }
}

function search() {
  filters.page = 1;
  load();
}

function resetFilters() {
  filters.roundId = undefined;
  filters.status = '';
  filters.keyword = '';
  filters.page = 1;
  load();
}

async function openDetail(item: InterviewListItem) {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    if (item.interview.id === null) {
      detail.value = null;
      return;
    }
    detail.value = await api.get<InterviewDetail>(`/api/admin/interviews/${item.interview.id}`);
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载详情失败');
  } finally {
    detailLoading.value = false;
  }
}

function openEdit(item: InterviewListItem) {
  editTarget.value = item;
  editForm.status = item.interview.status;
  editForm.score = item.interview.score;
  editForm.comment = item.interview.comment ?? '';
  editVisible.value = true;
}

async function saveEdit() {
  if (!editTarget.value || editTarget.value.interview.id === null) return;
  editLoading.value = true;
  try {
    const updated = await api.patch<InterviewDetail>(`/api/admin/interviews/${editTarget.value.interview.id}`, {
      status: editForm.status,
      score: editForm.score,
      comment: editForm.comment || null,
    });
    editVisible.value = false;
    if (isFinal(updated.status)) {
      ElMessage.success('已保存，面试结果将自动对候选人可见');
    } else {
      ElMessage.success('已保存（尚未得出面试结论，结果对候选人不可见）');
    }
    load();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败');
  } finally {
    editLoading.value = false;
  }
}

onMounted(() => {
  loadRounds();
  load();
});
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h2 class="page-title">面试管理</h2>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <div class="filter-bar">
      <el-select
        v-model="filters.roundId"
        placeholder="招募轮次"
        clearable
        style="width: 200px"
        @change="search"
      >
        <el-option v-for="round in rounds" :key="round.id" :label="round.title" :value="round.id" />
      </el-select>
      <el-select v-model="filters.status" placeholder="面试状态" clearable style="width: 140px" @change="search">
        <el-option v-for="(label, value) in INTERVIEW_STATUS_LABELS" :key="value" :label="label" :value="value" />
      </el-select>
      <el-input
        v-model="filters.keyword"
        placeholder="搜索姓名 / 学号 / 电话 / 邮箱"
        clearable
        style="width: 260px"
        @keyup.enter="search"
        @clear="search"
      >
        <template #append>
          <el-button :icon="Search" @click="search" />
        </template>
      </el-input>
      <el-button @click="resetFilters">重置</el-button>
    </div>

    <el-card shadow="never" style="padding: 0">
      <el-table v-loading="loading" :data="items" stripe style="width: 100%">
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="studentNumber" label="学号" width="120" />
        <el-table-column prop="phone" label="电话" width="120" />
        <el-table-column prop="roundTitle" label="轮次" min-width="140" show-overflow-tooltip />
        <el-table-column label="面试时段" min-width="170">
          <template #default="{ row }">
            {{ row.slot ? formatTimeRange(row.slot.startsAt, row.slot.endsAt) : '未安排' }}
          </template>
        </el-table-column>
        <el-table-column label="面试状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.interview.status)" size="small">
              {{ statusLabel(row.interview.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="评分" width="80">
          <template #default="{ row }">
            <span v-if="row.interview.score !== null" class="mono">{{ row.interview.score }}</span>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="90">
          <template #default="{ row }">
            <el-tag
              v-if="row.interview.resultPublished"
              type="success"
              size="small"
              :title="`结果已对候选人可见${row.interview.resultPublishedAt ? `（${formatCn(row.interview.resultPublishedAt)}）` : ''}`"
            >已可见</el-tag>
            <el-tag v-else type="info" size="small">未发布</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="150">
          <template #default="{ row }">{{ formatCn(row.interview.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link :icon="EditPen" @click="openEdit(row)">
              面试评分
            </el-button>
            <el-button size="small" link :icon="View" class="ml8" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="display: flex; justify-content: flex-end; padding: 14px 16px">
        <el-pagination
          v-model:current-page="filters.page"
          v-model:page-size="filters.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @change="load"
        />
      </div>
    </el-card>

    <!-- 面试评分对话框 -->
    <el-dialog
      v-model="editVisible"
      :title="`面试评分 · ${editTarget?.name ?? ''}（${editTarget?.studentNumber ?? ''}）`"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="选择「通过 / 不通过 / 候补」保存后，面试结果将自动对候选人（用户端）可见"
        style="margin-bottom: 16px"
      />
      <el-form label-width="80px">
        <el-form-item label="面试时段">
          <span v-if="editTarget?.slot">
            {{ formatTimeRange(editTarget.slot.startsAt, editTarget.slot.endsAt) }}
          </span>
          <span v-else class="muted">未安排</span>
        </el-form-item>
        <el-form-item label="面试状态">
          <el-select v-model="editForm.status" style="width: 100%">
            <el-option v-for="(label, value) in INTERVIEW_STATUS_LABELS" :key="value" :label="label" :value="value" />
          </el-select>
        </el-form-item>
        <el-form-item label="评分">
          <el-input-number
            v-model="editForm.score"
            :min="0"
            :max="100"
            :step="1"
            :precision="0"
            placeholder="0-100，可留空"
            style="width: 180px"
          />
          <span class="muted" style="margin-left: 8px">0-100，可留空</span>
        </el-form-item>
        <el-form-item label="评语">
          <el-input
            v-model="editForm.comment"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
            placeholder="面试评价（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 面试详情抽屉 -->
    <el-drawer v-model="detailVisible" size="480px" :title="`面试详情 · ${detail?.application.name ?? ''}`">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
            <el-descriptions-item label="姓名">{{ detail.application.name }}</el-descriptions-item>
            <el-descriptions-item label="学号" class="mono">{{ detail.application.studentNumber }}</el-descriptions-item>
            <el-descriptions-item label="电话" class="mono">{{ detail.application.phone }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ detail.application.email }}</el-descriptions-item>
            <el-descriptions-item label="轮次">{{ detail.application.roundTitle }}</el-descriptions-item>
            <el-descriptions-item label="报名时间">{{ formatCn(detail.application.appliedAt) }}</el-descriptions-item>
            <el-descriptions-item label="面试时段" :span="2">
              {{ detail.application.slot ? formatTimeRange(detail.application.slot.startsAt, detail.application.slot.endsAt) : '未安排' }}
            </el-descriptions-item>
            <el-descriptions-item label="面试状态">
              <el-tag :type="statusType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="评分">
              {{ detail.score !== null ? detail.score : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="结果" :span="2">
              <el-tag v-if="detail.resultPublished" type="success" size="small">
                已对候选人可见（{{ formatCn(detail.resultPublishedAt) }}）
              </el-tag>
              <el-tag v-else type="info" size="small">未发布</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="评语" :span="2">
              <span v-if="detail.comment" style="white-space: pre-wrap">{{ detail.comment }}</span>
              <span v-else class="muted">无</span>
            </el-descriptions-item>
          </el-descriptions>
        </template>
        <el-empty v-else-if="!detailLoading" description="尚未建立面试记录（审核通过后自动创建）" />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.muted {
  color: #c0c4cc;
}

.ml8 {
  margin-left: 8px;
}
</style>
