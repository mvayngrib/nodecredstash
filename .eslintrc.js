module.exports = {
  "extends": "airbnb-base",
  "parserOptions": {
    "sourceType": "module",
    "ecmaVersion": 2017
  },
  "plugins": [
    "chai-expect"
  ],
  "rules": {
    "func-names": "off",

    // doesn't work in node v4 :(
    "strict": "off",
    "prefer-rest-params": "off",
    "prefer-template": "warn",
    "react/require-extension": "off",
    "import/no-extraneous-dependencies": "off",
    "class-methods-use-this": "off",
    "eqeqeq": "off",
    "semi": "off",
    "object-curly-newline": "off",
    "consistent-return": "warn",
    "space-infix-ops": "warn",
    "comma-dangle": "off",
    "no-await-in-loop": "warn",
    "arrow-parens": "off",
    "no-underscore-dangle": "off",
    "no-unused-vars": "warn",
    "indent": "warn",
    "space-before-function-paren": "warn",
    "no-multi-assign": "warn",
    "max-len": "warn"
  },
  "env": {
    "mocha": true
  }
};
