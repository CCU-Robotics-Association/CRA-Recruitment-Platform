<template>
  <div class="user-page notfound">
    <el-result icon="warning" title="页面不存在" sub-title="你访问的页面不存在或已被移除">
      <template #extra>
        <el-button type="primary" @click="router.push('/')">返回首页</el-button>
      </template>
    </el-result>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<style scoped>
.notfound {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
</style>
