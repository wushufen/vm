## vm.js

[从零实现mvvm框架，重写一个轻量的vue并兼容ie](https://github.com/wusfen/vm/wiki)

* 兼容ie所有版本！！
* 超轻量gzip才6k左右
* 与vue语法完全一致


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
