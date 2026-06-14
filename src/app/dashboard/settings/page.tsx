/**
 * Purpose:
 * Settings Dashboard — view and edit platform configuration.
 * Server Component.
 */

import { Card, Table, Badge } from '@/components/ui';
import { settingRepository } from '@/repositories/setting.repository';

export default async function SettingsPage(): Promise<React.ReactElement> {
  const settings = await settingRepository.getAll();

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          ⚙️ Settings
        </h2>
        <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '14px' }}>
          Platform configuration
        </p>
      </div>

      {/* Settings Table */}
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#0f172a' }}>
            Configuration
          </h3>
        </div>
        <Table
          headers={['Key', 'Value', 'Last Updated']}
          rows={settings.map((s) => [
            <span key="key" style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace', fontSize: '13px' }}>
              {s.key}
            </span>,
            <span key="value" style={{ color: '#475569', fontSize: '13px', fontFamily: 'monospace', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
              {JSON.stringify(s.value)}
            </span>,
            <span key="date" style={{ color: '#94a3b8', fontSize: '13px' }}>
              {new Date(s.updatedAt).toLocaleString()}
            </span>,
          ])}
        />
      </Card>

      {/* System Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'Node Environment', value: process.env.NODE_ENV ?? 'unknown' },
          { label: 'App Name', value: process.env.APP_NAME ?? 'shopify-autonomous-store' },
          { label: 'Log Level', value: process.env.LOG_LEVEL ?? 'info' },
          { label: 'Redis Host', value: process.env.REDIS_HOST ?? 'localhost' },
          { label: 'Worker Concurrency', value: process.env.WORKER_CONCURRENCY ?? '5' },
          { label: 'Auto Publish', value: process.env.ENABLE_AUTO_PUBLISH ?? 'false' },
        ].map((info) => (
          <Card key={info.label} style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {info.label}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
              <Badge variant="info">{info.value}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
