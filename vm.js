! function(document) {

    // 
    // 虚拟节点： 封装与标记
    // 
    var $ = function(node, cloneUid) {
        // $(node) -> new $(node)
        if (!(this instanceof $)) return new $(node, cloneUid)

        // $(uid) get $node
        if (typeof node != 'object') {
            var uid = node
            // $(number) -> $node: uid+'.key.0'
            var $node = $.map[uid + $.forKeyPath] // **!!!**
            // $(uid) -> $node.$componment
            return $node.$componment || $node
        }

        // $(node) -> return saved
        if (cloneUid === undefined) { // !cloneUid: ie会把 node.uid 复制到克隆节点
            var uid = $.getUid(node)
            if (uid) {
                return $.map[uid]
            }
        }

        // $(unSavedNode) || $(node, cloneUid) -> save
        var uid = cloneUid || $.incId()
        this.uid = uid
        this.node = node

        $.setUid(node, uid) // node -> uid
        $.map[uid] = this // uid -> $node
    }
    $.utils = {
        /*
        forKeyPath = $.forKeyPath
        for(key in list){
            $.forKeyPath += '.' + key
        }
        $.forKeyPath = forKeyPath

        $(uid){
            return $.map[uid + $.forKeyPath]
        }
        */
        // 每个vm须重新开始
        forKeyPath: '', // uid.for1ItemKey.for2ItemKey...
        map: {},
        incId: function() {
            return this._inc = (this._inc || 0) + 1
        },
        canSetUidOnTextNode: (function() { // ie
            try { return document.createTextNode('').uid = true } catch (e) {}
        })(),
        setUid: function(node, uid) {
            if (node.nodeType == 1) {
                node.uid = uid
                node.setAttribute('uid', uid) // @dev
            } else if (node.nodeType == 3) {
                if ($.canSetUidOnTextNode) {
                    node.uid = uid
                } else {
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
                if ($.canSetUidOnTextNode) {
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
        extend: function(obj, map) {
            for (var key in map) {
                if (!map.hasOwnProperty(key)) continue
                obj[key] = map[key]
            }
            return obj
        },
        toArray: function(list) {
            var length = list.length
            var arr = new Array(length)
            while (length--) {
                arr[length] = list[length]
            }
            return arr
        },
        indexOf: function(array, value) {
            if (array.indexOf) {
                return array.indexOf(value)
            } else {
                for (var i = 0; i < array.length; i++) {
                    if (array[i] == value) {
                        return i
                    }
                }
            }
        },
        each: function(list, fn) {
            if (list instanceof Array) {
                for (var i = 0; i < list.length; i++) {
                    var item = list[i]
                    fn(item, i, i)
                }
            } else {
                var i = 0
                for (var key in list) {
                    if (!list.hasOwnProperty(key)) continue
                    var item = list[key]
                    fn(item, key, i++)
                }
            }
        },
        trim: function(value) {
            return String(value).replace(/^\s+|\s+$/g, '')
        },
        number: function(value) {
            if (!isNaN(value)) return Number(value)
            return value
        },
        replaceVars: function(s, vs) {
            for (var k in vs) {
                s = s.replace(RegExp(k, 'g'), vs[k])
            }
            return s + '\n'
        },
        parseText: function(text) {
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
        },
        on: function() {
            return window.addEventListener ? function(node, type, fn, useCapture) {
                node.addEventListener(type, fn, useCapture)

            } : function(node, type, fn) {
                type = {
                    input: 'keyup',
                    focus: 'focusin',
                    blur: 'focusout'
                }[type] || type
                node.attachEvent('on' + type, function() { // ie
                    var event = window.event
                    event.target = event.srcElement
                    event.preventDefault = function() { event.returnValue = false }
                    event.stopPropagation = function() { event.cancelBubble = true }
                    fn(event)
                })
            }
        }(),
        off: function () {
            return window.removeEventListener? function (node, fn) {
                node.removeEventListener(fn)
            }: function (node, fn) {
                // todo
            }
        }(),
        live: function(node, type, fn, useCapture) {
            // true: 事件捕捉。 focus, blur 等事件不支持冒泡
            useCapture = 'focus,blur'.match(type) ? true : useCapture
            $.on(document, type, function(event) {
                if ($.contains(node, event.target)) {
                    fn(event)
                }
            }, useCapture)
        },
        contains: function(node, child) {
            return node == child || function loop(child) {
                var parentNode = child.parentNode
                return parentNode == node || (parentNode && loop(parentNode))
            }(child)
        },
        getDirs: function(node) {
            var dirs = Array(10) // 留位给 for 等特殊指令，位置代表优先级
            dirs.size = 0 // 通过 size 判断数量

            $.each($.toArray(node.attributes), function(attribute) {
                if (!attribute.specified) return // ie

                var nodeName = attribute.nodeName
                var nodeValue = attribute.nodeValue

                // dir                           @|dir        :   arg      .mdf.13
                var m = nodeName.match(/^(?:v-)?(@|[^.:]*)(?:[:]?([^.]+))?(.*)/) || []
                var name = m[1] || 'attr'
                var name = name == 'bind' ? 'attr' : name
                var name = name == '@' ? 'on' : name

                if (name in $.prototype) { // 指令就是虚拟节点的方法
                    node.removeAttribute(nodeName) // !@dev
                    dirs.size += 1

                    var dir = {
                        nodeName: nodeName,
                        name: name,
                        arg: m[2] || '',
                        mdfs: m[3] || '',
                        exp: nodeValue || '""'
                    }

                    var $dirs = 'for,if,elseif,else,is'.split(',') // 特殊指令优先级排序
                    var index = $.indexOf($dirs, name)
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
    }
    $.utils.extend($, $.utils)
    // dir methods
    $.prototype = {
        autofocus: function() {
            if (this.focused) return
            var self = this
            setTimeout(function() { // ie?
                self.node.focus()
            }, 1)
            this.focused = true
        },
        text: function(value) {
            if (value === this.innerText) return
            var node = this.node
            if (node.nodeType == 3) {
                this.innerText = node.nodeValue = value
            } else if (node.nodeType == 1) {
                this.innerText = node.innerText = value
            }
        },
        html: function(value) {
            if (value === this.innerHTML) return
            this.innerHTML = this.node.innerHTML = value
        },
        attr: function(value, name) {
            if (name == 'class') {
                this.setClass(value)
                return
            }
            if (name == 'style') {
                this.setStyle(value)
                return
            }
            var attrs = this.attrs || {}
            if (value === attrs[name]) return
            attrs[name] = this.node[name] = value
            this.attrs = attrs
        },
        setStyle: function(map) {
            var style = this.style || {}
            for (var key in map) {
                var value = map[key]
                if (style[key] === value) continue
                try { // ie
                    style[key] = this.node.style[key] = value
                } catch (e) {}
            }
            this.style = style
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
            var classes = this.classes || {}
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
            this.classes = classes
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
        'elseif': function($node, value, fn) {
            if (this.value) {
                $node.remove()
            } else if (value) {
                $node.insert()
                fn()
            } else {
                $node.remove()
            }
            return {
                value: this.value || value,
                'else': this['else']
            }
        },
        'else': function($node, fn) {
            if (this.value) {
                $node.remove()
            } else {
                $node.insert()
                fn()
            }
        },
        mark: function() {
            if (this.markNode) return
            var node = this.node
            var mark = document.createTextNode('')
            var mark = document.createComment(this.uid) // @dev
            // var mark = document.createComment(node.outerHTML) // @dev
            node.parentNode.insertBefore(mark, node)
            this.markNode = mark
            mark.node = node // @dev

        },
        remove: function() {
            if (this.$componment) {
                this.$componment.remove()
            }
            var node = this.node
            var parentNode = node.parentNode
            if (parentNode && parentNode.nodeType == 1) {
                this.mark()
                parentNode.removeChild(node)
            }
        },
        insert: function(to) {
            if (this.$componment) {
                this.$componment.insert()
                return
            }
            var node = this.node
            var parentNode = node.parentNode
            if (!parentNode || parentNode.nodeType != 1) {
                var markNode = to || this.markNode || this.$forNode.markNode
                markNode.parentNode.insertBefore(node, markNode)
            }
        },
        clone: function(key) {
            var clones = this.clones = this.clones || {}
            var $node = clones[key]
            if ($node) return $node // cache

            // clone
            var $forNode = this
            var forNode = this.node
            var cloneNode = forNode.cloneNode(true)

            // 克隆元素标识，使能通过原节点标识找到克隆节点
            // forNodeUid.key
            'IIF',
            function loop(forNode, cloneNode) {
                var uid = $.getUid(forNode)
                // save cloneNode
                uid && $(cloneNode, uid + '.' + key) // **!!!**

                var forChildNodes = forNode.childNodes
                var childNodes = cloneNode.childNodes
                for (var i = 0; i < forChildNodes.length; i++) {
                    loop(forChildNodes[i], childNodes[i])
                }
            }(forNode, cloneNode)

            $node = $(cloneNode)
            $node.$forNode = $forNode // $forName.mackNode -> insert

            // cache
            clones[key] = $node

            return $node
        },
        'for': function(list, fn) {
            // this.mark()
            this.remove()

            var $forNode = this
            var forKeyPath = $.forKeyPath // **!!!**
            try {
                $.each(list, function(item, key, index) {
                    // clone
                    $.forKeyPath = forKeyPath + '.' + key // **!!!**
                    var $node = $forNode.clone(key)

                        // 当 for, if 同时存在，for insert, if false remove, 会造成dom更新
                        !$node.isIf && $node.insert()

                    fn(item, key, index)
                })
            } catch (e) {
                // 避免报错时 forKeyPath 混乱
                setTimeout(function() {
                    throw e
                }, 1)
            }
            $.forKeyPath = forKeyPath // **!!!**

            // remove
            var clones = this.clones
            for (var key in clones) {
                var $node = clones[key]
                if (!list || !(key in list)) {
                    $node.remove()
                }
            }
        },
        on: function(type, mdfs, fn) {
            this.eventMap = this.eventMap || {}
            var key = type + mdfs // click.mdfs.ctrl
            var handler = this.eventMap[key]
            // 保存||更新 handler
            this.eventMap[key] = fn //旧的fn有旧的闭包
            if (handler) return

            // 首次注册
            var $node = this
            var node = this.node
            $.on(node, type, function(event) {
                // mfds
                if (mdfs.match('.prevent')) event.preventDefault()
                if (mdfs.match('.stop')) event.stopPropagation()
                if (mdfs.match('.self') && event.target != node) return

                if (mdfs.match('.ctrl') && !event.ctrlKey) return
                if (mdfs.match('.alt') && !event.altKey) return
                if (mdfs.match('.shift') && !event.shiftKey) return
                if (mdfs.match('.meta') && !event.metaKey) return

                if (mdfs.match('.enter') && event.keyCode != 13) return

                // call handler
                $node.eventMap[key](event)
            })
        },
        model: function(value, type, fn) {
            var node = this.node

            // m -> v
            if (value !== this.value) {
                this.value = node.value = value
                this.checked = node.checked = value
            }

            // v -> m
            if (node.nodeName.match(/select/i)) type = 'change'
            if (node.type == 'checkbox') type = 'click'
            this.on(type, '.model', fn)
        },
        is: function(name, data) {
            var self = this
            var node = this.node

            if (!this.isCompoment) { // 新建 componment, 并且 $(uid) -> $node.$componment

                var options = V.componmentOptions[name]
                if (!options) { setTimeout(function() { throw name + ' is not a componment' }, 1) }

                // new componment
                var componment = V(options, data)

                this.$componment = $(componment.$el) // $node -> $componment
                // this.$componment.$node = this // $componment -> $node
                self = this.$componment // $() -> $node.$componment -> self
                self.isCompoment = true
                self.componment = componment // self.componment.$render()

                componment.$mount(node)
            } else {
                // render
                self.componment.$render()
            }
        }
    }


    // 
    // 视图模型： 编译，生成dom，更新dom
    // 
    var V = function(options, propsData) {
        // V() -> new V()
        if (!(this instanceof V)) return new V(options)
        options = options || {}

        // data
        var data = typeof options.data == 'function' ? options.data() : options.data
        this.$data = data
        $.extend(this, propsData) // propsData
        $.extend(this, data)
        // methods
        V.setMethods(this, options.methods)
        // computed
        V.setComputed(this, options.computed)

        // el
        var el = typeof options.el == 'string' ? document.getElementById(options.el.replace('#', '')) : options.el

        // template
        var template = options.template || (el && V.outerHTML(el)) || '<div> @ </div>'
        // this.$template = template // @dev

        // $el
        this.$el = V.parseHTML(template)

        // compile render
        this.$ = $
        this.$foceUpdate = V.compile(this.$el)
        this.$render = function() {
            var self = this

            var fps = 24
            var timeGap = 1000 / fps
            // var timeGap = 1000

            var now = +new Date
            var lastTime = this.$render.lastTime || 0

            if (now > lastTime + timeGap) {
                this.$render.lastTime = now
                setTimeout(function() {
                    self.$foceUpdate()
                }, timeGap + 2) // +2 确保不漏
            }
        }

        // @dev
        // console.log(this.$render)

        this.$mounted = options.mounted && V.injectFunction(this, options.mounted)

        // mount
        el && this.$mount(el)

        // save
        V.componments.push(this)
    }
    V.utils = {
        compile: function(node) {
            /*
            $(uid).if(bool, function(){
                $(uid).text()
            })
            $(uid).for(list, function (item) {
                $(uid).for(item.children, function (sub) {
                    $(uid).text(sub)
                })
                $(uid).on('click', function ($event) {remove(item)})
            })
            $(uid).is('com')
            */
            var code = ''
            // var code = 'console.trace("r");' // @dev

            scan(node)

            function scan(node) {
                // console.log(node)

                switch (node.nodeType) {
                    case 1: // element

                        // dirs
                        var dirs = $.getDirs(node)
                        var $node = dirs.size ? $(node) : null

                        $.each(dirs, function(dir) {
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
                                    code += $.replaceVars('$(@id)["for"]( @list, function( @item, @key, @index ){ ', {
                                        '@id': $node.uid,
                                        '@list': list_,
                                        '@item': item_,
                                        '@key': key_,
                                        '@index': index_
                                    })
                                    break
                                case 'if':
                                    $node.isIf = true // if for insert
                                    code += $.replaceVars('$(@id)["if"]( @value, function(){ ', {
                                        '@id': $node.uid,
                                        '@value': dir.exp
                                    })
                                    break
                                case 'elseif':
                                    code += $.replaceVars('["elseif"]( $(@id), @value, function(){ ', {
                                        '@id': $node.uid,
                                        '@value': dir.exp
                                    })
                                    break
                                case 'else':
                                    code += $.replaceVars('["else"]( $(@id), function(){ ', {
                                        '@id': $node.uid
                                    })
                                    break
                                case 'on':
                                    code += $.replaceVars('$(@id).on("@type", "@mdfs", function($event){ @code ;$THISVM.$render()})', {
                                        '@id': $node.uid,
                                        '@type': dir.arg,
                                        '@mdfs': dir.mdfs,
                                        '@code': dir.exp.match(/[=;]/) ? dir.exp : // 语句
                                            '!function(fn){typeof fn=="function"&&fn($event)}(' + dir.exp + ')' // 表达式
                                    })
                                    break
                                case 'model':
                                    code += $.replaceVars('$(@id).model(@value,"@type",function($event){ @value=@Number(@trim($event.target.value)); $THISVM.$foceUpdate()})', {
                                        '@id': $node.uid,
                                        '@value': dir.exp,
                                        '@type': dir.mdfs.match('.lazy') ? 'change' : 'input',
                                        '@Number': dir.mdfs.match('.number') ? '$.number' : '',
                                        '@trim': dir.mdfs.match('.trim') ? '$.trim' : ''
                                    })
                                    break
                                case 'is':
                                    code += $.replaceVars('$(@id).is("@name", @attrs)', {
                                        '@id': $node.uid,
                                        '@name': dir.exp,
                                        '@attrs': '0' //'{todo:"todo props"}'
                                    })
                                    break
                                default:
                                    code += $.replaceVars('$(@id)["@name"](@value, "@arg", "@mdfs")', {
                                        '@id': $node.uid,
                                        '@name': dir.name,
                                        '@arg': dir.arg,
                                        '@mdfs': dir.mdfs,
                                        '@value': dir.exp

                                    })
                            }
                        })

                        // compile childNodes
                        var childNodes = $.toArray(node.childNodes)
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
                            var $node = $(node)
                            $node.initNodeValue = node.nodeValue.replace(/\n/g, ' ')

                            code += $.replaceVars('$(@id).text( @value )', {
                                '@id': $node.uid,
                                '@value': $.parseText(nodeValue)
                            })
                        }

                        break;
                }

            }

            var render = Function('var $THISVM=this;with(this){\n' + code + '\n}')
            return render
        },
        parseEl: document.createElement('div'),
        parseHTML: function(html) {
            V.parseEl.innerHTML = html
            var el = V.parseEl.children[0] || V.parseEl.childNodes[0]
            // V.parseEl.innerHTML = ''
            return el
        },
        outerHTML: function(node) {
            if (node.outerHTML) return node.outerHTML
            V.parseEl.innerHTML = ''
            V.parseEl.appendChild(node.cloneNode(true))
            return V.parseEl.innerHTML
        },
        injectFunction: function(vm, fn) {
            var $fn = function() {
                var rs = fn.apply(vm, arguments)
                vm.$render()
                return rs
            }
            $fn.fn = fn
            return $fn
        },
        setMethods: function(vm, methods) {
            for (var key in methods) {
                var method = methods[key]
                if (typeof method == 'function') {
                    vm[key] = V.injectFunction(vm, method)
                }
            }
        },
        setComputed: function(vm, computed) {
            for (var key in computed) {
                var fn = computed[key]
                fn.valueOf = function() {
                    return this.call(vm)
                }
                vm[key] = fn
            }
        }
    }
    $.extend(V, V.utils)
    V.prototype = {
        $mount: function(el) {
            el.parentNode.replaceChild(this.$el, el)
            this.$el = this.$el

            // first render
            this.$render() // 必须异步，每个vm $.forKeyPath 独立

            // mounted
            this.$mounted && this.$mounted()

        }
    }


    // 
    // 组件 保存生成 vm 的 options
    // $().is()->V(options)->$mount()
    // 
    V.componmentOptions = {}
    V.componments = []
    V.componment = function(name, options) {
        V.componmentOptions[name] = options
    }


    // dev
    'dev' && function() {
        var devopened
        var timer

        function ondevopen() {
            if (devopened) return
            devopened = true
            timer = setInterval(function() {
                $.each(V.componments, function(item) {
                    item.$render()
                })
            }, 500)
        }

        function ondevclose() {
            devopened = false
            clearInterval(timer)
        }
        if (window.outerWidth - window.innerWidth > 200 ||
            window.outerHeight - window.innerHeight > 200) {
            ondevopen()
        }
        var el = new Image;
        Object.defineProperty&&Object.defineProperty(el, 'id', {
            get: function() {
                ondevopen()
            }
        })
        console.log('%c', el)
        $.on(window, 'keyup', function(e) {
            if (e.keyCode == 123 ||
                (e.metaKey && e.altKey && e.keyCode == 73) ||
                (e.ctrlKey && e.shiftKey && e.keyCode == 73) ||
                (e.ctrlKey && e.shiftKey && e.keyCode == 74)
            ) {
                if (!devopened) {
                    ondevopen()
                } else {
                    ondevclose()
                }
            }
        })
    }()


    // export
    V.$ = $
    if (typeof module == 'object') {
        module.exports = V
    } else {
        window.V = V // todo name: ve, vme, vne, vie, wu, wue, ...
        window.Vue = V
        window.$ = $ // @dev
    }
}(document)