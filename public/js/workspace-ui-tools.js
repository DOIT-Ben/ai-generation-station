(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsWorkspaceUiTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const getDocument = settings.getDocument || function () { return null; };
    const syncInputDropdown = settings.syncInputDropdown || function () {};
    const updateDropdownScrollState = settings.updateDropdownScrollState || function () {};
    const syncCustomDropdownValue = settings.syncCustomDropdownValue || function () {};
    const showToast = settings.showToast || function () {};

    function initCustomDropdown(dropdownId, inputId) {
      const dropdown = getElement(dropdownId);
      const documentRef = getDocument();
      if (!dropdown || !documentRef) return;

      const trigger = dropdown.querySelector('.dropdown-trigger');
      const menu = dropdown.querySelector('.dropdown-menu');
      const hiddenInput = getElement(inputId);
      if (!trigger || !menu) return;

      const setDropdownOpen = function (isOpen) {
        dropdown.classList.toggle('open', isOpen);
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (isOpen) {
          menu.removeAttribute('hidden');
          updateDropdownScrollState(menu);
        } else {
          menu.setAttribute('hidden', '');
        }
      };

      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');

        documentRef.querySelectorAll('.custom-dropdown.open').forEach(function (item) {
          if (item.id !== dropdownId) {
            item.classList.remove('open');
            item.querySelector('.dropdown-trigger')?.setAttribute('aria-expanded', 'false');
            item.querySelector('.dropdown-menu')?.setAttribute('hidden', '');
          }
        });

        setDropdownOpen(!isOpen);
      });

      menu.addEventListener('click', function (e) {
        const option = e.target.closest('.dropdown-option');
        if (!option || !menu.contains(option)) return;
        e.stopPropagation();
        syncCustomDropdownValue(dropdown, hiddenInput, option);
        setDropdownOpen(false);
      });

      menu.addEventListener('scroll', function () {
        updateDropdownScrollState(menu);
      }, { passive: true });

      documentRef.addEventListener('click', function () {
        if (dropdown.classList.contains('open')) {
          setDropdownOpen(false);
        }
      });

      documentRef.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && dropdown.classList.contains('open')) {
          setDropdownOpen(false);
        }
      });

      syncInputDropdown(inputId);
      updateDropdownScrollState(menu);
    }

    function downloadFile(url, filename) {
      const documentRef = getDocument();
      if (!documentRef || !url) return;
      const anchor = documentRef.createElement('a');
      anchor.href = url;
      anchor.download = filename || '';
      anchor.click();
    }

    function copyToClipboard(text) {
      if (!navigator.clipboard?.writeText) return;
      navigator.clipboard.writeText(text).then(function () {
        showToast('已复制到剪贴板', 'success');
      });
    }

    function showInputError(inputId, message) {
      const input = getElement(inputId);
      if (!input) return;
      input.classList.add('input-error');
      input.setAttribute('aria-invalid', 'true');

      const existingError = input.parentElement.querySelector('.input-error-message');
      if (existingError) existingError.remove();

      const errorEl = getDocument().createElement('div');
      errorEl.className = 'input-error-message';
      errorEl.textContent = message;
      errorEl.setAttribute('role', 'alert');
      input.parentElement.appendChild(errorEl);
      input.focus();
    }

    function clearInputError(inputId) {
      const input = getElement(inputId);
      if (!input) return;
      input.classList.remove('input-error');
      input.removeAttribute('aria-invalid');
      const errorEl = input.parentElement.querySelector('.input-error-message');
      if (errorEl) errorEl.remove();
    }

    return {
      initCustomDropdown: initCustomDropdown,
      downloadFile: downloadFile,
      copyToClipboard: copyToClipboard,
      showInputError: showInputError,
      clearInputError: clearInputError
    };
  }

  return {
    createTools: createTools
  };
}));
