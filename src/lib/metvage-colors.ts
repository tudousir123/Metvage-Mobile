import { useTheme } from '@react-navigation/native'

// Page-level colors follow the selected navigation theme. Light cards and controls
// keep their explicit foreground/background pairs.
export function useMetvageColors() {
  const { dark, colors } = useTheme()
  return {
    background: colors.background,
    text: colors.text,
    secondaryText: dark ? '#bacac5' : '#536a64',
    link: dark ? '#8bdcc7' : '#075e52',
    error: dark ? '#ffb4ab' : '#b42318',
  }
}
