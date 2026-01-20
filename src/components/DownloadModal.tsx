import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { darkTheme } from '../utils/theme';

interface DownloadModalProps {
  visible: boolean;
  downloading: boolean;
  downloadProgress: number;
  bytesWritten: number;
  totalBytes: number;
  downloadError: string | null;
  onRetry: () => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

export const DownloadModal: React.FC<DownloadModalProps> = ({
  visible,
  downloading,
  downloadProgress,
  bytesWritten,
  totalBytes,
  downloadError,
  onRetry,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {downloading ? (
            <>
              <Text style={styles.modalTitle}>Downloading Model</Text>
              <Text style={styles.modalSubtitle}>
                Please wait until the AI model is downloaded...
              </Text>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${downloadProgress}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {downloadProgress.toFixed(1)}%
                </Text>
                <Text style={styles.downloadSize}>
                  {formatBytes(bytesWritten)} / {formatBytes(totalBytes)}
                </Text>
              </View>
              <ActivityIndicator
                size="large"
                color={darkTheme.primary}
                style={styles.spinner}
              />
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>Download Failed</Text>
              <Text style={styles.errorText}>{downloadError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
                <Text style={styles.retryText}>Retry Download</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: darkTheme.surface,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: darkTheme.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    color: darkTheme.textPrimary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: darkTheme.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: darkTheme.surfaceVariant,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: darkTheme.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: darkTheme.primary,
    textAlign: 'center',
  },
  downloadSize: {
    fontSize: 14,
    color: darkTheme.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  spinner: {
    marginTop: 10,
  },
  errorText: {
    fontSize: 14,
    color: darkTheme.danger,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: darkTheme.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
