import { Text, type TextProps, StyleSheet } from 'react-native';
import {
  useFonts,
} from 'expo-font';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | "grayed";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  let [fontsLoaded] = useFonts({
    'Zoi-Regular': require('@/assets/fonts/Zoi-Regular.otf'),
  });

  if(fontsLoaded)
  return (
    <Text
      adjustsFontSizeToFit={true}
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'grayed' ? styles.grayed : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Zoi-Regular',
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Zoi-Regular',
  },
  title: {
    fontSize: 26,
    textAlign: 'center',
    fontWeight: 'bold',
    fontFamily: 'Zoi-Regular',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Zoi-Regular',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#3797EF',
    fontFamily: 'Zoi-Regular',
  },
  grayed: {
    fontSize: 16,
    color: '#414141',
    fontFamily: 'Zoi-Regular',
  }
});
