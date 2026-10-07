import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { CameraType, launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync } from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { DocBadge } from '../../components/DocBadge';
import { DateField, dmyToIso, isoToDmy } from '../../components/forms';
import { Button, Card, Screen, TextField, Txt, notify } from '../../components/ui';
import { errorMessage } from '../../i18n';
import { api } from '../../lib/api';
import { useRegistration, useSetRegistration } from '../../lib/registration';
import { colors, radius, spacing } from '../../lib/theme';
import { uploadDocumentPhoto } from '../../lib/upload';

interface Photo {
  uri: string;
  width?: number;
  height?: number;
}

/** Capture or pick photos for one document, then upload them securely and submit a new version for review. */
export default function DocumentScreen() {
  const { t } = useTranslation();
  const { type } = useLocalSearchParams<{ type: string }>();
  const { data: reg } = useRegistration();
  const setRegistration = useSetRegistration();
  const entry = reg?.documents.find((d) => d.type.code === type);
  const [number, setNumber] = useState(entry?.current?.documentNumber ?? '');
  const [expiry, setExpiry] = useState(isoToDmy(entry?.current?.expiresOn));
  const [photos, setPhotos] = useState<(Photo | null)[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<string | null>(null);

  if (!entry) return null;
  const docType = entry.type;
  const isSelfie = docType.code === 'PROFILE_PHOTO';
  const slots = Math.min(docType.maxFiles, Math.max(docType.minFiles, photos.filter(Boolean).length + 1));
  const slotLabel = (i: number) => (docType.code === 'DRIVING_LICENCE' ? (i === 0 ? t('reg.front') : t('reg.back')) : t('reg.photoN', { n: i + 1 }));

  const take = async (i: number, fromCamera: boolean) => {
    try {
      if (fromCamera && Platform.OS !== 'web') {
        const perm = await requestCameraPermissionsAsync();
        if (!perm.granted) return notify(t('reg.takePhoto'), t('reg.cameraDenied'));
      }
      const opts = { mediaTypes: ['images' as const], quality: 0.9, ...(isSelfie ? { cameraType: CameraType.front } : {}) };
      const result = fromCamera && Platform.OS !== 'web' ? await launchCameraAsync(opts) : await launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets[0]) return;
      const a = result.assets[0];
      setPhotos((prev) => {
        const next = [...prev];
        next[i] = { uri: a.uri, width: a.width, height: a.height };
        return next;
      });
      setErrors((e) => ({ ...e, photos: '' }));
    } catch (e) {
      notify(errorMessage(e));
    }
  };

  const save = async () => {
    const chosen = photos.filter((p): p is Photo => !!p);
    const e: Record<string, string> = {};
    const iso = docType.requiresExpiry ? dmyToIso(expiry) : null;
    if (docType.requiresNumber && number.trim().length < 3) e.number = t('reg.docNumber');
    if (docType.requiresExpiry && !iso) e.expiry = t('reg.dobInvalid');
    if (chosen.length < docType.minFiles) e.photos = t('reg.needPhotos', { n: docType.minFiles });
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const uploadIds: string[] = [];
      for (const [i, p] of chosen.entries()) {
        setProgress(t('reg.uploading', { done: i + 1, total: chosen.length }));
        uploadIds.push(await uploadDocumentPhoto(p.uri, p.width, p.height));
      }
      setRegistration(
        await api.submitDocument(docType.code, {
          uploadIds,
          ...(docType.requiresNumber ? { documentNumber: number.trim() } : {}),
          ...(iso ? { expiresOn: iso } : {}),
        }),
      );
      router.back();
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: docType.label }} />
      {entry.current && (
        <Card style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt variant="bodyStrong">{t('reg.current')}</Txt>
            <DocBadge entry={entry} />
          </View>
          {entry.current.rejectionReason ? (
            <Txt color={colors.danger} style={{ marginTop: spacing.sm }}>
              {entry.current.rejectionReason}
            </Txt>
          ) : null}
          {entry.current.expiresOn ? (
            <Txt variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
              {t('reg.expiresOn', { date: isoToDmy(entry.current.expiresOn) })}
            </Txt>
          ) : null}
          <View style={styles.thumbs}>
            {entry.current.fileIds.map((id) => (
              <RemoteThumb key={id} uploadId={id} />
            ))}
          </View>
        </Card>
      )}

      <Txt variant="heading" style={{ marginBottom: spacing.md }}>
        {entry.current ? t('reg.newVersion') : docType.label}
      </Txt>
      {docType.requiresNumber && <TextField label={t('reg.docNumber')} value={number} onChangeText={(v) => setNumber(v.toUpperCase())} autoCapitalize="characters" error={errors.number} />}
      {docType.requiresExpiry && <DateField label={t('reg.expiryDate')} value={expiry} onChange={setExpiry} error={errors.expiry} />}

      <Txt variant="bodyStrong">{t('reg.photos')}</Txt>
      <Txt variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
        {t('reg.photoHint')}
      </Txt>
      {Array.from({ length: slots }).map((_, i) => {
        const p = photos[i];
        return (
          <View key={i} style={styles.slot}>
            {p ? (
              <Image source={{ uri: p.uri }} style={styles.preview} accessibilityLabel={slotLabel(i)} />
            ) : (
              <View style={[styles.preview, styles.placeholder]}>
                <Ionicons name={isSelfie ? 'person' : 'document-text'} size={32} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: spacing.md, gap: spacing.sm }}>
              <Txt variant="bodyStrong">{slotLabel(i)}</Txt>
              <Button label={p ? t('reg.retake') : t('reg.takePhoto')} icon="camera" onPress={() => take(i, true)} style={{ minHeight: 44 }} />
              <Button label={t('reg.gallery')} variant="secondary" icon="images" onPress={() => take(i, false)} style={{ minHeight: 44 }} />
            </View>
          </View>
        );
      })}
      {errors.photos ? (
        <Txt color={colors.danger} style={{ marginBottom: spacing.md }}>
          {errors.photos}
        </Txt>
      ) : null}
      {progress ? (
        <Txt color={colors.textMuted} accessibilityLiveRegion="polite" style={{ textAlign: 'center', marginTop: spacing.md }}>
          {progress}
        </Txt>
      ) : null}
      <Button label={t('common.save')} onPress={save} loading={!!progress} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}

function RemoteThumb({ uploadId }: { uploadId: string }) {
  const { data } = useQuery({ queryKey: ['upload-url', uploadId], queryFn: () => api.uploadUrl(uploadId), staleTime: 4 * 60_000 });
  return data ? <Image source={{ uri: data.url }} style={styles.thumb} /> : <View style={[styles.thumb, styles.placeholder]} />;
}

const styles = StyleSheet.create({
  slot: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  preview: { width: 112, height: 112, borderRadius: radius.md, backgroundColor: colors.surface },
  placeholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  thumb: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.border },
});
