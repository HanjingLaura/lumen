/**
 * 场景 1 是夜城雨景，场景 2 是固定镜头的流星夜空。场景 3、4 仍是白底占位。
 */
export const SCENES = [1, 2, 3, 4].map((id) => ({
  id,
  scene_id: id,
}));

export const SCENES_BY_ID = Object.fromEntries(SCENES.map((scene) => [scene.scene_id, scene]));
