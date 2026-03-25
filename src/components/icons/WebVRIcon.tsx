import React from 'react';
import Svg, { Path, type SvgProps } from 'react-native-svg';

interface WebVRIconProps extends SvgProps {
  color?: string;
}

export const WebVRIcon: React.FC<WebVRIconProps> = ({
  color = '#FFFFFF',
  strokeWidth = 0,
  ...props
}) => {
  // SVG paths here are pre-filled solid shapes, not stroke outlines.
  // To simulate "strokeWidth" increasing the thickness, we add an actual stroke
  // around the filled elements. Because the viewBox is 445x344 (much larger than standard 24x24),
  // we multiply the strokeWidth by a factor of 8 to scale the thickness proportionally.
  const appliedStrokeWidth = Number(strokeWidth) > 0 ? Number(strokeWidth) * 8 : 0;

  return (
    <Svg viewBox="0 0 445.95 344.62" {...props}>
      <Path fill={color} stroke={Number(strokeWidth) > 0 ? color : 'none'} strokeWidth={appliedStrokeWidth} strokeLinejoin="round" strokeLinecap="round" d="M112.39,163.34c-.37,0-.74-.04-1.11-.12C41.6,147.69,0,119.33,0,87.35c0-24.24,23.83-46.59,67.11-62.93C108.82,8.67,164.18,0,222.98,0s114.15,8.67,155.87,24.42c43.28,16.34,67.11,38.69,67.11,62.93,0,15.8-10.3,31.11-29.78,44.28-17.96,12.14-43.7,22.49-74.44,29.94-2.34.57-4.72,1.12-7.06,1.64-2.74.61-5.47-1.12-6.08-3.86-.61-2.74,1.12-5.47,3.86-6.08,2.28-.51,4.6-1.05,6.88-1.6,59.48-14.42,96.43-39.07,96.43-64.32,0-19.42-22.06-38.88-60.52-53.4-40.59-15.33-94.67-23.76-152.27-23.76s-111.68,8.44-152.27,23.76c-38.46,14.52-60.52,33.99-60.52,53.4,0,16.12,14.81,29.09,27.24,37.13,18.27,11.82,44.57,21.78,76.07,28.8,2.74.61,4.47,3.33,3.86,6.08-.53,2.37-2.63,3.99-4.96,3.99Z"/>
      <Path fill={color} stroke={Number(strokeWidth) > 0 ? color : 'none'} strokeWidth={appliedStrokeWidth} strokeLinejoin="round" strokeLinecap="round" d="M112.39,344.62c-.37,0-.74-.04-1.11-.12C41.6,328.97,0,300.61,0,268.63c0-2.81,2.28-5.09,5.09-5.09s5.09,2.28,5.09,5.09c0,16.12,14.81,29.09,27.24,37.13,18.27,11.82,44.57,21.78,76.07,28.8,2.74.61,4.47,3.33,3.86,6.08-.53,2.37-2.63,3.98-4.97,3.98Z"/>
      <Path fill={color} stroke={Number(strokeWidth) > 0 ? color : 'none'} strokeWidth={appliedStrokeWidth} strokeLinejoin="round" strokeLinecap="round" d="M112.38,202.83c-2.33,0-4.44-1.61-4.97-3.99-.61-2.74,1.12-5.47,3.86-6.08,33.73-7.52,72.36-11.49,111.7-11.49s77.96,3.97,111.7,11.49c2.74.61,4.47,3.33,3.86,6.08-.61,2.74-3.33,4.47-6.08,3.86-33.02-7.36-70.88-11.25-109.48-11.25s-76.47,3.89-109.48,11.25c-.37.08-.75.12-1.11.12Z"/>
      <Path fill={color} stroke={Number(strokeWidth) > 0 ? color : 'none'} strokeWidth={appliedStrokeWidth} strokeLinejoin="round" strokeLinecap="round" d="M333.56,344.62c-2.33,0-4.44-1.61-4.96-3.98-.61-2.74,1.12-5.47,3.86-6.08,31.5-7.02,57.8-16.98,76.07-28.8,12.43-8.04,27.24-21.01,27.24-37.13,0-2.81,2.28-5.09,5.09-5.09s5.09,2.28,5.09,5.09c0,31.97-41.6,60.33-111.28,75.86-.37.08-.75.12-1.11.12Z"/>
      <Path fill={color} stroke={Number(strokeWidth) > 0 ? color : 'none'} strokeWidth={appliedStrokeWidth} strokeLinejoin="round" strokeLinecap="round" d="M90.62,157.79c-1.21,0-2.42-.43-3.39-1.29-2.1-1.87-2.28-5.09-.41-7.19l55.77-62.57c1.82-2.04,4.93-2.28,7.04-.54l61.1,50.37c2.17,1.79,2.48,5,.69,7.17-1.79,2.17-5,2.48-7.17.69l-57.32-47.25-52.51,58.91c-1.01,1.13-2.4,1.7-3.8,1.7Z"/>
      <Path fill={color} stroke={Number(strokeWidth) > 0 ? color : 'none'} strokeWidth={appliedStrokeWidth} strokeLinejoin="round" strokeLinecap="round" d="M360.11,156.37c-1.5,0-2.99-.66-4-1.93l-79.03-99.88-65.49,88.96c-1.67,2.26-4.85,2.75-7.12,1.08-2.26-1.67-2.75-4.85-1.08-7.12l69.44-94.33c.94-1.28,2.43-2.04,4.01-2.07,1.59-.03,3.1.69,4.08,1.93l83.17,105.11c1.74,2.21,1.37,5.41-.83,7.15-.93.74-2.05,1.1-3.16,1.1Z"/>
      <Path fill={color} stroke={Number(strokeWidth) > 0 ? color : 'none'} strokeWidth={appliedStrokeWidth} strokeLinejoin="round" strokeLinecap="round" d="M182.33,27.67c-13.37,0-24.24,10.88-24.24,24.24s10.88,24.24,24.24,24.24,24.24-10.88,24.24-24.24-10.88-24.24-24.24-24.24ZM182.33,65.97c-7.75,0-14.06-6.3-14.06-14.06s6.31-14.06,14.06-14.06,14.06,6.31,14.06,14.06-6.31,14.06-14.06,14.06Z"/>
      <Path fill={color} stroke={Number(strokeWidth) > 0 ? color : 'none'} strokeWidth={appliedStrokeWidth} strokeLinejoin="round" strokeLinecap="round" d="M5.09,273.72c-2.81,0-5.09-2.28-5.09-5.09V87.35c0-2.81,2.28-5.09,5.09-5.09s5.09,2.28,5.09,5.09v181.28c0,2.81-2.28,5.09-5.09,5.09Z"/>
      <Path fill={color} stroke={Number(strokeWidth) > 0 ? color : 'none'} strokeWidth={appliedStrokeWidth} strokeLinejoin="round" strokeLinecap="round" d="M440.86,273.72c-2.81,0-5.09-2.28-5.09-5.09V87.35c0-2.81,2.28-5.09,5.09-5.09s5.09,2.28,5.09,5.09v181.28c0,2.81-2.28,5.09-5.09,5.09Z"/>
      <Path fill={color} stroke={Number(strokeWidth) > 0 ? color : 'none'} strokeWidth={appliedStrokeWidth} strokeLinejoin="round" strokeLinecap="round" d="M112.39,344.62c-2.81,0-5.09-2.28-5.09-5.09v-181.28c0-2.81,2.28-5.09,5.09-5.09s5.09,2.28,5.09,5.09v181.28c0,2.81-2.28,5.09-5.09,5.09Z"/>
      <Path fill={color} stroke={Number(strokeWidth) > 0 ? color : 'none'} strokeWidth={appliedStrokeWidth} strokeLinejoin="round" strokeLinecap="round" d="M333.57,344.62c-2.81,0-5.09-2.28-5.09-5.09v-181.28c0-2.81,2.28-5.09,5.09-5.09s5.09,2.28,5.09,5.09v181.28c0,2.81-2.28,5.09-5.09,5.09Z"/>
    </Svg>
  );
};

export default WebVRIcon;
