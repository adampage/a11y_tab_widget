'use strict';

if ( typeof Object.assign != 'function' ) {
  // Must be writable: true, enumerable: false, configurable: true
  Object.defineProperty(Object, "assign", {
    value: function assign( target, varArgs ) { // .length of function is 2

      if ( target == null ) { // TypeError if undefined or null
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var to = Object(target);

      for ( var index = 1; index < arguments.length; index++ ) {
        var nextSource = arguments[index];

        if ( nextSource != null ) { // Skip over if undefined or null
          for ( var nextKey in nextSource ) {
            // Avoid bugs when hasOwnProperty is shadowed
            if ( Object.prototype.hasOwnProperty.call(nextSource, nextKey) ) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    },
    writable: true,
    configurable: true
  });
}

if ( Element && !Element.prototype.matches ) {
  var proto = Element.prototype;
  proto.matches = proto.matchesSelector ||
    proto.mozMatchesSelector || proto.msMatchesSelector ||
    proto.oMatchesSelector || proto.webkitMatchesSelector;
}

// add utilities
var util = {
  keyCodes: {
    UP: 38,
    DOWN: 40,
    LEFT: 37,
    RIGHT: 39,
    HOME: 36,
    END: 35,
    ENTER: 13,
    SPACE: 32,
    DELETE: 46,
    TAB: 9
  },

  generateID: function ( base ) {
    return base + Math.floor(Math.random() * 999);
  },

  getDirectChildren: function ( elm, selector ) {
    return Array.prototype.filter.call(elm.children, function ( child ) {
      return child.matches(selector);
    });
  },

  getUrlHash: function () {
    return window.location.hash.replace('#', '');
  },

  /**
   * Use history.replaceState so clicking through Tabs
   * does not create dozens of new history entries.
   * Browser back should navigate to the previous page
   * regardless of how many Tabs were activated.
   *
   * @param {string} hash
   */
  setUrlHash: function( hash ) {
    if ( history.replaceState ) {
      history.replaceState(null, '', '#' + hash);
    } else {
      location.hash = hash;
    }
  },

  /**
   * Prevent focus on event target by blurring and resetting
   * the focus to the previous focus target if possible.
   *
   * @param event
   */
  preventFocus: function (event) {
    event.preventDefault();

    var currentFocusTarget = event.currentTarget;
    var previousFocusTarget = event.relatedTarget;

    // Try to remove the focus from this element.
    // This is important to always perform, since just focusing the previously focused element won't work in Edge/FF,
    // if that element is unable to actually get the focus back (became invisible, etc.): the focus would stay on the
    // current element in such a case
    if (currentFocusTarget && typeof currentFocusTarget.blur === 'function') {
      currentFocusTarget.blur();
    }

    if (previousFocusTarget && typeof previousFocusTarget.focus === 'function') {
      // Revert focus back to previous blurring element
      event.relatedTarget.focus();
    }
  }
};

(function ( w, doc, undefined ) {
  /**
   * ARIA Tabbed Interface
   * Creates a tab list to toggle the visibility of
   * different subsections of a document.
   *
   * Author: Scott O'Hara
   * Version: 2.1.4
   * License: https://github.com/scottaohara/a11y_tab_widget/blob/master/LICENSE
   */
  var ARIAtabsOptions = {
    baseID: 'atab_',
    defaultTabLabel: 'Tab ',
    elClass: 'atabs',
    customTabClassAttribute: 'data-atabs-tab-class',
    tabLabelAttribute: 'data-atabs-tab-label',
    headingAttribute: 'data-atabs-heading',
    defaultOrientation: 'horizontal',
    orientationAttribute: 'data-atabs-orientation',
    panelWrapper: 'data-atabs-panel-wrap',
    disabledAttribute: 'data-atabs-disabled',
    panelClass: 'atabs__panel',
    panelSelector: '[data-atabs-panel]',
    tabClass: 'atabs__list__tab',
    tabListClass: 'atabs__list',
    tabListWrapperClass: 'atabs__list__wrapper',
    btnCloseClass: 'atabs__list__close',
    tabWrapperClass: 'atabs__list__tabwrapper',
    tablistSelector: '[data-atabs-list]',
    manualAttribute: 'data-atabs-manual',
    manual: false,
    closeableAttribute: 'data-atabs-closeable',
    closeable: false
  };


  var ARIAtabs = function ( inst, options ) {
    var _options = Object.assign(ARIAtabsOptions, options);
    var orientation = _options.defaultOrientation;
    var _tabListContainer;
    var _tabs = [];
    var activeIndex = 0;
    var defaultPanel = 0;
    var selectedTab = activeIndex;
    var el = inst;
    var hasPanelWrapper = el.querySelector('[' + _options.panelWrapper + ']');
    var elID;
    var headingSelector = '[' + _options.headingAttribute + ']';

    var init = function () {
      elID = el.id || util.generateID(_options.baseID);

      if ( el.getAttribute(_options.orientationAttribute) === 'vertical' ) {
        orientation = 'vertical';
      }

      if ( el.hasAttribute(_options.manualAttribute) ) {
        _options.manual = true;
      }

      if ( el.hasAttribute(_options.closeableAttribute) ) {
        _options.closeable = true;
      }

      el.classList.add(_options.elClass);

      // find or create the tabList
      _tabListContainer = generateTablistContainer();

      // create the tabs and setup the panels
      buildTabs.call( this );

      // If there's a table of contents for no-js sections,
      // that won't be needed anymore. Remove it.
      deleteTOC();

      if ( activeIndex > -1 ) {
        activateTab();
      }
    }; // init()


    var generateTablistContainer = function () {
      var tabListContainer = el.querySelector(_options.tablistSelector) || doc.createElement('div');
      tabListContainer.setAttribute('role', 'tablist');
      tabListContainer.classList.add(_options.tabListClass);
      tabListContainer.id = elID + '_list';
      tabListContainer.innerHTML = ''; // clear out anything that shouldn't be there
      if ( orientation === 'vertical' ) {
        tabListContainer.setAttribute('aria-orientation', orientation);
      }

      var tabListWrapper = doc.createElement('div');
      tabListWrapper.classList.add(_options.tabListWrapperClass);

      el.insertBefore(tabListWrapper, el.querySelector(':first-child'));
      tabListWrapper.appendChild(tabListContainer);

      return tabListContainer;
    }; // generateTablistContainer()

    this.getTabList = function () {
      return _tabListContainer;
    }

    this.addTab = function ( panel, label, customClass, atEnd = true, autoActivateTab = false ) {
      var customClass = customClass || panel.getAttribute(_options.customTabClassAttribute);
      var disabled = panel.hasAttribute(_options.disabledAttribute);

      var generateTab = function ( index, id, tabPanel, customClass, atEnd ) {
        var newRichTab = {};
        var newTabWrapper = doc.createElement('div');
        newTabWrapper.classList.add(_options.tabWrapperClass);
        newTabWrapper.setAttribute('role', 'presentation');

        var newTab = doc.createElement('span');
        newTab.id = elID + '_tab_' + index;
        newTab.tabIndex = -1;
        newTab.setAttribute('role', 'tab');
        newTab.setAttribute('aria-selected', activeIndex === index);
        if ( activeIndex === index ) {
          newTab.setAttribute('aria-controls', id);
        }
        newTab.setAttribute('data-controls', id);
        newTab.innerHTML = tabPanel;
        newTab.classList.add(_options.tabClass);
        if ( customClass ) {
          newTab.classList.add(customClass);
        }
        if ( disabled ) {
          newTab.setAttribute('aria-disabled', true);
          newTab.addEventListener('focus', util.preventFocus.bind(this));
        } else {
          newTab.addEventListener('click', function () {
            onClick.call(this);
            this.focus();
            updateUrlHash();
          }, false);

          newTab.addEventListener('focus', function() {
            newTabWrapper.classList.add('focused');
          });

          newTab.addEventListener('blur', function() {
            newTabWrapper.classList.remove('focused');
          });

          newTab.addEventListener('keydown', tabElementPress.bind(this), false);
          //newTab.addEventListener('focus', function () {
          //  checkYoSelf.call(this, index);
          //}, false);
        }

        newTabWrapper.appendChild(newTab);

        newRichTab.tab = newTab;

        if (_options.closeable) {
          var newBtnClose = null;
          newBtnClose = doc.createElement('button');
          newBtnClose.classList.add(_options.btnCloseClass);
          newBtnClose.innerHTML = '<span><svg aria-hidden="true" focusable="false" height="12" width="12"><line x1="2" y1="2" x2="10" y2="10" style="stroke:currentColor; stroke-width:2" /><line x1="2" y1="10" x2="10" y2="2" style="stroke:currentColor; stroke-width:2" /></svg><span class="visually-hidden">' + 'Close tab' + '</span></span>' ;
          newBtnClose.tabIndex = -1;
          newBtnClose.addEventListener('keydown', tabElementPress.bind(this), false);
          newBtnClose.addEventListener('click', function () {
            onClose.call(this);
          }, false);

          if (disabled) {
            newBtnClose.setAttribute('disabled', true);
          }

          newTabWrapper.appendChild(newBtnClose);
          newRichTab.close = newBtnClose;
        }

        newRichTab.tabWrapper = newTabWrapper;
        newRichTab.textLabel = tabPanel;

        return newRichTab;
      };

      var newPanel = panel;
      var i = _tabs.length;

      if ( !newPanel ) {
        return;
      }

      var panelHeading = newPanel.querySelector(headingSelector);
      var finalLabel = [
            label,
            newPanel.getAttribute(_options.tabLabelAttribute),
            panelHeading && panelHeading.textContent,
            _options.defaultTabLabel + (i + 1)
          ]
          .filter( function ( l ) {
            return l && l !== '';
          })[0];

      var newId = newPanel.id || elID + '_panel_' + i;
      var richTab = generateTab(i, newId, finalLabel, customClass);

      if (atEnd) {
        _tabListContainer.append(richTab.tabWrapper);
      } else {
        _tabListContainer.prepend(richTab.tabWrapper);
      }

      newPanel.id = newId;
      newPanel.setAttribute('role', 'tabpanel');
      newPanel.setAttribute('aria-labelledby', elID + '_tab_' + i);
      newPanel.classList.add(_options.panelClass);
      newPanel.hidden = true;

      if ( !el.contains(panel) ) {
        el.appendChild(panel);
      }

      if ( newPanel.getAttribute('id') === util.getUrlHash()) {
        activeIndex = i;
      } else if ( defaultPanel === 0 && newPanel.getAttribute('data-atabs-panel') === 'default' ) {
        activeIndex = i;
        defaultPanel = activeIndex;
      }

      if ( panelHeading ) {
        if ( panelHeading.getAttribute(_options.headingAttribute) !== 'keep' ) {
          panelHeading.parentNode.removeChild(panelHeading);
        }
      }

      if ( !disabled ) {
        newPanel.addEventListener('keydown', panelElementPress.bind(this), false);
        newPanel.addEventListener('blur', removePanelTabindex, false);

        const newTabInfo = {
          id: richTab.tab.id,
          label: richTab.textLabel,
          tabWrapper: richTab.tabWrapper,
          tab: richTab.tab,
          close: richTab.close,
          panel: newPanel
        };

        if (atEnd) {
          _tabs.push(newTabInfo);
        } else {
          _tabs.unshift(newTabInfo);
        }
      }

      if (autoActivateTab) {
        activeIndex = atEnd ? _tabs.length - 1 : 0;
        activateTab();
      }
    }; // this.addTab


    var buildTabs = function () {
      var tabs;

      /**
       * Typically tab panels should be direct children of the main tab widget
       * wrapper.  This is necessary so that the script can appropriately associate
       * each tablist with the appropriate tabpanels, allowing for nested tab widgets.
       *
       * If a wrapper for the tabpanels is necessary, for styling/other reasons, then
       * this if statement will look to see if the appropriate panel wrapper div is in
       * place, and if so, adjust the element used to look for the direct children.
       */
      if ( hasPanelWrapper ) {
        tabs = util.getDirectChildren(hasPanelWrapper, _options.panelSelector);
      }
      else {
        tabs = util.getDirectChildren(el, _options.panelSelector);
      }


      for ( var i = 0; i < tabs.length; i++ ) {
        this.addTab(tabs[i]);
      }
    }; // buildTabs()

    var getTabIndexById = function( id ) {
      return _tabs.findIndex(obj => obj.id == id);
    };

    var deleteTOC = function () {
      if ( el.getAttribute('data-atabs-toc') ) {
        var toc = doc.getElementById(el.getAttribute('data-atabs-toc'));
        // safety check to make sure a TOC isn't set to be deleted
        // after it's already deleted. e.g. if there are two
        // dat-atabs-toc that equal the same ID.
        if ( toc ) {
          toc.parentNode.removeChild(toc);
        }
      }
    }; // deleteTOC()


    var incrementActiveIndex = function ( wrapAround = true ) {
      const indexFirst = 0;
      const indexLast = _tabs.length - 1;
      if ( activeIndex < indexLast) {
        return ++activeIndex;
      }
      else if (wrapAround) {
        activeIndex = indexFirst;
        return activeIndex;
      }
      else {
        return indexLast;
      }
    }; // incrementActiveIndex()


    var decrementActiveIndex = function ( wrapAround = true ) {
      const indexFirst = 0;
      const indexLast = _tabs.length - 1;
      if ( activeIndex > indexFirst ) {
        return --activeIndex;
      }
      else if (wrapAround) {
        activeIndex = indexLast;
        return activeIndex;
      }
      else {
        return indexFirst;
      }
    }; // decrementActiveIndex()


    var focusActiveTab = function () {
      if (undefined !== _tabs[activeIndex]) {
        _tabs[activeIndex].tab.focus();
      }
    }; // focusActiveTab()


    var removeTabAndPanel = function( index ) {

      _tabs[index].panel.remove();
      _tabs[index].tabWrapper.remove();
      _tabs.splice(index, 1);

      // activeIndex = 0;


      if (index >= _tabs.length) {
        decrementActiveIndex(false);
      }

      focusActiveTab();
      activateTab();
      updateUrlHash();

    }; // removeTabAndPanel()

    var onClick = function () {
      activeIndex = getTabIndexById(this.id)
      activateTab();
    }; // onClick()

    var onClose = function () {
      const index = getTabIndexById(this.previousSibling.id)
      removeTabAndPanel(index);
    }; // onClose()


    var moveBack = function ( e ) {
      e.preventDefault();
      decrementActiveIndex();
      focusActiveTab();

      if ( !_options.manual ) {
        activateTab();
        updateUrlHash();
      }
    }; // moveBack()


    var moveNext = function ( e ) {
      e.preventDefault();
      incrementActiveIndex();
      focusActiveTab();

      if ( !_options.manual ) {
        activateTab();
        updateUrlHash();
      }
    }; // moveNext()


    /**
     * A tabpanel is focusable upon hitting the TAB key
     * from a tab within a tablist.  When navigating away
     * from the tabpanel, with the TAB key, remove the
     * tabindex from the tabpanel.
     */
    var panelElementPress = function ( e ) {
      var keyCode = e.keyCode || e.which;

      switch ( keyCode ) {
        case util.keyCodes.TAB:
          removePanelTabindex();
          break;

        default:
          break;
      }
    }; // panelElementPress()


    var removePanelTabindex = function () {
      _tabs[activeIndex].panel.removeAttribute('tabindex');
    }; // removePanelTabindex()


    var tabElementPress = function ( e ) {
      var keyCode = e.keyCode || e.which;
      const canRemove = true;
      const isTab = e.target.classList.contains(_options.tabClass);

      switch ( keyCode ) {
        case util.keyCodes.TAB:
          _tabs[selectedTab].panel.tabIndex = 0;
          activeIndex = selectedTab;
          break;

        case util.keyCodes.ENTER:
        case util.keyCodes.SPACE:
          if (isTab) {
            e.preventDefault();
            activateTab();
            updateUrlHash();
          }
          break;

        case util.keyCodes.LEFT:
        case util.keyCodes.UP:
          moveBack( e );
          break;

        case util.keyCodes.RIGHT:
        case util.keyCodes.DOWN:
          moveNext( e );
          break;

        case util.keyCodes.END:
          e.preventDefault();
          activeIndex = _tabs.length - 1;
          focusActiveTab();
          if ( !_options.manual ) {
            activateTab();
            updateUrlHash();
          }
          break;

        case util.keyCodes.HOME:
          e.preventDefault();
          activeIndex = 0;
          focusActiveTab();
          if ( !_options.manual ) {
            activateTab();
            updateUrlHash();
          }
          break;

        case util.keyCodes.DELETE:
          if ( _tabs.length > 0 && canRemove ) {
            e.preventDefault();
            removeTabAndPanel(activeIndex);
            focusActiveTab();
          }
          break;

        default:
          break;
      }
    }; // tabElementPress()


    /**
     * This function shouldn't exist.  BUT for...
     * https://github.com/nvaccess/nvda/issues/8906
     * https://github.com/FreedomScientific/VFO-standards-support/issues/132
     *
     * Note this doesn't completely fix JAWS announcements.
     * With this function, focus will be placed on the correct Tab,
     * but JAWS will make no announcement until the user begins
     * re-navigating with arrow keys.
     *
     * The alternative is not using this, having JAWS announce the
     * inactive tag (which will receive focus), JAWS will announce
     * to use the Space key to activate, but nothing will happen.
     */
    // sept19-2021 - commenting this out as it causes focus issues with
    // iOS + VoiceOver.
    // var checkYoSelf = function ( index ) {
    //  if ( index !== activeIndex ) {
    //    focusActiveTab();
    //  }
    // }; // checkYoSelf()


    var deactivateTabs = function () {
      for ( var i = 0; i < _tabs.length; i++ ) {
        deactivateTab(i);
      }
    }; // deactivateTabs()


    var deactivateTab = function ( idx ) {
      _tabs[idx].panel.hidden = true;
      _tabs[idx].tab.tabIndex = -1;
      _tabs[idx].tab.setAttribute('aria-selected', false);
      _tabs[idx].tab.removeAttribute('aria-controls');
      _tabs[idx].tabWrapper.classList.remove('selected');

      if (_options.closeable) {
        _tabs[idx].close.tabIndex = -1;
      }
      // remove the aria-controls from inactive tabs since
      // a user can *not* move to their associated element
      // if that element is not displayed.
    }; // deactivateTab()


    /**
     * Update the active Tab and make it focusable.
     * Deactivate any previously active Tab.
     * Reveal active Panel.
     */
    var activateTab = function () {
      var active = _tabs[activeIndex] || _tabs[0];

      if (undefined === active) {
        return null;
      }

      deactivateTabs();
      active.tab.setAttribute('aria-controls', active.tab.getAttribute('data-controls'));
      active.tab.setAttribute('aria-selected', true);
      active.tabWrapper.classList.add('selected');
      active.tab.tabIndex = 0;
      if (_options.closeable) {
        active.close.tabIndex = 0;
      }
      if ( !active.panel.hasAttribute(_options.disabledAttribute) ) {
        active.panel.hidden = false;
      }
      selectedTab = activeIndex;
      return selectedTab;
    }; // activateTab()


    /**
     * Update URL Hash so direct link to the currently open Tab is exposed for copy & paste.
     */
    var updateUrlHash = function () {
      var active = _tabs[activeIndex];

      if (undefined === active) {
        return null;
      }

      util.setUrlHash(active.tab.getAttribute('data-controls'));
    }; // updateUrlHash()


    init.call( this );
    return this;
  }; // ARIAtabs()


  w.ARIAtabs = ARIAtabs;
})( window, document );
