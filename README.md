## vm.js

这是一个独立自研的 `mvvm` 框架，只是语法跟 `vue` 一致，底层原理跟 `vue` 是完全不一样的， `vue` 无法兼容 `ie8` 及以下。
本框架没有用到 `Object.defineProperty()` 等 `es5`, `es6` 特性，基于 `es3`，兼容性强，可用于需要兼容 `ie` 的项目。
超轻量，可考虑用于 活动页、广告投放页 等轻量的项目。

实现原理如下：  
[从零实现mvvm框架，重写一个轻量的vue并兼容ie](https://github.com/wushufen/vm/wiki)

### 特性
* 兼容 `ie` 所有版本
* 超轻量压缩gzip才 `3k`
* 与 `vue` 语法完全一致，实现了常用的功能

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

* [hello world](https://wushufen.github.io/vm/examples/helloWorld.html) | [源码](examples/helloWorld.html)
* [form](https://wushufen.github.io/vm/examples/form.html) | [源码](examples/form.html)
* [todo list](https://wushufen.github.io/vm/examples/todoList.html) | [源码](examples/todoList.html)
* [template error](https://wushufen.github.io/vm/examples/templateError.html) | [源码](examples/templateError.html)
* [svg (需浏览器支持 ie9+)](https://wushufen.github.io/vm/examples/svg.html) | [源码](examples/svg.html) 

## 已实现的功能列表

* {{插值表达式}}
* v-model
* v-if
* v-for
* v-bind:prop :prop
* v-on:event @event
  * .prevent.stop.self.ctrl.alt.shift.meta.enter.(keycode)
* :class
* :style
* options
  * el
  * template
  * render
  * data
  * methods
  * created
  * mounted
* VM.prototype.$mount
* VM.directive
