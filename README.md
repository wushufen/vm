# vm.js
兼容ie的mvvm框架，兼容vue语法

## 示例
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
