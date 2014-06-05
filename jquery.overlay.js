/*!
 * jQuery.textoverlay.js
 *
 * Repository: https://github.com/yuku-t/jquery-textoverlay
 * License:    MIT
 * Author:     Yuku Takahashi
 */

;
(function ($) {
    'use strict';

    /**
     * Bind the func to the context.
     */
    var bind = function (func, context) {
        if (func.bind) {
            // Use native Function#bind if it's available.
            return func.bind(context);
        } else {
            return function () {
                func.apply(context, arguments);
            };
        }
    };

    /**
     * Get the styles of any element from property names.
     */
    var getStyles = (function () {
        var color;
        color = $('<div></div>').css(['color']).color;
        if (typeof color !== 'undefined') {
            return function ($el, properties) {
                return $el.css(properties);
            };
        } else {  // for jQuery 1.8 or below
            return function ($el, properties) {
                var styles;
                styles = {};
                $.each(properties, function (i, property) {
                    styles[property] = $el.css(property);
                });
                return styles
            };
        }
    })();

    var entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    }

    var entityRegexe = /[&<>"'\/]/g

    /**
     * Function for escaping strings to HTML interpolation.
     */
    var escape = function (str) {
        return str.replace(entityRegexe, function (match) {
            return entityMap[match];
        })
    };

    /**
     * Determine if the array contains a given value.
     */
    var include = function (array, value) {
        var i, l;
        if (array.indexOf) return array.indexOf(value) != -1;
        for (i = 0, l = array.length; i < l; i++) {
            if (array[i] === value) return true;
        }
        return false;
    };

    var Overlay = (function () {
        var html, css, textareaToWrapper, textareaToOverlay, allowedProps;
        html = {
            wrapper: '<div class="textoverlay-wrapper"></div>',
            overlay: '<div class="textoverlay"></div>'
        };

        css = {
            wrapper: {
                margin: 0,
                padding: 0,
                overflow: 'hidden'
            },
            overlay: {
                position: 'absolute',
                color: 'transparent',
                'white-space': 'pre-wrap',
                'word-wrap': 'break-word',
                overflow: 'hidden'
            },
            textarea: {
                background: 'transparent',
                position: 'relative',
                outline: 0
            }
        };

        // CSS properties transport from textarea to wrapper
        textareaToWrapper = ['display'];
        // CSS properties transport from textarea to overlay
        textareaToOverlay = [
            'margin-top',
            'margin-right',
            'margin-bottom',
            'margin-left',
            'padding-top',
            'padding-right',
            'padding-bottom',
            'padding-left',
            'font-family',
            'font-weight',
            'font-size',
            'background-color'
        ];

        function Overlay($textarea, strategies) {
            var $wrapper, position;

            // Setup wrapper element
            position = $textarea.css('position');
            if (position === 'static') position = 'relative';
            $wrapper = $(html.wrapper).css(
                $.extend({}, css.wrapper, getStyles($textarea, textareaToWrapper), {
                    position: position
                })
            );

            // Setup overlay
            this.textareaTop = parseInt($textarea.css('border-top-width'));
            this.$el = $(html.overlay).css(
                $.extend({}, css.overlay, getStyles($textarea, textareaToOverlay), {
                    top: this.textareaTop,
                    right: parseInt($textarea.css('border-right-width')),
                    bottom: parseInt($textarea.css('border-bottom-width')),
                    left: parseInt($textarea.css('border-left-width'))
                })
            );

            // Setup textarea
            this.$textarea = $textarea.css(css.textarea);

            // Render wrapper and overlay
            this.$textarea.wrap($wrapper).before(this.$el);

            // Intercept val method
            // Note that jQuery.fn.val does not trigger any event.
            this.$textarea.origVal = $textarea.val;
            this.$textarea.val = bind(this.val, this);

            // Bind event handlers
            this.$textarea.on('input', bind(this.onInput, this));
            this.$textarea.on('change', bind(this.onInput, this));
            this.$textarea.on('scroll', bind(this.resizeOverlay, this));
            this.$textarea.on('resize', bind(this.resizeOverlay, this));

            // Strategies must be an array
            this.strategies = $.isArray(strategies) ? strategies : [strategies];

            // Render the text for the first time
            this.renderTextOnOverlay();
        }

        $.extend(Overlay.prototype, {

            val: function (value) {
                return value == null ? this.$textarea.origVal() : this.setVal(value);
            },

            setVal: function (value) {
                this.$textarea.origVal(value);
                this.renderTextOnOverlay();
                return this.$textarea;
            },

            onInput: function (e) {
                this.renderTextOnOverlay();
            },

            replaceNthMatch: function (original, pattern, n, replace) {
                var parts, tempParts;
                if (pattern.constructor === RegExp) {

                    // If there's no match, bail
                    if (original.search(pattern) === -1) {
                        return original;
                    }

                    // Every other item should be a matched capture group;
                    // between will be non-matching portions of the substring
                    parts = original.split(pattern);

                    // If there was a capture group, index 1 will be
                    // an item that matches the RegExp
                    if (parts[1].search(pattern) !== 0) {
                        throw {name: "ArgumentError", message: "RegExp must have a capture group"};
                    }

                } else if (pattern.constructor === String) {
                    parts = original.split(pattern);
                    // Need every other item to be the matched string
                    tempParts = [];

                    for (var i = 0; i < parts.length; i++) {
                        tempParts.push(parts[i]);

                        // Insert between, but don't tack one onto the end
                        if (i < parts.length - 1) {
                            tempParts.push(pattern);
                        }
                    }
                    parts = tempParts;
                } else {
                    throw {name: "ArgumentError", message: "Must provide either a RegExp or String"};
                }

                // Parens are unnecessary, but explicit. :)
                var indexOfNthMatch = (n * 2) - 1;

                if (parts[indexOfNthMatch] === undefined) {
                    // There IS no Nth match
                    return original;
                }

                if (typeof(replace) === "function") {
                    // Call it. After this, we don't need it anymore.
                    replace = replace(parts[indexOfNthMatch]);
                }

                // Update our parts array with the new value
                parts[indexOfNthMatch] = replace;

                // Put it back together and return
                return parts.join('');

            },

            getPreviousTags: function() {

                // Grab the previous tags from the highlighted area
                var previousTags = [];
                var tags = this.$el.find('.tag');
                for (var i = 0; i < tags.length; i++) {
                    var $tag = tags[i];
                    if ($tag.hasClass('tag')) {
                        previousTags.push($tag);
                    }
                }
                return previousTags;

            },

            renderTextOnOverlay: function () {

                // Detect if the new change to the text area was because of us
                if (this.ourChange) {

                    // Okay, skip the highlighting this time around
                    this.ourChange = false;

                } else {

                    console.log("Previous Tags:");
                    console.log(this.getPreviousTags());

                    var text, i, l, strategy, match, style;
                    text = escape(this.$textarea.val());

                    // Apply all strategies for highlighting
                    for (i = 0, l = this.strategies.length; i < l; i++) {

                        strategy = this.strategies[i];
                        match = strategy.match;
                        if ($.isArray(match)) {
                            match = $.map(match, function (str) {
                                return str.replace(/(\(|\)|\|)/g, '\$1');
                            });
                            match = new RegExp('(' + match.join('|') + ')', 'g');
                        }

                        // Style the things that we want to highlight
                        style = 'background-color:' + strategy.css['background-color'];
                        text = text.replace(match, function (str) {
                            str = str.replace(strategy.match, strategy.replace);
                            var friendlyStr = str.toLowerCase().replace(" ", "");
                            return '<span data-tag="' + friendlyStr + '" class="highlighted tag" style="' + style + '">' + str + '</span>';
                        });

                    }

                    // Notify that the change is ours and replace the text where needed...
                    this.ourChange = true;
                    this.$textarea.val(this.$textarea.val().replace(strategy.match, strategy.replace));


                    this.$el.html(text);
                }
                return this;
            },

            resizeOverlay: function () {
                this.$el.css({ top: this.textareaTop - this.$textarea.scrollTop() });
            }
        });

        return Overlay;

    })();

    $.fn.overlay = function (options) {
        new Overlay(this, options);
        return this;
    };

})(window.jQuery);
