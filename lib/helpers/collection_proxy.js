var PROXY = {},

    _apply = function (collection, fn, args) {
      return collection[fn].apply(collection, args);
    };

Object.defineProperty(PROXY, 'namespacer', {value: require('./namespacer'), writable: true});
Object.defineProperty(PROXY, 'mapper', {value: require('./mapper'), writable: true});

/**
 * Proxies calls
 *
 * @param {Object} model
 * @param {String} fn
 * @param {String} namespace
 * @param {Object} collection
 * @param {Array} args
 * @param {Function} callback
 */
PROXY.proxy = function (model, fn, namespace, collection, args, callback) {

  // noop
  if (arguments.length < 6) {
    callback = function () {};
  }

  if (model.namespaces && model.namespaces[namespace]) {
    // has side effects, alters args
    PROXY.namespacer.filter(model.namespaces, namespace, fn, args);
  }

  if (model.maps) {
    // has side effects, alters args
    PROXY.mapper.map(model.maps, fn, args);
  }

  // overwritten method
  if (PROXY[fn] !== undefined) {
    return PROXY[fn](model, collection, args, callback);

  // driver method
  } else {
    args[args.length - 1] = callback;
    _apply(collection, fn, args);
  }
};

/**
 * Calls `find` + `toArray`
 *
 * @param {Object} model
 * @param {Object} collection
 * @param {Array} args
 * @param {Function} callback
 */
PROXY.findArray = function (model, collection, args, callback) {
  args[args.length - 1] = function (error, cursor) {
    cursor.toArray(callback);
  };
  _apply(collection, 'find', args);
};

/**
 * Calls `insert`
 * and triggers the `beforeInsert` and `afterInsert` hooks
 *
 * @param {Object} model
 * @param {Object} collection
 * @param {Array} args
 * @param {Function} callback
 */
PROXY.insert = function (model, collection, args, callback) {
  args[args.length - 1] = function (error, ret) {
    if (error) {
      return callback(error, null);
    }
    model.afterInsert(args[0], function (error, _) {
      callback(error, ret);
    });
  };

  if (!Array.isArray(args[0])) {
    args[0] = [args[0]];
  }

  model.beforeInsert(args[0], function (error, documents) {
    if (error) {
      return callback(error, null);
    }

    args[0] = documents;

    _apply(collection, 'insert', args);
  });
};

/**
 * Calls `findAndModify` or `update`
 * and triggers the `beforeUpdate` and `afterUpdate` hooks
 *
 * @param {Object} model
 * @param {Object} collection
 * @param {Array} args
 * @param {Function} callback
 */
['findAndModify', 'update'].forEach(function (method) {
  PROXY[method] = function (model, collection, args, callback) {
    var update_index = method === 'update' ? 1 : 2;

    args[args.length - 1] = function (error, ret) {
      if (error) {
        return callback(error, null);
      }
      model.afterUpdate(args[0], args[update_index], function (error, _) {
        callback(error, ret);
      });
    };

    model.beforeUpdate(args[0], args[update_index], function (error, _query, _update) {
      if (error) {
        return callback(error, null);
      }

      args[0] = _query;
      args[update_index] = _update;

      _apply(collection, method, args);
    });
  };
});

/**
 * Calls `remove`
 * and triggers the `beforeRemove` and `afterRemove` hooks
 *
 * @param {Object} model
 * @param {Object} collection
 * @param {Array} args
 * @param {Function} callback
 */
PROXY.remove = function (model, collection, args, callback) {
  args[args.length - 1] = function (error, ret) {
    if (error) {
      return callback(error, null);
    }

    model.afterRemove(args[0], function (error, _) {
      callback(error, ret);
    });
  };

  model.beforeRemove(args[0], function (error, _query) {
    if (error) {
      return callback(error, null);
    }

    args[0] = _query;

    _apply(collection, 'remove', args);
  });
};

/**
 * Calls `mapReduce` + `find`
 *
 * @param {Object} model
 * @param {Object} collection
 * @param {Array} args
 * @param {Function} callback
 */
PROXY.mapReduceCursor = function (model, collection, args, callback) {
  args[args.length - 1] = function (error, collection) {
    if (error) {
      callback(error, null);
    } else {
      collection.find(callback);
    }
  };
  _apply(collection, 'mapReduce', args);
};

/**
 * Calls `mapReduce` + `find` + `toArray`
 *
 * @param {Object} model
 * @param {Object} collection
 * @param {Array} args
 * @param {Function} callback
 */
PROXY.mapReduceArray = function (model, collection, args, callback) {
  PROXY.mapReduceCursor(model, collection, args, function (error, cursor) {
    if (error) {
      callback(error, null);
    } else {
      cursor.toArray(callback);
    }
  });
};

module.exports = PROXY;
