/*globals fdom:true, handleEvents, eachProp */
/*jslint indent:2, white:true, node:true, sloppy:true, browser:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.port = fdom.port || {};

/**
 * A freedom port for a user-accessable provider.
 * @class Provider
 * @extends Port
 * @uses handleEvents
 * @param {Object} def The interface of the provider.
 * @contructor
 */
fdom.port.Provider = function(def) {
  this.id = fdom.port.Proxy.nextId();
  handleEvents(this);
  
  this.definition = def;
  this.synchronous = false;
  this.iface = null;
  this.providerCls = null;
  this.providerInstances = {};
};

/**
 * Receive external messages for the provider.
 * @method onMessage
 * @param {String} source the source identifier of the message.
 * @param {Object} message The received message.
 */
fdom.port.Provider.prototype.onMessage = function(source, message) {
  if (source === 'control' && message.reverse) {
    this.emitChannel = message.channel;
    this.emit(this.emitChannel, {
      type: 'channel announcment',
      channel: message.reverse
    });
    this.emit('start');
  } else if (source === 'control' && message.type === 'setup') {
    this.controlChannel = message.channel;
  } else if (source === 'control' && message.type === 'close') {
    if (message.channel === this.controlChannel) {
      delete this.controlChannel;
    }
    this.close();
  } else if (source === 'default') {
    if (!this.emitChannel && message.channel) {
      this.emitChannel = message.channel;
      this.emit('start');
      return;
    }
    if (message.type === 'close' && message.to) {
      delete this.providerInstances[message.to];
    } else if (message.to && this.providerInstances[message.to]) {
      message.message.to = message.to;
      this.providerInstances[message.to](message.message);
    } else if (message.to && message.message && message.message.type === 'construct') {
      this.providerInstances[message.to] = this.getProvider(message.to);
    } else {
      fdom.debug.warn(this.toString() + ' dropping message ' + JSON.stringify(message));
    }
  }
};

/**
 * Close / teardown the flow this provider terminates.
 * @method close
 */
fdom.port.Provider.prototype.close = function() {
  if (this.controlChannel) {
    this.emit(this.controlChannel, {
      type: 'Provider Closing',
      request: 'close'
    });
    delete this.controlChannel;
  }
  this.emit('close');

  this.providerInstances = {};
  this.emitChannel = null;
};

/**
 * Get an interface to expose externally representing this port.
 * Providers are registered with the port using either
 * provideSynchronous or provideAsynchronous depending on the desired
 * return interface.
 * @method getInterface
 * @return {Object} The external interface of this Provider.
 */
fdom.port.Provider.prototype.getInterface = function() {
  if (this.iface) {
    return this.iface;
  } else {
    this.iface = {
      provideSynchronous: function(prov) {
        this.providerCls = prov;
      }.bind(this),
      provideAsynchronous: function(prov) {
        this.providerCls = prov;
        this.synchronous = false;
      }.bind(this),
      close: function() {
        this.close();
      }.bind(this)
    };

    eachProp(this.definition, function(prop, name) {
      switch(prop.type) {
      case "constant":
        Object.defineProperty(this.iface, name, {
          value: fdom.proxy.recursiveFreezeObject(prop.value),
          writable: false
        });
        break;
      }
    }.bind(this));

    return this.iface;
  }
};

/**
 * Create a function that can be used to get interfaces from this provider from
 * a user-visible point.
 * @method getProxyInterface
 */
fdom.port.Provider.prototype.getProxyInterface = function() {
  var func = function(p) {
    return p.getInterface();
  }.bind({}, this);

  func.close = function(iface) {
    if (iface) {
      eachProp(this.ifaces, function(candidate, id) {
        if (candidate === iface) {
          this.teardown(id);
          this.emit(this.emitChannel, {
            type: 'close',
            to: id
          });
          return true;
        }
      }.bind(this));      
    } else {
      // Close the channel.
      this.close();
    }
  }.bind(this);

  func.onClose = function(iface, handler) {
    if (typeof iface === 'function' && handler === undefined) {
      // Add an on-channel-closed handler.
      this.once('close', iface);
      return;
    }

    eachProp(this.ifaces, function(candidate, id) {
      if (candidate === iface) {
        if (this.handlers[id]) {
          this.handlers[id].push(handler);
        } else {
          this.handlers[id] = [handler];
        }
        return true;
      }
    }.bind(this));
  }.bind(this);

  return func;
};

/**
 * Get a new instance of the registered provider.
 * @method getProvider
 * @param {String} identifier the messagable address for this provider.
 * @return {Function} A function to send messages to the provider.
 */
fdom.port.Provider.prototype.getProvider = function(identifier) {
  if (!this.providerCls) {
    fdom.debug.warn('Cannot instantiate provider, since it is not provided');
    return null;
  }
  var instance = new this.providerCls(),
      events = {};

  eachProp(this.definition, function(prop, name) {
    if (prop.type === 'event') {
      events[name] = prop;
    }
  });
  
  instance.dispatchEvent = function(events, id, name, value) {
    if (events[name]) {
      this.emit(this.emitChannel, {
        type: 'message',
        to: id,
        message: {
          name: name,
          type: 'event',
          value: fdom.proxy.conform(events[name].value, value)
        }
      });
    }
  }.bind(this, events, identifier);

  return function(port, msg) {
    if (msg.action === 'method') {
      if (typeof this[msg.type] !== 'function') {
        fdom.debug.warn("Provider does not implement " + msg.type + "()!");
        return;
      }
      var args = msg.value,
          ret = function(to, req, type, ret) {
            this.emit(this.emitChannel, {
              type: 'method',
              to: to,
              message: {
                to: to,
                type: 'method',
                reqId: req,
                name: type,
                value: ret
              }
            });
          }.bind(port, msg.to, msg.reqId, msg.type);
      if (!Array.isArray(args)) {
        args = [args];
      }
      if (port.synchronous) {
        ret(this[msg.type].apply(this, args));
      } else {
        this[msg.type].apply(instance, args.concat(ret));
      }
    }
  }.bind(instance, this);
};

/**
 * Get a textual description of this port.
 * @method toString
 * @return {String} the description of this port.
 */
fdom.port.Provider.prototype.toString = function() {
  if (this.emitChannel) {
    return "[Provider " + this.emitChannel + "]";
  } else {
    return "[unbound Provider]";
  }
};
