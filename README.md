<!-- # 从零实现mvvm框架，重写一个轻量的vue并兼容ie（包括ie6） -->

## 目录
* 实现思路
* utils 辅助函数
* parse 解析html
* vnode 虚拟dom
* attrs 与 props
* getVnodeData 获取虚拟节点信息
* createVnode 创建虚拟dom
* createNode 创建真实dom
* compile 编译
* render 渲染
* domDiff 算法
* domDiff 如何触发
* VM 构造函数
* drirective 指令
* watch 观测者模式
* computed 计算属性
* compoment 组件

## 实现思路

```javascript
// init
=> parse(html) 
=> comple(node) 
=> render() + data
  => createVnode()
=> diff(oldNode, newNode)
  => removeNode(), crateNode(), diffProps()
=> updatedView

// model -> view
updateModel => render() => diff() => updatedView
// view -> model
viewEvent => updateModel => render() => diff() => updatedView
```

## utils 辅助函数

后面需要用到的辅助函数
* forEach 迭代数组或类数组
* each 迭代数组或对象
* assign 对象扩展
* toArray 类数组转数组
* toJson 转成json

下面是辅助函数的实现：
```javascript
  // for array|arrayLike
  function forEach(arrayLike, fn) {
    if (!arrayLike) return
    for (var i = 0; i < arrayLike.length; i++) {
      fn.call(this, arrayLike[i], i)
    }
  }
  
  // for array|object|string|number => []
  function each(list, fn) {
    var array = [], i = 0, rs
    if (list instanceof Array || typeof list === 'string') {
      while (i < list.length) {
        rs = fn.call(this, list[i], i, i++)
        array.push(rs)
      }
    } else if (typeof list === 'number') {
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
    return array
  }
  
  // obj extend ... => obj
  function assign(obj) {
    forEach(arguments, function (arg, i) {
      i > 0 && each(arg, function (value, key) {
        obj[key] = value
      })
    })
    return obj
  }
  
  // arrayLike => array
  function toArray(arrayLike, start) {
    var array = [], i = arrayLike.length
    while (i--) array[i] = arrayLike[i]
    return array.slice(start)
  }
  
  // val => json
  function toJson(val) {
    if (val && typeof val === 'object') {
      var items = each(val, function (item, key) {
        return '"' + key + '": ' + toJson(item)
      })
      return '{' + items.join(',\n') + '}'
    }
    if (val instanceof Array) {
      return '[' + each(val, toJson).join(',\n') + ']'
    }
    if (typeof val === 'string') {
      return '"' + val + '"'
    }
    return String(val)
  }
```

## parse 解析html

考虑到会使用字符串模板，所以需要一个解析器。 为了把问题简化，先只考虑在浏览器中运行，`innerHTML`就可以实现。

```javascript
  // html => node
  function parse(html) {
    parse.el = parse.el || document.createElemnt('div')
    parse.el.innerHTML = html
    var node = parse.el.children[0]
    parse.el.removeChild(node) // ie
    return node
  }
```

## vnode 虚拟dom

虚拟dom就是原生的javascript对象，其描述了真实dom的结构。例如：
```javascript
var vnode = {
  tag: 'ul', attrs: { title: 'title' },
  children: [
    { tag: 'li', children: ['text1'] },
    { tag: 'li', children: ['text2'] }
  ]
}
```

因为对真实dom进行增删改都比较费性能，而原生javascript原生对象则轻量得多。后面可以通过虚拟dom diff算法，进行差异更新真实dom，从而提高性能。

下面进行一个简单的对比测试，创建N个虚拟dom与真实dom花费多少时间：
```javascript
var n = 100000
var array = []
console.time('obj')
for(var i=0; i<n; i++){
  var obj = {
    tagName: 'div',
    nodeType: 1,
    attrs: {
      title: 'title'
    },
    children: ['text']
  }
  array.push(obj)
}
console.timeEnd('obj')
```
obj: 18.951904296875ms

```javascript
var n = 100000
var parentNode = document.createElement('div')
document.body.appendChild(parentNode)
console.time('node')
for(var i=0; i<n; i++){
  var div = document.createElement('div')
  div.setAttribute('title', 'title')
  div.innerHTML = 'text'
  parentNode.appendChild(div)
}
console.timeEnd('node')
```
node: 3134.69580078125ms

## attrs 与 props

## getVnodeData 获取虚拟节点信息

为了后面生成vnode虚拟dom树，需要解析模板节点，获取vnode的属性，指令等信息。例如：
```html
<div v-if="bool" :title="value" @click.prevent="click()">children</div>
```
=>
```javascript
var vnodeData = {
  tagName: 'DIV',
  nodeType: 1,
  attrs: {},
  props: {
    title: "@~:value",
  },
  directives: [
    {
      name: 'on',
      arg: 'click',
      expression: 'click()',
      value: "@~:function(){ click() }",
      mdfs: '.prevent',
    }
  ]
}
```
```javascript
vnodeData.directives.if = {
  name: 'if',
  expression: 'bool',
  value: "@~:bool",
}
```
`v-if` 和 `v-for` 这两个指令是特殊指令，它们表示运行时代码的逻辑，所以不放在 `directives` 数组内。而通过 `directives.if` 和 `directives.for` 直接读取。

因为指令需要在运行时才能得到变量或表达式的值，现在只能解析得一个字符串。
所以给它们加一个标识 `@~:`，以便在后面的编译运行时 `render` 时，解开 `""` 双引号，成为运行时 `render` 的代码的一部分。

下面是 `getVnodeData` 函数的实现：
```javascript
  // node => vnodeData
  function getVnodeData(node) {
    var vnodeData = {
      nodeType: node.nodeType,
      tagName: node.tagName,
      ns: node.namespaceURI,
      attrs: {}, // attr="value"
      props: {}, // :prop="value"
      directives: [] // v-dir.mdfs="value"
    }
    var attributes = toArray(node.attributes)
    forEach(attributes, function (attribute) {
      if (!attribute.specified) return // ie
      var attr = attribute.nodeName
      var value = attribute.nodeValue
  
      // v-bind:title  :title  v-on:click  @click.prevent.stop
      var m = attr.match(/^(:|@|v-([^.]*))([^.]*)(.*)/)
      if (m) {
        // remove directive attr
        node.removeAttribute(attr)
  
        var name = m[2]
        if (m[1] === ':') name = 'bind'
        if (m[1] === '@') name = 'on'
        var arg = m[3]
        var mdfs = m[4]
  
        // "@~:value" => value without "" in runtime code
        var dir = {
          raw: attr,
          expression: value,
          value: '@~:' + value,
          name: name,
          arg: arg,
          mdfs: mdfs
        }
  
        if (name === 'on') {
          if (value.match(/[=();]/)) {
            dir.value = '@~:function(){' + value + '}'
          } else {
            dir.value = '@~:function(){' + value + '.apply(__vm,arguments)}'
          }
        }
        if (name === 'model') {
          dir.setModel = '@~:function(value){' + value + '=value; __vm.$render()}'
        }
        if (name === 'for') {
          // (item, i) in list
          m = value.match(/(?:\(([^,]+),(\S+?)\)|(\S+))\s+(?:in|of)\s+(\S+)/)
          dir.item = m[1] || m[3]
          dir.index = m[2] || '$index'
          dir.list = m[4]
        }
  
        if (/^(for|if)$/.test(name)) {
          vnodeData.directives[name] = dir
        } else if (name === 'bind') {
          vnodeData.props[arg] = '@~:' + value
        } else {
          vnodeData.directives.push(dir)
        }
      } else {
        vnodeData.attrs[attr] = value
      }
    })
    return vnodeData
  }
```

## createVnode 创建虚拟dom

得到 `vnodeData` 之后，递归子节点即生成虚拟dom树 `vnode`。后面编译 `compile` 将会生成 `createVnode` 的代码，然后生成 `render` 函数。


例如：
```html
<ul>
  <li v-for="(item, index) in list">{{'li text' + index}}</li>
  <li v-if="!list.length">empty</li>
</ul
```
=>
```javascript
createVnode({
  tagName: 'UL',
  attr: {title: 'title'},
}, [
  each(list, function(item, index){  // v-for
    return createVnode({tagName: 'LI' },['li text ' + index]
  }),
  !list.length? createVnode({tagName: 'LI'}, ['empty']): ""  // v-if
])
```
=>
```javascript
var vnode = {
  tagName: 'UL',
  nodeType: 1,
  attr: {title: 'title'},
  childNodes: [
    {
      tagName: 'LI',
      nodeType: 1,
      childNodes: [
        {
          nodeType: 3,
          nodeValue: 'li text 1',
        }
      ]
    }, {
      tagName: 'LI',
      nodeType: 1,
      childNodes: [
        {
          nodeType: 3,
          nodeValue: 'li text 2',
        }
      ]
    },
    "",
  ]
}
```
为了方便生成文本节点，可以直接把字符串作为 `childNodes` 的元素。 `createVnode` 会把它转成 `{nodeType:3,nodeValue:'text'}`

为了方便之后 `v-for` 循环生成不确定个数的子虚拟节点，可以直接把循环生成的数组作为 `childNodes` 的元素。 然后 `createVnode` 会将其展开

后面当 `v-if` 为 `false` 可以用一个注释节点或空文本节点代替，这样可以保持树的结构不会发生太大变化，同时也把问题变得更简单。这里使用空文本节点


下面是 `createVnode` 的实现：

```javascript
  // vnodeData + childNodes => vnode tree
  function createVnode(vnodeData, childNodes) {
    var vnode = assign({
      tagName: vnodeData.tagName,
      attrs: {},
      props: {},
      directives: [],
      childNodes: []
    }, vnodeData)

    // ['child', [for...]] => ['child', ...]
    // 'text' => {nodeType:3, nodeValue:'text'}
    forEach(childNodes, function (child) {
      if (child instanceof Array) {
        forEach(child, function (child) {
          if (typeof child !== 'object') {
            child = { nodeType: 3, nodeValue: String(child) }
          }
          vnode.childNodes.push(child)
        })
      } else {
        if (typeof child !== 'object') {
          child = { nodeType: 3, nodeValue: String(child) }
        }
        vnode.childNodes.push(child)
      }
    })

    return vnode
  }
```

## createNode 创建真实dom

当 `dom diff` 发现 `vnode` 对应的 `node` 不存在时，需要创建真实dom。

`props` 中的 `style` 与 `class` 需要特别处理

考虑到可以内嵌 `svg` ，创建 `svg` 及子节点时需要 `createElementNS`

`directives` 后面会讲到，现在可以先注释掉

下面是 `createNode` 的实现：
```javascript
  // vnode tree => node tree
  function createNode(vnode) {
    if (vnode.nodeType === 3) {
      return document.createTextNode(vnode.nodeValue)
    }

    // createElemnt namespaceURI
    var tagName = vnode.tagName.toLowerCase()
    var node = vnode.ns && document.createElementNS
      ? document.createElementNS(vnode.ns, tagName)
      : document.createElement(tagName)

    // attrs
    each(vnode.attrs, function (value, name) {
      node.setAttribute(name, value)
    })

    // directives.bind
    // each(vnode.directives, function (directive) {
    //   var name = directive.name
    //   var bind = VM.options.directives[name].bind
    //   bind(node, directive, vnode)
    // })

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
```

## updateProps 设置或更新props

当 `createNode` 或者后面 `dom diff` 时，需要设置或更新 `props`

下面是 `updateProps` 的实现：
```javascript
  // node :props
  function updateProps(node, props) {
    each(props, function (value, name) {
      if (name === 'style') {
        assign(node.style, value)
        return
      }
      if (name === 'class') {
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
      if (value !== oldValue) {
        node[name] = value
        // polygon:points ...
        if (typeof oldValue === 'object') {
          node.setAttribute(name, value)
        }
      }
    })
  }
```

## compile 编译
我们需要将模板编译成 `render` 函数， `render` 函数加上 `data` 数据执行后，将生成一个 `vnode` 虚拟dom树。`data` 数据变化后， `render` 又会生成新的 `vnode` 虚拟dom树。后面将会通过 `dom diff` 算法，与旧的dom树进行对比，然后进行差异更新。

我们可以通过 `getVnodeData` 得到 `vnode` 的信息，然后我们需要通过 `toJson` 进行序列化并拼接 `code` 代码。

然后我们可以通过 `new Function(code)` 可以将字符串代码 `code` 生成一个 `render` 函数

例如：
```html
<div :title="value">childNodes</div>
```
```javascript
var nodeData = {
  tagName: "DIV",
  nodeType: 1,
  props: {
    title: {
      value: "@~:value"
    }
  }
}
var code = `
with(data){
  return createVnode(${ toJson(nodeData) }, ['chidlNodes'])
}
`
var render = new Function('var data=this; ' + code)
```
`render` 相当下如下代码：
```javascript
var render = function(){
  var data=this
  with(data){
    return createVnode({
      "tagName": "tagName",
      "nodeType": 1,
      "props": {
        "title": {
          "value": "@~:value"
        }
      }
    }, ['chidlNodes'])
  }
}
```
`data` 我们可以通过 `this` 传进去
```javascript
render.call({
  value: 'This is title'
})
```
这时你会发现加了 `@~:` 标识的 `"@~:value"` 就是我们前面提到的运行时变量或表达式。所以我们需要在编译阶段将其双引号解开。
```javascript
var render = function(){
  var data=this
  with(data){
    return createVnode({
      "tagName": "tagName",
      "nodeType": 1,
      "props": {
        "title": {
          "value": value
        }
      }
    }, ['chidlNodes'])
  }
}
```

下面是 `compile` 的实现：
```javascript
  // node => render() => vnode
  function compile(node) {
    /*
      createVnode({tagName:'div'}, [
        'textNode',
        createVnode({tagName:'ul'}, [
          each(list, function(item, index){
            return createVnode({tagName:'li'}, [ loop ])
          })
        ]),
        bool? createVnode({tagName:'span'}, [ loop ]) : '',
        function component(){
          return createVnode()
        }
      ])
      */
    var code = ''
    loop(node)
    function loop(node) {
      if (!code.match(/^$|\[\s*$/)) code += ',\n' // [childNode, ..]

      // parse element
      if (node.nodeType === 1) {
        var vnodeData = getVnodeData(node)
        var vnodeJson = toJson(vnodeData)
        var dirs = vnodeData.directives
        vnodeJson = vnodeJson.replace(/"@~:((?:\\.|.)*?)"/g, '$1') // rutime value without ""

        // for if?
        // each(, ()=> bool? createVnode(, [ loop ]): "" )
        if (dirs['for']) {
          var dir = dirs['for']
          code += 'this.__each(' + dir.list + ',function(' + dir.item + ',' + dir.index + '){return '
        }
        // if
        // bool? createVnode(,,[..loop..]): ""
        if (dirs['if']) {
          code += dirs['if'].expression + '? '
        }

        // createVnode
        code += 'this.__createVnode(' + vnodeJson + ', [\n'

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
      else if (node.nodeType === 3) {
        // abc{{ exp }}efg"h  =>  "abc" +(exp)+ "efg\"h"
        var nodeValue = node.nodeValue.replace(/\s+/g, ' ')
          .replace(/(^|}}).*?({{|$)/g, function (str) {
            // \ => \\ " => \"
            return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
          })
          // str{{exp}}str => str" + (exp) + "str
          .replace(/{{(.*?)}}/g, '"+($1)+"')
        code += '"' + nodeValue + '"'
      }
      // parse commentNode ...
      else {
        code += '""' // empty textNode
      }
    }

    var render = Function('data', 'var __vm=this;with(__vm){return ' + code + '}')
    return render
  }
```

## domDiff 算法

我们先把可能的情况列出来
* -oldNode +newNode
```javascript
createNode()
```
* +oldNode -newNode
```javascript
oldNode.parentNode.removeChild(oldNode)
```
* -oldNodeType +newNodeType
```javascript
oldNode.parentNode.prelaceChild(createNode(), oldNode)
```
* -oldTextNode.nodeValue +newTextNode.nodeValue
```javascript
oldTextNode.nodeValue = newTextNode.nodeValue
```
* -oldNode.props +newNode.props
```javascript
updateProps(oldNode, newNode.props)
```

为了简化问题，左边 `oldNode` 使用真实dom，右边 `newNode` 使用新生成的虚拟dom，然后在 `diff` 的过程同时更真实dom

下面是 `dom diff` 算法的实现：
```javascript
  // node => dom diff update
  function diff(node, vnode, parentNode) {
    if (node && (!node.parentNode || node.parentNode.nodeType !== 1)) { // out of document
      return
    }
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
    else if (node.tagName !== vnode.tagName) {
      newNode = createNode(vnode)
      parentNode.replaceChild(newNode, node)
    }
    // *text
    else if (node.nodeType === 3 && node.nodeValue !== vnode.nodeValue) {
      node.nodeValue = vnode.nodeValue
    }
    // *node
    else if (node.tagName && vnode.tagName) {
      // directives.update
      each(vnode.directives, function (directive) {
        var name = directive.name
        var update = VM.options.directives[name].update
        update(node, directive, vnode)
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
```

## domDiff 如何触发
待续

## VM 构造函数
待续

## drirective 指令
待续

## watch 观测者模式
待续

## computed 计算属性
待续

## compoment 组件
待续