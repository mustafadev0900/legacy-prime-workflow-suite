import React, { useState } from 'react';
import {
  ScrollView,
  StyleProp,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

type Props = {
  text: string;
  maxLines?: number;
  maxExpandedHeight?: number;
  textStyle?: StyleProp<TextStyle>;
  toggleStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  readMoreLabel?: string;
  readLessLabel?: string;
};

export function ExpandableNotes({
  text,
  maxLines = 3,
  maxExpandedHeight = 180,
  textStyle,
  toggleStyle,
  containerStyle,
  readMoreLabel = 'Read more',
  readLessLabel = 'Show less',
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  if (!text) return null;

  return (
    <View style={containerStyle}>
      {/* Hidden measurement pass — detects whether the full text exceeds maxLines. */}
      {!isTruncated && (
        <Text
          onTextLayout={(e) => {
            if (e.nativeEvent.lines.length > maxLines) setIsTruncated(true);
          }}
          style={[textStyle, { position: 'absolute', opacity: 0, left: 0, right: 0 }]}
          pointerEvents="none"
        >
          {text}
        </Text>
      )}

      {expanded ? (
        <ScrollView
          style={{ maxHeight: maxExpandedHeight }}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          <Text style={textStyle}>{text}</Text>
        </ScrollView>
      ) : (
        <Text style={textStyle} numberOfLines={maxLines}>
          {text}
        </Text>
      )}

      {isTruncated && (
        <TouchableOpacity
          onPress={() => setExpanded((e) => !e)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={{ marginTop: 4, alignSelf: 'flex-start' }}
        >
          <Text style={toggleStyle}>{expanded ? readLessLabel : readMoreLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
