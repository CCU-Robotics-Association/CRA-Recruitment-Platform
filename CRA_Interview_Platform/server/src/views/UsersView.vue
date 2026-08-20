<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import {
  ElAlert,
  ElButton,
  ElCard,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import 'element-plus/es/components/alert/style/css';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/card/style/css';
import 'element-plus/es/components/dialog/style/css';
import 'element-plus/es/components/form/style/css';
import 'element-plus/es/components/form-item/style/css';
import 'element-plus/es/components/input/style/css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import 'element-plus/es/components/option/style/css';
import 'element-plus/es/components/select/style/css';
import 'element-plus/es/components/table/style/css';
import 'element-plus/es/components/table-column/style/css';
import 'element-plus/es/components/tag/style/css';
import { Plus, Refresh, Key, CircleClose } from '@element-plus/icons-vue';
import { api } from '../api';
import { authStore } from '../auth';
import type { AdminUserRow } from '../types';
import { formatCn } from '../types';

const roleLabels: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  reviewer: '面试官',
};

const loading = ref(false);
const users = ref<AdminUserRow[]>([]);

function asAdminUser(row: unknown): AdminUserRow {
  return row as AdminUserRow;
}

const createVisible = ref(false);
const createForm = reactive({ username: '', password: '', displayName: '', role: 'reviewer' });

const resetVisible = ref(false);
const resetTarget = ref<AdminUserRow | null>(null);
const resetForm = reactive({ password: '' });

async function load() {
  loading.value = true;
  try {
    const resp = await api.get<{ items: AdminUserRow[] }>('/api/admin/users');
    users.value = resp.items;
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  createForm.username = '';
  createForm.password = '';
  createForm.displayName = '';
  createForm.role = 'reviewer';
  createVisible.value = true;
}

async function submitCreate() {
  try {
    await api.post('/api/admin/users', createForm);
    ElMessage.success('账号已创建');
    createVisible.value = false;
    load();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '创建失败');
  }
}

function openReset(user: AdminUserRow) {
  resetTarget.value = user;
  resetForm.password = '';
  resetVisible.value = true;
}

async function submitReset() {
  if (!resetTarget.value) return;
  try {
    await api.post(`/api/admin/users/${resetTarget.value.id}/reset-password`, { password: resetForm.password });
    ElMessage.success('密码已重置，该用户需重新登录');
    resetVisible.value = false;
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '重置失败');
  }
}

async function toggleActive(user: AdminUserRow) {
  const activating = user.isActive === 0;
  const action = activating ? '启用' : '停用';
  await ElMessageBox.confirm(`确定${action}账号「${user.displayName}（${user.username}）」吗？`, '确认', {
    type: 'warning',
  });
  try {
    await api.put(`/api/admin/users/${user.id}`, { isActive: activating });
    ElMessage.success(`已${action}`);
    load();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '操作失败');
  }
}

onMounted(load);
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h2 class="page-title">账号管理</h2>
      <div>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建账号</el-button>
        <el-button :icon="Refresh" @click="load">刷新</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-table :class="{ 'admin-loading': loading }" :aria-busy="loading" :data="users" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="用户名" width="160" />
        <el-table-column prop="displayName" label="显示名称" min-width="140" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="row.role === 'super_admin' ? 'danger' : row.role === 'admin' ? 'warning' : 'info'" size="small">
              {{ roleLabels[row.role] ?? row.role }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">{{ row.isActive ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" width="170">
          <template #default="{ row }">{{ formatCn(row.lastLoginAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link :icon="Key" @click="openReset(asAdminUser(row))">重置密码</el-button>
            <el-button
              size="small"
              :type="row.isActive ? 'danger' : 'success'"
              link
              :icon="row.isActive ? CircleClose : undefined"
              :disabled="row.id === authStore.user?.id"
              @click="toggleActive(asAdminUser(row))"
            >
              {{ row.isActive ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createVisible" title="新建账号" width="440px">
      <el-form label-width="90px">
        <el-form-item label="用户名">
          <el-input v-model="createForm.username" placeholder="字母/数字/._-，至少 2 位" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="createForm.password" type="password" show-password placeholder="至少 8 位" />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="createForm.displayName" placeholder="如：李老师" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.role" style="width: 100%">
            <el-option label="只读查看员" value="reviewer" />
            <el-option label="管理员（+时段/轮次配置）" value="admin" />
            <el-option label="超级管理员（全部权限）" value="super_admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resetVisible" title="重置密码" width="420px">
      <el-form label-width="90px" v-if="resetTarget">
        <el-form-item label="账号">
          <span>{{ resetTarget.displayName }}（{{ resetTarget.username }}）</span>
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="resetForm.password" type="password" show-password placeholder="至少 8 位" />
        </el-form-item>
        <el-alert type="warning" :closable="false" title="重置后该用户所有已登录会话将立即失效" style="margin-top: 8px" />
      </el-form>
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReset">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>
