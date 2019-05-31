## vm.js

没有用到 `Object.defineProperty()` 等 `es5, es6` 特性，所有代码都是基于 `es3` 所以兼容性强，可用于需要兼容老ie的项目。  
超轻量，可考虑用于 活动页、广告投放页 等轻量的项目。

实现原理如下：  
[从零实现mvvm框架，重写一个轻量的vue并兼容ie](https://github.com/wusfen/vm/wiki)

### 特性
* 兼容ie所有版本
* 超轻量压缩gzip才3k
* 与vue语法完全一致，实现了常用的功能

### 示例
```html
<!DOCTYPE html>
<html>
<head>
  <title>hello world</title>
  <script src="../vm.js"></script>
</head>
<body>
  <div id="app">
    <input v-model="model"> {{model}}
  </div>
  <script>
    var vm = new Vue({
      el: '#app',
      data: {
        model: 'hello vm.js'
      }
    })
  </script>
</body>
</html>
```


## 演示

可在ie6下测试

* [hello world](https://wusfen.github.io/vm/examples/helloWorld.html) | [源码](examples/helloWorld.html)
* [todo list](https://wusfen.github.io/vm/examples/todoList.html) | [源码](examples/todoList.html)

svg 需浏览器支持才支持 (ie9+)
* [svg](https://wusfen.github.io/vm/examples/svg.html) | [源码](examples/svg.html)

## 已实现的功能列表

* {{插值表达式}}
* v-model
* v-if
* v-for
* v-bind:prop | :prop
* :class
* :style
* v-on:event | @event
  * .prevent.stop.self.ctrl.alt.shift.meta.enter.(keycode)
* options
  * el
  * template
  * render
  * data
  * methods
  * created
  * mounted
* vm.$mount
* Vue.directive
