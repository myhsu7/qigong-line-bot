-- 報表：個人功法「季趨勢」
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
    date_trunc('quarter', l.created_at AT TIME ZONE 'Asia/Taipei')::date AS quarter_start,
    (l.created_at AT TIME ZONE 'Asia/Taipei')::date AS local_date,
    md.method_name
  FROM checkin_logs l
  JOIN method_dict md
    ON EXISTS (
      SELECT 1 FROM unnest(md.aliases) a
      WHERE COALESCE(l.note,'') ILIKE '%' || a || '%'
    )
),
quarterly AS (
  SELECT
    line_user_id,
    quarter_start,
    method_name,
    COUNT(*) AS matched_days
  FROM matched
  GROUP BY line_user_id, quarter_start, method_name
),
quarterly_totals AS (
  SELECT
    line_user_id,
    quarter_start,
    SUM(matched_days) AS quarter_total_matched
  FROM quarterly
  GROUP BY line_user_id, quarter_start
)
SELECT
  q.quarter_start,
  q.method_name,
  q.matched_days,
  ROUND(q.matched_days::numeric / NULLIF(qt.quarter_total_matched,0), 4) AS quarter_composition_ratio
FROM quarterly q
JOIN quarterly_totals qt
  ON qt.line_user_id = q.line_user_id
 AND qt.quarter_start = q.quarter_start
WHERE q.line_user_id = :uid
ORDER BY q.quarter_start DESC, q.matched_days DESC, q.method_name;
