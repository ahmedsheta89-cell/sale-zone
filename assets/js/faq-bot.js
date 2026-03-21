/**
 * FAQ Bot - AI-powered customer support for Sale Zone.
 * Level 1: FAQ keyword matching
 * Level 2: Product matching from live catalog
 * Level 3: Escalation to tawk.to human support
 */
;(function(global) {
  'use strict';

  var DEFAULT_FAQ = [
    {
      keywords: ['سعر', 'كم', 'بكام', 'تمن'],
      response: 'يمكنك مشاهدة سعر أي منتج بالضغط عليه مباشرة في المتجر. إذا أردت سعر منتج معين، أخبرني باسمه.'
    },
    {
      keywords: ['توصيل', 'شحن', 'delivery', 'هيوصل'],
      response: 'نوصل لجميع محافظات مصر. وقت التوصيل من 2-5 أيام عمل. يمكنك التواصل معنا عبر واتساب لمعرفة تفاصيل الشحن.'
    },
    {
      keywords: ['دفع', 'كاش', 'اونلاين', 'payment', 'فيزا'],
      response: 'نقبل الدفع عند الاستلام أو عبر واتساب للاتفاق على طريقة دفع مناسبة.'
    },
    {
      keywords: ['استبدال', 'ارجاع', 'return', 'مش عاجبني'],
      response: 'نقبل الاستبدال خلال 3 أيام من الاستلام للمنتجات غير المستخدمة. تواصل معنا عبر واتساب.'
    },
    {
      keywords: ['اصلي', 'original', 'genuine', 'authentic'],
      response: 'جميع منتجاتنا أصلية 100% من موردين معتمدين. نضمن الجودة أو نسترجع المبلغ.'
    },
    {
      keywords: ['خصم', 'discount', 'offer', 'عرض', 'كوبون'],
      response: 'تابع المتجر للاطلاع على أحدث العروض والخصومات. يمكنك أيضاً التواصل معنا للاستفسار عن العروض الحالية.'
    },
    {
      keywords: ['مكونات', 'ingredients', 'ايه فيه', 'محتوياته'],
      response: 'يمكنك مشاهدة وصف المنتج الكامل بالضغط عليه في المتجر. للمزيد من التفاصيل تواصل معنا.'
    },
    {
      keywords: ['مناسب', 'بشرة', 'hair type', 'نوع بشرتي'],
      response: 'أخبرني بنوع بشرتك أو مشكلتك وسأساعدك في اختيار المنتج المناسب.'
    }
  ];

  var _faq = DEFAULT_FAQ.slice();
  var _products = [];
  var _ready = false;

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[\u0610-\u061A\u064B-\u065F]/g, '')
      .replace(/\s+/g, ' ');
  }

  function getConfiguredFAQ() {
    var configured = global.storeSettings && Array.isArray(global.storeSettings.faqIntents)
      ? global.storeSettings.faqIntents
      : [];

    if (configured.length) {
      return configured
        .filter(function(item) {
          return item && Array.isArray(item.keywords) && item.response;
        })
        .map(function(item) {
          return {
            keywords: item.keywords.map(function(keyword) {
              return String(keyword || '').trim();
            }).filter(Boolean),
            response: String(item.response || '').trim()
          };
        })
        .filter(function(item) {
          return item.keywords.length > 0 && item.response;
        });
    }

    try {
      var stored = global.localStorage && global.localStorage.getItem('salezone_faq_bot');
      if (stored) {
        var parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed;
        }
      }
    } catch (_) {}

    return DEFAULT_FAQ.slice();
  }

  function loadFAQ() {
    _faq = getConfiguredFAQ();
    return _faq.slice();
  }

  function loadProducts(products) {
    _products = Array.isArray(products) ? products.slice() : [];
    _ready = _products.length > 0;
    return _products.slice();
  }

  function getProducts() {
    if (_products.length) return _products;
    if (Array.isArray(global.products) && global.products.length) {
      _products = global.products.slice();
      _ready = true;
    }
    return _products;
  }

  function matchFAQ(message) {
    var msg = normalize(message);
    for (var i = 0; i < _faq.length; i += 1) {
      var item = _faq[i];
      var keywords = Array.isArray(item && item.keywords) ? item.keywords : [];
      for (var j = 0; j < keywords.length; j += 1) {
        if (msg.indexOf(normalize(keywords[j])) !== -1) {
          return String(item.response || '').trim();
        }
      }
    }
    return null;
  }

  function matchProduct(message) {
    var msg = normalize(message);
    var catalog = getProducts();
    if (!catalog.length) return null;

    var matches = catalog.filter(function(product) {
      var name = normalize(product && (product.nameAr || product.name));
      var brand = normalize(product && product.brand);
      return (name && (msg.indexOf(name) !== -1 || name.indexOf(msg) !== -1))
        || (brand && (msg.indexOf(brand) !== -1 || brand.indexOf(msg) !== -1));
    });

    if (!matches.length) return null;
    if (matches.length === 1) {
      var product = matches[0];
      return '🛍️ ' + String(product.nameAr || product.name || '') + '\n'
        + '💰 السعر: ' + String(product.price || 0) + ' جنيه\n'
        + (product.descriptionAr ? '📝 ' + String(product.descriptionAr).substring(0, 100) + '...\n' : '')
        + ((Number(product.stock) === 0) ? '❌ نفد المخزون' : '✅ متوفر');
    }

    return 'وجدت ' + matches.length + ' منتجات مشابهة:\n'
      + matches.slice(0, 3).map(function(product, index) {
        return (index + 1) + '. ' + String(product.nameAr || product.name || '') + ' - ' + String(product.price || 0) + ' جنيه';
      }).join('\n')
      + '\nأي منتج تريد التفاصيل عنه؟';
  }

  function respond(message) {
    if (!String(message || '').trim()) return null;

    var faqAnswer = matchFAQ(message);
    if (faqAnswer) {
      return { text: faqAnswer, source: 'faq' };
    }

    var productAnswer = matchProduct(message);
    if (productAnswer) {
      return { text: productAnswer, source: 'product' };
    }

    return {
      text: 'عذراً، لم أفهم سؤالك جيداً.\nيمكنني مساعدتك في الأسعار، التوصيل، الدفع، وسياسة الاسترجاع.\nإذا أردت، سأحوّلك مباشرة إلى خدمة العملاء.',
      source: 'escalate',
      showEscalate: true
    };
  }

  function maybeEscalate() {
    if (global.Tawk_API && typeof global.Tawk_API.maximize === 'function') {
      global.setTimeout(function() {
        try {
          global.Tawk_API.maximize();
        } catch (_) {}
      }, 600);
    }
  }

  function integrateWithStoreChat() {
    if (typeof global.getBotResponse === 'function' && global.getBotResponse.__faqBotWrapped__ === true) {
      return;
    }

    if (typeof global.getBotResponse === 'function') {
      var originalGetBotResponse = global.getBotResponse;
      var wrapped = function(message) {
        var reply = respond(message);
        if (reply && reply.text) {
          if (reply.showEscalate) {
            maybeEscalate();
          }
          return reply.text;
        }
        return originalGetBotResponse(message);
      };
      wrapped.__faqBotWrapped__ = true;
      global.getBotResponse = wrapped;
    }
  }

  function bootProducts() {
    if (Array.isArray(global.products) && global.products.length) {
      loadProducts(global.products);
      return;
    }

    if (typeof global.getVisibleProductsList === 'function') {
      try {
        loadProducts(global.getVisibleProductsList());
      } catch (_) {}
    }

    if (_ready) return;

    var attempts = 0;
    var timer = global.setInterval(function() {
      attempts += 1;
      if (Array.isArray(global.products) && global.products.length) {
        loadProducts(global.products);
      } else if (typeof global.getVisibleProductsList === 'function') {
        try {
          loadProducts(global.getVisibleProductsList());
        } catch (_) {}
      }

      if (_ready || attempts >= 20) {
        global.clearInterval(timer);
      }
    }, 1000);
  }

  document.addEventListener('DOMContentLoaded', function() {
    loadFAQ();
    bootProducts();
    integrateWithStoreChat();
  });

  global.FAQBot = {
    respond: respond,
    loadProducts: loadProducts,
    loadFAQ: loadFAQ,
    maybeEscalate: maybeEscalate,
    updateFAQ: function(faq) {
      _faq = Array.isArray(faq) ? faq.slice() : DEFAULT_FAQ.slice();
      try {
        if (global.localStorage) {
          global.localStorage.setItem('salezone_faq_bot', JSON.stringify(_faq));
        }
      } catch (_) {}
    },
    ready: function() {
      return _ready;
    }
  };
})(window);
