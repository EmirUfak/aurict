// Viewer constants — colour palette, layout forces, sizing heuristics.
// Kept separate from state.js so layout tweaks live in one place.

export const NODE_COLOR_BY_KIND = {
  function:    0x7c5cff,
  method:      0xc490ff,
  class:       0xffb454,
  interface:   0x4cd4ff,
  component:   0xff5c79,
  type_alias:  0x9bdfff,
  enum:        0x2bd4a3,
  enum_member: 0x66d9a8,
  route:       0xfff070,
  struct:      0xff9b6b,
  namespace:   0x8b94a7,
  property:    0xc9c9c9,
  constant:    0xd2e0ff,
  variable:    0xe7ecf3,
  field:       0xa0a8b8,
}

export const EDGE_COLOR = {
  calls:        0xff7a8a,
  references:   0x6ab8ff,
  imports:      0xffb454,
  instantiates: 0xc490ff,
  implements:   0x2bd4a3,
  extends:      0xff9b6b,
}

export const HIGHLIGHT_SCALE   = 3.2
export const NODE_SIZE_BASE     = 1.8
export const NODE_SIZE_DEGREE_FACTOR = 0.18
export const NODE_SIZE_MAX      = 8
export const LINK_DISTANCE      = 12
export const FIELD_STRENGTH     = -45
export const ALPHA_DECAY        = 0.0228
export const SIM_TICKS_PER_FRAME = 1