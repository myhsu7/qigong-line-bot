-- 報表：個人功法「月趨勢」
-- 請將 :uid 替換為實際使用者的 line_user_id

WITH method_dict AS (
  SELECT *
  FROM (
    VALUES
      ('大雁功', ARRAY['大雁功']),
      ('回春功', ARRAY['回春功']),
      ('龜壽功', ARRAY['龜壽功']),
      ('正陽功', ARRAY['正陽功']),
      ('神奇晃海功', ARRAY['神奇晃海功','晃海功','晃海']),
      ('和氣舒壓法', ARRAY['和氣舒壓法','和氣','舒壓法']),
      ('蓮花', ARRAY['蓮花','蓮花功'])
  ) AS t(method_name, aliases)
),
matched AS (
  SELECT DISTINCT
    l.line_user_id,
    date_trunc('month', l.created_at AT TIME ZONE 'Asia/Taipei')::date AS month_start,
    (l.created_at AT TIME ZONE 'Asia/Taipei')::date AS local_date,
    md.method_name
  FROM checkin_logs l
  JOIN method_dict md
    ON EXISTS (
      SELECT 1 FROM unnest(md.aliases) a
      WHERE COALESCE(l.note,'') ILIKE '%' || a || '%'
    )
),
monthly AS (
  SELECT
    line_user_id,
    month_start,
    method_name,
    COUNT(*) AS matched_days
  FROM matched
  GROUP BY line_user_id, month_start, method_name
),
monthly_totals AS (
  SELECT
    line_user_id,
    month_start,
    SUM(matched_days) AS month_total_matched
  FROM monthly
  GROUP BY line_user_id, month_start
)
SELECT
  m.month_start,
  m.method_name,
  m.matched_days,
  ROUND(m.matched_days::numeric / NULLIF(mt.month_total_matched,0), 4) AS month_composition_ratio
FROM monthly m
JOIN monthly_totals mt
  ON mt.line_user_id = m.line_user_id
 AND mt.month_start = m.month_start
WHERE m.line_user_id = :uid
ORDER BY m.month_start DESC, m.matched_days DESC, m.method_name;
