module.exports = {
  "parserOptions": {
    // 支持 es6 模块
    "sourceType": "module"
  },
  // 运行环境
  "env": {
    "browser": true,
    "node": true
  },
  // eslint-plugin-vue
  "plugins": [
    "vue"
  ],
  "extends": [
    "eslint:recommended",
    /*
     * eslint-plugin-vue
     */
    // "plugin:vue/base",
    "plugin:vue/essential",
    // "plugin:vue/recommended",
    // "plugin:vue/strongly-recommended",
  ],
  "rules": {
    // 缩进
    "indent": [2, 2],
    // 分号
    "semi": [1, "never"],
    // 多空格
    "no-multi-spaces": [1],
    // 操作符旁空格
    "space-infix-ops": [1],
    // 属性冒号旁空格
    "key-spacing": [1],
    // 尾空格
    "no-trailing-spaces": [1],
    // 多空行
    "no-multiple-empty-lines": [1, { max: 3 }],
    // 引号
    "quotes": [1, "single"],
    // 对象属性尾逗号
    "comma-dangle": [1, "only-multiline"],
    // 对象属性多行。要么全换行，要么全不换行
    "object-property-newline": [1, { "allowMultiplePropertiesPerLine": true }],
    // 对象大括号换行。多行时换行
    "object-curly-newline": [1, { "consistent": true }],
    // 属性引号。必要时才加。关键字加 "keywords": true
    "quote-props": [1, "as-needed", {}],
    // 同名属性
    "no-dupe-keys": 1,
    // 未使用变量
    "no-unused-vars": 1,
    // 重复定义
    "no-redeclare": 1,
    // ===
    // "eqeqeq": 1,
    // console.xxx
    "no-console": [1, { "allow": ["warn", "error"] }]
  },
  "globals": {
    // wxmp
    "wx": true,
    "App": true,
    "getApp": true,
    "Page": true,
    "Component": true,
    "getCurrentPages": true,
  }
}