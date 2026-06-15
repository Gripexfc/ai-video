-- 性能优化索引（不影响现有功能，只加速查询）
-- storyboards 按集查询 + 排序（最频繁的查询路径）
CREATE INDEX IF NOT EXISTS idx_storyboards_episode_id ON storyboards (episode_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_storyboards_episode_number ON storyboards (episode_id, storyboard_number, deleted_at);

-- episodes 按 drama 查询
CREATE INDEX IF NOT EXISTS idx_episodes_drama_id ON episodes (drama_id, deleted_at);

-- characters 按 drama 查询（角色列表 + 参考图查询）
CREATE INDEX IF NOT EXISTS idx_characters_drama_id ON characters (drama_id, deleted_at);

-- scenes 按 drama / episode 查询
CREATE INDEX IF NOT EXISTS idx_scenes_drama_id ON scenes (drama_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_scenes_episode_id ON scenes (episode_id, deleted_at);

-- props 按 drama / episode 查询
CREATE INDEX IF NOT EXISTS idx_props_drama_id ON props (drama_id, deleted_at);

-- image_generations 按分镜/角色/场景查询
CREATE INDEX IF NOT EXISTS idx_image_gens_storyboard ON image_generations (storyboard_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_image_gens_character ON image_generations (character_id, frame_type, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_image_gens_scene ON image_generations (scene_id, frame_type, status, deleted_at);

-- video_generations 按分镜查询
CREATE INDEX IF NOT EXISTS idx_video_gens_storyboard ON video_generations (storyboard_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_video_gens_drama ON video_generations (drama_id, deleted_at);

-- async_tasks 按 resource_id 查询
CREATE INDEX IF NOT EXISTS idx_async_tasks_resource ON async_tasks (resource_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_async_tasks_status ON async_tasks (status);

-- video_merges 按 episode / drama 查询
CREATE INDEX IF NOT EXISTS idx_video_merges_episode ON video_merges (episode_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_video_merges_drama ON video_merges (drama_id, deleted_at);

-- storyboards 按 scene_id 查询
CREATE INDEX IF NOT EXISTS idx_storyboards_scene_id ON storyboards (scene_id, deleted_at);

-- assets 按 drama 查询
CREATE INDEX IF NOT EXISTS idx_assets_drama ON assets (drama_id, deleted_at);

-- episode_characters 按 episode 查询
CREATE INDEX IF NOT EXISTS idx_episode_characters_ep ON episode_characters (episode_id);

-- storyboard_props 按分镜查询
CREATE INDEX IF NOT EXISTS idx_storyboard_props_sb ON storyboard_props (storyboard_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_props_prop ON storyboard_props (prop_id);

-- storyboard_characters 按分镜查询
CREATE INDEX IF NOT EXISTS idx_storyboard_chars_sb ON storyboard_characters (storyboard_id);

-- character_libraries 按 drama 查询
CREATE INDEX IF NOT EXISTS idx_char_lib_drama ON character_libraries (drama_id, deleted_at);

-- scene_libraries 按 drama 查询
CREATE INDEX IF NOT EXISTS idx_scene_lib_drama ON scene_libraries (drama_id, deleted_at);

-- prop_libraries 按 drama 查询
CREATE INDEX IF NOT EXISTS idx_prop_lib_drama ON prop_libraries (drama_id, deleted_at);

-- image_proxy_cache 按 cache_key 查询（已有 UNIQUE，显式加索引加速）
CREATE INDEX IF NOT EXISTS idx_image_proxy_cache_key ON image_proxy_cache (cache_key);

-- ai_model_map 按 key 查询（已有 UNIQUE，显式加索引）
CREATE INDEX IF NOT EXISTS idx_ai_model_map_key ON ai_model_map (key);

-- dramas 按 status + updated_at 排序（列表页）
CREATE INDEX IF NOT EXISTS idx_dramas_status_updated ON dramas (deleted_at, status, updated_at DESC);
