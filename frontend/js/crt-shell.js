(function () {
  function initCRTPage() {
    const scroller = document.querySelector('.container');
    if (!scroller) return;

    const reveals = document.querySelectorAll('.reveal');
    if (reveals.length > 0 && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        {
          root: scroller,
          threshold: 0.24,
          rootMargin: '0px 0px -8% 0px',
        }
      );

      reveals.forEach((section) => observer.observe(section));
    } else {
      reveals.forEach((section) => section.classList.add('is-visible'));
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const isMobile = isCoarsePointer && navigator.maxTouchPoints > 0;

    if (reducedMotion || isMobile) return;

    let currentY = scroller.scrollTop;
    let targetY = currentY;
    let ticking = false;
    let scrollVelocity = 0;
    let lastFrameY = currentY;
    let rafFloatId = null;

    const floatingSections = Array.from(document.querySelectorAll('.reveal'));

    const profiles = {
      mouse: {
        momentum: 0.056,
        stopThreshold: 0.1,
        wheelBoost: 1.58,
        maxStep: 520,
        floatAmp: 5.2,
        tiltAmp: 0.62,
        velocityInfluence: 0.18,
      },
      touchpad: {
        momentum: 0.108,
        stopThreshold: 0.14,
        wheelBoost: 1.02,
        maxStep: 220,
        floatAmp: 2.4,
        tiltAmp: 0.28,
        velocityInfluence: 0.1,
      },
    };

    let activeProfile = profiles.mouse;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const maxScrollY = () => Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const normalizeDelta = (delta, deltaMode) => {
      if (deltaMode === 1) return delta * 16;
      if (deltaMode === 2) return delta * scroller.clientHeight;
      return delta;
    };

    const isTouchpadLike = (event) => {
      const absY = Math.abs(event.deltaY);
      const absX = Math.abs(event.deltaX);

      if (event.deltaMode === 0 && (absX > 0 || absY < 18)) return true;
      if (event.deltaMode === 1 && absY <= 2) return true;
      return false;
    };

    const animateFloating = (time) => {
      const frameVelocity = currentY - lastFrameY;
      lastFrameY = currentY;
      scrollVelocity = scrollVelocity * 0.86 + frameVelocity * 0.14;

      floatingSections.forEach((section, index) => {
        const phase = time * 0.001 + index * 0.72;
        const wave = Math.sin(phase * 1.08) * activeProfile.floatAmp;
        const drift = Math.cos(phase * 0.72) * (activeProfile.floatAmp * 0.32);
        const inertia = Math.max(-8, Math.min(8, -scrollVelocity * activeProfile.velocityInfluence));
        const floatY = wave + drift + inertia;
        const tilt = Math.max(-1.2, Math.min(1.2, -scrollVelocity * activeProfile.tiltAmp));

        section.style.setProperty('--float-y', `${floatY.toFixed(2)}px`);
        section.style.setProperty('--float-tilt', `${tilt.toFixed(2)}deg`);
      });

      rafFloatId = requestAnimationFrame(animateFloating);
    };

    const animateScroll = () => {
      currentY += (targetY - currentY) * activeProfile.momentum;

      if (Math.abs(targetY - currentY) < activeProfile.stopThreshold) {
        currentY = targetY;
      }

      scroller.scrollTop = currentY;

      if (currentY !== targetY) {
        requestAnimationFrame(animateScroll);
      } else {
        ticking = false;
      }
    };

    scroller.addEventListener(
      'wheel',
      (event) => {
        if (event.ctrlKey) return;

        event.preventDefault();
        activeProfile = isTouchpadLike(event) ? profiles.touchpad : profiles.mouse;

        const deltaY = normalizeDelta(event.deltaY, event.deltaMode);
        const boostedStep = clamp(
          deltaY * activeProfile.wheelBoost,
          -activeProfile.maxStep,
          activeProfile.maxStep
        );
        targetY = clamp(targetY + boostedStep, 0, maxScrollY());

        if (!ticking) {
          ticking = true;
          requestAnimationFrame(animateScroll);
        }
      },
      { passive: false }
    );

    scroller.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        currentY = scroller.scrollTop;
        targetY = currentY;
      },
      { passive: true }
    );

    window.addEventListener('resize', () => {
      const maxY = maxScrollY();
      targetY = clamp(targetY, 0, maxY);
      currentY = clamp(scroller.scrollTop, 0, maxY);
      scroller.scrollTop = currentY;
    });

    if (!rafFloatId) {
      rafFloatId = requestAnimationFrame(animateFloating);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCRTPage);
  } else {
    initCRTPage();
  }
})();
