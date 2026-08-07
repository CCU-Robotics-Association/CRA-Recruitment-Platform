<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Tickets, Clock, TrendCharts } from '@element-plus/icons-vue';
import { api } from '../api';
import type { StatsOverview } from '../types';
import { STATUS_LABELS, STATUS_TYPES, formatCn, formatTimeRange } from '../types';

const router = useRouter();
const loading = ref(false);
const stats = ref<StatsOverview | null>(null);

const totalSlots = computed(() => stats.value?.slotOccupancy.length ?? 0);
const fullSlots = computed(
  () => stats.value?.slotOccupancy.filter((s) => s.remaining <= 0).length ?? 0,
);

async function load() {
  loading.value = true;
  try {
    stats.value = await api.get<StatsOverview>('/api/admin/stats/overview');
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="admin-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">仪表盘</h2>
      <el-button :icon="TrendCharts" @click="load">刷新</el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label" style="color: #909399; font-size: 14px">
            <el-icon><User /></el-icon> 总报名人数
          </div>
          <div class="stat-value" style="color: #409eff">{{ stats?.total ?? 0 }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label" style="color: #909399; font-size: 14px">
            <el-icon><Tickets /></el-icon> 今日新增报名
          </div>
          <div class="stat-value" style="color: #67c23a">{{ stats?.todayNew ?? 0 }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label" style="color: #909399; font-size: 14px">
            <el-icon><Clock /></el-icon> 面试时段
          </div>
          <div class="stat-value" style="color: #e6a23c">{{ totalSlots }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label" style="color: #909399; font-size: 14px">
            <el-icon><Clock /></el-icon> 已约满时段
          </div>
          <div class="stat-value" style="color: #f56c6c">{{ fullSlots }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="10">
        <el-card shadow="never">
          <template #header>报名状态分布</template>
          <div v-if="stats">
            <div v-for="item in stats.byStatus" :key="item.status" style="margin-bottom: 12px">
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px">
                <span>{{ item.label }}</span>
                <span>{{ item.count }}</span>
              </div>
              <el-progress
                :percentage="stats.total ? Math.round((item.count / stats.total) * 100) : 0"
                :status="item.count > 0 ? STATUS_TYPES[item.status] : undefined"
              />
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card shadow="never">
          <template #header>时段占用（前 12 个）</template>
          <div v-if="stats">
            <div v-for="slot in stats.slotOccupancy.slice(0, 12)" :key="slot.slotId" style="margin-bottom: 10px">
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px">
                <span>{{ formatTimeRange(slot.startsAt, slot.endsAt) }}</span>
                <span :style="{ color: slot.remaining <= 0 ? '#f56c6c' : '#67c23a' }">
                  {{ slot.booked }}/{{ slot.capacity }}{{ slot.remaining <= 0 ? '（已满）' : '' }}
                </span>
              </div>
              <el-progress
                :percentage="slot.capacity ? Math.round((slot.booked / slot.capacity) * 100) : 0"
                :status="slot.remaining <= 0 ? 'exception' : undefined"
              />
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" style="margin-top: 16px">
      <template #header>最近报名</template>
      <el-table :data="stats?.recent ?? []" size="small">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="studentNumber" label="学号" width="130" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="STATUS_TYPES[row.status as keyof typeof STATUS_TYPES]" size="small">
              {{ STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="报名时间">
          <template #default="{ row }">{{ formatCn(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="router.push(`/applications?id=${row.id}`)">
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
