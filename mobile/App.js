import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const STORAGE_KEYS = {
  webUrl: '@termosync/mobile/web-url',
  apiUrl: '@termosync/mobile/api-url'
};

const FALLBACK_HOST = '172.16.0.81';
const DEFAULT_WEB_PORT = '5173';
const DEFAULT_API_PORT = '3001';
const LEGACY_HOSTS = ['192.168.200.27'];

/**
 * Controla normalize url dentro do aplicativo mobile.
 */
const normalizeUrl = (value) => {
  const clean = String(value || '').trim().replace(/\/+$/, '');
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) return clean;
  return `http://${clean}`;
};

/**
 * Controla normalize document url dentro do aplicativo mobile.
 */
const normalizeDocumentUrl = (value) => normalizeUrl(value).replace(/[?#].*$/, '').replace(/\/+$/, '');

/**
 * Controla is main document error dentro do aplicativo mobile.
 */
const isMainDocumentError = (eventUrl, currentWebUrl) => {
  const source = normalizeDocumentUrl(eventUrl);
  const target = normalizeDocumentUrl(currentWebUrl);
  return Boolean(source && target && source === target);
};

/**
 * Controla get url host dentro do aplicativo mobile.
 */
const getUrlHost = (value) => normalizeUrl(value).replace(/^https?:\/\//i, '').split(/[/:?#]/)[0] || '';

/**
 * Controla get url port dentro do aplicativo mobile.
 */
const getUrlPort = (value) => {
  const match = normalizeUrl(value).match(/^https?:\/\/[^/:]+:(\d+)/i);
  return match?.[1] || '';
};

/**
 * Controla repair legacy url dentro do aplicativo mobile.
 */
const repairLegacyUrl = (value, defaultUrl) => {
  let normalized = normalizeUrl(value);
  if (!normalized) return '';

  const defaultHost = getUrlHost(defaultUrl);
  const currentHost = getUrlHost(normalized);
  if (defaultHost && LEGACY_HOSTS.includes(currentHost)) {
    normalized = normalized.replace(currentHost, defaultHost);
  }

  const sameHost = getUrlHost(normalized) === getUrlHost(defaultUrl);
  if (sameHost && getUrlPort(normalized) === '5174' && getUrlPort(defaultUrl) === '5173') {
    return normalized.replace(':5174', ':5173');
  }

  if (sameHost && getUrlPort(normalized) === '3000' && getUrlPort(defaultUrl) === DEFAULT_API_PORT) {
    return normalized.replace(':3000', `:${DEFAULT_API_PORT}`);
  }

  return normalized;
};

/**
 * Controla get expo host dentro do aplicativo mobile.
 */
const getExpoHost = () => {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.manifest?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
    Constants.manifest2?.extra?.expoClient?.hostUri
  ].filter(Boolean);

  const host = String(candidates[0] || '').split(':')[0];
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? host : '';
};

/**
 * Controla get default config dentro do aplicativo mobile.
 */
const getDefaultConfig = () => {
  const host = getExpoHost() || FALLBACK_HOST;
  return {
    webUrl: `http://${host}:${DEFAULT_WEB_PORT}`,
    apiUrl: `http://${host}:${DEFAULT_API_PORT}`
  };
};

/**
 * Controla needs connection review dentro do aplicativo mobile.
 */
const needsConnectionReview = (webUrl, apiUrl) => {
  const webPort = getUrlPort(webUrl);
  const apiPort = getUrlPort(apiUrl);
  return !webUrl || !apiUrl || webPort === DEFAULT_API_PORT || apiPort === DEFAULT_WEB_PORT || apiPort === '5174';
};

/**
 * Controla get connection warning dentro do aplicativo mobile.
 */
const getConnectionWarning = (webUrl, apiUrl) => {
  const nextWebUrl = normalizeUrl(webUrl);
  const nextApiUrl = normalizeUrl(apiUrl);
  const webPort = getUrlPort(nextWebUrl);
  const apiPort = getUrlPort(nextApiUrl);

  if (!nextWebUrl || !nextApiUrl) return 'Informe a URL da web e a URL da API.';
  if (webPort === DEFAULT_API_PORT) return `A URL da web parece apontar para a API. Use a porta do Vite, normalmente ${DEFAULT_WEB_PORT}.`;
  if (apiPort === DEFAULT_WEB_PORT || apiPort === '5174') return `A URL da API parece apontar para a web. Use a porta ${DEFAULT_API_PORT}.`;
  return '';
};

const IOS_APP_CSS = `
  html.termosync-mobile-webview,
  body.termosync-mobile-webview {
    width: 100%;
    min-height: 100%;
    overscroll-behavior: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }

  html.termosync-mobile-webview input,
  html.termosync-mobile-webview select,
  html.termosync-mobile-webview textarea,
  body.termosync-mobile-webview input,
  body.termosync-mobile-webview select,
  body.termosync-mobile-webview textarea {
    font-size: 16px !important;
  }
`;

/**
 * Controla build injected script dentro do aplicativo mobile.
 */
const buildInjectedScript = (apiUrl) => `
  (function () {
    try {
      window.localStorage.setItem('termosync_server', ${JSON.stringify(apiUrl)});
      window.localStorage.setItem('termosync_mobile_shell', 'webview');
      window.localStorage.setItem('termosync_mobile_runtime', 'webview');

      var viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
        document.head.appendChild(viewport);
      }
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1');

      document.documentElement.classList.add('termosync-mobile-webview', 'mobile-app', 'native-app');
      if (document.body) document.body.classList.add('termosync-mobile-webview', 'mobile-app', 'native-app');

      if (!document.getElementById('termosync-mobile-webview-style')) {
        var style = document.createElement('style');
        style.id = 'termosync-mobile-webview-style';
        style.textContent = ${JSON.stringify(IOS_APP_CSS)};
        document.head.appendChild(style);
      }
    } catch (error) {}
    true;
  })();
`;

/**
 * Controla app button dentro do aplicativo mobile.
 */
function AppButton({ icon, label, onPress, disabled }) {
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.appButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={disabled ? '#C7C7CC' : '#007AFF'} />
    </Pressable>
  );
}

/**
 * Controla floating setup button dentro do aplicativo mobile.
 */
function FloatingSetupButton({ onPress }) {
  return (
    <SafeAreaView edges={['bottom', 'right']} pointerEvents="box-none" style={styles.floatingSetupWrap}>
      <Pressable accessibilityLabel="Ajustes de conexao" onPress={onPress} style={({ pressed }) => [styles.floatingSetupButton, pressed && styles.primaryPressed]}>
        <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}

/**
 * Controla setup modal dentro do aplicativo mobile.
 */
function SetupModal({
  visible,
  draftWebUrl,
  draftApiUrl,
  defaultConfig,
  canClose,
  onChangeWebUrl,
  onChangeApiUrl,
  onUseDefaults,
  onClose,
  onSave
}) {
  const validationMessage = getConnectionWarning(draftWebUrl, draftApiUrl);

  return (
    <Modal animationType="slide" transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.modalSafeArea}>
          <View style={styles.configSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>TermoSync Mobile</Text>
                <Text style={styles.sheetTitle}>Ajustes</Text>
              </View>
              {canClose ? <AppButton icon="close" label="Fechar" onPress={onClose} /> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Versao web</Text>
              <View style={styles.inputShell}>
                <Ionicons name="globe-outline" size={18} color="#8E8E93" />
                <TextInput value={draftWebUrl} onChangeText={onChangeWebUrl} placeholder={defaultConfig.webUrl} placeholderTextColor="#8E8E93" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>API do sistema</Text>
              <View style={styles.inputShell}>
                <Ionicons name="server-outline" size={18} color="#8E8E93" />
                <TextInput value={draftApiUrl} onChangeText={onChangeApiUrl} placeholder={defaultConfig.apiUrl} placeholderTextColor="#8E8E93" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
              </View>
            </View>

            {validationMessage ? (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle-outline" size={18} color="#FF9500" />
                <Text style={styles.warningText}>{validationMessage}</Text>
              </View>
            ) : null}

            <Pressable disabled={Boolean(validationMessage)} onPress={onSave} style={({ pressed }) => [styles.primaryButton, validationMessage && styles.disabled, pressed && !validationMessage && styles.primaryPressed]}>
              <Text style={styles.primaryButtonText}>Salvar</Text>
            </Pressable>
            <Pressable onPress={onUseDefaults} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Usar IP detectado</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Controla loading overlay dentro do aplicativo mobile.
 */
function LoadingOverlay({ loading }) {
  if (!loading) return null;

  return (
    <View pointerEvents="none" style={styles.loadingOverlay}>
      <View style={styles.loadingCard}>
        <ActivityIndicator color="#007AFF" />
        <Text style={styles.loadingTitle}>Atualizando</Text>
      </View>
    </View>
  );
}

/**
 * Controla error overlay dentro do aplicativo mobile.
 */
function ErrorOverlay({ error, webUrl, apiUrl, onRetry, onConfigure }) {
  if (!error) return null;

  return (
    <View style={styles.errorOverlay}>
      <View style={styles.errorCard}>
        <View style={styles.errorIcon}>
          <Ionicons name="cloud-offline-outline" size={30} color="#FF9500" />
        </View>
        <Text style={styles.errorTitle}>Sem conexao com o sistema</Text>
        <Text style={styles.errorText}>Confira se o frontend e a API estao ativos na mesma rede do aparelho.</Text>
        <View style={styles.urlBox}>
          <Text style={styles.urlLabel}>Web</Text>
          <Text style={styles.urlText}>{webUrl}</Text>
          <Text style={styles.urlLabel}>API</Text>
          <Text style={styles.urlText}>{apiUrl}</Text>
        </View>
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
          <Text style={styles.primaryButtonText}>Tentar novamente</Text>
        </Pressable>
        <Pressable onPress={onConfigure} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryButtonText}>Ajustar conexao</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Controla web view app dentro do aplicativo mobile.
 */
function WebViewApp() {
  const webViewRef = useRef(null);
  const defaultConfig = useMemo(getDefaultConfig, []);

  const [isReady, setIsReady] = useState(false);
  const [webUrl, setWebUrl] = useState(defaultConfig.webUrl);
  const [apiUrl, setApiUrl] = useState(defaultConfig.apiUrl);
  const [draftWebUrl, setDraftWebUrl] = useState(defaultConfig.webUrl);
  const [draftApiUrl, setDraftApiUrl] = useState(defaultConfig.apiUrl);
  const [showConfig, setShowConfig] = useState(false);
  const [webKey, setWebKey] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    /**
     * Controla load saved config dentro do aplicativo mobile.
     */
    async function loadSavedConfig() {
      try {
        const pairs = await AsyncStorage.multiGet([STORAGE_KEYS.webUrl, STORAGE_KEYS.apiUrl]);
        const saved = Object.fromEntries(pairs);
        const nextWebUrl = repairLegacyUrl(saved[STORAGE_KEYS.webUrl], defaultConfig.webUrl) || defaultConfig.webUrl;
        const nextApiUrl = repairLegacyUrl(saved[STORAGE_KEYS.apiUrl], defaultConfig.apiUrl) || defaultConfig.apiUrl;

        if (!isMounted) return;
        setWebUrl(nextWebUrl);
        setApiUrl(nextApiUrl);
        setDraftWebUrl(nextWebUrl);
        setDraftApiUrl(nextApiUrl);
        setShowConfig(needsConnectionReview(nextWebUrl, nextApiUrl));
      } catch {
        if (!isMounted) return;
        setShowConfig(true);
      } finally {
        if (isMounted) setIsReady(true);
      }
    }

    loadSavedConfig();
    return () => {
      isMounted = false;
    };
  }, [defaultConfig.apiUrl, defaultConfig.webUrl]);

  const injectedScript = useMemo(() => buildInjectedScript(apiUrl), [apiUrl]);

  const saveConfig = useCallback(async () => {
    const nextWebUrl = normalizeUrl(draftWebUrl);
    const nextApiUrl = normalizeUrl(draftApiUrl);
    if (getConnectionWarning(nextWebUrl, nextApiUrl)) return;

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.webUrl, nextWebUrl],
      [STORAGE_KEYS.apiUrl, nextApiUrl]
    ]);

    setWebUrl(nextWebUrl);
    setApiUrl(nextApiUrl);
    setLastError(null);
    setIsLoading(true);
    setShowConfig(false);
    setWebKey((current) => current + 1);
  }, [draftApiUrl, draftWebUrl]);

  const useDefaults = useCallback(() => {
    setDraftWebUrl(defaultConfig.webUrl);
    setDraftApiUrl(defaultConfig.apiUrl);
  }, [defaultConfig.apiUrl, defaultConfig.webUrl]);

  const reload = useCallback(() => {
    setLastError(null);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  if (!isReady) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.bootScreen}>
        <ExpoStatusBar style="dark" backgroundColor="#F2F2F7" translucent={false} />
        <ActivityIndicator color="#007AFF" size="large" />
        <Text style={styles.bootTitle}>TermoSync</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.app}>
      <ExpoStatusBar style="dark" backgroundColor="#F2F2F7" translucent={false} />

      <SafeAreaView edges={['top', 'left', 'right']} style={styles.authStatusSafeArea} />

      <View style={styles.webContainer}>
        <WebView
          key={`${webKey}-${webUrl}`}
          ref={webViewRef}
          source={{ uri: webUrl }}
          style={styles.webview}
          originWhitelist={['http://*', 'https://*']}
          injectedJavaScriptBeforeContentLoaded={injectedScript}
          injectedJavaScript={injectedScript}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          cacheEnabled
          pullToRefreshEnabled
          allowsBackForwardNavigationGestures
          contentInsetAdjustmentBehavior="never"
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          onLoadStart={() => {
            setIsLoading(true);
            setLastError(null);
          }}
          onLoadProgress={() => {}}
          onLoadEnd={() => setIsLoading(false)}
          onError={({ nativeEvent }) => {
            setIsLoading(false);
            setLastError(nativeEvent);
          }}
          onHttpError={({ nativeEvent }) => {
            if (isMainDocumentError(nativeEvent?.url, webUrl)) {
              setIsLoading(false);
              setLastError(nativeEvent);
            }
          }}
          onRenderProcessGone={({ nativeEvent }) => {
            setLastError({ description: nativeEvent?.didCrash ? 'WebView reiniciada apos falha do processo.' : 'WebView reiniciada pelo sistema.' });
            setWebKey((current) => current + 1);
          }}
          onContentProcessDidTerminate={() => {
            setWebKey((current) => current + 1);
          }}
        />

        <LoadingOverlay loading={isLoading && !lastError} />

        <ErrorOverlay
          error={lastError}
          webUrl={webUrl}
          apiUrl={apiUrl}
          onRetry={reload}
          onConfigure={() => setShowConfig(true)}
        />
      </View>

      <FloatingSetupButton onPress={() => setShowConfig(true)} />

      <SetupModal
        visible={showConfig}
        draftWebUrl={draftWebUrl}
        draftApiUrl={draftApiUrl}
        defaultConfig={defaultConfig}
        canClose={!needsConnectionReview(webUrl, apiUrl)}
        onChangeWebUrl={setDraftWebUrl}
        onChangeApiUrl={setDraftApiUrl}
        onUseDefaults={useDefaults}
        onClose={() => setShowConfig(false)}
        onSave={saveConfig}
      />
    </View>
  );
}

/**
 * Controla app dentro do aplicativo mobile.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <WebViewApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#F2F2F7'
  },
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: '#F2F2F7'
  },
  bootTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800'
  },
  headerSafeArea: {
    backgroundColor: 'rgba(248, 248, 248, 0.96)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D5DB'
  },
  authStatusSafeArea: {
    backgroundColor: '#F2F2F7'
  },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 7
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center'
  },
  appName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800'
  },
  screenTitle: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(209, 213, 219, 0.75)'
  },
  progressFill: {
    height: 2,
    backgroundColor: '#007AFF'
  },
  appButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  webview: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  tabSafeArea: {
    backgroundColor: 'rgba(248, 248, 248, 0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D1D5DB'
  },
  tabBar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 5,
    backgroundColor: 'rgba(248, 248, 248, 0.96)'
  },
  tabItem: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2
  },
  tabLabel: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '700'
  },
  tabLabelActive: {
    color: '#007AFF'
  },
  floatingSetupWrap: {
    position: 'absolute',
    right: 16,
    bottom: 16
  },
  floatingSetupButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 242, 247, 0.22)'
  },
  loadingCard: {
    minWidth: 128,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB'
  },
  loadingTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800'
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: '#F2F2F7'
  },
  errorCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB'
  },
  errorIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(255, 149, 0, 0.14)'
  },
  errorTitle: {
    color: '#111827',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center'
  },
  errorText: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8
  },
  urlBox: {
    width: '100%',
    borderRadius: 14,
    padding: 12,
    gap: 4,
    marginVertical: 16,
    backgroundColor: '#F2F2F7'
  },
  urlLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2
  },
  urlText: {
    color: '#111827',
    fontSize: 12
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.28)'
  },
  modalSafeArea: {
    justifyContent: 'flex-end'
  },
  configSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    marginBottom: 14
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18
  },
  sheetEyebrow: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700'
  },
  sheetTitle: {
    color: '#111827',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 2
  },
  inputGroup: {
    gap: 8,
    marginBottom: 14
  },
  inputLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700'
  },
  inputShell: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#F2F2F7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12
  },
  input: {
    flex: 1,
    minHeight: 50,
    color: '#111827',
    fontSize: 15,
    paddingVertical: 0
  },
  warningBox: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 14
  },
  warningText: {
    flex: 1,
    color: '#8A4B00',
    fontSize: 13,
    fontWeight: '700'
  },
  primaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800'
  },
  secondaryButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 10,
    backgroundColor: '#F2F2F7'
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '700'
  },
  linkButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 6
  },
  linkButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.35
  },
  pressed: {
    backgroundColor: '#E5E7EB'
  },
  primaryPressed: {
    opacity: 0.82
  }
});
