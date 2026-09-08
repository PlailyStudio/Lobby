(() => {
  'use strict';

  const userAgent = navigator.userAgent || '';

  function detectEnvironment() {
    const isAndroid = /Android/i.test(userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const isInstagram = /Instagram/i.test(userAgent);
    const isThreads = /Barcelona/i.test(userAgent);
    const isFacebook = /FBAN|FBAV|FB_IAB/i.test(userAgent);
    const isTikTok = /Musical\.ly|TikTok/i.test(userAgent);
    const isNaverApp = /NAVER\s*\((?:inapp|higgs);/i.test(userAgent);
    const isKnownInApp = /Twitter|Snapchat|LinkedInApp|KAKAOTALK|DaumApps|Line\//i.test(userAgent);
    const isAndroidWebView =
      isAndroid &&
      !isNaverApp &&
      (/; wv\)/i.test(userAgent) || /\bwv\b/i.test(userAgent));

    return {
      isAndroid,
      isIOS,
      isInstagram,
      isThreads,
      isFacebook,
      isTikTok,
      isInApp: isInstagram || isThreads || isFacebook || isTikTok || isKnownInApp || isAndroidWebView,
    };
  }

  function openExternalBrowser(destinationUrl) {
    const environment = detectEnvironment();

    if (environment.isIOS && environment.isInstagram) {
      window.location.href = `instagram://extbrowser/?url=${encodeURIComponent(destinationUrl)}`;
      return;
    }

    if (environment.isIOS && environment.isThreads) {
      window.location.href = `barcelona://extbrowser/?url=${encodeURIComponent(destinationUrl)}`;
      return;
    }

    if (environment.isAndroid && environment.isInApp) {
      const destination = new URL(destinationUrl);
      const path = destination.host + destination.pathname + destination.search + destination.hash;
      window.location.href =
        `intent://${path}` +
        '#Intent;scheme=https;action=android.intent.action.VIEW;' +
        'S.browser_fallback_url=' +
        `${encodeURIComponent(destinationUrl)};end`;
      return;
    }

    window.location.href = destinationUrl;
  }

  document.querySelectorAll('[data-destination]').forEach((button) => {
    button.addEventListener('click', () => openExternalBrowser(button.dataset.destination));
  });
})();
