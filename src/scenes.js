/**
 * 四个全屏占位场景。画面先保持空白，只靠编号区分。
 */
export const SCENES = [1, 2, 3, 4].map((id) => ({
  id,
  scene_id: id,
}));

export const SCENES_BY_ID = Object.fromEntries(SCENES.map((scene) => [scene.scene_id, scene]));
