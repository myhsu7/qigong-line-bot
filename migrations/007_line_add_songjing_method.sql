INSERT INTO practice_methods (code, name_zh, name_en, estimated_minutes, sort_order, parent_id, method_type)
SELECT child.code, child.name_zh, child.name_en, child.estimated_minutes, child.sort_order, parent.id, 'leaf'
FROM (
    VALUES
        ('jinggong_songjing', '鬆靜功', 'Songjing Practice', 10, 113, 'jinggong')
) AS child(code, name_zh, name_en, estimated_minutes, sort_order, parent_code)
JOIN practice_methods parent ON parent.code = child.parent_code
ON CONFLICT (code) DO UPDATE SET
    name_zh = EXCLUDED.name_zh,
    name_en = EXCLUDED.name_en,
    estimated_minutes = EXCLUDED.estimated_minutes,
    sort_order = EXCLUDED.sort_order,
    parent_id = EXCLUDED.parent_id,
    method_type = EXCLUDED.method_type,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

UPDATE practice_methods
SET is_active = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE code NOT IN (
    'dayan',
    'dayan_chu',
    'dayan_gao',
    'wuqinxi',
    'wuqinxi_he',
    'wuqinxi_yuan',
    'wuqinxi_hu',
    'wuqinxi_xiong',
    'wuqinxi_lu',
    'huichun',
    'huichun_chu',
    'huichun_zhong',
    'guishou',
    'guishou_bagua',
    'guishou_qiankun',
    'guishou_fengxiang_guishuo',
    'zhengyang',
    'zhengyang_morning',
    'zhengyang_night',
    'huanghai',
    'lotus',
    'heqi',
    'sanwo',
    'liuyin',
    'jinggong',
    'jinggong_zhoutian',
    'jinggong_qixing',
    'jinggong_songjing'
);
