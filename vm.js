! function(document) {

    // 
    // 虚拟节点： 封装与标记
    // 
    var $$ = function(node, cloneUid) {
        // if ($$.forKeyPath) {
            console.log(node, cloneUid, uid)
        // }
        // $$(node) -> new $$(node)
        if (!(this instanceof $$)) return new $$(node, cloneUid)

        // $$(uid) get $node
        var uid = node
        // $$(node) get $node
        if (node.nodeType) {
            uid = $$.getUid(node)
        }
        var $node = $$.map[uid + $$.forKeyPath]  // !!!!!!!!!todo 只有通过 $$(uid) 才能 + $$.forKeyPath
        if ($node) {
            // is $$(node) -> $$($node.componment.$el)
            if ($node.componment) {
                return $$($node.componment.$dom)
            }
            return $node
        }

        // new $node save
        var uid = cloneUid || $$.incId()
        this.uid = uid
        this.node = node
        $$.map[uid] = this

        // info
        if (node.nodeValue) { this.initNodeValue = node.nodeValue.replace(/\n/g, ' ') }


        // for $(node) get
        $$.setUid(node, uid)
    }
    $$.utils = {
        /*
        forKeyPath = $$.forKeyPath
        for(key in list){
        	$$.forKeyPath += '.' + key
        }
        $$.forKeyPath = forKeyPath

        $(uid){
        	return $$.map[uid + $$.forKeyPath]
        }
        */
        forKeyPath: '', // uid.for1ItemKey.for2ItemKey...
        map: {},
        incId: function() {
            return this._inc = (this._inc || 0) + 1
        },
        canSetUidOnTextNode: (function() { // ie
            try { return document.createTxextNode('').uid = false } catch (e) {}
        })(),
        setUid: function(node, uid) {
            if (node.nodeType == 1) {
                node.uid = uid
                node.setAttribute('uid', uid) // @dev
            } else if (node.nodeType == 3) {
                if ($$.canSetUidOnTextNode) {
                    node.uid = uid
                } else {
                	var map = node.parentNode.uidNodeMap || (node.parentNode.uidNodeMap = {})
                	map[uid] = node
                }
            }
        },
        getUid: function(node) {
            if (node.nodeType == 1) {
                return node.uid
            } else if (node.nodeType == 3) {
                if ($$.canSetUidOnTextNode) {
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
        extend: function(obj, _obj) {
            for (var key in _obj) {
                if (!_obj.hasOwnProperty(key)) continue
                obj[key] = _obj[key]
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
        indexOf: function (array, value) {
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
        replaceVars: function(s, vs) {
            for (var k in vs) {
                s = s.replace(RegExp(k, 'g'), vs[k])
            }
            return s + '\n'
        },
        parseText: function(text) {
            return '"' + text
                // 边界符外的("\) -> "\"text\\"
                .replace(/(^|}}).*?({{|$)/g, function($) {
                    return $.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
                })
                // 换行符 -> "\n code"
                .replace(/\r?\n/g, '\\n')
                // {{exp}} -> "+(exp)+"
                .replace(/{{(.*?)}}/g, '"+($1)+"')
                // 
                +
                '"'
        },
        addEventListener: function(type, fn) {
            return document.addEventListener ? function(type, fn) {
                // 1 事件捕捉， 因为 focus, blur 等事件不支持冒泡
                document.body.addEventListener(type, fn, 1)
            } : function(type, fn) {
                document.attachEvent('on' + type, function() {
                    var event = window.event
                    event.target = event.srcElement
                    fn(event)
                });
            }
        }(),
        on: function(type, node, fn) {
            $$.addEventListener(type, function(event) {
                if (event.target == node) {
                    fn(event)
                }
            })
        },
        getDirs: function(node) {
            var dirs = Array(10) // 留位给 for 等特殊指令，位置代表优先级
            dirs.size = 0 // 通过 size 判断数量

            $$.each($$.toArray(node.attributes), function(attribute){
                if (attribute.specified) { // ie

                    var nodeName = attribute.nodeName
                    var nodeValue = attribute.nodeValue

                    // dir                           @|dir        :   arg      .mdf.13
                    var m = nodeName.match(/^(?:v-)?(@|[^.:]*)(?:[:]?([^.]+))?(.*)/) || []
                    var name = m[1] || 'attr'
                    var name = name == 'bind'? 'attr': name
                    var name = name == '@'? 'on': name
                    if (name in $$.prototype) { // 指令就是虚拟节点的方法
                        node.removeAttribute(nodeName)
                        dirs.size += 1

                        var dir = {
                            nodeName: nodeName,
                            name: name,
                            arg: m[2] || '',
                            mdfs: m[3] || '',
                            exp: nodeValue || '""'
                        }
                        var $dirs = 'for,is,if,elseif,else'.split(',') // 优先级排序
                        var index = $$.indexOf($dirs, name)
                        if (index > -1) {
                            dirs[index] = dir
                        } else {
                            dirs.push(dir)
                        }

                        // 可通过key取
                        dirs[nodeName] = dir
                    }

                }
            })
            return dirs
        }
    }
    $$.utils.extend($$, $$.utils)
    $$.prototype = {
        autofocus: function() {
            if (!this.focused) {
                var self = this
                setTimeout(function(){ // ie?
                    self.node.focus()
                },1)
                this.focused = true
            }
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
            var attrs = this.attrs || {}
            if (value === attrs[name]) return
            attrs[name] = this.node[name] = value
            this.attrs = attrs
            return this
        },
        'if': function(value, fn) {
            this.isIf = true // for clone insert?
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
            var node = this.node
            if (!this.markNode) {
                var mark = document.createComment(this.uid)
                // var mark = document.createTextNode('')
                // var mark = document.createComment(node.outerHTML) // @dev
                node.parentNode.insertBefore(mark, node)
                this.markNode = mark
                mark.node = node // @dev
            }
        },
        remove: function() {
            var node = this.node
            var parentNode = node.parentNode
            if (parentNode && parentNode.nodeType == 1) {
                this.mark()
                parentNode.removeChild(node)
            }
        },
        insert: function() {
            var node = this.node
            var parentNode = node.parentNode
            if (!parentNode || parentNode.nodeType != 1) {
                var markNode = this.markNode || this.$forNode.markNode
                markNode.parentNode.insertBefore(node, markNode)
            }
        },
        clone: function(key) {
            var $forNode = this
            var forNode = this.node

            var clones = this.clones = this.clones || {}
            var $node = clones[key]
            if (!$node) {
                var cloneNode = forNode.cloneNode(true)

                // 克隆元素标识，使能通过原节点标识找到克隆节点
                // 原节点id.key
                function loop(forNode, cloneNode) {
                    var uid = $$.getUid(forNode)
                    if (uid) {
                        var $cloneNode = $$(cloneNode, uid + '.' + key)
                        // console.log($cloneNode, cloneNode)
                        // 复制指令信息
                        var $forNode = $$.map[uid]
                        $cloneNode.dirs = $forNode.dirs
                    }

                    var forChildNodes = forNode.childNodes
                    var childNodes = cloneNode.childNodes
                    for (var i = 0; i < forChildNodes.length; i++) {
                        loop(forChildNodes[i], childNodes[i])
                    }

                }
                loop(forNode, cloneNode)


                cloneNode.setAttribute('_for', $forNode.uid) // @dev
                $node = $$(cloneNode)
                // console.log($node, cloneNode)
                $node.$forNode = $forNode
                $node.cloneNode = cloneNode

                clones[key] = $node
            }

            return $node
        },
        'for': function(list, fn) {
            var $forNode = this

            // this.mark()
            this.remove()

            var forKeyPath = $$.forKeyPath
            try {
                $$.each(list, function(item, key, index) {

                    // clone
                    $$.forKeyPath = forKeyPath + '.' + key
                    var $node = $forNode.clone(key)
                    // 当 for, if 同时存在，for insert, if false remove, 会造成dom更新
                    $node.isIf || $node.insert()

                    fn(item, key, index)
                })
            } catch (e) {
                // 避免报错时 forKeyPath 混乱
                setTimeout(function() {
                    throw e
                }, 1)
            }
            $$.forKeyPath = forKeyPath

            // remove
            var clones = this.clones
            for (var key in clones) {
                var $node = clones[key]
                if (!list || !(key in list)) {
                    $node.remove()
                }
            }
        },
        on: function(type, nodeName, fn) {
            var $node = this
            this.eventMap = this.eventMap || {}
            var handler = this.eventMap[nodeName]
            // 首次注册
            if (!handler) {
                var dir = this.dirs[nodeName]
                var mdfs = dir.mdfs
                $$.on(type, this.node, function(event) {
                    // todo mfds

                    // call handler
                    $node.eventMap[nodeName](event)
                })
            }
            // 保存更新 handler
            this.eventMap[nodeName] = fn
        },
        model: function() {
            // todo
        },
        is: function(name, data) {
            var self = this
            var node = this.node
            if (!this.componment) {
                var options = V.componments[name]
                // 副本
                options = $$.extend({}, options)
                options.data = $$.extend(data, typeof options.data == 'function' ? options.data() : options.data)
                this.componment = V(options)

                // 同步在 for 里会打乱 forKeyPath
                setTimeout(function() {
                    self.componment.$mount(node)
                }, 1)
            } else {
                setTimeout(function() {
                    self.componment.$render()
                }, 1)
            }
        }
    }


    // 
    // 视图模型： 编译，生成dom，更新dom
    // 
    var V = function(options) {
        // V() -> new V()
        if (!(this instanceof V)) return new V(options)

        // data
        var data = typeof options.data == 'function' ? options.data() : options.data
        this.$data = data
        $$.extend(this, data)
        // methods
        V.setMethods(this, options.methods)
        // computed
        V.setComputed(this, options.computed)

        // el
        this.$el = typeof options.el == 'string' ? document.getElementById(options.el.replace('#','')) : options.el

        // template
        this.$template = options.template || V.outerHTML(this.$el)

        // dom
        this.$dom = V.parseHTML(this.$template)

        // compile render
        this.$$ = $$
        this.$foceUpdate = V.compile(this.$dom)
        this.$render = function() {
            var self = this

            var fps = 24
            var timeGap = 1000 / fps
            // var timeGap = 100

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
        if (this.$el) {
            this.$mount(this.$el)
        }
    }
    V.utils = {
        compile: function(node) {
            /*
            $$(uid).if(bool, function(){
            	$$(uid).text()
            })
            $$(uid).for(list, function (item) {
            	$$(uid).for(item.children, function (sub) {
            		$$(uid).text(sub)
            	})
            	$$(uid).on('click', function ($event) {remove(item)})
            })
            $$(uid).is('com')
            */
            var code = ''
            // var code = 'console.log("r");' // @dev

            scan(node)

            function scan(node) {
                // console.log(node)

                switch (node.nodeType) {
                    case 1: // element

                        // dirs
                        var dirs = $$.getDirs(node)
                        var $node = dirs.size ? $$(node) : null
                        if ($node) {
                            $node.dirs = dirs
                        }

                        var hasFor
                        var hasIf
                        var hasElseIf
                        var hasElse
                        $$.each(dirs, function(dir) {
                            if (!dir) return

                            var name = dir.name
                            switch (dir.name) {
                                case 'for':
                                    hasFor = true
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
                                    code += $$.replaceVars('$$(@id)["for"]( @list, function( @item, @key, @index ){ ', {
                                        '@id': $node.uid,
                                        '@list': list_,
                                        '@item': item_,
                                        '@key': key_,
                                        '@index': index_
                                    })
                                    break
                                case 'if':
                                    hasIf = true
                                    code += $$.replaceVars('$$(@id)["if"]( @value, function(){ ', {
                                        '@id': $node.uid,
                                        '@value': dir.exp
                                    })
                                    break
                                case 'elseif':
                                    hasElseIf = true
                                    code += $$.replaceVars('["elseif"]( $$(@id), @value, function(){ ', {
                                        '@id': $node.uid,
                                        '@value': dir.exp
                                    })
                                    break
                                case 'else':
                                    hasElse = true
                                    code += $$.replaceVars('["else"]( $$(@id), function(){ ', {
                                        '@id': $node.uid
                                    })
                                    break
                                case 'on':
                                    code += $$.replaceVars('$$(@id).on("@type", "@nodeName", function($event){' +
                                        '!function(fn){if(typeof fn=="function")fn($event)}(@code)' +
                                        ';$thisVm.$render()})', {
                                            '@id': $node.uid,
                                            '@type': dir.arg,
                                            '@nodeName': dir.nodeName,
                                            '@code': dir.exp
                                        })
                                    break
                                case 'model':
                                    code += $$.replaceVars('$$(@id).on("@type", "@nodeName", function($event){' +
                                        '@model=$event.target.value' +
                                        ';$thisVm.$render()})', {
                                            '@id': $node.uid,
                                            '@type': 'input',
                                            '@nodeName': dir.nodeName,
                                            '@model': dir.exp
                                        })
                                    break
                                case 'is':
                                    code += $$.replaceVars('$$(@id).is("@name", @attrs)', {
                                        '@id': $node.uid,
                                        '@name': dir.exp,
                                        '@attrs': '{todo:"todo props"}'
                                    })
                                    break
                                default:
                                    code += $$.replaceVars('$$(@id)["@name"](@value, "@arg", "@mdfs")', {
                                        '@id': $node.uid,
                                        '@name': dir.name,
                                        '@arg': dir.arg,
                                        '@mdfs': dir.mdfs,
                                        '@value': dir.exp

                                    })
                            }
                        })

                        // childNodes
                        var childNodes = $$.toArray(node.childNodes)
                        for (var i = 0; i < childNodes.length; i++) {
                            scan(childNodes[i])
                        }

                        // end if
                        if (hasFor) {
                            code += '})\n'
                        }
                        // end elseif
                        if (hasElseIf) {
                            code += '})\n'
                        }
                        // end else
                        if (hasElse) {
                            code += '})\n'
                        }
                        // end for
                        if (hasIf) {
                            code += '})\n'
                        }

                        break;
                    case 3: // text

                        var nodeValue = String(node.nodeValue) // ie: null, boolean

                        // {{}}
                        if (nodeValue.match('{{')) {
                            code += $$.replaceVars('$$(@id).text( @value )', {
                                '@id': $$(node).uid,
                                '@value': $$.parseText(nodeValue)
                            })
                        }

                        break;
                }

            }

            var render = Function('var $thisVm=this;with(this){\n' + code + '\n}')
            return render
        },
        parseEl: document.createElement('div'),
        parseHTML: function(html) {
            V.parseEl.innerHTML = html
            return V.parseEl.children[0] || V.parseEl.childNodes[0]
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
        setComputed: function (vm, computed) {
            for(var key in computed){
                var fn = computed[key]
                fn.valueOf = function () {
                    return this.call(vm)
                }
                vm[key] = fn
            }
        }
    }
    $$.extend(V, V.utils)
    V.prototype = {
        $mount: function(el) {
            el.parentNode.replaceChild(this.$dom, el)
            this.$el = this.$dom

            // first render
            this.$foceUpdate()

            // mounted
            this.$mounted && this.$mounted()

        }
    }


    // 
    // 组件 保存生成 vm 的 options
    // $$().is()->V(options)->$mount()
    // 
    V.componments = {}
    V.componment = function(name, options) {
        V.componments[name] = options
    }


    // export
    V.$$ = $$
    if (typeof module == 'object') {
        module.exports = V
    } else {
        window.V = V // todo name: ve, vme, vne, vie, wu, wue, ...
        window.Vue = V
        window.$$ = $$ // @dev
    }
}(document)