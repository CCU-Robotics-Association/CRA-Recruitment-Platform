<template>
  <div class="user-page">
    <div class="head-bar">
      <div>
        <h1 class="page-title">我的面试</h1>
        <p class="page-subtitle">{{ authStore.user?.name }}（学号 {{ authStore.user?.studentNumber }}）</p>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" circle title="刷新" @click="load" />
        <el-button :icon="SwitchButton" circle title="退出登录" @click="logout" />
      </div>
    </div>

    <el-skeleton v-if="loading" :rows="6" animated />
    <el-empty v-else-if="!data" description="暂无报名信息" />

    <template v-else>
      <!-- 报名信息 -->
      <el-card shadow="never" class="block-card">
        <template #header>
          <span class="card-title">报名信息</span>
          <el-tag :type="applicationTagType" size="small">{{ data.application.statusLabel }}</el-tag>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="姓名">{{ data.application.name }}</el-descriptions-item>
          <el-descriptions-item label="学号" class="mono">{{ data.application.studentNumber }}</el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ data.application.email }}</el-descriptions-item>
          <el-descriptions-item label="手机号" class="mono">{{ data.application.phone }}</el-descriptions-item>
          <el-descriptions-item label="报名时间">{{ formatCn(data.application.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="招募轮次">{{ data.application.round.title }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 面试安排 -->
      <el-card shadow="never" class="block-card">
        <template #header>
          <span class="card-title">面试安排</span>
          <el-tag v-if="data.interview" :type="interviewTagType" size="small">
            {{ data.interview.statusLabel }}
          </el-tag>
        </template>

        <div v-if="data.application.slot" class="slot-info">
          <el-icon class="slot-icon" :size="20"><Clock /></el-icon>
          <div>
            <div class="slot-time">
              {{ formatTimeRange(data.application.slot.startsAt, data.application.slot.endsAt) }}
              <span class="timezone">（北京时间）</span>
            </div>
            <div class="slot-hint">请按上述时间准时参加面试；如有变动，以管理端最新安排为准。</div>
          </div>
        </div>
        <el-empty v-else description="尚未安排面试时段" :image-size="60" />
      </el-card>

      <!-- 面试结果 -->
      <el-card shadow="never" class="block-card">
        <template #header>
          <span class="card-title">面试结果</span>
        </template>

        <template v-if="data.resultVisible && data.interview">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="面试结论">
              <el-tag :type="interviewTagType">{{ data.interview.statusLabel }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="评分">
              <span v-if="data.interview.score !== null" class="score">{{ data.interview.score }}</span>
              <span v-else class="muted">未评分</span>
            </el-descriptions-item>
            <el-descriptions-item label="面试评语">
              <span v-if="data.interview.comment" class="comment">{{ data.interview.comment }}</span>
              <span v-else class="muted">无</span>
            </el-descriptions-item>
            <el-descriptions-item label="结果发布时间">
              {{ formatCn(data.interview.resultPublishedAt) }}
            </el-descriptions-item>
          </el-descriptions>
        </template>
        <el-empty v-else description="面试结果尚未发布，请耐心等待" :image-size="60" />
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Clock, Refresh, SwitchButton } from '@element-plus/icons-vue';
import { api } from '../api';
import { authStore } from '../auth';
import { formatCn, formatTimeRange } from '../types';
import type { MyInterviewResponse } from '../types';

const router = useRouter();
const loading = ref(true);
const data = ref<MyInterviewResponse | null>(null);

const applicationTagType = computed(() => {
  const status = data.value?.application.status;
  if (status === 'approved') return 'success' as const;
  if (status === 'rejected') return 'danger' as const;
  if (status === 'waitlisted') return 'primary' as const;
  return 'info' as const;
});

const interviewTagType = computed(() => {
  const status = data.value?.interview?.status;
  if (status === 'passed') return 'success' as const;
  if (status === 'failed' || status === 'no_show') return 'danger' as const;
  if (status === 'waitlisted') return 'primary' as const;
  if (status === 'completed') return 'warning' as const;
  return 'info' as const;
});

async function load() {
  loading.value = true;
  try {
    data.value = await api.get<MyInterviewResponse>('/api/user/me');
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

function logout() {
  authStore.clear();
  void router.replace({ name: 'login' });
}

onMounted(load);
</script>

<style scoped>
.head-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.head-actions {
  display: flex;
  gap: 8px;
}

.block-card {
  margin-bottom: 16px;
}

.card-title {
  font-weight: 600;
  color: #303133;
  margin-right: 12px;
}

.slot-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.slot-icon {
  color: #409eff;
  margin-top: 2px;
}

.slot-time {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.timezone {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}

.slot-hint {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.score {
  font-size: 20px;
  font-weight: 700;
  color: #409eff;
}

.comment {
  white-space: pre-wrap;
}

.muted {
  color: #c0c4cc;
}
</style>
