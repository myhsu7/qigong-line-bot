-- 報表：個人功法「週趨勢」
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
    date_trunc('week', l.created_at AT TIME ZONE 'Asia/Taipei')::date AS week_start,
    (l.created_at AT TIME ZONE 'Asia/Taipei')::date AS local_date,
    md.method_name
  FROM checkin_logs l
  JOIN method_dict md
    ON EXISTS (
      SELECT 1 FROM unnest(md.aliases) a
      WHERE COALESCE(l.note,'') ILIKE '%' || a || '%'
    )
),
weekly AS (
  SELECT
    line_user_id,
    week_start,
    method_name,
    COUNT(*) AS matched_days
  FROM matched
  GROUP BY line_user_id, week_start, method_name
),
weekly_totals AS (
  SELECT
    line_user_id,
    week_start,
    SUM(matched_days) AS week_total_matched
  FROM weekly
  GROUP BY line_user_id, week_start
)
SELECT
  w.week_start,
  w.method_name,
  w.matched_days,
  ROUND(w.matched_days::numeric / NULLIF(wt.week_total_matched,0), 4) AS week_composition_ratio
FROM weekly w
JOIN weekly_totals wt
  ON wt.line_user_id = w.line_user_id
 AND wt.week_start = w.week_start
WHERE w.line_user_id = :uid
ORDER BY w.week_start DESC, w.matched_days DESC, w.method_name;
