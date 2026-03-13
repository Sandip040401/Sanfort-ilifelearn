import React from 'react';
import {
  CardStyleInterpolators,
  TransitionSpecs,
  createStackNavigator,
  type StackNavigationOptions,
} from '@react-navigation/stack';
import {useTheme} from '@/theme';
import type {BooksStackParamList} from '@/types';
import BooksScreen from '@/screens/books/BooksScreen';
import SubjectsScreen from '@/screens/books/SubjectsScreen';
import SubjectContentScreen from '@/screens/books/SubjectContentScreen';
import TopicScreen from '@/screens/books/TopicScreen';

const Stack = createStackNavigator<BooksStackParamList>();

export default function BooksStack() {
  const {colors} = useTheme();

  const screenOptions: StackNavigationOptions = {
    headerShown: false,
    gestureEnabled: false,
    cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
    transitionSpec: {
      open: TransitionSpecs.TransitionIOSSpec,
      close: TransitionSpecs.TransitionIOSSpec,
    },
    cardOverlayEnabled: true,
    detachPreviousScreen: false,
    cardStyle: {backgroundColor: colors.background},
  };

  return (
    <Stack.Navigator initialRouteName="GradeSelector" screenOptions={screenOptions}>
      <Stack.Screen name="GradeSelector" component={BooksScreen} />
      <Stack.Screen name="Subjects" component={SubjectsScreen} />
      <Stack.Screen name="SubjectContent" component={SubjectContentScreen} />
      <Stack.Screen name="TopicDetail" component={TopicScreen} />
    </Stack.Navigator>
  );
}
