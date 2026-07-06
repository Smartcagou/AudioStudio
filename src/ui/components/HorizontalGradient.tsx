// Dégradé horizontal en pur JS, sans module natif (pas de expo-linear-gradient,
// donc pas de rebuild). Rend une série de segments de couleur interpolée entre
// deux teintes. Suffisant pour la barre de progression orange -> ambre du lecteur.

import { View, ViewStyle } from 'react-native';

interface HorizontalGradientProps {
  from: string;
  to: string;
  style?: ViewStyle;
  segments?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return [r, g, b];
}

function lerpColor(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function HorizontalGradient({
  from,
  to,
  style,
  segments = 16,
}: HorizontalGradientProps) {
  return (
    <View style={[{ flexDirection: 'row', overflow: 'hidden' }, style]}>
      {Array.from({ length: segments }).map((_, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            backgroundColor: lerpColor(from, to, segments === 1 ? 0 : index / (segments - 1)),
          }}
        />
      ))}
    </View>
  );
}
