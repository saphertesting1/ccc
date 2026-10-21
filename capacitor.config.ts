import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chanduchicken.app',
  appName: 'Chandu Chicken Center',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#D92332',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    }
  }
};

export default config;
