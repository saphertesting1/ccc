import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export function useBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backHandler: any;

    try {
      backHandler = CapApp.addListener('backButton', ({ canGoBack }) => {
        if (location.pathname === '/' || location.pathname === '/admin/dashboard') {
          // Exit or minimize app
          CapApp.exitApp();
        } else if (canGoBack) {
          navigate(-1);
        } else {
          navigate('/');
        }
      });
    } catch (e) {
      console.warn('Capacitor backButton listener unavailable:', e);
    }

    return () => {
      if (backHandler && typeof backHandler.remove === 'function') {
        backHandler.remove();
      }
    };
  }, [navigate, location]);
}
