import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Mic, Image as ImageIcon, Video, Paperclip, X } from 'lucide-react-native';
import { ChatMessage } from '@/types';

interface ReplyPreviewProps {
  replyTo: NonNullable<ChatMessage['replyTo']>;
  /** If true, shows inside a message bubble (outgoing/incoming context) */
  insideBubble?: boolean;
  isOwn?: boolean;
  /** If provided, shows a dismiss button */
  onDismiss?: () => void;
}

function ReplyContent({ replyTo, isOwn }: { replyTo: NonNullable<ChatMessage['replyTo']>; isOwn?: boolean }) {
  const textColor = isOwn ? 'rgba(255,255,255,0.8)' : '#374151';
  const mutedColor = isOwn ? 'rgba(255,255,255,0.6)' : '#6B7280';

  switch (replyTo.type) {
    case 'image':
      return (
        <View style={styles.contentRow}>
          <ImageIcon size={14} color={mutedColor} />
          <Text style={[styles.contentText, { color: mutedColor }]}>Photo</Text>
        </View>
      );
    case 'voice':
      return (
        <View style={styles.contentRow}>
          <Mic size={14} color={mutedColor} />
          <Text style={[styles.contentText, { color: mutedColor }]}>Voice message</Text>
        </View>
      );
    case 'video':
      return (
        <View style={styles.contentRow}>
          <Video size={14} color={mutedColor} />
          <Text style={[styles.contentText, { color: mutedColor }]}>Video</Text>
        </View>
      );
    case 'file':
      return (
        <View style={styles.contentRow}>
          <Paperclip size={14} color={mutedColor} />
          <Text style={[styles.contentText, { color: mutedColor }]} numberOfLines={1}>
            {replyTo.text || 'File'}
          </Text>
        </View>
      );
    default:
      return (
        <Text style={[styles.contentText, { color: textColor }]} numberOfLines={2}>
          {replyTo.text || ''}
        </Text>
      );
  }
}

export default function ReplyPreview({ replyTo, insideBubble, isOwn, onDismiss }: ReplyPreviewProps) {
  const borderColor = isOwn ? 'rgba(255,255,255,0.5)' : '#2563EB';
  const bgColor = isOwn ? 'rgba(255,255,255,0.15)' : '#EFF6FF';
  const nameColor = isOwn ? 'rgba(255,255,255,0.9)' : '#2563EB';

  return (
    <View style={[styles.container, { borderLeftColor: borderColor, backgroundColor: bgColor }]}>
      <View style={styles.inner}>
        <Text style={[styles.senderName, { color: nameColor }]} numberOfLines={1}>
          {replyTo.senderName || 'Unknown'}
        </Text>
        <ReplyContent replyTo={replyTo} isOwn={isOwn} />
      </View>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <X size={16} color="#6B7280" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  inner: {
    flex: 1,
    gap: 2,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  contentText: {
    fontSize: 12,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
