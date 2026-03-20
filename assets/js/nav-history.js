/**
 * NavHistory — Mobile Navigation Manager
 * Implements History API for SPA panel navigation.
 */
;(function(global) {
  'use strict';

  var _stack = [];
  var _popping = false;
  var _handlers = {};
  var _activeProductPanel = '';
  var _homeGuardReady = false;

  function _homeUrl() {
    return global.location.pathname + global.location.search;
  }

  function _panelUrl(name) {
    return _homeUrl() + '#' + encodeURIComponent(String(name || ''));
  }

  function _removeFromStack(name) {
    var idx = _stack.indexOf(name);
    if (idx !== -1) _stack.splice(idx, 1);
  }

  function _track(name) {
    if (!name || _stack.indexOf(name) !== -1) return;
    _stack.push(name);
  }

  function _untrack(name) {
    _removeFromStack(name);
  }

  function register(name, openFn, closeFn) {
    if (!name) return;
    _handlers[name] = { open: openFn, close: closeFn };
  }

  function open(name) {
    if (!name || _popping) return;
    if (_stack.indexOf(name) !== -1) return;

    _track(name);
    global.history.pushState(
      { panel: name, depth: _stack.length },
      '',
      _panelUrl(name)
    );

    if (_handlers[name] && typeof _handlers[name].open === 'function') {
      _handlers[name].open({ fromHistory: false });
    }
  }

  function close(name) {
    if (!name) return;
    var exists = _stack.indexOf(name) !== -1;

    if (_popping) {
      _untrack(name);
      if (_handlers[name] && typeof _handlers[name].close === 'function') {
        _handlers[name].close({ fromHistory: true });
      }
      return;
    }

    if (!exists) {
      if (_handlers[name] && typeof _handlers[name].close === 'function') {
        _handlers[name].close({ fromHistory: false });
      }
      return;
    }

    global.history.back();
  }

  function syncProductRoute() {
    var match = String(global.location.hash || '').match(/^#product\/(.+)$/);
    var panelName = match ? 'product-' + decodeURIComponent(match[1]) : '';

    if (panelName && _activeProductPanel !== panelName) {
      if (_activeProductPanel) {
        _untrack(_activeProductPanel);
      }
      _activeProductPanel = panelName;
      _track(panelName);
      return;
    }

    if (!panelName && _activeProductPanel) {
      _untrack(_activeProductPanel);
      _activeProductPanel = '';
      if (!_homeGuardReady) {
        global.history.pushState(
          { panel: 'store', depth: 0, guard: true },
          '',
          _homeUrl()
        );
        _homeGuardReady = true;
      }
    }
  }

  function setupDefaultState() {
    var isProductRoute = /^#product\/.+/.test(String(global.location.hash || ''));
    if (!global.history.state) {
      global.history.replaceState(
        { panel: 'store', depth: 0 },
        '',
        _homeUrl() + (global.location.hash || '')
      );
    }
    if (!isProductRoute && !_homeGuardReady) {
      global.history.pushState(
        { panel: 'store', depth: 0, guard: true },
        '',
        _homeUrl()
      );
      _homeGuardReady = true;
    }
    syncProductRoute();
  }

  function registerStorePanels() {
    if (typeof global.openCart === 'function' && typeof global.closeCart === 'function') {
      register(
        'cart',
        function() { global.openCart({ skipHistory: true, fromNavHistory: true }); },
        function() { global.closeCart({ skipHistory: true, fromNavHistory: true }); }
      );
    }

    if (typeof global.openWishlist === 'function' && typeof global.closeWishlist === 'function') {
      register(
        'wishlist',
        function() { global.openWishlist({ skipHistory: true, fromNavHistory: true }); },
        function() { global.closeWishlist({ skipHistory: true, fromNavHistory: true }); }
      );
    }
  }

  global.addEventListener('popstate', function() {
    if (_popping) return;
    _popping = true;

    if (_stack.length > 0) {
      var topPanel = _stack[_stack.length - 1];
      close(topPanel);
    } else {
      global.history.pushState(
        { panel: 'store', depth: 0 },
        '',
        _homeUrl()
      );
    }

    global.setTimeout(function() { _popping = false; }, 50);
  });

  global.addEventListener('hashchange', syncProductRoute);

  if (document.readyState === 'loading') {
    global.addEventListener('DOMContentLoaded', function() {
      setupDefaultState();
      registerStorePanels();
    });
  } else {
    setupDefaultState();
    registerStorePanels();
  }

  global.NavHistory = {
    register: register,
    open: open,
    close: close,
    track: _track,
    untrack: _untrack,
    stack: function() { return _stack.slice(); },
    clear: function() {
      _stack = [];
      _activeProductPanel = '';
    }
  };
})(window);
