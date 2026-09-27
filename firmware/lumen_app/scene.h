#pragma once

#include <stdint.h>

typedef void (*SceneFn)();

struct Scene {
  uint8_t id;
  SceneFn enter;
  SceneFn loop;
};

void scene1Enter();
void scene1Loop();
void scene2Enter();
void scene2Loop();
void scene3Enter();
void scene3Loop();
void scene4Enter();
void scene4Loop();

extern const Scene SCENES[];
extern const uint8_t SCENE_COUNT;
