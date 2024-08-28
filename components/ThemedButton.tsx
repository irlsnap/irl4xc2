import { Text, type TextProps, TouchableOpacity } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from './ThemedText';

export type ThemedButtonProps = TextProps & {
    text?: string;
  lightColor?: string;
  darkColor?: string;
//   type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedButton({
    text,
  style,
  lightColor,
  darkColor,
//   type = 'default',
  ...rest
}: ThemedButtonProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'button');

  return (
    <TouchableOpacity style={{
        backgroundColor: "#fff"
    }}>
        <ThemedText>Hello</ThemedText>
    </TouchableOpacity>
  );
}