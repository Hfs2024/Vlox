// Validators
const isString = str => typeof str === "string";
const isNullOrUndefined = data => data === null || data === undefined;
const isFunction = fn => typeof fn === "function";
const isObject = obj => Object.prototype.toString.call(obj) === "[object Object]";

// Wrapper
function NS(selector) {
  return new NS.prototype.init(selector);
}

// Methods
NS.prototype = {
  constructor: NS,
  
  // Accessors
  css: function (prop, value) {
    if (isString(prop)) {
      for (let el of this.elements) {
        el.style[prop] = value;
      }
    } else if (isObject(prop)) {
      for (let el of this.elements)
        for (let key in prop) el.style[key] = prop[key];
    }

    return this;
  },

  html: function (content) {
    if (isNullOrUndefined(content)) return this.elements[0]?.innerHTML || "";
    for (let el of this.elements) el.innerHTML = content;
    return this;
  },

  text: function (txt) {
    if (isNullOrUndefined(txt)) return this.elements[0]?.textContent || "";
    for (let el of this.elements) el.textContent = txt;
    return this;
  },

  value: function (val) {
    if (isNullOrUndefined(val)) return this.elements[0]?.value || "";
    for (let el of this.elements) el.value = val;
    return this;
  },

  // Element Actions
  each: function (cb) {
    this.elements.forEach((elements, index) => {
      cb(elements, index);
    });

    return this;
  },

  focus: function (index = 0) {
    if (Number.isInteger(index)) this.elements[index]?.focus(); // An index is needed here because you can't focus two elements at the same time
    return this;
  },

  remove: function () {
    for (let el of this.elements) el.remove();
    return this;
  },

  click: function () {
    for (let el of this.elements) el?.click();
    return this;
  },

  // Selectors
  get: function (selector) {
    const el = this.elements[0]?.querySelector(selector);
    return el ? NS(el) : null;
  },

  getAll: function (selector) {
    const els = this.elements[0]?.querySelectorAll(selector);
    return NS(els);
  },

  // Events
  on: function (event, callback) {
    if (!isString(event) || !isFunction(callback)) throw new TypeError("Expected a string event and a callback function");
    for (let el of this.elements) el.addEventListener(event, callback);
    return this;
  },

  off: function (event, callback) {
    if (!isString(event) || !isFunction(callback)) throw new TypeError("Expected a string event and a callback function");
    for (let el of this.elements) el.removeEventListener(event, callback);
    return this;
  },

  // Attributes 
  attr: function (name, value) {
    if (isNullOrUndefined(value)) return this.elements[0]?.getAttribute(name);
    for (let el of this.elements) el?.setAttribute(name, value);
    return this;
  },

  removeAttr: function (name) {
    for (let el of this.elements) el?.removeAttribute(name);
    return this;
  },

  // Classes
  addClass: function (className) {
    for (let el of this.elements) el?.classList?.add(className);
    return this;
  },

  removeClass: function (className) {
    for (let el of this.elements) el?.classList?.remove(className);
    return this;
  },

  toggleClass: function (className) {
    for (let el of this.elements) el?.classList?.toggle(className);
    return this;
  },

  hasClass: function (className) {
    return this.elements.some(el => el?.classList?.contains(className));
  },

  replaceClass: function (oldClass, newClass) {
    for (let el of this.elements) el?.classList?.replace(oldClass, newClass);
    return this;
  }
}

NS.ready = function (fn) {
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn);
}

NS.createEl = function (tag, target, props = {}) {
  if (!isString(tag) || !isObject(props)) throw new TypeError("Expected a string tag and object props");

  // Locate target
  target = target?.elements ? target.elements[0] : target;
  if (!(target instanceof HTMLElement)) throw new Error("Target must be a valid HTML element");

  // Create element
  const el = document.createElement(tag);

  // Add props
  for (let key in props) el[key] = props[key];

  // Append
  target.appendChild(el);

  // Return element
  return NS(el);
}

// Selector engine
NS.prototype.init = function (selector) {
  if (isString(selector)) {
    try {
      this.elements = [...document.querySelectorAll(selector)];
    } catch {
      throw new TypeError("Invalid NS selector");
    }
  } else if (selector instanceof NodeList || selector instanceof HTMLCollection) {
    this.elements = [...selector];
  } else if (selector instanceof Element) {
    this.elements = [selector];
  } else {
    this.elements = [];
  }

  return this;
}

// Attach the methods
NS.prototype.init.prototype = NS.prototype;

// Export
export default NS;