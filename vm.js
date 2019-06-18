/*! @preserve https://github.com/wusfen/vm */

(function (window, document, undefined) ////
{
  var requestAnimationFrame = window.requestAnimationFrame
  var cancelAnimationFrame = window.cancelAnimationFrame
  if (!requestAnimationFrame) {
    requestAnimationFrame = function (fn) {
      return setTimeout(fn)
    }
    cancelAnimationFrame = function (timer) {
      clearTimeout(timer)
    }
  }

  // for array|arrayLike
  function forEach(arrayLike, fn) {
    if (!arrayLike) return
    for (var i = 0; i < arrayLike.length; i++) {
      var rs = fn.call(this, arrayLike[i], i)
      if (rs !== undefined) return rs // can break
    }
  }

  // for array|object|string|number => []
  function each(list, fn) {
    var array = [], i = 0, rs
    if (list instanceof Array || typeof list == 'string') {
      while (i < list.length) {
        rs = fn.call(this, list[i], i, i++)
        array.push(rs)
      }
    } else if (typeof list == 'number') {
      while (i++ < list) {
        rs = fn.call(this, i, i, i)
        array.push(rs)
      }
    } else {
      for (var key in list) {
        if (list.hasOwnProperty(key)) {
          rs = fn.call(this, list[key], key, i++)
          array.push(rs)
        }
      }
    }
    return array // [].map
  }

  // arrayLike => array
  function toArray(arrayLike, start) {
    var array = [], i = arrayLike.length
    while (i--) array[i] = arrayLike[i]
    return array.slice(start)
  }

  // item index of array
  function indexOf(array, item) {
    var index = -1
    forEach(array, function (_item, i) {
      if (item == _item) return index = i
    })
    return index
  }

  // array remove item
  function remove(array, item) {
    var index = indexOf(array, item)
    index != -1 && array.splice(index, 1)
  }

  // obj extend ... => obj
  function assign(obj) {
    forEach(toArray(arguments, 1), function (arg) {
      each(arg, function (value, key) {
        obj[key] = value
      })
    })
    return obj
  }

  // str"\q"ing => "str\"\\q\"ing"
  function quot(string) {
    return '"' + string.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
  }

  // any => json
  function toJson(val, indentChars, n) {
    n = n || 2
    var indent = indentChars ? '\n' + Array(n).join(indentChars) : ''
    var indentPop = indentChars ? '\n' + Array(n - 1).join(indentChars) : ''
    if (val instanceof Array) {
      return '[' + indent + each(val, function(item){
        return toJson(item, indentChars, n + 1)
      }).join(',' + indent) + indentPop + ']'
    }
    if (val && typeof val == 'object') {
      var items = []
      each(val, function (item, key) {
        if (item === undefined) return
        items.push(quot(key) + ': ' + toJson(item, indentChars, n + 1))
      })
      return '{' + indent + items.join(',' + indent) + indentPop + '}'
    }
    if (typeof val == 'string') {
      return quot(val)
    }
    return String(val)
  }

  // undefined => ''
  // obj => json
  function outValue(val) {
    if (val == undefined) return ''
    if (typeof val == 'object') return toJson(val, '  ')
    return val
  }

  // selector => node
  function querySelector(selector) {
    if (typeof selector == 'string') {
      var s = selector.substr(1)
      if (selector.match(/^#/)) {
        return document.getElementById(s)
      } else if (selector.match(/^\./)) {
        return forEach(document.getElementsByTagName('*'), function (el) {
          if (el.className.match('\\b' + s + '\\b')) {
            return el
          }
        })
      }
    }
    return selector
  }

  // ie: input => onkeyup, focus => onfocusin
  function ieEventType(type) { // ie
    return 'on' + ({
      input: 'keyup',
      focus: 'focusin',
      blur: 'focusout'
    }[type] || type)
  }

  // addEventListener
  var on = function () {
    return window.addEventListener ? function (node, type, fn, useCapture) {
      node.addEventListener(type, fn, useCapture)
    } : function (node, type, fn) { // ie
      type = ieEventType(type)
      var __ieFn = fn.__ieFn || function () {
        var event = window.event
        event.target = event.srcElement
        event.preventDefault = function () { event.returnValue = false }
        event.stopPropagation = function () { event.cancelBubble = true }
        fn.call(this, event)
      }
      fn.__ieFn = __ieFn // for off
      node.attachEvent(type, __ieFn)
    }
  }()

  // removeEventListener
  var off = function () {
    return window.removeEventListener ? function (node, type, fn) {
      node.removeEventListener(type, fn)
    } : function (node, type, fn) { // ie
      type = ieEventType(type)
      fn = fn ? (fn.__ieFn || fn) : null
      node.detachEvent(type, fn)
    }
  }()

  // html => node
  function parse(html) {
    parse.el = parse.el || document.createElement('div')
    parse.el.innerHTML = html
    var node = parse.el.children[0]
    parse.el.removeChild(node) // ie
    return node
  }

  // node => vnodeData
  function getVnodeData(node) {
    var ns = node.namespaceURI
    var vnodeData = {
      nodeType: node.nodeType,
      tagName: node.tagName,
      ns: ns == document.documentElement.namespaceURI ? undefined : ns,
      attrs: {}, // attr="value"
      props: {}, // :prop="value"
      directives: [] // v-dir.mdfs="value"
    }
    var attributes = toArray(node.attributes)
    forEach(attributes, function (attribute) {
      if (!attribute.specified && attribute.nodeName != 'value') return // ie
      var attr = attribute.nodeName
      var value = attribute.nodeValue

      // v-bind:title  :title  v-on:click  @click.prevent.stop
      var m = attr.match(/^(:|@|v-([^.]*))([^.]*)(.*)/)
      if (m) {
        var name = m[2]
        if (m[1] == ':') name = 'bind'
        if (m[1] == '@') name = 'on'
        var arg = m[3]
        var mdfs = m[4]

        // "🚩value" => value without "" in runtime code
        var dir = {
          raw: attr,
          expression: value,
          value: '🚩' + value,
          name: name,
          arg: arg,
          mdfs: mdfs
        }

        if (name == 'on') {
          if (value.match(/[=();]/)) {
            dir.value = '🚩function(){' + value + '}'
          } else {
            dir.value = '🚩function(){' + value + '.apply(__vm,arguments)}'
          }
        }
        if (name == 'model') {
          dir.setModel = '🚩function(value){' + value + '=value; $render()}'
        }
        if (name == 'for') {
          // (item, i) in list
          m = value.match(/(?:\(([^,()]+),([^,()]+)\)|([^,()]+))\s+(?:in|of)\s+(\S+)/) || [0, ',']
          dir.item = m[1] || m[3]
          dir.index = m[2] || '$index'
          dir.list = m[4]
        }

        if (/^(for|if)$/.test(name)) {
          vnodeData.directives[name] = dir
        } else if (name == 'bind') {
          vnodeData.props[arg] = '🚩' + value
        } else {
          vnodeData.directives.push(dir)
        }

        // remove directive attr
        setTimeout(function () { // timeout for template error
          node.removeAttribute(attr)
        })
      } else {
        vnodeData.attrs[attr] = value
      }
    })
    return vnodeData
  }

  // vnodeData + childNodes => vnode tree
  function createVnode(vnodeData, childNodes) {
    var vnode = assign({
      tagName: '',
      attrs: {},
      props: {},
      directives: [],
      childNodes: []
    }, vnodeData)
    vnode.tagName = vnode.tagName.toLowerCase()

    // ['child', [for...]] => ['child', ...]
    // 'text' => {nodeType:3, nodeValue:'text'}
    forEach(childNodes, function (child) {
      if (child instanceof Array) {
        forEach(child, function (child) {
          if (typeof child != 'object') {
            child = { nodeType: 3, nodeValue: String(child) }
          }
          vnode.childNodes.push(child)
        })
      } else {
        if (typeof child != 'object') {
          child = { nodeType: 3, nodeValue: String(child) }
        }
        vnode.childNodes.push(child)
      }
    })

    return vnode
  }

  // vue createElement => createVnode => vnode
  function createElement(tagName, data, childNodes) {
    if (!childNodes) {
      childNodes = data
      data = {}
    }
    data = assign({
      tagName: tagName,
      nodeType: 1
    }, data)
    return createVnode(data, childNodes)
  }

  // vnode tree => node tree
  function createNode(vnode) {
    if (vnode.nodeType == 3) {
      return document.createTextNode(vnode.nodeValue)
    }

    // createElement namespaceURI
    var tagName = vnode.tagName
    var node = vnode.ns && document.createElementNS
      ? document.createElementNS(vnode.ns, tagName)
      : document.createElement(tagName)

    // attrs
    each(vnode.attrs, function (value, name) {
      node.setAttribute(name, value)
      if (name == 'class') node.className = value // ie
    })

    // directives.bind
    each(vnode.directives, function (directive) {
      var name = directive.name
      var bind = VM.options.directives[name].bind
      bind(node, directive, vnode)
    })

    // props
    updateProps(node, vnode.props)

    // childNodes
    forEach(vnode.childNodes, function (vchild) {
      var child = createNode(vchild)
      node.appendChild(child)
    })

    node.vnode = vnode // dev
    return node
  }

  // *:props
  function updateProps(node, props) {
    each(props, function (value, name) {
      if (name == 'style') {
        assign(node.style, value)
        return
      }
      if (name == 'class') {
        each(value, function (bool, key) {
          var className = node.className.replace(RegExp('(?:^|\\s+)' + key, 'g'), '')
          if (bool) {
            node.className = className ? className + ' ' + key : key
          } else {
            node.className = className
          }
        })
        return
      }
      var oldValue = node[name]
      if (value != oldValue) {
        node[name] = value
        // polygon:points ...
        if (typeof oldValue == 'object') {
          node.setAttribute(name, value)
        }
      }
    })
  }

  // → errorNodeTpl
  function detectTeamplateError(code, root, errorNode) {
    try {
      new Function('!' + code)
    } catch (error) {
      errorNode = errorNode.cloneNode()
      var errorTpl = errorNode.outerHTML || errorNode.nodeValue
      errorTpl = errorTpl.replace(/<\/.*?>/, '')
      errorTpl = root.outerHTML.replace(errorTpl, '🐞→ ' + errorTpl)
      throw '[template error]\n  ' + errorTpl
    }
  }

  // node => render() => vnode
  function compile(node, isDebug) {
    /*
    createVnode({tagName:'div'}, [
      'textNode', // textNode
      createVnode({tagName:'ul'}, [
        each(list, function(item, index){ // v-for
          return createVnode({tagName:'li'}, [ loop ])
        })
      ]),
      bool? createVnode({tagName:'span'}, [ loop ]) : '', // v-if
      function component(){ // component
        return createVnode()
      }
    ])
    */
    var code = ''
    var root = node
    loop(root)
    function loop(node) {
      if (!code.match(/^$|\[\s*$/)) code += ',\n' // [childNode, ..]

      // parse element
      if (node.nodeType == 1) {
        var vnodeData = getVnodeData(node)
        var vnodeJson = toJson(vnodeData)
        var dirs = vnodeData.directives
        var vnodeCode = vnodeJson.replace(/"🚩((?:\\.|.)*?)"/g, '$1') // rutime value without ""

        isDebug && detectTeamplateError(vnodeCode, root, node)

        // for if?
        // each(, ()=> bool? createVnode(, [ loop ]): "" )
        if (dirs['for']) {
          var dir = dirs['for']
          code += '__each(' + dir.list + ',function(' + dir.item + ',' + dir.index + '){return '
          isDebug && detectTeamplateError(dir.expression.replace(/ (in|of) /, '/'), root, node)
        }
        // if
        // bool? createVnode(,,[..loop..]): ""
        if (dirs['if']) {
          var expression = dirs['if'].expression
          code += expression + '? '

          isDebug && detectTeamplateError(expression, root, node)
        }

        // createVnode
        code += '__createVnode(' + vnodeCode + ', [\n'

        // childNodes
        var childNodes = toArray(node.childNodes)
        forEach(childNodes, function (childNode) {
          loop(childNode)
        })

        // end createVnode
        code += '])\n'
        // end if
        if (dirs['if']) code += ': ""\n' //: ""
        // end for
        if (dirs['for']) code += '})\n'
      }
      // parse textNode
      else if (node.nodeType == 3) {
        // text{{exp}}no"de  =>  "text" +(exp)+ "no\"de"
        var vnodeCode = node.nodeValue.replace(/\s+/g, ' ')
          .replace(/(^|}})(.*?)({{|$)/g, function (str, $1, $2, $3) {return $1 + quot($2) + $3})
          .replace(/{{(.*?)}}/g, '+__outValue($1)+')
        code += vnodeCode

        isDebug && detectTeamplateError(vnodeCode, root, node)
      }
      // parse commentNode ...
      else {
        code += '""' // empty textNode
      }
    }

    if (!isDebug) {
      try {
        var render = Function('data', 'var __vm=this;with(__vm){return ' + code + '}')
        return render
      } catch (error) {
        // setTimeout(code)
        compile(node, true)
      }
    }
  }

  // node => dom diff update
  function diff(node, vnode, parentNode) {
    if (node && (!node.parentNode || node.parentNode.nodeType != 1)) { // out of document
      return
    }
    // console.log(node && node.tagName, vnode && vnode.tagName)

    parentNode = parentNode || node.parentNode
    var newNode
    // +
    if (!node && vnode) {
      newNode = createNode(vnode)
      parentNode.appendChild(newNode)
    }
    // -
    else if (node && !vnode) {
      parentNode.removeChild(node)
    }
    // +- *nodeType || *tagName
    else if (String(node.tagName).toLowerCase() != String(vnode.tagName)) {
      newNode = createNode(vnode)
      parentNode.replaceChild(newNode, node)
    }
    // *text
    else if (node.nodeType == 3 && node.nodeValue != vnode.nodeValue) {
      node.nodeValue = vnode.nodeValue
    }
    // *node
    else if (node.tagName && vnode.tagName) {
      // directives.update
      each(vnode.directives, function (directive) {
        var name = directive.name
        var update = VM.options.directives[name].update
        update && update(node, directive, vnode)
      })
      // *props
      if (node.tagName && vnode.tagName) {
        updateProps(node, vnode.props)
      }
      // childNodes
      var childNodes = toArray(node.childNodes)
      var newChildren = vnode.childNodes
      var maxLength = Math.max(childNodes.length, newChildren.length)
      for (var i = 0; i < maxLength; i++) {
        diff(childNodes[i], newChildren[i], node)
      }
    }
  }

  // fn => fn() vm.$render()
  function injectRender(vm, fn) {
    var $fn = function () {
      var restoreAsyncs = injectRenderToAsyncs(vm) // inject render to setTimout..
      var rs = fn.apply(this, arguments)
      restoreAsyncs() // restore setTimout..
      vm.$render() // trigger render
      return rs
    }
    return $fn
  }

  // setTimout(fn) => fn() vm.$render()
  function injectRenderToAsyncs(vm) {
    var setTimeout = window.setTimeout
    window.setTimeout = function (fn, delay) {
      var args = toArray(arguments, 2)
      return setTimeout(function () {
        injectRender(vm, fn).apply(this, args)
      }, delay)
    }

    var setInterval = window.setInterval
    window.setInterval = function (fn, delay) {
      var args = toArray(arguments, 2)
      return setInterval(function () {
        injectRender(vm, fn).apply(this, args)
      }, delay)
    }

    var XMLHttpRequest = window.XMLHttpRequest || window.ActiveXObject
    var XMLHttpRequest_prototype = XMLHttpRequest.prototype
    var send = XMLHttpRequest_prototype.send
    XMLHttpRequest.prototype.send = function () {
      var xhr = this
      each(xhr, function (callback, name) {
        if (name.match(/^on/) && typeof callback == 'function') {
          xhr[name] = injectRender(vm, callback)
        }
      })
      return send && send.apply(xhr, arguments)
    }

    var Promise = window.Promise
    if (Promise) {
      var Promise_prototype = Promise.prototype
      var then = Promise_prototype.then
      var _catch = Promise_prototype['catch']
      var _finally = Promise_prototype['finally']
      Promise_prototype.then = function (fn) {
        Promise_prototype.then = then // !!??
        return then.call(this, injectRender(vm, fn))
      }
      Promise_prototype['catch'] = function (fn) {
        Promise_prototype['catch'] = _catch // !!??
        return _catch.call(this, injectRender(vm, fn))
      }
      Promise_prototype['finally'] = function (fn) {
        Promise_prototype['finally'] = _finally // !!??
        return _finally.call(this, injectRender(vm, fn))
      }
    }

    return function restoreAsyncs() {
      window.setTimeout = setTimeout
      window.setInterval = setInterval
      XMLHttpRequest_prototype.send = send
      if (Promise) {
        Promise_prototype.then = then
        Promise_prototype['catch'] = _catch
        Promise_prototype['finally'] = _finally
      }
    }
  }

  // VM class
  function VM(options) {
    var vm = this
    vm.$options = options || (options = {})

    // data
    var data = options.data
    if (typeof data == 'function') data = data.call(vm) // compoment data()
    assign(vm, data)

    // methods
    each(options.methods, function (fn, key) {
      vm[key] = injectRender(vm, fn)
    })

    // hooks
    each(options, function (fn, key) {
      if (typeof fn == 'function') {
        vm[key] = injectRender(vm, fn)
      }
    })

    // $el
    if (options.el) {
      vm.$el = querySelector(options.el)
    }

    // tpl
    var tplNode = vm.$el
    if (options.template) {
      tplNode = parse(options.template)
    }

    // render: options.render || compile
    var render = options.render
    if (!render) {
      tplNode = tplNode || {}
      render = options.render = compile(tplNode)
    }

    // force render
    vm.$forceUpdate = function () {
      var vnode = render.call(vm, createElement)
      vm.$el && diff(vm.$el, vnode)
      options.__vnode = vnode // dev
    }
    // async render
    vm.$render = function () {
      // update computed
      // each(options.computed, function (fn, key) {
      //   vm[key] = fn.call(vm)
      // })

      // trigger watch

      // dom diff update view
      cancelAnimationFrame(render.timer)
      render.timer = requestAnimationFrame(function () {
        vm.$forceUpdate()
      })
    }

    // async call hooks
    requestAnimationFrame(function () {
      // created hook
      vm.created && vm.created()

      // $mount
      if (vm.$el) {
        vm.$mount(vm.$el)
      }
    })

    // test: return proxy
    if (typeof Proxy == 'function') {
      return new Proxy(vm, {
        set: function (vm, key, val) {
          vm[key] = val
          vm.$render()
        },
        get: function (vm, key) {
          vm.$render()
          return vm[key]
        }
      })
    }
  }


  var __createVnode = createVnode
  var __each = each
  var __outValue = outValue
  VM.prototype = {
    constructor: VM,
    __createVnode: __createVnode,
    __each: __each,
    __outValue: __outValue,
    $mount: function (el) {
      this.$el = el

      // render first
      this.$render()

      // mounted hook
      this.mounted && this.mounted()
    }
  }

  VM.options = {
    directives: {}
  }

  // directive: v-directive
  // definition.bind -> createNode
  // definition.update -> diff
  VM.directive = function (name, definition) {
    if (typeof definition == 'function') {
      definition = {
        bind: definition,
        update: definition
      }
    }
    VM.options.directives[name] = definition
  }

  // v-bind:prop  :prop
  // vnode.props || directive('bind') ??

  // v-on:click @click
  VM.directive('on', function (el, binding) {
    off(el, binding.arg, el['__' + binding.raw]) // one
    on(el, binding.arg, el['__' + binding.raw] = function (e) {
      // mdfs
      var mdfs = binding.mdfs
      if (mdfs.match(/\.prevent\b/)) event.preventDefault()
      if (mdfs.match(/\.stop\b/)) event.stopPropagation()
      if (mdfs.match(/\.self\b/) && event.target != el) return

      if (mdfs.match(/\.ctrl\b/) && !event.ctrlKey) return
      if (mdfs.match(/\.alt\b/) && !event.altKey) return
      if (mdfs.match(/\.shift\b/) && !event.shiftKey) return
      if (mdfs.match(/\.meta\b/) && !event.metaKey) return

      if (mdfs.match(/\.enter\b/) && event.keyCode != 13) return

      var m = mdfs.match(/\.(\d+)/)
      if (m && event.keyCode != m[1]) return
      binding.value(e)
    })
  })

  // v-model
  VM.directive('model', function (el, binding, vnode) {
    var model = binding.value
    var attrs = vnode.attrs
    var props = vnode.props
    var value = props.value !== undefined ? props.value : attrs.value
    var eventType
    var viewToModel

    // checkbox
    if (el.type == 'checkbox') {
      eventType = 'click'
      if (model instanceof Array) {
        props.checked = indexOf(model, value) != -1
        viewToModel = function () {
          if (el.checked) {
            model.push(value)
          } else {
            remove(model, value)
          }
          binding.setModel(model)
        }
      } else {
        props.checked = model
        viewToModel = function () {
          binding.setModel(el.checked)
        }
      }
    }
    // radio
    else if (el.type == 'radio') {
      props.checked = model == value
      eventType = 'click'
      viewToModel = function () {
        binding.setModel(value)
      }
    }
    // select
    else if (el.type == 'select-one') {
      props.value = model
      forEach(vnode.childNodes, function (voption) {
        if (voption.nodeType == 1) {
          var optionValue = voption.props.value
          if (optionValue == undefined) {
            optionValue = voption.attrs.value || voption.childNodes[0].nodeValue
          }
          voption.props.selected = optionValue == model
        }
      })
      eventType = 'change'
      viewToModel = function () {
        forEach(el.options, function (option) {
          if (option.selected) {
            var vindex = -1
            forEach(vnode.childNodes, function (voption) {
              if (voption.nodeType == 1) {
                vindex += 1
                if (vindex == option.index) {
                  var optionValue = voption.props.value
                  if (optionValue == undefined) {
                    optionValue = voption.attrs.value || voption.childNodes[0].nodeValue
                  }
                  binding.setModel(optionValue)
                }
              }
            })
          }
        })
      }
    }
    // input, textarea, ...
    else {
      props.value = model
      eventType = 'input'
      viewToModel = function () {
        binding.setModel(el.value)
      }
    }

    off(el, eventType, el.__mf) // once !!
    on(el, eventType, el.__mf = viewToModel)
  })

  // exports
  if (typeof module == 'object') {
    module.exports = VM
  } else {
    window.VM = VM
    window.Vue = VM
  }

} //
)(window, document) ////
