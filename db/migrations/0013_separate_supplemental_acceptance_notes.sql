ALTER TABLE tasks ADD COLUMN supplemental_note TEXT;
ALTER TABLE tasks ADD COLUMN is_supplemental INTEGER NOT NULL DEFAULT 0;

UPDATE tasks
SET is_supplemental = 1
WHERE (
    COALESCE(settlement_month, '') <> ''
    AND settlement_month <> SUBSTR(COALESCE(start_date, ''), 1, 7)
  )
  OR (
    status <> '已验收'
    AND COALESCE(acceptance_note, '') <> ''
  );

UPDATE tasks
SET supplemental_note = acceptance_note
WHERE is_supplemental = 1
  AND status <> '已验收'
  AND COALESCE(acceptance_note, '') <> ''
  AND COALESCE(supplemental_note, '') = '';

UPDATE tasks
SET acceptance_note = ''
WHERE is_supplemental = 1
  AND status <> '已验收'
  AND COALESCE(supplemental_note, '') <> '';
