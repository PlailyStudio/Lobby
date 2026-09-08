(() => {
  'use strict';

  let selectedDestination = document.getElementById('open-button').dataset.destination;
  const userAgent = navigator.userAgent || '';
  const overlay = document.getElementById('guide-overlay');
  const platformLabel = document.getElementById('platform-label');
  const copyButton = document.getElementById('copy-button');

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

  function getPlatformName(environment) {
    if (environment.isInstagram) return 'Instagram';
    if (environment.isThreads) return 'Threads';
    if (environment.isFacebook) return 'Facebook';
    if (environment.isTikTok) return 'TikTok';
    return '인앱 브라우저';
  }

  function showGuide() {
    const environment = detectEnvironment();
    platformLabel.textContent = `${getPlatformName(environment)}에서 열었어요`;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('close-button').focus();
  }

  function hideGuide() {
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  function openExternalBrowser(destinationUrl) {
    selectedDestination = destinationUrl;
    copyButton.textContent = '주소 복사';
    const environment = detectEnvironment();

    if (environment.isIOS && environment.isInstagram) {
      showGuide();
      window.location.href = `instagram://extbrowser/?url=${encodeURIComponent(destinationUrl)}`;
      return;
    }

    if (environment.isIOS && environment.isThreads) {
      showGuide();
      window.location.href = `barcelona://extbrowser/?url=${encodeURIComponent(destinationUrl)}`;
      return;
    }

    if (environment.isAndroid && environment.isInApp) {
      showGuide();
      const destination = new URL(destinationUrl);
      const path = destination.host + destination.pathname + destination.search + destination.hash;
      window.location.href =
        `intent://${path}` +
        '#Intent;scheme=https;action=android.intent.action.VIEW;' +
        'S.browser_fallback_url=' +
        `${encodeURIComponent(destinationUrl)};end`;
      return;
    }

    if (environment.isIOS && environment.isInApp) {
      showGuide();
      return;
    }

    window.location.href = destinationUrl;
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(selectedDestination);
    } catch (_) {
      const field = document.createElement('textarea');
      field.value = selectedDestination;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }

    copyButton.textContent = '복사했어요';
    window.setTimeout(() => { copyButton.textContent = '주소 복사'; }, 1800);
  }

  document.querySelectorAll('[data-destination]').forEach((button) => {
    button.addEventListener('click', () => openExternalBrowser(button.dataset.destination));
  });
  document.getElementById('help-button').addEventListener('click', showGuide);
  document.getElementById('close-button').addEventListener('click', hideGuide);
  document.getElementById('backdrop').addEventListener('click', hideGuide);
  copyButton.addEventListener('click', copyAddress);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden) hideGuide();
  });

})();
