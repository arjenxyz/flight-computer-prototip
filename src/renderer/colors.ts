/** Airbus / Boeing style EFIS color palette */

export const EFIS = {
  background: "#0a0a0a",
  white: "#ffffff",
  green: "#00ff00",
  magenta: "#ff00ff",
  cyan: "#00ffff",
  blue: "#00a0ff",
  yellow: "#ffff00",
  amber: "#ffbf00",
  gray: "#808080",
  dimWhite: "#c0c0c0",
} as const;

export type EfisColor = (typeof EFIS)[keyof typeof EFIS];
