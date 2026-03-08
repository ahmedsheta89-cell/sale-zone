// security-utils.js - shared output encoding helpers
// ================================================
(function initSecurityUtils(globalScope) {
    const scope = globalScope || (typeof window !== "undefined" ? window : {});

    function toSafeString(value) {
        if (value === null || value === undefined) return "";
        return String(value);
    }

    function escapeHtml(value) {
        const text = toSafeString(value);
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function setText(element, value) {
        if (!element) return;
        element.textContent = toSafeString(value);
    }

    function safeId(value) {
        const text = toSafeString(value).trim();
        if (!text) return "";
        return text.replace(/[^a-zA-Z0-9_-]/g, "");
    }

    const api = {
        toSafeString,
        escapeHtml,
        setText,
        safeId
    };

    scope.SecurityUtils = api;
    if (typeof scope.escapeHtml !== "function") {
        scope.escapeHtml = escapeHtml;
    }
})(typeof window !== "undefined" ? window : this);
