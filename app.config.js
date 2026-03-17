// Load environment variables from .env file
require('dotenv').config();

module.exports = {
  expo: {
    name: "Legacy Prime Workflow Suite",
    slug: "legacy-prime-workflow-suite",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/app-icon-1024.png",
    scheme: "legacyprime",
    splash: {
      image: "./assets/images/logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "app.rork.legacy-prime-workflow-suite",
      icon: "./assets/images/logo.png",
      usesAppleSignIn: true,
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        UIBackgroundModes: ["remote-notification", "fetch", "audio", "location"],
        NSPhotoLibraryUsageDescription: "Allow $(PRODUCT_NAME) to access your photos",
        NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to access your camera",
        NSMicrophoneUsageDescription: "Allow $(PRODUCT_NAME) to access your microphone",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/logo.png",
        backgroundColor: "#ffffff"
      },
      icon: "./assets/images/app-icon-1024.png",
      package: "app.rork.legacy_prime_workflow_suite",
      googleServicesFile: "./google-services.json",
    },
    web: {
      favicon: "./assets/images/favicon.png",
      bundler: "metro"
    },
    plugins: [
      "react-native-document-scanner-plugin",
      "expo-apple-authentication",
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      [
        "expo-notifications",
        {
          icon: "./assets/images/app-icon-1024.png",
          color: "#ffffff",
          sounds: []
        }
      ],
    ],
    extra: {
      openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      rorkApiBaseUrl: process.env.EXPO_PUBLIC_RORK_API_BASE_URL,
      eas: {
        projectId: "fe5b6952-88a7-4df1-9377-521962ec7732"
      }
    }
  }
};
