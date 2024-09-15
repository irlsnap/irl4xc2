import { type TextProps, StyleSheet, TextInput } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';
import { useState } from 'react';

export type ThemedTextProps = TextProps & {
  placeholder?: string,
  text?: string,
  onChangeText?:  React.Dispatch<React.SetStateAction<string>>,
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'password';
};

export function ThemedTextInput({
  style,
  placeholder,
  text,
  onChangeText,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'input');


  const secure = type === "password" ? true : false

  return (
    <TextInput
      style={{
        height: "6%",
        width: "90%",
        borderRadius: 6,
        margin: "2%",
        borderWidth: 1,
        borderColor: "#414141",
        paddingHorizontal: "5%",
        color: "#fff",
        backgroundColor: color
      }}
      autoCapitalize='none'
      secureTextEntry= {secure}
      placeholder={placeholder}
      onChangeText={onChangeText}
      value={text}
      {...rest}
    />
  );
}