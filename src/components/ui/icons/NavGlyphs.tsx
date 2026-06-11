import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/theme';

/**
 * Bottom-nav glyphs transcribed 1:1 from the Figma design-system component
 * set (node 6279:10543, file HIVq6Vaymj01dZ37AvwCUF). All strokes are 2px
 * on the original viewBoxes; color is parameterised so the active state can
 * flip to white on the filled chocolate circle.
 */
interface GlyphProps {
  size?: number;
  color?: string;
}

const DEFAULT = colors.neutral.chocolate;

/** Binoculars — Explore / Feed tab. Figma 26×26. */
export function ExploreGlyph({ size = 26, color = DEFAULT }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path d="M10.5625 8.9375H15.4375" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M23.3177 15.6731L18.8845 5.58594C18.4274 5.12885 17.8075 4.87207 17.161 4.87207C16.5146 4.87207 15.8946 5.12885 15.4375 5.58594V17.0625"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.5625 17.0625V5.58594C10.1054 5.12885 9.48542 4.87207 8.83898 4.87207C8.19255 4.87207 7.57258 5.12885 7.11547 5.58594L2.68227 15.6731"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.5 21.125C8.74366 21.125 10.5625 19.3062 10.5625 17.0625C10.5625 14.8188 8.74366 13 6.5 13C4.25634 13 2.4375 14.8188 2.4375 17.0625C2.4375 19.3062 4.25634 21.125 6.5 21.125Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19.5 21.125C21.7437 21.125 23.5625 19.3062 23.5625 17.0625C23.5625 14.8188 21.7437 13 19.5 13C17.2563 13 15.4375 14.8188 15.4375 17.0625C15.4375 19.3062 17.2563 21.125 19.5 21.125Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Sphaer hoops — Circles tab. Figma 24×17 (wider than tall). */
export function CirclesGlyph({ size = 24, color = DEFAULT }: GlyphProps) {
  const height = (size * 17) / 24;
  return (
    <Svg width={size} height={height} viewBox="0 0 24 17" fill="none">
      <Path
        d="M1 6C1 4.92597 1.89665 3.684 3.96191 2.65137C5.96736 1.64868 8.80796 0.999999 12 0.999999C15.192 0.999999 18.0326 1.64868 20.0381 2.65137C22.1034 3.684 23 4.92597 23 6C23 7.07402 22.1034 8.316 20.0381 9.34863C18.0326 10.3513 15.192 11 12 11C8.80796 11 5.96736 10.3513 3.96191 9.34863C1.89665 8.316 1 7.07402 1 6Z"
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M1 11C1 9.92597 1.89665 8.684 3.96191 7.65137C5.96736 6.64868 8.80796 6 12 6C15.192 6 18.0326 6.64868 20.0381 7.65136C22.1034 8.684 23 9.92597 23 11C23 12.074 22.1034 13.316 20.0381 14.3486C18.0326 15.3513 15.192 16 12 16C8.80796 16 5.96736 15.3513 3.96191 14.3486C1.89665 13.316 1 12.074 1 11Z"
        stroke={color}
        strokeWidth={2}
      />
    </Svg>
  );
}

/** Plus — Create tab. Figma 26×26. */
export function PlusGlyph({ size = 26, color = DEFAULT }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path d="M4.0625 13H21.9375" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13 4.0625V21.9375" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Double chat bubbles — Messages tab. Figma 26×26. */
export function ChatsGlyph({ size = 26, color = DEFAULT }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path
        d="M7.26984 14.625L3.25 17.875V4.875C3.25 4.65951 3.3356 4.45285 3.48798 4.30048C3.64035 4.1481 3.84701 4.0625 4.0625 4.0625H17.0625C17.278 4.0625 17.4847 4.1481 17.637 4.30048C17.7894 4.45285 17.875 4.65951 17.875 4.875V13.8125C17.875 14.028 17.7894 14.2347 17.637 14.387C17.4847 14.5394 17.278 14.625 17.0625 14.625H7.26984Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.125 14.625V18.6875C8.125 18.903 8.2106 19.1097 8.36297 19.262C8.51535 19.4144 8.72201 19.5 8.9375 19.5H18.7302L22.75 22.75V9.75C22.75 9.53451 22.6644 9.32785 22.512 9.17548C22.3596 9.0231 22.153 8.9375 21.9375 8.9375H17.875"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
