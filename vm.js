
var $$ = function(node, cloneUid){
	// $$(node) -> new $$(node)
	if (!(this instanceof $$)) return new $$(node, cloneUid)

	// $$(1)
	if (!node.nodeType) {
		return $$.map[node + $$.forKeyPath]
	}

	// save
	var uid = cloneUid || $$.incId()
	this.uid = uid
	this.node = node
	$$.map[this.uid] = this

	// @dev: table($$.map)
	if (node.nodeValue) {
		this.oldNodeValue = node.nodeValue.replace(/\n/g, ' ')
	}

	// for cloneNode
	$$.setUid(node, uid)

}
var $$_ = {
	/*
	forKeyPath = $$.forKeyPath
	for key{
		$$.forKeyPath += '.' + key
	}
	$$.forKeyPath = forKeyPath

	$(uid){
		return $$.map[uid + $$.forKeyPath]
	}
	*/
	forKeyPath: '',
	map: {},
	incId: function () {
		return this._inc = (this._inc || 0) + 1
	},
	setUid: function (node, uid) {
		if (node.nodeType==1) {
			node.uid = uid
			node.setAttribute('uid', uid) // @dev
		} else if(node.nodeType==3){
			node.nodeValue = '\r:\b' + uid
		}
	},
	getUid: function (node) {
		if (node.nodeType==1) {
			return node.uid
		} else if(node.nodeType==3){
			if (node.nodeValue.match('^\r:\b')) {
				return node.nodeValue.replace('\r:\b', '')
			}
		}
	},
	extend: function (obj, _obj) {
		for(var key in _obj){
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
	each: function(list, fn) {
		if (list instanceof Array) {
			for(var i = 0; i<list.length; i++){
				var item = list[i]
				fn(item, i, i)
			}
		} else {
			var i = 0
			for(var key in list){
				if (!list.hasOwnProperty(key)) continue
				var item = list[key]
				fn(item, key, i++)
			}
		}
	},
	replaceVars: function(s, vs) {
		for(var k in vs){
			s = s.replace(RegExp(k, 'g'), vs[k])
		}
		return s + '\n'
	},
	parseText: function (text) {
		return '"' + text
			// 边界符外的文本 " \ 转义
			.replace(/(^|}}).*?({{|$)/g, function($) {
				return $.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
			})
			// 换行符转空格
			.replace(/\r?\n/g, '\\n')
			// {{value}} -> "+value+"
			.replace(/{{(.*?)}}/g, '"+$1+"') 
			// 
			+ '"'
	},
	addEventListener: function(type, fn) {
		return document.addEventListener ? function(type, fn) {
			// 1 事件捕捉， 因为 focus, blur 等事件不支持冒泡
			document.body.addEventListener(type, fn, 1)
		} : function(type, fn) {
			document.attachEvent('on' + type, function() {
				fn(window.event)
			});
		}
	}(),
	getDirs: function (node) {
		var attributes = $$.toArray(node.attributes)
		for (var i = 0; i < attributes.length; i++) {
			var attribute = attributes[i]
			if (attribute.specified) {
				console.log(attribute)
			}
		}
	},
}
$$_.extend($$, $$_)
$$.prototype = {
	text: function (value) {
		if (value === this._text) return

		var node = this.node
		if (node.nodeType == 3) {
			this._text = node.nodeValue = value
		} else if(node.nodeType == 1){
			this._text = node.innerText = value
		}
	},
	if: function (value, fn) {
		this.isIf = true
		if (value) {
			fn && fn()
			this.insert()
		} else {
			this.remove()
		}
	},
	elseif: function (value, fn) {
	},
	else: function () {
	},
	mark: function () {
		var node = this.node	
		if (!this.markNode) {
			// var mark = document.createComment(this.uid)
			var mark = document.createComment(node.outerHTML) // @dev
			// var mark = document.createTextNode('')
			node.parentNode.insertBefore(mark, node)
			this.markNode = mark
			node.markNode = mark // @dev
		}
	},
	remove: function () {
		var node = this.node
		var parentNode = node.parentNode
		if (parentNode && parentNode.nodeType == 1) {
			this.mark()
			node.parentNode.removeChild(node)
		}
	},
	insert: function () {
		var node = this.node
		var parentNode = node.parentNode
		if (!parentNode || parentNode.nodeType != 1) {
			var markNode = this.markNode || this.$forNode.markNode
			markNode.parentNode.insertBefore(node, markNode)
		}
	},
	clone: function (key) {
		var $forNode = this
		var forNode = this.node

		var clones = this.clones = this.clones || {}
		var $node = clones[key]
		if (!$node) {
			var node = forNode.cloneNode(true)

			// 克隆元素标识，使能通过原节点标识找到克隆节点
			// 原节点id.key
			!function loop(forNode, node){
				var uid = $$.getUid(forNode)
				if (uid) {
					var _$node = $$(node, uid+'.'+key)
					if (!$node) { // root
						$node = _$node
					}
				}

				var forChildNodes = forNode.childNodes
				var childNodes = node.childNodes
				for (var i = 0; i < forChildNodes.length; i++) {
					loop(forChildNodes[i], childNodes[i])
				}

			}(forNode, node)


			node.setAttribute('_for', $forNode.uid) // @dev
			$node.key = key
			$node.$forNode = $forNode

			clones[key] = $node
		}

		return $node
	},
	for: function (list, fn) {
		var $forNode = this

		this.mark()
		this.remove()

		var forKeyPath = $$.forKeyPath
		$$.each(list, function (item, key, index) {

			// clone
			$$.forKeyPath = forKeyPath + '.' + key
			var $node = $forNode.clone(key)
			// 当 for, if 同时存在，for insert, if false remove, 会造成dom更新
			!$node.isIf && $node.insert()

			fn(item, key, index)
		})
		$$.forKeyPath = forKeyPath

		// remove
		var clones = this.clones
		for(var key in clones){
			var $node = clones[key]
			if (!list || !(key in list)) {
				$node.remove()
			}
		}
	},
	on: function (type, args, fn) {
		
	},
}


/*

$$(uid).if(bool, function(){
	$$(uid).text()
})

$$(uid).for(list, function (item) {

	$$(uid).text(item.name)

	$$(uid).for(item.children, function (sub) {
		$$(uid).text(sub)
	})


	$$(uid).on('click', function ($event) {remove(item)})

})

$$(uid).is('com')

*/
function compile(node) {
	var code = ''


	!function scan(node){
		// console.log(node)

		switch(node.nodeType){
			case 1: // element

				// for
				var for_ = node.getAttribute('for')
				if (for_ && for_.match(' in ')) {
					var item_list = for_.split(' in ')
					var list_ = item_list[1]
					var item_ = item_list[0]
					var key_ = '$key'
					var index_ = '$index'

					var item_m = item_.match(/\((.*)\)/)
					if (item_m) {
						var item_key_index = item_m[1].split(',')
						item_ = item_key_index[0]
						key_ = item_key_index[1]
						index_ = item_key_index[2]
					}
					code += $$.replaceVars('$$( @id ).for( @list, function( @item, @key, @index ){ ', {
						'@id': $$(node).uid,
						'@list': list_,
						'@item': item_,
						'@key': key_,
						'@index': index_
					})
				}

				// if
				var if_ = node.getAttribute('if')
				if (if_) {
					code += $$.replaceVars('$$( @id ).if( @value, function(){ ', {
						'@id': $$(node).uid,
						'@value': if_
					})
				}


				// dirs
				var attributes = $$.toArray(node.attributes);
				for (var i = 0; i < attributes.length; i++) {
					// todo
					attributes[i].specified
				}


				// childNodes
				var childNodes = $$.toArray(node.childNodes)
				for (var i = 0; i < childNodes.length; i++) {
					scan(childNodes[i])
				}


				// end if
				if (if_) {
					code+='})\n'
				}
				// end for
				if (for_) {
					code+='})\n'
				}

				break;
			case 3: // text

				var nodeValue = String(node.nodeValue) // ie: null, boolean

				// {{}}
				if (nodeValue.match('{{')) {
					code += $$.replaceVars('$$( @id ).text( @value )', {
						'@id': $$(node).uid,
						'@value': $$.parseText(nodeValue)
					})
				}

				break;
		}

	}(node)

	var render = Function('data', 'with(data){'+code+'}')
	return render
}


function V(options) {
	var el = options.el
	el = document.querySelector(el)
	var data = options.data

	var render = compile(el)
	render(data)
	data.render = function () {
		render(data)
	}

	return data
}

