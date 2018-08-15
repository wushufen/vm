! function(window, document) {
    var SHOW = {
        uid: true,
        mark: true,
        dir: false
    }

    var incUid = function (i) {
        return function () {
           return ++i
        } 
    }(0)

    var canSetUidOnTextNode = (function() { // ie8-: false
        try { return document.createTextNode('').uid = true } catch (e) {}
    })()

    function hasOwn(obj, property) { // ie: !node.hasOwnProperty
        if (obj.nodeType == 1) {
            return obj[property] // all: !img.hasOwnProperty('onload') 'src' ..
        } else {
            return Object.hasOwnProperty.call(obj, property)
        }
    }

    function extend(obj, map) {
        for (var key in map) {
            if (!hasOwn(map, key)) continue
            obj[key] = map[key]
        }
        return obj
    }

    function orExtend(obj, map) {
        for (var key in map) {
            if (!hasOwn(map, key)) continue
            if (key in obj) continue
            obj[key] = map[key]
        }
        return obj
    }

    function toArray(list) {
        if (!list) return []
        var length = list.length
        var arr = new Array(length)
        while (length--) {
            arr[length] = list[length]
        }
        return arr
    }

    function forEach(list, fn) {
        if (!list) return
        for (var i = 0, length = list.length; i < length; i++) {
            var item = list[i]
            fn(item, i, i, list)
        }
    }

    function each(list, fn) {
        if (list instanceof Array) {
            forEach(list, fn)
        } else {
            var i = 0
            for (var key in list) {
                if (!hasOwn(list, key)) continue
                var item = list[key]
                fn(item, key, i++, list)
            }
        }
    }

    var indexOf = [].indexOf ? function (array, value) {
        return array.indexOf(value)
    } : function (array, value) {
        for (var i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return i
            }
        }
        return -1
    }

    function includes(array, value) {
        return indexOf(array, value) > -1
    }

    function remove(array, value) {
        for (var i = 0; i < array.length; i++) {
            var item = array[i]
            if (item === value) {
                array.splice(i, 1), i--
                return
            }
        }
    }

    var trim = ''.trim ? function (string) {
        return string.trim()
    } : function (string) {
        return String(string).replace(/^\s+|\s+$/g, '')
    }

    function toNumber(value) {
        if (!isNaN(value)) return Number(value)
        return value
    }

    function strVars(s, vs) {
        for (var k in vs) {
            s = s.replace(RegExp(k, 'g'), vs[k])
        }
        return s + '\n'
    }

    function parseText(text) {
        return '"' + text
            // }}(["\]){{ -> "\"text\\"
            .replace(/(^|}}).*?({{|$)/g, function($) {
                return $.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
            })
            // \n -> "\n code"
            .replace(/\r?\n/g, '\\n')
            // {{exp}} -> "+(exp)+"
            .replace(/{{(.*?)}}/g, '"+($1)+"')
            // 
            +
            '"'
    }

    var parseEl = document.createElement('div')

    function parseHTML(html) {
        parseEl.innerHTML = html
        var el = parseEl.children[0] || parseEl.childNodes[0]
        parseEl.removeChild(el) // ie8-: 如不移除就清空， el 的子节点也会被清空
        parseEl.innerHTML = ''
        return el
    }

    function outerHTML(node) {
        if (node.outerHTML) return node.outerHTML
        parseEl.innerHTML = ''
        parseEl.appendChild(node.cloneNode(true))
        return parseEl.innerHTML
    }

    var contains = parseEl.contains ? function (node, child) {
        return node.contains(child)
    } : function (node, child) {
        return node == child || function loop(child) {
            var parentNode = child.parentNode
            return parentNode == node || (parentNode && loop(parentNode))
        }(child)
    }

    function getElement(selector) {
        if (!selector) return
        if (selector.nodeType == 1) return selector
        if (document.querySelector) return document.querySelector(selector)
        if (selector.match(/^#/))  return document.getElementById(selector.slice(1))
    }

    // readonly -> readOnly
    var attrPropMap = {
        // 'text': 'innerText',
        // 'html': 'innerHTML'
    }
    for(var name in document.createElement('input')){
        if (!name.match(/[A-Z]/)) continue
        attrPropMap[name.toLowerCase()] = name
    }
    function attr2prop(name) {
        return attrPropMap[name] || name
    }

    var on = function() {
        return window.addEventListener ? function(node, type, fn, useCapture) {
            node.addEventListener(type, fn, useCapture)

        } : function(node, type, fn) { // ie
            type = {
                input: 'keyup',
                focus: 'focusin',
                blur: 'focusout'
            }[type] || type

            node.attachEvent('on' + type, function() {
                var event = window.event
                event.target = event.srcElement
                event.preventDefault = function() { event.returnValue = false }
                event.stopPropagation = function() { event.cancelBubble = true }
                fn(event)
            })
        }
    }()

    var off = function() {
        return window.removeEventListener ? function(node, fn) {
            node.removeEventListener(fn)
        } : function(node, fn) {
            // todo
        }
    }()

    var live = function(node, type, fn, useCapture) {
        // true: 事件捕捉。 focus, blur 等事件不支持冒泡
        useCapture = 'focus,blur'.match(type) ? true : useCapture
        on(document, type, function(event) {
            if (contains(node, event.target)) {
                fn(event)
            }
        }, useCapture)
    }

    /*
    forKeyPath = VNode.forKeyPath
    for(key in list){
        VNode.forKeyPath += '.' + key
    }
    VNode.forKeyPath = forKeyPath

    VNode(uid){
        return VNode.map[uid + VNode.forKeyPath]
    }
    */
    // 每个vm须重新开始
    VNode.forKeyPath = '' // uid.for1ItemKey.for2ItemKey...
    VNode.map = {} // uid: node

    // 
    // 虚拟节点
    // 
    function VNode(node, cloneUid) {
        // VNode(node) -> new VNode(node)
        if (!(this instanceof VNode)) return new VNode(node, cloneUid)

        // VNode(uid) -> vnode
        if (typeof node != 'object') {
            var uid = node
            // VNode(number) -> vnode: uid+'.key.0'
            var vnode = VNode.map[uid + VNode.forKeyPath] // **!!!**
            // is="component"
            return vnode.vcomponent || vnode
        }

        // VNode(node) -> return saved
        if (!cloneUid) { // !cloneUid: ie会把 node.uid 复制到克隆节点
            var uid = VNode.getUid(node)
            if (uid) {
                return VNode.map[uid]
            }
        }

        // save
        // VNode(unSavedNode) || VNode(node, cloneUid)
        var uid = cloneUid || incUid()
        this.uid = uid
        this.node = node
        this.attrs = VNode.getAttrs(node)
        this.propertys = extend({}, this.attrs)

        VNode.setUid(node, uid) // node -> uid
        VNode.map[uid] = this // uid -> vnode
    }
    extend(VNode, {
        setUid: function(node, uid) {
            if (node.nodeType == 1) {
                node.uid = uid
                SHOW.uid && node.setAttribute('uid', uid) // @dev
            } else if (node.nodeType == 3) {
                if (canSetUidOnTextNode) {
                    node.uid = uid
                } else { // ie
                    // save on parentNode
                    var map = node.parentNode.uidNodeMap || (node.parentNode.uidNodeMap = {})
                    map[uid] = node
                }
            }
        },
        getUid: function(node) {
            if (node.nodeType == 1) {
                return node.uid
            } else if (node.nodeType == 3) {
                if (canSetUidOnTextNode) {
                    return node.uid
                }
                var map = node.parentNode.uidNodeMap
                for (var uid in map) {
                    if (map[uid] == node) {
                        return uid
                    }
                }
            }
        },
        getAttrs: function(node) {
            var attrs = {}
            forEach(node.attributes, function(attribute) {
                if (attribute.specified || attribute.nodeName == 'value') { // ie || ie7-
                    attrs[attribute.nodeName] = attribute.nodeValue
                }
            })
            return attrs
        },
        getDirs: function(node) {
            var dirs = Array(10) // 留位给 for 等特殊指令，位置代表优先级
            dirs.size = 0 // 通过 size 判断数量

            // ie7: !!toArray ?? for??
            forEach(toArray(node.attributes), function(attribute) {
                if (!attribute.specified) return // ie

                var nodeName = attribute.nodeName
                var nodeValue = attribute.nodeValue

                // idr                      v-    .on  .:  @  on    :  click   .mdf.s
                var m = nodeName.match(/^(?:v-)?(\.on|[.:]|@|[^.:]+):?([^.]+)?(.*)/) || []
                var name = m[1]
                if (name == '.') name = 'property'
                if (name == ':') name = 'property'
                if (name == 'bind') name = 'property'
                if (name == '.on') name = 'on'
                if (name == '@') name = 'on'
                if (name == 'else-if') name = 'elseif'

                if (name in VNode.prototype) { // 指令就是虚拟节点的方法
                    SHOW.dir || node.removeAttribute(nodeName) // !@dev
                    dirs.size += 1

                    var dir = {
                        nodeName: nodeName,
                        name: name,
                        arg: m[2] || '',
                        mdfs: m[3] || '',
                        exp: nodeValue || '""'
                    }

                    var $dirs = 'pre,for,if,elseif,else,is'.split(',') // 特殊指令优先级排序
                    var index = indexOf($dirs, name)
                    if (index > -1) {
                        dirs[index] = dir
                        // dirs.for = true
                        dirs[name] = dir
                    } else {
                        dirs.push(dir)
                    }

                }

            })
            return dirs
        }
    })
    // 虚拟节点方法：可以执行的指令
    VNode.prototype = {
        pre: null,
        ref: function (vm, name) {
            // todo: for ref
            vm.$refs = vm.$refs = {}
            vm.$refs[name] = this.node
        },
        autofocus: function() {
            if (this.focused) return
            var self = this
            setTimeout(function() { // ie?
                self.node.focus()
            }, 1)
            this.focused = true
        },
        property: function(name, value) {
            var propertys = this.propertys
            // get
            if (arguments.length == 1) {
                // :value="object"
                return name in propertys ? propertys[name] : this.node[name]
            }
            // set
            if (name == 'class') {
                this.setClass(value)
                return
            }
            if (name == 'style') {
                this.setStyle(value)
                return
            }
            // vnode change?
            if (propertys[name] === value && name in propertys) return value
            return propertys[name] = this.node[name] = value
        },
        text: function(value) {
            this.property('innerText', value)
        },
        html: function(value) {
            this.property('innerHTML', value)
        },
        setStyle: function(map) {
            var style = this.style = this.style || {}
            for (var key in map) {
                var value = map[key]
                if (style[key] === value) continue
                try { // ie
                    style[key] = this.node.style[key] = value
                } catch (e) {}
            }
        },
        hasClass: function(name) {
            return this.node.className.match(RegExp('(^| )' + name + '( |$)', 'i'))
        },
        addClass: function(name) {
            this.node.className += ' ' + name.replace(/, ?/g, ' ')
        },
        removeClass: function(name) {
            this.node.className = this.node.className.replace(RegExp('(^| )' + name + '(?= |$)', 'ig'), '')
        },
        'setClass': function(map) {
            var classes = this.classes = this.classes || {}
            for (var name in map) {
                var bool = map[name]
                if (bool && !classes[name]) {
                    this.addClass(name)
                    classes[name] = true
                }
                if (!bool && classes[name]) {
                    this.removeClass(name)
                    classes[name] = false
                }
            }
        },
        show: function(value) {
            this.setStyle({ display: value ? '' : 'none' })
        },
        hide: function(value) {
            this.show(!value)
        },
        'if': function(value, fn) {
            if (value) {
                this.insert()
                fn()
            } else {
                this.remove()
            }
            return {
                value: value,
                'elseif': this['elseif'],
                'else': this['else']
            }
        },
        'elseif': function(vnode, value, fn) {
            if (this.value) {
                vnode.remove()
            } else if (value) {
                vnode.insert()
                fn()
            } else {
                vnode.remove()
            }
            return {
                value: this.value || value,
                'else': this['else']
            }
        },
        'else': function(vnode, fn) {
            if (this.value) {
                vnode.remove()
            } else {
                vnode.insert()
                fn()
            }
        },
        mark: function() {
            if (this.markNode) return
            var node = this.node
            var mark = document.createTextNode('')
            if (SHOW.mark || !canSetUidOnTextNode) {
                var mark = document.createComment(this.uid) // @dev
                // var mark = document.createComment(node.outerHTML) // @dev
            }
            node.parentNode.insertBefore(mark, node)
            this.markNode = mark
            mark.node = node // @dev

        },
        remove: function() {
            if (this.vcomponent) {
                this.vcomponent.remove()
                return
            }
            var node = this.node
            var parentNode = node.parentNode
            if (parentNode && parentNode.nodeType == 1) {
                this.mark()
                parentNode.removeChild(node)
            }
        },
        insert: function(toNode) {
            if (this.vcomponent) {
                this.vcomponent.insert()
                return
            }
            var node = this.node
            var parentNode = node.parentNode
            if (!parentNode || parentNode.nodeType != 1) {
                var markNode = toNode || this.markNode || this.vfor.markNode
                markNode.parentNode.insertBefore(node, markNode)
            }
        },
        clone: function(key) {
            var clones = this.clones = this.clones || {}
            var vnode = clones[key]
            if (vnode) return vnode // cache

            // clone
            var vfor = this
            var forNode = this.node
            var cloneNode = forNode.cloneNode(true)

            // 克隆元素标识，使能通过原节点标识找到克隆节点
            // forNodeUid.key
            'IIF',
            function loop(forNode, cloneNode) {
                var uid = VNode.getUid(forNode)
                // save cloneNode
                uid && VNode(cloneNode, uid + '.' + key) // **!!!**

                var forChildNodes = forNode.childNodes
                var childNodes = cloneNode.childNodes
                for (var i = 0; i < forChildNodes.length; i++) {
                    loop(forChildNodes[i], childNodes[i])
                }
            }(forNode, cloneNode)

            vnode = VNode(cloneNode)
            vnode.vfor = vfor // vnode.$forNone.mackNode -> insert node

            // cache
            clones[key] = vnode

            return vnode
        },
        'for': function(list, fn) {
            var vfor = this.vis || this

            // this.mark()
            vfor.remove()

            var forKeyPath = VNode.forKeyPath // **!!!**
            // try {
            each(list, function(item, key, index) {
                // clone
                VNode.forKeyPath = forKeyPath + '.' + key // **!!!**
                var vnode = vfor.clone(key)

                // 当 for, if 同时存在，for insert, if false remove, 会造成dom更新
                if (!vnode.isIf) {
                    vnode.insert()
                }

                fn(item, key, index)

                // console.log(vnode.property('key'))
            })
            // } catch (e) {
            //     // 避免报错时 forKeyPath 混乱
            //     setTimeout(function() {
            //         throw e
            //     }, 1)
            // }
            VNode.forKeyPath = forKeyPath // **!!!**

            // remove
            var clones = vfor.clones
            for (var key in clones) {
                var vnode = clones[key]
                if (!list || !(key in list)) {
                    vnode.remove()
                }
            }
        },
        on: function(type, mdfs, fn) {
            fn = arguments[arguments.length - 1] // mdfs?
            this.eventMap = this.eventMap || {}

            var key = type + mdfs // click.mdfs.ctrl
            var handler = this.eventMap[key]
            // 保存||更新 handler
            this.eventMap[key] = fn //旧的fn有旧的闭包
            if (handler) return

            // 首次注册
            var vnode = this
            var node = this.node
            on(node, type, function(event) {
                // mfds
                if (mdfs.match(/\.prevent\b/)) event.preventDefault()
                if (mdfs.match(/\.stop\b/)) event.stopPropagation()
                if (mdfs.match(/\.self\b/) && event.target != node) return

                if (mdfs.match(/\.ctrl\b/) && !event.ctrlKey) return
                if (mdfs.match(/\.alt\b/) && !event.altKey) return
                if (mdfs.match(/\.shift\b/) && !event.shiftKey) return
                if (mdfs.match(/\.meta\b/) && !event.metaKey) return

                if (mdfs.match(/\.enter\b/) && event.keyCode != 13) return

                var m = mdfs.match(/\.(\d+)/)
                if (m && event.keyCode != m[1]) return

                // call handler
                vnode.eventMap[key].call(vnode, event) // vnode.on bind vnode
            })
        },
        model: function(obj, key, mdfs, vm) {
            var vnode = this
            var node = this.node
            var value = obj[key]

            // m -> v
            setTimeout(function() { //wait VNode(node||option).property('value', 'value')
                // checkbox
                if (node.type == 'checkbox') {
                    // array
                    if (value instanceof Array) {
                        var has = includes(value, vnode.property('value'))
                        vnode.property('checked', has)
                    }
                    // boolean
                    else {
                        vnode.property('checked', value)
                    }
                }
                // radio
                else if (node.type == 'radio') {
                    var eq = vnode.property('value') === value // ==?
                    vnode.property('checked', eq)
                }
                // select
                else if (node.nodeName.match(/^select$/i)) {
                    var hasSelected = false
                    forEach(node.options, function(option) {
                        var voption = VNode(option)

                        // array [multiple]
                        if (value instanceof Array) {
                            var bool = includes(value, voption.property('value'))
                            voption.property('selected', bool)
                        }
                        // one
                        else {
                            vnode.property('value', value)

                            if (voption.property('value') === value) { // ==?
                                voption.property('selected', true)
                                hasSelected = true
                            } else {
                                voption.property('selected', false) // !ie
                            }
                        }
                    })
                    if (!(value instanceof Array) && !hasSelected) { // ie
                        node.selectedIndex = -1
                    }
                }
                // input textarea ..
                else {
                    vnode.property('value', value)
                }
            }, 1)

            // v -> m
            var type = 'input'
            if (mdfs.match('.lazy')) type = 'change'
            if (node.type == 'checkbox') type = 'click'
            if (node.type == 'radio') type = 'click'
            if (node.nodeName.match(/^select$/i)) type = 'change'

            this.on(type, '.model', function(e) {
                var node = this.node

                // checkbox
                if (node.type == 'checkbox') {
                    // array
                    if (value instanceof Array) {
                        var array = value
                        if (node.checked) {
                            this.propertys.checked = true
                            array.push(this.property('value'))
                        } else {
                            this.propertys.checked = false
                            remove(array, this.property('value'))
                        }
                    } else {
                        obj[key] = this.propertys.checked = node.checked
                    }
                } else if (node.type == 'radio') {
                    node.checked = true // ie7-: 没有name属性无法选中 ![name] -> click false
                    obj[key] = this.property('value')
                }
                // select
                else if (node.nodeName.match(/^select$/i)) {
                    forEach(node.options, function(option) {
                        var voption = VNode(option)
                        if (value instanceof Array) {
                            if (option.selected) {
                                voption.propertys.selected = true
                                if (!includes(value, voption.property('value'))) {
                                    value.push(voption.property('value'))
                                }
                            } else {
                                voption.propertys.selected = false
                                remove(value, voption.property('value'))
                            }
                        } else {
                            if (option.selected) {
                                vnode.property('value', voption.property('value'))
                                voption.propertys.selected = true
                                obj[key] = voption.property('value')
                            } else {
                                voption.propertys.selected = false
                            }
                        }
                    })
                }
                // input textarea ..
                else {
                    var nodeValue = node.value
                    if (mdfs.match('.trim')) {
                        nodeValue = trim(nodeValue)
                    }
                    if (mdfs.match('.number')) {
                        nodeValue = toNumber(nodeValue)
                    }
                    obj[key] = this.propertys.value = nodeValue
                }

                // update view
                vm.$foceUpdate()
            })
        },
        is: function(vm, name) {
            var vis = this.vis || this
            if (!vis.vcomponent) {
                // new component
                var options = VM.optionsMap[name]
                if (!options) {
                    setTimeout(function() { throw name + ' is not a component' }, 1)
                    return
                }
                var component = VM(options)
                component.$parent = vm

                var vcomponent = VNode(component.$el)
                vcomponent.component = component

                vis.vcomponent = vcomponent
                vcomponent.vis = vis

                // $mount && $render
                component.$mount(vis.node)
            }

            var vcomponent = vis.vcomponent
            var component = vcomponent.component

            setTimeout(function () { // wait :value
                // props
                extend(component, vcomponent.propertys)
                // render
                component.$render()
            }, 1)
        }
    }


    // 
    // 视图模型： 编译，生成dom，更新dom
    // 
    function VM(options) {
        // VM() -> new VM()
        if (!(this instanceof VM)) return new VM(options)

        // options
        options = options || {}
        this.$options = options

        // data
        var data = options.data
        if (typeof options.data == 'function') {
            data = options.data()
        }
        VM.setData(this, data)
        this.$data = data

        // methods
        VM.setData(this, options.methods)

        // computed
        VM.setData(this, options.computed)

        // el
        var el = getElement(options.el)
        if (!options.el && !options.template) {
            el = document.body.parentNode
        }
        if (el && el.computed) {
            el = null
            options.template = '<b>-_-</b>'
        }
        if (el) {
            el.computed = true
        }

        // template
        var template = options.template || (el ? outerHTML(el) : '<b>^_^</b>')
        // this.$template = template // @dev

        // $el
        this.$el = el ? el : parseHTML(template)

        // compile render
        this.$foceUpdate = VM.compile(this.$el)

        this.$VN = function (uid) {
            var vnode = VNode(uid)
            vnode.vm = this
            return vnode
        }
        this.$render = function() {
            var self = this

            var fps = 24
            var timeGap = 1000 / fps
            // var timeGap = 1

            var now = +new Date
            var lastTime = this.$render.lastTime || 0

            // timeGap 间隔内只更新一次
            if (now > lastTime + timeGap) {
                this.$render.lastTime = now
                setTimeout(function() {
                    self.$foceUpdate()
                }, timeGap + 2) // +2 确保不漏
            }
        }

        // mount
        this.$mounted = options.mounted && VM.injectFunction(this, options.mounted)
        el && this.$mount(el)
    }
    VM.prototype = {
        $mount: function(el) {
            el.parentNode.replaceChild(this.$el, el)
            this.$el = el

            // first render
            this.$render() // 必须异步，每个vm VNode.forKeyPath 独立

            // mounted
            this.$mounted && this.$mounted()
        }
    }
    extend(VM, {
        compile: function(node) {
            /*
            VNode(uid).if(bool, function(){
                VNode(uid).text()
            })
            VNode(uid).for(list, function (item) {
                VNode(uid).for(item.children, function (sub) {
                    VNode(uid).text(sub)
                })
                VNode(uid).on('click', function ($event) {remove(item)})
            })
            VNode(uid).is('com')
            */
            var code = ''
            // var code = 'console.trace("r");' // @dev

            scan(node)

            function scan(node) {
                // console.log(node)
                // console.log(outerHTML(node))

                switch (node.nodeType) {
                    case 1: // element

                        // <component>
                        var tag = node.nodeName.toLowerCase()
                        // console.log(node.outerHTML)
                        if (VM.optionsMap[tag]) {
                            node.setAttribute('is', tag)
                        }

                        // dirs
                        var dirs = VNode.getDirs(node)
                        var vnode = VNode(node)

                        // !
                        if (dirs.pre) {
                            return
                        }

                        each(dirs, function(dir) {
                            if (!dir) return

                            var name = dir.name
                            switch (dir.name) {
                                case 'for':
                                    var for_ = dir.exp
                                    var item_list = for_.split(' in ')
                                    var list_ = item_list[1]
                                    var item_ = item_list[0]
                                    var key_ = '$key'
                                    var index_ = '$index'

                                    var item_m = item_.match(/\((.*)\)/) // (item, key, index)
                                    if (item_m) {
                                        var item_key_index = item_m[1].split(',')
                                        item_ = item_key_index[0]
                                        key_ = item_key_index[1]
                                        index_ = item_key_index[2]
                                    }
                                    code += strVars('$VN(@id)["for"]( @list, function( @item, @key, @index ){ ', {
                                        '@id': vnode.uid,
                                        '@list': list_,
                                        '@item': item_,
                                        '@key': key_,
                                        '@index': index_
                                    })
                                    break
                                case 'if':
                                    vnode.isIf = true // if for insert
                                    code += strVars('$VN(@id)["if"]( @value, function(){ ', {
                                        '@id': vnode.uid,
                                        '@value': dir.exp
                                    })
                                    break
                                case 'elseif':
                                    code += strVars('["elseif"]( $VN(@id), @value, function(){ ', {
                                        '@id': vnode.uid,
                                        '@value': dir.exp
                                    })
                                    break
                                case 'else':
                                    code += strVars('["else"]( $VN(@id), function(){ ', {
                                        '@id': vnode.uid
                                    })
                                    break
                                case 'on':
                                    code += strVars('$VN(@id).on("@type", "@mdfs", function($event){ @code ;$THISVM.$render()})', {
                                        '@id': vnode.uid,
                                        '@type': dir.arg,
                                        '@mdfs': dir.mdfs,
                                        '@code': dir.exp.match(/[=;]/) ? dir.exp : // 语句
                                            '!function(fn){typeof fn=="function"&&fn($event)}(' + dir.exp + ')' // 表达式
                                    })
                                    break
                                case 'model':
                                    // "model"
                                    var obj_ = '$THISVM'
                                    var key_ = '"' + dir.exp + '"'
                                    //                       obj     .key  | ['key' ]
                                    var okm = dir.exp.match(/(.+)(?:\.(.+?)|\[(.+?)\])\s*$/)
                                    if (okm) {
                                        obj_ = okm[1]
                                        key_ = okm[2] ? '"' + okm[2] + '"' : okm[3]
                                    }

                                    code += strVars('$VN(@id).model( @obj, @key, "@mdfs", $THISVM )', {
                                        '@id': vnode.uid,
                                        '@obj': obj_,
                                        '@key': key_,
                                        '@mdfs': dir.mdfs
                                    })

                                    break
                                case 'property':
                                    code += strVars('$VN(@id).property("@name", @value)', {
                                        '@id': vnode.uid,
                                        '@name': attr2prop(dir.arg),
                                        '@value': dir.exp
                                    })
                                    break
                                case 'is':
                                    code += strVars('$VN(@id).is($THISVM, "@name")', {
                                        '@id': vnode.uid,
                                        '@name': dir.exp
                                    })
                                    break
                                case 'ref':
                                    code += strVars('$VN(@id).ref($THISVM, "@name")', {
                                        '@id': vnode.uid,
                                        '@name': dir.exp
                                    })
                                    break
                                default:
                                    code += strVars('$VN(@id)["@dir"](@value, "@arg", "@mdfs")', {
                                        '@id': vnode.uid,
                                        '@dir': dir.name,
                                        '@arg': dir.arg,
                                        '@mdfs': dir.mdfs,
                                        '@value': dir.exp
                                    })
                            }
                        })

                        // compile childNodes
                        var childNodes = toArray(node.childNodes)
                        for (var i = 0; i < childNodes.length; i++) {
                            scan(childNodes[i])
                        }

                        // end: for if elseif else
                        if (dirs['for']) code += '})\n'
                        if (dirs['if']) code += '})\n'
                        if (dirs['elseif']) code += '})\n'
                        if (dirs['else']) code += '})\n'

                        break;
                    case 3: // text

                        var nodeValue = String(node.nodeValue) // ie: null, boolean

                        // {{}}
                        if (nodeValue.match('{{')) {
                            var vnode = VNode(node)
                            vnode.initNodeValue = node.nodeValue.replace(/\n/g, ' ')  // @dev

                            code += strVars('$VN(@id).property( "nodeValue", @value )', {
                                '@id': vnode.uid,
                                '@value': parseText(nodeValue)
                            })

                            // --{{}}
                            node.nodeValue = '　　' // ie !''
                        }

                        break;
                }

            }

            var render = Function('var $THISVM=this;with(this){\n' + code + '\n}')
            return render
        },
        injectFunction: function(vm, fn) {
            var $fn = function() {

                // inject setTimeout, setInterval, img.onload, ajax.onload
                // ie8-:
                // typeof setTimeout == 'object'; !setTimeout.apply
                // window.setTimeout = 1; setTimeout != window.setTimeout // -_-!!
                // 
                // typeof setInterval == 'object'; !setInterval.apply
                // window.setInterval = 1; setInterval == window.setInterval
                // 
                // !a1~aN
                var setTimeout = window.setTimeout
                window.setTimeout = function(fn, time, a1, a2, a3) {
                    return setTimeout(VM.injectFunction(vm, function() {
                        fn.apply(this, arguments)
                    }), time, a1, a2, a3)
                }
                var setInterval = window.setInterval
                window.setInterval = function(fn, time, a1, a2, a3) {
                    return setInterval(VM.injectFunction(vm, function() {
                        fn.apply(this, arguments)
                    }), time, a1, a2, a3)
                }
                var Image = window.Image
                window.Image = function(width, height) {
                    var self = new Image(width, height)
                    setTimeout(function() {
                        each(self, function(handler, name){
                            if (name.match(/^on/) && typeof handler == 'function') {
                                self[name] = VM.injectFunction(vm, function() {
                                    handler.apply(self, arguments)
                                })
                            }
                        })
                    }, 1)
                    return self
                }
                var XMLHttpRequest = window.XMLHttpRequest || window.ActiveXObject
                var XHRprototype = XMLHttpRequest.prototype
                var send = XHRprototype.send
                XHRprototype.send = function() {
                    var self = this
                    each(self, function (handler, name) {
                        if (name.match(/^on/) && typeof handler == 'function') {
                            self[name] = VM.injectFunction(vm, function() {
                                handler.apply(this, arguments)
                            })
                        }
                    })
                    return send && send.apply(this, arguments)
                }

                // run
                var rs = fn.apply(vm, arguments)

                // restore
                window.setTimeout = setTimeout
                window.setInterval = setInterval
                window.Image = Image
                XMLHttpRequest.prototype.send = send

                // $render
                vm.$render()
                return rs
            }

            // computed
            $fn.toJSON = $fn.toString = $fn.valueOf = function () {
                return fn.call(vm)
            }

            $fn.fn = fn
            return $fn
        },
        overwriteFunction: function (vm, fn) {
            // ?? scope
            var code = fn.toString()
            console.log(code)
        },
        setData: function (vm, data) {
            for(var key in data){
                if (!hasOwn(data, key)) continue
                var item = data[key]
                if (typeof item == 'function') {
                    vm[key] = VM.injectFunction(vm, item)
                } else {
                    vm[key] = item
                }
            }
        }
    })


    // 
    // component
    // VNode().is( name ) -> VM( optionsMap[name] )->$mount()
    // 
    VM.optionsMap = {}
    VM.component = function(name, options) {
        options.isComponent = true
        VM.optionsMap[name] = options
    }


    // console
    if (typeof Proxy != 'undefined') {
        setTimeout(function() {
            for (name in window) {
                if (name.match('webkit')) continue // !warn
                var vm = window[name]
                if (vm && typeof vm.$render == 'function') {
                    window[name] = new Proxy(vm, {
                        set: function(vm, key, value) {
                            vm[key] = value
                            vm.$render()
                        },
                        get: function(vm, key) {
                            vm.$render()
                            return vm[key]
                        }
                    })
                }
            }
        }, 500)
    }


    // export
    VM.VNode = VNode
    if (typeof module == 'object') {
        module.exports = VM
    } else {
        window.V = VM
        window.VM = VM
        window.Vue = VM
        window.VNode = VNode // @dev
    }
}(window, document)