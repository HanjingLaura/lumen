/**
 * 场景配置是刻意保持数据化的：以后可以从服务端或配置文件加载，
 * 渲染器只根据 visual 类型绘制画面。
 */
export const SCENES = [
  {
    id: 1,
    scene_id: 1,
    slug: 'rain',
    title: '雨幕白噪音',
    kicker: 'RAIN / 01',
    description: '细密雨线与低对比蓝色，让注意力慢慢沉下来。',
    visual: 'rain',
    accent: '#9be7ff',
  },
  {
    id: 2,
    scene_id: 2,
    slug: 'drums',
    title: '低频鼓点',
    kicker: 'DRUMS / 02',
    description: '一组稳定的节拍脉冲，给空间一点温和的动能。',
    visual: 'drums',
    accent: '#ffb86c',
  },
  {
    id: 3,
    scene_id: 3,
    slug: 'ember',
    title: '余温壁炉',
    kicker: 'EMBER / 03',
    description: '缓慢漂浮的暖色光点，适合阅读与放空。',
    visual: 'ember',
    accent: '#ff9478',
  },
  {
    id: 4,
    scene_id: 4,
    slug: 'tide',
    title: '潮汐呼吸',
    kicker: 'TIDE / 04',
    description: '像潮水一样往复的线条，帮助把呼吸拉长。',
    visual: 'tide',
    accent: '#b5a7ff',
  },
];

export const SCENES_BY_ID = Object.fromEntries(SCENES.map((scene) => [scene.scene_id, scene]));
