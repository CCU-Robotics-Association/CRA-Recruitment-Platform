/**
 * 服务入口：启动 HTTP 服务，处理优雅关闭。
 */
import { buildApp } from './app.ts';
import { config } from './config.ts';

async function main(): Promise<void> {
  const { app, db, bootSummary } = await buildApp();

  if (bootSummary.migrationsApplied.length > 0) {
    app.log.info(`已应用数据库迁移: ${bootSummary.migrationsApplied.join(', ')}`);
  }
  if (bootSummary.adminCreated) {
    app.log.warn(
      `已创建默认管理员账号 "${config.bootstrapAdmin.username}"，请立即登录修改密码。` +
        (process.env.CRA_ADMIN_PASSWORD
          ? ''
          : '（当前使用内置默认密码，生产环境请通过 CRA_ADMIN_PASSWORD 指定强密码）'),
    );
  }
  if (bootSummary.roundCreated) {
    app.log.info(`已创建默认招募轮次及 ${bootSummary.slotsCreated} 个面试时段`);
  }

  const close = async (signal: string) => {
    app.log.info(`收到 ${signal}，正在优雅关闭…`);
    try {
      await app.close();
    } finally {
      db.close();
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void close('SIGINT'));
  process.on('SIGTERM', () => void close('SIGTERM'));

  await app.listen({ port: config.port, host: config.host });
}

main().catch((err: unknown) => {
  // 启动失败必须立刻失败退出，避免进程空转
  console.error('服务启动失败:', err);
  process.exit(1);
});
