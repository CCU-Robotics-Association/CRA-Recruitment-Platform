UPDATE audit_logs
SET detail = '{"deleted":{"redacted":true}}'
WHERE entity = 'application'
  AND action = 'delete';
