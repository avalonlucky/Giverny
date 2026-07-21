INSERT INTO access_tokens (id, token, label, scope, disabled)
VALUES ('mcp-eval', 'mcp_eval_read_token', 'MCP 隔离评测', 'mcp-read', 0);

INSERT OR IGNORE INTO workspaces (id, name) VALUES ('tenant-b', '隔离评测工作区 B');

INSERT INTO tasks (
  id, workspace_id, title, requirement, design_type, start_date, estimated_delivery_date, settlement_month,
  is_supplemental, estimated_hours, actual_hours, hourly_rate, requester, contact_person,
  reviewer, status, stage, progress, time_entries_json, waiting_entries_json, is_billable
) VALUES (
  '9001', 'tenant-b', '租户B机密任务', '不得被默认工作区 Agent 读取', '隔离评测', '2026-07-01T09:00', '2026-07-02T18:00', '2026-07',
  0, 1, 0, 300, '隔离用户', '隔离用户', '隔离用户', '计划中', '计划中', 0, '[]', '[]', 1
);

INSERT INTO tasks (
  id, title, requirement, design_type, start_date, estimated_delivery_date, settlement_month,
  is_supplemental, estimated_hours, actual_hours, hourly_rate, requester, contact_person,
  reviewer, status, stage, progress, time_entries_json, waiting_entries_json, is_billable
) VALUES
  ('1', '公司产品封套修改', '更新产品封套与产品矩阵图', '画册', '2026-07-03T09:00', '2026-07-10T18:00', '2026-07', 0, 6, 2.5, 300, '黄媚', '黄媚', '陈义君', '进行中', '进行中', 60, '[{"id":"finance-anchor-entry","date":"2026-07-03","endDate":"2026-07-03","start":"21:24","end":"23:55","note":"验证分段 151 分钟时仍以已保存的 2.5 小时作为结算锚点"}]', '[{"id":"active-waiting-entry","date":"2026-07-09","endDate":"2026-07-09","start":"18:07","end":"18:07","reason":"等待合作伙伴意见","note":"等待刘总的建议"}]', 1),
  ('2', '公司产品封套延展', '制作另一套产品封套', '画册', '2026-07-04T09:00', '2026-07-12T18:00', '2026-07', 0, 4, 1, 300, '黄媚', '黄媚', '陈义君', '计划中', '计划中', 0, '[]', '[]', 1),
  ('3', '数据安全峰会主视觉海报', '峰会主视觉及延展海报', '海报', '2026-07-01T09:00', '2026-07-08T18:00', '2026-07', 0, 6, 5.5, 300, '黄媚', '黄媚', '黄媚', '进行中', '进行中', 80, '[]', '[]', 1),
  ('4', '新品发布预热海报', '新品发布预热物料', '海报', '2026-07-02T09:00', '2026-07-09T18:00', '2026-07', 0, 3, 1, 300, '王悦', '王悦', '黄媚', '计划中', '计划中', 0, '[]', '[]', 1),
  ('5', 'AI Native 发布会产品视频', '三个产品视频背景电流声降噪', '视频剪辑', '2026-06-28T09:00', '2026-06-30T18:00', '2026-06', 0, 4, 4, 300, '陈义君', '陈义君', '黄媚', '已验收', '已验收', 100, '[]', '[]', 1),
  ('6', '智能体演示视频', '发布会智能体操作演示', '视频剪辑', '2026-07-05T09:00', '2026-07-11T18:00', '2026-07', 0, 3, 0.5, 300, '陈义君', '陈义君', '黄媚', '进行中', '进行中', 40, '[]', '[]', 1),
  ('7', '产品矩阵设计', '更新产品矩阵趋势图', '单页', '2026-07-06T09:00', '2026-07-13T18:00', '2026-07', 0, 5, 2, 300, '黄媚', '黄媚', '黄媚', '进行中', '进行中', 50, '[]', '[]', 1),
  ('8', '产品手册设计', '产品手册版式更新', '画册', '2026-07-07T09:00', '2026-07-14T18:00', '2026-07', 0, 8, 3, 300, '王悦', '王悦', '黄媚', '计划中', '计划中', 20, '[]', '[]', 1),
  ('9', '品牌规范设计', '品牌规范增补', 'VI / 品牌物料', '2026-07-08T09:00', '2026-07-15T18:00', '2026-07', 0, 8, 2, 300, '李强', '李强', '黄媚', '进行中', '进行中', 30, '[]', '[]', 1),
  ('10', '展会导视设计', '展会现场导视系统', '导视牌', '2026-07-09T09:00', '2026-07-16T18:00', '2026-07', 0, 10, 0, 300, '李强', '李强', '黄媚', '计划中', '计划中', 0, '[]', '[]', 1),
  ('11', '年终冲刺动员令倒计时海报', '倒计时系列海报', '海报', '2026-06-08T09:00', '2026-06-30T18:00', '2026-06', 0, 12, 12, 300, '黄媚', '黄媚', '黄媚', '已验收', '已验收', 100, '[]', '[]', 1),
  ('12', '解决方案彩页更新与拆分', '解决方案彩页更新并拆分版本', '单页 / 折页', '2026-06-24T09:00', '2026-07-10T19:30', '2026-06', 0, 6, 4.8, 300, '陈义君', '陈义君', '黄媚', '进行中', '进行中', 80, '[]', '[]', 1),
  ('13', '直播设计', '直播封面和邀请图', '直播物料', '2026-06-29T09:00', '2026-06-29T18:00', '2026-06', 0, 5, 4.3, 300, '陈义君', '陈义君', '黄媚', '已验收', '已验收', 100, '[]', '[]', 1),
  ('14', '官网历史验收日期回归', '验收已完成但存在补录日等待脏数据', '官网 banner', '2026-06-03T11:00', '2026-06-03T13:30', '2026-06', 0, 2.5, 2.5, 300, '黄媚', '黄媚', '黄媚', '已验收', '已验收', 100, '[{"id":"normal-before-acceptance","date":"2026-06-03","endDate":"2026-06-03","start":"11:00","end":"12:30","note":"完成初稿","isAcceptanceProgress":false},{"id":"normal-acceptance","date":"2026-06-03","endDate":"2026-06-03","start":"14:00","end":"15:00","note":"完成验收交付","isAcceptanceProgress":true}]', '[{"id":"dirty-after-acceptance-waiting","date":"2026-06-23","endDate":"2026-06-23","start":"16:06","end":"17:06","note":"测试等待记录","isAcceptanceProgress":false}]', 1);

UPDATE tasks
SET actual_delivery_date = '2026-06-23T17:24:28.036Z'
WHERE id = '14';

UPDATE tasks
SET start_date = '2026-06-07T23:00',
    actual_delivery_date = '2026-07-01T15:21:38.853Z',
    is_supplemental = 1,
    time_entries_json = '[{"id":"supplemental-acceptance-entry","date":"2026-06-07","endDate":"2026-06-08","start":"23:00","end":"00:00","note":"完成 6 月 8 日至 6 月 30 日倒计时海报","isAcceptanceProgress":true}]'
WHERE id = '11';

INSERT INTO task_updates (id, task_id, update_date, title, body, hours, visible_to_client) VALUES
  ('u1', '1', '2026-07-03T21:24', '项目进展', '完成封套第一版与产品矩阵图调整', 0, 1),
  ('u2', '12', '2026-07-09T23:58', '项目进展', '更新公司介绍、使命愿景和页面结构', 0, 1),
  ('u3', '5', '2026-06-30T17:16', '验收进展', '完成三个产品视频背景电流声降噪', 0, 1);

INSERT INTO attachments (
  id, task_id, attachment_scope, file_name, file_type, mime_type, r2_key,
  file_size, display_size, is_final, visible_to_client, file_tag, uploaded_at
) VALUES
  ('101', '13', 'acceptance', '当天邀请V1.0B01.jpg', 'JPG', 'image/jpeg', 'eval/live-invite.jpg', 344064, '336 KB', 1, 1, '验收文件', '2026-06-29T18:00:00'),
  ('102', '13', 'acceptance', '直播封面V1.0B01.jpg', 'JPG', 'image/jpeg', 'eval/live-cover.jpg', 445440, '435 KB', 1, 1, '验收文件', '2026-06-29T18:05:00'),
  ('103', '11', 'acceptance', '倒计时1天海报.jpg', 'JPG', 'image/jpeg', 'eval/countdown.jpg', 400384, '391 KB', 1, 1, '验收文件', '2026-06-30T18:00:00'),
  ('104', '1', 'progress', '封套过程稿V1.jpg', 'JPG', 'image/jpeg', 'eval/package-progress.jpg', 204800, '200 KB', 0, 1, '过程文件', '2026-07-03T18:00:00');

INSERT INTO agent_failure_cases (
  fingerprint, category, intent, tool_name, http_status, occurrences, regression_status
) VALUES (
  'tool_execution:task_detail:get_task_detail:500', 'tool_execution', 'task_detail', 'get_task_detail', 500, 2, 'required'
);
INSERT INTO agent_run_metrics (
  id, intent, outcome, model, tools_json, tool_count, duration_ms, fallback_used, http_status,
  is_eval, prompt_tokens, completion_tokens, estimated_cost_cny, created_at
) VALUES (
  'browser-route-cloud', 'data-query', 'success', 'deepseek-v4-flash', '["search_tasks"]', 1, 820, 0, 200,
  1, 180, 96, 0.0012, CURRENT_TIMESTAMP
);

INSERT INTO agent_analysis_jobs (
  id, workflow_id, job_type, title, month, query, status, phase, progress, error_message
) VALUES (
  'browser-job-failed', 'browser-job-failed-workflow', 'monthly_review', '浏览器回归后台任务', '2026-07',
  '回归测试', 'failed', 'failed', 35, '模拟失败，用于验证统一任务中心'
);

INSERT INTO ai_learning_events (
  context, action, source_input, ai_output, user_final, design_type, metadata_json, created_at
) VALUES (
  'hour-estimate', 'adopted', '浏览器回归样本', '2.5 小时', '2.5 小时', '画册', '{}',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
);
