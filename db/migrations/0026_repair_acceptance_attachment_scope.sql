UPDATE attachments
SET attachment_scope = 'acceptance',
    is_final = 1,
    visible_to_client = 1,
    file_tag = CASE
      WHEN TRIM(COALESCE(file_tag, '')) = '' OR file_tag = '过程文件' THEN '验收文件'
      ELSE file_tag
    END
WHERE deleted_at IS NULL
  AND TRIM(COALESCE(entry_id, '')) != ''
  AND EXISTS (
    SELECT 1
    FROM tasks, json_each(COALESCE(tasks.time_entries_json, '[]')) AS entry
    WHERE tasks.id = attachments.task_id
      AND CAST(json_extract(entry.value, '$.id') AS TEXT) = attachments.entry_id
      AND json_extract(entry.value, '$.isAcceptanceProgress') = 1
  );
