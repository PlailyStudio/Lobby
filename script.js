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

(() => {
  'use strict';

  const atmosphere = document.querySelector('.winter-atmosphere');
  if (!atmosphere) return;

  const wideScreen = matchMedia('(min-width: 760px)');
  const glyphs = '...*+:';

  function populateSnow() {
    const count = wideScreen.matches ? 72 : 40;
    const snowflakes = Array.from({ length: count }, (_, index) => {
      const flake = document.createElement('span');
      const duration = 15.5 + Math.random() * 15.5;
      flake.className = 'snowflake';
      flake.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      flake.style.setProperty('--snow-x', (2 + 96 * (index + Math.random()) / count) + '%');
      flake.style.setProperty('--snow-size', (8 + Math.random() * 6) + 'px');
      flake.style.setProperty('--snow-opacity', String(0.2 + Math.random() * 0.36));
      flake.style.setProperty('--snow-duration', duration + 's');
      flake.style.setProperty('--snow-delay', (-Math.random() * duration) + 's');
      flake.style.setProperty('--snow-drift', (-25 + Math.random() * 50) + 'px');
      return flake;
    });
    atmosphere.replaceChildren(...snowflakes);
  }

  populateSnow();
  wideScreen.addEventListener('change', populateSnow);
})();
