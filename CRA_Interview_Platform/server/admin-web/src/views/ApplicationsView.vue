<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  ElButton,
  ElCard,
  ElDescriptions,
  ElDescriptionsItem,
  ElDrawer,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElPagination,
  ElTable,
  ElTableColumn,
} from 'element-plus';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/card/style/css';
import 'element-plus/es/components/descriptions/style/css';
import 'element-plus/es/components/descriptions-item/style/css';
import 'element-plus/es/components/drawer/style/css';
import 'element-plus/es/components/input/style/css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import 'element-plus/es/components/pagination/style/css';
import 'element-plus/es/components/table/style/css';
import 'element-plus/es/components/table-column/style/css';
import { Delete, Download, Refresh, Search, View } from '@element-plus/icons-vue';
import { api } from '../api';
import type { Application, ApplicationListResponse } from '../types';
import { formatCn, formatTimeRange } from '../types';

function genderLabel(gender: Application['gender']): string {
  if (gender === 'male') return '男';
  if (gender === 'female') return '女';
  if (gender === 'other') return '其他';
  return '-';
}

const route = useRoute();

const loading = ref(false);
const items = ref<Application[]>([]);
const total = ref(0);
const filters = reactive({
  keyword: '',
  page: 1,
  pageSize: 20,
});

const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<Application | null>(null);

async function load() {
  loading.value = true;
  try {
    const resp = await api.get<ApplicationListResponse>('/api/admin/applications', {
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

function search() {
  filters.page = 1;
  load();
}

function resetFilters() {
  filters.keyword = '';
  filters.page = 1;
  load();
}

async function openDetail(id: number) {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    detail.value = await api.get<Application>(`/api/admin/applications/${id}`);
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载详情失败');
  } finally {
    detailLoading.value = false;
  }
}

async function exportCsv() {
  try {
    const params = new URLSearchParams();
    if (filters.keyword) params.set('keyword', filters.keyword);
    const query = params.toString();
    const response = await fetch(`/api/admin/applications/export.csv${query ? `?${query}` : ''}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`导出失败（${response.status}）`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cra-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '导出失败');
  }
}

async function handleDelete(id: number, name: string) {
  await ElMessageBox.confirm(
    `确定删除报名记录「${name}」（ID: ${id}）吗？删除后不可恢复，对应报名时段名额将释放，操作会记入审计日志。`,
    '删除确认',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
  );
  try {
    await api.delete(`/api/admin/applications/${id}`);
    ElMessage.success('已删除');
    load();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败');
  }
}

onMounted(() => {
  const idParam = route.query.id;
  if (idParam && !Array.isArray(idParam)) {
    openDetail(Number(idParam));
  }
  load();
});
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h2 class="page-title">报名管理</h2>
      <div>
        <el-button :icon="Download" @click="exportCsv">导出 CSV</el-button>
        <el-button :icon="Refresh" @click="load">刷新</el-button>
      </div>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索姓名 / 学号 / 学院"
        clearable
        style="width: 280px"
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
      <el-table :class="{ 'admin-loading': loading }" :aria-busy="loading" :data="items" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="姓名" width="110" />
        <el-table-column prop="studentNumber" label="学号" width="130" />
        <el-table-column prop="college" label="学院" min-width="150" show-overflow-tooltip />
        <el-table-column prop="phone" label="电话" width="130" />
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column label="面试时段" min-width="180">
          <template #default="{ row }">
            {{ row.slot ? formatTimeRange(row.slot.startsAt, row.slot.endsAt) : '未安排' }}
          </template>
        </el-table-column>
        <el-table-column label="报名时间" width="160">
          <template #default="{ row }">{{ formatCn(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link :icon="View" @click="openDetail(row.id)">
              详情
            </el-button>
            <el-button size="small" type="danger" link :icon="Delete" @click="handleDelete(row.id, row.name)">
              删除
            </el-button>
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

    <el-drawer v-model="detailVisible" size="520px" :title="`报名详情 #${detail?.id ?? ''}`">
      <div :class="{ 'admin-loading': detailLoading }" :aria-busy="detailLoading">
        <el-descriptions v-if="detail" :column="2" border style="margin-bottom: 16px">
          <el-descriptions-item label="姓名">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="学号">{{ detail.studentNumber }}</el-descriptions-item>
          <el-descriptions-item label="性别">{{ genderLabel(detail.gender) }}</el-descriptions-item>
          <el-descriptions-item label="学院">{{ detail.college || '-' }}</el-descriptions-item>
          <el-descriptions-item label="电话">{{ detail.phone }}</el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ detail.email }}</el-descriptions-item>
          <el-descriptions-item label="面试时段" :span="2">
            {{ detail.slot ? formatTimeRange(detail.slot.startsAt, detail.slot.endsAt) : '未安排' }}
          </el-descriptions-item>
          <el-descriptions-item label="报名时间">{{ formatCn(detail.createdAt) }}</el-descriptions-item>
        </el-descriptions>

        <template v-if="detail">
          <h4 style="margin: 12px 0 8px">报名问答</h4>
          <div v-for="(answer, question) in detail.answers" :key="question" style="margin-bottom: 12px">
            <div style="font-size: 13px; color: #606266; margin-bottom: 4px">{{ question }}</div>
            <el-input :model-value="answer" type="textarea" :rows="3" readonly />
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>
