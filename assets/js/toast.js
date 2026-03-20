/**
 * Toast Notification System
 * Types: success | error | info | warning | cart | wish
 */
;(function(global) {
  'use strict';

  var _container = null;

  function getContainer() {
    if (_container) return _container;
    _container = document.createElement('div');
    _container.id = 'toastContainer';
    _container.setAttribute('style', [
      'position:fixed',
      'top:16px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:99999',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:8px',
      'pointer-events:none',
      'width:calc(100% - 32px)',
      'max-width:360px'
    ].join(';'));
    document.body.appendChild(_container);
    return _container;
  }

  var ICONS = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
    cart: '🛒',
    wish: '❤️'
  };

  var COLORS = {
    success: { bg: '#22c55e', text: '#fff' },
    error: { bg: '#ef4444', text: '#fff' },
    info: { bg: '#3b82f6', text: '#fff' },
    warning: { bg: '#f59e0b', text: '#fff' },
    cart: { bg: '#0ea5e9', text: '#fff' },
    wish: { bg: '#ec4899', text: '#fff' }
  };

  function show(message, type, duration) {
    type = type || 'info';
    duration = duration || 2500;

    var container = getContainer();
    var color = COLORS[type] || COLORS.info;
    var icon = ICONS[type] || ICONS.info;

    var el = document.createElement('div');
    el.setAttribute('style', [
      'background:' + color.bg,
      'color:' + color.text,
      'padding:12px 16px',
      'border-radius:12px',
      'font-size:0.9rem',
      'font-weight:500',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'box-shadow:0 4px 20px rgba(0,0,0,0.2)',
      'pointer-events:auto',
      'cursor:pointer',
      'transition:all 0.3s ease',
      'opacity:0',
      'transform:translateY(-10px)',
      'direction:rtl',
      'width:100%',
      'box-sizing:border-box'
    ].join(';'));

    el.innerHTML = '<span>' + icon + '</span><span style="flex:1">' + String(message || '') + '</span>';

    function dismiss() {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      global.setTimeout(function() {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }

    el.addEventListener('click', dismiss);
    container.appendChild(el);

    global.requestAnimationFrame(function() {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });

    var timer = global.setTimeout(dismiss, duration);
    el.addEventListener('click', function() { global.clearTimeout(timer); }, { once: true });
  }

  function success(msg, duration) { show(msg, 'success', duration); }
  function error(msg, duration) { show(msg, 'error', duration); }
  function info(msg, duration) { show(msg, 'info', duration); }
  function warning(msg, duration) { show(msg, 'warning', duration); }
  function cart(msg, duration) { show(msg, 'cart', duration); }
  function wish(msg, duration) { show(msg, 'wish', duration); }

  global.showToast = function(message, type) {
    show(message, type || 'info');
  };

  global.Toast = {
    show: show,
    success: success,
    error: error,
    info: info,
    warning: warning,
    cart: cart,
    wish: wish
  };
})(window);
