import { buildApp } from './app.ts';
import { config } from './config.ts';

async function main(): Promise<void> {
  const { app, bootSummary } = await buildApp();

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

  let closing = false;
  const close = async (signal: string) => {
    if (closing) {
      app.log.warn(`再次收到 ${signal}，服务已在关闭中`);
      return;
    }
    closing = true;
    app.log.info(`收到 ${signal}，正在优雅关闭…`);
    const forcedExit = setTimeout(() => {
      app.log.fatal('优雅关闭超过 30 秒，强制退出');
      process.exit(1);
    }, 30_000);
    forcedExit.unref();
    try {
      await app.close();
      clearTimeout(forcedExit);
      process.exitCode = 0;
    } catch (error) {
      clearTimeout(forcedExit);
      app.log.error({ err: error }, '关闭服务失败');
      process.exitCode = 1;
    }
  };
  process.on('SIGINT', () => void close('SIGINT'));
  process.on('SIGTERM', () => void close('SIGTERM'));

  await app.listen({ port: config.port, host: config.host });
}

main().catch((err: unknown) => {
  console.error('服务启动失败:', err);
  process.exit(1);
});
