## vm.js

[从零实现mvvm框架，重写一个轻量的vue并兼容ie](https://github.com/wusfen/vm/wiki)

### 特性
* 兼容ie所有版本
* 超轻量压缩gzip才2.61k
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

## 已实现的功能列表

* {{插值表达式}}
* v-model
* v-if
* v-for
* v-bind:prop | :prop
* :class
* :style
* v-on:event | @event
  * .prevent
  * .stop
  * .self
  * .ctrl
  * .alt
  * .shift
  * .meta
  * .enter
  * .13(keycode)
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