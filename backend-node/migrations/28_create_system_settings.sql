-- 系统配置表（动态配置，后台管理可改，无需重启）
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 预置：系统开关
INSERT INTO system_settings (key, value, description) VALUES
  ('registration_enabled',  'true',  '是否开放注册'),
  ('maintenance_mode',      'false', '维护模式（开启后前端展示维护页）'),
  ('welcome_bonus_enabled', 'false', '新人赠送积分开关'),
  ('welcome_bonus_amount',  '30',    '新人赠送积分数');

-- 预置：积分价格
INSERT INTO system_settings (key, value, description) VALUES
  ('credit_text_gen',            '1',  '文本生成（剧本/提取）'),
  ('credit_image_gen',           '2',  '图片生成（角色/场景/道具）'),
  ('credit_storyboard_image',    '3',  '分镜图片（带参考图）'),
  ('credit_video_standard',      '5',  '视频标准档'),
  ('credit_video_hd',            '10', '视频高清档'),
  ('credit_video_premium',       '15', '视频旗舰档'),
  ('credit_tts',                 '1',  'TTS配音'),
  ('credit_prompt_polish',       '1',  '提示词优化'),
  ('credit_storyboard_gen',      '2',  '分镜脚本生成（单集）');

-- 预置：中转站配置 - 文本
INSERT INTO system_settings (key, value, description) VALUES
  ('relay_text_url',    '', '文本中转站地址'),
  ('relay_text_key',    '', '文本中转站Key'),
  ('relay_text_model',  'deepseek-v3.2', '文本默认模型'),
  ('relay_text_protocol', '', '文本接口规范');

-- 预置：中转站配置 - 图片
INSERT INTO system_settings (key, value, description) VALUES
  ('relay_image_url',    '', '图片中转站地址'),
  ('relay_image_key',    '', '图片中转站Key'),
  ('relay_image_model',  'doubao-seedream-4-5-251128', '图片默认模型'),
  ('relay_image_protocol', '', '图片接口规范');

-- 预置：中转站配置 - 分镜图
INSERT INTO system_settings (key, value, description) VALUES
  ('relay_sb_image_url',    '', '分镜图中转站地址'),
  ('relay_sb_image_key',    '', '分镜图中转站Key'),
  ('relay_sb_image_model',  'doubao-seedream-4-5-251128', '分镜图默认模型'),
  ('relay_sb_image_protocol', '', '分镜图接口规范');

-- 预置：中转站配置 - 视频
INSERT INTO system_settings (key, value, description) VALUES
  ('relay_video_url',    '', '视频中转站地址'),
  ('relay_video_key',    '', '视频中转站Key'),
  ('relay_video_model',  'doubao-seedance-1-0-pro-250528', '视频默认模型'),
  ('relay_video_protocol', '', '视频接口规范');

-- 预置：中转站配置 - TTS
INSERT INTO system_settings (key, value, description) VALUES
  ('relay_tts_url',    '', 'TTS中转站地址'),
  ('relay_tts_key',    '', 'TTS中转站Key'),
  ('relay_tts_model',  'tts-1', 'TTS默认模型');

-- 预置：支付配置
INSERT INTO system_settings (key, value, description) VALUES
  ('pay_pid',      '', '彩虹易支付商户ID'),
  ('pay_key',      '', '彩虹易支付商户密钥'),
  ('pay_url',      '', '彩虹易支付网关地址'),
  ('pay_type',     'alipay', '支付方式（alipay/wxpay）');
