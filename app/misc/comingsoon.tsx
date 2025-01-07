import { StyleSheet } from 'react-native';
import { ThemedText } from '@/components/shared/ThemedText'; // Assuming you have the ThemedText component
import { ThemedView } from '@/components/shared/ThemedView';

export default function ComingSoonPage({text = "Coming Soon ;)"}) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.text} type="title">
        {text}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: 'white',
  },
});