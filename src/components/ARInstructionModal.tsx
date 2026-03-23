
import React, {useState, useEffect, useMemo} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import {
  AlertTriangle,
  BookOpen,
  Box,
  Camera,
  ChevronLeft,
  ChevronRight,
  Hand,
  Languages,
  Menu,
  Palette,
  Pencil,
  RotateCcw,
  ScanLine,
  Shield,
  Sparkles,
  User,
  X,
} from 'lucide-react-native';
import {useTheme} from '@/theme';
import {moderateScale, verticalScale, scale} from 'react-native-size-matters';

interface ARInstructionModalProps {
  visible: boolean;
  onClose: () => void;
  onStartScan: () => void;
}

const STEPS = [
  {
    id: 'caution',
    title: 'Safety Warning',
    type: 'warning',
  },
  {
    id: 'slide1',
    title: 'Getting Started',
    instructions: [
      '1. Open the "Augmented Reality (AR)" book and choose the object or animal that you would want to bring to life.',
      '2. Colour the image using colour pencils or crayons.',
      '3. Point the camera of your mobile/tablet on pages containing the AR icon in the book.',
      '4. Wait for the 3D object/animal to appear on the screen.',
      '5. Use the menu option to Reset, Pause & take a Snapshot.',
    ],
    icon: BookOpen,
  },
  {
    id: 'slide2',
    title: 'Control & Interact',
    instructions: [
      '6. Use your fingers to rotate and adjust the size of the 3D model.',
    ],
    icon: Hand,
  },
  {
    id: 'slide3',
    title: 'Audio & Reset',
    instructions: [
      '7. Click the language icon to listen to the audio in English and in Indian regional languages.',
      '8. Click "RESET" to bring the image back to its original size.',
    ],
    icon: Languages,
  },
  {
    id: 'slide4',
    title: 'Live Colouring',
    instructions: [
      '9. The live colouring option lets you colour the model when it is visible on the screen.',
    ],
    icon: Pencil,
  },
  {
    id: 'slide5',
    title: 'Capture Memories',
    instructions: [
      '10. Click "SNAPSHOT" to take a picture of your art work. Open the gallery to view the saved image.',
    ],
    icon: Camera,
  },
];

export default function ARInstructionModal({
  visible,
  onClose,
  onStartScan,
}: ARInstructionModalProps) {
  const {colors} = useTheme();
  const {width: SCREEN_WIDTH} = useWindowDimensions();
  const [currentStep, setCurrentStep] = useState(0);

  const modalScale = useSharedValue(0.85);
  const opacity = useSharedValue(0);
  const slideAnim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {duration: 350, easing: Easing.out(Easing.cubic)});
      modalScale.value = withSpring(1, {damping: 18, stiffness: 300});
      setCurrentStep(0);
      slideAnim.value = 0;
    } else {
      opacity.value = withTiming(0, {duration: 250});
      modalScale.value = withTiming(0.9, {duration: 200});
    }
  }, [visible]);

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      slideAnim.value = withTiming(currentStep + 1, {duration: 400, easing: Easing.bezier(0.33, 1, 0.68, 1)});
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      slideAnim.value = withTiming(currentStep - 1, {duration: 400, easing: Easing.bezier(0.33, 1, 0.68, 1)});
      setCurrentStep(prev => prev - 1);
    }
  };

  const backdropStyle = useAnimatedStyle(() => ({opacity: opacity.value}));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{scale: modalScale.value}],
  }));

  const renderWarningContent = () => (
    <View style={styles.stepContent}>
      {/* Header Row */}
      <View style={styles.warningHeader}>
        <View style={[styles.cautionBox, {backgroundColor: '#FFA500'}]}>
          <AlertTriangle size={moderateScale(24)} color="#FFFFFF" strokeWidth={2.5} />
        </View>
        <View style={styles.cautionTextBox}>
          <Text style={styles.cautionText}>CAUTION</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Middle Section with Shield and Adult/Child */}
        <View style={styles.shieldSection}>
          <View style={[styles.shieldContainer, {backgroundColor: '#FFA500'}]}>
            <View style={styles.iconWrapper}>
              <User size={moderateScale(44)} color="#FFFFFF" strokeWidth={2} style={styles.adultIcon} />
              <User size={moderateScale(27)} color="#FFFFFF" strokeWidth={2} style={styles.childIcon} />
            </View>
            <Shield size={moderateScale(64)} color="#FFFFFF" strokeWidth={1} style={styles.shieldIcon} />
          </View>
          
          <View style={styles.mainTextBox}>
            <Text style={[styles.mainText, {color: colors.textSecondary}]}>
              Always ask a grown-up before using this app. Watch out for other people when using this app and be aware of your surroundings.
            </Text>
          </View>
        </View>

        {/* Bottom Section: Parents' Note */}
        <View style={styles.parentsNoteSection}>
          <Text style={styles.parentsTitle}>Parents and guardians please note:</Text>
          <Text style={[styles.noteText, {color: colors.textSecondary}]}>
            It is recommended that younger children have adult supervision while using Augmented Reality. While using Augmented Reality there is a tendency for users to step backwards to view Augmented 3D animals & other 3D Models.
          </Text>
        </View>
      </ScrollView>
    </View>
  );

  const renderInstructionStep = (step: any, index: number) => {
    const Icon = step.icon || Box;
    return (
      <View key={step.id} style={styles.stepContainer}>
        <View style={[styles.iconCircle, {backgroundColor: colors.primary + '15'}]}>
          <Icon size={moderateScale(70)} color={colors.primary} strokeWidth={1.5} />
        </View>
        <View style={styles.textContainer}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Slide {index}</Text>
          </View>
          <Text style={[styles.stepTitle, {color: colors.text}]}>{step.title}</Text>
          <View style={styles.instructionsContainer}>
            <ScrollView 
              showsVerticalScrollIndicator={true} 
              style={styles.instructionsList}
              contentContainerStyle={styles.instructionsScrollContent}
            >
              {step.instructions?.map((instruction: string, i: number) => (
                <Text 
                  key={i} 
                  style={[
                    styles.stepDescription, 
                    {
                      color: colors.textSecondary,
                      textAlign: step.instructions.length > 1 ? 'left' : 'center'
                    }
                  ]}
                >
                  {instruction}
                </Text>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  };

  const isLastStep = currentStep === STEPS.length - 1;

  const stepOffset = SCREEN_WIDTH - scale(40);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.backdropPress} onPress={onClose} />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, {backgroundColor: colors.surface}, cardStyle]}>
          
          <View style={styles.contentWrapper}>
            {STEPS.map((step, index) => {
              const stepStyle = useAnimatedStyle(() => {
                const translateX = interpolate(
                  slideAnim.value,
                  [index - 1, index, index + 1],
                  [stepOffset, 0, -stepOffset],
                  Extrapolate.CLAMP
                );
                const opacityVal = interpolate(
                  slideAnim.value,
                  [index - 0.5, index, index + 0.5],
                  [0, 1, 0],
                  Extrapolate.CLAMP
                );
                const scaleVal = interpolate(
                  slideAnim.value,
                  [index - 0.5, index, index + 0.5],
                  [0.9, 1, 0.9],
                  Extrapolate.CLAMP
                );
                return {
                  transform: [{translateX}, {scale: scaleVal}],
                  opacity: opacityVal,
                  position: index === currentStep ? 'relative' : 'absolute',
                  width: '100%',
                };
              });

              return (
                <Animated.View key={step.id} style={stepStyle}>
                  {step.id === 'caution' ? renderWarningContent() : renderInstructionStep(step, index)}
                </Animated.View>
              );
            })}
          </View>

          {/* Pagination Indicators */}
          <View style={styles.pagination}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {backgroundColor: i === currentStep ? colors.primary : colors.border},
                  i === currentStep && {width: scale(16)},
                ]}
              />
            ))}
          </View>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <View style={styles.buttonRow}>
              {currentStep > 0 && (
                <TouchableOpacity
                  style={[styles.prevBtn, {backgroundColor: colors.border}]}
                  onPress={prevStep}
                  activeOpacity={0.8}
                >
                  <ChevronLeft size={moderateScale(18)} color={colors.text} />

                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.skipBtn, {backgroundColor: isLastStep ? colors.primary : colors.primary + '15'}]}
                onPress={onStartScan}
                activeOpacity={0.8}
              >
                <Text style={[styles.btnText, {color: isLastStep ? '#FFF' : colors.primary}]}>
                  {isLastStep ? 'Start AR' : 'Skip'}
                </Text>
              </TouchableOpacity>

              {!isLastStep && (
                <TouchableOpacity
                  style={[styles.nextBtn, {backgroundColor: colors.primary}]}
                  onPress={nextStep}
                  activeOpacity={0.8}
                >
                  <ChevronRight size={moderateScale(18)} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={moderateScale(20)} color={colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropPress: {flex: 1},
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(20),
  },
  card: {
    width: '100%',
    maxWidth: scale(450),
    maxHeight: '85%',
    minHeight: verticalScale(520),
    borderRadius: moderateScale(20),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
    backgroundColor: '#fff',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContent: {
    width: '100%',
    maxHeight:'100%',
  },
  warningContainer: {
    flex: 1,
    width: '100%',
  },
  warningHeader: {
    flexDirection: 'row',
    height: verticalScale(55),
    backgroundColor: '#EEEEEE',
    borderTopStartRadius: moderateScale(20),
    borderTopEndRadius: moderateScale(20),
    overflow: 'hidden',
  },
  cautionBox: {
    flex: 0.25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cautionTextBox: {
    flex: 0.75,
    justifyContent: 'center',
    paddingLeft: moderateScale(15),
  },
  cautionText: {
    fontSize: moderateScale(20),
    fontWeight: '900',
    color: '#333',
    letterSpacing: 1,
  },
  scrollContent: {
    padding: moderateScale(20),
    height:'100%',
  },
  shieldSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  shieldContainer: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(7),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: moderateScale(15),
  },
  shieldIcon: {
    opacity: 0.3,
    position: 'absolute',
  },
  iconWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    paddingBottom: moderateScale(10),
  },
  adultIcon: {
    marginBottom: moderateScale(5),
  },
  childIcon: {
    marginLeft: moderateScale(-5),
    marginBottom: moderateScale(3),
  },
  mainTextBox: {
    flex: 1,
  },
  mainText: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    fontWeight: '600',
  },
  parentsNoteSection: {
    marginTop: verticalScale(5),
  },
  parentsTitle: {
    fontSize: moderateScale(15),
    fontWeight: 'bold',
    color: '#FF4D6D',
    marginBottom: verticalScale(8),
  },
  noteText: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(19),
    fontWeight: '500',
  },
  stepContainer: {
    padding: moderateScale(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(24),
  },
  textContainer: {
    alignItems: 'center',
  },
  stepBadge: {
    backgroundColor: '#6C4CFF20',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(12),
  },
  stepBadgeText: {
    color: '#6C4CFF',
    fontWeight: '700',
    fontSize: moderateScale(12),
  },
  stepTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: verticalScale(16),
  },
  instructionsContainer: {
    maxHeight: verticalScale(200),
    width: '100%',
    paddingHorizontal: scale(5),
  },
  instructionsList: {
    width: '100%',
  },
  instructionsScrollContent: {
    paddingBottom: verticalScale(10),
  },
  stepDescription: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    textAlign: 'left',
    marginBottom: verticalScale(8),
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(20),
    gap: scale(6),
  },
  dot: {
    height: scale(6),
    width: scale(6),
    borderRadius: scale(3),
  },
  footer: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: verticalScale(10),
  },
  buttonRow: {
    flexDirection: 'row',
    gap: scale(10),
    alignItems: 'center',
  },
  prevBtn: {
    flex: 0.8,
    height: verticalScale(48),
    borderRadius: moderateScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
  },
  skipBtn: {
    flex: 1,
    height: verticalScale(48),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    flex: 0.8,
    height: verticalScale(48),
    borderRadius: moderateScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
  },
  btnText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    top: moderateScale(15),
    right: moderateScale(15),
    padding: moderateScale(5),
    zIndex: 10,
  },
});
