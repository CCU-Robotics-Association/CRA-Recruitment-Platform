import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildApp } from '../app.ts';
import { config } from '../config.ts';
import { closeMailer, verifyMailerConfiguration } from '../lib/mailer.ts';

function fail(message: string): never {
  throw new Error('生产预检失败：' + message);
}

async function main(): Promise<void> {
  if (!config.isProduction) fail('NODE_ENV/CRA_ENV 未设置为 production');
  if (!config.webDistDir || !existsSync(join(config.webDistDir, 'index.html'))) {
    fail('缺少用户端构建产物，请先在项目根目录执行 npm run build');
  }
  if (!config.adminDistDir || !existsSync(join(config.adminDistDir, 'index.html'))) {
    fail('缺少管理端构建产物，请先在项目根目录执行 npm run build');
  }
  await verifyMailerConfiguration();

  const probe = join(config.dataDir, '.write-probe-' + process.pid);
  try {
    writeFileSync(probe, 'ok', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  } catch (error) {
    fail('数据目录不可写：' + (error instanceof Error ? error.message : String(error)));
  } finally {
    if (existsSync(probe)) unlinkSync(probe);
  }

  const { app, db } = await buildApp({ logger: false });
  try {
    const activeAdmins = Number(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM users WHERE is_active = 1 AND role IN ('super_admin', 'admin')")
          .get() as { count: number }
      ).count,
    );
    if (activeAdmins < 1) fail('没有可用的管理员账号');

    const rounds = Number(
      (db.prepare('SELECT COUNT(*) AS count FROM recruitment_rounds').get() as { count: number }).count,
    );
    const applications = Number(
      (db.prepare('SELECT COUNT(*) AS count FROM applications').get() as { count: number }).count,
    );
    const capacity = Number(
      (
        db
          .prepare('SELECT COALESCE(SUM(capacity), 0) AS total FROM interview_slots WHERE is_enabled = 1')
          .get() as { total: number }
      ).total,
    );

    console.log(
      JSON.stringify(
        {
          status: 'ready-for-production-start',
          publicOrigin: config.publicOrigin,
          dataDir: config.dataDir,
          database: config.dbPath,
          activeAdmins,
          rounds,
          applications,
          enabledSlotCapacity: capacity,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  closeMailer();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
