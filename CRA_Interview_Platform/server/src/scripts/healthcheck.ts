import { config } from '../config.ts';

async function main(): Promise<void> {
  const base =
    process.env.CRA_HEALTHCHECK_URL?.trim() ??
    config.publicOrigin ??
    (config.isProduction ? null : 'http://127.0.0.1:' + config.port);
  if (!base) throw new Error('未配置 CRA_HEALTHCHECK_URL 或 CRA_PUBLIC_ORIGIN');
  const url = new URL('/api/health/ready', base).toString();
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => null)) as {
    status?: string;
    database?: string;
    schemaVersion?: number;
  } | null;
  if (!response.ok || body?.status !== 'ready' || body.database !== 'ok') {
    throw new Error('HTTP ' + response.status + ' 或就绪响应无效');
  }
  console.log(
    JSON.stringify({
      status: 'healthy',
      url,
      schemaVersion: body.schemaVersion,
      time: new Date().toISOString(),
    }),
  );
}

main().catch((error: unknown) => {
  console.error('健康检查失败：', error);
  process.exit(1);
});
