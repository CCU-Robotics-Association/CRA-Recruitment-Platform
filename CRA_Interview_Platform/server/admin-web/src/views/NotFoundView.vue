<script setup lang="ts">
import { ElButton, ElResult } from 'element-plus';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/result/style/css';
</script>

<template>
  <div class="admin-page">
    <h2 class="page-title">页面不存在</h2>
    <el-result icon="warning" title="404" sub-title="您访问的页面不存在">
      <template #extra>
        <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
      </template>
    </el-result>
  </div>
</template>
