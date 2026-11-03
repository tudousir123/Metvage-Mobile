// The supplied Metvage designs deliberately use a warm, light brand surface.
// Keep foreground/background pairs together even when the device uses dark mode.
export const metvagePalette = {
  background: '#FCFAF6',
  surface: '#FFFFFF',
  field: '#F2F0EC',
  text: '#101820',
  secondaryText: '#747C83',
  green: '#0B503C',
  coral: '#ED8966',
  border: '#E5E3DE',
  softGreen: '#EAF1E9',
  softPeach: '#FFF0E3',
  error: '#AE352B',
} as const

export function useMetvageColors() {
  return {
    ...metvagePalette,
    link: metvagePalette.green,
  }
}
