```html
<div>
  <input value="input" onchange="add">
  <ul>
    <li for="item in list">
      {item}
      <button onclick="remove(item)"> - </button>
    </li>
  </ul>
</div>

<script>
var input = 'hello world'
var list = []

function add(){
  list.push(input)
  input = ''
}

function remove(item) {
  list.splice(list.indexOf(item), 1)
}

function onload() {
  list = ['ajax.res']
}

function onunload() {
  console.log('onunload')
}
</script>

```
