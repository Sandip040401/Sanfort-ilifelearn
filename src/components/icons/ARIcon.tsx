import React from 'react';
import Svg, {Path, Polyline, Line, Polygon, G, type SvgProps} from 'react-native-svg';

interface ARIconProps extends SvgProps {
  color?: string;
  strokeWidth?: number;
}

export const ARIcon: React.FC<ARIconProps> = ({
  color = '#010101',
  strokeWidth = 2.2,
  ...props
}) => {
  return (
    <Svg viewBox="0 0 100 100" {...props}>
      <Path
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        d="M74.21,68.44v15.35c0,4.25-3.45,7.7-7.7,7.7h-33.49c-4.25,0-7.7-3.45-7.7-7.7v-15.35"
      />
      <Path
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        d="M25.33,55.44V16.36c0-4.25,3.45-7.7,7.7-7.7h33.49c4.25,0,7.7,3.45,7.7,7.7v39.08"
      />
      <Path
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        d="M61.34,10.05v.52c0,1.7-1.38,3.08-3.08,3.08h-17.13c-1.7,0-3.08-1.38-3.08-3.08v-.52"
      />
      <Polygon
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        points="49.77 36.04 36.62 42.61 49.77 49.19 62.92 42.61 49.77 36.04"
      />
      <Polyline
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        points="36.62 42.61 36.62 57.53 49.77 64.11 62.92 57.53 62.92 42.61"
      />
      <Line
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        x1="49.77"
        y1="49.19"
        x2="49.77"
        y2="64.11"
      />
      <G>
        <Line
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          x1="68.16"
          y1="35.26"
          x2="68.05"
          y2="35.21"
        />
        <Line
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          strokeDasharray=".23 6.61"
          x1="62.13"
          y1="32.28"
          x2="52.84"
          y2="27.68"
        />
        <Polyline
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          points="49.88 26.22 49.77 26.16 49.66 26.22"
        />
        <Line
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          strokeDasharray=".23 6.58"
          x1="43.76"
          y1="29.14"
          x2="34.51"
          y2="33.72"
        />
        <Line
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          x1="31.56"
          y1="35.18"
          x2="31.45"
          y2="35.23"
        />
      </G>
      <Polyline
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        points="19.64 41.08 1.46 50.07 49.77 73.98 98.08 50.07 79.9 41.08"
      />
      <G>
        <Polyline
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          points="42.87 86.64 45.86 78.17 48.86 86.64"
        />
        <Line
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          x1="43.68"
          y1="84.34"
          x2="48.04"
          y2="84.34"
        />
        <Line
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          x1="53.52"
          y1="82.32"
          x2="56.45"
          y2="86.64"
        />
        <Path
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          d="M51.8,82.32h2.19c1.14,0,2.07-.93,2.07-2.07h0c0-1.14-.93-2.07-2.07-2.07h-2.19v8.46"
        />
      </G>
    </Svg>
  );
};

export default ARIcon;
