import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {CompositeNavigationProp, useNavigation} from '@react-navigation/native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import type {StackNavigationProp} from '@react-navigation/stack';
import {useQuery} from '@tanstack/react-query';
import LinearGradient from 'react-native-linear-gradient';
import {
  Box,
  ChevronLeft,
  Cuboid,
  Image as ImageIcon,
  RefreshCcw,
  TriangleAlert,
} from 'lucide-react-native';
import {ScreenErrorBoundary} from '@/components/ui';
import {useScreenReady} from '@/hooks/useScreenReady';
import {ARService} from '@/services';
import type {
  ARFolder,
  ARModel,
  BottomTabParamList,
  MainStackParamList,
} from '@/types';
import {
  getBrowsableEnvironments,
  getLevelStars,
  getModelLevel,
  getModelStableId,
  getModelsForEnvironment,
  type AREnvironmentView,
} from './ar.data';
import {ARScannerModule} from './ARScannerModule';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - scale(48)) / 2;

const LEGACY_GRADIENT_MAP: Record<string, [string, string]> = {
  'from-coral to-coral/70': ['#FF6B6B', '#FF8E8E'],
  'from-secondary to-secondary/70': ['#6C4CFF', '#8B72FF'],
  'from-orchid to-orchid/70': ['#DA70D6', '#E890E8'],
  'from-teal to-teal/70': ['#0EA5A4', '#3CBFBE'],
  'from-accent to-accent/70': ['#FF9F43', '#FFB56D'],
  'from-gray-300 to-gray-100': ['#9CA3AF', '#D1D5DB'],
};

type ARNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList, 'AR'>,
  StackNavigationProp<MainStackParamList>
>;

function getPreviewUri(model: ARModel) {
  if (model.previewUrl) {
    return model.previewUrl;
  }
  if (model.previewImage) {
    return ARService.getPreviewImageUrl(model.previewImage);
  }
  return null;
}

function getEnvironmentColors(environment: AREnvironmentView) {
  if (environment.gradient && LEGACY_GRADIENT_MAP[environment.gradient]) {
    return [...LEGACY_GRADIENT_MAP[environment.gradient]];
  }
  if (environment.colors?.length) {
    return [...environment.colors];
  }
  return ['#6C4CFF', '#8B72FF'];
}

function ARLoading() {
  return (
    <View style={styles.loadingRoot}>
      <ActivityIndicator size="large" color="#6C4CFF" />
      <Text style={styles.loadingTitle}>Loading 3D Worlds...</Text>
      <Text style={styles.loadingCopy}>Preparing your adventure</Text>
    </View>
  );
}

function ARError({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <View style={styles.errorRoot}>
      <View style={styles.errorIconWrap}>
        <TriangleAlert size={moderateScale(40)} color="#EF4444" strokeWidth={2.2} />
      </View>
      <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
      <Text style={styles.errorCopy}>
        We could not load the AR environments right now.
      </Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.85} style={styles.errorButton}>
        <RefreshCcw size={moderateScale(16)} color="#fff" strokeWidth={2.2} />
        <Text style={styles.errorButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

function EnvironmentGallery({
  environments,
  models,
  onEnvironmentSelect,
  refreshing,
  onRefresh,
  topInset,
}: {
  environments: AREnvironmentView[];
  models: ARModel[];
  onEnvironmentSelect: (environment: AREnvironmentView) => void;
  refreshing: boolean;
  onRefresh: () => void;
  topInset: number;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6C4CFF"
          colors={['#6C4CFF', '#DA70D6']}
          progressViewOffset={topInset + verticalScale(8)}
        />
      }>
      <View style={[styles.worldHeroShadow, {marginTop: topInset + verticalScale(8)}]}>
        <View style={styles.worldHero}>
          <LinearGradient
            colors={['#FF6B6B', '#FF8557', '#FF9F43', '#87A274', '#3DAA8E', '#0EA5A4']}
            locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.worldHeroIconWrap}>
            <Box size={moderateScale(22)} color="#fff" strokeWidth={2.1} />
          </View>
          <Text style={styles.worldHeroTitle}>AR Worlds</Text>
          <Text style={styles.worldHeroCopy}>
            Explore 3D models in augmented reality!{'\n'}Pick a world and start learning.
          </Text>
        </View>
      </View>

      <View style={styles.worldGrid}>
        {environments.map(environment => {
          const modelCount = getModelsForEnvironment(environment, models).length;
          return (
            <TouchableOpacity
              key={environment._id}
              activeOpacity={0.85}
              onPress={() => onEnvironmentSelect(environment)}
              style={styles.worldCardWrap}>
              <View style={styles.worldCard}>
                <LinearGradient
                  colors={getEnvironmentColors(environment)}
                  locations={getEnvironmentColors(environment).length === 2 ? [0, 1] : [0, 0.5, 1]}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.worldCountBadge}>
                  <Text style={styles.worldCountText}>📦 {modelCount}</Text>
                </View>

                <View style={styles.worldEmojiBubble}>
                  <Text style={styles.worldEmoji}>{environment.emoji || '📦'}</Text>
                </View>

                <Text style={styles.worldName} numberOfLines={2}>
                  {environment.name || environment.folderName}
                </Text>

                <Text style={styles.worldDescription} numberOfLines={2}>
                  {environment.description || `Explore ${modelCount} amazing 3D models`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function ModelGallery({
  environment,
  models,
  onBack,
  onOpenModel,
  onScanModel,
  refreshing,
  onRefresh,
  topInset,
}: {
  environment: AREnvironmentView;
  models: ARModel[];
  onBack: () => void;
  onOpenModel: (model: ARModel, opts?: {openPainter?: boolean; initialPaintMode?: string}) => void;
  onScanModel: (model: ARModel) => void;
  refreshing: boolean;
  onRefresh: () => void;
  topInset: number;
}) {
  const gradientColors = getEnvironmentColors(environment);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.modelScreenContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6C4CFF"
          colors={['#6C4CFF', '#DA70D6']}
          progressViewOffset={topInset + verticalScale(8)}
        />
      }>
      <View style={[styles.modelsHeroShadow, {marginTop: topInset + verticalScale(8)}]}>
        <View style={styles.modelsHero}>
          <LinearGradient
            colors={['#DA70D6', '#A35EEA', '#6C4CFF', '#5B6EEC', '#4A90D9']}
            locations={[0, 0.25, 0.5, 0.75, 1]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modelsHeroTopRow}>
            <View style={styles.modelsHeroLeft}>
              <TouchableOpacity onPress={onBack} activeOpacity={0.75} style={styles.backButton}>
                <ChevronLeft size={moderateScale(20)} color="#fff" strokeWidth={2.4} />
              </TouchableOpacity>
              <View style={styles.modelsHeroCopyWrap}>
                <View style={styles.modelsHeroHeadingRow}>
                  <Cuboid size={moderateScale(20)} color="#fff" strokeWidth={2} />
                  <Text style={styles.modelsHeroTitle}>3D Models</Text>
                </View>
                <Text style={styles.modelsHeroSubtitle} numberOfLines={1}>
                  {(environment.name || environment.folderName)} • {models.length} models
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onBack} activeOpacity={0.75} style={styles.worldsButton}>
              <Text style={styles.worldsButtonText}>Worlds</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {!models.length ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBubble}>
            <Box size={moderateScale(36)} color="#94A3B8" strokeWidth={2} />
          </View>
          <Text style={styles.emptyTitle}>No Models Available</Text>
          <Text style={styles.emptyCopy}>
            No 3D models found for {environment.name || environment.folderName}.
          </Text>
          <TouchableOpacity onPress={onBack} activeOpacity={0.8} style={styles.backToWorldsButton}>
            <ChevronLeft size={moderateScale(16)} color="#fff" strokeWidth={2.2} />
            <Text style={styles.backToWorldsText}>Back to Environments</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.modelsContent}>
          <Text style={styles.modelsCountText}>
            <Text style={styles.modelsCountStrong}>{models.length}</Text> models available
          </Text>

          <View style={styles.modelsGrid}>
            {models.map((model, index) => {
              const previewUri = getPreviewUri(model);
              const level = getModelLevel(model);
              const stars = getLevelStars(level);

              return (
                <View
                  key={getModelStableId(model, index)}
                  style={styles.modelCardWrap}>
                  <View style={styles.modelGradient}>
                    <LinearGradient
                      colors={gradientColors}
                      locations={gradientColors.length === 2 ? [0, 1] : [0, 0.5, 1]}
                      start={{x: 0, y: 0}}
                      end={{x: 1, y: 1}}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.modelPreviewShell}>
                      {previewUri ? (
                        <Image
                          source={{uri: previewUri}}
                          style={styles.modelPreviewImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={styles.modelFallbackEmoji}>{model.icon || environment.emoji || '🎨'}</Text>
                      )}
                    </View>

                    <View style={styles.modelInfoRow}>
                      <Text style={styles.modelName} numberOfLines={1}>
                        {model.name}
                      </Text>
                      <View style={styles.modelStarsBadge}>
                        <Text style={styles.modelStarsText}>{stars}</Text>
                      </View>
                    </View>

                    <View style={styles.modelActionsColumn}>
                      <View style={styles.modelActionsRow}>
                        <TouchableOpacity
                          onPress={() => onOpenModel(model)}
                          activeOpacity={0.85}
                          style={styles.primaryAction}>
                          <Cuboid size={moderateScale(14)} color="#121826" strokeWidth={2.1} />
                          <Text style={styles.primaryActionText}>3D</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() =>
                            onOpenModel(model, {
                              openPainter: true,
                              initialPaintMode: 'target',
                            })
                          }
                          activeOpacity={0.85}
                          style={styles.secondaryAction}>
                          <ImageIcon size={moderateScale(14)} color="#fff" strokeWidth={2.1} />
                          <Text style={styles.secondaryActionText}>Sheet</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        onPress={() => onScanModel(model)}
                        activeOpacity={0.85}
                        style={styles.scanAction}>
                        <Box size={moderateScale(14)} color="#fff" strokeWidth={2.1} />
                        <Text style={styles.scanActionText}>AR Scan</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function ARScreenContent() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ARNavigationProp>();
  const screenReady = useScreenReady();
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);

  const modelsQuery = useQuery({
    queryKey: ['ar-models'],
    queryFn: async () => {
      const response = await ARService.getAllModels();
      return response.modals || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const foldersQuery = useQuery({
    queryKey: ['ar-folders'],
    queryFn: async () => {
      const response = await ARService.getFolders();
      return response.data?.data?.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const models = useMemo(() => (modelsQuery.data || []) as ARModel[], [modelsQuery.data]);
  const environments = useMemo(
    () => getBrowsableEnvironments((foldersQuery.data || []) as ARFolder[], models),
    [foldersQuery.data, models],
  );
  const selectedEnvironment = useMemo(
    () => environments.find(environment => environment._id === selectedEnvironmentId) || null,
    [environments, selectedEnvironmentId],
  );
  const environmentModels = useMemo(
    () => getModelsForEnvironment(selectedEnvironment, models),
    [models, selectedEnvironment],
  );

  const loading = !screenReady || modelsQuery.isPending || foldersQuery.isPending;
  const refreshing = modelsQuery.isRefetching || foldersQuery.isRefetching;
  const hasError = modelsQuery.isError || foldersQuery.isError;

  useEffect(() => {
    if (
      !selectedEnvironmentId &&
      environments.length === 1 &&
      environments[0].matchMode === 'all'
    ) {
      setSelectedEnvironmentId(environments[0]._id);
    }
  }, [environments, selectedEnvironmentId]);

  const refreshAll = () => {
    modelsQuery.refetch();
    foldersQuery.refetch();
  };

  const handleOpenModel = (
    model: ARModel,
    opts?: {openPainter?: boolean; initialPaintMode?: string},
  ) => {
    navigation.navigate('ARViewer', {
      modelId: getModelStableId(model),
      environmentId: selectedEnvironment?._id,
      openPainter: opts?.openPainter,
      initialPaintMode: opts?.initialPaintMode === 'target' ? 'target' : 'model',
    });
  };

  const handleScanModel = async (model: ARModel) => {
    if (Platform.OS !== 'android') {
      Alert.alert('Not Supported', 'AR Scan is currently available on Android only.');
      return;
    }

    try {
      const supported = await ARScannerModule.isARSupported();
      if (!supported) {
        Alert.alert('Not Supported', 'ARCore is not available on this device.');
        return;
      }

      const modelName = (model.name || 'model').toLowerCase().replace(/\s+/g, '_');
      const referenceImageAsset = `reference_${modelName}_page.jpg`;
      const modelAsset = `${modelName}.glb`;

      const assetStatus = await ARScannerModule.checkScannerAssets(
        referenceImageAsset,
        modelAsset,
      );

      if (!assetStatus.referenceImageExists || !assetStatus.modelExists) {
        const missing = [
          !assetStatus.referenceImageExists ? referenceImageAsset : null,
          !assetStatus.modelExists ? modelAsset : null,
        ]
          .filter(Boolean)
          .join(', ');
        Alert.alert(
          'Missing AR Assets',
          `AR Scan assets not found for ${model.name || 'this model'}: ${missing}`,
        );
        return;
      }

      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Camera Permission', 'Camera permission is required for AR Scan.');
        return;
      }

      ARScannerModule.startScanner(referenceImageAsset, modelAsset);
    } catch (error) {
      Alert.alert('Error', 'Failed to launch AR Scanner.');
    }
  };

  if (loading) {
    return <ARLoading />;
  }

  if (hasError && !models.length) {
    return (
      <SafeAreaView style={styles.screen}>
        <ARError
          onRetry={() => {
            modelsQuery.refetch();
            foldersQuery.refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      {selectedEnvironment ? (
        <ModelGallery
          environment={selectedEnvironment}
          models={environmentModels}
          onBack={() => setSelectedEnvironmentId(null)}
          onOpenModel={handleOpenModel}
          onScanModel={handleScanModel}
          refreshing={refreshing}
          onRefresh={refreshAll}
          topInset={insets.top}
        />
      ) : (
        <EnvironmentGallery
          environments={environments}
          models={models}
          onEnvironmentSelect={environment => setSelectedEnvironmentId(environment._id)}
          refreshing={refreshing}
          onRefresh={refreshAll}
          topInset={insets.top}
        />
      )}
    </SafeAreaView>
  );
}

export default function ARScreen() {
  return (
    <ScreenErrorBoundary>
      <ARScreenContent />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FF',
  },
  screenContent: {
    paddingBottom: verticalScale(24),
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7FF',
    paddingHorizontal: scale(24),
  },
  loadingTitle: {
    marginTop: verticalScale(16),
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#121826',
  },
  loadingCopy: {
    marginTop: verticalScale(6),
    fontSize: moderateScale(14),
    color: '#6B7280',
  },
  errorRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(24),
  },
  errorIconWrap: {
    width: scale(80),
    height: scale(80),
    borderRadius: moderateScale(40),
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(16),
  },
  errorTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#121826',
    marginBottom: verticalScale(8),
  },
  errorCopy: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    textAlign: 'center',
  },
  errorButton: {
    marginTop: verticalScale(24),
    backgroundColor: '#6C4CFF',
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  errorButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: '#fff',
  },
  worldHeroShadow: {
    marginHorizontal: scale(16),
    borderRadius: moderateScale(20),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: verticalScale(4)},
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(12),
    elevation: 8,
  },
  worldHero: {
    borderRadius: moderateScale(20),
    padding: moderateScale(24),
    overflow: 'hidden',
  },
  worldHeroIconWrap: {
    width: scale(44),
    height: scale(44),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(12),
  },
  worldHeroTitle: {
    fontSize: moderateScale(26),
    fontWeight: '800',
    color: '#fff',
  },
  worldHeroCopy: {
    marginTop: verticalScale(8),
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    color: 'rgba(255,255,255,0.9)',
  },
  worldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: scale(16),
    marginTop: verticalScale(20),
    gap: scale(12),
  },
  worldCardWrap: {
    width: CARD_WIDTH,
    height: verticalScale(215),
    borderRadius: moderateScale(20),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: verticalScale(3)},
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(8),
    elevation: 5,
  },
  worldCard: {
    flex: 1,
    padding: moderateScale(16),
  },
  worldCountBadge: {
    position: 'absolute',
    top: verticalScale(10),
    right: scale(10),
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: moderateScale(20),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  worldCountText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#fff',
  },
  worldEmojiBubble: {
    width: scale(64),
    height: scale(64),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: verticalScale(20),
    marginBottom: verticalScale(16),
  },
  worldEmoji: {
    fontSize: moderateScale(30),
  },
  worldName: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: verticalScale(4),
  },
  worldDescription: {
    fontSize: moderateScale(11),
    lineHeight: moderateScale(15),
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  modelScreenContent: {
    paddingBottom: verticalScale(24),
  },
  modelsHeroShadow: {
    marginHorizontal: scale(16),
    borderRadius: moderateScale(20),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: verticalScale(4)},
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(12),
    elevation: 8,
  },
  modelsHero: {
    borderRadius: moderateScale(20),
    padding: moderateScale(20),
    overflow: 'hidden',
  },
  modelsHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelsHeroLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  modelsHeroCopyWrap: {
    flex: 1,
  },
  modelsHeroHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  modelsHeroTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: '#fff',
  },
  modelsHeroSubtitle: {
    marginTop: verticalScale(4),
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.85)',
  },
  worldsButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  worldsButtonText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#fff',
  },
  modelsContent: {
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(16),
  },
  modelsCountText: {
    fontSize: moderateScale(13),
    color: '#6B7280',
    marginBottom: verticalScale(12),
  },
  modelsCountStrong: {
    fontWeight: '700',
    color: '#121826',
  },
  modelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  modelCardWrap: {
    width: CARD_WIDTH,
    borderRadius: moderateScale(20),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: verticalScale(3)},
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(8),
    elevation: 5,
    backgroundColor: '#fff',
  },
  modelGradient: {
    padding: moderateScale(12),
  },
  modelPreviewShell: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    height: verticalScale(100),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  modelPreviewImage: {
    width: '100%',
    height: '100%',
  },
  modelFallbackEmoji: {
    fontSize: moderateScale(40),
  },
  modelInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(8),
  },
  modelName: {
    flex: 1,
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#fff',
  },
  modelStarsBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  modelStarsText: {
    fontSize: moderateScale(10),
    color: '#fff',
  },
  modelActionsRow: {
    flexDirection: 'row',
    gap: scale(6),
  },
  modelActionsColumn: {
    gap: verticalScale(8),
  },
  primaryAction: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(9),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(4),
  },
  primaryActionText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#121826',
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(9),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  secondaryActionText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#fff',
  },
  scanAction: {
    backgroundColor: 'rgba(18,24,38,0.22)',
    borderRadius: moderateScale(12),
    minHeight: verticalScale(38),
    paddingHorizontal: scale(10),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(6),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  scanActionText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(60),
  },
  emptyIconBubble: {
    width: scale(80),
    height: scale(80),
    borderRadius: moderateScale(40),
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(16),
  },
  emptyTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#121826',
    marginBottom: verticalScale(8),
  },
  emptyCopy: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: verticalScale(20),
  },
  backToWorldsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(14),
    backgroundColor: '#6C4CFF',
  },
  backToWorldsText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#fff',
  },
});
