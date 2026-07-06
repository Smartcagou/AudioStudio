// Palette sombre neumorphique du lecteur (écrans Player et NowPlaying).
// Approximation du neumorphisme : Android ne fournit qu'une ombre (elevation).
// On simule le relief avec des bordures claires en haut et sombres en bas,
// plus l'elevation. Le dégradé du scrubber est simulé en pur JS (voir
// components/HorizontalGradient), sans module natif.

export const palette = {
  background: '#1b1b1f',
  surface: '#242429',
  surfaceRaised: '#2b2b31',
  pill: '#f4511e',
  accent: '#ff5a1f',
  accentBright: '#ffb03a',
  track: '#3a3a41',
  textPrimary: '#f2f2f5',
  textSecondary: '#8a8a93',
  textOnAccent: '#ffffff',
  shadowLight: '#33333b',
  shadowDark: '#101013',
};

// Bordures neumorphiques d'une surface en relief.
export const raisedBorders = {
  borderTopColor: palette.shadowLight,
  borderLeftColor: palette.shadowLight,
  borderRightColor: palette.shadowDark,
  borderBottomColor: palette.shadowDark,
  borderWidth: 1,
};
