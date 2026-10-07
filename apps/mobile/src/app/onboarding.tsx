import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Txt, type IconName } from '../components/ui';
import { PrefKeys, prefs } from '../lib/storage';
import { colors, radius, spacing } from '../lib/theme';

const SLIDES: { key: string; icon: IconName }[] = [
  { key: 's1', icon: 'car-sport' },
  { key: 's2', icon: 'pricetag' },
  { key: 's3', icon: 'people' },
  { key: 's4', icon: 'git-network' },
];

/** Spec §4: swipeable onboarding with Skip / Next / Get Started. */
export default function Onboarding() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const list = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const finish = async () => {
    await prefs.set(PrefKeys.onboardingSeen, '1');
    router.replace('/phone');
  };
  const next = () => (last ? finish() : list.current?.scrollToIndex({ index: index + 1, animated: true }));
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.top}>
        {!last && (
          <Pressable accessibilityRole="button" onPress={finish} style={styles.skip} hitSlop={12}>
            <Txt variant="bodyStrong" color={colors.primary}>
              {t('common.skip')}
            </Txt>
          </Pressable>
        )}
      </View>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        onScroll={onScroll}
        scrollEventThrottle={64}
        keyExtractor={(s) => s.key}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]} accessible accessibilityLabel={`${t(`onboarding.${item.key}Title`)}. ${t(`onboarding.${item.key}Body`)}`}>
            <View style={styles.art}>
              <Ionicons name={item.icon} size={96} color={colors.primary} />
            </View>
            <Txt variant="title" style={{ textAlign: 'center', marginTop: spacing.xxl }}>
              {t(`onboarding.${item.key}Title`)}
            </Txt>
            <Txt color={colors.textMuted} style={{ textAlign: 'center', marginTop: spacing.md, fontSize: 17, lineHeight: 24 }}>
              {t(`onboarding.${item.key}Body`)}
            </Txt>
          </View>
        )}
      />
      <View style={styles.dots} accessibilityLabel={`${index + 1} / ${SLIDES.length}`}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <View style={{ padding: spacing.xl }}>
        <Button label={last ? t('onboarding.getStarted') : t('common.next')} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { height: 52, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: spacing.xl },
  skip: { minHeight: 48, justifyContent: 'center' },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  art: { width: 220, height: 220, borderRadius: radius.xl * 4, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 24, backgroundColor: colors.primary },
});
