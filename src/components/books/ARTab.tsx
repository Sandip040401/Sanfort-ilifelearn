import React, { useMemo, useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Alert,
  PermissionsAndroid,
} from 'react-native';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import { Box, ChevronRight, Play } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { StackNavigationProp } from '@react-navigation/stack';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useTheme } from '@/theme';
import type { BookConcept, MainStackParamList, BooksStackParamList, ARModel } from '@/types';
import { ARService } from '@/services';
import { useAuth } from '@/store';
import ARInstructionModal from '@/components/ARInstructionModal';
import { ARScannerModule } from '@/screens/ar/ARScannerModule';
import { normalizeEnvName } from '@/utils/normalize';
import { withAlpha } from '@/screens/books/books.data';
import { getReferenceImageSource } from '@/screens/ar/ar.reference';

const isAndroid = Platform.OS === 'android';

function ModelPreviewImage({
  thumbnailUri,
  previewUri,
  fallbackIcon,
  style,
  resizeMode = 'contain'
}: {
  thumbnailUri?: string | null;
  previewUri?: string | null;
  fallbackIcon?: string;
  style: any;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
}) {
  const [currentUri, setCurrentUri] = useState<string | null>(thumbnailUri || null);
  const [failedThumbnail, setFailedThumbnail] = useState(false);

  const handleError = () => {
    if (!failedThumbnail && previewUri && previewUri !== thumbnailUri) {
      setCurrentUri(previewUri);
      setFailedThumbnail(true);
    } else {
      setCurrentUri(null);
    }
  };

  if (!currentUri) {
    return (
      <View style={styles.modelFallback}>
        <Box size={moderateScale(32)} color="rgba(255,255,255,0.8)" strokeWidth={2} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: currentUri }}
      style={style}
      resizeMode={resizeMode}
      onError={handleError}
    />
  );
}

function getPreviewUri(model: any) {
  const mId = model.modelId;

  // 1. If modelId is an object (contains thumbnail/preview_image/name)
  if (mId && typeof mId === 'object') {
    if (mId.thumbnail) return mId.thumbnail;
    if (mId.preview_image) return mId.preview_image;
    if (mId._id) return ARService.getThumbnailImageUrl(String(mId._id));
  }

  // 2. Fallback to modelId as a string
  const actualId = model.modelId || model._id || model.id;
  if (actualId && typeof actualId === 'string') {
    return ARService.getThumbnailImageUrl(actualId);
  }

  return null;
}

function ARModelOptionsSheet({
  modelName,
  subjectName,
  modelType,
  onView3D,
  onViewSheet,
  onScan,
}: {
  modelName: string;
  subjectName?: string;
  modelType?: string;
  onView3D: () => void;
  onViewSheet: () => void;
  onScan: () => void;
}) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const normalizedSubject = normalizeEnvName(subjectName || '').toLowerCase();
  const onlyShowPlaceButton =
    normalizedSubject.includes('my body') ||
    normalizedSubject.includes('numbers') ||
    modelType === 'multiple-glb' ||
    modelType === 'multi-glb' ||
    modelType === 'video' ||
    modelType === 'multiple-animation-execution';

  const buttons = [
    {
      id: 'place',
      label: '3D Color & Place',
      sub: 'Color your character in 3D & place it in your real world',
      gradient: ['#6486ee', '#7663d7', '#8153b5'] as string[],
      locations: [0, 0.6, 1] as number[],
      onPress: onView3D,
      image: require('@/assets/images/ar_modes/3D.webp'),
    },
    {
      id: 'sheet',
      label: 'Color Sheet → 3D',
      sub: 'Color on screen and turn it into a 3D character you can place',
      gradient: ['#c66fe4', '#dd66cc', '#e660bf', '#f19769'] as string[],
      locations: [0, 0.4, 0.7, 1] as number[],
      onPress: onViewSheet,
      image: require('@/assets/images/ar_modes/Color.webp'),
    },
    {
      id: 'scan',
      label: 'Scan Drawing → 3D',
      sub: 'Color on paper, scan it and bring your character to life in 3D.',
      gradient: ['#479bf2', '#47b2c6', '#47da91'] as string[],
      locations: [0, 0.75, 0.9] as number[],
      onPress: onScan,
      image: require('@/assets/images/ar_modes/Scan.webp'),
    },
  ].filter(button => !onlyShowPlaceButton || button.id === 'place');

  if (isLandscape) {
    return (
      <View style={sheetLandscapeStyles.root}>
        <View style={sheetLandscapeStyles.header}>
          <Text style={[sheetLandscapeStyles.title, { color: colors.text }]} numberOfLines={1}>
            {modelName}
          </Text>
          <Text style={[sheetLandscapeStyles.sub, { color: colors.textSecondary }]}>
            Choose how to explore
          </Text>
        </View>
        <View style={sheetLandscapeStyles.row}>
          {buttons.map((btn) => (
            <TouchableOpacity
              key={btn.label}
              activeOpacity={0.85}
              onPress={btn.onPress}
              style={sheetLandscapeStyles.btn}>
              <LinearGradient
                colors={btn.gradient}
                locations={btn.locations}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {btn.image && (
                <Image source={btn.image} style={sheetLandscapeStyles.btnImage} resizeMode="contain" />
              )}
              <Text style={sheetLandscapeStyles.btnTitle}>{btn.label}</Text>
              <Text style={sheetLandscapeStyles.btnSub} numberOfLines={1}>{btn.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sheetInner}>
      <Text style={[styles.sheetTitle, { color: colors.text }]}>{modelName}</Text>
      <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>
        Choose how to explore this model
      </Text>

      <View style={styles.sheetActions}>
        {buttons.map((btn) => (
          <TouchableOpacity key={btn.label} activeOpacity={0.85} onPress={btn.onPress} style={styles.sheetButtonWrap}>
            <LinearGradient
              colors={btn.gradient}
              locations={btn.locations}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.sheetButtonGradient}
            />
            {btn.image && (
              <View style={styles.sheetButtonIconContainer}>
                <Image source={btn.image} style={styles.sheetButtonImage} resizeMode="contain" />
              </View>
            )}
            <View style={styles.sheetButtonTexts}>
              <Text style={styles.sheetButtonTitle}>{btn.label}</Text>
              <Text style={styles.sheetButtonSub}>{btn.sub}</Text>
            </View>
            <View style={styles.sheetButtonArrow}>
              <ChevronRight size={moderateScale(24)} color="#fff" />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

type ARTabProps = {
  concepts: BookConcept[];
  accentColor: string;
  subjectName?: string;
  bottomInset: number;
  headerContent?: React.ReactNode;
  tabBarContent?: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  gradeKey?: string;
};

export default function ARTab({
  concepts,
  accentColor,
  subjectName,
  bottomInset,
  headerContent,
  tabBarContent,
  refreshing,
  onRefresh,
  gradeKey,
}: ARTabProps) {
  console.log('🚀 ~ ARTab ~ gradeKey:', gradeKey);
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const navigation = useNavigation<StackNavigationProp<MainStackParamList & BooksStackParamList>>();

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [instructionVisible, setInstructionVisible] = useState(false);
  const [scanningModel, setScanningModel] = useState<any>(null);

  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'super-admin';

  const teacherModelsQuery = useQuery({
    queryKey: ['ar-models-teacher', gradeKey],
    queryFn: async () => {
      const response = await ARService.getALLArModals(gradeKey);
      return response.data?.arModals || [];
    },
    enabled: isTeacher && !!gradeKey,
    staleTime: 5 * 60 * 1000,
  });

  const arItems = useMemo(() => {
    // Subject name comes from the concept in the SubjectContentScreen payload
    return concepts.flatMap(concept =>
      (concept.ar || []).map((ar, index) => ({
        ...ar,
        conceptTitle: concept.title,
        weekNumber: concept.volumeNumber,
        subjectName: subjectName || (concept as any).subject,
        uniqueId: `${concept.id}-ar-${index}`,
      }))
    );
  }, [concepts, subjectName]);

  const finalItems = useMemo(() => {
    if (!isTeacher || !teacherModelsQuery.data) {
      return arItems;
    }

    const teacherModels = (teacherModelsQuery.data || []).map((m: any) => ({
      ...m,
      modelId: m,
      name: m.name,
      uniqueId: `teacher-${m._id}`,
      weekNumber: '∞' // Marker for teacher-only / overall models
    }));

    // Merge and remove duplicates
    const conceptIds = new Set(arItems.map(ai => {
      const id = typeof ai.modelId === 'object' ? ai.modelId?._id : ai.modelId;
      return String(id);
    }));

    const filteredTeacherModels = teacherModels.filter((tm: any) => !conceptIds.has(String(tm._id)));

    return [...arItems, ...filteredTeacherModels];
  }, [arItems, isTeacher, teacherModelsQuery.data]);

  const closeSheet = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
    setSelectedItem(null);
  }, []);

  const handleOpenModel = useCallback((model: any, opts?: { openPainter?: boolean; initialPaintMode?: string }) => {
    closeSheet();
    const modelId = String(typeof model.modelId === 'object' ? model.modelId?._id : model.modelId);
    navigation.navigate('ARViewer', {
      modelId,
      gradeKey,
      openPainter: opts?.openPainter,
      initialPaintMode: opts?.initialPaintMode as any
    });
  }, [navigation, closeSheet]);

  const startActualScan = async (model: any) => {
    if (Platform.OS !== 'android') {
      Alert.alert('Not Supported', 'AR Scan is currently available on Android only.');
      return;
    }
    console.log('🚀 ~ ARTab ~ startActualScan ~ model:', model);

    try {
      const supported = await ARScannerModule.isARSupported();
      if (!supported) {
        Alert.alert('Not Supported', 'ARCore is not available on this device.');
        return;
      }

      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Camera Permission', 'Camera permission is required for AR Scan.');
        return;
      }

      const actualModel = typeof model.modelId === 'object' ? model.modelId : null;
      const modelId = String(actualModel?._id || model.modelId || model._id || model.id || '').trim();

      if (!modelId) {
        Alert.alert('Error', 'Model ID not found. Please refresh and try again.');
        return;
      }

      // Prioritize direct file URL
      let modelFileUrl = (model as any).file && String((model as any).file).startsWith('http')
        ? (model as any).file
        : (actualModel?.file && String(actualModel.file).startsWith('http'))
          ? actualModel.file
          : null;

      // Prioritize direct preview/thumbnail
      let referenceImageUrl = (model as any).preview_image || (model as any).thumbnail || actualModel?.preview_image || actualModel?.thumbnail || getReferenceImageSource(model);

      // Fetch detailed model data if file URL is missing or we need more info
      let fetchedModelData: any = null;
      if (!modelFileUrl || !referenceImageUrl) {
        try {
          const res = await ARService.getUserArModalById(modelId, gradeKey);
          console.log('API response res\n', JSON.stringify(res.data, null, 2));
          const modelData = res.data?.modal || res.data?.arModal || (res.data as any);
          fetchedModelData = modelData.arModal;

          if (fetchedModelData) {
            if (!modelFileUrl) modelFileUrl = fetchedModelData.file;
            if (!referenceImageUrl) referenceImageUrl = fetchedModelData.preview_image || fetchedModelData.thumbnail;
          }
        } catch (err) {
          console.error('Failed to fetch model details for scanner:', err);
        }
      }

      // Final fallbacks
      if (!modelFileUrl) modelFileUrl = ARService.getModelFileUrl(modelId);
      if (!referenceImageUrl) referenceImageUrl = ARService.getPreviewImageUrl(modelId);

      // Fetch audios for this model or use pre-loaded ones (prioritizing direct URLs)
      let audiosJson: string | undefined;
      try {
        const allowedUrls = (model as any).allowedAudioURLs || [];
        let modelAudios = (model as any).audios || actualModel?.audios || fetchedModelData?.audios || [];

        if (modelAudios.length > 0) {
          // Apply filtering if a whitelist exists
          if (allowedUrls.length > 0) {
            modelAudios = modelAudios.filter((a: any) =>
              allowedUrls.includes(a.url) || allowedUrls.includes(a.gridfsId) || allowedUrls.includes(a._id)
            );
          }

          const mapped = modelAudios.map((a: any) => ({
            ...a,
            audioUrl: a.url || (a.gridfsId ? ARService.getAudioStreamUrlById(a.gridfsId) : null)
          }));
          audiosJson = JSON.stringify(mapped);
        } else {
          const audiosResponse = await ARService.getModelAudios(modelId);
          if (audiosResponse.audios?.length) {
            let fetchedAudios = audiosResponse.audios;

            // Apply filtering if a whitelist exists
            if (allowedUrls.length > 0) {
              fetchedAudios = fetchedAudios.filter(a =>
                allowedUrls.includes(a.url) || allowedUrls.includes(a.gridfsId) || allowedUrls.includes(a._id)
              );
            }

            const audiosWithUrls = fetchedAudios.map(a => ({
              ...a,
              audioUrl: a.url || ARService.getAudioStreamUrlById(a.gridfsId),
            }));
            audiosJson = JSON.stringify(audiosWithUrls);
          }
        }
      } catch {
        // Audio fetch failed — scanner will work without audio
      }

      await ARScannerModule.startScannerDynamic(
        modelFileUrl,
        referenceImageUrl,
        model.name || 'model',
        audiosJson,
      );
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to launch AR Scanner.');
    } finally {
      closeSheet();
    }
  };

  const handleScanModel = (model: any) => {
    closeSheet();
    setScanningModel(model);
    setInstructionVisible(true);
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
      />
    ),
    [],
  );

  const handleInternalRefresh = useCallback(() => {
    if (isTeacher) {
      teacherModelsQuery.refetch();
    }
    onRefresh();
  }, [isTeacher, onRefresh, teacherModelsQuery]);

  const snapPoints = useMemo(() => [isLandscape ? '92%' : '62%'], [isLandscape]);

  const gridGap = scale(14);
  const isTablet = width >= 768;
  const numColumns = isTablet ? 3 : 2;
  const paddingH = scale(20);
  const cardWidth = (width - paddingH * 2 - gridGap * (numColumns - 1)) / numColumns;

  const renderItem = ({ item }: { item: any, index: number }) => {
    const thumbnailUri = getPreviewUri(item);
    const modelId = typeof item.modelId === 'object' ? item.modelId?._id : item.modelId;
    const modelName = item.modelId?.name || item.name || '3D Experience';
    const gradientColors = [accentColor, withAlpha(accentColor, 0.7)];

    return (
      <Pressable
        onPress={() => {
          if (modelId) {
            setSelectedItem(item);
            bottomSheetModalRef.current?.present();
          }
        }}
        style={({ pressed }) => [
          styles.modelCardWrap,
          {
            width: cardWidth,
            backgroundColor: colors.card,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}>
        <View style={styles.modelGradient}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.modelPreviewShell, { height: verticalScale(74), position: 'relative' }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.weekBadge, { backgroundColor: 'rgba(255,255,255,0.85)', borderColor: withAlpha(accentColor, 0.3) }]}>
                <Text style={[styles.weekBadgeText, { color: accentColor }]}>WK {item.weekNumber}</Text>
              </View>
            </View>

            <ModelPreviewImage
              thumbnailUri={thumbnailUri}
              fallbackIcon="🎨"
              style={styles.modelPreviewImage}
              resizeMode="cover"
            />
          </View>

          <View style={styles.modelInfoRow}>
            <Text style={styles.modelName} numberOfLines={1}>
              {modelName}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <FlatList
        key={numColumns}
        data={finalItems}
        keyExtractor={item => item.uniqueId}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomInset + verticalScale(20) }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || teacherModelsQuery.isRefetching}
            onRefresh={handleInternalRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {headerContent}
            {tabBarContent}
            <View style={styles.headerInfo}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>AR Experiences</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Interact with 3D models related to this theme. Move around and explore closely.
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: withAlpha(accentColor, 0.1) }]}>
              <Box size={moderateScale(30)} color={accentColor} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No AR Models</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              There are no 3D AR models available for this subject yet.
            </Text>
          </View>
        }
        renderItem={renderItem}
        ListFooterComponent={<View style={{ height: bottomInset }} />}
      />

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        backgroundStyle={{
          backgroundColor: colors.card,
          borderTopLeftRadius: moderateScale(28),
          borderTopRightRadius: moderateScale(28),
        }}>
        <BottomSheetView style={styles.sheetContent}>
          {selectedItem && (
            <ARModelOptionsSheet
              modelName={selectedItem.modelId?.name || selectedItem.name || '3D Experience'}
              subjectName={selectedItem.subjectName}
              modelType={selectedItem.type}
              onView3D={() => handleOpenModel(selectedItem)}
              onViewSheet={() => handleOpenModel(selectedItem, { openPainter: true, initialPaintMode: 'target' })}
              onScan={() => handleScanModel(selectedItem)}
            />
          )}
        </BottomSheetView>
      </BottomSheetModal>

      <ARInstructionModal
        visible={instructionVisible}
        onClose={() => setInstructionVisible(false)}
        onStartScan={() => {
          setInstructionVisible(false);
          if (scanningModel) {
            startActualScan(scanningModel);
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingTop: 0,
  },
  columnWrapper: {
    paddingHorizontal: scale(20),
    justifyContent: 'flex-start',
    gap: scale(14),
  },
  listHeader: {
    marginBottom: verticalScale(6),
  },
  headerInfo: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(18),
  },
  sectionTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    marginBottom: verticalScale(4),
  },
  sectionSubtitle: {
    fontSize: moderateScale(11),
    lineHeight: moderateScale(16),
    marginBottom: verticalScale(16),
    opacity: 0.8,
  },
  modelCardWrap: {
    marginBottom: verticalScale(14),
    borderRadius: moderateScale(20),
    overflow: 'hidden',
    ...(isAndroid
      ? {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
      }
      : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(3) },
        shadowOpacity: 0.12,
        shadowRadius: moderateScale(8),
      }),
  },
  modelGradient: {
    padding: moderateScale(10),
    minHeight: verticalScale(100),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: verticalScale(4),
    zIndex: 2,
    position: 'absolute',
    top: scale(7),
    right: scale(7)
  },
  weekBadge: {
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(6),
    borderWidth: 1.5,
  },
  weekBadgeText: {
    fontSize: moderateScale(8),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modelPreviewShell: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: moderateScale(14),
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  modelPreviewImage: {
    width: '100%',
    height: '100%',
  },
  modelFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelInfoRow: {
    alignItems: 'center',
  },
  modelName: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: verticalScale(60),
    paddingHorizontal: scale(40),
  },
  emptyIconWrap: {
    width: scale(60),
    height: scale(60),
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(16),
  },
  emptyTitle: {
    fontSize: moderateScale(17),
    fontWeight: '800',
    marginBottom: verticalScale(6),
  },
  emptySubtitle: {
    fontSize: moderateScale(12),
    textAlign: 'center',
    lineHeight: moderateScale(18),
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(20),
  },
  sheetInner: {
    alignItems: 'center',
    paddingTop: verticalScale(8),
  },
  sheetTitle: {
    fontSize: moderateScale(24),
    fontWeight: '900',
    marginBottom: verticalScale(4),
    letterSpacing: 0.3,
  },
  sheetSub: {
    fontSize: moderateScale(13),
    fontWeight: '500',
    marginBottom: verticalScale(22),
    opacity: 0.65,
  },
  sheetActions: {
    width: '100%',
    gap: verticalScale(12),
  },
  sheetButtonWrap: {
    height: verticalScale(82),
    borderRadius: moderateScale(18),
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: scale(16),
  },
  sheetButtonIconContainer: {
    width: scale(80),
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: scale(8),
    marginRight: scale(4),
  },
  sheetButtonImage: {
    width: '100%',
    height: '100%',
  },
  sheetButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetButtonTexts: {
    flex: 1,
    paddingLeft: scale(2),
  },
  sheetButtonTitle: {
    fontSize: moderateScale(17),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(2),
    letterSpacing: 0.2,
  },
  sheetButtonSub: {
    fontSize: moderateScale(11.5),
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  sheetButtonArrow: {
    width: scale(28),
    height: scale(28),
    borderRadius: moderateScale(14),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const sheetLandscapeStyles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(6),
    paddingBottom: verticalScale(10),
  },
  header: {
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  title: {
    fontSize: moderateScale(18),
    fontWeight: '900',
    letterSpacing: 0.2,
    marginBottom: verticalScale(1),
  },
  sub: {
    fontSize: moderateScale(11),
    fontWeight: '500',
    opacity: 0.65,
  },
  row: {
    flexDirection: 'row',
    gap: scale(10),
    flex: 1,
  },
  btn: {
    flex: 1,
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(8),
  },
  btnTitle: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(2),
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  btnSub: {
    fontSize: moderateScale(10),
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    textAlign: 'center',
  },
  btnImage: {
    width: scale(60),
    height: verticalScale(60),
    marginBottom: verticalScale(1),
  },
});
