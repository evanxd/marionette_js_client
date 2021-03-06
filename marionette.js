;!function(exports, undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {
      
      this._conf = conf;
      
      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }
    
    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }
        
        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
    
    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;
            
            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              console.trace();
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  };

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    };

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {
    
    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {
      
      if (!this._all && 
        !this._events.error && 
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || this._all;
    }
    else {
      return this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {
    
    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;
        
        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          console.trace();
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if(!this._all) {
      this._all = [];
    }

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          return this;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1)
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
    define(function() {
      return EventEmitter;
    });
  } else {
    exports.EventEmitter2 = EventEmitter; 
  }

}(typeof process !== 'undefined' && typeof process.title !== 'undefined' && typeof exports !== 'undefined' ? exports : window);
(function(global, exports) {
  var HAS_BUFFER = typeof Buffer !== 'undefined';

  var SEPERATOR_CODE = 58; // UTF8 / ASCII value for :
  var SEPERATOR = ':';
  var EventEmitter =
    global.EventEmitter2 ||
    require('eventemitter2').EventEmitter2;

  /**
   * First ocurrence of where string occurs in a buffer.
   *
   * NOTE: this is not UTF8 safe generally we expect to find the correct
   * char fairly quickly unless the buffer is incorrectly formatted.
   *
   * @param {Buffer} buffer haystack.
   * @param {String} string needle.
   * @return {Numeric} -1 if not found index otherwise.
   */
  function indexInBuffer(buffer, string) {
    if (typeof buffer === 'string')
      return buffer.indexOf(string);

    if (buffer.length === 0)
      return -1;

    var index = 0;
    var length = buffer.length;

    do {
      if (buffer[index] === SEPERATOR_CODE)
        return index;

    } while(
      ++index && index + 1 < length
    );

    return -1;
  }

  /**
   * Wrapper for creating either a buffer or ArrayBuffer.
   */
  function createByteContainer() {
    if (HAS_BUFFER)
      return new Buffer(0);

    return new Uint8Array();
  }

  /**
   * Join the contents of byte container a and b returning c.
   */
  function concatByteContainers(a, b) {
    if (HAS_BUFFER)
      return Buffer.concat([a, b]);

    // make sure everything is unit8
    if (a instanceof ArrayBuffer)
      a = new Uint8Array(a);

    if (b instanceof ArrayBuffer)
      b = new Uint8Array(b);

    // sizes of originals
    var aLen = a.length;
    var bLen = b.length;

    var array = new Uint8Array(aLen + bLen);
    array.set(a);
    array.set(b, aLen);

    // return new byte container
    return array;
  }

  function sliceByteContainers(container, start, end) {
    start = start || 0;
    end = end || byteLength(container);

    if (HAS_BUFFER)
      return container.slice(start, end);

    return container.subarray(start, end);
  }

  /**
   * Like Buffer.byteLength but works on ArrayBuffers too.
   */
  function byteLength(input) {
    if (typeof input === 'string') {
      if (HAS_BUFFER) {
        return Buffer.byteLength(input);
      }
      var encoder = new TextEncoder();
      var out = encoder.encode(input);
      return out.length;
    }

    return input.length;
  }

  function bytesToUtf8(container, start, end) {
    if (!start)
      start = 0;

    if (!end)
      end = byteLength(container);

    if (HAS_BUFFER)
      return container.toString('utf8', start, end);

    var decoder = new TextDecoder();
    var array = container.subarray(start, end);

    return decoder.decode(array);
  }

  /**
   * converts an object to a string representation suitable for storage on disk.
   * Its very important to note that the length in the string refers to the utf8
   * size of the json content in bytes (as utf8) not the JS string length.
   *
   * @param {Object} object to stringify.
   * @return {String} serialized object.
   */
  function stringify(object) {
    var json = JSON.stringify(object);
    var len = byteLength(json);

    return len + SEPERATOR + json;
  }

  /**
   * attempts to parse a given buffer or string.
   *
   * @param {Uint8Array|Buffer} input in byteLength:{json..} format
   * @return {Objec} JS object.
   */
  function parse(input) {
    var stream = new Stream();
    var result;

    stream.once('data', function(data) {
      result = data;
    });

    stream.write(input);

    if (!result) {
      throw new Error(
        'no command available from parsing:' + input
      );
    }

    return result;
  }

  function Stream() {
    EventEmitter.call(this);

    this._pendingLength = null;

    // zero length buffer so we can concat later
    // this is always a unit8 array or a buffer.
    this._buffer = createByteContainer();
  }

  Stream.prototype = {
    __proto__: EventEmitter.prototype,

    _findLength: function() {
      if (this._pendingLength === null) {
        var idx = indexInBuffer(this._buffer, SEPERATOR);
        if (idx === -1)
          return;

        // mark the length to read out of the rolling buffer.
        this._pendingLength = parseInt(
          bytesToUtf8(this._buffer, 0, idx),
          10
        );


        this._buffer = sliceByteContainers(this._buffer, idx + 1);
      }
    },

    _readBuffer: function() {
      // if the buffer.length is < then we pendingLength need to buffer
      // more data.
      if (!this._pendingLength || this._buffer.length < this._pendingLength)
        return false;

      // extract remainder and parse json
      var message = sliceByteContainers(this._buffer, 0, this._pendingLength);
      this._buffer = sliceByteContainers(this._buffer, this._pendingLength);
      this._pendingLength = null;

      var result;
      try {
        message = bytesToUtf8(message);
        result = JSON.parse(message);
      } catch (e) {
        this.emit('error', e);
        return false;
      }

      this.emit('data', result);
      return true;
    },

    write: function (buffer) {
      // append new buffer to whatever we have.
      this._buffer = concatByteContainers(this._buffer, buffer);

      do {
        // attempt to find length of next message.
        this._findLength();
      } while (
        // keep repeating while there are messages
        this._readBuffer()
      );
    }
  };

  exports.parse = parse;
  exports.stringify = stringify;
  exports.Stream = Stream;
}).apply(
  null,
  typeof window === 'undefined' ?
    [global, module.exports] :
    [window, window.jsonWireProtocol = {}]
)
;!function(exports, undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {
      
      this._conf = conf;
      
      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }
    
    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }
        
        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
    
    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;
            
            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              console.trace();
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  };

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    };

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {
    
    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {
      
      if (!this._all && 
        !this._events.error && 
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || this._all;
    }
    else {
      return this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {
    
    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;
        
        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          console.trace();
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if(!this._all) {
      this._all = [];
    }

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          return this;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1)
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
    define(function() {
      return EventEmitter;
    });
  } else {
    exports.EventEmitter2 = EventEmitter; 
  }

}(typeof process !== 'undefined' && typeof process.title !== 'undefined' && typeof exports !== 'undefined' ? exports : window);
(function(global, exports) {
  var HAS_BUFFER = typeof Buffer !== 'undefined';

  var SEPERATOR_CODE = 58; // UTF8 / ASCII value for :
  var SEPERATOR = ':';
  var EventEmitter =
    global.EventEmitter2 ||
    require('eventemitter2').EventEmitter2;

  /**
   * First ocurrence of where string occurs in a buffer.
   *
   * NOTE: this is not UTF8 safe generally we expect to find the correct
   * char fairly quickly unless the buffer is incorrectly formatted.
   *
   * @param {Buffer} buffer haystack.
   * @param {String} string needle.
   * @return {Numeric} -1 if not found index otherwise.
   */
  function indexInBuffer(buffer, string) {
    if (typeof buffer === 'string')
      return buffer.indexOf(string);

    if (buffer.length === 0)
      return -1;

    var index = 0;
    var length = buffer.length;

    do {
      if (buffer[index] === SEPERATOR_CODE)
        return index;

    } while (
      ++index && index + 1 < length
    );

    return -1;
  }

  /**
   * Wrapper for creating either a buffer or ArrayBuffer.
   */
  function createByteContainer() {
    if (HAS_BUFFER)
      return new Buffer(0);

    return new Uint8Array();
  }

  /**
   * Join the contents of byte container a and b returning c.
   */
  function concatByteContainers(a, b) {
    if (HAS_BUFFER)
      return Buffer.concat([a, b]);

    // make sure everything is unit8
    if (a instanceof ArrayBuffer)
      a = new Uint8Array(a);

    if (b instanceof ArrayBuffer)
      b = new Uint8Array(b);

    // sizes of originals
    var aLen = a.length;
    var bLen = b.length;

    var array = new Uint8Array(aLen + bLen);
    array.set(a);
    array.set(b, aLen);

    // return new byte container
    return array;
  }

  function sliceByteContainers(container, start, end) {
    start = start || 0;
    end = end || byteLength(container);

    if (HAS_BUFFER)
      return container.slice(start, end);

    return container.subarray(start, end);
  }

  /**
   * Like Buffer.byteLength but works on ArrayBuffers too.
   */
  function byteLength(input) {
    if (typeof input === 'string') {
      if (HAS_BUFFER) {
        return Buffer.byteLength(input);
      }
      var encoder = new TextEncoder();
      var out = encoder.encode(input);
      return out.length;
    }

    return input.length;
  }

  function bytesToUtf8(container, start, end) {
    if (!start)
      start = 0;

    if (!end)
      end = byteLength(container);

    if (HAS_BUFFER)
      return container.toString('utf8', start, end);

    var decoder = new TextDecoder();
    var array = container.subarray(start, end);

    return decoder.decode(array);
  }

  /**
   * converts an object to a string representation suitable for storage on disk.
   * Its very important to note that the length in the string refers to the utf8
   * size of the json content in bytes (as utf8) not the JS string length.
   *
   * @param {Object} object to stringify.
   * @return {String} serialized object.
   */
  function stringify(object) {
    var json = JSON.stringify(object);
    var len = byteLength(json);

    return len + SEPERATOR + json;
  }

  /**
   * attempts to parse a given buffer or string.
   *
   * @param {Uint8Array|Buffer} input in byteLength:{json..} format.
   * @return {Objec} JS object.
   */
  function parse(input) {
    var stream = new Stream();
    var result;

    stream.once('data', function(data) {
      result = data;
    });

    stream.write(input);

    if (!result) {
      throw new Error(
        'no command available from parsing:' + input
      );
    }

    return result;
  }

  function Stream() {
    EventEmitter.call(this);

    this._pendingLength = null;

    // zero length buffer so we can concat later
    // this is always a unit8 array or a buffer.
    this._buffer = createByteContainer();
  }

  Stream.prototype = {
    __proto__: EventEmitter.prototype,

    _findLength: function() {
      if (this._pendingLength === null) {
        var idx = indexInBuffer(this._buffer, SEPERATOR);
        if (idx === -1)
          return;

        // mark the length to read out of the rolling buffer.
        this._pendingLength = parseInt(
          bytesToUtf8(this._buffer, 0, idx),
          10
        );


        this._buffer = sliceByteContainers(this._buffer, idx + 1);
      }
    },

    _readBuffer: function() {
      // if the buffer.length is < then we pendingLength need to buffer
      // more data.
      if (!this._pendingLength || this._buffer.length < this._pendingLength)
        return false;

      // extract remainder and parse json
      var message = sliceByteContainers(this._buffer, 0, this._pendingLength);
      this._buffer = sliceByteContainers(this._buffer, this._pendingLength);
      this._pendingLength = null;

      var result;
      try {
        message = bytesToUtf8(message);
        result = JSON.parse(message);
      } catch (e) {
        this.emit('error', e);
        return false;
      }

      this.emit('data', result);
      return true;
    },

    write: function(buffer) {
      // append new buffer to whatever we have.
      this._buffer = concatByteContainers(this._buffer, buffer);

      do {
        // attempt to find length of next message.
        this._findLength();
      } while (
        // keep repeating while there are messages
        this._readBuffer()
      );
    }
  };

  exports.parse = parse;
  exports.stringify = stringify;
  exports.Stream = Stream;
}).apply(
  null,
  typeof window === 'undefined' ?
    [global, module.exports] :
    [window, window.jsonWireProtocol = {}]
);

(function(global, module) {

  /**
   * Define a list of paths
   * this will only be used in the browser.
   */
  var paths = {};


  /**
   * Exports object is a shim
   * we use in the browser to
   * create an object that will behave much
   * like module.exports
   */
  function Exports(path) {
    this.path = path;
  }

  Exports.prototype = {

    /**
     * Unified require between browser/node.
     * Path is relative to this file so you
     * will want to use it like this from any depth.
     *
     *
     *   var Leaf = ns.require('sub/leaf');
     *
     *
     * @param {String} path path lookup relative to this file.
     */
    require: function exportRequire(path) {
      if (typeof(window) === 'undefined') {
        return require(require('path').join(__dirname, path));
      } else {
        return paths[path];
      }
    },

    /**
     * Maps exports to a file path.
     */
    set exports(val) {
      return paths[this.path] = val;
    },

    get exports() {
      return paths[this.path];
    }
  };

  /**
   * Module object constructor.
   *
   *
   *    var module = Module('sub/leaf');
   *    module.exports = function Leaf(){}
   *
   *
   * @constructor
   * @param {String} path file path.
   */
  function Module(path) {
    return new Exports(path);
  }

  Module.require = Exports.prototype.require;
  Module.exports = Module;
  Module._paths = paths;


  /**
   * Reference self as exports
   * which also happens to be the constructor
   * so you can assign items to the namespace:
   *
   *    //assign to Module.X
   *    //assume module.exports is Module
   *    module.exports.X = Foo; //Module.X === Foo;
   *    Module.exports('foo'); //creates module.exports object.
   *
   */
  module.exports = Module;

  /**
   * In the browser assign
   * to a global namespace
   * obviously 'Module' would
   * be whatever your global namespace is.
   */
  if (this.window)
    window.Marionette = Module;

}(
  this,
  (typeof(module) === 'undefined') ?
    {} :
    module
));
(function(module, ns) {
  'use strict';

  /**
   * Constructor
   *
   * @param {Object} list of events to add onto responder.
   */
  function Responder(events) {
    this._$events = {};

    if (typeof(events) !== 'undefined') {
      this.addEventListener(events);
    }
  };

  /**
   * Stringifies request to websocket
   *
   *
   * @param {String} command command name.
   * @param {Object} data object to be sent over the wire.
   * @return {String} json object.
   */
  Responder.stringify = function stringify(command, data) {
    return JSON.stringify([command, data]);
  };

  /**
   * Parses request from WebSocket.
   *
   * @param {String} json json string to translate.
   * @return {Object} ex: { event: 'test', data: {} }.
   */
  Responder.parse = function parse(json) {
    var data;
    try {
      data = (json.forEach) ? json : JSON.parse(json);
    } catch (e) {
      throw new Error("Could not parse json: '" + json + '"');
    }

    return {event: data[0], data: data[1]};
  };

  Responder.prototype = {
    parse: Responder.parse,
    stringify: Responder.stringify,

    /**
     * Events on this instance
     *
     * @type Object
     */
    _$events: null,

    /**
     * Recieves json string event and dispatches an event.
     *
     * @param {String|Object} json data object to respond to.
     * @param {String} json.event event to emit.
     * @param {Object} json.data data to emit with event.
     * @param {Object} [params] option number of params to pass to emit.
     * @return {Object} result of WebSocketCommon.parse.
     */
    respond: function respond(json) {
      var event = Responder.parse(json),
          args = Array.prototype.slice.call(arguments).slice(1);

      args.unshift(event.data);
      args.unshift(event.event);

      this.emit.apply(this, args);

      return event;
    },

    //TODO: Extract event emitter logic

    /**
     * Adds an event listener to this object.
     *
     *
     * @param {String} type event name.
     * @param {Function} callback event callback.
     */
    addEventListener: function addEventListener(type, callback) {
      var event;

      if (typeof(callback) === 'undefined' && typeof(type) === 'object') {
        for (event in type) {
          if (type.hasOwnProperty(event)) {
            this.addEventListener(event, type[event]);
          }
        }

        return this;
      }

      if (!(type in this._$events)) {
        this._$events[type] = [];
      }

      this._$events[type].push(callback);

      return this;
    },

    /**
     * Adds an event listener which will
     * only fire once and then remove itself.
     *
     *
     * @param {String} type event name.
     * @param {Function} callback fired when event is emitted.
     */
    once: function once(type, callback) {
      var self = this;
      function onceCb() {
        self.removeEventListener(type, onceCb);
        callback.apply(this, arguments);
      }

      this.addEventListener(type, onceCb);

      return this;
    },

    /**
     * Emits an event.
     *
     * Accepts any number of additional arguments to pass unto
     * event listener.
     *
     * @param {String} eventName name of the event to emit.
     * @param {Object} [arguments] additional arguments to pass.
     */
    emit: function emit() {
      var args = Array.prototype.slice.call(arguments),
          event = args.shift(),
          eventList,
          self = this;

      if (event in this._$events) {
        eventList = this._$events[event];

        eventList.forEach(function(callback) {
          callback.apply(self, args);
        });
      }

      return this;
    },

    /**
     * Removes all event listeners for a given event type
     *
     *
     * @param {String} event event type to remove.
     */
    removeAllEventListeners: function removeAllEventListeners(name) {
      if (name in this._$events) {
        //reuse array
        this._$events[name].length = 0;
      }

      return this;
    },

    /**
     * Removes a single event listener from a given event type
     * and callback function.
     *
     *
     * @param {String} eventName event name.
     * @param {Function} callback same instance of event handler.
     */
    removeEventListener: function removeEventListener(name, callback) {
      var i, length, events;

      if (!(name in this._$events)) {
        return false;
      }

      events = this._$events[name];

      for (i = 0, length = events.length; i < length; i++) {
        if (events[i] && events[i] === callback) {
          events.splice(i, 1);
          return true;
        }
      }

      return false;
    }

  };

  Responder.prototype.on = Responder.prototype.addEventListener;
  Responder.prototype.removeListener = Responder.prototype.removeEventListener;

  module.exports = Responder;

}.apply(
  this,
  (this.Marionette) ?
    [Marionette('responder'), Marionette] :
    [module, require('../../lib/marionette/marionette')]
));


(function(module, ns) {

  var code, errorCodes, Err = {};

  Err.codes = errorCodes = {
   7: 'NoSuchElement',
   8: 'NoSuchFrame',
   9: 'UnknownCommand',
   10: 'StaleElementReference',
   11: 'ElementNotVisible',
   12: 'InvalidElementState',
   13: 'UnknownError',
   15: 'ElementIsNotSelectable',
   17: 'JavaScriptError',
   19: 'XPathLookupError',
   21: 'Timeout',
   23: 'NoSuchWindow',
   24: 'InvalidCookieDomain',
   25: 'UnableToSetCookie',
   26: 'UnexpectedAlertOpen',
   27: 'NoAlertOpenError',
   28: 'ScriptTimeout',
   29: 'InvalidElementCoordinates',
   30: 'IMENotAvailable',
   31: 'IMEEngineActivationFailed',
   32: 'InvalidSelector',
   500: 'GenericError'
  };

  Err.Exception = Error;
  //used over Object.create intentionally
  Err.Exception.prototype = new Error();

  for (code in errorCodes) {
    (function(code) {
      Err[errorCodes[code]] = function(obj) {
        var message = '',
            err = new Error();

        if (obj.status) {
          message += '(' + obj.status + ') ';
        }

        message += (obj.message || '');
        message += '\nRemote Stack:\n';
        message += obj.stacktrace || '<none>';

        this.message = message;
        this.type = errorCodes[code];
        this.name = this.type;
        this.fileName = err.fileName;
        this.lineNumber = err.lineNumber;

        if (err.stack) {
          // remove one stack level:
          if (typeof(Components) != 'undefined') {
            // Mozilla:
            this.stack = err.stack.substring(err.stack.indexOf('\n') + 1);
          } else if ((typeof(chrome) != 'undefined') ||
                     (typeof(process) != 'undefined')) {
            // Google Chrome/Node.js:
            this.stack = err.stack.replace(/\n[^\n]*/, '');
          } else {
            this.stack = err.stack;
          }
        }
      }
      Err[errorCodes[code]].prototype = new Err.Exception();
    }(code));
  }

  /**
   * Returns an error object given
   * a error object from the marionette client.
   * Expected input follows this format:
   *
   * Codes are from:
   * http://code.google.com/p/selenium/wiki/JsonWireProtocol#Response_Status_Codes
   *
   *    {
   *      message: "Something",
   *      stacktrace: "wentwrong@line",
   *      status: 17
   *    }
   *
   * @param {Object} obj remote error object.
   */
  Err.error = function exception(obj) {
    if (obj instanceof Err.Exception) {
      return obj;
    }

    if (obj.status in errorCodes) {
      return new Err[errorCodes[obj.status]](obj);
    } else {
      if (obj.message || obj.stacktrace) {
        return new Err.GenericError(obj);
      }
      return obj;
    }
  }

  module.exports = Err;

}.apply(
  this,
  (this.Marionette) ?
    [Marionette('error'), Marionette] :
    [module, require('./marionette')]
));
/**
@namespace
*/
(function(module, ns) {
  var Native;

  if (typeof(window) === 'undefined') {
    Native = require('../XMLHttpRequest').XMLHttpRequest;
  } else {
    Native = window.XMLHttpRequest;
  }

  /**
   * Creates a XHR wrapper.
   * Depending on the platform this is loaded
   * from the correct wrapper type will be used.
   *
   * Options are derived from properties on the prototype.
   * See each property for its default value.
   *
   * @class
   * @name Marionette.Xhr
   * @param {Object} options options for xhr.
   * @param {String} [options.method="GET"] any HTTP verb like 'GET' or 'POST'.
   * @param {Boolean} [options.async] false will indicate
   *                   a synchronous request.
   * @param {Object} [options.headers] full of http headers.
   * @param {Object} [options.data] post data.
   */
  function Xhr(options) {
    var key;
    if (typeof(options) === 'undefined') {
      options = {};
    }

    for (key in options) {
      if (options.hasOwnProperty(key)) {
        this[key] = options[key];
      }
    }
  }

  Xhr.prototype = {
    /** @scope Marionette.Xhr.prototype */

    xhrClass: Native,
    method: 'GET',
    async: true,
    waiting: false,

    headers: {
      'Content-Type': 'application/json'
    },
    data: {},

    _seralize: function _seralize() {
      if (this.headers['Content-Type'] === 'application/json') {
        return JSON.stringify(this.data);
      }
      return this.data;
    },

    /**
     * Aborts request if its in progress.
     */
    abort: function abort() {
      if (this.xhr) {
        this.xhr.abort();
      }
    },

    /**
     * Sends request to server.
     *
     * @param {Function} callback success/failure handler.
     */
    send: function send(callback) {
      var header, xhr;

      if (typeof(callback) === 'undefined') {
        callback = this.callback;
      }

      xhr = this.xhr = new this.xhrClass();
      xhr.open(this.method, this.url, this.async);

      for (header in this.headers) {
        if (this.headers.hasOwnProperty(header)) {
          xhr.setRequestHeader(header, this.headers[header]);
        }
      }

      xhr.onreadystatechange = function onReadyStateChange() {
        var data, type;
        if (xhr.readyState === 4) {
          data = xhr.responseText;
          type = xhr.getResponseHeader('content-type');
          type = type || xhr.getResponseHeader('Content-Type');
          if (type === 'application/json') {
            data = JSON.parse(data);
          }
          this.waiting = false;
          callback(data, xhr);
        }
      }.bind(this);

      this.waiting = true;
      return xhr.send(this._seralize());
    }
  };

  module.exports = Xhr;

}.apply(
  this,
  (this.Marionette) ?
    [Marionette('xhr'), Marionette] :
    [module, require('./marionette')]
));
(function(module, ns) {

  var debug = function() {};
  var Responder = ns.require('responder');

  var isNode = typeof(window) === 'undefined';
  var isXpc = !isNode && (typeof(window.xpcModule) !== 'undefined');
  var wire;

  if (isNode) {
    debug = require('debug')('marionette:command-stream');
    wire = require('json-wire-protocol');
  } else {
    wire = window.jsonWireProtocol;
  }

  if (isXpc) {
    debug = window.xpcModule.require('debug')('marionette:command-stream');
  }

  /**
   * Command stream accepts a socket or any event
   * emitter that will emit data events
   *
   * @class Marionette.CommandStream
   * @param {EventEmitter} socket socket instance.
   * @constructor
   */
  function CommandStream(socket) {
    this.socket = socket;
    this._handler = new wire.Stream();

    this._handler.on('data', this.emit.bind(this, this.commandEvent));

    Responder.apply(this);

    socket.on('data', this._handler.write.bind(this._handler));
    socket.on('error', function() {
      console.log(arguments);
    });
  }

  var proto = CommandStream.prototype = Object.create(
    Responder.prototype
  );

  /**
   * name of the event this class
   * will emit when a response to a
   * command is received.
   *
   * @property commandEvent
   * @type String
   */
  proto.commandEvent = 'command';

  /**
   * Parses command into a string to
   * be sent over a tcp socket to marionette.
   *
   *
   * @method stringify
   * @param {Object} command marionette command.
   * @return {String} command as a string.
   */
  proto.stringify = function stringify(command) {
    return wire.stringify(command);
  };

  /**
   * Writes a command to the socket.
   * Handles conversion and formatting of object.
   *
   * @method send
   * @param {Object} data marionette command.
   */
  proto.send = function send(data) {
    debug('writing ', data, 'to socket');
    if (this.socket.write) {
      //nodejs socket
      this.socket.write(this.stringify(data), 'utf8');
    } else {
      //moztcp socket
      this.socket.send(this.stringify(data));
    }
  };

  /**
   * Adds a chunk (string or buffer) to the
   * total buffer of this instance.
   *
   * @this
   * @param {String|Buffer} buffer buffer or string to add.
   */
  proto.add = function add(buffer) {
    this._handler.write(buffer);
  };

  module.exports = exports = CommandStream;

}.apply(
  this,
  (this.Marionette) ?
    [Marionette('command-stream'), Marionette] :
    [module, require('./marionette')]
));
/**
@namespace
*/
(function(module, ns) {

  /**
   * Creates an element reference
   * based on an id and a client instance.
   * You should never need to manually create
   * an instance of element.
   *
   * Use {{#crossLink "Marionette.Client/findElement"}}{{/crossLink}} or
   * {{#crossLink "Marionette.Client/findElements"}}{{/crossLink}} to create
   * instance(s) of this class.
   *
   * @class Marionette.Element
   * @param {String} id id of element.
   * @param {Marionette.Client} client client instance.
   */
  function Element(id, client) {
    this.id = id;
    this.client = client;
  }

  Element.prototype = {
    /**
     * Sends remote command processes the result.
     * Appends element id to each command.
     *
     * @method _sendCommand
     * @chainable
     * @private
     * @param {Object} command marionette request.
     * @param {String} responseKey key in the response to pass to callback.
     * @param {Function} callback callback function receives the result of
     *                            response[responseKey] as its first argument.
     *
     * @return {Object} self.
     */
    _sendCommand: function(command, responseKey, callback) {
      if (!command.element) {
        command.element = this.id;
      }

      this.client._sendCommand(command, responseKey, callback);
      return this;
    },

    /**
     * Finds a single child of this element.
     *
     * @method findElement
     * @param {String} query search string.
     * @param {String} method search method.
     * @param {Function} callback element callback.
     * @return {Object} self.
     */
    findElement: function findElement(query, method, callback) {
      this.client.findElement(query, method, this.id, callback);
      return this;
    },

    /**
     * Finds a all children of this element that match a pattern.
     *
     * @method findElements
     * @param {String} query search string.
     * @param {String} method search method.
     * @param {Function} callback element callback.
     * @return {Object} self.
     */
    findElements: function findElement(query, method, callback) {
      this.client.findElements(query, method, this.id, callback);
      return this;
    },

    /**
     * Shortcut method to execute
     * a function with this element as first argument.
     *
     *
     * @method scriptWith
     * @param {Function|String} script remote script.
     * @param {Function} callback callback when script completes.
     */
    scriptWith: function scriptWith(script, callback) {
      this.client.executeScript(script, [this], callback);
    },

    /**
     * Checks to see if two elements are equal
     *
     * @method equals
     * @param {String|Marionette.Element} element element to test.
     * @param {Function} callback called with boolean.
     * @return {Object} self.
     */
    equals: function equals(element, callback) {

      if (element instanceof this.constructor) {
        element = element.id;
      }

      var cmd = {
        type: 'elementsEqual',
        elements: [this.id, element]
      };
      this.client._sendCommand(cmd, 'value', callback);
      return this;
    },

    /**
     * Gets attribute value for element.
     *
     * @method getAttribute
     * @param {String} attr attribtue name.
     * @param {Function} callback gets called with attribute's value.
     * @return {Object} self.
     */
    getAttribute: function getAttribute(attr, callback) {
      var cmd = {
        type: 'getElementAttribute',
        name: attr
      };

      return this._sendCommand(cmd, 'value', callback);
    },

    /**
     * Sends typing event keys to element.
     *
     *
     * @method sendKeys
     * @param {String} string message to type.
     * @param {Function} callback boolean success.
     * @return {Object} self.
     */
    sendKeys: function sendKeys(string, callback) {
      var cmd = {
        type: 'sendKeysToElement',
        value: string
      };
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Clicks element.
     *
     * @method click
     * @param {Function} callback boolean result.
     * @return {Object} self.
     */
    click: function click(callback) {
      var cmd = {
        type: 'clickElement'
      };
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Gets text of element
     *
     * @method text
     * @param {Function} callback text of element.
     * @return {Object} self.
     */
    text: function text(callback) {
      var cmd = {
        type: 'getElementText'
      };
      return this._sendCommand(cmd, 'value', callback);
    },

    /**
     * Returns tag name of element.
     *
     * @method tagName
     * @param {Function} callback node style [err, tagName].
     */
    tagName: function tagName(callback) {
      var cmd = {
        type: 'getElementTagName',
      };
      return this._sendCommand(cmd, 'value', callback);
    },

    /**
     * Clears element.
     *
     * @method clear
     * @param {Function} callback value of element.
     * @return {Object} self.
     */
    clear: function clear(callback) {
      var cmd = {
        type: 'clearElement'
      };
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Checks if element is selected.
     *
     *
     * @method selected
     * @param {Function} callback boolean argument.
     * @return {Object} self.
     */
    selected: function selected(callback) {
      var cmd = {
        type: 'isElementSelected'
      };
      return this._sendCommand(cmd, 'value', callback);
    },

    /**
     * Checks if element is enabled.
     *
     * @method enabled
     * @param {Function} callback boolean argument.
     * @return {Object} self.
     */
    enabled: function enabled(callback) {
      var cmd = {
        type: 'isElementEnabled'
      };
      return this._sendCommand(cmd, 'value', callback);
    },

    /**
     * Checks if element is displayed.
     *
     *
     * @method displayed
     * @param {Function} callback boolean argument.
     * @return {Object} self.
     */
    displayed: function displayed(callback) {
      var cmd = {
        type: 'isElementDisplayed'
      };
      return this._sendCommand(cmd, 'value', callback);
    }

  };

  module.exports = Element;

}.apply(
  this,
  (this.Marionette) ?
    [Marionette('element'), Marionette] :
    [module, require('../../lib/marionette/marionette')]
));
(function(module, ns) {

  var Element = ns.require('element'),
      Exception = ns.require('error');


  var SCOPE_TO_METHOD = {
    scriptTimeout: 'setScriptTimeout',
    searchTimeout: 'setSearchTimeout',
    context: 'setContext'
  };

  var key;
  var searchMethods = {
    CLASS: 'class name',
    SELECTOR: 'css selector',
    ID: 'id',
    NAME: 'name',
    LINK_TEXT: 'link text',
    PARTIAL_LINK_TEXT: 'partial link text',
    TAG: 'tag name',
    XPATH: 'xpath'
  };

  function isFunction(value) {
    return typeof(value) === 'function';
  }

  function setState(context, type, value) {
    context._scope[type] = value;
    context._state[type] = value;
  }

  function getState(context, type) {
    return context._state[type];
  }

  /**
   * Initializes client.
   * You must create and initialize
   * a driver and pass it into the client before
   * using the client itself.
   *
   *     // all drivers conform to this api
   *
   *     // var Marionette = require('marionette-client');
   *     var driver = new Marionette.Drivers.Tcp({});
   *     var client;
   *
   *     driver.connect(function(err) {
   *       if (err) {
   *         // handle error case...
   *       }
   *
   *       client = new Marionette.Client(driver, {
   *           // optional default callback can be used to implement
   *           // a generator interface or other non-callback based api.
   *          defaultCallback: function(err, result) {
   *            console.log('CALLBACK GOT:', err, result);
   *          }
   *       });
   *
   *       // by default commands run in a queue.
   *       // assuming there is not a fatal error each command
   *       // will execute sequentially.
   *       client.startSession(function () {
   *         client.goUrl('http://google.com')
   *           .executeScript(function() {
   *             alert(document.title);
   *           })
   *           .deleteSession();
   *       });
   *     });
   *
   *
   * @class Marionette.Client
   * @constructor
   * @param {Marionette.Drivers.Abstract} driver fully initialized client.
   * @param {Object} options options for driver.
   */
  function Client(driver, options) {
    if (typeof(options) === 'undefined') {
      options = {};
    }
    this.driver = driver;
    this.defaultCallback = options.defaultCallback || false;

    // pick up some options from the driver
    if (driver.defaultCallback && !this.defaultCallback) {
      this.defaultCallback = driver.defaultCallback;
    }

    if (driver.isSync) {
      this.isSync = driver.isSync;
    }

    if (!this.defaultCallback) {
      this.defaultCallback = driver.defaultCallback ?
                             driver.defaultCallback :
                             function() {};
    }

    // create the initial state for this client
    this._state = {
      context: 'content',
      scriptTimeout: 5000,
      searchTimeout: 250
    };

    // give the root client a scope.
    this._scope = {};
    for (var key in this._state) {
      this._scope[key] = this._state[key];
    }
  }

  Client.prototype = {

    Element: Element,

    /**
     * Constant for chrome context.
     *
     * @type {String}
     * @property CHROME
     */
    CHROME: 'chrome',

    /**
     * Constant for content context.
     *
     * @type {String}
     * @property CONTENT
     */
    CONTENT: 'content',

    /**
     * The current scope of this client instance. Used with _state.
     *
     *   // Example
     *   {
     *      scriptTimeout: 500,
     *      searchTimeout: 6000,
     *      context: 'content',
     *      window: 'window_id',
     *      frame: 'frameId'
     *   }
     *
     * @type {Object}
     */
    _scope: null,

    /**
     * The current state of the client.
     *
     *    // Example
     *    {
     *      scriptTimeout: 500,
     *      searchTimeout: 6000,
     *      context: 'content',
     *      window: 'window_id',
     *      frame: 'frameId'
     *    }
     *
     * @private
     * @type {Object}
     */
    _state: null,

    /**
     * Actor id for instance
     *
     * @property actor
     * @type String
     */
    actor: null,

    /**
     * Session id for instance.
     *
     * @property session
     * @type String
     */
    session: null,

    // _state getters

    /**
     * @return {String} the current context.
     */
    get context() {
      return getState(this, 'context');
    },

    /**
     * @return {String|Marionette.Element} frame currently focused.
     */
    get frame() {
      return getState(this, 'frame');
    },

    /**
     * @return {String|Marionette.Element}
     */
    get window() {
      return getState(this, 'window');
    },

    /**
     * @return {Number} current scriptTimeout.
     */
    get scriptTimeout() {
      return getState(this, 'scriptTimeout');
    },

    /**
     * @return {Number} current search timeout.
     */
    get searchTimeout() {
      return getState(this, 'searchTimeout');
    },

    /**
     * Sends a command to the server.
     * Adds additional information like actor and session
     * to command if not present.
     *
     *
     * @method send
     * @chainable
     * @param {Object} cmd to be sent over the wire.
     * @param {Function} cb executed when response is sent.
     */
    send: function send(cmd, cb) {
      // first do scoping updates
      if (this._scope && this._bypassScopeChecks !== true) {
        // really dirty hack
        this._bypassScopeChecks = true;
        for (var key in this._scope) {
          // !important otherwise throws infinite loop
          if (this._state[key] !== this._scope[key]) {
            this[SCOPE_TO_METHOD[key]](this._scope[key]);
          }
        }
        // undo really dirty hack
        this._bypassScopeChecks = false;
      }

      if (!cmd.to) {
        cmd.to = this.actor || 'root';
      }

      if (this.session) {
        cmd.session = cmd.session || this.session;
      }

      if (!cb && this.defaultCallback) {
        cb = this.defaultCallback();
      }

      var driverSent = this.driver.send(cmd, cb);

      if (this.isSync) {
        return driverSent;
      }

      return this;
    },

    _handleCallback: function() {
      var args = Array.prototype.slice.call(arguments),
          callback = args.shift();

      if (!callback) {
        callback = this.defaultCallback;
      }

      // handle error conversion
      if (args[0]) {
        args[0] = Exception.error(args[0]);
      }

      return callback.apply(this, args);
    },

    /**
     * Sends request and formats response.
     *
     *
     * @private
     * @method _sendCommand
     * @chainable
     * @param {Object} command marionette command.
     * @param {String} responseKey the part of the response to pass \
     *                             unto the callback.
     * @param {Object} callback wrapped callback.
     */
    _sendCommand: function(command, responseKey, callback) {
      var self = this;
      var result;

      return this.send(command, function(data) {
        var value;
        try {
          value = self._transformResultValue(data[responseKey]);
        } catch(e) {
          console.log('Error: unable to transform marionette response', data);
        }
        return self._handleCallback(callback, data.error, value);
      });
    },

    /**
     * Finds the actor for this instance.
     *
     * @private
     * @method _getActorId
     * @param {Function} callback executed when response is sent.
     */
    _getActorId: function _getActorId(callback) {
      var self = this, cmd;

      cmd = { type: 'getMarionetteID' };

      return this._sendCommand(cmd, 'id', function(err, actor) {
        self.actor = actor;
        if (callback) {
          callback(err, actor);
        }
      });
    },

    /**
     * Starts a remote session.
     *
     * @private
     * @method _newSession
     * @param {Function} callback optional.
     */
    _newSession: function _newSession(callback) {
      var self = this;

      function newSession(data) {
        self.session = data.value;
        return self._handleCallback(callback, data.error, data);
      }

      return this.send({ type: 'newSession' }, newSession);
    },

    /**
     * Creates a client which has a fixed window, frame, scriptTimeout and
     * searchTimeout.
     *
     *    var child = client.scope({ frame: myiframe });
     *    var chrome = client.scope({ context: 'chrome' });
     *
     *    // executed in the given iframe in content
     *    child.setContext('content');
     *    child.findElement('...')
     *
     *    // executed in the root frame in chrome context.
     *    chrome.executeScript();
     *
     *
     * @param {Object} options for scopped client.
     * @return {Marionette.Client} scoped client instance.
     */
    scope: function(options) {
      var scopeOptions = {};
      for (var key in this._scope) {
        scopeOptions[key] = this._scope[key];
      }

      // copy the given options
      for (key in options) {
        var value = options[key];
        scopeOptions[key] = value;
      }

      // create child
      var scope = Object.create(this);

      // assign the new scoping
      scope._scope = scopeOptions;

      return scope;
    },

    /**
     * Finds actor and creates connection to marionette.
     * This is a combination of calling getMarionetteId and then newSession.
     *
     * @method startSession
     * @param {Function} callback executed when session is started.
     */
    startSession: function startSession(callback) {
      callback = callback || this.defaultCallback;

      var self = this;
      return this._getActorId(function() {
        //actor will not be set if we send the command then
        self._newSession(callback);
      });
    },

    /**
     * Destroys current session.
     *
     *
     * @chainable
     * @method deleteSession
     * @param {Function} callback executed when session is destroyed.
     */
    deleteSession: function destroySession(callback) {
      var cmd = { type: 'deleteSession' },
          self = this;

      return this._sendCommand(cmd, 'ok', function(err, value) {
        self.driver.close();
        self._handleCallback(callback, err, value);
      });
    },

    /**
     * Callback will receive the id of the current window.
     *
     * @chainable
     * @method getWindow
     * @param {Function} callback executed with id of current window.
     * @return {Object} self.
     */
    getWindow: function getWindow(callback) {
      var cmd = { type: 'getWindow' };
      return this._sendCommand(cmd, 'value', callback);
    },

    /**
     * Callback will receive an array of window ids.
     *
     * @method getWindow
     * @chainable
     * @param {Function} callback executes with an array of ids.
     */
    getWindows: function getWindows(callback) {
      var cmd = { type: 'getWindows' };
      return this._sendCommand(cmd, 'value', callback);
    },

    /**
     * Switches context of marionette to specific window.
     *
     *
     * @method switchToWindow
     * @chainable
     * @param {String} id window id you can find these with getWindow(s).
     * @param {Function} callback called with boolean.
     */
    switchToWindow: function switchToWindow(id, callback) {
      var cmd = { type: 'switchToWindow', value: id };
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Imports a script into the marionette
     * context for the duration of the session.
     *
     * Good for prototyping new marionette commands.
     *
     * @method importScript
     * @chainable
     * @param {String} script javascript string blob.
     * @param {Function} callback called with boolean.
     */
    importScript: function(script, callback) {
      var cmd = { type: 'importScript', script: script };
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Switches context of marionette to specific iframe.
     *
     *
     * @method switchToFrame
     * @chainable
     * @param {String|Marionette.Element} id iframe id or element.
     * @param {Function} callback called with boolean.
     */
    switchToFrame: function switchToFrame(id, callback) {
      if (typeof(id) === 'function') {
        callback = id;
        id = null;
      }

      var cmd = { type: 'switchToFrame' };

      if (id instanceof this.Element) {
        cmd.element = id.id;
      } else if (
        id !== null &&
        typeof(id) === 'object' &&
        id.ELEMENT
      ) {
        cmd.element = id.ELEMENT;
      } else if (id) {
        cmd.value = id;
      }
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Switches context of window. The current context can be found with
     * .context.
     *
     *    // default context
     *    client.context === 'content';
     *
     *    client.setContext('chrome', function() {
     *      // .. wait for switch
     *    });
     *
     *    client.context === 'chrome';
     *
     *
     * @method setContext
     * @chainable
     * @param {String} context either: 'chome' or 'content'.
     * @param {Function} callback receives boolean.
     */
    setContext: function setContext(context, callback) {
      if (context !== this.CHROME && context !== this.CONTENT) {
        throw new Error('content type must be "chrome" or "content"');
      }

      setState(this, 'context', context);
      var cmd = { type: 'setContext', value: context };
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Sets the script timeout
     *
     * @method setScriptTimeout
     * @chainable
     * @param {Numeric} timeout max time in ms.
     * @param {Function} callback executed with boolean status.
     * @return {Object} self.
     */
    setScriptTimeout: function setScriptTimeout(timeout, callback) {
      var cmd = { type: 'setScriptTimeout', value: timeout };
      setState(this, 'scriptTimeout', timeout);
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * setSearchTimeout
     *
     * @method setSearchTimeout
     * @chainable
     * @param {Numeric} timeout max time in ms.
     * @param {Function} callback executed with boolean status.
     * @return {Object} self.
     */
    setSearchTimeout: function setSearchTimeout(timeout, callback) {
      var cmd = { type: 'setSearchTimeout', value: timeout };
      setState(this, 'searchTimeout', timeout);
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Gets url location for device.
     *
     * @method getUrl
     * @chainable
     * @param {Function} callback receives url.
     */
    getUrl: function getUrl(callback) {
      var cmd = { type: 'getUrl' };
      return this._sendCommand(cmd, 'value', callback);
    },

    /**
     * Refreshes current window on device.
     *
     * @method refresh
     * @param {Function} callback boolean success.
     * @return {Object} self.
     */
    refresh: function refresh(callback) {
      var cmd = { type: 'refresh' };
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Drives browser to a url.
     *
     * @method goUrl
     * @chainable
     * @param {String} url location.
     * @param {Function} callback executes when finished driving browser to url.
     */
    goUrl: function goUrl(url, callback) {
      var cmd = { type: 'goUrl', value: url };
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Drives window forward.
     *
     *
     * @method goForward
     * @chainable
     * @param {Function} callback receives boolean.
     */
    goForward: function goForward(callback) {
      var cmd = { type: 'goForward' };
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Drives window back.
     *
     * @method goBack
     * @chainable
     * @param {Function} callback receives boolean.
     */
    goBack: function goBack(callback) {
      var cmd = { type: 'goBack' };
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Logs a message on marionette server.
     *
     *
     * @method log
     * @chainable
     * @param {String} message log message.
     * @param {String} level arbitrary log level.
     * @param {Function} callback receives boolean.
     * @return {Object} self.
     */
    log: function log(msg, level, callback) {
      var cmd = { type: 'log', level: level, value: msg };
      return this._sendCommand(cmd, 'ok', callback);
    },

    /**
     * Retrieves all logs on the marionette server.
     * The response from marionette is an array of arrays.
     *
     *     device.getLogs(function(err, logs){
     *       //logs => [
     *         [
     *           'msg',
     *           'level',
     *           'Fri Apr 27 2012 11:00:32 GMT-0700 (PDT)'
     *         ]
     *       ]
     *     });
     *
     *
     * @method getLogs
     * @chainable
     * @param {Function} callback receive an array of logs.
     */
    getLogs: function getLogs(callback) {
      var cmd = { type: 'getLogs' };
      return this._sendCommand(cmd, 'value', callback);
    },

    /**
     * Executes a remote script will block.
     * Script is *not* wrapped in a function.
     *
     * @method executeJsScript
     * @chainable
     * @param {String} script script to run.
     * @param {Array} [args] optional args for script.
     * @param {Array} [timeout] optional args for timeout.
     * @param {Function} callback will receive result of the return \
     *                            call in the script if there is one.
     * @return {Object} self.
     */
    executeJsScript: function executeJsScript(script, args, timeout, callback) {
      if (typeof(timeout) === 'function') {
        callback = timeout;
        timeout = null;
      }
      if (typeof(args) === 'function') {
        callback = args;
        args = null;
      }

      timeout = (typeof(timeout) === 'boolean') ? timeout : true;

      return this._executeScript({
        type: 'executeJSScript',
        value: script,
        timeout: timeout,
        args: args
      }, callback || this.defaultCallback);
    },

    /**
     * Executes a remote script will block. Script is wrapped in a function.
     *
     *     // its is very important to remember that the contents of this
     *     // method are "stringified" (Function#toString) and sent over the
     *     // wire to execute on the device. So things like scope will not be
     *     // the same. If you need to pass other information in arguments
     *     // option should be used.
     *
     *     // assume that this element is the result of findElement
     *     var element;
     *     var config = {
     *        event: 'magicCustomEvent',
     *        detail: { foo: true  }
     *     };
     *
     *     var remoteArgs = [element, details];
     *
     *     // unlike other callbacks this one will execute _on device_
     *     function remoteFn(element, details) {
     *        // element in this context is a real dom element now.
     *        var event = document.createEvent('CustomEvent');
     *        event.initCustomEvent(config.event, true, true, event.detail);
     *        element.dispatchEvent(event);
     *
     *        return { success: true };
     *     }
     *
     *     client.executeJsScript(remoteFn, remoteArgs, function(err, value) {
     *       // value => { success: true }
     *     });
     *
     *
     * @method executeScript
     * @chainable
     * @param {String} script script to run.
     * @param {Array} [args] optional args for script.
     * @param {Function} callback will receive result of the return \
     *                            call in the script if there is one.
     * @return {Object} self.
     */
    executeScript: function executeScript(script, args, callback) {
      if (typeof(args) === 'function') {
        callback = args;
        args = null;
      }
      return this._executeScript({
        type: 'executeScript',
        value: script,
        args: args
      }, callback || this.defaultCallback);
    },

    /**
     * Script is wrapped in a function and will be executed asynchronously.
     *
     * NOTE: that setScriptTimeout _must_ be set prior to using this method
     *       as the timeout defaults to zero.
     *
     *
     *     function remote () {
     *       window.addEventListener('someevent', function() {
     *         // special method to notify that async script is complete.
     *         marionetteScriptFinished({ fromRemote: true })
     *       });
     *     }
     *
     *     client.executeAsyncScript(remote, function(err, value) {
     *       // value === { fromRemote: true }
     *     });
     *
     *
     * @method executeAsyncScript
     * @chainable
     * @param {String} script script to run.
     * @param {Array} [args] optional args for script.
     * @param {Function} callback will receive result of the return \
     *                            call in the script if there is one.
     * @return {Object} self.
     */
    executeAsyncScript: function executeAsyncScript(script, args, callback) {
      if (typeof(args) === 'function') {
        callback = args;
        args = null;
      }
      return this._executeScript({
        type: 'executeAsyncScript',
        value: script,
        args: args
      }, callback || this.defaultCallback);
    },

    /**
     * Finds element.
     *
     * @method _findElement
     * @private
     * @param {String} type type of command to send like 'findElement'.
     * @param {String} query search query.
     * @param {String} method search method.
     * @param {String} elementId id of element to search within.
     * @param {Function} callback executes with element uuid(s).
     */
    _findElement: function _findElement(type, query, method, id, callback) {
      var cmd, self = this;

      if (isFunction(id)) {
        callback = id;
        id = undefined;
      }

      if (isFunction(method)) {
        callback = method;
        method = undefined;
      }

      callback = callback || this.defaultCallback;

      cmd = {
        type: type || 'findElement',
        using: method || 'css selector',
        value: query,
        element: id
      };

      if (this.searchMethods.indexOf(cmd.using) === -1) {
        throw new Error(
          'invalid option for using: \'' + cmd.using + '\' use one of : ' +
          this.searchMethods.join(', ')
        );
      }

      //proably should extract this function into a private
      return this._sendCommand(cmd, 'value',
                               function processElements(err, result) {
        var element;

        if (result instanceof Array) {
          element = [];
          result.forEach(function(el) {
            element.push(new this.Element(el, self));
          }, this);
        } else {
          element = new this.Element(result, self);
        }
        return self._handleCallback(callback, err, element);
      });
    },

    /**
     * Attempts to find a dom element (via css selector, xpath, etc...)
     * "elements" returned are instances of
     * {{#crossLink "Marionette.Element"}}{{/crossLink}}
     *
     *
     *     // with default options
     *     client.findElement('#css-selector', function(err, element) {
     *        if (err) {
     *          // handle case where element was not found
     *        }
     *
     *        // see element interface for all methods, etc..
     *        element.click(function() {
     *
     *        });
     *     });
     *
     *
     *
     * @method findElement
     * @chainable
     * @param {String} query search query.
     * @param {String} method search method.
     * @param {String} elementId id of element to search within.
     * @param {Function} callback executes with element uuid.
     */
    findElement: function findElement() {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('findElement');
      return this._findElement.apply(this, args);
    },

    /**
     * Finds multiple elements in the dom. This method has the same
     * api signature as {{#crossLink "findElement"}}{{/crossLink}} the
     * only difference is where findElement returns a single element
     * this method will return an array of elements in the callback.
     *
     *
     *     // find all links in the document
     *     client.findElements('a[href]', function(err, element) {
     *     });
     *
     *
     * @method findElements
     * @chainable
     * @param {String} query search query.
     * @param {String} method search method.
     * @param {String} elementId id of element to search within.
     * @param {Function} callback executes with an array of element uuids.
     */
    findElements: function findElements() {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('findElements');
      return this._findElement.apply(this, args);
    },


    /**
     * Converts an function into a string
     * that can be sent to marionette.
     *
     * @private
     * @method _convertFunction
     * @param {Function|String} fn function to call on the server.
     * @return {String} function string.
     */
    _convertFunction: function _convertFunction(fn) {
      if (typeof(fn) === 'function') {
        var str = fn.toString();
        return 'return (' + str + '.apply(this, arguments));';
      }
      return fn;
    },

    /**
     * Processes result of command
     * if an {'ELEMENT': 'uuid'} combination
     * is returned a Marionette.Element
     * instance will be created and returned.
     *
     *
     * @private
     * @method _transformResultValue
     * @param {Object} value original result from server.
     * @return {Object|Marionette.Element} processed result.
     */
    _transformResultValue: function _transformResultValue(value) {
      if (value && typeof(value.ELEMENT) === 'string') {
        return new this.Element(value.ELEMENT, this);
      }
      return value;
    },

    /**
     * Prepares arguments for script commands.
     * Formats Marionette.Element's sod
     * marionette can use them in script commands.
     *
     *
     * @private
     * @method _prepareArguments
     * @param {Array} arguments list of args for wrapped function.
     * @return {Array} processed arguments.
     */
    _prepareArguments: function _prepareArguments(args) {
      if (args.map) {
        return args.map(function(item) {
          if (item instanceof this.Element) {
            return {'ELEMENT': item.id };
          }
          return item;
        }, this);
      } else {
        return args;
      }
    },

    /**
     * Executes a remote string of javascript.
     * the javascript string will be wrapped in a function
     * by marionette.
     *
     *
     * @method _executeScript
     * @private
     * @param {Object} options objects of execute script.
     * @param {String} options.type command type like 'executeScript'.
     * @param {String} options.value javascript string.
     * @param {String} options.args arguments for script.
     * @param {Boolean} options.timeout timeout only used in 'executeJSScript'.
     * @param {Function} callback executes when script finishes.
     * @return {Object} self.
     */
    _executeScript: function _executeScript(options, callback) {
      var timeout = options.timeout,
          self = this,
          cmd = {
            type: options.type,
            value: this._convertFunction(options.value),
            args: this._prepareArguments(options.args || [])
          };

      if (timeout === true || timeout === false) {
        cmd.timeout = timeout;
      }

      return this._sendCommand(cmd, 'value', callback);
    }

  };


  //gjslint: ignore
  var proto = Client.prototype;
  proto.searchMethods = [];

  for (key in searchMethods) {
    if (searchMethods.hasOwnProperty(key)) {
      Client.prototype[key] = searchMethods[key];
      Client.prototype.searchMethods.push(searchMethods[key]);
    }
  }

  module.exports = Client;

}.apply(
  this,
  (this.Marionette) ?
    [Marionette('client'), Marionette] :
    [module, require('./marionette')]
));
(function(module, ns) {

  /**
   *
   * Abstract driver that will handle
   * all common tasks between implementations.
   * Such as error handling, request/response queuing
   * and timeouts.
   *
   * @constructor
   * @class Marionette.Drivers.Abstract
   * @param {Object} options set options on prototype.
   */
  function Abstract(options) {
    this._sendQueue = [];
    this._responseQueue = [];
  }

  Abstract.prototype = {

    /**
     * Timeout for commands
     *
     * @property timeout
     * @type Numeric
     */
    timeout: 10000,

    /**
     * Waiting for a command to finish?
     *
     * @private
     * @property _waiting
     * @type Boolean
     */
    _waiting: true,

    /**
     * Is system ready for commands?
     *
     * @property ready
     * @type Boolean
     */
    ready: false,

    /**
     * Connection id for the server.
     *
     * @property connectionId
     * @type Numeric
     */
    connectionId: null,

    /**
     * Sends remote command to server.
     * Each command will be queued while waiting for
     * any pending commands. This ensures order of
     * response is correct.
     *
     *
     * @method send
     * @param {Object} command remote command to send to marionette.
     * @param {Function} callback executed when response comes back.
     */
    send: function send(cmd, callback) {
      if (!this.ready) {
        throw new Error('connection is not ready');
      }

      if (typeof(callback) === 'undefined') {
        throw new Error('callback is required');
      }

      this._responseQueue.push(callback);
      this._sendQueue.push(cmd);

      this._nextCommand();

      return this;
    },

    /**
     * Connects to a remote server.
     * Requires a _connect function to be defined.
     *
     *     MyClass.prototype._connect = function _connect(){
     *       //open a socket to marrionete accept response
     *       //you *must* call _onDeviceResponse with the first
     *       //response from marionette it looks like this:
     *       //{ from: 'root', applicationType: 'gecko', traits: [] }
     *       this.connectionId = result.id;
     *     }
     *
     * @method connect
     * @param {Function} callback executes
     *   after successfully connecting to the server.
     */
    connect: function connect(callback) {
      this.ready = true;
      this._responseQueue.push(function(data) {
        this.applicationType = data.applicationType;
        this.traits = data.traits;
        callback();
      }.bind(this));
      this._connect();
    },

    /**
     * Destroys connection to server
     *
     * Will immediately close connection to server
     * closing any pending responses.
     *
     * @method close
     */
    close: function() {
      this.ready = false;
      this._responseQueue.length = 0;
      if (this._close) {
        this._close();
      }
    },

    /**
     * Checks queue if not waiting for a response
     * Sends command to websocket server
     *
     * @private
     * @method _nextCommand
     */
    _nextCommand: function _nextCommand() {
      var nextCmd;
      if (!this._waiting && this._sendQueue.length) {
        this._waiting = true;
        nextCmd = this._sendQueue.shift();
        this._sendCommand(nextCmd);
      }
    },

    /**
     * Handles responses from devices.
     * Will only respond to the event if the connectionId
     * is equal to the event id and the client is ready.
     *
     * @param {Object} data response from server.
     * @private
     * @method _onDeviceResponse
     */
    _onDeviceResponse: function _onDeviceResponse(data) {
      var cb;
      if (this.ready && data.id === this.connectionId) {
        this._waiting = false;
        cb = this._responseQueue.shift();
        cb(data.response);

        this._nextCommand();
      }
    }

  };

  module.exports = Abstract;

}.apply(
  this,
  (this.Marionette) ?
    [Marionette('drivers/abstract'), Marionette] :
    [module, require('../marionette')]
));
(function(module, ns) {

  try {
    if (!window.navigator.mozTCPSocket) {
      return;
    }
  } catch(e) {
    return;
  }

  var TCPSocket = navigator.mozTCPSocket;

  var Responder = ns.require('responder');
  var ON_REGEX = /^on/;

 /**
   * Horrible hack to work around
   * missing stuff in TCPSocket & add
   * node compatible api.
   */
  function SocketWrapper(host, port, options) {
    var events = new Responder();
    var eventMethods = [
      'on',
      'addEventListener',
      'removeEventListener',
      'once',
      'emit'
    ];

    var rawSocket = TCPSocket.open(host, port, options);

    var eventList = [
      'onopen',
      'ondrain',
      'ondata',
      'onerror',
      'onclose'
    ];

    eventList.forEach(function(method) {
      rawSocket[method] = function(method, data) {
        var emitData;
        if ('data' in data) {
          emitData = data.data;
        } else {
          emitData = data;
        }
        events.emit(method, emitData);
      }.bind(socket, method.substr(2));
    });

    var socket = Object.create(rawSocket);

    eventMethods.forEach(function(method) {
      socket[method] = events[method].bind(events);
    });

    return socket;
  }

  var Abstract, CommandStream, Responder;

  Abstract = ns.require('drivers/abstract');
  CommandStream = ns.require('command-stream');

  /** TCP **/
  Tcp.Socket = SocketWrapper;

  /**
   * Connects to gecko marionette server using mozTCP api.
   *
   *
   *     // default options are fine for b2g-desktop
   *     // or a device device /w port forwarding.
   *     var tcp = new Marionette.Drivers.MozTcp();
   *
   *     tcp.connect(function() {
   *       // ready to use with client
   *     });
   *
   *
   * @class Marionette.Drivers.MozTcp
   * @extends Marionette.Drivers.Abstract
   * @constructor
   * @param {Object} options connection options.
   *   @param {String} [options.host="127.0.0.1"] ip/host.
   *   @param {Numeric} [options.port="2828"] marionette server port.
   */
  function Tcp(options) {
    if (typeof(options)) {
      options = {};
    }
    Abstract.call(this, options);


    this.connectionId = 0;
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 2828;
  }

  Tcp.prototype = Object.create(Abstract.prototype);

  /**
   * Sends a command to the server.
   *
   * @param {Object} cmd remote marionette command.
   */
  Tcp.prototype._sendCommand = function _sendCommand(cmd) {
    this.client.send(cmd);
  };

  /**
   * Opens TCP socket for marionette client.
   */
  Tcp.prototype._connect = function connect() {
    var client, self = this;

    this.socket = new Tcp.Socket(this.host, this.port);
    client = this.client = new CommandStream(this.socket);
    this.client.on('command', this._onClientCommand.bind(this));
  };

  /**
   * Receives command from server.
   *
   * @param {Object} data response from marionette server.
   */
  Tcp.prototype._onClientCommand = function(data) {
    this._onDeviceResponse({
      id: this.connectionId,
      response: data
    });
  };

  /**
   * Closes connection to marionette.
   */
  Tcp.prototype._close = function close() {
    if (this.socket && this.socket.close) {
      this.socket.close();
    }
  };

  /** export */
  module.exports = exports = Tcp;

}.apply(
  this,
  (this.Marionette) ?
    [Marionette('drivers/moz-tcp'), Marionette] :
    [module, require('../../lib/marionette/marionette')]
));
/** @namespace */
(function(module, ns) {

  var Abstract = ns.require('drivers/abstract'),
      Xhr = ns.require('xhr');

  Httpd.Xhr = Xhr;

  /**
   * Creates instance of http proxy backend.
   *
   * @deprecated
   * @class Marionette.Drivers.Httpd
   * @extends Marionette.Drivers.Abstract
   * @param {Object} options key/value pairs to add to prototype.
   */
  function Httpd(options) {
    var key;
    if (typeof(options) === 'undefined') {
      options = options;
    }

    Abstract.call(this);

    for (key in options) {
      if (options.hasOwnProperty(key)) {
        this[key] = options[key];
      }
    }
  }

  var proto = Httpd.prototype = Object.create(Abstract.prototype);

  /** @scope Marionette.Drivers.Httpd.prototype */

  /**
   * Location of the http server that will proxy to marionette
   * @memberOf Marionette.Drivers.Httpd#
   * @name proxyUrl
   * @type String
   */
  proto.proxyUrl = '/marionette';

  /**
   * Port that proxy should connect to.
   *
   * @name port
   * @memberOf Marionette.Drivers.Httpd#
   * @type Numeric
   */
  proto.port = 2828;

  /**
   * Server proxy should connect to.
   *
   *
   * @name server
   * @memberOf Marionette.Drivers.Httpd#
   * @type String
   */
  proto.server = 'localhost';

  /**
   * Sends command to server for this connection
   *
   * @name _sendCommand
   * @memberOf Marionette.Drivers.Httpd#
   * @param {Object} command remote marionette command.
   */
  proto._sendCommand = function _sendCommand(command) {
    this._request('PUT', command, function() {
      //error handling?
    });
  };


  /**
   * Sends DELETE message to server to close marionette connection.
   * Aborts all polling operations.
   *
   * @name _close
   * @memberOf Marionette.Drivers.Httpd#
   */
  proto._close = function _close() {

    if (this._pollingRequest) {
      this._pollingRequest.abort();
      this._pollingRequest = null;
    }

    this._request('DELETE', null, function() {
      //handle close errors?
    });
  };

  /**
   * Opens connection for device.
   *
   * @name _connect
   * @memberOf Marionette.Drivers.Httpd#
   */
  proto._connect = function _connect() {
    var auth = {
      server: this.server,
      port: this.port
    };

    this._request('POST', auth, function(data, xhr) {
      var deviceResponse = this._onQueueResponse.bind(this);
      if (xhr.status === 200) {
        this.connectionId = data.id;
        this._pollingRequest = this._request('GET', deviceResponse);
      } else {
        //throw error
      }
    }.bind(this));
  };

  /**
   * Creates xhr request
   *
   * @memberOf Marionette.Drivers.Httpd#
   * @name _request
   * @param {String} method http method like 'POST' or 'GET'.
   * @param {Object} data optional.
   * @param {Object} callback after xhr completes \
   * receives parsed data as first argument and xhr object as second.
   * @return {Marionette.Xhr} xhr wrapper.
   */
  proto._request = function _request(method, data, callback) {
    var request, url;

    if (typeof(callback) === 'undefined' && typeof(data) === 'function') {
      callback = data;
      data = null;
    }

    url = this.proxyUrl;

    if (this.connectionId !== null) {
      url += '?' + String(this.connectionId) + '=' + String(Date.now());
    }

    request = new Xhr({
      url: url,
      method: method,
      data: data || null,
      callback: callback
    });

    request.send();

    return request;
  };

  /**
   * Handles response to multiple messages.
   * Requeues the _pollingRequest on success
   *
   *    {
   *      messages: [
   *        { id: 1, response: {} },
   *        ....
   *      ]
   *    }
   *
   * @this
   * @name _onQueueResponse
   * @memberOf Marionette.Drivers.Httpd#
   * @param {Object} queue list of messages.
   * @param {Marionette.Xhr} xhr xhr instance.
   */
  proto._onQueueResponse = function _onQueueResponse(queue, xhr) {
    var self = this;

    if (xhr.status !== 200) {
      throw new Error('XHR responded with code other then 200');
    }

    //TODO: handle errors
    if (queue && queue.messages) {
      queue.messages.forEach(function(response) {
        self._onDeviceResponse(response);
      });
    }

    //when we close the object _pollingRequest is destroyed.
    if (this._pollingRequest) {
      this._pollingRequest.send();
    }
  };


  module.exports = Httpd;

}.apply(
  this,
  (this.Marionette) ?
    [Marionette('drivers/httpd-polling'), Marionette] :
    [module, require('../marionette')]
));
(function(module, ns) {

  var DEFAULT_PORT = 60023;
  var DEFAULT_MARIONETTE_PORT = 2828;
  var DEFAULT_HOST = 'localhost';

  var fork, proxyRunnerPath,
      isNode = typeof(window) === 'undefined',
      XHR = ns.require('xhr');

  if (isNode) {
    proxyRunnerPath = __dirname + '/../../http-proxy-runner';
    fork = require('child_process').fork;
  } else {
    fork = function() {
      throw new Error('Cannot fork Http Proxy from Browser');
    };
  }

  function request(url, options) {
    options.url = url;
    options.async = false;
    options.headers = { 'Content-Type': 'application/json' };

    var xhr = new XHR(options);
    var response;
    xhr.send(function(json) {
      if (typeof(json) === 'string') {
        // for node
        json = JSON.parse(json);
      }
      response = json;
    });
    return response;
  }

  function HttpProxy(options) {
    if (options && options.hostname) {
      this.hostname = options.hostname;
    }

    if (options && options.port) {
      this.port = options.port;
    }

    if (options && options.marionettePort) {
      this.marionettePort = options.marionettePort;
    }

    this.url = 'http://' + this.hostname + ':' + this.port;
  }

  HttpProxy.prototype = {
    hostname: DEFAULT_HOST,
    port: DEFAULT_PORT,
    marionettePort: DEFAULT_MARIONETTE_PORT,
    isSync: true,
    defaultCallback: function(err, result) {
      if (err) {
        console.log(err, '<<< THROW!')
        throw err;
      }
      return result;
    },

    _connectToMarionette: function(callback) {
      var data = request(this.url, {
        method: 'POST',
        data: { port: this.marionettePort }
      });
      this._id = data.id;
      callback();
    },

    connect: function(callback) {
      this.serverProcess = fork(
        proxyRunnerPath,
        [
          this.port,
          this.hostname
        ],
        { stdio: 'inherit' }
      );

      this.serverProcess.on('message', function(data) {
        if (data === 'ready') {
          this._connectToMarionette(callback);
        }
      }.bind(this));
    },

    send: function(command, callback) {
      var wrapper = { id: this._id, payload: command };
      var result = request(this.url, { method: 'PUT', data: wrapper });
      return callback(result);
    },

    close: function() {
      var response = request(this.url, {
        method: 'DELETE', data: { id: this._id }
      });
      if (this.serverProcess) {
        this.serverProcess.kill();
      }
      return response;
    }
  };

  module.exports = HttpProxy;

}.apply(
  this,
  (this.Marionette) ?
    [Marionette('drivers/http-proxy'), Marionette] :
    [module, require('../marionette')]
));

(function(module, ns) {

  module.exports = {
    Abstract: ns.require('drivers/abstract'),
    HttpdPolling: ns.require('drivers/httpd-polling'),
    HttpProxy: ns.require('drivers/http-proxy')
  };

  if (typeof(window) === 'undefined') {
    module.exports.Tcp = require('./tcp');
  } else {
    if (typeof(window.TCPSocket) !== 'undefined') {
      module.exports.MozTcp = ns.require('drivers/moz-tcp');
    }
  }

}.apply(
  this,
  (this.Marionette) ?
    [Marionette('drivers'), Marionette] :
    [module, require('../marionette')]
));
(function(module, ns) {

  var exports = module.exports;

  exports.Element = ns.require('element');
  exports.Error = ns.require('error');
  exports.Client = ns.require('client');
  exports.Xhr = ns.require('xhr');
  exports.Drivers = ns.require('drivers');
  exports.CommandStream = ns.require('command-stream');

}.apply(
  this,
  (this.Marionette) ?
    [Marionette, Marionette] :
    [module, require('./marionette')]
));
