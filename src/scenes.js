/**
 * 场景 1 是动态夜空（流星），其余仍是全屏白底占位。
 */
export const SCENES = [1, 2, 3, 4].map((id) => ({
  id,
  scene_id: id,
}));

export const SCENES_BY_ID = Object.fromEntries(SCENES.map((scene) => [scene.scene_id, scene]));
